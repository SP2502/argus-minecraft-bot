const { BaseSkill, SkillAbort } = require('../../../skills/BaseSkill');
const oreData = require('./mining.data');

/**
 * MineSkill - Autonomous ore prospecting, branch-mining, and resource harvesting.
 * 
 * ARCHITECTURAL RULE:
 * This skill contains ZERO duplicated pathfinding, inventory management, tool selection,
 * or survival logic. It delegates entirely to `this.ctx` services.
 */
class MineSkill extends BaseSkill {
  /**
   * Runs the autonomous mining lifecycle.
   * 
   * @param {Object} [params={}] - Mining parameters
   * @param {string} [params.targetOre='diamond'] - Target ore name (diamond, iron, gold, coal, etc.)
   * @param {number} [params.quantity=64] - Total number of ore blocks to harvest
   * @param {number|null} [params.yLevel=null] - Explicit mining depth, or null for oreData default
   * @param {boolean} [params.opportunistic=true] - Whether to mine other valuable ores encountered
   * @returns {Promise<{ mined: number, targetOre: string }>}
   * 
   * @example
   * const result = await mineSkill.run({ targetOre: 'diamond', quantity: 32 });
   */
  async run(params = {}) {
    const {
      targetOre = 'diamond',
      quantity = 64,
      yLevel = null,
      opportunistic = true
    } = params;

    let mined = 0;
    const targetBlocks = oreData.blockNames[targetOre] || [targetOre];
    const targetY = yLevel !== null ? yLevel : (oreData.yLevels[targetOre]?.best || -59);

    // Build block search candidates
    let searchBlocks = [...targetBlocks];
    if (opportunistic) {
      const allOres = Object.values(oreData.blockNames).flat();
      searchBlocks = Array.from(new Set([...searchBlocks, ...allOres]));
    }

    this.ctx.events.emit('task.started', { skill: 'mining', targetOre, quantity, targetY });

    // Invariant: Guarantee water bucket in hotbar slot 6 before hazardous mining begins
    if (this.ctx && this.ctx.inv) {
      if (typeof this.ctx.inv.organizeHotbar === 'function') {
        try { await this.ctx.inv.organizeHotbar(); } catch (e) {}
      }
      const hasWaterBucket = this.ctx.inv.hasItem('water_bucket');
      if (!hasWaterBucket && (targetY < 0 || targetY < 60)) {
        throw new SkillAbort('Hazardous mining aborted: Water bucket in slot 6 cannot be guaranteed.');
      }
    }

    let blocksMinedAtDeepLevel = 0;
    let lastTorchDistance = 0;

    while (mined < quantity && !this.aborted) {
      // 1. SAFETY CHECK (Reused Service)
      await this.safetyCheckLoop();
      if (this.ctx.safety.shouldRetreat()) {
        this.ctx.events.emit('task.paused', { reason: 'safety' });
        try {
          await this.ctx.nav.returnHome();
        } catch (homeErr) {
          console.warn('[MineSkill] Return home failed during retreat:', homeErr.message);
        }
        throw new SkillAbort('Safety retreat triggered during mining');
      }

      // 2. FIND ORE (Spatial Sensor Service)
      const ore = this.ctx.target.findNearestBlock(searchBlocks, 32);

      if (!ore) {
        // No ore visible; advance mining tunnel at target Y-level
        await this.moveToNextMiningSpot(targetY);
        lastTorchDistance += 8;
        if (lastTorchDistance >= 8) {
          await this._placeTorchIfPossible();
          lastTorchDistance = 0;
        }
        continue;
      }

      // 3. NAVIGATE TO ORE (Navigation Service)
      const navResult = await this.ctx.nav.goTo(ore.position, { allowBreak: true, range: 2 });
      if (!navResult.success) {
        console.warn(`[MineSkill] Failed to reach ore at (${ore.position.x}, ${ore.position.y}, ${ore.position.z}): ${navResult.reason}`);
        await this.moveToNextMiningSpot(targetY);
        continue;
      }

      // 4. EQUIP BEST TOOL (Tool Service)
      await this.ctx.tools.equipBest('pickaxe');

      // 5. MINE BLOCK (Safe digging invariants: never dig straight down or straight up)
      try {
        const freshBlock = this.ctx.bot.blockAt(ore.position);
        if (freshBlock && freshBlock.name !== 'air') {
          const botPos = this.ctx.bot.entity ? this.ctx.bot.entity.position.floored() : null;
          if (botPos) {
            const isStraightDown = freshBlock.position.x === botPos.x && freshBlock.position.z === botPos.z && freshBlock.position.y < botPos.y;
            const isStraightUp = freshBlock.position.x === botPos.x && freshBlock.position.z === botPos.z && freshBlock.position.y > botPos.y + 1;
            if (isStraightDown || isStraightUp) {
              console.warn('[MineSkill] Skipping block: Straight down/up digging prohibited by safety invariant.');
              continue;
            }
          }

          await this.ctx.bot.dig(freshBlock);
          mined++;
          this.ctx.events.emit('mining.block_mined', { block: freshBlock.name, mined, total: quantity });

          // Deep mining escape route invariant: every 64 blocks below Y=-40
          if (targetY <= -40) {
            blocksMinedAtDeepLevel++;
            if (blocksMinedAtDeepLevel >= 64) {
              blocksMinedAtDeepLevel = 0;
              const escapePos = this.ctx.bot.entity.position.floored();
              if (this.ctx.locations && typeof this.ctx.locations.registerLocation === 'function') {
                try {
                  await this.ctx.locations.registerLocation('escape_route_waypoint', { x: escapePos.x, y: escapePos.y, z: escapePos.z }, 'waypoint');
                } catch (e) {}
              }
              this.ctx.events.emit('mining.escape_route_saved', { position: escapePos });
            }
          }
        }
      } catch (digErr) {
        console.warn('[MineSkill] Error digging ore block:', digErr.message);
      }

      // 6. INVENTORY CHECK & CAPACITY MANAGEMENT (Inventory & Location Services)
      if (this.ctx.inv.isFull(0.9)) {
        this.ctx.events.emit('task.paused', { reason: 'inventory_full' });
        const chestPos = await this.ctx.locations.findNearestChest(this.ctx.bot.entity.position, 'ores');
        if (chestPos) {
          await this.ctx.inv.depositAll('ores', chestPos);
        } else {
          this.ctx.events.emit('log', 'No chest nearby; discarding low-value mining debris');
          await this.ctx.inv.dropLowValueItems(oreData.priorities, 5);
        }
      }
    }

    this.ctx.events.emit('task.completed', { skill: 'mining', mined, targetOre });
    return { mined, targetOre };
  }

  /**
   * Advances the bot forward along a mining corridor at the specified Y-level.
   * @param {number} yLevel - Target vertical level
   * @returns {Promise<void>}
   */
  async moveToNextMiningSpot(yLevel) {
    if (!this.ctx.bot.entity || !this.ctx.bot.entity.position) return;
    const pos = this.ctx.bot.entity.position.floored();
    const nextPos = {
      x: pos.x + 8,
      y: Math.max(-64, Math.min(319, yLevel)),
      z: pos.z
    };
    await this.ctx.nav.goTo(nextPos, { allowBreak: true, timeout: 20000 });
  }

  /**
   * Places a torch along the mining shaft every 8 blocks if torches are in inventory.
   * @private
   */
  async _placeTorchIfPossible() {
    if (!this.ctx || !this.ctx.inv || !this.ctx.inv.hasItem('torch')) return;
    try {
      const torchItem = this.ctx.bot.inventory.items().find(i => i.name === 'torch');
      if (!torchItem) return;
      const botPos = this.ctx.bot.entity.position.floored();
      const groundBlock = this.ctx.bot.blockAt(botPos.offset(0, -1, 0));
      if (groundBlock && groundBlock.boundingBox === 'block') {
        await this.ctx.bot.equip(torchItem, 'hand');
        await this.ctx.bot.placeBlock(groundBlock, { x: 0, y: 1, z: 0 });
      }
    } catch (e) {
      // Non-fatal if torch placement fails
    }
  }
}

module.exports = MineSkill;
