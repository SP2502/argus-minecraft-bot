const test = require('node:test');
const assert = require('node:assert');
const { forestryPolicies } = require('../src/modules/forestry');

test('ForestryPolicies - Replant Requirements and Drops', () => {
  assert.strictEqual(forestryPolicies.getReplantRequirement('oak'), 1);
  assert.strictEqual(forestryPolicies.getReplantRequirement('birch'), 1);
  assert.strictEqual(forestryPolicies.getReplantRequirement('dark_oak'), 4);

  // Drop collection
  assert.strictEqual(forestryPolicies.shouldCollectDrop('oak_log'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('crimson_stem'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('oak_sapling'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('mangrove_propagule'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('apple'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('stick'), true);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('cobblestone'), false);
  assert.strictEqual(forestryPolicies.shouldCollectDrop('dirt'), false);
});

test('ForestryPolicies - Protected Base Distance and Preservation', () => {
  const protectedBases = [
    { name: 'SpawnBase', x: 100, y: 64, z: 100, radius: 15 }
  ];

  const analysisNear = {
    family: 'oak',
    safe: true,
    estimatedHeight: 6,
    naturalEvidence: { isNatural: true },
    rootPosition: { x: 105, y: 64, z: 105 } // 7m from SpawnBase -> Within 15m radius
  };

  const evalNear = forestryPolicies.shouldPreserveTree(analysisNear, { allowNearBase: false }, protectedBases);
  assert.strictEqual(evalNear.shouldPreserve, true);
  assert.ok(evalNear.reason.includes('SpawnBase'));

  const analysisFar = {
    family: 'oak',
    safe: true,
    estimatedHeight: 6,
    naturalEvidence: { isNatural: true },
    rootPosition: { x: 200, y: 64, z: 200 } // Far away
  };

  const evalFar = forestryPolicies.shouldPreserveTree(analysisFar, { allowNearBase: false }, protectedBases);
  assert.strictEqual(evalFar.shouldPreserve, false);
});

test('ForestryPolicies - Dimension Validation', () => {
  assert.strictEqual(forestryPolicies.isAllowedDimension('oak', 'overworld'), true);
  assert.strictEqual(forestryPolicies.isAllowedDimension('oak', 'nether'), false);
  assert.strictEqual(forestryPolicies.isAllowedDimension('crimson', 'nether'), true);
  assert.strictEqual(forestryPolicies.isAllowedDimension('warped', 'overworld'), false);
  assert.strictEqual(forestryPolicies.isAllowedDimension('any', 'overworld'), true);
});
