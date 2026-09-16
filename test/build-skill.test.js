const test = require('node:test');
const assert = require('node:assert');
const { BuildSkill } = require('../src/modules/building');
const { SkillAbort } = require('../skills/BaseSkill');

test('BuildSkill - Autonomous Structure Construction and Event Emission', async () => {
  const inventoryItems = [
    { name: 'cobblestone', count: 64 },
    { name: 'dirt', count: 64 }
  ];

  const eventsEmitted = [];

  const worldBlocks = new Map();

  const mockBot = {
    entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } },
    inventory: {
      items: () => inventoryItems
    },
    blockAt: (pos) => {
      const key = `${pos.x},${pos.y},${pos.z}`;
      if (worldBlocks.has(key)) {
        return { name: worldBlocks.get(key), boundingBox: 'block', position: pos };
      }
      // Ground is solid at y=63
      if (pos.y <= 63) {
        return { name: 'dirt', boundingBox: 'block', position: pos };
      }
      return { name: 'air', position: pos };
    },
    equip: async () => {},
    placeBlock: async (refBlock, faceVector) => {
      const rx = refBlock && refBlock.position ? refBlock.position.x : 0;
      const ry = refBlock && refBlock.position ? refBlock.position.y : 63;
      const rz = refBlock && refBlock.position ? refBlock.position.z : 0;
      const targetPos = { x: rx + faceVector.x, y: ry + faceVector.y, z: rz + faceVector.z };
      worldBlocks.set(`${targetPos.x},${targetPos.y},${targetPos.z}`, 'cobblestone');
      return true;
    },
    dig: async () => {}
  };

  const mockCtx = {
    bot: mockBot,
    nav: {
      goTo: async () => true
    },
    tools: {
      equipBest: async () => true
    },
    safety: {
      isCritical: () => false,
      shouldRetreat: () => false
    },
    events: {
      emit: (eventName, data) => {
        eventsEmitted.push({ eventName, data });
      }
    },
    messageRouter: {
      send: async () => {}
    }
  };

  const buildSkill = new BuildSkill(mockCtx);

  // Build a 4-step staircase
  const result = await buildSkill.run({
    structure: 'stairs',
    material: 'cobblestone',
    dimensions: { height: 4 }
  });

  assert.strictEqual(result.structure, 'stairs');
  assert.strictEqual(result.material, 'cobblestone');
  assert.strictEqual(result.blocksPlaced, 10); // 1 + 2 + 3 + 4 = 10 blocks

  // Check events emitted
  assert.ok(eventsEmitted.some((e) => e.eventName === 'building.started'));
  assert.ok(eventsEmitted.some((e) => e.eventName === 'building.block_placed'));
  assert.ok(eventsEmitted.some((e) => e.eventName === 'building.completed'));
});

test('BuildSkill - Prerequisite Material Auto-Crafting', async () => {
  const inventoryItems = [
    { name: 'oak_log', count: 10 }
  ];

  let autoCraftCalled = false;

  const mockBot = {
    entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } },
    inventory: {
      items: () => inventoryItems
    },
    blockAt: () => ({ name: 'dirt', boundingBox: 'block' }),
    equip: async () => {},
    placeBlock: async () => true
  };

  const mockCtx = {
    bot: mockBot,
    nav: { goTo: async () => true },
    tools: { equipBest: async () => true },
    safety: { isCritical: () => false },
    events: { emit: () => {} },
    messageRouter: { send: async () => {} },
    crafting: {
      autoCraftMissing: async (itemName, count) => {
        if (itemName === 'oak_planks') {
          autoCraftCalled = true;
          inventoryItems.push({ name: 'oak_planks', count: 32 });
          return true;
        }
        return false;
      }
    }
  };

  const buildSkill = new BuildSkill(mockCtx);

  // 4x4 floor requires 16 oak_planks, which bot does not have initially
  const result = await buildSkill.run({
    structure: 'floor',
    material: 'oak_planks',
    dimensions: { width: 4, depth: 4 }
  });

  assert.strictEqual(autoCraftCalled, true);
  assert.strictEqual(result.blocksPlaced, 16);
});

test('BuildSkill - Safety Preemption Abort on Critical Danger', async () => {
  const inventoryItems = [{ name: 'cobblestone', count: 64 }];

  const mockBot = {
    entity: { position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) } },
    inventory: { items: () => inventoryItems },
    blockAt: () => ({ name: 'dirt', boundingBox: 'block' })
  };

  const mockCtx = {
    bot: mockBot,
    nav: { goTo: async () => true },
    safety: {
      isCritical: () => true // Bot is in critical danger
    },
    events: { emit: () => {} }
  };

  const buildSkill = new BuildSkill(mockCtx);

  await assert.rejects(
    async () => {
      await buildSkill.run({ structure: 'shelter' });
    },
    SkillAbort
  );
});
