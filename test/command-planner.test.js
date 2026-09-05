const test = require('node:test');
const assert = require('node:assert');
const CommandPlanner = require('../commands/CommandPlanner');
const intentParser = require('../nlp/IntentParser');

test('CommandPlanner - Single and Compound Sequential Plans', async () => {
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
