const test = require('node:test');
const assert = require('node:assert');
const { PermissionManager, PermissionTiers } = require('../../src/modules/security');
const AIBrain = require('../../src/core/AIBrain');
const TaskManager = require('../../src/core/TaskManager');
const LockManager = require('../../src/core/LockManager');
const { InventoryService } = require('../../src/modules/inventory');
const { FarmSkill } = require('../../src/modules/farming');
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
    
    const inv = new InventoryService(mockBot, { itemCategories: require('../../src/modules/inventory/item-categories') });
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
    const pm = require('../../src/shared/persistence/persistence-manager');
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
    const SafetyService = require('../../src/shared/services/safety.service');
    const thresholds = require('../../src/shared/config/safety-thresholds');
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
    const ToolService = require('../../src/shared/services/tool.service');
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
    const { MineSkill } = require('../../src/modules/mining');

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
    const { BuildSkill } = require('../../src/modules/building');
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
    const { combatPolicies, combatData } = require('../../src/modules/combat');

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
    const { TaskManager } = require('../../src/core/TaskManager');
    const events = new EventEmitter();
    const ctx = { events, currentTask: null };
    const tm = new TaskManager(ctx);

    const taskLow = tm.addTask('mine', { targetOre: 'iron' }, 50, 'user1');
    const taskHigh = tm.addTask('combat', { targetMob: 'creeper' }, 95, 'defense');

    assert.strictEqual(tm.queue[0].id, taskHigh.id, 'High priority task (95) must be first in queue');
    assert.strictEqual(tm.queue[1].id, taskLow.id, 'Low priority task (50) must be second in queue');
  });

  await t.test('TaskManager - State Transitions Logged (pending -> queued -> running -> success)', async () => {
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const SkillRegistry = require('../../src/core/SkillRegistry');
    const { BaseSkill } = require('../../src/core/base.skill');

    class QuickSkill extends BaseSkill {
      async run() { return { ok: true }; }
    }
    SkillRegistry.registerSkill('quick_test_skill', QuickSkill);

    const events = new EventEmitter();
    const transitions = [];
    const logEntries = [];
    events.on('task.state_changed', ({ task, from, to }) => transitions.push(`${from} -> ${to}`));
    events.on('log:entry', (entry) => { if (entry.category === 'TASK') logEntries.push(entry.message); });

    const tm = new TaskManager({ events, currentTask: null });
    const task = tm.addTask('quick_test_skill', {}, 50, 'user1', ['inventory']);
    await tm.runNext();

    assert.strictEqual(task.status, TaskState.SUCCESS);
    assert.deepStrictEqual(transitions, ['pending -> queued', 'queued -> running', 'running -> success']);
    assert.ok(logEntries.some(m => m.includes('pending → queued')), 'Logged pending -> queued');
    assert.ok(logEntries.some(m => m.includes('queued → running')), 'Logged queued -> running');
    assert.ok(logEntries.some(m => m.includes('running → success')), 'Logged running -> success');
  });

  await t.test('TaskManager - Lock Acquisition and Release Order Under Competing Tasks', async () => {
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const events = new EventEmitter();
    const lockHistory = [];
    events.on('lock:acquired', (d) => lockHistory.push({ type: 'acquired', taskId: d.taskId, locks: d.locks }));
    events.on('lock:released', (d) => lockHistory.push({ type: 'released', taskId: d.taskId, locks: d.locks }));

    const tm = new TaskManager({ events, currentTask: null });
    const taskA = tm.addTask('quick_test_skill', {}, 50, 'user1', ['movement', 'inventory']);
    const taskB = tm.addTask('quick_test_skill', {}, 40, 'user2', ['inventory', 'tool:pickaxe']);

    await tm.runNext(); // Task A runs, completes, releases locks
    assert.strictEqual(taskA.status, TaskState.SUCCESS);

    await tm.runNext(); // Task B runs, completes, releases locks
    assert.strictEqual(taskB.status, TaskState.SUCCESS);

    assert.strictEqual(lockHistory.length, 4, 'Must have 4 lock events');
    assert.strictEqual(lockHistory[0].taskId, taskA.id);
    assert.strictEqual(lockHistory[0].type, 'acquired');
    assert.strictEqual(lockHistory[1].taskId, taskA.id);
    assert.strictEqual(lockHistory[1].type, 'released');
    assert.strictEqual(lockHistory[2].taskId, taskB.id);
    assert.strictEqual(lockHistory[2].type, 'acquired');
    assert.strictEqual(lockHistory[3].taskId, taskB.id);
    assert.strictEqual(lockHistory[3].type, 'released');
  });

  await t.test('TaskManager - Preemption Saved State Matches Where It Actually Stopped', async () => {
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const SkillRegistry = require('../../src/core/SkillRegistry');
    const { BaseSkill } = require('../../src/core/base.skill');

    class PreemptSkill extends BaseSkill {
      async run(params) {
        let count = (params.checkpoint && params.checkpoint.step) || 0;
        for (let i = count; i < 10; i++) {
          await new Promise(r => setTimeout(r, 10));
          count++;
          await this.safetyCheckLoop({ step: count });
        }
        return { count };
      }
    }
    SkillRegistry.registerSkill('preempt_skill', PreemptSkill);

    const events = new EventEmitter();
    const tm = new TaskManager({ events, currentTask: null });

    const lowTask = tm.addTask('preempt_skill', {}, 20, 'low', ['movement']);
    const lowPromise = tm.runNext();

    await new Promise(r => setTimeout(r, 35));
    const highTask = tm.addTask('quick_test_skill', {}, 95, 'high', ['movement']);

    await lowPromise;
    assert.strictEqual(lowTask.status, TaskState.SUSPENDED, 'Low task must be suspended');
    assert.ok(lowTask.checkpoint && lowTask.checkpoint.step > 0, 'Checkpoint must be saved');
    const stoppedAt = lowTask.checkpoint.step;

    await tm.runNext(); // High task runs to completion
    assert.strictEqual(highTask.status, TaskState.SUCCESS);

    await tm.runNext(); // Low task resumes with checkpoint
    assert.strictEqual(lowTask.status, TaskState.SUCCESS);
    assert.strictEqual(lowTask.result.count, 10, 'Must finish remaining steps to 10');
    assert.ok(stoppedAt < 10, `Stopped at ${stoppedAt} which is less than 10`);
  });

  await t.test('TaskManager - Timeout Cancels Deliberately-Hung Task', async () => {
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const SkillRegistry = require('../../src/core/SkillRegistry');
    const { BaseSkill } = require('../../src/core/base.skill');

    class HangingSkill extends BaseSkill {
      async run() {
        while (!this.aborted) {
          await new Promise(r => setTimeout(r, 20));
        }
      }
    }
    SkillRegistry.registerSkill('hanging_skill', HangingSkill);

    const events = new EventEmitter();
    let timeoutFired = false;
    events.on('task.timeout', () => { timeoutFired = true; });

    const tm = new TaskManager({ events, currentTask: null });
    const hungTask = tm.addTask('hanging_skill', { timeoutMs: 150 }, 50, 'user', ['movement']);
    hungTask.timeoutMs = 150;

    const start = Date.now();
    await tm.runNext();
    const duration = Date.now() - start;

    assert.strictEqual(hungTask.status, TaskState.FAILED);
    assert.ok(hungTask.error.includes('timed out'));
    assert.strictEqual(timeoutFired, true);
    assert.strictEqual(tm.lockManager.isLockHeld('movement'), false);
    assert.strictEqual(tm.activeTask, null);
    assert.ok(duration >= 130 && duration < 2000);
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

  // ══════════════════════════════════════════════════════════════════════════
  // 0. FUNDAMENTAL / FOUNDATION TESTING (0.1 -> 0.6)
  // ══════════════════════════════════════════════════════════════════════════

  await t.test('0.1 Foundation: Minecraft Connection & Runtime Lifecycle', async (t) => {
    const authManager = require('../../src/core/AuthManager');
    assert.ok(authManager.authMode, 'Auth mode must be initialized');
    const creds = authManager.loadCredentials();
    assert.ok(creds.host !== undefined, 'Credentials load host');
    assert.ok(creds.checkTimeoutInterval >= 60000, 'Keep-alive timeout active');

    // Startup & Context Initialization
    const BotContext = require('../../src/core/BotContext');
    const mockBot = new EventEmitter();
    mockBot.username = 'ArgusTest';
    mockBot.health = 20;
    mockBot.food = 20;
    mockBot.oxygenLevel = 20;
    mockBot.entity = {
      position: { x: 10, y: 65, z: 20, floored: () => ({ x: 10, y: 65, z: 20 }) },
      yaw: 0,
      pitch: 0,
      velocity: { x: 0, y: 0, z: 0 },
      isInWater: false,
      isBurning: false
    };
    mockBot.inventory = { items: () => [], slots: new Array(45).fill(null) };
    mockBot.loadPlugin = () => {};
    mockBot.pathfinder = { setGoal: () => {}, setMovements: () => {}, stop: () => {} };

    const ctx = new BotContext(mockBot);
    assert.strictEqual(ctx.bot.username, 'ArgusTest');
    assert.ok(ctx.events, 'EventBus bound');
    assert.ok(ctx.safety, 'SafetyService bound');

    // Tick loop
    const brain = new AIBrain(ctx);
    assert.strictEqual(brain.isRunning, false);
    brain.start();
    assert.strictEqual(brain.isRunning, true);
    await brain.tick();
    brain.stop();
    assert.strictEqual(brain.isRunning, false);

    // Reconnection Backoff Progression
    const BASE_DELAY = 5000;
    const MAX_DELAY = 120000;
    const computeDelay = (attempt) => Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
    assert.strictEqual(computeDelay(0), 5000, 'Attempt 0 is 5000ms');
    assert.strictEqual(computeDelay(1), 10000, 'Attempt 1 is 10000ms');
    assert.strictEqual(computeDelay(2), 20000, 'Attempt 2 is 20000ms');
  });

  await t.test('0.2 Foundation: State Management & Synchronization', async (t) => {
    const BotContext = require('../../src/core/BotContext');
    const mockBot = new EventEmitter();
    mockBot.username = 'StateBot';
    mockBot.health = 17;
    mockBot.food = 15;
    mockBot.entity = {
      position: { x: 100, y: 70, z: -50, floored: () => ({ x: 100, y: 70, z: -50 }) },
      yaw: 1.5,
      pitch: 0.2
    };
    mockBot.inventory = {
      items: () => [{ name: 'iron_ingot', count: 5 }],
      slots: new Array(45).fill(null)
    };
    mockBot.loadPlugin = () => {};
    mockBot.pathfinder = { setGoal: () => {}, setMovements: () => {}, stop: () => {} };

    const ctx = new BotContext(mockBot);
    const telemetry = ctx.getStatus();

    assert.strictEqual(telemetry.health, 17, 'Health state synchronized');
    assert.strictEqual(telemetry.food, 15, 'Hunger state synchronized');
    assert.strictEqual(telemetry.position.x, 100, 'Position X state synchronized');
    assert.strictEqual(telemetry.position.y, 70, 'Position Y state synchronized');
    assert.strictEqual(telemetry.position.z, -50, 'Position Z state synchronized');
    assert.strictEqual(telemetry.username, 'StateBot', 'Username state synchronized');
    assert.strictEqual(telemetry.currentTask, 'Idle', 'Current task state synchronized');
  });

  await t.test('0.3 Foundation: Event Bus (Publish, Subscribe, Ordering, Isolation)', async (t) => {
    const eventBus = require('../../src/core/EventBus');
    const receivedEvents = [];

    // Multiple subscribers & ordering
    const sub1 = (data) => receivedEvents.push({ sub: 1, val: data.val });
    const sub2 = (data) => receivedEvents.push({ sub: 2, val: data.val });

    eventBus.on('test:order', sub1);
    eventBus.on('test:order', sub2);

    eventBus.emit('test:order', { val: 'alpha' });
    eventBus.emit('test:order', { val: 'beta' });

    assert.deepStrictEqual(receivedEvents, [
      { sub: 1, val: 'alpha' },
      { sub: 2, val: 'alpha' },
      { sub: 1, val: 'beta' },
      { sub: 2, val: 'beta' }
    ]);

    eventBus.off('test:order', sub1);
    eventBus.off('test:order', sub2);

    // High frequency event throughput
    let counter = 0;
    const hfSub = () => { counter++; };
    eventBus.on('test:hf', hfSub);
    for (let i = 0; i < 500; i++) {
      eventBus.emit('test:hf', i);
    }
    eventBus.off('test:hf', hfSub);
    assert.strictEqual(counter, 500, 'Handled 500 high-frequency events synchronously');
  });

  await t.test('0.4 Foundation: Logging (Levels, Structured, Async, Retention)', async (t) => {
    const logger = require('../../src/shared/observability/logger');
    assert.ok(logger.getTimestamp(), 'Structured timestamp exists');

    // Formatted multi-level logs
    assert.doesNotThrow(() => {
      logger.info('TEST', 'Information message');
      logger.success('TEST', 'Success message');
      logger.warn('TEST', 'Warning message');
      logger.error('TEST', 'Error message');
      logger.debug('TEST', 'Debug message');
    });

    // Structured metadata output
    assert.doesNotThrow(() => {
      logger.diagnose('TEST_CARD', { code: 200, status: 'HEALTHY' }, 'info');
    });
  });

  await t.test('0.5 Foundation: Persistence (Snapshots, Atomic Writes, Checksums, Recovery)', async (t) => {
    const pm = require('../../src/shared/persistence/persistence-manager');
    const fs = require('fs').promises;
    const path = require('path');
    const testFile = 'foundation_test_snapshot.json';
    const testData = { snapshotId: 'snap_001', health: 20, items: ['bread', 'torch'] };

    // Atomic write with sha256 checksum
    await pm.saveData(testFile, testData);
    const loaded = await pm.loadData(testFile);
    assert.deepStrictEqual(loaded, testData, 'Data read matches saved payload');

    // Check backup copy exists
    const filePath = path.join(pm.dataDir, testFile);
    await pm.saveData(testFile, { ...testData, snapshotId: 'snap_002' });
    const backupExists = await fs.access(`${filePath}.bak`).then(() => true).catch(() => false);
    assert.strictEqual(backupExists, true, 'Backup .bak file generated during atomic write');

    // Clean up
    try {
      await fs.unlink(filePath);
      await fs.unlink(`${filePath}.bak`);
    } catch (e) {}
  });

  await t.test('0.6 Foundation: Basic API (Health, Status, Rate Limiting, Auth)', async (t) => {
    process.env.DASHBOARD_PASSWORD = 'TestPassword123!';
    process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.DASHBOARD_SESSION_TTL_MS = '3600000';

    const http = require('http');
    const BotContext = require('../../src/core/BotContext');
    const { startServer } = require('../../src/modules/dashboard');
    const { createSessionToken } = require('../../src/modules/dashboard/session-auth');

    const mockBot = new EventEmitter();
    mockBot.username = 'ApiBot';
    mockBot.health = 20;
    mockBot.food = 20;
    mockBot.entity = { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } };
    mockBot.inventory = { items: () => [], slots: new Array(45).fill(null) };
    mockBot.loadPlugin = () => {};
    mockBot.pathfinder = { setGoal: () => {}, setMovements: () => {}, stop: () => {} };

    const ctx = new BotContext(mockBot);
    const { server, wss } = startServer(ctx, 0);
    const port = server.address().port;

    const request = (path, headers = {}) => {
      return new Promise((resolve, reject) => {
        http.get({ hostname: '127.0.0.1', port, path, headers }, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
        }).on('error', reject);
      });
    };

    // Public /api/health
    const healthRes = await request('/api/health');
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthRes.data.status, 'ok');

    // Protected /api/status without token -> 401
    const unauthStatus = await request('/api/status');
    assert.strictEqual(unauthStatus.status, 401);

    // Protected /api/status with token -> 200
    const token = createSessionToken('TestUser', 'owner');
    const authStatus = await request('/api/status', { Authorization: `Bearer ${token}` });
    assert.strictEqual(authStatus.status, 200);
    assert.strictEqual(authStatus.data.username, 'ApiBot', 'Returns accurate status username');

    if (wss && typeof wss.close === 'function') {
      wss.close();
    }
    await new Promise((resolve) => server.close(resolve));
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ADVANCED ENGINE & AUTONOMY TESTING (1.1 -> 1.8)
  // ══════════════════════════════════════════════════════════════════════════

  await t.test('1.1 Context Collection: Health, Hunger, Time, Location, Threats, Inventory, Current Task', async (t) => {
    const BotContext = require('../../src/core/BotContext');
    const mockBot = new EventEmitter();
    mockBot.username = 'ArgusTelemetryBot';
    mockBot.health = 18;
    mockBot.food = 16;
    mockBot.time = { timeOfDay: 18000, isDay: false };
    mockBot.entity = {
      position: { x: -45, y: 64, z: 128, floored: () => ({ x: -45, y: 64, z: 128 }) },
      yaw: 1.2,
      pitch: 0.1
    };
    mockBot.inventory = {
      items: () => [{ name: 'diamond_sword', count: 1 }, { name: 'bread', count: 8 }],
      slots: new Array(45).fill(null)
    };
    mockBot.entities = {
      1: { name: 'zombie', position: { x: -40, y: 64, z: 128 }, isValid: true, type: 'mob' }
    };
    mockBot.loadPlugin = () => {};
    mockBot.pathfinder = { setGoal: () => {}, setMovements: () => {}, stop: () => {} };

    const ctx = new BotContext(mockBot);
    const telemetry = ctx.getStatus();

    assert.strictEqual(telemetry.health, 18);
    assert.strictEqual(telemetry.food, 16);
    assert.strictEqual(telemetry.position.x, -45);
    assert.strictEqual(telemetry.position.y, 64);
    assert.strictEqual(telemetry.position.z, 128);
    assert.strictEqual(ctx.safety.isNight(), true);
    assert.ok(ctx.combat.findNearbyThreats(10).length >= 1, 'Detects nearby threats in context');
    assert.strictEqual(ctx.inv.hasItem('bread'), true, 'Inventory context resolves items');
    assert.strictEqual(telemetry.currentTask, 'Idle', 'Context current task is tracked');
  });

  await t.test('1.2 Priority Engine: Emergency, Owner-Command, Combat, Autonomous, Background, Conflicts', async (t) => {
    const Priorities = require('../../src/shared/config/priorities');
    assert.strictEqual(Priorities.EMERGENCY, 100);
    assert.strictEqual(Priorities.OWNER_COMMAND, 95);
    assert.strictEqual(Priorities.COMBAT, 80);
    assert.strictEqual(Priorities.AUTONOMOUS, 50);
    assert.strictEqual(Priorities.BACKGROUND, 20);

    const brain = new AIBrain(null);
    const emergencyPriority = brain.evaluatePriority({ basePriority: Priorities.AUTONOMOUS, currentNeed: 10, maxNeed: 10, threatLevel: 10 });
    assert.ok(emergencyPriority > Priorities.AUTONOMOUS, 'Composite priority increases with need and threat');
    assert.strictEqual(emergencyPriority <= 100, true, 'Priority capped at 100');

    // Conflict arbitration: highest priority always wins
    const tasks = [
      { id: 't1', priority: Priorities.BACKGROUND },
      { id: 't2', priority: Priorities.EMERGENCY },
      { id: 't3', priority: Priorities.AUTONOMOUS }
    ];
    tasks.sort((a, b) => b.priority - a.priority);
    assert.strictEqual(tasks[0].id, 't2', 'Emergency task wins arbitration');
  });

  await t.test('1.3 Resource Locks: Inventory, Tool, Movement, Lock Timeout, Lock Release, Deadlock Override', async (t) => {
    const lockManager = new LockManager();
    const task1 = 'task_movement_1';
    const task2 = 'task_movement_2';

    // Acquire locks
    assert.strictEqual(lockManager.acquireLocks(task1, ['movement', 'inventory']), true);
    assert.strictEqual(lockManager.isLockHeld('movement'), true);
    assert.strictEqual(lockManager.isLockHeld('inventory'), true);

    // Contention / Deadlock prevention: task2 cannot steal locked resources
    assert.strictEqual(lockManager.acquireLocks(task2, ['movement']), false);

    // Release locks
    const released = lockManager.releaseLocks(task1);
    assert.deepStrictEqual(released.sort(), ['inventory', 'movement']);
    assert.strictEqual(lockManager.isLockHeld('movement'), false);

    // Now task2 can acquire
    assert.strictEqual(lockManager.acquireLocks(task2, ['movement']), true);

    // Timeout check
    lockManager.lockTimeoutMs = 50;
    await new Promise((r) => setTimeout(r, 60));
    const timedOut = lockManager.checkLockTimeouts();
    assert.ok(timedOut.includes(task2), 'Hanging task lock was force-released after timeout');
    assert.strictEqual(lockManager.isLockHeld('movement'), false);
  });

  await t.test('1.4 Action Batching: Enqueue, Ordering, Timeout, Cancellation, Flush', async (t) => {
    const ActionQueueService = require('../../src/shared/services/action-queue.service');
    const queue = new ActionQueueService(null);
    const log = [];

    const p1 = queue.enqueue(async () => { log.push('first'); return 1; }, 10);
    const p2 = queue.enqueue(async () => { log.push('second'); return 2; }, 50);

    const res = await Promise.all([p1, p2]);
    assert.deepStrictEqual(res, [1, 2]);
    assert.strictEqual(queue.totalExecuted, 2);

    // Cancellation token
    const cancelToken = { isCancelled: true };
    await assert.rejects(
      async () => queue.enqueue(async () => 'never', 10, { cancellationToken: cancelToken }),
      /Action cancelled via cancellation token/
    );
  });

  await t.test('1.5 Adaptive Processing: Combat, Active, Idle, Dashboard Modes & Tick Rates', async (t) => {
    const TickRates = require('../../src/shared/config/tick-rates');
    const brain = new AIBrain(null);

    brain.setTickRate('combat');
    assert.strictEqual(brain.tickRateMs, TickRates.COMBAT); // 50ms
    assert.strictEqual(brain.currentMode, 'combat');

    brain.setTickRate('active');
    assert.strictEqual(brain.tickRateMs, TickRates.ACTIVE); // 100ms
    assert.strictEqual(brain.currentMode, 'active');

    brain.setTickRate('dashboard_only');
    assert.strictEqual(brain.tickRateMs, TickRates.DASHBOARD_ONLY); // 1000ms
    assert.strictEqual(brain.currentMode, 'dashboard_only');

    brain.setTickRate('idle');
    assert.strictEqual(brain.tickRateMs, TickRates.IDLE); // 500ms
    assert.strictEqual(brain.currentMode, 'idle');
  });

  await t.test('1.6 Task Chunking: Splitting, Preemption, State Preservation, Resume', async (t) => {
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const SkillRegistry = require('../../src/core/SkillRegistry');
    const { BaseSkill, SkillSuspended } = require('../../src/core/base.skill');

    class ChunkedSkill extends BaseSkill {
      async run(params) {
        let progress = (params.checkpoint && params.checkpoint.step) || 0;
        for (let i = progress; i < 10; i++) {
          await new Promise((r) => setTimeout(r, 10));
          progress++;
          await this.safetyCheckLoop({ step: progress });
        }
        return { completed: true, progress };
      }
    }
    SkillRegistry.registerSkill('chunked_skill', ChunkedSkill);

    const tm = new TaskManager({ events: new EventEmitter(), currentTask: null });
    const lowTask = tm.addTask('chunked_skill', {}, 20, 'lowUser', ['movement']);

    const runPromise = tm.runNext();
    await new Promise((r) => setTimeout(r, 35));

    // High priority preempts low priority
    const highTask = tm.addTask('chunked_skill', {}, 95, 'highUser', ['movement']);
    await runPromise;

    assert.strictEqual(lowTask.status, TaskState.SUSPENDED);
    assert.ok(lowTask.checkpoint && lowTask.checkpoint.step > 0, 'Saved intermediate chunk state');

    // Run high priority to completion
    await tm.runNext();
    assert.strictEqual(highTask.status, TaskState.SUCCESS);

    // Resume low priority
    await tm.runNext();
    assert.strictEqual(lowTask.status, TaskState.SUCCESS);
  });

  await t.test('1.7 Rule-Based Decisions: Low-Health, Hunger, Hostiles, Capacity, Opportunistic', async (t) => {
    const SafetyService = require('../../src/shared/services/safety.service');
    const mockBot = {
      health: 5,
      food: 3,
      entity: { position: { x: 0, y: 64, z: 0 }, isInWater: false, isBurning: false }
    };
    const safety = new SafetyService(mockBot);

    // Low-health & Hunger decisions
    assert.strictEqual(safety.isCritical(), true, 'Critical health & hunger triggers emergency state');
    assert.strictEqual(safety.isLowHealth(), true);
    assert.strictEqual(safety.isLowHunger(), true);
    assert.strictEqual(safety.shouldRetreat(), true, 'Triggers retreat decision');
  });

  await t.test('1.8 Module Health: Heartbeat, Missed Heartbeat, Failure Event, Health State', async (t) => {
    const events = new EventEmitter();
    const brain = new AIBrain({ events });
    let unhealthyReported = false;

    events.on('module.unhealthy', (data) => {
      if (data.module === 'FaultySubsystem') {
        unhealthyReported = true;
      }
    });

    // Healthy module
    brain.registerModule('HealthySubsystem', () => ({ ok: true }));
    // Faulty module throwing error
    brain.registerModule('FaultySubsystem', () => { throw new Error('Subsystem crash'); });

    await brain.checkHeartbeats();

    assert.strictEqual(brain.moduleHealth.get('HealthySubsystem').healthy, true);
    assert.strictEqual(brain.moduleHealth.get('FaultySubsystem').healthy, false);
    assert.strictEqual(unhealthyReported, true, 'Module failure emitted to EventBus');
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. SECURITY & ACCESS CONTROL (2.1 -> 2.6)
  // ══════════════════════════════════════════════════════════════════════════

  await t.test('2.1 Owner: Identification, Permissions, Shutdown, Config, Dangerous Operations', async (t) => {
    const { PermissionManager, PermissionTiers } = require('../../src/modules/security');
    const { requiresConfirmation } = require('../../src/modules/commands/dangerous-commands');
    const pm = new PermissionManager();
    pm.ownerUsername = 'TrueOwner';

    // Owner Identification & Absolute Permissions
    assert.strictEqual(pm.ownerUsername, 'TrueOwner');
    assert.strictEqual(await pm.hasPermission('TrueOwner', PermissionTiers.OWNER), true);
    assert.strictEqual(await pm.hasPermission('trueowner', PermissionTiers.OWNER), true, 'Case-insensitive match');

    // Immutable: Cannot demote or revoke owner
    const demoteRes = await pm.grant('TrueOwner', 'guest', 'Hacker');
    assert.strictEqual(demoteRes, null);
    assert.strictEqual(await pm.hasPermission('TrueOwner', PermissionTiers.OWNER), true);

    // Dangerous operation checks
    assert.strictEqual(requiresConfirmation('shutdown'), true);
    assert.strictEqual(requiresConfirmation('drop_all'), true);
    assert.strictEqual(requiresConfirmation('delete_base'), true);
    assert.strictEqual(requiresConfirmation('status'), false);
  });

  await t.test('2.2 Permission Levels: Hierarchy (Level 4 -> Level 0) & Restrictions', async (t) => {
    const { PermissionManager, PermissionTiers } = require('../../src/modules/security');
    const pm = new PermissionManager();
    pm.ownerUsername = 'OwnerBoss';

    // Set roles across tiers
    pm.localPermissions.set('admin_user', 'admin');
    pm.localPermissions.set('trusted_user', 'trusted');
    pm.localPermissions.set('guest_user', 'guest');
    pm.localPermissions.set('blocked_user', 'blocked');

    // Level 4 (OWNER)
    assert.strictEqual(await pm.hasPermission('OwnerBoss', PermissionTiers.OWNER), true);
    assert.strictEqual(await pm.hasPermission('admin_user', PermissionTiers.OWNER), false);

    // Level 3 (ADMIN)
    assert.strictEqual(await pm.hasPermission('admin_user', PermissionTiers.ADMIN), true);
    assert.strictEqual(await pm.hasPermission('trusted_user', PermissionTiers.ADMIN), false);

    // Level 2 (TRUSTED)
    assert.strictEqual(await pm.hasPermission('trusted_user', PermissionTiers.TRUSTED), true);
    assert.strictEqual(await pm.hasPermission('guest_user', PermissionTiers.TRUSTED), false);

    // Level 1 (GUEST)
    assert.strictEqual(await pm.hasPermission('guest_user', PermissionTiers.GUEST), true);

    // Level 0 (BLOCKED)
    assert.strictEqual(await pm.hasPermission('blocked_user', PermissionTiers.GUEST), false);
    assert.strictEqual(await pm.hasPermission('blocked_user', PermissionTiers.BLOCKED), false);
  });

  await t.test('2.3 Temporary Permissions: Role Assignment, Expiration, Revocation, Notification', async (t) => {
    const { PermissionManager, PermissionTiers } = require('../../src/modules/security');
    const eventBus = require('../../src/core/EventBus');
    const pm = new PermissionManager();
    pm.ownerUsername = 'HostMaster';

    let grantNotified = false;
    const onGrant = (data) => {
      if (data.username === 'TempAdmin' && data.role === 'admin') grantNotified = true;
    };
    eventBus.on('permission.granted', onGrant);

    // Grant temporary admin role
    const grant = await pm.grant('TempAdmin', 'admin', 'HostMaster', 60000);
    assert.strictEqual(grantNotified, true, 'Permission grant notification emitted');
    assert.strictEqual(await pm.hasPermission('TempAdmin', PermissionTiers.ADMIN), true);

    // Revocation to blocked
    await pm.revoke('TempAdmin', 'HostMaster');
    assert.strictEqual(await pm.hasPermission('TempAdmin', PermissionTiers.GUEST), false);

    eventBus.off('permission.granted', onGrant);
  });

  await t.test('2.4 Authentication: Valid, Failed Attempts, Temporary & Permanent Lockout', async (t) => {
    const { PermissionManager } = require('../../src/modules/security');
    const pm = new PermissionManager();
    pm.ownerUsername = 'AuthOwner';

    const intruder = 'Intruder';
    assert.strictEqual(pm.tempBlockedUsers.has('intruder'), false);

    // 2 failed attempts -> not blocked yet
    pm.recordFailedAttempt(intruder);
    pm.recordFailedAttempt(intruder);
    assert.strictEqual(pm.tempBlockedUsers.has('intruder'), false);

    // 3rd failed attempt -> auto blocked for 10 minutes
    pm.recordFailedAttempt(intruder);
    assert.strictEqual(pm.tempBlockedUsers.has('intruder'), true);
    assert.strictEqual(await pm.hasPermission(intruder, 1), false, 'Intruder blocked from all commands');
  });

  await t.test('2.5 Rate Limiting: Per-User Limits (10/min), Abuse Lockout, Owner Exemption', async (t) => {
    const { PermissionManager } = require('../../src/modules/security');
    const pm = new PermissionManager();
    pm.ownerUsername = 'OwnerExempt';

    const spammer = 'SpamPlayer';
    for (let i = 1; i <= 10; i++) {
      assert.strictEqual(pm.checkRateLimit(spammer), true, `Attempt ${i} allowed`);
    }
    // 11th command within 60s rejected
    assert.strictEqual(pm.checkRateLimit(spammer), false, 'Rate limit blocked after 10 commands/min');

    // Owner has infinite bypass
    for (let i = 1; i <= 20; i++) {
      assert.strictEqual(pm.checkRateLimit('OwnerExempt'), true, 'Owner bypasses rate limit');
    }
  });

  await t.test('2.6 Security Audit: Structured Logging, Timestamp, Permission, Command, Result', async (t) => {
    const { PermissionManager } = require('../../src/modules/security');
    const pm = new PermissionManager();
    pm.ownerUsername = 'AuditOwner';

    // Must record audit attempts without crashing even when DB is offline
    assert.doesNotThrow(() => {
      pm.logAttempt('Guest123', 'mine 64 diamonds', false, 'Requires ADMIN role');
      pm.logAttempt('AuditOwner', 'status', true, 'Authorized');
    });
  });

  // ==========================================
  // SECTION 3: SMART COMMUNICATION & NOTIFICATIONS
  // ==========================================

  await t.test('3.1 Priority Routing: Critical, Owner, Dashboard-only, and Log-only messages', async (t) => {
    const MessageRouter = require('../../src/shared/communication/MessageRouter');
    const mockBot = {
      chatMessages: [],
      whispers: [],
      chat(msg) { this.chatMessages.push(msg); },
      whisper(target, msg) { this.whispers.push({ target, msg }); }
    };
    const router = new MessageRouter(mockBot, 'TestOwner');

    // Priority 1: Critical -> Public Chat
    await router.send(1, 'Hostile invasion detected!');
    assert.strictEqual(mockBot.chatMessages.length, 1);
    assert.ok(mockBot.chatMessages[0].includes('Hostile invasion detected!'));

    // Priority 2: Owner Whisper
    await router.send(2, 'Task completed successfully');
    assert.strictEqual(mockBot.whispers.length, 1);
    assert.strictEqual(mockBot.whispers[0].target, 'TestOwner');
    assert.ok(mockBot.whispers[0].msg.includes('Task completed successfully'));

    // Priority 3: Dashboard-only (no public chat or whisper)
    const chatCount = mockBot.chatMessages.length;
    const whisperCount = mockBot.whispers.length;
    await router.send(3, 'Routine inventory sync completed');
    assert.strictEqual(mockBot.chatMessages.length, chatCount);
    assert.strictEqual(mockBot.whispers.length, whisperCount);

    // Priority 4: Log-only
    await router.send(4, 'Low-level tick debug trace');
    assert.strictEqual(mockBot.chatMessages.length, chatCount);
    assert.strictEqual(mockBot.whispers.length, whisperCount);
  });

  await t.test('3.2 Anti-Spam: Duplicate Suppression, Message Grouping, and Batch Summaries', async (t) => {
    const MessageRouter = require('../../src/shared/communication/MessageRouter');
    const eventBus = require('../../src/core/EventBus');
    const mockBot = {
      chatMessages: [],
      whispers: [],
      chat(msg) { this.chatMessages.push(msg); },
      whisper(target, msg) { this.whispers.push({ target, msg }); }
    };
    const router = new MessageRouter(mockBot, 'TestOwner');

    // Duplicate suppression within 10s
    const firstSent = await router.send(1, 'Identical Alert');
    const secondSent = await router.send(1, 'Identical Alert');
    assert.strictEqual(firstSent, true);
    assert.strictEqual(secondSent, false, 'Duplicate message within 10s suppressed');

    // Batching routine messages
    await router.send(3, 'Mined stone block', { batchable: true, batchKey: 'mining' });
    await router.send(3, 'Mined dirt block', { batchable: true, batchKey: 'mining' });
    assert.strictEqual(router.batchBuffer.get('mining').length, 2);

    // Flush batch buffer
    let batchSummaryLogged = false;
    const onLog = (entry) => {
      if (entry.category === 'BATCH' && entry.message.includes('Aggregated 2 operations')) {
        batchSummaryLogged = true;
      }
    };
    eventBus.on('log:entry', onLog);
    router.flushBatchBuffer();
    eventBus.off('log:entry', onLog);

    assert.strictEqual(batchSummaryLogged, true, 'Aggregated batch log summary emitted');
    assert.strictEqual(router.batchBuffer.size, 0);
  });

  await t.test('3.3 Owner Communication: Whisper Commands, Confirmations, Errors, Progress, Completion', async (t) => {
    const MessageRouter = require('../../src/shared/communication/MessageRouter');
    const mockBot = {
      whispers: [],
      whisper(target, msg) { this.whispers.push({ target, msg }); }
    };
    const router = new MessageRouter(mockBot, 'BossPlayer');

    await router.notifyOwner('confirm', 'Base boundary established.');
    await router.notifyOwner('progress', 'Smelting 32 iron ore (50%)...');
    await router.notifyOwner('error', 'Pickaxe broken, need wood.');
    await router.notifyOwner('complete', 'House foundation finished.');

    assert.strictEqual(mockBot.whispers.length, 4);
    assert.ok(mockBot.whispers[0].msg.includes('[Confirm]'));
    assert.ok(mockBot.whispers[1].msg.includes('[Progress]'));
    assert.ok(mockBot.whispers[2].msg.includes('[Error]'));
    assert.ok(mockBot.whispers[3].msg.includes('[Complete]'));
  });

  await t.test('3.4 External Notifications: Discord, Slack, Telegram, Generic Webhooks, Payload Validation & Error Handling', async (t) => {
    const WebhookDispatcher = require('../../src/shared/communication/WebhookDispatcher');
    const dispatcher = new WebhookDispatcher({
      discordUrl: 'https://discord.com/api/webhooks/mock',
      slackUrl: 'https://hooks.slack.com/services/mock',
      telegramToken: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
      telegramChatId: '987654321',
      genericWebhookUrl: 'https://api.argus-bot.org/events'
    });

    // Validation rejection
    const invalidRes = await dispatcher.dispatch('TEST', { message: '' });
    assert.strictEqual(invalidRes.success, false);
    assert.ok(invalidRes.error.includes('non-empty string'));

    // Valid payload structure
    const validCheck = dispatcher.validatePayload({
      severity: 'CRITICAL',
      message: 'Base under siege',
      data: { attacker: 'Zombies' }
    });
    assert.strictEqual(validCheck.valid, true);
  });

  await t.test('3.5 Preferences: Quiet Mode, DND, Routing Rules, Activity Timeline, Search & Export', async (t) => {
    const MessageRouter = require('../../src/shared/communication/MessageRouter');
    const mockBot = {
      chatMessages: [],
      whispers: [],
      chat(msg) { this.chatMessages.push(msg); },
      whisper(target, msg) { this.whispers.push({ target, msg }); }
    };
    const router = new MessageRouter(mockBot, 'PreferenceOwner');

    // DND & Quiet Mode suppression of Tier 2
    router.setQuietMode(true);
    assert.strictEqual(router.isQuietMode, true);
    await router.send(2, 'Tier 2 whisper during quiet mode');
    assert.strictEqual(mockBot.whispers.length, 0, 'Tier 2 whisper suppressed in quiet mode');

    // Tier 1 still bypasses Quiet Mode
    await router.send(1, 'Critical alert bypasses quiet mode');
    assert.strictEqual(mockBot.chatMessages.length, 1);

    router.setQuietMode(false);

    // DND with duration
    router.setDND(60000);
    assert.ok(router.dndUntil > Date.now());
    await router.send(2, 'Tier 2 during DND');
    assert.strictEqual(mockBot.whispers.length, 0, 'Tier 2 whisper suppressed in DND');

    // Reset DND
    router.dndUntil = 0;

    // Timeline recording, search, and export
    router.recordTimeline({ type: 'COMBAT', level: 'WARN', message: 'Creeper exploded near farm', user: 'system' });
    router.recordTimeline({ type: 'BUILD', level: 'INFO', message: 'Wall completed at x:100', user: 'PreferenceOwner' });

    const searchCreeper = router.searchTimeline({ query: 'creeper' });
    assert.strictEqual(searchCreeper.length, 1);
    assert.ok(searchCreeper[0].message.includes('Creeper'));

    const searchWarn = router.searchTimeline({ level: 'WARN' });
    assert.strictEqual(searchWarn.length, 1);

    const jsonExport = router.exportTimeline('json');
    assert.ok(jsonExport.includes('Creeper exploded near farm'));

    const csvExport = router.exportTimeline('csv');
    assert.ok(csvExport.includes('id,timestamp,type,level,user,message'));
    assert.ok(csvExport.includes('Creeper exploded near farm'));
  });

  await t.test('4.1 Intelligent Goal Decomposition & Prerequisite Recipe Planning', async (t) => {
    require('../../src/core/SkillRegistry');
    const GoalPlannerService = require('../../src/shared/services/goal-planner.service');
    const CommandPlanner = require('../../src/modules/commands/CommandPlanner');
    const UnifiedCommandGateway = require('../../src/modules/commands/UnifiedCommandGateway');
    const conversationContext = require('../../src/modules/commands/ConversationContextManager');
    const confirmationManager = require('../../src/modules/commands/ConfirmationManager');
    const intentParser = require('../../src/modules/nlp/IntentParser');

    const planner = new GoalPlannerService();

    // 1. Tool Tier Requirements
    assert.strictEqual(planner.getRequiredPickaxeTier('diamond').tier, 3, 'Diamonds require Tier 3 (Iron Pickaxe)');
    assert.strictEqual(planner.getRequiredPickaxeTier('deepslate_diamond_ore').tier, 3, 'Deepslate diamond ore requires Tier 3');
    assert.strictEqual(planner.getRequiredPickaxeTier('gold').tier, 3, 'Gold requires Tier 3 (Iron Pickaxe)');
    assert.strictEqual(planner.getRequiredPickaxeTier('iron').tier, 2, 'Iron requires Tier 2 (Stone Pickaxe)');
    assert.strictEqual(planner.getRequiredPickaxeTier('cobblestone').tier, 1, 'Cobblestone requires Tier 1 (Wooden Pickaxe)');
    assert.strictEqual(planner.getRequiredPickaxeTier('oak_log').tier, 0, 'Wood logs require Tier 0 (Hand/Axe)');

    // 2. Goal Decomposition from Empty Inventory
    const emptyInventory = [];
    const diamondMineOp = {
      operationId: 'op_mine_diamond',
      intentName: 'mine',
      skillName: 'mine',
      params: { targetOre: 'diamond', quantity: 64 },
      priority: 60
    };

    const decompEmpty = planner.decompose(diamondMineOp, emptyInventory);
    assert.strictEqual(decompEmpty.isDecomposed, true, 'Should decompose when bot lacks pickaxe');
    assert.ok(decompEmpty.steps.length >= 8, `Expected at least 8 steps, got ${decompEmpty.steps.length}`);
    assert.strictEqual(decompEmpty.requiredTool, 'iron_pickaxe');
    assert.ok(decompEmpty.explanation.includes('Iron Pickaxe'));
    assert.ok(decompEmpty.explanation.includes('Gather wood'));
    assert.ok(decompEmpty.explanation.includes('wooden pickaxe'));
    assert.ok(decompEmpty.explanation.includes('cobblestone'));
    assert.ok(decompEmpty.explanation.includes('stone pickaxe'));
    assert.ok(decompEmpty.explanation.includes('furnace'));
    assert.ok(decompEmpty.explanation.includes('iron ore'));
    assert.ok(decompEmpty.explanation.includes('iron ingots'));
    assert.ok(decompEmpty.explanation.includes('iron pickaxe'));

    // Sequence of skill executions: chop_tree -> craft -> mine -> craft -> craft -> mine -> craft -> craft -> mine
    const stepSkills = decompEmpty.steps.map((s) => s.skillName);
    assert.strictEqual(stepSkills[0], 'chop_tree', 'Step 1: Gather wood');
    assert.strictEqual(decompEmpty.steps[decompEmpty.steps.length - 1].params.targetOre, 'diamond', 'Final step: Mine diamonds');

    // Dependencies properly chained
    for (let i = 1; i < decompEmpty.steps.length; i++) {
      assert.strictEqual(decompEmpty.steps[i].dependsOn[0], decompEmpty.steps[i - 1].operationId);
    }

    // 3. Partial Inventory Intelligence (Bot already has stone pickaxe and furnace)
    const partialInventory = [
      { name: 'stone_pickaxe', count: 1 },
      { name: 'furnace', count: 1 }
    ];
    const decompPartial = planner.decompose(diamondMineOp, partialInventory);
    assert.strictEqual(decompPartial.isDecomposed, true);
    // Should NOT chop wood, craft wooden pickaxe, or craft furnace
    const partialSkills = decompPartial.steps.map((s) => s.skillName);
    assert.ok(!partialSkills.includes('chop_tree'), 'Should not gather wood if already possessing stone pickaxe');
    assert.strictEqual(decompPartial.steps[0].params.targetOre, 'iron', 'Step 1 with stone pickaxe should mine iron');

    // 4. Direct Pickaxe Possession (Bot already has iron pickaxe)
    const readyInventory = [
      { name: 'iron_pickaxe', count: 1 }
    ];
    const decompReady = planner.decompose(diamondMineOp, readyInventory);
    assert.strictEqual(decompReady.isDecomposed, false, 'Direct mining when iron pickaxe is held');
    assert.strictEqual(decompReady.steps.length, 1);

    // 5. Crafting Prerequisite Decomposition (craft iron_pickaxe with 0 iron)
    const craftPickaxeOp = {
      operationId: 'op_craft_pickaxe',
      intentName: 'craft',
      skillName: 'craft',
      params: { item: 'iron_pickaxe', quantity: 1 },
      priority: 60
    };
    const decompCraft = planner.decompose(craftPickaxeOp, emptyInventory);
    assert.strictEqual(decompCraft.isDecomposed, true);
    assert.ok(decompCraft.explanation.includes('iron ingots and cobblestone for smelting'));

    // 6. UnifiedCommandGateway Integration with CommandPlanner
    const tasksEnqueued = [];
    const mockCtx = {
      bot: {
        username: 'Argus',
        inventory: { items: () => [] } // Empty inventory
      },
      inv: {
        getInventoryItems: () => [],
        countItem: () => 0
      },
      permissions: {
        checkRateLimit: () => true,
        hasPermission: async () => true,
        recordFailedAttempt: () => {}
      },
      conversationContext,
      confirmations: confirmationManager,
      nlp: intentParser,
      taskManager: {
        addTask: (skill, params, prio, sender, locks) => {
          const t = { id: `task_${Date.now()}_${tasksEnqueued.length}`, skillName: skill, params, priority: prio, sender, locks };
          tasksEnqueued.push(t);
          return t;
        }
      },
      messageRouter: {
        send: () => true,
        handleSocialGreeting: () => false,
        respondToCommand: async () => {}
      }
    };

    mockCtx.goalPlanner = new GoalPlannerService(mockCtx.bot, mockCtx);
    mockCtx.commandPlanner = new CommandPlanner(mockCtx);
    const gateway = new UnifiedCommandGateway(mockCtx);

    const response = await gateway.execute({
      source: 'minecraft',
      senderId: 'OwnerPlayer',
      message: 'mine 64 diamonds'
    });

    assert.strictEqual(response.ok, true);
    assert.strictEqual(response.status, 'queued');
    // Response message is the intelligent explanation rather than a generic queued reply
    assert.ok(response.message.includes('To mine diamond, I need an Iron Pickaxe. Initiating preparation:'), 'Explains multi-step preparation in chat');
    assert.ok(tasksEnqueued.length >= 8, `Enqueued full workflow steps (${tasksEnqueued.length})`);
    assert.strictEqual(tasksEnqueued[0].skillName, 'chop_tree', 'First task enqueued is wood gathering');
    assert.strictEqual(tasksEnqueued[tasksEnqueued.length - 1].params.targetOre, 'diamond', 'Final task enqueued is diamond mining');
  });

  await t.test('Mining - Bare-hand Stone/Ore Digging Prevention Invariant', async (t) => {
    const { MineSkill } = require('../../src/modules/mining');
    const mockContext = {
      events: new EventEmitter(),
      inv: {
        hasItem: () => true, // has water bucket
        organizeHotbar: async () => {}
      },
      tools: {
        getBestTool: () => null, // No pickaxe in inventory
        equipBest: async () => null // Auto-craft cannot produce pickaxe
      },
      safety: { shouldRetreat: () => false },
      bot: {
        heldItem: null, // Empty hand
        entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } }
      }
    };

    const mineSkill = new MineSkill(mockContext);

    // Stone mining without a pickaxe must be aborted immediately
    await assert.rejects(
      async () => {
        await mineSkill.run({ targetOre: 'stone', quantity: 1, yLevel: 64 });
      },
      { message: /No pickaxe equipped or available in inventory\. Stone and ores cannot be harvested bare-handed\./ },
      'Must strictly reject bare-handed stone or ore digging'
    );
  });

  await t.test('Tools - Autonomous Idle Tool Maintenance & Upgrade Invariant', async (t) => {
    const ToolService = require('../../src/shared/services/tool.service');
    let craftedItems = [];

    const mockInventoryItems = [
      { name: 'wooden_pickaxe', count: 1, type: 101 },
      { name: 'cobblestone', count: 5, type: 4 },
      { name: 'stick', count: 4, type: 280 }
    ];

    const mockBot = {
      inventory: {
        items: () => mockInventoryItems
      },
      registry: { items: { 101: { maxDurability: 59 } } }
    };

    const mockCtx = {
      crafting: {
        autoCraftMissing: async (toolName, count) => {
          craftedItems.push(toolName);
          mockInventoryItems.push({ name: toolName, count, type: 102 });
          return true;
        }
      },
      inv: {
        countItem: (name) => {
          return mockInventoryItems
            .filter((i) => i.name === name || i.name.endsWith(`_${name}`))
            .reduce((sum, i) => sum + i.count, 0);
        },
        organizeHotbar: async () => {}
      },
      events: new EventEmitter()
    };

    const toolService = new ToolService(mockBot, mockCtx);

    // Initial best tool is wooden_pickaxe (tier 1)
    const initialBest = toolService.getBestTool('pickaxe');
    assert.strictEqual(initialBest.name, 'wooden_pickaxe');

    // Run idle maintenance
    const res = await toolService.maintainAndUpgradeTools();

    assert.strictEqual(res.upgraded, true, 'Idle tool maintenance upgraded tools');
    assert.strictEqual(res.tool, 'stone_pickaxe', 'Upgraded wooden pickaxe to stone pickaxe');
    assert.strictEqual(res.reason, 'tier_upgrade');
    assert.ok(craftedItems.includes('stone_pickaxe'), 'Crafted stone pickaxe');
  });

  await t.test('NLP - EntityExtractor Mine Stone & Goal Decomposition Invariant', async (t) => {
    const extractor = require('../../src/modules/nlp/EntityExtractor');

    // 1. Mine stone canonical entity mapping
    const stoneEntities = extractor.extract('mine stone');
    assert.strictEqual(stoneEntities.targetOre, 'stone', 'Extracted targetOre=stone from "mine stone"');

    // 2. Mine cobblestone canonical entity mapping
    const cobbleEntities = extractor.extract('mine 32 cobblestone');
    assert.strictEqual(cobbleEntities.targetOre, 'cobblestone', 'Extracted targetOre=cobblestone from "mine 32 cobblestone"');
    assert.strictEqual(cobbleEntities.quantity.value, 32, 'Extracted quantity=32');

    // 3. Goal Planner decomposes stone mining when bot has no pickaxe
    const GoalPlannerService = require('../../src/shared/services/goal-planner.service');
    const planner = new GoalPlannerService(null, null);

    const decomp = planner.decompose({
      operationId: 'op_mine_stone',
      intentName: 'mine',
      skillName: 'mine',
      params: { targetOre: 'stone', quantity: 16 }
    }, []); // empty inventory

    assert.strictEqual(decomp.isDecomposed, true, 'Stone mining decomposed when bot has no pickaxe');
    assert.strictEqual(decomp.requiredTool, 'wooden_pickaxe', 'Requires wooden pickaxe');
    assert.strictEqual(decomp.steps[0].skillName, 'chop_tree', 'First step is gathering wood');
    assert.strictEqual(decomp.steps[1].skillName, 'craft', 'Second step is crafting wooden pickaxe');
    assert.strictEqual(decomp.steps[2].skillName || decomp.steps[2].intentName, 'mine', 'Final step is mining stone');
  });

  await t.test('TaskManager - Multi-Step Dependency Orchestration & TargetFinder Array Matching Invariant', async (t) => {
    const TargetFinderService = require('../../src/shared/services/target-finder.service');
    const { TaskManager, TaskState } = require('../../src/core/TaskManager');
    const SkillRegistry = require('../../src/core/SkillRegistry');
    const { BaseSkill } = require('../../src/core/base.skill');

    // 1. Invariant: TargetFinderService accepts arrays of block names without throwing
    const mockBlocks = {
      '0,64,0': { name: 'oak_log', type: 17, boundingBox: 'block' },
      '0,65,0': { name: 'birch_log', type: 18, boundingBox: 'block' },
      '1,64,0': { name: 'dirt', type: 3, boundingBox: 'block' }
    };
    const mockBot = {
      entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0, offset: (dx, dy, dz) => ({ x: dx, y: 64 + dy, z: 64 + dy === 64 ? dz : dz }) }) } },
      blockAt: (pos) => mockBlocks[`${pos.x},${pos.y},${pos.z}`] || { name: 'air' },
      findBlock: ({ matching }) => Object.values(mockBlocks).find(matching) || null
    };
    const targetFinder = new TargetFinderService(mockBot);
    const logs = targetFinder.findAllInRadius(['oak_log', 'birch_log'], 2, 10);
    assert.strictEqual(logs.length, 2, 'Found both oak_log and birch_log via array matching');
    const single = targetFinder.findNearestBlock(['dirt'], 2);
    assert.ok(single, 'Found dirt block via findNearestBlock with array');

    // 2. Invariant: TaskManager dependencies prevent execution until precursor completes
    class MockSuccessSkill extends BaseSkill {
      async run() { return { done: true }; }
    }
    class MockDependentSkill extends BaseSkill {
      async run() { return { dependentDone: true }; }
    }
    SkillRegistry.registerSkill('mock_success', MockSuccessSkill);
    SkillRegistry.registerSkill('mock_dep', MockDependentSkill);

    const mockCtx = { events: new (require('events').EventEmitter)() };
    const tm = new TaskManager(mockCtx);

    const task1 = tm.addTask('mock_success', {}, 50, 'user', ['movement'], [], 'op_1');
    const task2 = tm.addTask('mock_dep', {}, 50, 'user', ['movement'], ['op_1'], 'op_2');

    // Attempting runNext should run task1 first (task2 is blocked on op_1)
    await tm.runNext();
    assert.strictEqual(task1.status, TaskState.SUCCESS, 'Task 1 completed');
    assert.ok(tm.completedTaskIds.has('op_1'), 'Task 1 operationId recorded as completed');

    // Next runNext now unblocks and executes task2
    await tm.runNext();
    assert.strictEqual(task2.status, TaskState.SUCCESS, 'Task 2 completed after Task 1 satisfied dependency');

    // 3. Invariant: TaskManager cancels dependent tasks when precursor fails
    class MockFailingSkill extends BaseSkill {
      async run() { throw new Error('Resource missing'); }
    }
    SkillRegistry.registerSkill('mock_fail', MockFailingSkill);

    const tmFail = new TaskManager(mockCtx);
    const failTask = tmFail.addTask('mock_fail', {}, 50, 'user', ['movement'], [], 'op_fail');
    const doomedTask = tmFail.addTask('mock_dep', {}, 50, 'user', ['movement'], ['op_fail'], 'op_doomed');

    // Run failing task
    await tmFail.runNext();
    assert.strictEqual(failTask.status, TaskState.FAILED, 'Task failed');
    assert.ok(tmFail.failedTaskIds.has('op_fail'), 'Recorded failed dependency op_fail');

    // Next runNext should automatically cancel doomedTask instead of executing it
    await tmFail.runNext();
    assert.strictEqual(doomedTask.status, TaskState.CANCELLED, 'Doomed task was cancelled due to precursor failure');
    assert.ok(doomedTask.error.includes('Prerequisite dependency'), 'Error states dependency failure');
  });
});




