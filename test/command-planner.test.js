const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const CommandPlanner = require('../src/modules/commands/CommandPlanner');
const intentParser = require('../src/modules/nlp/IntentParser');
const intentRegistry = require('../src/modules/nlp/IntentRegistry');
const { IntentRegistry } = intentRegistry;

test('CommandPlanner - Single and Compound Sequential Plans', async () => {
  // --- Milestone 2A: Modular Intent Registration Invariant Verification ---
  // 1. Central intent files load into the global registry
  const centralIntents = intentRegistry.getAllIntents();
  assert.ok(centralIntents.length > 0, 'Central intent files must load successfully');
  assert.ok(intentRegistry.getIntent('mine'), 'Central "mine" intent must be registered');

  // 2. Feature-local intent loading into an isolated registry instance
  const isolatedRegistry = new IntentRegistry({ autoLoadBuiltins: false });
  assert.strictEqual(isolatedRegistry.getAllIntents().length, 0, 'Isolated registry starts empty');

  const tmpDir = os.tmpdir();
  const testFileA = path.join(tmpDir, `argus_test_local_a_${Date.now()}.json`);
  const testFileB = path.join(tmpDir, `argus_test_local_b_${Date.now()}.json`);
  const testFileDup = path.join(tmpDir, `argus_test_dup_${Date.now()}.json`);
  const testFileMalformed = path.join(tmpDir, `argus_test_malformed_${Date.now()}.json`);

  try {
    fs.writeFileSync(
      testFileA,
      JSON.stringify([
        {
          name: 'feature_action_alpha',
          phrases: ['execute alpha action', 'run alpha'],
          requiredPermission: 'guest'
        }
      ])
    );
    fs.writeFileSync(
      testFileB,
      JSON.stringify([
        {
          name: 'feature_action_beta',
          phrases: ['execute beta action', 'run beta'],
          requiredPermission: 'admin'
        }
      ])
    );
    fs.writeFileSync(
      testFileDup,
      JSON.stringify([
        {
          name: 'feature_action_alpha',
          phrases: ['conflicting duplicate alpha']
        }
      ])
    );
    fs.writeFileSync(testFileMalformed, '{\n  "name": "broken",\n  invalid_json\n');

    // A feature-local intent file loads
    isolatedRegistry.registerIntentFile(testFileA);
    const loadedA = isolatedRegistry.getIntent('feature_action_alpha');
    assert.ok(loadedA, 'Feature-local intent file must load definition');
    assert.strictEqual(loadedA.requiredPermission, 'guest');

    // Multiple feature-local intent files load
    isolatedRegistry.registerIntentFile(testFileB);
    const loadedB = isolatedRegistry.getIntent('feature_action_beta');
    assert.ok(loadedB, 'Second feature-local intent file must load definition');
    assert.strictEqual(isolatedRegistry.getAllIntents().length, 2);

    // Duplicate IDs are rejected with conflicting source paths
    assert.throws(
      () => isolatedRegistry.registerIntentFile(testFileDup),
      (err) => {
        const msg = err.message;
        return (
          msg.includes('Duplicate intent ID "feature_action_alpha"') &&
          msg.includes(testFileDup) &&
          msg.includes(testFileA)
        );
      },
      'Duplicate intent registration must throw an error reporting both conflicting sources'
    );

    // Malformed JSON reports its exact filename
    assert.throws(
      () => isolatedRegistry.registerIntentFile(testFileMalformed),
      (err) => {
        const msg = err.message;
        return msg.includes('Malformed JSON in intent file') && msg.includes(testFileMalformed);
      },
      'Malformed JSON must throw an error reporting the exact filename'
    );

    // Missing intent file fails clearly
    const nonExistentPath = path.join(tmpDir, `non_existent_intent_${Date.now()}.json`);
    assert.throws(
      () => isolatedRegistry.registerIntentFile(nonExistentPath),
      (err) => err.message.includes('Intent file not found'),
      'Missing intent file must throw an informative error'
    );
  } finally {
    for (const file of [testFileA, testFileB, testFileDup, testFileMalformed]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch (_e) {}
    }
  }

  // --- Existing Command Planner and Parsing Behavior Remains Unchanged ---
  // Mock context
  const mockCtx = {
    locations: {
      listByType: async () => [],
      getBase: async () => null
    }
  };
  const planner = new CommandPlanner(mockCtx);

  // 1. Single Mining Plan
  const parseMine = intentParser.parse('mine 64 diamonds');
  const planMine = await planner.plan(parseMine, { senderId: 'Alice' });

  assert.strictEqual(planMine.type, 'single');
  assert.strictEqual(planMine.operations.length, 1);
  assert.strictEqual(planMine.operations[0].intentName, 'mine');
  assert.strictEqual(planMine.operations[0].params.targetOre, 'diamond');
  assert.strictEqual(planMine.operations[0].params.quantity, 64);

  // 2. Compound Sequence: mine 64 diamonds then go home and store all
  const parseCompound = intentParser.parse('mine 64 diamonds then go home and store all');
  const planCompound = await planner.plan(parseCompound, { senderId: 'Alice' });

  assert.strictEqual(planCompound.type, 'sequence');
  assert.ok(planCompound.operations.length >= 2);
  assert.strictEqual(planCompound.operations[0].intentName, 'mine');
  assert.strictEqual(planCompound.operations[1].intentName, 'go_home');
  assert.ok(planCompound.operations[1].dependsOn.includes(planCompound.operations[0].operationId));
});
