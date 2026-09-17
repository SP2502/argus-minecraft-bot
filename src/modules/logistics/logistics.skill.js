const { BaseSkill } = require('../../core/base.skill');
const logisticsData = require('./logistics.data');

/**
 * LogisticsSkill - Autonomous Warehouse Management, Multi-Chest Sorting,
 * Equipment Restocking, and Item Locating Task Runner.
 * 
 * Invariant: Reuses NavigationService, InventoryService, SafetyService, and LogisticsService.
 */
class LogisticsSkill extends BaseSkill {
  /**
   * Main autonomous execution lifecycle.
   * 
   * @param {Object} [params={}] - Operation parameters
   * @param {'sort'|'restock'|'index'|'locate'} [params.mode='sort'] - Execution mode
   * @param {string} [params.kit='default'] - Target kit profile if mode === 'restock'
   * @param {string} [params.item=null] - Target item name if mode === 'locate'
   * @param {number} [params.radius=24] - Search radius in blocks
   * @returns {Promise<any>}
   */
  async run(params = {}) {
    const mode = (params.mode || 'sort').toLowerCase();

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('logistics.started', { mode, params });
    }

    let result = null;

    if (!this.ctx || !this.ctx.logistics) {
      throw new Error('[LogisticsSkill] LogisticsService is not initialized on BotContext.');
    }

    // Safety and preemption check
    await this.safetyCheckLoop({ mode, phase: 'initial' });

    switch (mode) {
      case 'sort': {
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send('Organizing base inventory into categorized chests...');
        }
        const sortRes = await this.ctx.logistics.sortInventoryToChests();
        result = {
          mode: 'sort',
          sortedCount: sortRes.sortedCount,
          categories: sortRes.categoriesSorted
        };
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send(
            `Warehouse sorting complete: deposited ${sortRes.sortedCount} items into [${sortRes.categoriesSorted.join(', ') || 'general'}].`
          );
        }
        break;
      }

      case 'restock': {
        const kitName = params.kit || 'default';
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send(`Restocking kit profile '${kitName}' from warehouse storage...`);
        }
        const restockRes = await this.ctx.logistics.restockKit(kitName);
        result = {
          mode: 'restock',
          kitName: restockRes.kitName,
          restockedItems: restockRes.restockedItems
        };
        const itemsSummary = restockRes.restockedItems.map((i) => `${i.count}x ${i.name}`).join(', ') || 'none (kit full)';
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send(`Restock complete for '${restockRes.kitName}': retrieved ${itemsSummary}.`);
        }
        break;
      }

      case 'index': {
        const radius = params.radius || 24;
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send(`Scanning and cataloging warehouse chests within ${radius} blocks...`);
        }
        const indexRes = await this.ctx.logistics.scanAndIndexChests(radius, params.origin);
        result = {
          mode: 'index',
          chestsScanned: indexRes.chestsScanned,
          totalItemsIndexed: indexRes.totalItemsIndexed
        };
        if (this.ctx.messageRouter) {
          await this.ctx.messageRouter.send(
            `Warehouse scan complete: indexed ${indexRes.chestsScanned} chests containing ${indexRes.totalItemsIndexed} total items.`
          );
        }
        break;
      }

      case 'locate': {
        const targetItem = params.item;
        if (!targetItem) {
          throw new Error('[LogisticsSkill] Item name must be specified for locate mode.');
        }
        const matches = this.ctx.logistics.findItemInWarehouse(targetItem);
        result = {
          mode: 'locate',
          item: targetItem,
          matches
        };

        if (this.ctx.messageRouter) {
          if (matches.length === 0) {
            await this.ctx.messageRouter.send(`Item '${targetItem}' not found in any indexed warehouse chests.`);
          } else {
            const topMatch = matches[0];
            const totalFound = matches.reduce((acc, m) => acc + m.count, 0);
            await this.ctx.messageRouter.send(
              `Found ${totalFound}x ${targetItem} in warehouse! Top location: ${topMatch.count}x in '${topMatch.label}' at (${topMatch.position.x}, ${topMatch.position.y}, ${topMatch.position.z}).`
            );
          }
        }
        break;
      }

      default:
        throw new Error(`[LogisticsSkill] Unsupported mode: '${mode}'`);
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('logistics.completed', { mode, result });
    }

    return result;
  }
}

module.exports = LogisticsSkill;
