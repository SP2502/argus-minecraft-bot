const test = require('node:test');
const assert = require('node:assert');
const spellCorrector = require('../nlp/SpellCorrector');

test('SpellCorrector - Typo Detection and Auto-Correction', () => {
  // Exact similarity
  assert.strictEqual(spellCorrector.similarity('diamond', 'diamond'), 1.0);

  // Correction of typo: mien -> mine
  const res1 = spellCorrector.correct('mien diamonds');
  assert.strictEqual(res1.correctedText, 'mine diamonds');

  // Multi-typo: mien 2 staks of dimonds -> mine 2 stacks of diamond
  const res2 = spellCorrector.correct('mien 2 staks of dimonds');
  assert.ok(res2.correctedText.includes('mine'));
  assert.ok(res2.correctedText.includes('diamond') || res2.correctedText.includes('dimonds'));
});
