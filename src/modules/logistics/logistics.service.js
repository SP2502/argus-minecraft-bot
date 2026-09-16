const logisticsConfig = require('./logistics.config');
const logisticsData = require('./logistics.data');
const itemCategories = require('../../../config/itemCategories');
const { openChest, moveItemsToChest, closeChest, getChestContents } = require('../../../services/ChestInteract');
const mongoose = require('mongoose');
const Chest = require('./chest.model');

/**
 * LogisticsService - Automated Base Warehouse Management, Storage Indexing,
 * Container Classification, and Autonomous Restocking.
 */
class LogisticsService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext dependency container
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    // In-memory catalog index of all known warehouse chests
    // Key: `${x},${y},${z}`, Value: { position: {x,y,z}, category: string, label: string, contents: Array, lastScanned: Date }
    this.warehouseIndex = new Map();
    this.lastScanTime = 0;
  }

  /**
   * Scans the surrounding area for storage containers, opens each container,
   * catalogs its inventory, and updates the warehouse index.
   * 
   * @param {number} [searchRadius=24] - Radius in blocks to discover containers
   * @param {{ x: number, y: number, z: number }} [origin=null] - Center coordinate
   * @returns {Promise<{ chestsScanned: number, totalItemsIndexed: number, indexedChests: Array }>}
   */
  async scanAndIndexChests(searchRadius = logisticsConfig.CHEST_SEARCH_RADIUS, origin = null) {
    let center = origin;
    if (!center && this.bot && this.bot.entity && this.bot.entity.position) {
      center = this.bot.entity.position.floored();
    } else if (!center) {
      center = { x: 0, y: 64, z: 0 };
    }

    // 1. Discover all container positions
    const containerPositions = await this._discoverContainers(center, searchRadius);
    let totalItemsIndexed = 0;
    const indexedChests = [];

    for (const pos of containerPositions) {
      try {
        // Navigate near container if navigation service available
        if (this.ctx && this.ctx.nav) {
          try {
            await this.ctx.nav.goTo(pos, { range: logisticsConfig.INTERACTION_RANGE, allowBreak: false });
          } catch (navErr) {
            // If already in range or unreachable, attempt direct open
          }
        }

        // Open container & read contents
        const chest = await openChest(this.bot, pos);
        const contents = getChestContents(chest);
        await closeChest(this.bot, chest);

        const itemCount = contents.reduce((acc, i) => acc + (i.count || 1), 0);
        totalItemsIndexed += itemCount;

        // Determine or preserve category
        const key = `${pos.x},${pos.y},${pos.z}`;
        const existing = this.warehouseIndex.get(key);
        const category = (existing && existing.category) || this._inferChestCategory(contents);
        const label = (existing && existing.label) || `${category}_chest`;

        const record = {
          position: pos,
          category,
          label,
          contents,
          lastScanned: new Date()
        };

        this.warehouseIndex.set(key, record);
        indexedChests.push(record);

        // Persist to MongoDB if model available
        await this._persistChestRecord(record);

        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('logistics.chest_indexed', {
            position: pos,
            category,
            label,
            itemCount
          });
        }
      } catch (err) {
        console.warn(`[LogisticsService] Failed to index chest at (${pos.x}, ${pos.y}, ${pos.z}):`, err.message);
      }
    }

    this.lastScanTime = Date.now();
    return {
      chestsScanned: indexedChests.length,
      totalItemsIndexed,
      indexedChests
    };
  }

  /**
   * Searches the indexed warehouse for all chests containing the target item.
   * 
   * @param {string} itemName - Target item name (e.g. 'diamond', 'iron_ingot', 'bread')
   * @returns {Array<{ position: {x:number, y:number, z:number}, category: string, label: string, count: number }>}
   */
  findItemInWarehouse(itemName) {
    if (!itemName) return [];
    const cleanName = itemName.toLowerCase().trim();
    const results = [];

    for (const chest of this.warehouseIndex.values()) {
      const match = (chest.contents || []).filter((i) => i.name === cleanName);
      const count = match.reduce((acc, i) => acc + (i.count || 1), 0);
      if (count > 0) {
        results.push({
          position: chest.position,
          category: chest.category,
          label: chest.label,
          count
        });
      }
    }

    // Sort by count descending (chests with most stock first)
    results.sort((a, b) => b.count - a.count);
    return results;
  }

  /**
   * Finds the best matching chest for a given category nearest to reference position.
   * 
   * @param {string} category - Target category ('ores', 'crops', 'logs', 'blocks', 'tools', 'food', 'general')
   * @param {{ x: number, y: number, z: number }} [referencePos=null] - Reference coordinates
   * @returns {{ position: {x:number, y:number, z:number}, category: string, label: string }|null}
   */
  getChestForCategory(category = 'general', referencePos = null) {
    const rawCat = (category || 'general').toLowerCase();
    const targetCat = logisticsData.categoryAliases[rawCat] || rawCat;

    const ref = referencePos || (this.bot && this.bot.entity && this.bot.entity.position) || { x: 0, y: 64, z: 0 };

    // 1. First priority: Exact category match
    const matching = [];
    for (const chest of this.warehouseIndex.values()) {
      if (chest.category === targetCat) {
        matching.push(chest);
      }
    }

    // 2. Fallback: General or misc storage
    if (matching.length === 0) {
      for (const chest of this.warehouseIndex.values()) {
        if (chest.category === 'general' || chest.category === 'misc') {
          matching.push(chest);
        }
      }
    }

    // 3. Last fallback: Any indexed chest
    if (matching.length === 0 && this.warehouseIndex.size > 0) {
      for (const chest of this.warehouseIndex.values()) {
        matching.push(chest);
      }
    }

    if (matching.length === 0) return null;

    // Pick closest to reference position
    matching.sort((a, b) => {
      const distA = Math.hypot(a.position.x - ref.x, a.position.y - ref.y, a.position.z - ref.z);
      const distB = Math.hypot(b.position.x - ref.x, b.position.y - ref.y, b.position.z - ref.z);
      return distA - distB;
    });

    return matching[0];
  }

  /**
   * Sorts the bot's current inventory items into categorized warehouse chests.
   * 
   * @param {Array<string>} [preserveItemTypes=[]] - Items to retain in inventory (e.g. tools, food, weapons)
   * @returns {Promise<{ sortedCount: number, categoriesSorted: string[] }>}
   */
  async sortInventoryToChests(preserveItemTypes = ['iron_sword', 'diamond_sword', 'iron_pickaxe', 'diamond_pickaxe', 'shield']) {
    if (!this.bot || !this.bot.inventory) {
      return { sortedCount: 0, categoriesSorted: [] };
    }

    // Ensure warehouse index is populated
    if (this.warehouseIndex.size === 0) {
      await this.scanAndIndexChests();
    }

    if (this.warehouseIndex.size === 0) {
      throw new Error('[LogisticsService] No storage chests found in warehouse to sort into.');
    }

    const inventoryItems = this.bot.inventory.items();
    // Filter out preserved tools/loadout items
    const itemsToSort = inventoryItems.filter((i) => !preserveItemTypes.includes(i.name));

    // Group items by storage category
    const categorizedGroups = new Map();
    for (const item of itemsToSort) {
      const cat = itemCategories.getCategory(item.name);
      if (!categorizedGroups.has(cat)) {
        categorizedGroups.set(cat, []);
      }
      categorizedGroups.get(cat).push(item);
    }

    let sortedTotal = 0;
    const categoriesSorted = [];

    for (const [category, items] of categorizedGroups.entries()) {
      const targetChest = this.getChestForCategory(category);
      if (!targetChest) continue;

      try {
        if (this.ctx && this.ctx.nav) {
          await this.ctx.nav.goTo(targetChest.position, { range: logisticsConfig.INTERACTION_RANGE });
        }

        const chest = await openChest(this.bot, targetChest.position);
        const { depositedCount } = await moveItemsToChest(this.bot, chest, items);
        sortedTotal += depositedCount;

        // Update chest contents in index
        const updatedContents = getChestContents(chest);
        targetChest.contents = updatedContents;
        targetChest.lastScanned = new Date();
        this.warehouseIndex.set(`${targetChest.position.x},${targetChest.position.y},${targetChest.position.z}`, targetChest);
        await this._persistChestRecord(targetChest);

        await closeChest(this.bot, chest);
        categoriesSorted.push(category);

        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('logistics.item_transferred', {
            action: 'deposit',
            category,
            count: depositedCount,
            chest: targetChest.position
          });
        }
      } catch (err) {
        console.warn(`[LogisticsService] Error depositing '${category}' items:`, err.message);
      }
    }

    return { sortedCount: sortedTotal, categoriesSorted };
  }

  /**
   * Restocks the bot's inventory according to a predefined kit profile.
   * 
   * @param {string} [kitName='default'] - Profile name (e.g. 'miner', 'woodcutter', 'warrior', 'farmer', 'default')
   * @returns {Promise<{ kitName: string, restockedItems: Array<{ name: string, count: number }> }>}
   */
  async restockKit(kitName = 'default') {
    const rawName = (kitName || 'default').toLowerCase().trim();
    const resolvedKitName = logisticsData.kitAliases[rawName] || rawName;

    const kitDef = logisticsConfig.defaultKits[resolvedKitName] || logisticsConfig.defaultKits.default;
    if (!kitDef) {
      throw new Error(`[LogisticsService] Unknown kit profile: '${kitName}'`);
    }

    // Ensure index exists
    if (this.warehouseIndex.size === 0) {
      await this.scanAndIndexChests();
    }

    const restockedItems = [];

    for (const req of kitDef.items) {
      const current = this._countBotItem(req.name);
      if (current < req.count) {
        const needed = req.count - current;
        let targetItem = req.name;
        let candidateChests = this.findItemInWarehouse(targetItem);

        // Check fallback if primary not available
        if (candidateChests.length === 0 && req.fallback) {
          targetItem = req.fallback;
          candidateChests = this.findItemInWarehouse(targetItem);
        }

        if (candidateChests.length > 0) {
          const sourceChest = candidateChests[0];
          try {
            if (this.ctx && this.ctx.nav) {
              await this.ctx.nav.goTo(sourceChest.position, { range: logisticsConfig.INTERACTION_RANGE });
            }

            const chest = await openChest(this.bot, sourceChest.position);
            const containerItems = getChestContents(chest);
            const match = containerItems.find((i) => i.name === targetItem);

            if (match) {
              const withdrawCount = Math.min(match.count, needed);
              if (typeof chest.withdraw === 'function') {
                await chest.withdraw(match.type, null, withdrawCount);
              } else {
                // Mock simulation
                this._addBotItem(targetItem, withdrawCount);
                match.count -= withdrawCount;
              }

              restockedItems.push({ name: targetItem, count: withdrawCount });

              // Update index
              sourceChest.contents = getChestContents(chest);
              sourceChest.lastScanned = new Date();
              this.warehouseIndex.set(`${sourceChest.position.x},${sourceChest.position.y},${sourceChest.position.z}`, sourceChest);
              await this._persistChestRecord(sourceChest);

              if (this.ctx && this.ctx.events) {
                this.ctx.events.emit('logistics.item_transferred', {
                  action: 'withdraw',
                  item: targetItem,
                  count: withdrawCount,
                  chest: sourceChest.position
                });
              }
            }
            await closeChest(this.bot, chest);
          } catch (err) {
            console.warn(`[LogisticsService] Could not withdraw ${targetItem} from chest:`, err.message);
          }
        }
      }
    }

    return { kitName: resolvedKitName, restockedItems };
  }

  /**
   * Explicitly sets a designated category and optional label for a chest at coordinates.
   * 
   * @param {{ x: number, y: number, z: number }} position
   * @param {string} category
   * @param {string} [label='']
   */
  async designateChest(position, category, label = '') {
    const key = `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`;
    const rawCat = (category || 'general').toLowerCase();
    const cleanCat = logisticsData.categoryAliases[rawCat] || rawCat;

    const record = this.warehouseIndex.get(key) || {
      position: { x: Math.floor(position.x), y: Math.floor(position.y), z: Math.floor(position.z) },
      contents: [],
      lastScanned: new Date()
    };

    record.category = cleanCat;
    record.label = label || `${cleanCat}_chest`;
    this.warehouseIndex.set(key, record);

    await this._persistChestRecord(record);
    return record;
  }

  // --- Private Helpers ---

  async _discoverContainers(center, radius) {
    const foundPositions = [];

    // 1. If database has registered chests, load them
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1 && Chest && typeof Chest.find === 'function') {
        const dbChests = await Chest.find({
          x: { $gte: center.x - radius, $lte: center.x + radius },
          z: { $gte: center.z - radius, $lte: center.z + radius }
        });
        for (const c of dbChests) {
          foundPositions.push({ x: c.x, y: c.y, z: c.z });
        }
      }
    } catch (e) {
      // DB error fallback
    }

    // 2. Scan loaded world blocks via TargetFinderService or findBlock
    if (this.ctx && this.ctx.target && typeof this.ctx.target.findNearestBlock === 'function') {
      for (const cName of logisticsData.validContainers) {
        const blk = this.ctx.target.findNearestBlock([cName], radius);
        if (blk && blk.position) {
          const bp = blk.position.floored ? blk.position.floored() : blk.position;
          if (!foundPositions.some((p) => p.x === bp.x && p.y === bp.y && p.z === bp.z)) {
            foundPositions.push(bp);
          }
        }
      }
    }

    return foundPositions;
  }

  _inferChestCategory(contents = []) {
    if (!contents || contents.length === 0) return 'general';
    const countsByCategory = {};

    for (const item of contents) {
      const cat = itemCategories.getCategory(item.name);
      countsByCategory[cat] = (countsByCategory[cat] || 0) + (item.count || 1);
    }

    let dominantCat = 'general';
    let maxCount = 0;

    for (const [cat, count] of Object.entries(countsByCategory)) {
      if (count > maxCount) {
        maxCount = count;
        dominantCat = cat;
      }
    }

    return dominantCat;
  }

  async _persistChestRecord(record) {
    try {
      if (mongoose.connection && mongoose.connection.readyState === 1 && Chest && typeof Chest.findOneAndUpdate === 'function') {
        await Chest.findOneAndUpdate(
          { x: record.position.x, y: record.position.y, z: record.position.z },
          {
            x: record.position.x,
            y: record.position.y,
            z: record.position.z,
            category: record.category,
            label: record.label,
            contents: record.contents,
            lastAccessed: new Date()
          },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      // Database optional
    }
  }

  _countBotItem(itemName) {
    if (!this.bot || !this.bot.inventory || !this.bot.inventory.items) return 0;
    return this.bot.inventory.items()
      .filter((i) => i.name === itemName)
      .reduce((acc, i) => acc + (i.count || 1), 0);
  }

  _addBotItem(itemName, count = 1) {
    if (!this.bot || !this.bot.inventory || !this.bot.inventory.items) return;
    const existing = this.bot.inventory.items().find((i) => i.name === itemName);
    if (existing) {
      existing.count += count;
    } else {
      this.bot.inventory.items().push({ name: itemName, count });
    }
  }
}

module.exports = LogisticsService;
