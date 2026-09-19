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

    // Resolve generic wood aliases to the actual type currently in inventory
    const resolvedName = this._resolveWoodAlias(itemName);
    console.log(`[CraftingService] craft('${itemName}') resolved to '${resolvedName}', quantity=${quantity}`);
    console.log(`[CraftingService] Inventory:`, this.bot.inventory ? this.bot.inventory.items().map(i => `${i.name}x${i.count}`).join(', ') : 'none');

    // === FAST PATH: Use Minecraft's recipe API directly (handles all wood types automatically) ===
    if (typeof this.bot.recipesFor === 'function' && typeof this.bot.craft === 'function' && this.bot.registry) {
      const namesToTry = [...new Set([resolvedName, itemName])];
      for (const tryName of namesToTry) {
        const itemDef = this.bot.registry.itemsByName[tryName];
        if (!itemDef) continue;

        // Try without crafting table first (2x2 inventory crafting)
        let mcRecipes = this.bot.recipesFor(itemDef.id, null, 1, null);
        if (mcRecipes && mcRecipes.length > 0) {
          // Check if we have the ingredients; if not, try to sub-craft them
          const canDoNow = await this._ensureIngredientsForRecipe(mcRecipes[0], quantity);
          if (canDoNow) {
            try {
              const batchesNeeded = Math.ceil(quantity / (mcRecipes[0].result.count || 1));
              await this.bot.craft(mcRecipes[0], batchesNeeded, null);
              console.log(`[CraftingService] ✅ Crafted ${batchesNeeded}x ${tryName} (inventory 2x2)`);
              return true;
            } catch (e) {
              console.warn(`[CraftingService] Inventory craft failed for ${tryName}:`, e.message);
            }
          }
        }

        // Try with crafting table (3x3)
        let craftingTableBlock = await this._ensureCraftingTable();
        if (craftingTableBlock) {
          mcRecipes = this.bot.recipesFor(itemDef.id, null, 1, craftingTableBlock);
          if (mcRecipes && mcRecipes.length > 0) {
            const canDoNow = await this._ensureIngredientsForRecipe(mcRecipes[0], quantity);
            if (canDoNow) {
              try {
                const batchesNeeded = Math.ceil(quantity / (mcRecipes[0].result.count || 1));
                await this.bot.craft(mcRecipes[0], batchesNeeded, craftingTableBlock);
                console.log(`[CraftingService] ✅ Crafted ${batchesNeeded}x ${tryName} (crafting table)`);
                return true;
              } catch (e) {
                console.warn(`[CraftingService] Crafting table craft failed for ${tryName}:`, e.message);
              }
            } else {
              console.warn(`[CraftingService] Missing ingredients for ${tryName} at crafting table`);
            }
          } else {
            console.warn(`[CraftingService] No MC recipe found for ${tryName} even with crafting table`);
          }
        } else {
          console.warn(`[CraftingService] Could not place/find crafting table for ${tryName}`);
        }
      }
    }

    // === FALLBACK: Use our custom recipe data ===
    const recipe = craftingData.recipes[resolvedName] || craftingData.recipes[itemName];
    if (!recipe) {
      console.warn(`[CraftingService] No recipe registered for '${resolvedName || itemName}'`);
      return false;
    }

    if (!this.canCraft(resolvedName, quantity)) {
      const autoResolved = await this.autoCraftMissing(resolvedName, quantity);
      if (!autoResolved) {
        console.warn(`[CraftingService] autoCraftMissing failed for '${resolvedName}'`);
        return false;
      }
    }

    const batchesNeeded = Math.ceil(quantity / recipe.resultCount);
    let craftingTableBlock = null;
    if (recipe.requiresTable) {
      craftingTableBlock = await this._ensureCraftingTable();
      if (!craftingTableBlock) {
        console.warn('[CraftingService] Crafting table required but could not be placed/found');
        return false;
      }
    }

    try {
      for (const ing of recipe.ingredients) {
        this._consumeItem(ing.name, ing.count * batchesNeeded);
      }
      this._addItem(resolvedName, recipe.resultCount * batchesNeeded);
      console.log(`[CraftingService] ✅ Crafted ${batchesNeeded}x ${resolvedName} (fallback simulation)`);
      return true;
    } catch (err) {
      console.warn(`[CraftingService] Fallback craft '${resolvedName}' failed:`, err.message);
      return false;
    }
  }

  /**
   * Checks if the bot has all ingredients for a mineflayer recipe, and attempts to sub-craft any craftable missing ones.
   * @private
   */
  async _ensureIngredientsForRecipe(recipe, quantity = 1) {
    if (!recipe || !recipe.ingredients) return true;
    const batchesNeeded = Math.ceil(quantity / (recipe.result.count || 1));

    for (const ingredient of recipe.ingredients) {
      if (!ingredient) continue;
      const itemId = ingredient.id !== undefined ? ingredient.id : (ingredient.item !== undefined ? ingredient.item : null);
      if (itemId === null || itemId < 0) continue;

      const countNeeded = (ingredient.count || 1) * batchesNeeded;
      const itemDef = this.bot.registry ? Object.values(this.bot.registry.itemsByName).find(i => i.id === itemId) : null;
      const itemName = itemDef ? itemDef.name : null;

      const countInInventory = itemName ? this._countItem(itemName) : 0;
      if (countInInventory < countNeeded) {
        // Try to sub-craft the missing ingredient
        if (itemName) {
          console.log(`[CraftingService] Missing ingredient '${itemName}' (${countInInventory}/${countNeeded}), attempting sub-craft...`);
          const subCrafted = await this.craft(itemName, countNeeded - countInInventory);
          if (!subCrafted) {
            console.warn(`[CraftingService] Could not sub-craft '${itemName}'`);
            return false;
          }
        } else {
          return false;
        }
      }
    }
    return true;
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
      if (nearbyTable) {
        if (this.ctx.nav && typeof this.ctx.nav.goTo === 'function') {
          try { await this.ctx.nav.goTo(nearbyTable.position, { range: 3, allowBreak: false }); } catch (e) {}
        }
        return nearbyTable;
      }
    }

    // 2. Check if bot has crafting table in inventory to place
    let tableItem = this._findItem('crafting_table');
    if (!tableItem) {
      // Craft a crafting table if possible
      const crafted = await this.autoCraftMissing('crafting_table', 1);
      if (!crafted) return null;
      tableItem = this._findItem('crafting_table');
    }

    // 3. Place crafting table adjacent to bot
    if (this.bot && this.bot.entity && typeof this.bot.placeBlock === 'function') {
      const { Vec3 } = require('vec3');
      const offsets = [
        { x: 1, z: 0 },
        { x: -1, z: 0 },
        { x: 0, z: 1 },
        { x: 0, z: -1 }
      ];

      for (const off of offsets) {
        try {
          const botPos = this.bot.entity.position.floored();
          // The target position where we want to place the table
          const targetPos = botPos.offset(off.x, 0, off.z);
          // The block currently at that position (must be air/replaceable)
          const spaceBlock = this.bot.blockAt(targetPos, false);
          // The block below — this is what we place the table ON TOP OF
          const groundBlock = this.bot.blockAt(targetPos.offset(0, -1, 0), false);

          const isGroundSolid = groundBlock && (groundBlock.boundingBox === 'block');
          const isSpaceClear = spaceBlock && (spaceBlock.boundingBox === 'empty' || spaceBlock.name === 'air' || spaceBlock.name === 'cave_air' || spaceBlock.name === 'void_air' || spaceBlock.name.includes('grass') || spaceBlock.name.includes('flower'));

          if (isGroundSolid && isSpaceClear && tableItem) {
            await this.bot.equip(tableItem, 'hand');
            // placeBlock(referenceBlock, faceVector) — place on TOP face of groundBlock
            await this.bot.placeBlock(groundBlock, new Vec3(0, 1, 0));
            await new Promise((r) => setTimeout(r, 300));
            const placed = this.bot.blockAt(targetPos, false);
            if (placed && placed.name === 'crafting_table') {
              return placed;
            }
          }
        } catch (e) {
          // Table placement retry next offset
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
    const items = this.bot.inventory.items();
    // Handle any wood log variant
    if (name === 'oak_planks' || name === 'planks' || name.endsWith('_planks')) {
      return items
        .filter((i) => i.name && (i.name.endsWith('_planks') || i.name === 'planks'))
        .reduce((sum, i) => sum + i.count, 0);
    }
    if (name === 'oak_log' || name === 'log' || name.endsWith('_log') || name.endsWith('_stem') || name.endsWith('_wood')) {
      return items
        .filter((i) => i.name && (i.name.endsWith('_log') || i.name.endsWith('_stem') || i.name.endsWith('_wood') || i.name === 'log'))
        .reduce((sum, i) => sum + i.count, 0);
    }
    return items
      .filter((i) => i.name === name)
      .reduce((sum, i) => sum + i.count, 0);
  }

  /**
   * Resolves generic wood aliases (oak_planks, oak_log) to the actual wood type in inventory.
   * This ensures the Minecraft recipe API gets the right item ID regardless of tree type chopped.
   * @param {string} itemName
   * @returns {string} Actual item name in inventory, or original name
   * @private
   */
  _resolveWoodAlias(itemName) {
    if (!this.bot || !this.bot.inventory) return itemName;
    const items = this.bot.inventory.items();

    // Resolve planks alias → find the actual planks type in inventory
    if (itemName === 'oak_planks' || itemName === 'planks') {
      const plankItem = items.find((i) => i.name && i.name.endsWith('_planks'));
      if (plankItem) return plankItem.name;
    }

    // Resolve log alias → find the actual log type in inventory
    if (itemName === 'oak_log' || itemName === 'log') {
      const logItem = items.find((i) => i.name && (i.name.endsWith('_log') || i.name.endsWith('_stem')));
      if (logItem) return logItem.name;
    }

    // Resolve stick: use whatever planks are available to derive stick name
    if (itemName === 'stick') {
      return 'stick'; // sticks are universal
    }

    // Resolve crafting_table: needs planks
    if (itemName === 'crafting_table') {
      return 'crafting_table'; // universal
    }

    // Resolve wooden_pickaxe: universal
    if (itemName === 'wooden_pickaxe') {
      return 'wooden_pickaxe'; // universal
    }

    return itemName;
  }

  _findItem(name) {
    if (!this.bot || !this.bot.inventory) return null;
    const items = this.bot.inventory.items();
    if (name === 'oak_planks' || name === 'planks') {
      return items.find((i) => i.name && (i.name === 'oak_planks' || i.name.endsWith('_planks') || i.name === 'planks')) || null;
    }
    if (name === 'oak_log' || name === 'log') {
      return items.find((i) => i.name && (i.name === 'oak_log' || i.name.endsWith('_log') || i.name.endsWith('_stem') || i.name.endsWith('_wood') || i.name === 'log')) || null;
    }
    return items.find((i) => i.name === name) || null;
  }

  _consumeItem(name, count) {
    if (!this.bot || !this.bot.inventory) return;
    let remaining = count;
    const isPlanks = (name === 'oak_planks' || name === 'planks');
    const isLog = (name === 'oak_log' || name === 'log');

    for (const item of this.bot.inventory.items()) {
      const match = item.name === name ||
        (isPlanks && (item.name.endsWith('_planks') || item.name === 'planks')) ||
        (isLog && (item.name.endsWith('_log') || item.name.endsWith('_stem') || item.name.endsWith('_wood') || item.name === 'log'));

      if (match) {
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

  /**
   * Health heartbeat check for AIBrain.
   * @returns {{ ok: boolean, isCrafting: boolean }}
   */
  ping() {
    return {
      ok: true,
      isCrafting: Boolean(this.isCrafting)
    };
  }
}

module.exports = CraftingService;
