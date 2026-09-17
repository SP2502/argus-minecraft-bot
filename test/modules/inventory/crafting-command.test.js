const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../../../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../../../src/modules/commands/CommandPlanner');
const intentParser = require('../../../src/modules/nlp/IntentParser');
const conversationContext = require('../../../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../../../src/modules/commands/ConfirmationManager');

test('Crafting & Smelting Command - NLP Parsing, Planning, and Gateway Execution', async () => {
  const queuedTasks = [];

  const mockCtx = {
    bot: { username: 'Argus', health: 20, food: 20, entity: { position: { x: 0, y: 64, z: 0 } } },
    locations: {
      listByType: async () => [],
      getBase: async (name) => ({ name, x: 50, y: 64, z: 50 })
    },
    permissions: {
      checkRateLimit: () => true,
      hasPermission: async (username, role) => {
        if (username === 'AdminPlayer' || username === 'OwnerPlayer') return true;
        if (username === 'TrustedPlayer') return role === 'trusted' || role === 'guest';
        if (username === 'GuestPlayer') return role === 'guest';
        return false;
      },
      recordFailedAttempt: () => {}
    },
    conversationContext,
    confirmations: confirmationManager,
    nlp: intentParser,
    taskManager: {
      addTask: (skill, params, prio, sender, locks) => {
        const t = { id: `task_${Date.now()}`, skillName: skill, params, priority: prio, sender, locks };
        queuedTasks.push(t);
        return t;
      }
    },
    messageRouter: {
      handleSocialGreeting: () => false,
      respondToCommand: async () => {}
    }
  };

  mockCtx.commandPlanner = new CommandPlanner(mockCtx);
  const gateway = new UnifiedCommandGateway(mockCtx);

  // 1. "craft 64 torches" -> mode: 'craft', item: 'torch', quantity: 64
  const craftReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'craft 64 torches'
  };
  const craftRes = await gateway.execute(craftReq);
  assert.strictEqual(craftRes.ok, true);
  assert.strictEqual(craftRes.status, 'queued');
  const task1 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task1.skillName, 'craft');
  assert.strictEqual(task1.params.mode, 'craft');
  assert.strictEqual(task1.params.item, 'torch');
  assert.strictEqual(task1.params.quantity, 64);

  // 2. "smelt 16 raw iron with coal" -> mode: 'smelt', item: 'raw_iron', quantity: 16, fuel: 'coal'
  const smeltReq = {
    source: 'dashboard',
    senderId: 'TrustedPlayer',
    message: 'smelt 16 raw iron with coal'
  };
  const smeltRes = await gateway.execute(smeltReq);
  assert.strictEqual(smeltRes.ok, true);
  assert.strictEqual(smeltRes.status, 'queued');
  const task2 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task2.skillName, 'craft');
  assert.strictEqual(task2.params.mode, 'smelt');
  assert.strictEqual(task2.params.fuel, 'coal');

  // 3. Guest cannot craft (Requires TRUSTED)
  const guestReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'craft iron pickaxe'
  };
  const guestRes = await gateway.execute(guestReq);
  assert.strictEqual(guestRes.ok, false);
  assert.strictEqual(guestRes.status, 'denied');
});
