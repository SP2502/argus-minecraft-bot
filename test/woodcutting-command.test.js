const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../src/modules/commands/CommandPlanner');
const intentParser = require('../src/modules/nlp/IntentParser');
const conversationContext = require('../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../src/modules/commands/ConfirmationManager');
require('../src/modules/forestry');

test('Woodcutting Command - NLP Parsing, Planning, and Gateway Authorization', async () => {
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

  // 1. "cut 2 stacks of spruce logs" -> spruce, quantity 128
  const spruceReq = {
    source: 'minecraft',
    senderId: 'AdminPlayer',
    message: 'cut 2 stacks of spruce logs'
  };
  const spruceRes = await gateway.execute(spruceReq);
  assert.strictEqual(spruceRes.ok, true);
  assert.strictEqual(spruceRes.status, 'queued');
  const task1 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task1.skillName, 'chop_tree');
  assert.strictEqual(task1.params.treeType, 'spruce');
  assert.strictEqual(task1.params.quantity, 128);

  // 2. "chop trees" -> any, quantity 64
  const generalReq = {
    source: 'dashboard',
    senderId: 'AdminPlayer',
    message: 'chop trees'
  };
  const generalRes = await gateway.execute(generalReq);
  assert.strictEqual(generalRes.ok, true);
  assert.strictEqual(generalRes.status, 'queued');
  const task2 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task2.skillName, 'chop_tree');
  assert.strictEqual(task2.params.treeType, 'any');
  assert.strictEqual(task2.params.quantity, 64);

  // 3. Guest cannot queue chop_tree (Requires ADMIN)
  const guestReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'cut 64 oak logs'
  };
  const guestRes = await gateway.execute(guestReq);
  assert.strictEqual(guestRes.ok, false);
  assert.strictEqual(guestRes.status, 'denied');
});
