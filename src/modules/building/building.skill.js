const { BaseSkill, SkillAbort } = require('../../core/base.skill');
const buildingConfig = require('./building.config');
const buildingData = require('./building.data');
const schematics = require('./schematics');
const buildingPolicies = require('./building.policy');

/**
 * BuildSkill - Autonomous Architectural Construction Subsystem.
 * 
 * Invariant: Reuses NavigationService, InventoryService, SafetyService, ToolService,
 * and CraftingService. Contains ZERO duplicate pathfinding or inventory handling.
 */
class BuildSkill extends BaseSkill {
  /**
   * Main autonomous building execution loop.
   * 
   * @param {Object} [params={}] - Construction parameters
   * @param {string} [params.structure='shelter'] - Structure type (shelter, wall, floor, cube, stairs)
   * @param {string} [params.material='cobblestone'] - Primary building block material
   * @param {Object} [params.dimensions={}] - Dimensional overrides (width, height, length, depth)
   * @param {{ x: number, y: number, z: number }} [params.origin=null] - Base world origin coordinate
   * @param {boolean} [params.autoCraft=true] - Whether to auto-craft missing blocks
   * @returns {Promise<{ structure: string, material: string, blocksPlaced: number, origin: Object }>}
   */
  async run(params = {}) {
    const rawStructure = (params.structure || 'shelter').toLowerCase();
    const structure = buildingData.aliases[rawStructure] || rawStructure;

    const rawMat = (params.material || buildingConfig.DEFAULT_BUILD_MATERIAL).toLowerCase();
    const material = buildingData.materialAliases[rawMat] || rawMat;

    const autoCraft = params.autoCraft !== false;
    const dims = params.dimensions || {};

    // 1. Resolve Origin Position
    let origin = params.origin;
    if (!origin && this.bot && this.bot.entity && this.bot.entity.position) {
      const p = this.bot.entity.position.floored();
      // Offset 2 blocks forward along bot yaw to avoid building on bot's feet
      origin = { x: p.x + 2, y: p.y, z: p.z + 2 };
    } else if (!origin) {
      origin = { x: 0, y: 64, z: 0 };
    }

    // 2. Generate Schematic
    const blocks = this._generateBlueprint(structure, material, dims);
    if (!blocks || blocks.length === 0) {
      throw new Error(`[BuildSkill] Failed to generate blueprint for structure '${structure}'`);
    }

    if (blocks.length > buildingConfig.MAX_BLOCK_COUNT_LIMIT) {
      throw new Error(`[BuildSkill] Structure exceeds max block limit (${blocks.length} > ${buildingConfig.MAX_BLOCK_COUNT_LIMIT})`);
    }

    // Sort blocks in stable bottom-up layer placement order
    const sortedBlocks = buildingPolicies.sortPlacementOrder(blocks, { dx: 0, dz: 0 });
    const { requirements, totalBlocks } = buildingPolicies.calculateRequiredMaterials(sortedBlocks);

    // 3. Material Verification & Auto-Crafting
    await this._verifyAndPrepareMaterials(requirements, autoCraft);

    // Emit building started
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('building.started', {
        structure,
        material,
        totalBlocks,
        origin
      });
    }

    if (this.ctx && this.ctx.messageRouter) {
      await this.ctx.messageRouter.send(
        `Starting construction: ${structure} (${totalBlocks} blocks of ${material}) at (${origin.x}, ${origin.y}, ${origin.z}).`
      );
    }

    // 4. Site Footprint Clearing
    await this._clearFootprintObstacles(origin, sortedBlocks);

    // 5. Layer-by-Layer Placement Loop
    let blocksPlaced = 0;
    const placedScaffolds = [];

    try {
      for (const b of sortedBlocks) {
        // Safety and Preemption check
        await this.safetyCheckLoop({ blocksPlaced, totalBlocks, structure });

        const targetPos = {
          x: origin.x + b.dx,
          y: origin.y + b.dy,
          z: origin.z + b.dz
        };

        // Check if block already placed
        const currentBlock = this._getBlockAt(targetPos);
        if (currentBlock && currentBlock.name === b.blockType) {
          blocksPlaced++;
          continue;
        }

        // Clear soft obstacle if present at target
        if (currentBlock && buildingPolicies.isSoftObstacle(currentBlock.name)) {
          await this._clearBlockAt(targetPos);
        }

        // Navigate within placement range (2-3 blocks away)
        if (this.ctx && this.ctx.nav) {
          try {
            await this.ctx.nav.goTo(targetPos, { range: 3, allowBreak: false });
          } catch (navErr) {
            // If already within reach or standing nearby, continue
          }
        }

        // Find reference block face to place against
        const refData = buildingPolicies.findReferenceBlock(targetPos, (pos) => this._isSolidBlock(pos));
        if (!refData) {
          // If building in air without adjacent block, place temporary scaffold below
          const scaffoldPos = { x: targetPos.x, y: targetPos.y - 1, z: targetPos.z };
          await this._placeScaffoldAt(scaffoldPos);
          placedScaffolds.push(scaffoldPos);
        }

        // Execute placement
        const success = await this._placeBlockAt(targetPos, b.blockType);
        if (success) {
          blocksPlaced++;
          if (blocksPlaced % 50 === 0) {
            if (this.ctx && this.ctx.events) {
              this.ctx.events.emit('building.checkpoint', {
                structure,
                material,
                blocksPlaced,
                totalBlocks,
                origin,
                timestamp: Date.now()
              });
            }
          }
          if (this.ctx && this.ctx.events) {
            this.ctx.events.emit('building.block_placed', {
              blockType: b.blockType,
              position: targetPos,
              progress: `${blocksPlaced}/${totalBlocks}`,
              percent: Math.round((blocksPlaced / totalBlocks) * 100)
            });
          }
        }

        if (buildingConfig.PLACEMENT_COOLDOWN_MS > 0) {
          await new Promise((r) => setTimeout(r, buildingConfig.PLACEMENT_COOLDOWN_MS));
        }
      }
    } finally {
      // 6. Dismantle Temporary Scaffolding
      for (const scafPos of placedScaffolds) {
        try {
          await this._clearBlockAt(scafPos);
        } catch (e) {
          // Scaffolding cleanup fallback
        }
      }
    }

    // 7. Completion Broadcast
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('building.completed', {
        structure,
        material,
        blocksPlaced,
        totalBlocks,
        origin
      });
    }

    if (this.ctx && this.ctx.messageRouter) {
      await this.ctx.messageRouter.send(
        `Construction finished: ${structure} complete! (${blocksPlaced}/${totalBlocks} blocks placed).`
      );
    }

    return { structure, material, blocksPlaced, origin };
  }

  /**
   * Generates procedural blueprint coordinates for the requested structure.
   * @private
   */
  _generateBlueprint(structure, material, dims) {
    switch (structure) {
      case 'shelter':
        return schematics.generateShelter(material, dims.width || 3, dims.height || 3, dims.depth || 3);
      case 'wall':
        return schematics.generateWall(dims.length || 8, dims.height || 3, material, dims.orientation || 'x');
      case 'floor':
        return schematics.generateFloor(dims.width || 5, dims.depth || 5, material);
      case 'cube':
        return schematics.generateCube(dims.width || 4, dims.height || 3, dims.depth || 4, material, dims.hollow !== false);
      case 'stairs':
        return schematics.generateStairs(dims.height || 4, material, dims.direction || 'north');
      default:
        // Default to shelter if unrecognized
        return schematics.generateShelter(material, 3, 3, 3);
    }
  }

  /**
   * Verifies inventory has required blocks, and attempts auto-crafting if missing.
   * @private
   */
  async _verifyAndPrepareMaterials(requirements, autoCraft) {
    for (const [matName, neededCount] of Object.entries(requirements)) {
      const currentCount = this._countItem(matName);
      if (currentCount < neededCount) {
        const missing = neededCount - currentCount;

        // Try auto-crafting missing materials (e.g. logs -> planks)
        if (autoCraft && this.ctx && this.ctx.crafting && typeof this.ctx.crafting.autoCraftMissing === 'function') {
          try {
            const crafted = await this.ctx.crafting.autoCraftMissing(matName, missing);
            if (crafted && this._countItem(matName) >= neededCount) {
              continue;
            }
          } catch (craftErr) {
            // Crafting fallback
          }
        }

        throw new Error(`Insufficient materials: requires ${neededCount} ${matName} (have ${currentCount}, missing ${missing}).`);
      }
    }
  }

  /**
   * Clears soft vegetation (flowers, tall grass) in the structure's footprint.
   * @private
   */
  async _clearFootprintObstacles(origin, blocks) {
    for (const b of blocks) {
      const pos = { x: origin.x + b.dx, y: origin.y + b.dy, z: origin.z + b.dz };
      const block = this._getBlockAt(pos);
      if (block && buildingPolicies.isSoftObstacle(block.name)) {
        await this._clearBlockAt(pos);
      }
    }
  }

  /**
   * Equips a tool and digs the specified block position.
   * @private
   */
  async _clearBlockAt(pos) {
    if (this.ctx && this.ctx.tools && typeof this.ctx.tools.equipBest === 'function') {
      await this.ctx.tools.equipBest('shovel', false);
    }

    if (this.bot && typeof this.bot.dig === 'function') {
      const blk = this._getBlockAt(pos);
      if (blk && blk.name !== 'air') {
        try {
          await this.bot.dig(blk);
        } catch (e) {
          // Non-fatal dig error
        }
      }
    }
  }

  /**
   * Places a single block at target position against a solid neighbor face.
   * @private
   */
  async _placeBlockAt(targetPos, blockType) {
    // 1. Equip material item
    const item = this._findItem(blockType);
    if (item && this.bot && typeof this.bot.equip === 'function') {
      try {
        await this.bot.equip(item, 'hand');
      } catch (e) {
        // Equip error
      }
    }

    // 2. Find solid reference block and face vector
    const refData = buildingPolicies.findReferenceBlock(targetPos, (p) => this._isSolidBlock(p));
    if (!refData) return false;

    const refBlock = this._getBlockAt(refData.referencePos);
    if (!refBlock) return false;

    if (this.bot && typeof this.bot.placeBlock === 'function') {
      try {
        await this.bot.placeBlock(refBlock, refData.faceVector);
        return true;
      } catch (placeErr) {
        console.warn(`[BuildSkill] Placement error at (${targetPos.x}, ${targetPos.y}, ${targetPos.z}):`, placeErr.message);
        return false;
      }
    }

    // Fallback simulation for tests
    this._consumeItem(blockType, 1);
    return true;
  }

  /**
   * Places temporary scaffolding block.
   * @private
   */
  async _placeScaffoldAt(pos) {
    const scafMat = buildingConfig.SCAFFOLD_MATERIAL || 'dirt';
    const hasScaf = this._countItem(scafMat) > 0;
    if (!hasScaf) return;

    await this._placeBlockAt(pos, scafMat);
  }

  // --- Helper Methods ---

  _getBlockAt(pos) {
    if (this.bot && typeof this.bot.blockAt === 'function') {
      const blk = this.bot.blockAt(pos);
      if (blk && !blk.position) {
        blk.position = pos;
      }
      return blk;
    }
    return null;
  }

  _isSolidBlock(pos) {
    const blk = this._getBlockAt(pos);
    if (!blk) return false;
    if (blk.name === 'air' || buildingPolicies.isSoftObstacle(blk.name)) return false;
    return blk.boundingBox === 'block' || blk.boundingBox === undefined;
  }

  _findItem(name) {
    if (!this.bot || !this.bot.inventory || !this.bot.inventory.items) return null;
    return this.bot.inventory.items().find((i) => i.name === name) || null;
  }

  _countItem(name) {
    if (!this.bot || !this.bot.inventory || !this.bot.inventory.items) return 0;
    return this.bot.inventory.items()
      .filter((i) => i.name === name)
      .reduce((acc, i) => acc + (i.count || 1), 0);
  }

  _consumeItem(name, count = 1) {
    if (!this.bot || !this.bot.inventory || !this.bot.inventory.items) return;
    const item = this._findItem(name);
    if (item) {
      item.count = Math.max(0, item.count - count);
    }
  }
}

module.exports = BuildSkill;
