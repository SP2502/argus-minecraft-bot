const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../../../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../../../src/modules/commands/CommandPlanner');
const intentParser = require('../../../src/modules/nlp/IntentParser');
const conversationContext = require('../../../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../../../src/modules/commands/ConfirmationManager');
require('../../../src/modules/combat');

test('Combat Command - NLP Parsing, Planning, and Gateway Authorization', async () => {
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

  // 1. "kill 5 zombies" -> mode: 'hunt', targetMob: 'zombie', quantity: 5
  const killReq = {
    source: 'minecraft',
    senderId: 'AdminPlayer',
    message: 'kill 5 zombies'
  };
  const killRes = await gateway.execute(killReq);
  assert.strictEqual(killRes.ok, true);
  assert.strictEqual(killRes.status, 'queued');
  const task1 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task1.skillName, 'combat');
  assert.strictEqual(task1.params.mode, 'hunt');
  assert.strictEqual(task1.params.targetMob, 'zombie');
  assert.strictEqual(task1.params.quantity, 5);

  // 2. "protect me" -> mode: 'guard', targetPlayer: 'TrustedPlayer'
  const guardReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'protect me'
  };
  const guardRes = await gateway.execute(guardReq);
  assert.strictEqual(guardRes.ok, true);
  assert.strictEqual(guardRes.status, 'queued');
  const task2 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task2.skillName, 'combat');
  assert.strictEqual(task2.params.mode, 'guard');
  assert.strictEqual(task2.params.targetPlayer, 'TrustedPlayer');

  // 3. "clear hostiles" -> mode: 'hunt', targetMob: 'any'
  const clearReq = {
    source: 'dashboard',
    senderId: 'AdminPlayer',
    message: 'clear hostiles'
  };
  const clearRes = await gateway.execute(clearReq);
  assert.strictEqual(clearRes.ok, true);
  assert.strictEqual(clearRes.status, 'queued');
  const task3 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task3.skillName, 'combat');
  assert.strictEqual(task3.params.mode, 'hunt');
  assert.strictEqual(task3.params.targetMob, 'any');

  // 4. Guest cannot queue combat (Requires ADMIN)
  const guestReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'kill 10 spiders'
  };
  const guestRes = await gateway.execute(guestReq);
  assert.strictEqual(guestRes.ok, false);
  assert.strictEqual(guestRes.status, 'denied');
});
