const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const BotContext = require('../../src/core/BotContext');

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusInvBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) }
  };

  let mockInventoryItems = [];
  bot.inventory = {
    items: () => mockInventoryItems,
    slots: new Array(45).fill(null)
  };
  bot.setInventory = (items) => {
    mockInventoryItems = items;
  };
  bot.toss = async (type, metadata, count) => {
    mockInventoryItems = mockInventoryItems.filter(i => i.type !== type);
  };
  bot.moveSlotItem = async (fromSlot, toSlot) => {
    // Simulated move
  };
  bot.loadPlugin = () => {};
  bot.pathfinder = {
    setGoal: () => {},
    setMovements: () => {},
    stop: () => {}
  };
  return bot;
}

test('Inventory Subsystem & Invariant Integration Suite', async (t) => {
  await t.test('Hotbar slot reservations organize water bucket into slot 6 (window slot 42)', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    const moves = [];
    bot.moveSlotItem = async (from, to) => {
      moves.push({ from, to });
    };

    bot.setInventory([
      { name: 'water_bucket', slot: 15, count: 1 }
    ]);

    await ctx.inv.organizeHotbar();
    const waterMove = moves.find(m => m.from === 15 && m.to === 42);
    assert.ok(waterMove, 'Water bucket moved to window slot 42 (hotbar slot 6)');
  });

  await t.test('16-Seed Reserve Invariant: dropLowValueItems strictly preserves at least 16 seeds', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    const tossed = [];
    bot.toss = async (type, metadata, count) => {
      tossed.push({ type, count });
      bot.setInventory(bot.inventory.items().filter(i => i.type !== type));
    };

    // 1. Exactly 16 seeds + dirt. keepReserveSlots = 36 (target 0 used)
    bot.setInventory([
      { name: 'wheat_seeds', type: 101, count: 16 },
      { name: 'dirt', type: 102, count: 10 }
    ]);
    await ctx.inv.dropLowValueItems({}, 36);
    const seedTossed1 = tossed.find(t => t.type === 101);
    assert.strictEqual(seedTossed1, undefined, 'Must not toss any seeds when count is at or below 16');
    const dirtTossed = tossed.find(t => t.type === 102);
    assert.ok(dirtTossed, 'Dirt was tossed');

    // 2. 24 seeds + dirt. keepReserveSlots = 36
    tossed.length = 0;
    bot.setInventory([
      { name: 'wheat_seeds', type: 101, count: 24 },
      { name: 'dirt', type: 102, count: 10 }
    ]);
    await ctx.inv.dropLowValueItems({}, 36);
    const seedTossed2 = tossed.find(t => t.type === 101);
    assert.ok(seedTossed2, 'Should toss excess seeds');
    assert.strictEqual(seedTossed2.count, 8, 'Tossed exactly 8 to preserve 16-seed reserve');
  });

  await t.test('Protected tools and defensive items are immune to bulk item discards', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    const tossed = [];
    bot.toss = async (type, metadata, count) => {
      tossed.push({ type, count });
    };

    bot.setInventory([
      { name: 'diamond_sword', type: 201, count: 1 },
      { name: 'diamond_pickaxe', type: 202, count: 1 },
      { name: 'water_bucket', type: 203, count: 1 },
      { name: 'shield', type: 204, count: 1 },
      { name: 'totem_of_undying', type: 205, count: 1 }
    ]);

    await ctx.inv.dropLowValueItems({}, 36);
    assert.strictEqual(tossed.length, 0, 'No protected tools or survival items were discarded');
  });

  await t.test('Capacity monitoring accurately flags full inventory at threshold', () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);

    // Empty
    bot.setInventory([]);
    assert.strictEqual(ctx.inv.isFull(0.9), false);
    assert.strictEqual(ctx.inv.getStatus().usedSlots, 0);

    // 33 out of 36 slots filled (> 90%)
    const filledSlots = [];
    for (let i = 0; i < 33; i++) {
      filledSlots.push({ name: 'cobblestone', count: 64, slot: i });
    }
    bot.setInventory(filledSlots);

    assert.strictEqual(ctx.inv.isFull(0.9), true, 'Flagged full above 90% threshold');
    assert.strictEqual(ctx.inv.getStatus().usedSlots, 33);
  });

  await t.test('Show inventory command through gateway returns accurate slot telemetry', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const ownerName = 'TestOwner';
    ctx.permissionManager.ownerUsername = ownerName;

    bot.setInventory([
      { name: 'iron_ingot', count: 12, slot: 0 },
      { name: 'bread', count: 64, slot: 1 }
    ]);

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: ownerName,
      message: 'show inventory'
    });

    assert.strictEqual(res.status, 'info');
    assert.ok(res.message.includes('Inventory: 2/36 slots used'));
  });
});
