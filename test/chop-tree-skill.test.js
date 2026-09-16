const test = require('node:test');
const assert = require('node:assert');
const { ChopTreeSkill } = require('../src/modules/forestry');

test('ChopTreeSkill - Autonomous Harvesting, Service Reuse, and Replanting', async () => {
  let depositCalled = false;
  let chestTarget = null;
  let axeEquipped = false;
  let placedSapling = false;
  const digPositions = [];

  const mockBlocks = {
    '0,63,0': { name: 'grass_block', boundingBox: 'block' },
    '0,64,0': { name: 'oak_log', name_: 'oak_log', boundingBox: 'block', position: { x: 0, y: 64, z: 0 } },
    '0,65,0': { name: 'oak_log', name_: 'oak_log', boundingBox: 'block', position: { x: 0, y: 65, z: 0 } },
    '0,66,0': { name: 'oak_log', name_: 'oak_log', boundingBox: 'block', position: { x: 0, y: 66, z: 0 } },
    '0,67,0': { name: 'oak_leaves', boundingBox: 'empty' },
    '1,64,0': { name: 'air', boundingBox: 'empty' },
    '1,65,0': { name: 'air', boundingBox: 'empty' },
    '1,63,0': { name: 'dirt', boundingBox: 'block' }
  };

  const mockBot = {
    game: { dimension: 'overworld' },
    entity: { position: { x: 2, y: 64, z: 2 } },
    heldItem: { name: 'iron_axe', durability: 100 },
    blockAt: (pos) => mockBlocks[`${pos.x},${pos.y},${pos.z}`] || { name: 'air', boundingBox: 'empty' },
    dig: async (block) => {
      digPositions.push({ x: block.position.x, y: block.position.y, z: block.position.z });
      mockBlocks[`${block.position.x},${block.position.y},${block.position.z}`] = { name: 'air', boundingBox: 'empty' };
    },
    placeBlock: async (refBlock, face) => {
      placedSapling = true;
    }
  };

  let inventoryFull = false;

  const mockCtx = {
    bot: mockBot,
    nav: {
      goTo: async (pos, options) => true
    },
    target: {
      findAllInRadius: async () => [mockBlocks['0,64,0']]
    },
    tools: {
      equipBest: async (type) => {
        if (type === 'axe') axeEquipped = true;
        return true;
      },
      isAboutToBreak: () => false
    },
    safety: {
      shouldRetreat: () => false,
      isCritical: () => false
    },
    inv: {
      isFull: () => inventoryFull,
      findItem: (name) => ({ name, count: 5 }),
      equip: async () => true,
      depositAll: async (category, chest) => {
        depositCalled = true;
        chestTarget = chest;
      },
      dropLowValueItems: async () => {}
    },
    locations: {
      listByType: async () => [],
      findNearestChest: async () => ({ x: 10, y: 64, z: 10 })
    },
    messageRouter: {
      send: () => {}
    }
  };

  const skill = new ChopTreeSkill(mockCtx);
  const result = await skill.run({
    treeType: 'oak',
    quantity: 3,
    replant: true
  }, { isCancelled: () => false, isSuspended: () => false });

  assert.strictEqual(axeEquipped, true);
  assert.strictEqual(result.logsCollected, 3);
  assert.strictEqual(result.treesCut, 1);
  assert.strictEqual(result.saplingsPlanted, 1);
  assert.strictEqual(placedSapling, true);

  // Top-down cutting: 66, 65, 64
  assert.strictEqual(digPositions[0].y, 66);
  assert.strictEqual(digPositions[1].y, 65);
  assert.strictEqual(digPositions[2].y, 64);
});
