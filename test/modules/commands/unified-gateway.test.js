const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../../../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../../../src/modules/commands/CommandPlanner');
const intentParser = require('../../../src/modules/nlp/IntentParser');
const conversationContext = require('../../../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../../../src/modules/commands/ConfirmationManager');
const { TaskManager } = require('../../../src/core/TaskManager');
const LocationRegistry = require('../../../src/modules/navigation/locations.repository');
const MessageRouter = require('../../../src/shared/communication/MessageRouter');

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

function dispatchFixture(overrides = {}) {
  const ctx = {
    bot: { username: 'Argus' },
    conversationContext,
    confirmations: confirmationManager,
    nlp: intentParser,
    taskManager: { addTask: () => assert.fail('Rejected commands must never enqueue a task') },
    ...overrides
  };
  ctx.commandPlanner = new CommandPlanner(ctx);
  const gateway = new UnifiedCommandGateway(ctx);
  const execute = (message) => gateway.execute({ source: 'minecraft', senderId: 'DispatchPlayer', message });
  return { gateway, execute };
}

test('UnifiedCommandGateway rejects missing prerequisites and unavailable skills before enqueue', async () => {
  const { execute } = dispatchFixture({ locations: new LocationRegistry() });

  const missing = await execute('go to unmapped');
  assert.strictEqual(missing.status, 'error');
  assert.match(missing.message, /Location 'unmapped' is not registered/);

  for (const [message, intent] of [
    ['sort inventory', 'sort_inventory'],
    ['register base outpost', 'register_base'],
    ['mine 64 diamonds then go home and store all', 'store_all']
  ]) {
    const response = await execute(message);
    assert.strictEqual(response.status, 'error');
    assert.ok(response.message.includes(`Command '${intent}' is not yet implemented`));
  }
});

test('UnifiedCommandGateway reports actual queue and registered location state', async () => {
  const taskManager = new TaskManager({});
  const locations = new LocationRegistry();
  const { execute } = dispatchFixture({ taskManager, locations });

  assert.match((await execute('queue')).message, /No active task.*Queue is empty/);
  taskManager.activeTask = { skillName: 'navigation' };
  taskManager.queue.push({ skillName: 'mine' }, { skillName: 'craft' });
  taskManager.isPaused = true;
  const queue = await execute('queue');
  assert.strictEqual(queue.status, 'info');
  assert.match(queue.message, /Active: navigation.*Queued \(2\): mine, craft.*Queue paused/);

  assert.strictEqual((await execute('list bases')).message, 'No bases registered.');
  const position = { x: 10, y: 64, z: -20 };
  await locations.registerBase('Outpost', position);
  await locations.registerFarm('Field', position);
  await locations.registerMine('Quarry', position);
  locations.memoryLocations.set('Trailhead', { name: 'Trailhead', type: 'waypoint', ...position });

  for (const [type, expected] of [
    ['bases', 'Outpost (10, 64, -20)'], ['farms', 'Field'], ['mines', 'Quarry'], ['waypoints', 'Trailhead']
  ]) {
    const response = await execute(`list ${type}`);
    assert.strictEqual(response.status, 'info');
    assert.strictEqual(response.message, `Registered ${type}: ${expected}`);
  }
});

test('UnifiedCommandGateway toggles quiet mode and audits unsupported controls as errors', async (t) => {
  const whispers = [];
  const messageRouter = new MessageRouter({ whisper: (player, message) => whispers.push(message) });
  const { gateway, execute } = dispatchFixture({ messageRouter });
  const audit = t.mock.method(gateway, 'createAudit', async () => {});

  assert.strictEqual((await execute('quiet mode on')).status, 'success');
  await messageRouter.send(2, 'Quiet-mode test message');
  assert.deepStrictEqual(whispers, []);

  assert.strictEqual((await execute('quiet mode off')).status, 'success');
  await messageRouter.send(2, 'Normal-mode test message');
  assert.deepStrictEqual(whispers, ['[Argus] Normal-mode test message']);

  const unsupported = await execute('security log');
  assert.strictEqual(unsupported.status, 'error');
  assert.match(unsupported.message, /security_log.*not yet implemented/);
  const lastAudit = audit.mock.calls.at(-1).arguments[0];
  assert.strictEqual(lastAudit.status, 'error');
  assert.strictEqual(lastAudit.error, unsupported.message);
});
