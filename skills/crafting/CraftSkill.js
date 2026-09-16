const { BaseSkill } = require('../BaseSkill');
const craftingData = require('./craftingData');
const eventBus = require('../../src/core/EventBus');

/**
 * CraftSkill - Autonomous task handler for crafting items and furnace smelting.
 * Reuses CraftingService, NavigationService, InventoryService, and SafetyService.
 */
class CraftSkill extends BaseSkill {
  /**
   * @param {import('../../core/BotContext')} ctx - BotContext dependency container
   */
  constructor(ctx) {
    super(ctx);
    this.name = 'craft';
  }

  /**
   * Executes crafting or smelting tasks.
   * 
   * @param {Object} [params={}]
   * @param {'craft'|'smelt'} [params.mode='craft'] - Operation mode
   * @param {string} [params.item='torch'] - Target item name
   * @param {number} [params.quantity=1] - Quantity to produce
   * @param {string} [params.fuel=null] - Preferred fuel item
   * @param {Object} taskContext - TaskManager context
   * @returns {Promise<{itemsProduced: number, item: string, mode: string}>}
   */
  async run(params = {}, taskContext) {
    const mode = params.mode || (params.smelt ? 'smelt' : 'craft');
    const rawItem = params.item || params.targetItem || 'torch';
    const canonicalItem = craftingData.aliases[rawItem.toLowerCase()] || rawItem.toLowerCase().replace(/\s+/g, '_');
    const quantity = params.quantity !== undefined ? params.quantity : 1;

    await this.safetyCheckLoop(taskContext);
    const startTime = Date.now();

    eventBus.emit('crafting.started', { mode, item: canonicalItem, quantity });
    this.ctx.messageRouter.send(3, `Starting [${mode.toUpperCase()}]: ${quantity}x ${canonicalItem}.`);

    let itemsProduced = 0;

    if (mode === 'smelt') {
      const smeltResult = await this.ctx.crafting.smelt(canonicalItem, quantity, params.fuel);
      itemsProduced = smeltResult.smeltedCount;
      eventBus.emit('smelting.item_smelted', { input: canonicalItem, output: smeltResult.outputItem, count: itemsProduced });
    } else {
      // Craft Mode
      const craftSuccess = await this.ctx.crafting.craft(canonicalItem, quantity);
      if (!craftSuccess) {
        throw new Error(`Failed to craft ${quantity}x ${canonicalItem}: missing prerequisite resources.`);
      }
      itemsProduced = quantity;
      eventBus.emit('crafting.item_crafted', { item: canonicalItem, count: itemsProduced });
    }

    const durationMs = Date.now() - startTime;
    const result = { itemsProduced, item: canonicalItem, mode, durationMs };

    eventBus.emit('crafting.completed', result);
    this.ctx.messageRouter.send(3, `Finished [${mode.toUpperCase()}]: ${itemsProduced}x ${canonicalItem} ready.`);

    return result;
  }
}

module.exports = CraftSkill;
