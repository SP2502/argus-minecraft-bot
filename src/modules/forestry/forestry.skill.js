const { BaseSkill } = require('../../core/base.skill');
const TreeAnalyzer = require('./tree-analyzer');
const treeData = require('./forestry.data');
const forestryPolicies = require('./forestry.policy');
const forestryConfig = require('./forestry.config');
const eventBus = require('../../core/EventBus');

/**
 * ChopTreeSkill - Autonomous forestry and tree harvesting skill.
 * Reuses existing Navigation, Inventory, Safety, Tools, TargetFinder, and TaskManager services.
 */
class ChopTreeSkill extends BaseSkill {
  /**
   * @param {import('../../core/BotContext')} ctx - BotContext dependency container
   */
  constructor(ctx) {
    super(ctx);
    this.name = 'chop_tree';
    this.analyzer = new TreeAnalyzer(ctx.bot, treeData, forestryConfig);
  }

  /**
   * Cuts natural trees and optionally replants saplings.
   * Called strictly through TaskManager.
   * 
   * @param {Object} [params={}] - Woodcutting parameters
   * @param {string} [params.treeType='any'] - Target species or 'any'
   * @param {number|null} [params.quantity=64] - Logs to collect, or null for until full
   * @param {number} [params.searchRadius=48] - Search radius in blocks
   * @param {boolean} [params.replant=true] - Whether to replant saplings
   * @param {boolean} [params.collectSaplings=true] - Whether to collect saplings
   * @param {boolean} [params.collectApples=true] - Whether to collect apples
   * @param {string|Object|null} [params.location=null] - Target location
   * @param {boolean} [params.allowNearBase=false] - Whether to allow cutting near registered bases
   * @param {Object} taskContext - Task control, checkpoint, and cancellation context
   * @returns {Promise<{logsCollected:number, treesCut:number, saplingsPlanted:number, skipped:number}>}
   */
  async run(params = {}, taskContext) {
    const rawFamily = params.treeType || params.family || treeData.defaults.targetFamily;
    const treeFamily = treeData.aliases[rawFamily.toLowerCase()] || rawFamily.toLowerCase();
    const targetQuantity = params.quantity !== undefined ? params.quantity : treeData.defaults.quantity;
    const searchRadius = Math.min(params.searchRadius || forestryConfig.DEFAULT_SEARCH_RADIUS, forestryConfig.MAX_SEARCH_RADIUS);
    const shouldReplant = params.replant !== undefined ? params.replant : treeData.defaults.replant;

    // Dimension Check
    const currentDim = (this.bot && this.bot.game && this.bot.game.dimension) ? this.bot.game.dimension : 'overworld';
    if (!forestryPolicies.isAllowedDimension(treeFamily, currentDim)) {
      throw new Error(`Tree species '${treeFamily}' cannot be harvested in dimension '${currentDim}'.`);
    }

    // Resolve optional starting location
    if (params.location && this.ctx.locations) {
      const loc = typeof params.location === 'string'
        ? await this.ctx.locations.getBase(params.location)
        : params.location;
      if (loc && loc.x !== undefined) {
        await this.ctx.nav.goTo({ x: loc.x, y: loc.y, z: loc.z }, { allowBreak: false });
      }
    }

    // Counters and checkpoint resume
    let logsCollected = (taskContext && taskContext.checkpoint && taskContext.checkpoint.logsCollected) || 0;
    let treesCut = (taskContext && taskContext.checkpoint && taskContext.checkpoint.treesCut) || 0;
    let saplingsPlanted = (taskContext && taskContext.checkpoint && taskContext.checkpoint.saplingsPlanted) || 0;
    let skipped = (taskContext && taskContext.checkpoint && taskContext.checkpoint.skipped) || 0;
    let unreachableCount = 0;

    eventBus.emit('forestry.started', { treeFamily, targetQuantity, logsCollected });
    const startTime = Date.now();

    while (targetQuantity === null || logsCollected < targetQuantity) {
      await this.safetyCheckLoop(taskContext);

      // Check / Equip Axe
      const axeEquipped = await this.ctx.tools.equipBest('axe');
      if (!axeEquipped) {
        throw new Error('No axe available in inventory.');
      }

      // Check tool durability
      const currentTool = this.bot.heldItem;
      if (currentTool && this.ctx.tools.isAboutToBreak(currentTool, 5)) {
        const backupEquipped = await this.ctx.tools.equipBest('axe');
        if (!backupEquipped || this.ctx.tools.isAboutToBreak(this.bot.heldItem, 5)) {
          this._saveCheckpoint(taskContext, { treeFamily, targetQuantity, logsCollected, treesCut, saplingsPlanted, skipped });
          throw new Error('Axe durability is critical and no replacement is available.');
        }
      }

      // Find Candidate Logs
      const candidateLogs = await this._findCandidateLogBlocks(treeFamily, searchRadius);
      if (!candidateLogs || candidateLogs.length === 0) {
        break; // No more trees in radius
      }

      // Fetch protected base locations
      const protectedBases = this.ctx.locations ? await this.ctx.locations.listByType('base') : [];

      let treeAnalysis = null;
      let validCandidate = null;

      for (const logBlock of candidateLogs) {
        await this.safetyCheckLoop(taskContext);
        const analysis = this.analyzer.analyzeTree(logBlock.position, { family: treeFamily !== 'any' ? treeFamily : null });
        const evalResult = forestryPolicies.shouldPreserveTree(analysis, params, protectedBases);

        if (evalResult.shouldPreserve) {
          skipped++;
          eventBus.emit('forestry.skipped', { position: logBlock.position, reason: evalResult.reason });
          continue;
        }

        treeAnalysis = analysis;
        validCandidate = logBlock;
        break;
      }

      if (!treeAnalysis) {
        unreachableCount++;
        if (unreachableCount >= forestryConfig.MAX_UNREACHABLE_TREES_BEFORE_STOP) {
          break;
        }
        await new Promise((r) => setTimeout(r, forestryConfig.TREE_RESCAN_DELAY_MS));
        continue;
      }

      unreachableCount = 0;

      // Navigate to safe access position
      const accessPos = this.analyzer.getAccessPosition(treeAnalysis.rootPosition);
      if (!accessPos) {
        skipped++;
        continue;
      }

      const navSuccess = await this.ctx.nav.goTo(accessPos, { allowBreak: false });
      if (!navSuccess) {
        skipped++;
        continue;
      }

      // Cut Logs in Safe Top-Down Order
      const cutOrder = this.analyzer.getSafeCutOrder(treeAnalysis);
      for (const logPos of cutOrder) {
        await this.safetyCheckLoop(taskContext);

        const currentBlock = this.bot.blockAt(logPos, false);
        if (!currentBlock || !currentBlock.name.includes('log') && !currentBlock.name.includes('stem')) {
          continue;
        }

        await this.ctx.tools.equipBest('axe');
        await this.bot.dig(currentBlock, true);
        logsCollected++;

        eventBus.emit('forestry.log_cut', {
          family: treeAnalysis.family,
          logsCollected,
          targetQuantity,
          position: logPos
        });

        if (logsCollected % forestryConfig.PROGRESS_EMIT_EVERY_LOGS === 0) {
          this.ctx.messageRouter.send(3, `Woodcutting progress: ${logsCollected}/${targetQuantity || '∞'} logs collected.`);
        }

        if (logsCollected % forestryConfig.CHECKPOINT_EVERY_LOGS === 0) {
          this._saveCheckpoint(taskContext, { treeFamily, targetQuantity, logsCollected, treesCut, saplingsPlanted, skipped, lastRoot: treeAnalysis.rootPosition });
        }

        if (targetQuantity !== null && logsCollected >= targetQuantity) {
          break;
        }
      }

      treesCut++;
      eventBus.emit('forestry.tree_completed', { family: treeAnalysis.family, treesCut, logsCollected });

      // Collect Nearby Drops (logs, saplings, apples)
      await this._collectNearbyDrops(treeAnalysis.rootPosition);

      // Replant if enabled
      if (shouldReplant) {
        const planted = await this.replantTree(treeAnalysis, params);
        if (planted) saplingsPlanted += planted;
      }

      // Inventory capacity check
      if (this.ctx.inv.isFull(forestryConfig.INVENTORY_FULL_RATIO)) {
        await this._handleFullInventory();
      }
    }

    const durationMs = Date.now() - startTime;
    const result = { logsCollected, treesCut, saplingsPlanted, skipped, durationMs };

    eventBus.emit('forestry.completed', result);
    this.ctx.messageRouter.send(3, `Woodcutting finished: ${logsCollected} logs collected across ${treesCut} trees.`);

    return result;
  }

  /**
   * Replants saplings on valid ground at the tree's root position.
   * @param {Object} treeAnalysis
   * @param {Object} params
   * @returns {Promise<number>} Number of saplings planted
   */
  async replantTree(treeAnalysis, params = {}) {
    if (!treeAnalysis || !treeAnalysis.rootPosition) return 0;
    const family = treeAnalysis.family;
    const familyDef = treeData.families[family];
    if (!familyDef || !familyDef.saplingItem) return 0;

    const reqCount = forestryPolicies.getReplantRequirement(family);
    const saplingItemName = familyDef.saplingItem;

    // Check sapling availability in inventory
    const saplingItem = this.ctx.inv.findItem(saplingItemName);
    if (!saplingItem || saplingItem.count < reqCount) {
      return 0;
    }

    // Verify ground substrate
    const rootPos = treeAnalysis.rootPosition;
    const groundBlock = this.bot.blockAt({ x: rootPos.x, y: rootPos.y - 1, z: rootPos.z }, false);
    if (!groundBlock || !familyDef.plantableGround.includes(groundBlock.name)) {
      return 0;
    }

    try {
      await this.ctx.inv.equip(saplingItemName, 'hand');
      await this.bot.placeBlock(groundBlock, { x: 0, y: 1, z: 0 });
      eventBus.emit('forestry.replanted', { family, position: rootPos, count: 1 });
      return 1;
    } catch (err) {
      return 0; // Replant failures are non-fatal
    }
  }

  /**
   * Discovers matching candidate logs within search radius.
   * @private
   */
  async _findCandidateLogBlocks(treeFamily, radius) {
    const targetBlocks = [];
    if (treeFamily === 'any') {
      for (const f of Object.values(treeData.families)) {
        targetBlocks.push(...f.logBlocks, ...f.strippedLogBlocks);
      }
    } else {
      const def = treeData.families[treeFamily];
      if (def) targetBlocks.push(...def.logBlocks, ...def.strippedLogBlocks);
    }

    return this.ctx.target.findAllInRadius(targetBlocks, radius, 30);
  }

  /**
   * Collects drops around the felled tree.
   * @private
   */
  async _collectNearbyDrops(centerPos) {
    if (!this.bot.entities) return;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item' && entity.position) {
        const dx = entity.position.x - centerPos.x;
        const dz = entity.position.z - centerPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= forestryConfig.DROP_COLLECTION_RADIUS) {
          const itemMeta = entity.metadata && entity.metadata[8];
          const itemName = itemMeta ? itemMeta.name : 'item';

          if (forestryPolicies.shouldCollectDrop(itemName)) {
            await this.ctx.nav.goTo(entity.position, { allowBreak: false, timeoutMs: 3000 });
          }
        }
      }
    }
  }

  /**
   * Handles full inventory during long-running forestry tasks.
   * @private
   */
  async _handleFullInventory() {
    const chest = this.ctx.locations ? await this.ctx.locations.findNearestChest() : null;
    if (chest) {
      await this.ctx.nav.goTo({ x: chest.x, y: chest.y, z: chest.z }, { allowBreak: false });
      await this.ctx.inv.depositAll('logs', chest);
    } else {
      // Drop lowest value junk items, preserving wood/saplings/tools
      await this.ctx.inv.dropLowValueItems({}, 10);
    }
  }

  /**
   * Helper saving checkpoint state into TaskManager.
   * @private
   */
  _saveCheckpoint(taskContext, data) {
    if (taskContext && typeof taskContext.saveCheckpoint === 'function') {
      taskContext.saveCheckpoint({
        treeType: data.treeFamily,
        requestedQuantity: data.targetQuantity,
        logsCollected: data.logsCollected,
        treesCut: data.treesCut,
        saplingsPlanted: data.saplingsPlanted,
        skipped: data.skipped,
        lastSearchPosition: this.bot.entity ? this.bot.entity.position : null,
        lastTreeRoot: data.lastRoot || null
      });
    }
  }
}

module.exports = ChopTreeSkill;
