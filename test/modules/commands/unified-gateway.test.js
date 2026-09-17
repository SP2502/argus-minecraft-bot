const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../../../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../../../src/modules/commands/CommandPlanner');
const intentParser = require('../../../src/modules/nlp/IntentParser');
const conversationContext = require('../../../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../../../src/modules/commands/ConfirmationManager');
const { TaskManager } = require('../../../src/core/TaskManager');
const Priorities = require('../../../src/shared/config/priorities');

test('UnifiedCommandGateway - Authorization, Ambiguity, and Execution', async () => {
  const tasksEnqueued = [];

  const mockCtx = {
    bot: { username: 'Argus', health: 20, food: 20, entity: { position: { x: 0, y: 64, z: 0 } } },
    locations: {
      listByType: async (type) => {
        if (type === 'base') {
          return [
            { name: 'Mountain_Base', x: 100, y: 64, z: 200 },
            { name: 'Mine_Base', x: -500, y: -59, z: 100 }
          ];
        }
        return [];
      },
      getBase: async (name) => ({ name, x: 100, y: 64, z: 200 })
    },
    permissions: {
      checkRateLimit: () => true,
      hasPermission: async (username, role) => {
        if (username === 'OwnerPlayer') return true;
        if (username === 'GuestPlayer') return role === 'guest';
        if (username === 'AdminPlayer') return true;
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
        tasksEnqueued.push(t);
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

  // 1. Guest tries mining -> Denied
  const guestReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'mine 64 diamonds'
  };
  const resGuest = await gateway.execute(guestReq);
  assert.strictEqual(resGuest.ok, false);
  assert.strictEqual(resGuest.status, 'denied');

  // 2. Admin tries mining -> Queued
  const adminReq = {
    source: 'minecraft',
    senderId: 'AdminPlayer',
    message: 'mine 64 diamonds'
  };
  const resAdmin = await gateway.execute(adminReq);
  assert.strictEqual(resAdmin.ok, true);
  assert.strictEqual(resAdmin.status, 'queued');
  assert.strictEqual(tasksEnqueued.length, 1);
  assert.strictEqual(tasksEnqueued[0].params.targetOre, 'diamond');
  assert.strictEqual(tasksEnqueued[0].params.quantity, 64);

  // 3. Ambiguity Resolution: "go to base" with 2 bases -> Clarification requested
  const ambReq = {
    source: 'minecraft',
    senderId: 'OwnerPlayer',
    message: 'go to base'
  };
  const resAmb = await gateway.execute(ambReq);
  assert.strictEqual(resAmb.status, 'clarification');
  assert.ok(resAmb.data.options.length === 2);

  // 4. Same user replies "first one" -> Resolves Mountain_Base
  const answerReq = {
    source: 'minecraft',
    senderId: 'OwnerPlayer',
    message: 'first one'
  };
  const resResolved = await gateway.execute(answerReq);
  assert.strictEqual(resResolved.ok, true);

  // 5. Dashboard command creates identical plan
  const dashReq = {
    source: 'dashboard',
    senderId: 'OwnerPlayer',
    message: 'mine 32 iron'
  };
  const resDash = await gateway.execute(dashReq);
  assert.strictEqual(resDash.ok, true);
  assert.strictEqual(resDash.status, 'queued');

  // 6. Dangerous Operation (drop all diamonds) requires confirmation
  const dropReq = {
    source: 'minecraft',
    senderId: 'OwnerPlayer',
    message: 'drop all diamonds'
  };
  const resDrop = await gateway.execute(dropReq);
  assert.strictEqual(resDrop.status, 'confirmation_required');

  // Cancel the pending drop confirmation
  const cancelDrop = await gateway.execute({
    source: 'minecraft',
    senderId: 'OwnerPlayer',
    message: 'no'
  });
  assert.strictEqual(cancelDrop.ok, true);

  // 7. Typo Tolerance: 'mien 2 staks of dimonds'
  const typoReq = {
    source: 'minecraft',
    senderId: 'OwnerPlayer',
    message: 'mien 2 staks of dimonds'
  };
  const resTypo = await gateway.execute(typoReq);
  assert.strictEqual(resTypo.ok, true);
  assert.strictEqual(resTypo.status, 'queued');
  const latestTask = tasksEnqueued[tasksEnqueued.length - 1];
  assert.strictEqual(latestTask.params.targetOre, 'diamond');
  assert.strictEqual(latestTask.params.quantity, 128);
});
