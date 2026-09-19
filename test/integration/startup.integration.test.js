const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const BotContext = require('../../src/core/BotContext');
const SkillRegistry = require('../../src/core/SkillRegistry');
const AIBrain = require('../../src/core/AIBrain');

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusIntegrationBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: { x: 100, y: 64, z: -200, floored: () => ({ x: 100, y: 64, z: -200 }) },
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

test('Startup & Dependency Injection Integration Suite', async (t) => {
  await t.test('BotContext wires all domain services, infrastructure, and NLP subsystems', () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    assert.ok(ctx.bot, 'Bot instance is bound');
    assert.ok(ctx.events, 'EventBus is bound');
    assert.ok(ctx.nav, 'NavigationService is wired');
    assert.ok(ctx.locations, 'LocationRegistry is wired');
    assert.ok(ctx.inv, 'InventoryService is wired');
    assert.ok(ctx.tools, 'ToolService is wired');
    assert.ok(ctx.safety, 'SafetyService is wired');
    assert.ok(ctx.combat, 'CombatService is wired');
    assert.ok(ctx.crafting, 'CraftingService is wired');
    assert.ok(ctx.logistics, 'LogisticsService is wired');
    assert.ok(ctx.ambient, 'AmbientBehaviorService is wired');
    assert.ok(ctx.humanoid, 'HumanoidBehaviorService is wired');
    assert.ok(ctx.permissionManager, 'PermissionManager is wired');
    assert.ok(ctx.taskManager, 'TaskManager is wired');
    assert.ok(ctx.nlp, 'NLP IntentParser is wired');
    assert.ok(ctx.commandPlanner, 'CommandPlanner is wired');
    assert.ok(ctx.commandGateway, 'UnifiedCommandGateway is wired');
  });

  await t.test('SkillRegistry resolves and instantiates all 8 core autonomous skills', () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    const expectedSkills = [
      { name: 'mine', className: 'MineSkill' },
      { name: 'farm', className: 'FarmSkill' },
      { name: 'chop_tree', className: 'ChopTreeSkill' },
      { name: 'combat', className: 'CombatSkill' },
      { name: 'craft', className: 'CraftSkill' },
      { name: 'build', className: 'BuildSkill' },
      { name: 'logistics', className: 'LogisticsSkill' },
      { name: 'navigation', className: 'NavigationSkill' }
    ];

    for (const spec of expectedSkills) {
      const skillInstance = ctx.loadSkill(spec.name);
      assert.ok(skillInstance, `Skill '${spec.name}' must instantiate`);
      assert.strictEqual(skillInstance.constructor.name, spec.className, `Constructor name for ${spec.name}`);
      assert.strictEqual(skillInstance.ctx, ctx, `Skill has reference to BotContext`);
    }

    assert.throws(
      () => ctx.loadSkill('nonexistent_skill'),
      /Skill 'nonexistent_skill' is not registered/,
      'Unknown skill throws descriptive error'
    );
  });

  await t.test('BotContext.getStatus() returns accurate telemetry snapshot', () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    const status = ctx.getStatus();
    assert.strictEqual(status.username, 'ArgusIntegrationBot');
    assert.strictEqual(status.health, 20);
    assert.strictEqual(status.food, 20);
    assert.deepStrictEqual(status.position, { x: 100, y: 64, z: -200 });
    assert.strictEqual(status.isMoving, false);
    assert.strictEqual(status.currentTask, 'Idle');
    assert.ok(typeof status.uptime === 'number');
  });

  await t.test('AIBrain coordinates tick cycle and idle state with BotContext', () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const brain = new AIBrain(ctx);

    assert.strictEqual(brain.tickRateMs, 500, 'Initial idle tick is 500ms');
    brain.setTickRate('combat');
    assert.strictEqual(brain.tickRateMs, 50, 'Combat tick is 50ms');
    brain.setTickRate('active');
    assert.strictEqual(brain.tickRateMs, 100, 'Active task tick is 100ms');
    brain.setTickRate('idle');
    assert.strictEqual(brain.tickRateMs, 500, 'Returned to idle tick');
  });
});
