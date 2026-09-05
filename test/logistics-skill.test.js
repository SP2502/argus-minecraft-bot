const test = require('node:test');
const assert = require('node:assert');
const LogisticsSkill = require('../skills/logistics/LogisticsSkill');

test('LogisticsSkill - End-to-End Execution across Modes', async () => {
  let sortCalled = false;
  let restockCalled = false;
  let scanCalled = false;
  let findCalled = false;
  const messagesSent = [];
  const eventsEmitted = [];

  const mockCtx = {
    bot: { health: 20, food: 20 },
    safety: {
      isCritical: () => false
    },
    messageRouter: {
      send: async (msg) => {
        messagesSent.push(msg);
      }
    },
    events: {
      emit: (evt, data) => {
        eventsEmitted.push({ evt, data });
      }
    },
    logistics: {
      sortInventoryToChests: async () => {
        sortCalled = true;
        return { sortedCount: 48, categoriesSorted: ['ores', 'logs'] };
      },
      restockKit: async (kit) => {
        restockCalled = true;
        return {
          kitName: kit,
          restockedItems: [
            { name: 'iron_pickaxe', count: 1 },
            { name: 'torch', count: 32 }
          ]
        };
      },
      scanAndIndexChests: async (radius) => {
        scanCalled = true;
        return { chestsScanned: 3, totalItemsIndexed: 142 };
      },
      findItemInWarehouse: (item) => {
        findCalled = true;
        if (item === 'diamond') {
          return [
            { position: { x: 10, y: 64, z: 10 }, category: 'ores', label: 'gem_chest', count: 32 }
          ];
        }
        return [];
      }
    }
  };

  const skill = new LogisticsSkill(mockCtx);

  // 1. Sort Mode
  const sortRes = await skill.run({ mode: 'sort' });
  assert.strictEqual(sortCalled, true);
  assert.strictEqual(sortRes.mode, 'sort');
  assert.strictEqual(sortRes.sortedCount, 48);
  assert.deepStrictEqual(sortRes.categories, ['ores', 'logs']);

  // 2. Restock Mode
  const restockRes = await skill.run({ mode: 'restock', kit: 'miner' });
  assert.strictEqual(restockCalled, true);
  assert.strictEqual(restockRes.mode, 'restock');
  assert.strictEqual(restockRes.kitName, 'miner');
  assert.strictEqual(restockRes.restockedItems.length, 2);

  // 3. Index Mode
  const indexRes = await skill.run({ mode: 'index', radius: 30 });
  assert.strictEqual(scanCalled, true);
  assert.strictEqual(indexRes.mode, 'index');
  assert.strictEqual(indexRes.chestsScanned, 3);
  assert.strictEqual(indexRes.totalItemsIndexed, 142);

  // 4. Locate Mode
  const locateRes = await skill.run({ mode: 'locate', item: 'diamond' });
  assert.strictEqual(findCalled, true);
  assert.strictEqual(locateRes.mode, 'locate');
  assert.strictEqual(locateRes.matches.length, 1);
  assert.strictEqual(locateRes.matches[0].count, 32);

  // Verify events
  const startEvents = eventsEmitted.filter((e) => e.evt === 'logistics.started');
  const completeEvents = eventsEmitted.filter((e) => e.evt === 'logistics.completed');
  assert.strictEqual(startEvents.length, 4);
  assert.strictEqual(completeEvents.length, 4);

  // 5. Unsupported mode throws Error
  await assert.rejects(
    async () => {
      await skill.run({ mode: 'invalid_mode' });
    },
    { message: /Unsupported mode/ }
  );
});
