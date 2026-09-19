const test = require('node:test');
const assert = require('node:assert');
const { CombatSkill } = require('../../../src/modules/combat');

test('CombatSkill - Autonomous Hunting, Attack Execution, and Drop Pickup', async () => {
  let attackCount = 0;
  let weaponEquipped = false;
  let shieldEquipped = false;
  const navTargets = [];

  const mockTargetMob = {
    name: 'zombie',
    isValid: true,
    height: 1.8,
    position: { x: 5, y: 64, z: 0, offset: (dx, dy, dz) => ({ x: 5 + dx, y: 64 + dy, z: 0 + dz }) },
    metadata: { 7: 20 }
  };

  const mockDropItem = {
    name: 'item',
    position: { x: 5, y: 64, z: 0 },
    metadata: { 8: { name: 'rotten_flesh' } }
  };

  const mockBot = {
    health: 20,
    food: 20,
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: (pos) => Math.sqrt(Math.pow(pos.x - 0, 2) + Math.pow(pos.z - 0, 2))
      }
    },
    entities: {
      101: mockTargetMob,
      102: mockDropItem
    },
    inventory: {
      items: () => [{ name: 'diamond_sword', count: 1 }, { name: 'shield', count: 1 }],
      slots: {}
    },
    equip: async (item, slot) => {
      if (slot === 'hand') weaponEquipped = true;
      if (slot === 'off-hand') shieldEquipped = true;
    },
    attack: (entity) => {
      attackCount++;
      // Mark mob dead after 2 hits
      if (attackCount >= 2) {
        mockTargetMob.isValid = false;
      }
    },
    lookAt: async () => {},
    activateItem: () => {},
    deactivateItem: () => {}
  };

  const mockCtx = {
    bot: mockBot,
    nav: {
      goTo: async (pos, options) => {
        navTargets.push(pos);
        return true;
      }
    },
    tools: {
      isAboutToBreak: () => false
    },
    safety: {
      isCritical: () => false,
      shouldRetreat: () => false,
      fleeToNearestSafeZone: async () => true
    },
    inv: {
      eatFood: async () => true
    },
    messageRouter: {
      send: () => {}
    }
  };

  const skill = new CombatSkill(mockCtx);
  const result = await skill.run({
    mode: 'hunt',
    targetMob: 'zombie',
    quantity: 1
  }, { isCancelled: () => false, isSuspended: () => false, saveCheckpoint: () => {} });

  assert.strictEqual(weaponEquipped, true, 'Best weapon should be equipped');
  assert.strictEqual(shieldEquipped, true, 'Shield should be equipped in off-hand');
  assert.ok(attackCount >= 2, `Expected at least 2 attack strikes, got ${attackCount}`);
  assert.strictEqual(result.mobsDefeated, 1, 'Should have eliminated 1 mob');
  assert.ok(navTargets.length >= 2, 'Should navigate to target mob and to dropped item loot');
});

test('CombatSkill - Tactical Emergency Retreat on Low Health', async () => {
  let retreatCalled = false;

  const mockBot = {
    health: 4, // Below RETREAT_HEALTH_THRESHOLD (8)
    food: 10,
    entity: {
      position: { x: 0, y: 64, z: 0, distanceTo: () => 5 }
    },
    entities: {
      101: { name: 'zombie', isValid: true, position: { x: 5, y: 64, z: 0 } }
    },
    inventory: {
      items: () => [{ name: 'iron_sword', count: 1 }],
      slots: {}
    },
    equip: async () => true
  };

  const mockCtx = {
    bot: mockBot,
    nav: { goTo: async () => true },
    tools: { isAboutToBreak: () => false },
    safety: {
      isCritical: () => true,
      shouldRetreat: () => true,
      fleeToNearestSafeZone: async () => {
        retreatCalled = true;
        return true;
      }
    },
    inv: { eatFood: async () => true },
    messageRouter: { send: () => {} }
  };

  const skill = new CombatSkill(mockCtx);
  await assert.rejects(
    async () => {
      await skill.run({ mode: 'hunt', targetMob: 'zombie', quantity: 1 }, { isCancelled: () => false, isSuspended: () => false });
    },
    /(?:Combat suspended|Health\/Food is at critical threshold)/
  );

  assert.strictEqual(retreatCalled, true, 'fleeToNearestSafeZone should be called when health is critical');
});
