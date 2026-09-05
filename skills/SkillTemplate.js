const { BaseSkill } = require('./BaseSkill');

/**
 * SkillTemplate - Reference archetype for authoring new skills in future phases.
 * 
 * ARCHITECTURAL RULE:
 * Never write raw pathfinding, inventory handling, tool selection, or safety checks here.
 * Always delegate to `this.ctx` services!
 */
class SkillTemplate extends BaseSkill {
  /**
   * @param {import('../core/BotContext')} ctx - BotContext container
   */
  constructor(ctx) {
    super(ctx);
  }

  /**
   * Runs the feature skill workflow.
   * @param {Object} params - Feature-specific parameters
   * @returns {Promise<boolean>} Success status
   */
  async run(params = {}) {
    console.log(`[${this.name}] Starting execution with params:`, params);

    // 1. SAFETY PRE-CHECK
    await this.safetyCheckLoop();

    // 2. INVENTORY CHECK (via InventoryService)
    if (this.ctx.inventory.isFull()) {
      console.log(`[${this.name}] Inventory is full!`);
      // Optional: await this.ctx.inventory.depositAll('general', chestPos);
    }

    // 3. TOOL CHECK & EQUIP (via ToolService)
    // await this.ctx.tool.equipBest('pickaxe');

    // 4. TARGET DISCOVERY (via TargetFinderService)
    // const target = this.ctx.target.findNearestBlock(['iron_ore', 'deepslate_iron_ore'], 32);
    // if (!target) {
    //   console.log(`[${this.name}] No target found.`);
    //   return false;
    // }

    // 5. NAVIGATION (via NavigationService)
    // const arrived = await this.ctx.nav.goTo(target.position);
    // if (!arrived) {
    //   console.log(`[${this.name}] Failed to reach target.`);
    //   return false;
    // }

    // 6. ACTION LOOP WITH SAFETY CHECK
    // while (moreWorkAvailable && !this.aborted) {
    //   await this.safetyCheckLoop(); // Enforces safety guard on each iteration
    //   // Do feature-specific action...
    // }

    // 7. EMIT COMPLETION EVENT (via EventBus)
    this.ctx.events.emit('skill:completed', { skill: this.name, params });
    return true;
  }
}

module.exports = SkillTemplate;
