const test = require('node:test');
const assert = require('node:assert');
const { LogisticsService } = require('../../../src/modules/logistics');

test('LogisticsService - Scan and Index Containers in Warehouse', async () => {
  const chestPos = { x: 10, y: 64, z: 10 };
  const chestContents = [
    { name: 'diamond', type: 264, count: 32 },
    { name: 'iron_ingot', type: 265, count: 64 }
  ];

  const mockChestWindow = {
    containerItems: () => chestContents,
    close: () => {}
  };

  const mockBot = {
    entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } },
    blockAt: (pos) => {
      if (pos.x === 10 && pos.y === 64 && pos.z === 10) {
        return { name: 'chest', position: { x: 10, y: 64, z: 10, offset: () => ({ x: 10.5, y: 64.5, z: 10.5 }) } };
      }
      return null;
    },
    lookAt: async () => {},
    openContainer: async () => mockChestWindow
  };

  const mockCtx = {
    target: {
      findNearestBlock: (names) => {
        if (names.includes('chest')) {
          return { name: 'chest', position: { x: 10, y: 64, z: 10 } };
        }
        return null;
      }
    },
    nav: {
      goTo: async () => true
    },
    events: {
      emit: () => {}
    }
  };

  const service = new LogisticsService(mockBot, mockCtx);
  const scanResult = await service.scanAndIndexChests(24);

  assert.strictEqual(scanResult.chestsScanned, 1);
  assert.strictEqual(scanResult.totalItemsIndexed, 96);
  assert.strictEqual(service.warehouseIndex.size, 1);

  const indexed = service.warehouseIndex.get('10,64,10');
  assert.ok(indexed);
  assert.strictEqual(indexed.category, 'ores');
  assert.strictEqual(indexed.contents.length, 2);
});

test('LogisticsService - Spatial Item Search across Indexed Warehouse', async () => {
  const service = new LogisticsService(null, null);

  // Pre-populate index
  service.warehouseIndex.set('10,64,10', {
    position: { x: 10, y: 64, z: 10 },
    category: 'ores',
    label: 'main_ores',
    contents: [
      { name: 'diamond', count: 32 },
      { name: 'gold_ingot', count: 16 }
    ]
  });

  service.warehouseIndex.set('20,64,10', {
    position: { x: 20, y: 64, z: 10 },
    category: 'ores',
    label: 'backup_ores',
    contents: [
      { name: 'diamond', count: 64 }
    ]
  });

  // 1. Search for diamond: should return 2 chests sorted descending by count
  const diamondResults = service.findItemInWarehouse('diamond');
  assert.strictEqual(diamondResults.length, 2);
  assert.strictEqual(diamondResults[0].count, 64);
  assert.strictEqual(diamondResults[0].label, 'backup_ores');
  assert.strictEqual(diamondResults[1].count, 32);

  // 2. Search for gold_ingot: 1 chest
  const goldResults = service.findItemInWarehouse('gold_ingot');
  assert.strictEqual(goldResults.length, 1);
  assert.strictEqual(goldResults[0].count, 16);

  // 3. Search for nonexistent item: empty array
  const netheriteResults = service.findItemInWarehouse('netherite_ingot');
  assert.strictEqual(netheriteResults.length, 0);
});

test('LogisticsService - Category Lookup and Fallback', () => {
  const service = new LogisticsService(null, null);

  service.warehouseIndex.set('5,64,5', {
    position: { x: 5, y: 64, z: 5 },
    category: 'crops',
    label: 'farm_produce',
    contents: []
  });

  service.warehouseIndex.set('15,64,15', {
    position: { x: 15, y: 64, z: 15 },
    category: 'general',
    label: 'dump_chest',
    contents: []
  });

  // Direct category match
  const cropChest = service.getChestForCategory('crops');
  assert.ok(cropChest);
  assert.strictEqual(cropChest.category, 'crops');

  // Alias lookup ('food' maps to 'crops' or 'food')
  const foodChest = service.getChestForCategory('food');
  assert.ok(foodChest);

  // Missing category falls back to 'general'
  const blockChest = service.getChestForCategory('blocks');
  assert.ok(blockChest);
  assert.strictEqual(blockChest.category, 'general');
});

test('LogisticsService - Sort Inventory into Warehouse Chests', async () => {
  const inventoryItems = [
    { name: 'raw_iron', type: 100, count: 16 },
    { name: 'oak_log', type: 101, count: 32 },
    { name: 'diamond_sword', type: 102, count: 1 } // Protected weapon
  ];

  const deposited = [];

  const mockChestWindow = {
    deposit: async (type, meta, count) => {
      deposited.push({ type, count });
    },
    containerItems: () => [],
    close: () => {}
  };

  const mockBot = {
    inventory: {
      items: () => inventoryItems
    },
    blockAt: () => ({ name: 'chest', position: { x: 10, y: 64, z: 10, offset: () => ({ x: 10.5, y: 64.5, z: 10.5 }) } }),
    lookAt: async () => {},
    openContainer: async () => mockChestWindow
  };

  const mockCtx = {
    nav: { goTo: async () => true },
    events: { emit: () => {} }
  };

  const service = new LogisticsService(mockBot, mockCtx);

  // Setup known chests
  service.warehouseIndex.set('10,64,10', {
    position: { x: 10, y: 64, z: 10 },
    category: 'ores',
    label: 'ore_chest',
    contents: []
  });
  service.warehouseIndex.set('20,64,20', {
    position: { x: 20, y: 64, z: 20 },
    category: 'logs',
    label: 'wood_chest',
    contents: []
  });

  const result = await service.sortInventoryToChests(['diamond_sword']);

  // raw_iron (16) + oak_log (32) = 48 items sorted. diamond_sword preserved.
  assert.strictEqual(result.sortedCount, 48);
  assert.ok(result.categoriesSorted.includes('ores'));
  assert.ok(result.categoriesSorted.includes('logs'));
  assert.strictEqual(deposited.length, 2);
});

test('LogisticsService - Restock Kit Profiles', async () => {
  const botItems = [
    { name: 'bread', count: 5 } // Has 5 bread, needs 16
  ];

  const chestContents = [
    { name: 'iron_pickaxe', type: 200, count: 2 },
    { name: 'torch', type: 201, count: 64 },
    { name: 'bread', type: 202, count: 32 }
  ];

  const withdrawn = [];

  const mockChestWindow = {
    withdraw: async (type, meta, count) => {
      withdrawn.push({ type, count });
      const item = chestContents.find((c) => c.type === type);
      if (item) item.count -= count;
    },
    containerItems: () => chestContents,
    close: () => {}
  };

  const mockBot = {
    inventory: {
      items: () => botItems
    },
    blockAt: () => ({ name: 'chest', position: { x: 5, y: 64, z: 5, offset: () => ({ x: 5.5, y: 64.5, z: 5.5 }) } }),
    lookAt: async () => {},
    openContainer: async () => mockChestWindow
  };

  const mockCtx = {
    nav: { goTo: async () => true },
    events: { emit: () => {} }
  };

  const service = new LogisticsService(mockBot, mockCtx);
  service.warehouseIndex.set('5,64,5', {
    position: { x: 5, y: 64, z: 5 },
    category: 'tools',
    label: 'equipment_chest',
    contents: chestContents
  });

  const result = await service.restockKit('miner');

  assert.strictEqual(result.kitName, 'miner');
  assert.ok(result.restockedItems.length >= 2);

  // Check pickaxe restocked (miner kit needs 2)
  const pickaxeRestock = result.restockedItems.find((i) => i.name === 'iron_pickaxe');
  assert.ok(pickaxeRestock);
  assert.strictEqual(pickaxeRestock.count, 2);

  // Check torches restocked (miner kit needs 64)
  const torchRestock = result.restockedItems.find((i) => i.name === 'torch');
  assert.ok(torchRestock);
  assert.strictEqual(torchRestock.count, 64);

  // Check food restocked (needed 16 - 5 = 11 bread)
  const breadRestock = result.restockedItems.find((i) => i.name === 'bread');
  assert.ok(breadRestock);
  assert.strictEqual(breadRestock.count, 11);
});

test('LogisticsService - Designate Chest Category and Label', async () => {
  const service = new LogisticsService(null, null);

  const designated = await service.designateChest({ x: 30, y: 64, z: 30 }, 'ores', 'diamond_vault');
  assert.strictEqual(designated.category, 'ores');
  assert.strictEqual(designated.label, 'diamond_vault');

  const indexed = service.warehouseIndex.get('30,64,30');
  assert.ok(indexed);
  assert.strictEqual(indexed.label, 'diamond_vault');
});
