const test = require('node:test');
const assert = require('node:assert');
const { schematics } = require('../src/modules/building');

test('Procedural Schematics - Wall Generation', () => {
  // 1. Wall along X axis (10 blocks long, 3 high)
  const wallX = schematics.generateWall(10, 3, 'cobblestone', 'x');
  assert.strictEqual(wallX.length, 30);
  assert.strictEqual(wallX[0].blockType, 'cobblestone');
  assert.ok(wallX.every((b) => b.dz === 0));
  assert.ok(wallX.some((b) => b.dx === 9 && b.dy === 2));

  // 2. Wall along Z axis (5 blocks long, 4 high)
  const wallZ = schematics.generateWall(5, 4, 'stone_bricks', 'z');
  assert.strictEqual(wallZ.length, 20);
  assert.strictEqual(wallZ[0].blockType, 'stone_bricks');
  assert.ok(wallZ.every((b) => b.dx === 0));
  assert.ok(wallZ.some((b) => b.dz === 4 && b.dy === 3));
});

test('Procedural Schematics - Floor Platform Generation', () => {
  // 5x5 Floor
  const floor = schematics.generateFloor(5, 5, 'oak_planks');
  assert.strictEqual(floor.length, 25);
  assert.strictEqual(floor[0].blockType, 'oak_planks');
  // All blocks must have dy === 0
  assert.ok(floor.every((b) => b.dy === 0));
  assert.ok(floor.some((b) => b.dx === 4 && b.dz === 4));
});

test('Procedural Schematics - Cube & Box Generation', () => {
  // 1. Solid Cube 3x3x3 -> 27 blocks
  const solidCube = schematics.generateCube(3, 3, 3, 'cobblestone', false);
  assert.strictEqual(solidCube.length, 27);

  // 2. Hollow Cube 3x3x3 -> 27 - 1 (center) = 26 blocks
  const hollowCube = schematics.generateCube(3, 3, 3, 'cobblestone', true);
  assert.strictEqual(hollowCube.length, 26);
  // Center (1, 1, 1) must not be present
  assert.ok(!hollowCube.some((b) => b.dx === 1 && b.dy === 1 && b.dz === 1));
});

test('Procedural Schematics - Emergency Shelter Generation', () => {
  // 3x3x3 Shelter with doorway
  const shelter = schematics.generateShelter('cobblestone', 3, 3, 3);
  // Doorway is at dx=1, dz=0, dy=0 and dy=1
  assert.ok(!shelter.some((b) => b.dx === 1 && b.dz === 0 && (b.dy === 0 || b.dy === 1)));
  // Interior air space (1, 1, 1) should not be solid
  assert.ok(!shelter.some((b) => b.dx === 1 && b.dy === 1 && b.dz === 1));
  // Roof should be complete at dy=2
  const roofBlocks = shelter.filter((b) => b.dy === 2);
  assert.strictEqual(roofBlocks.length, 9);
});

test('Procedural Schematics - Staircase Generation', () => {
  // 4 steps ascending North (negative Z)
  const stairs = schematics.generateStairs(4, 'cobblestone', 'north');
  // Solid stairs: step 0 has 1 block, step 1 has 2 blocks, step 2 has 3 blocks, step 3 has 4 blocks
  // Total = 1 + 2 + 3 + 4 = 10 blocks
  assert.strictEqual(stairs.length, 10);
  assert.ok(stairs.some((b) => b.dy === 3 && b.dz === -3));
});
