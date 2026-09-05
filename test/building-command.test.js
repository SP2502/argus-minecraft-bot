const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../commands/UnifiedCommandGateway');
const CommandPlanner = require('../commands/CommandPlanner');
const intentParser = require('../nlp/IntentParser');
const conversationContext = require('../commands/ConversationContextManager');
const confirmationManager = require('../commands/ConfirmationManager');

test('Building Command - NLP Parsing, Planning, and Gateway Authorization', async () => {
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

  // 1. "build shelter" by Admin
  const shelterReq = {
    source: 'minecraft',
    senderId: 'AdminPlayer',
    message: 'build shelter'
  };
  const shelterRes = await gateway.execute(shelterReq);
  assert.strictEqual(shelterRes.ok, true);
  assert.strictEqual(shelterRes.status, 'queued');
  const task1 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task1.skillName, 'build');
  assert.strictEqual(task1.params.structure, 'shelter');
  assert.strictEqual(task1.params.material, 'cobblestone');

  // 2. "build wall 10x3 with cobblestone"
  const wallReq = {
    source: 'dashboard',
    senderId: 'AdminPlayer',
    message: 'build wall 10x3 with cobblestone'
  };
  const wallRes = await gateway.execute(wallReq);
  assert.strictEqual(wallRes.ok, true);
  const task2 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task2.skillName, 'build');
  assert.strictEqual(task2.params.structure, 'wall');
  assert.strictEqual(task2.params.material, 'cobblestone');
  assert.deepStrictEqual(task2.params.dimensions, { length: 10, height: 3 });

  // 3. "build floor 5x5 with oak_planks"
  const floorReq = {
    source: 'rest',
    senderId: 'AdminPlayer',
    message: 'build floor 5x5 with oak_planks'
  };
  const floorRes = await gateway.execute(floorReq);
  assert.strictEqual(floorRes.ok, true);
  const task3 = queuedTasks[queuedTasks.length - 1];
  assert.strictEqual(task3.skillName, 'build');
  assert.strictEqual(task3.params.structure, 'floor');
  assert.strictEqual(task3.params.material, 'oak_planks');
  assert.deepStrictEqual(task3.params.dimensions, { width: 5, depth: 5 });

  // 4. RBAC Check: Guest is denied 'build' (requires admin)
  const guestReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'build shelter'
  };
  const guestRes = await gateway.execute(guestReq);
  assert.strictEqual(guestRes.ok, false);
  assert.strictEqual(guestRes.status, 'denied');
});
