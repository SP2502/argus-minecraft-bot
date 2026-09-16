const test = require('node:test');
const assert = require('node:assert');
const { PermissionManager, PermissionTiers } = require('../src/modules/security');
const AIBrain = require('../src/core/AIBrain');
const TaskManager = require('../src/core/TaskManager');
const LockManager = require('../src/core/LockManager');
const InventoryService = require('../services/InventoryService');
const FarmSkill = require('../skills/farming/FarmSkill');
const { EventEmitter } = require('events');

test('Final Invariants & Regression Test Suite', async (t) => {
  await t.test('Security - Owner Immutability', async (t) => {
    const pm = new PermissionManager();
    pm.ownerUsername = 'ShadowPace';
    // attempt to modify owner
    const res = await pm.grant('ShadowPace', 'guest', 'AdminUser');
    assert.strictEqual(res, null, 'Owner privileges should not be modifiable');
    assert.ok(await pm.hasPermission('ShadowPace', PermissionTiers.OWNER), 'Owner maintains max privileges');
  });

  await t.test('Security - 5-tier RBAC', async (t) => {
    assert.strictEqual(PermissionTiers.OWNER, 4, 'Tier 4 is Owner');
    assert.strictEqual(PermissionTiers.ADMIN, 3, 'Tier 3 is Admin');
    assert.strictEqual(PermissionTiers.TRUSTED, 2, 'Tier 2 is Trusted');
    assert.strictEqual(PermissionTiers.GUEST, 1, 'Tier 1 is Guest');
    assert.strictEqual(PermissionTiers.BLOCKED, 0, 'Tier 0 is Blocked');
  });

  await t.test('Security - Failed-auth auto-block (3 fails in 5 min)', async (t) => {
    const pm = new PermissionManager();
    pm.recordFailedAttempt('hacker');
    pm.recordFailedAttempt('hacker');
    assert.strictEqual(pm.tempBlockedUsers.has('hacker'), false, 'Not blocked yet');
    pm.recordFailedAttempt('hacker');
    assert.strictEqual(pm.tempBlockedUsers.has('hacker'), true, 'Blocked after 3 attempts');
  });

  await t.test('Security - Non-owner command rate limit (10 per minute)', async (t) => {
    const pm = new PermissionManager();
    const ownerName = pm.ownerUsername || 'TestOwner';
    pm.ownerUsername = ownerName;

    for (let i = 0; i < 10; i++) {
      assert.strictEqual(pm.checkRateLimit('spammy'), true, `Attempt ${i+1} allowed`);
    }
    assert.strictEqual(pm.checkRateLimit('spammy'), false, 'Attempt 11 blocked');
    
    for (let i = 0; i < 15; i++) {
      assert.strictEqual(pm.checkRateLimit(ownerName), true, 'Owner is exempt from rate limit');
    }
  });

  await t.test('AI Brain - Adaptive Ticks', async (t) => {
    const brain = new AIBrain(null);
    brain.setTickRate('combat');
    assert.strictEqual(brain.tickRateMs, 50, 'Combat tick is 50ms');
    brain.setTickRate('active');
    assert.strictEqual(brain.tickRateMs, 100, 'Active task tick is 100ms');
    brain.setTickRate('idle');
    assert.strictEqual(brain.tickRateMs, 500, 'Idle tick is 500ms');
    brain.setTickRate('dashboard_only');
    assert.strictEqual(brain.tickRateMs, 1000, 'Dashboard tick is 1000ms');
  });

  await t.test('Lock Manager - Lock Timeout (>5m)', async (t) => {
    const lm = new LockManager();
    lm.acquireLocks('task1', ['movement']);
    // Force set acquiredAt to 6 minutes ago
    lm.locks.get('movement').acquiredAt = Date.now() - 360000;
    
    const timedOut = lm.checkLockTimeouts();
    assert.deepStrictEqual(timedOut, ['task1'], 'task1 timed out');
    assert.strictEqual(lm.isLockHeld('movement'), false, 'Lock released');
  });

  await t.test('Inventory - 16-seed Reservation', async (t) => {
    let deposited = [];
    const chestMock = {
      deposit: async (type, meta, count) => { deposited.push(count); },
      close: () => {},
      containerItems: () => []
    };

    const mockBot = {
      blockAt: () => ({ name: 'chest' }),
      openContainer: async () => chestMock,
      inventory: {
        items: () => [
          { name: 'wheat_seeds', count: 20 },
          { name: 'potato', count: 15 },
          { name: 'carrot', count: 32 }
        ]
      }
    };
    
    const inv = new InventoryService(mockBot, { itemCategories: require('../config/itemCategories') });
    inv.countItem = (name) => mockBot.inventory.items().find(i => i.name === name)?.count || 0;

    await inv.depositAll('crops', { x: 0, y: 0, z: 0 });
    
    assert.ok(deposited.includes(4), 'Deposited 4 wheat_seeds (20 - 16)');
    assert.ok(!deposited.includes(15), 'Did not deposit 15 potatoes (below reserve)');
    assert.ok(deposited.includes(16), 'Deposited 16 carrots (32 - 16)');
  });

  await t.test('Inventory - Slot-6 Water Bucket Layout', async (t) => {
    let moves = [];
    let equips = [];
    const mockBot = {
      inventory: {
        items: () => [
          { name: 'iron_sword', slot: 9 },
          { name: 'water_bucket', slot: 10 },
          { name: 'shield', slot: 11 }
        ]
      },
      moveSlotItem: async (src, dest) => { moves.push({ src, dest }); },
      equip: async (item, dest) => { equips.push({ item, dest }); }
    };
    const inv = new InventoryService(mockBot, {});
    await inv.organizeHotbar();
    
    assert.ok(moves.find(m => m.dest === 36 && m.src === 9), 'Sword moved to slot 36 (Hotbar 0)');
    assert.ok(moves.find(m => m.dest === 42 && m.src === 10), 'Water Bucket moved to slot 42 (Hotbar 6)');
    assert.ok(equips.find(e => e.dest === 'off-hand' && e.item.name === 'shield'), 'Shield equipped to off-hand');
  });

  await t.test('Persistence - Checksum Verification & Corrupted State Recovery', async (t) => {
    const pm = require('../src/core/PersistenceManager');
    const testFile = 'test_corrupted_state.json';
    const initialData = { botName: 'Argus', version: '1.0.0', seed: 12345 };

    // 1. Save data with checksum
    await pm.saveData(testFile, initialData);

    // 2. Corrupt the primary file deliberately
    const fs = require('fs').promises;
    const path = require('path');
    const primaryPath = path.join(pm.dataDir, testFile);
    await fs.writeFile(primaryPath, '{ invalid_corrupted_json: true, checksum: "bad" }', 'utf-8');

    // 3. Load data - should automatically recover from .bak backup
    const recovered = await pm.loadData(testFile, { fallback: true });
    assert.strictEqual(recovered.botName, 'Argus', 'Successfully recovered original state from backup');
    assert.strictEqual(recovered.version, '1.0.0', 'Preserved data payload integrity');

    // Cleanup
    try {
      await fs.unlink(primaryPath);
      await fs.unlink(`${primaryPath}.bak`);
    } catch (e) {}
  });

  await t.test('Safety - Emergency Retreat on Critical Health (<3 Hearts)', async (t) => {
    const SafetyService = require('../services/SafetyService');
    const thresholds = require('../config/safetyThresholds');
    assert.strictEqual(thresholds.CRITICAL_HEALTH, 6, 'Critical health must be 6 (3 hearts)');

    const mockBotLow = { health: 5, food: 20, entity: { position: { x: 0, y: 64, z: 0 } } };
    const safety = new SafetyService(mockBotLow);
    assert.strictEqual(safety.isCritical(), true, 'Health 5/20 (<3 hearts) must trigger isCritical');
    assert.strictEqual(safety.shouldRetreat(), true, 'Critical health must trigger shouldRetreat');

    const mockBotSafe = { health: 18, food: 20, entity: { position: { x: 0, y: 64, z: 0 } } };
    const safetySafe = new SafetyService(mockBotSafe);
    assert.strictEqual(safetySafe.isCritical(), false, 'Healthy bot must not be in critical state');
  });

  await t.test('Tools - Durability Thresholds (20% Warning, 5% Critical)', async (t) => {
    const ToolService = require('../services/ToolService');
    const mockBot = {
      registry: { items: { 1: { maxDurability: 100 } } },
      inventory: { items: () => [] }
    };
    const tools = new ToolService(mockBot);

    const warningItem = { type: 1, maxDurability: 100, durabilityUsed: 81 }; // 19% durability
    const criticalItem = { type: 1, maxDurability: 100, durabilityUsed: 96 }; // 4% durability
    const healthyItem = { type: 1, maxDurability: 100, durabilityUsed: 50 }; // 50% durability

    assert.strictEqual(tools.isWarning(warningItem), true, '19% durability triggers warning');
    assert.strictEqual(tools.isCritical(warningItem), false, '19% is above 5% critical threshold');
    assert.strictEqual(tools.isCritical(criticalItem), true, '4% durability triggers critical threshold');
    assert.strictEqual(tools.isWarning(healthyItem), false, '50% durability is healthy');
  });

  await t.test('Mining - Water Bucket Slot-6 Guard & Safe Digging Invariants', async (t) => {
    const MineSkill = require('../skills/mining/MineSkill');

    // Bot missing water bucket
    const mockContextNoWater = {
      events: new EventEmitter(),
      inv: {
        hasItem: () => false,
        organizeHotbar: async () => {}
      },
      safety: { shouldRetreat: () => false },
      bot: { entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } } }
    };

    const mineSkill = new MineSkill(mockContextNoWater);

    // Deep mining without water bucket must abort
    await assert.rejects(
      async () => {
        await mineSkill.run({ targetOre: 'diamond', quantity: 1, yLevel: -58 });
      },
      { message: /Water bucket in slot 6 cannot be guaranteed/ },
      'Hazardous mining without water bucket must be rejected'
    );
  });

  await t.test('Building - 50-Block Construction Checkpoints', async (t) => {
    const BuildSkill = require('../skills/building/BuildSkill');
    const events = new EventEmitter();
    let checkpointEmitted = false;

    events.on('building.checkpoint', (data) => {
      if (data.blocksPlaced === 50) {
        checkpointEmitted = true;
      }
    });

    const mockCtx = {
      events,
      messageRouter: { send: async () => {} },
      safety: { isCritical: () => false, shouldRetreat: () => false },
      nav: { goTo: async () => ({ success: true }) },
      inv: {
        items: () => [{ name: 'cobblestone', count: 100 }],
        hasItem: () => true
      },
      bot: {
        entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } },
        blockAt: () => null,
        inventory: { items: () => [{ name: 'cobblestone', count: 100 }] }
      }
    };

    const buildSkill = new BuildSkill(mockCtx);
    buildSkill._generateBlueprint = () => {
      const b = [];
      for (let i = 0; i < 55; i++) {
        b.push({ dx: i, dy: 0, dz: 0, blockType: 'cobblestone' });
      }
      return b;
    };
    buildSkill._verifyAndPrepareMaterials = async () => {};
    buildSkill._clearFootprintObstacles = async () => {};
    buildSkill._placeBlockAt = async () => true;
    buildSkill._isSolidBlock = () => true;

    await buildSkill.run({ structure: 'wall', dimensions: { length: 55 } });
    assert.strictEqual(checkpointEmitted, true, 'Checkpoint event must be emitted at 50 blocks');
  });

  await t.test('Combat - Passive Mob, Villager, Golem & Player Protection', () => {
    const { combatPolicies, combatData } = require('../src/modules/combat');

    const villager = { name: 'villager', type: 'mob' };
    const ironGolem = { name: 'iron_golem', type: 'mob' };
    const petWolf = { name: 'wolf', type: 'mob' };
    const player = { name: 'RandomPlayer', type: 'player' };
    const zombie = { name: 'zombie', type: 'mob' };

    assert.strictEqual(combatPolicies.isHostile(villager), false, 'Villager is never hostile');
    assert.strictEqual(combatPolicies.isHostile(ironGolem), false, 'Iron Golem is never hostile');
    assert.strictEqual(combatPolicies.isHostile(petWolf), false, 'Pet wolf is never hostile');
    assert.strictEqual(combatPolicies.isHostile(player), false, 'Player is never hostile by default');
    assert.strictEqual(combatPolicies.isHostile(zombie), true, 'Zombie is hostile');
  });

  await t.test('TaskManager - Preemption and Priority Orchestration', async (t) => {
    const { TaskManager } = require('../src/core/TaskManager');
    const events = new EventEmitter();
    const ctx = { events, currentTask: null };
    const tm = new TaskManager(ctx);

    const taskLow = tm.addTask('mine', { targetOre: 'iron' }, 50, 'user1');
    const taskHigh = tm.addTask('combat', { targetMob: 'creeper' }, 95, 'defense');

    assert.strictEqual(tm.queue[0].id, taskHigh.id, 'High priority task (95) must be first in queue');
    assert.strictEqual(tm.queue[1].id, taskLow.id, 'Low priority task (50) must be second in queue');
  });

  await t.test('AIBrain - Subsystem Heartbeat Timeout Detection', async (t) => {
    const events = new EventEmitter();
    let unhealthyDetected = false;
    events.on('module.unhealthy', (data) => {
      if (data.module === 'TestHangingModule') {
        unhealthyDetected = true;
      }
    });

    const ctx = { events };
    const brain = new AIBrain(ctx);

    // Register a module that hangs indefinitely (>2s timeout)
    brain.registerModule('TestHangingModule', () => new Promise(() => {}));

    await brain.checkHeartbeats();
    assert.strictEqual(unhealthyDetected, true, 'Hanging module must trigger module.unhealthy event');
    assert.strictEqual(brain.moduleHealth.get('TestHangingModule').healthy, false, 'Module health marked false');
  });
});
