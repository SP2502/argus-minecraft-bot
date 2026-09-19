const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const BotContext = require('../../src/core/BotContext');

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusNavBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: {
      x: 10,
      y: 64,
      z: 20,
      floored: () => ({ x: 10, y: 64, z: 20 }),
      distanceTo: (pos) => Math.sqrt(Math.pow(10 - pos.x, 2) + Math.pow(64 - pos.y, 2) + Math.pow(20 - pos.z, 2))
    }
  };
  bot.inventory = {
    items: () => [],
    slots: new Array(45).fill(null)
  };
  bot.loadPlugin = () => {};
  bot.pathfinder = {
    setGoal: () => {},
    setMovements: () => {},
    stop: () => {},
    isMoving: () => false
  };
  bot.blockAt = () => ({ name: 'stone', boundingBox: 'block' });
  return bot;
}

test('Navigation Gateway & Service Integration Suite', async (t) => {
  await t.test('Absolute coordinate command navigates via NavigationSkill', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    let targetGoal = null;
    ctx.nav.goTo = async (pos, options) => {
      targetGoal = pos;
      return { success: true, arrived: true };
    };

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'go to x: 100 y: 64 z: -200'
    });

    assert.strictEqual(res.status, 'queued');
    const queue = ctx.taskManager.getQueueSnapshot().queue;
    const task = queue.find(t => t.id === res.taskIds[0]);
    assert.strictEqual(task.skillName, 'navigation');
    assert.deepStrictEqual(task.params.position, { x: 100, y: 64, z: -200 });

    // Execute skill directly with task params
    const navSkill = ctx.loadSkill('navigation');
    const runResult = await navSkill.run(task.params);
    assert.strictEqual(runResult.success, true);
    assert.deepStrictEqual(targetGoal, { x: 100, y: 64, z: -200 });
  });

  await t.test('Named location command resolves waypoint from LocationRegistry', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    // Register a named base
    await ctx.locations.registerBase('base', { x: 500, y: 70, z: -300 });

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'go to base'
    });

    assert.strictEqual(res.status, 'queued');
    const queue = ctx.taskManager.getQueueSnapshot().queue;
    const task = queue.find(t => t.id === res.taskIds[0]);
    assert.strictEqual(task.skillName, 'navigation');
    assert.deepStrictEqual(task.params.position, { x: 500, y: 70, z: -300 });
  });

  await t.test('Return home navigation executes returnHome service method', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    let returnHomeCalled = false;
    ctx.nav.returnHome = async () => {
      returnHomeCalled = true;
      return { success: true };
    };

    const navSkill = ctx.loadSkill('navigation');
    const res = await navSkill.run({ mode: 'go_home' });
    assert.strictEqual(res.success, true);
    assert.strictEqual(returnHomeCalled, true);
  });

  await t.test('Stop command immediately clears pathfinding and cancels movement tasks', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    let stopCalled = false;
    ctx.nav.stop = () => { stopCalled = true; };
    ctx.nav.stopFollowing = () => { stopCalled = true; };

    // Queue a navigation task
    ctx.taskManager.addTask('navigation', { position: { x: 100, y: 64, z: 100 } });
    assert.strictEqual(ctx.taskManager.getQueueSnapshot().queue.length, 1);

    const stopRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'stop'
    });

    assert.strictEqual(stopRes.status, 'success');
    assert.strictEqual(stopCalled, true, 'Navigation stop method called');
    assert.strictEqual(ctx.taskManager.getQueueSnapshot().queue.length, 0, 'Task queue cleared');
  });
});
