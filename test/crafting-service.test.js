const test = require('node:test');
const assert = require('node:assert');
const CraftingService = require('../services/CraftingService');

test('CraftingService - Ingredient Checking and Direct Crafting', async () => {
  const inventoryItems = [
    { name: 'oak_log', count: 2 },
    { name: 'coal', count: 4 },
    { name: 'stick', count: 4 }
  ];

  const mockBot = {
    inventory: {
      items: () => inventoryItems
    }
  };

  const service = new CraftingService(mockBot);

  // 1. Can craft planks from logs
  assert.strictEqual(service.canCraft('oak_planks', 4), true);
  assert.strictEqual(service.canCraft('torch', 4), true);
  // Cannot craft diamond pickaxe without diamonds
  assert.strictEqual(service.canCraft('diamond_pickaxe', 1), false);

  // 2. Direct 2x2 Craft: 1 log -> 4 planks
  const craftPlanks = await service.craft('oak_planks', 4);
  assert.strictEqual(craftPlanks, true);
  const planksItem = inventoryItems.find((i) => i.name === 'oak_planks');
  assert.ok(planksItem !== undefined);
  assert.strictEqual(planksItem.count, 4);

  // Log count should be reduced by 1
  const logItem = inventoryItems.find((i) => i.name === 'oak_log');
  assert.strictEqual(logItem.count, 1);
});

test('CraftingService - Recursive Dependency Crafting (autoCraftMissing)', async () => {
  // Start with ONLY 2 oak logs and 3 cobblestone
  const inventoryItems = [
    { name: 'oak_log', count: 2 },
    { name: 'cobblestone', count: 3 }
  ];

  const mockBot = {
    inventory: {
      items: () => inventoryItems
    }
  };

  const mockCtx = {
    target: {
      findNearestBlock: () => ({ name: 'crafting_table', position: { x: 1, y: 64, z: 0 } })
    }
  };

  const service = new CraftingService(mockBot, mockCtx);

  // Need a stone pickaxe: requires 3 cobblestone + 2 sticks
  // Sticks require planks, planks require oak_log!
  assert.strictEqual(service.canCraft('stone_pickaxe', 1), false);

  const autoCraftResult = await service.autoCraftMissing('stone_pickaxe', 1);
  assert.strictEqual(autoCraftResult, true);

  // Stone pickaxe should now be in inventory
  const pickaxe = inventoryItems.find((i) => i.name === 'stone_pickaxe');
  assert.ok(pickaxe !== undefined);
  assert.strictEqual(pickaxe.count, 1);
});

test('CraftingService - Furnace Smelting Simulation', async () => {
  const inventoryItems = [
    { name: 'raw_iron', count: 4 },
    { name: 'coal', count: 2 }
  ];

  const mockFurnaceBlock = {
    name: 'furnace',
    position: { x: 5, y: 64, z: 0 }
  };

  const mockBot = {
    inventory: {
      items: () => inventoryItems
    }
  };

  const mockCtx = {
    nav: { goTo: async () => true },
    target: {
      findNearestBlock: () => mockFurnaceBlock
    }
  };

  const service = new CraftingService(mockBot, mockCtx);
  const result = await service.smelt('raw_iron', 4, 'coal');

  assert.strictEqual(result.smeltedCount, 4);
  assert.strictEqual(result.outputItem, 'iron_ingot');

  const ironIngot = inventoryItems.find((i) => i.name === 'iron_ingot');
  assert.ok(ironIngot !== undefined);
  assert.strictEqual(ironIngot.count, 4);
});
