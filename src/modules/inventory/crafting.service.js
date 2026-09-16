const craftingData = require('./crafting.data');
const craftingConfig = require('./crafting.config');

/**
 * CraftingService - Autonomous recipe tree resolution, crafting table management, and furnace smelting.
 * Reusable by ToolService, MineSkill, ChopTreeSkill, and CraftSkill.
 */
class CraftingService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
  }

  /**
   * Checks whether the bot has all prerequisite ingredients in inventory to craft the item.
   * 
   * @param {string} itemName - Target item identifier
   * @param {number} [count=1] - Multiplier
   * @returns {boolean}
   */
  canCraft(itemName, count = 1) {
    if (!this.bot || !this.bot.inventory || !itemName) return false;
    const recipe = craftingData.recipes[itemName];
    if (!recipe) return false;

    const batchesNeeded = Math.ceil(count / recipe.resultCount);

    for (const ing of recipe.ingredients) {
      const needed = ing.count * batchesNeeded;
      const current = this._countItem(ing.name);
      if (current < needed) {
        return false;
      }
    }

    return true;
  }

  /**
   * Crafts a specified quantity of an item using available inventory or nearby crafting table.
   * 
   * @param {string} itemName - Target item name
   * @param {number} [quantity=1] - Number of items to craft
   * @returns {Promise<boolean>} True if crafting succeeded
   */
  async craft(itemName, quantity = 1) {
    if (!this.bot || !itemName) return false;
    const recipe = craftingData.recipes[itemName];
    if (!recipe) {
      console.warn(`[CraftingService] No recipe registered for '${itemName}'`);
      return false;
    }

    // Ensure ingredients exist
    if (!this.canCraft(itemName, quantity)) {
      const autoResolved = await this.autoCraftMissing(itemName, quantity);
      if (!autoResolved) return false;
    }

    const batchesNeeded = Math.ceil(quantity / recipe.resultCount);
    let craftingTableBlock = null;

    // Table required?
    if (recipe.requiresTable) {
      craftingTableBlock = await this._ensureCraftingTable();
      if (!craftingTableBlock) {
        console.warn('[CraftingService] Crafting table required but none available');
        return false;
      }
    }

    try {
      // If Mineflayer recipes API is available
      if (typeof this.bot.recipesFor === 'function' && typeof this.bot.craft === 'function') {
        const itemDef = this.bot.registry ? this.bot.registry.itemsByName[itemName] : null;
        if (itemDef) {
          const mcRecipes = this.bot.recipesFor(itemDef.id, null, 1, craftingTableBlock);
          if (mcRecipes && mcRecipes.length > 0) {
            await this.bot.craft(mcRecipes[0], batchesNeeded, craftingTableBlock);
            return true;
          }
        }
      }

      // Mock / fallback simulated inventory craft
      for (const ing of recipe.ingredients) {
        this._consumeItem(ing.name, ing.count * batchesNeeded);
      }
      this._addItem(itemName, recipe.resultCount * batchesNeeded);
      return true;
    } catch (err) {
      console.warn(`[CraftingService] Crafting '${itemName}' failed:`, err.message);
      return false;
    }
  }

  /**
   * Recursively crafts prerequisite materials (e.g. logs -> planks -> sticks -> pickaxe).
   * 
   * @param {string} itemName - Target item name
   * @param {number} [quantity=1] - Desired count
   * @param {number} [depth=0] - Recursion limiter
   * @returns {Promise<boolean>} True if all prerequisites were resolved
   */
  async autoCraftMissing(itemName, quantity = 1, depth = 0) {
    if (depth > craftingConfig.MAX_RECURSIVE_CRAFT_DEPTH) {
      console.warn(`[CraftingService] Reached max recursion depth (${craftingConfig.MAX_RECURSIVE_CRAFT_DEPTH}) resolving ${itemName}`);
      return false;
    }

    const recipe = craftingData.recipes[itemName];
    if (!recipe) return false;

    const batchesNeeded = Math.ceil(quantity / recipe.resultCount);

    for (const ing of recipe.ingredients) {
      const needed = ing.count * batchesNeeded;
      const current = this._countItem(ing.name);

      if (current < needed) {
        const missing = needed - current;
        // Check if ingredient has a sub-recipe
        if (craftingData.recipes[ing.name]) {
          const subCraftSuccess = await this.autoCraftMissing(ing.name, missing, depth + 1);
          if (!subCraftSuccess) return false;
        } else {
          // Uncraftable raw prerequisite missing (e.g. iron_ingot or cobblestone or diamond)
          return false;
        }
      }
    }

    // Now that ingredients are crafted, craft current step
    return this.craft(itemName, quantity);
  }

  /**
   * Smelts input items in a furnace with automatic fuel selection.
   * 
   * @param {string} inputItem - Item to smelt (e.g. 'raw_iron', 'beef')
   * @param {number} [quantity=1] - Quantity to smelt
   * @param {string} [preferredFuel=null] - Optional preferred fuel
   * @returns {Promise<{smeltedCount: number, outputItem: string}>}
   */
  async smelt(inputItem, quantity = 1, preferredFuel = null) {
    const smeltRecipe = craftingData.smeltableRecipes[inputItem];
    if (!smeltRecipe) {
      throw new Error(`Item '${inputItem}' is not smeltable.`);
    }

    const availableInput = this._countItem(inputItem);
    const countToSmelt = Math.min(quantity, availableInput);
    if (countToSmelt <= 0) {
      throw new Error(`No '${inputItem}' available in inventory to smelt.`);
    }

    // Find furnace
    const furnaceBlock = await this._ensureFurnace();
    if (!furnaceBlock) {
      throw new Error('No furnace available nearby.');
    }

    // Choose fuel
    const fuelItem = preferredFuel || this._selectBestFuel(countToSmelt);
    if (!fuelItem) {
      throw new Error('No furnace fuel available in inventory.');
    }

    if (this.ctx && this.ctx.nav) {
      await this.ctx.nav.goTo(furnaceBlock.position, { range: 2, allowBreak: false });
    }

    try {
      if (typeof this.bot.openFurnace === 'function') {
        const furnace = await this.bot.openFurnace(furnaceBlock);
        const itemDef = this.bot.registry ? this.bot.registry.itemsByName[inputItem] : null;
        const fuelDef = this.bot.registry ? this.bot.registry.itemsByName[fuelItem] : null;

        if (itemDef && fuelDef) {
          await furnace.putInput(itemDef.id, null, countToSmelt);
          await furnace.putFuel(fuelDef.id, null, Math.ceil(countToSmelt / (craftingData.fuelRatings[fuelItem] || 8)));

          // Wait for smelting completion
          const waitTime = countToSmelt * 10000;
          await new Promise((r) => setTimeout(r, Math.min(waitTime, craftingConfig.MAX_SMELT_WAIT_MS)));
          await furnace.takeOutput();
          furnace.close();
        }
      } else {
        // Mock fallback simulation
        this._consumeItem(inputItem, countToSmelt);
        this._consumeItem(fuelItem, 1);
        this._addItem(smeltRecipe.output, countToSmelt);
      }

      return { smeltedCount: countToSmelt, outputItem: smeltRecipe.output };
    } catch (err) {
      console.warn('[CraftingService] Smelting failed:', err.message);
      throw err;
    }
  }

  /**
   * Helper to find or place a nearby crafting table.
   * @private
   */
  async _ensureCraftingTable() {
    // 1. Check for nearby existing crafting table block
    if (this.ctx && this.ctx.target) {
      const nearbyTable = this.ctx.target.findNearestBlock(['crafting_table'], craftingConfig.CRAFTING_TABLE_SEARCH_RADIUS);
      if (nearbyTable) return nearbyTable;
    }

    // 2. Check if bot has crafting table in inventory to place
    const tableItem = this._findItem('crafting_table');
    if (!tableItem) {
      // Craft a crafting table if possible
      const crafted = await this.autoCraftMissing('crafting_table', 1);
      if (!crafted) return null;
    }

    // 3. Place crafting table adjacent to bot
    if (this.bot.entity && typeof this.bot.placeBlock === 'function') {
      const groundPos = this.bot.entity.position.offset(1, -1, 0).floored();
      const groundBlock = this.bot.blockAt(groundPos);
      if (groundBlock && groundBlock.boundingBox === 'block') {
        try {
          await this.bot.equip(this._findItem('crafting_table'), 'hand');
          await this.bot.placeBlock(groundBlock, { x: 0, y: 1, z: 0 });
          return this.bot.blockAt(groundPos.offset(0, 1, 0));
        } catch (e) {
          // Table placement fallback
        }
      }
    }

    return null;
  }

  /**
   * Helper to locate or navigate to a nearby furnace.
   * @private
   */
  async _ensureFurnace() {
    if (this.ctx && this.ctx.target) {
      return this.ctx.target.findNearestBlock(['furnace', 'blast_furnace', 'smoker'], craftingConfig.FURNACE_SEARCH_RADIUS);
    }
    return null;
  }

  /**
   * Selects the most optimal fuel available in inventory.
   * @private
   */
  _selectBestFuel(itemsToCook) {
    const fuels = Object.keys(craftingData.fuelRatings);
    for (const fuel of fuels) {
      if (this._countItem(fuel) > 0) {
        return fuel;
      }
    }
    return null;
  }

  _countItem(name) {
    if (!this.bot || !this.bot.inventory) return 0;
    return this.bot.inventory.items()
      .filter((i) => i.name === name)
      .reduce((sum, i) => sum + i.count, 0);
  }

  _findItem(name) {
    if (!this.bot || !this.bot.inventory) return null;
    return this.bot.inventory.items().find((i) => i.name === name) || null;
  }

  _consumeItem(name, count) {
    if (!this.bot || !this.bot.inventory) return;
    let remaining = count;
    for (const item of this.bot.inventory.items()) {
      if (item.name === name) {
        if (item.count <= remaining) {
          remaining -= item.count;
          item.count = 0;
        } else {
          item.count -= remaining;
          remaining = 0;
          break;
        }
      }
    }
  }

  _addItem(name, count) {
    if (!this.bot || !this.bot.inventory) return;
    const existing = this.bot.inventory.items().find((i) => i.name === name);
    if (existing) {
      existing.count += count;
    } else if (Array.isArray(this.bot.inventory.items())) {
      this.bot.inventory.items().push({ name, count });
    }
  }
}

module.exports = CraftingService;
