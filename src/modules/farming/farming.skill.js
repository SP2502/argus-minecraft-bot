const { BaseSkill, SkillAbort } = require('../../../skills/BaseSkill');
const cropData = require('./crops.data');

/**
 * FarmSkill - Autonomous agricultural harvesting, immediate replanting, and crop cultivation.
 * 
 * ARCHITECTURAL RULE:
 * This skill contains ZERO duplicated pathfinding, inventory handling, tool selection,
 * or health-check logic. It delegates entirely to `this.ctx` services.
 */
class FarmSkill extends BaseSkill {
  /**
   * Runs the autonomous farming and cultivation lifecycle.
   * 
   * @param {Object} [params={}] - Farming parameters
   * @param {string} [params.targetCrop='wheat'] - Crop identifier (wheat, carrot, potato, beetroot, etc.)
   * @param {boolean} [params.useBoneMeal=true] - Whether to accelerate growth with bone meal
   * @param {boolean} [params.registerFarm=false] - Whether to register current location as a known farm
   * @param {string|null} [params.farmName=null] - Custom name identifier if registering farm
   * @returns {Promise<{ harvested: number, replanted: number, targetCrop: string }>}
   * 
   * @example
   * const result = await farmSkill.run({ targetCrop: 'wheat', useBoneMeal: true });
   */
  async run(params = {}) {
    const {
      targetCrop = 'wheat',
      useBoneMeal = true,
      registerFarm = false,
      farmName = null
    } = params;

    const crop = cropData.crops[targetCrop];
    if (!crop) {
      throw new Error(`[FarmSkill] Unknown target crop: '${targetCrop}'. Available crops: [${Object.keys(cropData.crops).join(', ')}]`);
    }

    this.ctx.events.emit('task.started', { skill: 'farming', targetCrop });

    // Optional location registration
    if (registerFarm && this.ctx.bot.entity && this.ctx.bot.entity.position) {
      const pos = this.ctx.bot.entity.position.floored();
      await this.ctx.locations.registerFarm(
        farmName || `${targetCrop}_farm`,
        { x: pos.x, y: pos.y, z: pos.z },
        targetCrop
      );
      this.ctx.events.emit('log:entry', {
        severity: 'INFO',
        category: 'FARM',
        message: `Registered farm "${farmName || targetCrop}" at (${pos.x}, ${pos.y}, ${pos.z})`
      });
    }

    let harvested = 0;
    let replanted = 0;

    // Discover crop blocks in 32-block radius
    const farmArea = await this.scanForFarmArea(crop.blockName, 32);

    if (farmArea.length === 0) {
      this.ctx.events.emit('log:entry', {
        severity: 'WARN',
        category: 'FARM',
        message: `No ${targetCrop} crops found in 32-block radius.`
      });
      return { harvested: 0, replanted: 0, targetCrop };
    }

    for (const cropBlock of farmArea) {
      // 1. SAFETY CHECK (Reused Service)
      await this.safetyCheckLoop();
      if (this.ctx.safety.shouldRetreat()) {
        this.ctx.events.emit('task.paused', { reason: 'safety' });
        try {
          await this.ctx.nav.returnHome();
        } catch (homeErr) {
          console.warn('[FarmSkill] Return home failed during retreat:', homeErr.message);
        }
        throw new SkillAbort('Safety retreat triggered during farming');
      }

      // 2. MATURITY CHECK (Feature Logic)
      const freshBlock = this.ctx.bot.blockAt(cropBlock.position);
      if (!freshBlock || !this.isCropMature(freshBlock, crop)) {
        continue; // Skip immature or harvested blocks
      }

      // 3. NAVIGATE TO CROP (Navigation Service)
      const navResult = await this.ctx.nav.goTo(freshBlock.position, { range: 2 });
      if (!navResult.success) {
        continue;
      }

      // 4. EQUIP TOOL (Tool Service - Hoe)
      await this.ctx.tools.equipBest('hoe');

      // 5. HARVEST CROP
      try {
        await this.ctx.bot.dig(freshBlock);
        harvested++;
        this.ctx.events.emit('farming.crop_harvested', {
          crop: targetCrop,
          position: freshBlock.position,
          harvested,
          replanted
        });
      } catch (digErr) {
        console.warn('[FarmSkill] Error harvesting crop:', digErr.message);
      }

      // 6. IMMEDIATE REPLANT (Feature Logic)
      const wasReplanted = await this.replant(freshBlock, crop);
      if (wasReplanted) replanted++;

      // 7. OPTIONAL BONE MEAL ACCELERATION
      if (useBoneMeal && cropData.useBoneMeal[targetCrop]) {
        await this.applyBoneMeal(freshBlock);
      }

      // 8. INVENTORY CAPACITY CHECK (Inventory & Location Services)
      if (this.ctx.inv.isFull(0.9)) {
        this.ctx.events.emit('task.paused', { reason: 'inventory_full' });
        const chestPos = await this.ctx.locations.findNearestChest(this.ctx.bot.entity.position, 'crops');
        if (chestPos) {
          await this.ctx.inv.depositAll('crops', chestPos);
        } else {
          this.ctx.events.emit('log:entry', {
            severity: 'WARN',
            category: 'FARM',
            message: 'No chest nearby; clearing lowest value items'
          });
          await this.ctx.inv.dropLowValueItems(cropData.priorities, 5);
        }
      }
    }

    this.ctx.events.emit('task.completed', { skill: 'farming', harvested, replanted, targetCrop });
    return { harvested, replanted, targetCrop };
  }

  /**
   * Scans a spherical bounding volume around the bot for matching crop blocks.
   * @param {string} blockName - Target block identifier
   * @param {number} [radius=32] - Scan radius
   * @returns {Promise<Array<import('prismarine-block').Block>>}
   */
  async scanForFarmArea(blockName, radius = 32) {
    const crops = [];
    if (!this.ctx.bot.entity || !this.ctx.bot.entity.position) return crops;

    const botPos = this.ctx.bot.entity.position.floored();
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        for (let y = -3; y <= 3; y++) {
          const checkPos = botPos.offset(x, y, z);
          const block = this.ctx.bot.blockAt(checkPos);
          if (block && block.name === blockName) {
            crops.push(block);
          }
        }
      }
    }
    return crops;
  }

  /**
   * Evaluates if a crop block has reached its maximum harvestable growth stage.
   * @param {import('prismarine-block').Block} block - Crop block
   * @param {Object} crop - Crop configuration metadata
   * @returns {boolean} True if ready for harvest
   */
  isCropMature(block, crop) {
    if (!block) return false;
    if (crop.maxAge === null) {
      return true; // Melon/pumpkin presence indicates harvestability
    }

    // In modern prismarine-block, age is stored in metadata or properties.age
    const age = block.metadata !== undefined
      ? block.metadata
      : (block._properties && block._properties.age ? parseInt(block._properties.age, 10) : 0);

    return age >= crop.maxAge;
  }

  /**
   * Immediately replants a seed onto the supporting soil block.
   * @param {import('prismarine-block').Block} cropBlock - Location where crop was harvested
   * @param {Object} crop - Crop metadata
   * @returns {Promise<boolean>} True if seed was placed
   */
  async replant(cropBlock, crop) {
    const seedItemName = crop.seedItem;
    if (!this.ctx.inv.hasItem(seedItemName, 1)) {
      return false;
    }

    const groundBlock = this.ctx.bot.blockAt(cropBlock.position.offset(0, -1, 0));
    if (!groundBlock) return false;

    const validSoils = Array.isArray(crop.plantOn) ? crop.plantOn : [crop.plantOn];
    if (!validSoils.includes(groundBlock.name)) {
      return false;
    }

    // Equip seed item to hand
    const seedItem = this.ctx.bot.inventory.items().find((i) => i.name === seedItemName);
    if (!seedItem) return false;

    try {
      await this.ctx.bot.equip(seedItem, 'hand');
      await this.ctx.bot.activateBlock(groundBlock);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Applies bone meal to accelerate crop maturation.
   * @param {import('prismarine-block').Block} cropBlock - Target crop block
   * @returns {Promise<void>}
   */
  async applyBoneMeal(cropBlock) {
    if (!this.ctx.inv.hasItem('bone_meal', 1)) return;

    const boneMealItem = this.ctx.bot.inventory.items().find((i) => i.name === 'bone_meal');
    if (!boneMealItem) return;

    try {
      await this.ctx.bot.equip(boneMealItem, 'hand');
      await this.ctx.bot.activateBlock(cropBlock);
    } catch (err) {
      // Non-critical if bone meal application fails
    }
  }
}

module.exports = FarmSkill;
