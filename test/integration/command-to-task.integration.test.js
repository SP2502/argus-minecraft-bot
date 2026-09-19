const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const BotContext = require('../../src/core/BotContext');

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusIntegrationBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) },
    yaw: 0,
    pitch: 0
  };
  bot.inventory = {
    items: () => [],
    slots: new Array(45).fill(null)
  };
  bot.loadPlugin = () => {};
  bot.pathfinder = {
    setGoal: () => {},
    setMovements: () => {},
    stop: () => {}
  };
  return bot;
}

test('Command-to-Task Gateway Pipeline Integration Suite', async (t) => {
  await t.test('Single command: mine 16 iron_ore dispatches through gateway to task manager', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'mine 16 iron_ore'
    });

    assert.strictEqual(res.status, 'queued');
    assert.ok(Array.isArray(res.taskIds) && res.taskIds.length === 1);
    assert.ok(res.message.includes('Queued task [mine]'));

    // Verify task manager queue
    const queue = ctx.taskManager.getQueueSnapshot().queue;
    const queuedTask = queue.find(t => t.id === res.taskIds[0]);
    assert.ok(queuedTask, 'Task exists in TaskManager queue');
    assert.strictEqual(queuedTask.skillName, 'mine');
    assert.strictEqual(queuedTask.params.targetOre, 'iron');
    assert.strictEqual(queuedTask.params.quantity, 16);
  });

  await t.test('Compound command: mine 32 coal_ore then go home plans sequential dependent tasks', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'mine 32 coal_ore then go home'
    });

    assert.strictEqual(res.status, 'queued');
    assert.strictEqual(res.taskIds.length, 2, 'Two sequential tasks planned');
    assert.ok(res.message.includes('Queued workflow (2 steps): mine ➔ go_home'));

    const queue = ctx.taskManager.getQueueSnapshot().queue;
    const task1 = queue.find(t => t.id === res.taskIds[0]);
    const task2 = queue.find(t => t.id === res.taskIds[1]);
    assert.ok(task1, 'Task 1 exists in queue');
    assert.ok(task2, 'Task 2 exists in queue');
    assert.strictEqual(task1.skillName, 'mine');
    assert.strictEqual(task2.skillName, 'navigation');
  });

  await t.test('Immediate control commands execute directly without queueing tasks', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    const statusRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'status'
    });

    assert.strictEqual(statusRes.status, 'info');
    assert.ok(statusRes.message.includes('Health=20/20'));
    assert.strictEqual(ctx.taskManager.getQueueSnapshot().queue.length, 0, 'No tasks queued for status inquiry');

    const stopRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'stop'
    });

    assert.strictEqual(stopRes.status, 'success');
    assert.strictEqual(stopRes.message, 'Tasks stopped and bot is idling.');
  });

  await t.test('Rate limiting denies excessive commands from non-owner while exempting owner', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    // Non-owner sends 10 allowed commands
    for (let i = 0; i < 10; i++) {
      const r = await ctx.commandGateway.execute({
        source: 'minecraft',
        senderId: 'NormalPlayer',
        message: 'status'
      });
      assert.strictEqual(r.status, 'info');
    }

    // 11th command is denied
    const deniedRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: 'NormalPlayer',
      message: 'status'
    });
    assert.strictEqual(deniedRes.status, 'denied');
    assert.ok(deniedRes.message.includes('Rate limit exceeded'));

    // Owner is exempt
    const ownerRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'status'
    });
    assert.strictEqual(ownerRes.status, 'info');
  });

  await t.test('Dangerous commands require explicit confirmation challenge', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'drop all'
    });

    assert.strictEqual(res.status, 'confirmation_required');
    assert.ok(res.message.includes('WARNING: Dangerous operation requested [drop_all]'));
    assert.ok(res.data && res.data.confirmationId);

    // Replying yes executes confirmed operation
    const confRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'yes'
    });

    assert.strictEqual(confRes.status, 'success');
    assert.ok(confRes.message.includes('Dropped items as confirmed'));
  });
});
