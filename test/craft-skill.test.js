const test = require('node:test');
const assert = require('node:assert');
const { CraftSkill } = require('../src/modules/inventory');

test('CraftSkill - Crafting and Smelting Execution Modes', async () => {
  let craftCalled = false;
  let smeltCalled = false;
  let messageSent = false;

  const mockCtx = {
    bot: { health: 20, food: 20 },
    crafting: {
      craft: async (item, quantity) => {
        craftCalled = true;
        return true;
      },
      smelt: async (item, quantity, fuel) => {
        smeltCalled = true;
        return { smeltedCount: quantity, outputItem: 'iron_ingot' };
      }
    },
    safety: {
      isCritical: () => false,
      shouldRetreat: () => false
    },
    messageRouter: {
      send: () => {
        messageSent = true;
      }
    }
  };

  const skill = new CraftSkill(mockCtx);

  // 1. Craft Mode
  const craftResult = await skill.run({
    mode: 'craft',
    item: 'torch',
    quantity: 16
  }, { isCancelled: () => false, isSuspended: () => false });

  assert.strictEqual(craftCalled, true);
  assert.strictEqual(craftResult.itemsProduced, 16);
  assert.strictEqual(craftResult.item, 'torch');

  // 2. Smelt Mode
  const smeltResult = await skill.run({
    mode: 'smelt',
    item: 'raw_iron',
    quantity: 8,
    fuel: 'coal'
  }, { isCancelled: () => false, isSuspended: () => false });

  assert.strictEqual(smeltCalled, true);
  assert.strictEqual(smeltResult.itemsProduced, 8);
  assert.strictEqual(smeltResult.mode, 'smelt');
  assert.strictEqual(messageSent, true);
});
