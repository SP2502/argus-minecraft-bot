const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../src/modules/commands/CommandPlanner');
const intentParser = require('../src/modules/nlp/IntentParser');
const conversationContext = require('../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../src/modules/commands/ConfirmationManager');
require('../src/modules/logistics');

test('Logistics Command - Gateway NLP, Planning, and RBAC Execution', async () => {
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
    },
    logistics: {
      findItemInWarehouse: (item) => [
        { position: { x: 10, y: 64, z: 10 }, category: 'ores', label: 'gem_chest', count: 32 }
      ]
    }
  };

  mockCtx.commandPlanner = new CommandPlanner(mockCtx);
  const gateway = new UnifiedCommandGateway(mockCtx);

  // 1. "sort warehouse" by TrustedPlayer -> queued
  const sortReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'sort warehouse'
  };
  const sortRes = await gateway.execute(sortReq);
  assert.strictEqual(sortRes.ok, true);
  assert.strictEqual(sortRes.status, 'queued');
  const sortTask = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(sortTask.skillName, 'logistics');
  assert.strictEqual(sortTask.params.mode, 'sort');

  // 2. "restock miner" by TrustedPlayer -> queued
  const restockReq = {
    source: 'dashboard',
    senderId: 'TrustedPlayer',
    message: 'restock miner'
  };
  const restockRes = await gateway.execute(restockReq);
  assert.strictEqual(restockRes.ok, true);
  assert.strictEqual(restockRes.status, 'queued');
  const restockTask = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(restockTask.skillName, 'logistics');
  assert.strictEqual(restockTask.params.mode, 'restock');
  assert.strictEqual(restockTask.params.kit, 'miner');

  // 3. "find item diamond" / "where is diamond" by GuestPlayer -> allowed (guest permission, synchronous control query)
  const findReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'where is diamond'
  };
  const findRes = await gateway.execute(findReq);
  assert.strictEqual(findRes.ok, true);
  assert.strictEqual(findRes.status, 'success');
  assert.ok(findRes.message.includes('diamond'));
  assert.ok(findRes.message.includes('32x'));

  // 4. "index chests" by TrustedPlayer -> denied (requires ADMIN)
  const indexDeniedReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'index chests'
  };
  const indexDeniedRes = await gateway.execute(indexDeniedReq);
  assert.strictEqual(indexDeniedRes.ok, false);
  assert.strictEqual(indexDeniedRes.status, 'denied');

  // 5. "index chests" by AdminPlayer -> queued
  const indexAdminReq = {
    source: 'dashboard',
    senderId: 'AdminPlayer',
    message: 'index chests'
  };
  const indexAdminRes = await gateway.execute(indexAdminReq);
  assert.strictEqual(indexAdminRes.ok, true);
  assert.strictEqual(indexAdminRes.status, 'queued');
  const indexTask = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(indexTask.skillName, 'logistics');
  assert.strictEqual(indexTask.params.mode, 'index');
});
