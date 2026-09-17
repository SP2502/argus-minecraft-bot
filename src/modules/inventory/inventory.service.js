const defaultItemValues = require('./item-value');
const itemCategories = require('./item-categories');
const { openChest, moveItemsToChest, closeChest, getChestContents } = require('./chest-interaction');

/**
 * InventoryService - Centralized inventory inspection, item sorting, tossing, and chest interactions.
 * Features must manage items and storage through this service.
 */
class InventoryService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference for navigation and shared state
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    this.chestCache = new Map(); // Key: `${x},${y},${z}`, Value: { contents: Array, lastUpdated: Date }
  }

  /**
   * Checks whether the inventory has reached or exceeded a capacity threshold.
   * Standard main inventory has 36 item slots (hotbar 0-8, inventory 9-35).
   * 
   * @param {number} [thresholdRatio=0.9] - Fraction of total slots filled (0.0 to 1.0)
   * @returns {boolean} True if capacity threshold is reached or exceeded
   * @example
   * if (ctx.inv.isFull(0.9)) { await ctx.inv.depositAll('ores', chestPos); }
   */
  isFull(thresholdRatio = 0.9) {
    if (!this.bot || !this.bot.inventory) return false;
    const usedSlots = this.getUsedSlots().length;
    const totalSlots = 36;
    return (usedSlots / totalSlots) >= thresholdRatio;
  }

  /**
   * Counts the total amount of a specific item across all inventory slots.
   * 
   * @param {string} itemName - Name of the item (e.g. 'diamond', 'iron_ingot', 'cobblestone')
   * @returns {number} Total count of the item
   * @example
   * const ironCount = ctx.inv.countItem('iron_ingot');
   */
  countItem(itemName) {
    if (!this.bot || !this.bot.inventory || !itemName) return 0;
    const items = this.bot.inventory.items();
    return items
      .filter((item) => item.name === itemName)
      .reduce((acc, item) => acc + item.count, 0);
  }

  /**
   * Checks if the bot possesses at least minCount of the specified item.
   * 
   * @param {string} itemName - Name of the item
   * @param {number} [minCount=1] - Minimum required amount
   * @returns {boolean}
   * @example
   * if (ctx.inv.hasItem('torch', 10)) { ... }
   */
  hasItem(itemName, minCount = 1) {
    return this.countItem(itemName) >= minCount;
  }

  /**
   * Returns an array of slot indices in the main inventory that are currently empty.
   * 
   * @returns {number[]} Array of empty slot index numbers
   * @example
   * const emptySlots = ctx.inv.getEmptySlots();
   */
  getEmptySlots() {
    if (!this.bot || !this.bot.inventory) return [];
    const empty = [];
    // Standard player inventory slots are 9 to 44 (including hotbar 36-44)
    for (let slot = 9; slot <= 44; slot++) {
      if (!this.bot.inventory.slots[slot]) {
        empty.push(slot);
      }
    }
    return empty;
  }

  /**
   * Returns an array of all occupied slots with item details.
   * 
   * @returns {Array<{ slot: number, name: string, count: number, type: number }>}
   * @example
   * const used = ctx.inv.getUsedSlots();
   */
  getUsedSlots() {
    if (!this.bot || !this.bot.inventory) return [];
    return this.bot.inventory.items().map((item) => ({
      slot: item.slot,
      name: item.name,
      count: item.count,
      type: item.type
    }));
  }

  /**
   * Compacts partial stacks in the bot inventory to free up maximum slot space.
   * 
   * @returns {Promise<void>}
   * @example
   * await ctx.inv.sort();
   */
  async sort() {
    if (!this.bot || !this.bot.inventory) return;
    const items = this.bot.inventory.items();
    const itemMap = new Map();

    for (const item of items) {
      if (!itemMap.has(item.name)) {
        itemMap.set(item.name, []);
      }
      itemMap.get(item.name).push(item);
    }

    // Attempt to combine partial stacks
    for (const [name, stackList] of itemMap.entries()) {
      if (stackList.length <= 1) continue;
      const stackSize = stackList[0].stackSize || 64;

      for (let i = 0; i < stackList.length; i++) {
        for (let j = i + 1; j < stackList.length; j++) {
          const source = stackList[j];
          const dest = stackList[i];

          if (dest.count < stackSize && source.count > 0) {
            const transferCount = Math.min(stackSize - dest.count, source.count);
            try {
              // Click source slot to pickup, then click dest slot to deposit
              await this.bot.clickWindow(source.slot, 0, 0);
              await this.bot.clickWindow(dest.slot, 0, 0);
              // Return any leftover in mouse to source slot
              if (this.bot.inventory.selectedItem) {
                await this.bot.clickWindow(source.slot, 0, 0);
              }
              dest.count += transferCount;
              source.count -= transferCount;
            } catch (clickErr) {
              // Non-fatal if sorting click sequence fails
              console.warn('[InventoryService] sort window click error:', clickErr.message);
            }
          }
        }
      }
    }
  }

  /**
   * Enforces the canonical fixed inventory hotbar layout:
   * 0 = Weapon, 1-3 = Tools, 6 = Water Bucket, 8 = Food, Off-hand = Shield/Totem
   * @returns {Promise<void>}
   */
  async organizeHotbar() {
    if (!this.bot || !this.bot.inventory) return;

    // Helper to find best item for a category
    const findItem = (filterFn) => this.bot.inventory.items().find(filterFn);

    const layout = [
      { slot: 36, type: 'weapon', find: (i) => i.name.includes('sword') || i.name.includes('axe') },
      { slot: 37, type: 'tool_1', find: (i) => i.name.includes('pickaxe') },
      { slot: 38, type: 'tool_2', find: (i) => i.name.includes('axe') && !i.name.includes('pickaxe') },
      { slot: 39, type: 'tool_3', find: (i) => i.name.includes('shovel') || i.name.includes('hoe') },
      { slot: 42, type: 'water', find: (i) => i.name === 'water_bucket' },
      { slot: 44, type: 'food', find: (i) => ['bread', 'cooked_beef', 'cooked_porkchop', 'golden_apple', 'apple', 'carrot'].includes(i.name) }
    ];

    for (const rule of layout) {
      const targetItem = findItem(rule.find);
      if (targetItem && targetItem.slot !== rule.slot) {
        try {
          await this.bot.moveSlotItem(targetItem.slot, rule.slot);
        } catch (err) {
          console.warn(`[InventoryService] Error moving ${rule.type} to slot ${rule.slot}:`, err.message);
        }
      }
    }

    // Off-hand (Slot 45)
    const offhandItem = findItem((i) => i.name === 'shield' || i.name === 'totem_of_undying');
    if (offhandItem && offhandItem.slot !== 45) {
      try {
         await this.bot.equip(offhandItem, 'off-hand');
      } catch (err) {}
    }
  }

  /**
   * Drops items with the lowest relative value when inventory space is required.
   * 
   * @param {Object<string, number>} [valueMap=defaultItemValues] - Item value lookup table
   * @param {number} [keepReserveSlots=5] - Number of slots to ensure remain empty
   * @returns {Promise<number>} Number of item stacks dropped
   * @example
   * await ctx.inv.dropLowValueItems({ cobblestone: 5, dirt: 1 }, 5);
   */
  async dropLowValueItems(valueMap = defaultItemValues, keepReserveSlots = 5) {
    if (!this.bot || !this.bot.inventory) return 0;
    const totalSlots = 36;
    const targetUsedMax = totalSlots - keepReserveSlots;

    let usedItems = this.bot.inventory.items();
    if (usedItems.length <= targetUsedMax) {
      return 0;
    }

    // Sort items by ascending value (cheapest first)
    const sorted = [...usedItems].sort((a, b) => {
      const valA = valueMap[a.name] !== undefined ? valueMap[a.name] : (valueMap.default || 5);
      const valB = valueMap[b.name] !== undefined ? valueMap[b.name] : (valueMap.default || 5);
      return valA - valB;
    });

    let droppedCount = 0;
    for (const item of sorted) {
      if (this.bot.inventory.items().length <= targetUsedMax) {
        break;
      }

      // Safeguard: Never drop vital tools, weapons, armor, or water bucket
      const isProtectedTool = item.name.includes('sword') || item.name.includes('pickaxe') ||
                              item.name.includes('axe') || item.name.includes('shovel') ||
                              item.name.includes('hoe') || item.name === 'water_bucket' ||
                              item.name === 'shield' || item.name === 'totem_of_undying';
      if (isProtectedTool) continue;

      // Invariant: 16-seed reservation threshold on item discards
      const isSeedOrCrop = item.name.includes('seeds') || item.name === 'carrot' || item.name === 'potato';
      let tossCount = item.count;
      if (isSeedOrCrop) {
        const totalCount = this.countItem(item.name);
        const reserve = 16;
        if (totalCount <= reserve) {
          continue; // Retain all seeds if at or below reserve
        }
        tossCount = Math.min(item.count, totalCount - reserve);
        if (tossCount <= 0) continue;
      }

      try {
        await this.bot.toss(item.type, null, tossCount);
        droppedCount++;
        // Small delay between drops
        await new Promise((r) => setTimeout(r, 150));
      } catch (tossErr) {
        console.warn(`[InventoryService] Failed to drop low-value item ${item.name}:`, tossErr.message);
      }
    }

    return droppedCount;
  }

  /**
   * Navigates to a chest, opens it, deposits all items matching the category or predicate filter, and closes the chest.
   * 
   * @param {string|Function} categoryFilter - Category name (e.g., 'ores', 'crops', 'logs') or predicate (item => boolean)
   * @param {{ x: number, y: number, z: number }} chestPosition - Coordinates of target chest
   * @returns {Promise<{ success: boolean, depositedCount: number }>}
   * @example
   * await ctx.inv.depositAll('ores', { x: 100, y: 64, z: 200 });
   */
  async depositAll(categoryFilter, chestPosition) {
    if (!chestPosition) {
      throw new Error('[InventoryService] chestPosition must be provided to depositAll');
    }

    // 1. Navigate within interaction range of chest if nav service is available
    if (this.ctx && this.ctx.nav) {
      const navResult = await this.ctx.nav.goTo(chestPosition, { range: 2 });
      if (!navResult.success) {
        throw new Error(`[InventoryService] Could not reach chest at (${chestPosition.x}, ${chestPosition.y}, ${chestPosition.z}): ${navResult.reason}`);
      }
    }

    // 2. Open chest container
    const chest = await openChest(this.bot, chestPosition);

    try {
      // 3. Filter items to deposit
      const inventoryItems = this.bot.inventory.items();
      const itemsToDeposit = [];
      const currentCounts = {};
      
      for (const item of inventoryItems) {
        let shouldDeposit = false;
        if (typeof categoryFilter === 'function') {
          shouldDeposit = categoryFilter(item);
        } else if (typeof categoryFilter === 'string') {
          const cat = itemCategories.getCategory(item.name);
          if (cat === categoryFilter) shouldDeposit = true;
          else {
            const categoryList = itemCategories[categoryFilter];
            if (Array.isArray(categoryList) && categoryList.includes(item.name)) shouldDeposit = true;
            else if (item.name.includes(categoryFilter)) shouldDeposit = true;
          }
        }
        
        if (shouldDeposit) {
          // Check reservation (e.g. 16 seeds)
          currentCounts[item.name] = currentCounts[item.name] || this.countItem(item.name);
          // Hardcoded seed reservation as per specification
          const reserve = (item.name.includes('seeds') || item.name === 'carrot' || item.name === 'potato') ? 16 : 0;
          
          if (currentCounts[item.name] > reserve) {
             const depositAmount = Math.min(item.count, currentCounts[item.name] - reserve);
             itemsToDeposit.push({ ...item, count: depositAmount });
             currentCounts[item.name] -= depositAmount;
          }
        }
      }

      // 4. Move items into chest
      let depositedTotal = 0;
      for (const item of itemsToDeposit) {
        try {
          await chest.deposit(item.type, null, item.count);
          depositedTotal += item.count;
        } catch (depErr) {
          console.warn(`[InventoryService] Could not deposit ${item.name}:`, depErr.message);
        }
      }

      // 5. Update local chest cache
      const cacheKey = `${Math.floor(chestPosition.x)},${Math.floor(chestPosition.y)},${Math.floor(chestPosition.z)}`;
      this.chestCache.set(cacheKey, {
        contents: getChestContents(chest),
        lastUpdated: new Date()
      });

      return { success: true, depositedCount: depositedTotal };
    } finally {
      // 6. Ensure chest is safely closed
      await closeChest(this.bot, chest);
    }
  }

  /**
   * Navigates to a chest, opens it, withdraws up to the requested quantity of an item, and closes the chest.
   * 
   * @param {string} itemName - Target item name
   * @param {number} [quantity=1] - Desired amount to withdraw
   * @param {{ x: number, y: number, z: number }} chestPosition - Coordinates of target chest
   * @returns {Promise<number>} Actual number of items retrieved
   * @example
   * const count = await ctx.inv.retrieve('diamond', 10, { x: 100, y: 64, z: 200 });
   */
  async retrieve(itemName, quantity = 1, chestPosition) {
    if (!chestPosition || !itemName) {
      throw new Error('[InventoryService] chestPosition and itemName must be provided to retrieve');
    }

    if (this.ctx && this.ctx.nav) {
      const navResult = await this.ctx.nav.goTo(chestPosition, { range: 2 });
      if (!navResult.success) {
        throw new Error(`[InventoryService] Could not reach chest: ${navResult.reason}`);
      }
    }

    const chest = await openChest(this.bot, chestPosition);
    let totalRetrieved = 0;

    try {
      const containerItems = typeof chest.containerItems === 'function' ? chest.containerItems() : chest.items();
      const matchingItems = containerItems.filter((i) => i.name === itemName);

      let remaining = quantity;
      for (const item of matchingItems) {
        if (remaining <= 0) break;
        const withdrawCount = Math.min(item.count, remaining);
        try {
          await chest.withdraw(item.type, null, withdrawCount);
          totalRetrieved += withdrawCount;
          remaining -= withdrawCount;
        } catch (withErr) {
          console.warn(`[InventoryService] Error withdrawing ${itemName}:`, withErr.message);
        }
      }

      // Update cache
      const cacheKey = `${Math.floor(chestPosition.x)},${Math.floor(chestPosition.y)},${Math.floor(chestPosition.z)}`;
      this.chestCache.set(cacheKey, {
        contents: getChestContents(chest),
        lastUpdated: new Date()
      });

      return totalRetrieved;
    } finally {
      await closeChest(this.bot, chest);
    }
  }

  /**
   * Deposits a specific list of items and quantities into a chest.
   * 
   * @param {Array<{ name: string, count: number }>} items - Specific items to deposit
   * @param {{ x: number, y: number, z: number }} chestPosition - Coordinates of target chest
   * @returns {Promise<{ success: boolean, depositedCount: number }>}
   * @example
   * await ctx.inv.depositSpecific([{ name: 'iron_ingot', count: 32 }], chestPos);
   */
  async depositSpecific(items, chestPosition) {
    if (!chestPosition || !Array.isArray(items)) {
      throw new Error('[InventoryService] Invalid parameters for depositSpecific');
    }

    if (this.ctx && this.ctx.nav) {
      const navResult = await this.ctx.nav.goTo(chestPosition, { range: 2 });
      if (!navResult.success) {
        throw new Error(`[InventoryService] Could not reach chest: ${navResult.reason}`);
      }
    }

    const chest = await openChest(this.bot, chestPosition);
    let totalDeposited = 0;

    try {
      for (const req of items) {
        let remaining = req.count;
        const matchingInventory = this.bot.inventory.items().filter((i) => i.name === req.name);

        for (const invItem of matchingInventory) {
          if (remaining <= 0) break;
          const depositCount = Math.min(invItem.count, remaining);
          try {
            await chest.deposit(invItem.type, null, depositCount);
            totalDeposited += depositCount;
            remaining -= depositCount;
          } catch (depErr) {
            console.warn(`[InventoryService] Error depositing ${req.name}:`, depErr.message);
          }
        }
      }

      const cacheKey = `${Math.floor(chestPosition.x)},${Math.floor(chestPosition.y)},${Math.floor(chestPosition.z)}`;
      this.chestCache.set(cacheKey, {
        contents: getChestContents(chest),
        lastUpdated: new Date()
      });

      return { success: true, depositedCount: totalDeposited };
    } finally {
      await closeChest(this.bot, chest);
    }
  }

  /**
   * Retrieves the top N most valuable items currently held in inventory.
   * 
   * @param {number} [n=5] - Number of top items to return
   * @returns {Array<{ name: string, count: number, value: number }>}
   * @example
   * const topItems = ctx.inv.getTopValueItems(5);
   */
  getTopValueItems(n = 5) {
    if (!this.bot || !this.bot.inventory) return [];
    const items = this.bot.inventory.items();

    const mapped = items.map((item) => {
      const val = defaultItemValues[item.name] !== undefined
        ? defaultItemValues[item.name]
        : (defaultItemValues.default || 5);
      return {
        name: item.name,
        count: item.count,
        value: val * item.count
      };
    });

    return mapped
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }

  /**
   * Returns current inventory status telemetry.
   * 
   * @returns {{ usedSlots: number, totalSlots: number, isFull: boolean, topValueItems: Array<{name: string, count: number, value: number}> }}
   */
  getStatus() {
    const usedSlots = this.getUsedSlots().length;
    const totalSlots = 36;
    return {
      usedSlots,
      totalSlots,
      isFull: this.isFull(0.9),
      topValueItems: this.getTopValueItems(5)
    };
  }

  /**
   * Health heartbeat check.
   * @returns {{ ok: boolean, usedSlots: number }}
   */
  ping() {
    return {
      ok: Boolean(this.bot && this.bot.inventory),
      usedSlots: this.bot && this.bot.inventory ? this.getUsedSlots().length : 0
    };
  }
}

module.exports = InventoryService;
