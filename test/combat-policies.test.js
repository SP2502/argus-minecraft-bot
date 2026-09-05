const test = require('node:test');
const assert = require('node:assert');
const combatPolicies = require('../skills/combat/combatPolicies');

test('CombatPolicies - Hostility and Drop Collection', () => {
  const zombie = { name: 'zombie' };
  const creeper = { name: 'creeper' };
  const cow = { name: 'cow' };

  assert.strictEqual(combatPolicies.isHostile(zombie, 'any'), true);
  assert.strictEqual(combatPolicies.isHostile(zombie, 'zombie'), true);
  assert.strictEqual(combatPolicies.isHostile(zombie, 'skeleton'), false);
  assert.strictEqual(combatPolicies.isHostile(cow, 'any'), false);

  assert.strictEqual(combatPolicies.shouldCollectCombatDrop('gunpowder'), true);
  assert.strictEqual(combatPolicies.shouldCollectCombatDrop('rotten_flesh'), true);
  assert.strictEqual(combatPolicies.shouldCollectCombatDrop('bone'), true);
  assert.strictEqual(combatPolicies.shouldCollectCombatDrop('dirt'), false);
});

test('CombatPolicies - Tactical Action Decisions', () => {
  const botHealthy = { health: 20, position: { x: 0, y: 64, z: 0 }, hasShield: true };
  const botLowHealth = { health: 6, position: { x: 0, y: 64, z: 0 }, hasShield: true };

  const closeCreeper = { name: 'creeper', position: { x: 3, y: 64, z: 0 } };
  const distantSkeleton = { name: 'skeleton', position: { x: 10, y: 64, z: 0 } };
  const normalZombie = { name: 'zombie', position: { x: 2, y: 64, z: 0 } };

  // 1. Critical health triggers retreat
  assert.strictEqual(combatPolicies.getTacticalAction(normalZombie, botLowHealth), 'tactical_retreat');

  // 2. Close creeper triggers kiting
  assert.strictEqual(combatPolicies.getTacticalAction(closeCreeper, botHealthy), 'kite_creeper');

  // 3. Distant skeleton with shield triggers block
  assert.strictEqual(combatPolicies.getTacticalAction(distantSkeleton, botHealthy), 'shield_block');

  // 4. Normal zombie triggers melee rush
  assert.strictEqual(combatPolicies.getTacticalAction(normalZombie, botHealthy), 'melee_rush');
});
