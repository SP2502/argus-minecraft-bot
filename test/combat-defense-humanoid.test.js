const test = require('node:test');
const assert = require('node:assert');
const { CombatService: CombatHelperService } = require('../src/modules/combat');
const { HumanoidBehaviorService } = require('../src/modules/behavior');

test('CombatHelperService - Threat Detection and Prioritization', () => {
  const botPos = {
    x: 0,
    y: 64,
    z: 0,
    distanceTo: (pos) => Math.sqrt(Math.pow(pos.x, 2) + Math.pow(pos.y - 64, 2) + Math.pow(pos.z, 2))
  };

  const mockBot = {
    entity: { position: botPos },
    entities: {
      1: { name: 'zombie', position: { x: 5, y: 64, z: 0 }, isValid: true, type: 'mob' },
      2: { name: 'creeper', position: { x: 4, y: 64, z: 0 }, isValid: true, type: 'mob' },
      3: { name: 'cow', position: { x: 2, y: 64, z: 0 }, isValid: true, type: 'mob' },
      4: { name: 'skeleton', position: { x: 25, y: 64, z: 0 }, isValid: true, type: 'mob' } // Out of 14m range
    },
    inventory: { items: () => [], slots: {} }
  };

  const helper = new CombatHelperService(mockBot);
  const threats = helper.findNearbyThreats(14);

  // Cow is passive, skeleton is > 14m, zombie and creeper should be detected
  assert.strictEqual(threats.length, 2, 'Should find exactly 2 threats within 14m');
  // Creeper has higher threat score than zombie
  assert.strictEqual(threats[0].name, 'creeper');
  assert.strictEqual(threats[1].name, 'zombie');

  const immediateThreat = helper.getImmediateThreat(10);
  assert.strictEqual(immediateThreat.name, 'creeper');
});

test('CombatHelperService - Attacker Resolution and Tactical Decisions', () => {
  const botPos = {
    x: 0,
    y: 64,
    z: 0,
    distanceTo: (pos) => Math.sqrt(Math.pow(pos.x, 2) + Math.pow(pos.y - 64, 2) + Math.pow(pos.z, 2))
  };

  const mockBot = {
    health: 20,
    entity: { position: botPos },
    entities: {
      1: { name: 'zombie', position: { x: 2.5, y: 64, z: 0 }, isValid: true, type: 'mob' },
      2: { name: 'skeleton', position: { x: 10, y: 64, z: 0 }, isValid: true, type: 'mob' }
    },
    inventory: {
      items: () => [{ name: 'shield' }],
      slots: { 45: { name: 'shield' } }
    }
  };

  const helper = new CombatHelperService(mockBot);

  // findAttacker prioritizes melee reach (<4m)
  const attacker = helper.findAttacker(16);
  assert.ok(attacker !== null);
  assert.strictEqual(attacker.name, 'zombie');

  // Creeper tactical calculation -> kite
  const creeperTactics = helper.calculateTactics({ name: 'creeper', position: { x: 3, y: 64, z: 0 } });
  assert.strictEqual(creeperTactics, 'kite_creeper');

  // Skeleton at distance with shield -> shield_block
  const skeletonTactics = helper.calculateTactics({ name: 'skeleton', position: { x: 8, y: 64, z: 0 } });
  assert.strictEqual(skeletonTactics, 'shield_block');

  // Critical health -> tactical_retreat
  mockBot.health = 4;
  const criticalTactics = helper.calculateTactics({ name: 'zombie', position: { x: 2, y: 64, z: 0 } });
  assert.strictEqual(criticalTactics, 'tactical_retreat');
});

test('CombatHelperService - Autonomous Defense Execution', async () => {
  let attackedEntity = null;
  let itemActivated = false;
  let itemDeactivated = false;

  const botPos = {
    x: 0,
    y: 64,
    z: 0,
    distanceTo: () => 2.5
  };

  const target = {
    name: 'zombie',
    position: {
      x: 2,
      y: 64,
      z: 0,
      offset: () => ({ x: 2, y: 65, z: 0 })
    },
    isValid: true,
    metadata: { 7: 20 }
  };

  const mockBot = {
    health: 18,
    entity: { position: botPos },
    inventory: {
      items: () => [{ name: 'diamond_sword' }, { name: 'shield' }],
      slots: { 45: { name: 'shield' } }
    },
    equip: async () => true,
    activateItem: (offhand) => { if (offhand) itemActivated = true; },
    deactivateItem: () => { itemDeactivated = true; },
    lookAt: async () => true,
    attack: (entity) => { attackedEntity = entity; }
  };

  const helper = new CombatHelperService(mockBot);
  const result = await helper.defendAgainst(target);

  assert.strictEqual(result.action, 'strike');
  assert.strictEqual(attackedEntity, target);
  assert.strictEqual(itemDeactivated, true);
});

test('HumanoidBehaviorService - Non-Deterministic Timing and Actions', async () => {
  let lookedAt = null;
  let controlStates = {};
  let armSwung = false;
  let quickbarSlot = 0;

  const mockBot = {
    entity: {
      position: {
        x: 10,
        y: 64,
        z: 10,
        distanceTo: (pos) => Math.sqrt(Math.pow(pos.x - 10, 2) + Math.pow(pos.z - 10, 2))
      },
      yaw: 0,
      pitch: 0
    },
    players: {},
    look: async (yaw, pitch) => { lookedAt = { yaw, pitch }; },
    setControlState: (ctrl, state) => { controlStates[ctrl] = state; },
    swingArm: (arm) => { armSwung = true; },
    setQuickBarSlot: (slot) => { quickbarSlot = slot; },
    quickBarSlot: 0
  };

  const humanoid = new HumanoidBehaviorService(mockBot);

  // 1. Check delay calculation provides non-deterministic jitter
  const d1 = humanoid._calculateNextDelay();
  const d2 = humanoid._calculateNextDelay();
  assert.ok(d1 >= 1800 && d1 <= 8000, `Delay ${d1} within realistic human range`);
  assert.ok(typeof d2 === 'number');

  // 2. Head interpolation avoids snapping
  await humanoid.interpolateRotation(Math.PI / 4, 0, 4);
  assert.ok(lookedAt !== null);
  assert.ok(lookedAt.yaw > 0);

  // 3. Fidget Sneak
  await humanoid.idleFidgetSneak();
  assert.strictEqual(controlStates.sneak, false, 'Sneak state should be released after tap');
  assert.strictEqual(humanoid.stats.sneaks, 1);

  // 4. Arm Swing
  await humanoid.idleArmSwing();
  assert.strictEqual(armSwung, true);
  assert.strictEqual(humanoid.stats.swings, 1);

  // 5. Hotbar Inspect
  await humanoid.hotbarInspect();
  assert.strictEqual(quickbarSlot, 0, 'Hotbar should return to starting slot');

  // 6. Micro step
  await humanoid.microStep();
  assert.strictEqual(humanoid.stats.totalActions >= 4, true);

  // 7. Social Greeting
  const nearbyPlayer = {
    entity: {
      position: {
        x: 12,
        y: 64,
        z: 10,
        offset: () => ({ x: 12, y: 65.62, z: 10 })
      }
    }
  };
  await humanoid.crouchGreeting(nearbyPlayer.entity);
  assert.strictEqual(humanoid.stats.playerGreetings, 1);
  assert.strictEqual(humanoid.ping().ok, true);
});
