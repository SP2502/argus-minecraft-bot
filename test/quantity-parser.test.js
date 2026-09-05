const test = require('node:test');
const assert = require('node:assert');
const quantityParser = require('../nlp/QuantityParser');

test('QuantityParser - Numeric and Word Parsing', () => {
  // Plain numbers
  assert.strictEqual(quantityParser.parse('64').value, 64);
  assert.strictEqual(quantityParser.parse('128').value, 128);

  // Number words
  assert.strictEqual(quantityParser.parse('sixty four').value, 64);
  assert.strictEqual(quantityParser.parse('a dozen').value, 12);
  assert.strictEqual(quantityParser.parse('two').value, 2);

  // Minecraft Stacks
  assert.strictEqual(quantityParser.parse('a stack').value, 64);
  assert.strictEqual(quantityParser.parse('2 stacks').value, 128);
  assert.strictEqual(quantityParser.parse('2 staks').value, 128);
  assert.strictEqual(quantityParser.parse('half stack').value, 32);

  // Relative
  const allRes = quantityParser.parse('all');
  assert.strictEqual(allRes.mode, 'all');
  assert.strictEqual(allRes.value, null);

  const halfRes = quantityParser.parse('half');
  assert.strictEqual(halfRes.mode, 'relative_half');
  assert.strictEqual(halfRes.value, 32);
});
