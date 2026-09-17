const test = require('node:test');
const assert = require('node:assert');
const coordinateParser = require('../../../src/modules/nlp/CoordinateParser');

test('CoordinateParser - Absolute, 2D, and Relative', () => {
  // Labeled
  const labeled = coordinateParser.parse('x: 100 y: 64 z: -200');
  assert.strictEqual(labeled.type, 'coordinates');
  assert.strictEqual(labeled.x, 100);
  assert.strictEqual(labeled.y, 64);
  assert.strictEqual(labeled.z, -200);

  // Triple tuple
  const tuple = coordinateParser.parse('(100, 64, -200)');
  assert.strictEqual(tuple.type, 'coordinates');
  assert.strictEqual(tuple.x, 100);
  assert.strictEqual(tuple.y, 64);
  assert.strictEqual(tuple.z, -200);

  // 2D Two-axis
  const twoD = coordinateParser.parse('100 -200', { x: 0, y: 70, z: 0 });
  assert.strictEqual(twoD.type, 'coordinates');
  assert.strictEqual(twoD.x, 100);
  assert.strictEqual(twoD.y, 70);
  assert.strictEqual(twoD.z, -200);
  assert.strictEqual(twoD.needsSafeY, true);

  // Relative Direction
  const rel = coordinateParser.parse('10 blocks north');
  assert.strictEqual(rel.type, 'relative_coordinates');
  assert.strictEqual(rel.dz, -10);

  // Named
  const home = coordinateParser.parse('home');
  assert.strictEqual(home.type, 'named_location');
  assert.strictEqual(home.name, 'home');
});
