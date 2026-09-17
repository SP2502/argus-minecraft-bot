const test = require('node:test');
const assert = require('node:assert');
const { buildingPolicies } = require('../../../src/modules/building');

test('BuildingPolicies - Placement Order Sorting', () => {
  const blocks = [
    { dx: 0, dy: 2, dz: 0, blockType: 'cobblestone' },
    { dx: 1, dy: 0, dz: 1, blockType: 'cobblestone' },
    { dx: 0, dy: 1, dz: 0, blockType: 'cobblestone' },
    { dx: 0, dy: 0, dz: 0, blockType: 'cobblestone' },
    { dx: 2, dy: 0, dz: 2, blockType: 'cobblestone' }
  ];

  const sorted = buildingPolicies.sortPlacementOrder(blocks, { dx: 0, dz: 0 });

  // 1. Must sort by dy ascending
  assert.strictEqual(sorted[0].dy, 0);
  assert.strictEqual(sorted[1].dy, 0);
  assert.strictEqual(sorted[2].dy, 0);
  assert.strictEqual(sorted[3].dy, 1);
  assert.strictEqual(sorted[4].dy, 2);

  // 2. In dy=0, furthest block from (0, 0) should be first: (2, 2) dist ~2.82, then (1, 1) dist ~1.41, then (0, 0) dist 0
  assert.deepStrictEqual({ dx: sorted[0].dx, dz: sorted[0].dz }, { dx: 2, dz: 2 });
  assert.deepStrictEqual({ dx: sorted[1].dx, dz: sorted[1].dz }, { dx: 1, dz: 1 });
  assert.deepStrictEqual({ dx: sorted[2].dx, dz: sorted[2].dz }, { dx: 0, dz: 0 });
});

test('BuildingPolicies - Required Materials Aggregation', () => {
  const blocks = [
    { dx: 0, dy: 0, dz: 0, blockType: 'cobblestone' },
    { dx: 1, dy: 0, dz: 0, blockType: 'cobblestone' },
    { dx: 2, dy: 0, dz: 0, blockType: 'oak_planks' },
    { dx: 3, dy: 0, dz: 0, blockType: 'glass' },
    { dx: 4, dy: 0, dz: 0, blockType: 'glass' }
  ];

  const result = buildingPolicies.calculateRequiredMaterials(blocks);
  assert.strictEqual(result.totalBlocks, 5);
  assert.strictEqual(result.requirements.cobblestone, 2);
  assert.strictEqual(result.requirements.oak_planks, 1);
  assert.strictEqual(result.requirements.glass, 2);
});

test('BuildingPolicies - Obstacle Classification', () => {
  assert.strictEqual(buildingPolicies.isSoftObstacle('tall_grass'), true);
  assert.strictEqual(buildingPolicies.isSoftObstacle('grass'), true);
  assert.strictEqual(buildingPolicies.isSoftObstacle('poppy'), true);
  assert.strictEqual(buildingPolicies.isSoftObstacle('dandelion'), true);
  assert.strictEqual(buildingPolicies.isSoftObstacle('snow'), true);

  assert.strictEqual(buildingPolicies.isSoftObstacle('stone'), false);
  assert.strictEqual(buildingPolicies.isSoftObstacle('cobblestone'), false);
  assert.strictEqual(buildingPolicies.isSoftObstacle('oak_planks'), false);
  assert.strictEqual(buildingPolicies.isSoftObstacle('air'), false);
});

test('BuildingPolicies - Reference Block Face Finding', () => {
  // Ground is solid at y=63
  const solidWorld = new Set(['0,63,0', '1,63,0']);
  const isSolid = (pos) => solidWorld.has(`${pos.x},${pos.y},${pos.z}`);

  // Target block to place at (0, 64, 0)
  const ref = buildingPolicies.findReferenceBlock({ x: 0, y: 64, z: 0 }, isSolid);
  assert.ok(ref !== null);
  // Reference block is directly below at y=63
  assert.deepStrictEqual(ref.referencePos, { x: 0, y: 63, z: 0 });
  // Face vector pointing from reference to target is { x: 0, y: 1, z: 0 } (top face)
  assert.deepStrictEqual(ref.faceVector, { x: 0, y: 1, z: 0 });
});

test('BuildingPolicies - Bounding Box Calculation', () => {
  const origin = { x: 10, y: 64, z: 20 };
  const blocks = [
    { dx: 0, dy: 0, dz: 0 },
    { dx: 5, dy: 2, dz: 4 }
  ];

  const box = buildingPolicies.calculateBoundingBox(origin, blocks);
  assert.strictEqual(box.minX, 10);
  assert.strictEqual(box.maxX, 15);
  assert.strictEqual(box.minY, 64);
  assert.strictEqual(box.maxY, 66);
  assert.strictEqual(box.minZ, 20);
  assert.strictEqual(box.maxZ, 24);
});
