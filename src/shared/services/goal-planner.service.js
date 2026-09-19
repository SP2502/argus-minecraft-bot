/**
 * GoalPlannerService - Hierarchical Goal Decomposition & Prerequisite Recipe Planner.
 * 
 * Analyzes high-level player goals (e.g. "mine diamonds", "craft iron pickaxe") against
 * the bot's current inventory and environmental context. Recursively resolves missing
 * tool tiers, crafting stations (crafting table, furnace), smelting requirements, and
 * precursor raw materials to formulate an actionable, multi-step execution workflow.
 */

const Priorities = require('../config/priorities');

class GoalPlannerService {
  /**
   * @param {import('mineflayer').Bot} [bot] - Mineflayer bot reference
   * @param {import('../../core/BotContext')} [ctx] - BotContext reference
   */
  constructor(bot = null, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;

    // Numerical tool tiers matching Minecraft progression
    this.TIERS = Object.freeze({
      HAND: 0,
      WOOD: 1,
      GOLD: 1,
      STONE: 2,
      IRON: 3,
      DIAMOND: 4,
      NETHERITE: 5
    });

    // Minimum pickaxe tier required to harvest ore drops
    this.MINING_REQUIREMENTS = Object.freeze({
      // Tier 4 (Diamond Pickaxe)
      ancient_debris: { tier: 4, tool: 'diamond_pickaxe', name: 'Ancient Debris' },
      obsidian: { tier: 4, tool: 'diamond_pickaxe', name: 'Obsidian' },
      crying_obsidian: { tier: 4, tool: 'diamond_pickaxe', name: 'Crying Obsidian' },

      // Tier 3 (Iron Pickaxe)
      diamond: { tier: 3, tool: 'iron_pickaxe', name: 'Diamonds' },
      diamond_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Diamond Ore' },
      deepslate_diamond_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Deepslate Diamond Ore' },
      gold: { tier: 3, tool: 'iron_pickaxe', name: 'Gold' },
      gold_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Gold Ore' },
      deepslate_gold_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Deepslate Gold Ore' },
      nether_gold_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Nether Gold Ore' },
      raw_gold: { tier: 3, tool: 'iron_pickaxe', name: 'Raw Gold' },
      redstone: { tier: 3, tool: 'iron_pickaxe', name: 'Redstone' },
      redstone_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Redstone Ore' },
      deepslate_redstone_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Deepslate Redstone Ore' },
      emerald: { tier: 3, tool: 'iron_pickaxe', name: 'Emeralds' },
      emerald_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Emerald Ore' },
      deepslate_emerald_ore: { tier: 3, tool: 'iron_pickaxe', name: 'Deepslate Emerald Ore' },

      // Tier 2 (Stone Pickaxe)
      iron: { tier: 2, tool: 'stone_pickaxe', name: 'Iron' },
      iron_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Iron Ore' },
      deepslate_iron_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Deepslate Iron Ore' },
      raw_iron: { tier: 2, tool: 'stone_pickaxe', name: 'Raw Iron' },
      lapis: { tier: 2, tool: 'stone_pickaxe', name: 'Lapis Lazuli' },
      lapis_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Lapis Ore' },
      deepslate_lapis_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Deepslate Lapis Ore' },
      copper: { tier: 2, tool: 'stone_pickaxe', name: 'Copper' },
      copper_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Copper Ore' },
      deepslate_copper_ore: { tier: 2, tool: 'stone_pickaxe', name: 'Deepslate Copper Ore' },
      raw_copper: { tier: 2, tool: 'stone_pickaxe', name: 'Raw Copper' },

      // Tier 1 (Wooden Pickaxe)
      coal: { tier: 1, tool: 'wooden_pickaxe', name: 'Coal' },
      coal_ore: { tier: 1, tool: 'wooden_pickaxe', name: 'Coal Ore' },
      deepslate_coal_ore: { tier: 1, tool: 'wooden_pickaxe', name: 'Deepslate Coal Ore' },
      stone: { tier: 1, tool: 'wooden_pickaxe', name: 'Stone' },
      cobblestone: { tier: 1, tool: 'wooden_pickaxe', name: 'Cobblestone' },
      deepslate: { tier: 1, tool: 'wooden_pickaxe', name: 'Deepslate' },
      cobbled_deepslate: { tier: 1, tool: 'wooden_pickaxe', name: 'Cobbled Deepslate' },
      netherrack: { tier: 1, tool: 'wooden_pickaxe', name: 'Netherrack' },
      sandstone: { tier: 1, tool: 'wooden_pickaxe', name: 'Sandstone' }
    });
  }

  /**
   * Resolves the minimum pickaxe tier and tool name required for a given target ore or block.
   * @param {string} oreName
   * @returns {{ tier: number, tool: string, name: string }}
   */
  getRequiredPickaxeTier(oreName) {
    if (!oreName || typeof oreName !== 'string') {
      return { tier: 0, tool: 'none', name: 'Block' };
    }
    const clean = oreName.toLowerCase().trim();
    if (this.MINING_REQUIREMENTS[clean]) {
      return this.MINING_REQUIREMENTS[clean];
    }

    // Match partial names (e.g. "diamond" in "deepslate_diamond_ore")
    for (const [key, req] of Object.entries(this.MINING_REQUIREMENTS)) {
      if (clean.includes(key) || key.includes(clean)) {
        return req;
      }
    }

    return { tier: 0, tool: 'none', name: oreName };
  }

  /**
   * Inspects an inventory or item list to find the highest-tier pickaxe available.
   * @param {Object|Array} [inventory] - InventoryService instance or item array
   * @returns {number} Highest pickaxe tier (0 = none)
   */
  getBestAvailablePickaxeTier(inventory) {
    const items = this._extractItems(inventory);
    let highestTier = 0;

    for (const item of items) {
      if (!item || !item.name) continue;
      const name = item.name.toLowerCase();
      if (!name.includes('pickaxe')) continue;

      if (name.startsWith('netherite_')) highestTier = Math.max(highestTier, this.TIERS.NETHERITE);
      else if (name.startsWith('diamond_')) highestTier = Math.max(highestTier, this.TIERS.DIAMOND);
      else if (name.startsWith('iron_')) highestTier = Math.max(highestTier, this.TIERS.IRON);
      else if (name.startsWith('stone_')) highestTier = Math.max(highestTier, this.TIERS.STONE);
      else if (name.startsWith('golden_') || name.startsWith('gold_')) highestTier = Math.max(highestTier, this.TIERS.GOLD);
      else if (name.startsWith('wooden_') || name.startsWith('wood_')) highestTier = Math.max(highestTier, this.TIERS.WOOD);
    }

    return highestTier;
  }

  /**
   * Inspects count of a specific item in inventory.
   * @param {Object|Array} [inventory]
   * @param {string} itemName
   * @returns {number}
   */
  countItem(inventory, itemName) {
    const items = this._extractItems(inventory);
    return items
      .filter((i) => i && i.name && (i.name === itemName || i.name.endsWith(`_${itemName}`)))
      .reduce((sum, i) => sum + (i.count || 1), 0);
  }

  /**
   * Extracts an array of items from various input shapes (InventoryService, Bot, or Array).
   * @private
   */
  _extractItems(inventory) {
    if (Array.isArray(inventory)) return inventory;
    if (inventory && typeof inventory.items === 'function') return inventory.items();
    if (inventory && Array.isArray(inventory.items)) return inventory.items;
    if (inventory && inventory.bot && inventory.bot.inventory) return inventory.bot.inventory.items();
    if (this.ctx && this.ctx.inv && typeof this.ctx.inv.getInventoryItems === 'function') {
      return this.ctx.inv.getInventoryItems();
    }
    if (this.bot && this.bot.inventory) return this.bot.inventory.items();
    return [];
  }

  /**
   * Decomposes a target operation (e.g. mine diamonds) into an intelligent prerequisite workflow.
   * 
   * If the bot already possesses the required tools and materials, returns the original
   * operation unmodified with isDecomposed = false.
   * 
   * @param {Object} operation - Operation descriptor from CommandPlanner
   * @param {Object|Array} [inventory] - Optional inventory snapshot
   * @returns {{ isDecomposed: boolean, steps: Array<Object>, explanation: string, summary: string }}
   */
  decompose(operation, inventory = null) {
    if (!operation) {
      return { isDecomposed: false, steps: [], explanation: '', summary: '' };
    }

    const intent = operation.intentName || operation.skillName;

    // 1. Mining Goal Decomposition
    if (intent === 'mine') {
      return this._decomposeMiningGoal(operation, inventory);
    }

    // 2. Crafting Goal Decomposition (e.g. "craft iron pickaxe" with no iron)
    if (intent === 'craft') {
      return this._decomposeCraftingGoal(operation, inventory);
    }

    // Default: No decomposition required
    return {
      isDecomposed: false,
      steps: [operation],
      explanation: '',
      summary: ''
    };
  }

  /**
   * Decomposes mining goals by analyzing required tool tiers and crafting/smelting prerequisites.
   * @private
   */
  _decomposeMiningGoal(operation, inventory) {
    const params = operation.params || {};
    const targetOre = (params.targetOre || 'diamond').toLowerCase().trim();
    const quantity = params.quantity || 64;

    const req = this.getRequiredPickaxeTier(targetOre);
    const currentPickaxeTier = this.getBestAvailablePickaxeTier(inventory);

    // If bot already has a sufficient pickaxe, no preparation workflow is needed
    if (currentPickaxeTier >= req.tier) {
      return {
        isDecomposed: false,
        steps: [operation],
        explanation: '',
        summary: `Sufficient pickaxe tier (${currentPickaxeTier} >= ${req.tier}) available. Direct mining ready.`
      };
    }

    // Bot lacks the necessary pickaxe tier. Build the prerequisite workflow!
    const steps = [];
    const stepDescriptions = [];
    let stepNum = 1;

    const ironIngots = this.countItem(inventory, 'iron_ingot');
    const rawIron = this.countItem(inventory, 'raw_iron') + this.countItem(inventory, 'iron_ore');
    const cobblestone = this.countItem(inventory, 'cobblestone');
    const woodLogs = this.countItem(inventory, 'log');
    const planks = this.countItem(inventory, 'planks');
    const hasFurnace = this.countItem(inventory, 'furnace') > 0;

    // Case 1: Target requires Iron Pickaxe (Tier 3), such as Diamonds, Gold, or Redstone
    if (req.tier >= this.TIERS.IRON) {
      // Check if we already have iron ingots ready to craft an iron pickaxe
      if (ironIngots >= 3) {
        steps.push(this._createCraftStep('iron_pickaxe', 1, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Craft iron pickaxe`);
      } else {
        // Need to acquire and smelt iron
        // Does the bot have a Stone Pickaxe to mine iron?
        if (currentPickaxeTier < this.TIERS.STONE) {
          // Does the bot have a Wooden Pickaxe to mine cobblestone?
          if (currentPickaxeTier < this.TIERS.WOOD) {
            // Need to gather wood first
            if (woodLogs < 4 && planks < 8) {
              steps.push(this._createChopStep(6, operation.priority));
              stepDescriptions.push(`[${stepNum++}] Gather wood`);
            }
            steps.push(this._createCraftStep('wooden_pickaxe', 1, operation.priority));
            stepDescriptions.push(`[${stepNum++}] Craft wooden pickaxe`);
          }

          // Mine stone for cobblestone (need 3 for stone pickaxe + 8 for furnace = 11)
          const neededCobble = Math.max(0, 12 - cobblestone);
          if (neededCobble > 0) {
            steps.push(this._createMineStep('cobblestone', neededCobble, 60, operation.priority));
            stepDescriptions.push(`[${stepNum++}] Mine cobblestone`);
          }

          // Craft stone pickaxe
          steps.push(this._createCraftStep('stone_pickaxe', 1, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Craft stone pickaxe`);
        }

        // Craft furnace if not present
        if (!hasFurnace) {
          steps.push(this._createCraftStep('furnace', 1, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Craft furnace`);
        }

        // Mine iron ore with stone pickaxe
        const neededIron = Math.max(0, 3 - rawIron);
        if (neededIron > 0) {
          steps.push(this._createMineStep('iron', Math.max(neededIron, 3), 16, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Mine iron ore`);
        }

        // Smelt iron in furnace
        steps.push(this._createSmeltStep('raw_iron', 3, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Smelt iron ingots`);

        // Craft iron pickaxe
        steps.push(this._createCraftStep('iron_pickaxe', 1, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Craft iron pickaxe`);
      }
    }

    // Case 2: Target requires Stone Pickaxe (Tier 2), such as Iron or Copper
    else if (req.tier >= this.TIERS.STONE) {
      if (currentPickaxeTier < this.TIERS.WOOD) {
        if (woodLogs < 4 && planks < 8) {
          steps.push(this._createChopStep(4, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Gather wood`);
        }
        steps.push(this._createCraftStep('wooden_pickaxe', 1, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Craft wooden pickaxe`);
      }

      const neededCobble = Math.max(0, 4 - cobblestone);
      if (neededCobble > 0) {
        steps.push(this._createMineStep('cobblestone', neededCobble, 60, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Mine cobblestone`);
      }

      steps.push(this._createCraftStep('stone_pickaxe', 1, operation.priority));
      stepDescriptions.push(`[${stepNum++}] Craft stone pickaxe`);
    }

    // Case 3: Target requires Wooden Pickaxe (Tier 1), such as Coal or Cobblestone
    else if (req.tier >= this.TIERS.WOOD) {
      if (woodLogs < 2 && planks < 4) {
        steps.push(this._createChopStep(3, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Gather wood`);
      }
      steps.push(this._createCraftStep('wooden_pickaxe', 1, operation.priority));
      stepDescriptions.push(`[${stepNum++}] Craft wooden pickaxe`);
    }

    // Finally: append the original target mining operation!
    const finalMineOp = {
      ...operation,
      operationId: `op_${Date.now()}_final`,
      dependsOn: steps.length > 0 ? [steps[steps.length - 1].operationId] : []
    };
    steps.push(finalMineOp);
    stepDescriptions.push(`[${stepNum++}] Mine ${targetOre}`);

    // Link dependency IDs in order
    for (let i = 1; i < steps.length; i++) {
      steps[i].dependsOn = [steps[i - 1].operationId];
    }

    const explanation = `To mine ${targetOre}, I need an ${this._formatToolName(req.tool)}. Initiating preparation: ${stepDescriptions.join(' ➔ ')}`;
    const summary = `Decomposed into ${steps.length} preparatory steps for ${req.tool}.`;

    return {
      isDecomposed: true,
      steps,
      explanation,
      summary,
      targetOre,
      requiredTool: req.tool
    };
  }

  /**
   * Decomposes crafting goals if precursor raw materials or stations are missing.
   * @private
   */
  _decomposeCraftingGoal(operation, inventory) {
    const params = operation.params || {};
    const item = (params.item || 'iron_pickaxe').toLowerCase().trim();
    const currentPickaxeTier = this.getBestAvailablePickaxeTier(inventory);
    const ironIngots = this.countItem(inventory, 'iron_ingot');
    const rawIron = this.countItem(inventory, 'raw_iron') + this.countItem(inventory, 'iron_ore');
    const cobblestone = this.countItem(inventory, 'cobblestone');

    if (item === 'iron_pickaxe' && ironIngots < 3) {
      const steps = [];
      const stepDescriptions = [];
      let stepNum = 1;

      if (currentPickaxeTier < this.TIERS.STONE) {
        if (currentPickaxeTier < this.TIERS.WOOD) {
          steps.push(this._createChopStep(5, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Gather wood`);
          steps.push(this._createCraftStep('wooden_pickaxe', 1, operation.priority));
          stepDescriptions.push(`[${stepNum++}] Craft wooden pickaxe`);
        }
        steps.push(this._createMineStep('cobblestone', 11, 60, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Mine cobblestone`);
        steps.push(this._createCraftStep('stone_pickaxe', 1, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Craft stone pickaxe`);
        steps.push(this._createCraftStep('furnace', 1, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Craft furnace`);
      }

      if (rawIron < 3) {
        steps.push(this._createMineStep('iron', 3, 16, operation.priority));
        stepDescriptions.push(`[${stepNum++}] Mine iron ore`);
      }

      steps.push(this._createSmeltStep('raw_iron', 3, operation.priority));
      stepDescriptions.push(`[${stepNum++}] Smelt iron ingots`);

      steps.push({
        ...operation,
        operationId: `op_${Date.now()}_craft_final`,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].operationId] : []
      });
      stepDescriptions.push(`[${stepNum++}] Craft iron pickaxe`);

      for (let i = 1; i < steps.length; i++) {
        steps[i].dependsOn = [steps[i - 1].operationId];
      }

      const explanation = `To craft an Iron Pickaxe, I need iron ingots and cobblestone for smelting. Initiating preparation: ${stepDescriptions.join(' ➔ ')}`;

      return {
        isDecomposed: true,
        steps,
        explanation,
        summary: `Decomposed iron pickaxe craft into ${steps.length} prerequisite steps.`
      };
    }

    return {
      isDecomposed: false,
      steps: [operation],
      explanation: '',
      summary: ''
    };
  }

  /**
   * Formats tool identifier for friendly chat communication.
   * @private
   */
  _formatToolName(tool) {
    if (!tool) return 'Tool';
    return tool.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  _createChopStep(quantity = 6, priority = Priorities.AUTONOMOUS) {
    return {
      operationId: `op_${Date.now()}_chop_${Math.random().toString(36).substr(2, 4)}`,
      intentName: 'chop_tree',
      skillName: 'chop_tree',
      params: { treeType: 'any', quantity },
      requiredPermission: 'guest',
      priority,
      locks: ['movement', 'inventory'],
      timeoutMs: 180000,
      dangerous: false,
      isControl: false,
      dependsOn: []
    };
  }

  _createCraftStep(item, quantity = 1, priority = Priorities.AUTONOMOUS) {
    return {
      operationId: `op_${Date.now()}_craft_${item}_${Math.random().toString(36).substr(2, 4)}`,
      intentName: 'craft',
      skillName: 'craft',
      params: { mode: 'craft', item, quantity },
      requiredPermission: 'guest',
      priority,
      locks: ['inventory'],
      timeoutMs: 60000,
      dangerous: false,
      isControl: false,
      dependsOn: []
    };
  }

  _createMineStep(targetOre, quantity = 8, yLevel = 60, priority = Priorities.AUTONOMOUS) {
    return {
      operationId: `op_${Date.now()}_mine_${targetOre}_${Math.random().toString(36).substr(2, 4)}`,
      intentName: 'mine',
      skillName: 'mine',
      params: { targetOre, quantity, yLevel, opportunistic: false },
      requiredPermission: 'guest',
      priority,
      locks: ['movement', 'inventory'],
      timeoutMs: 240000,
      dangerous: false,
      isControl: false,
      dependsOn: []
    };
  }

  _createSmeltStep(item, quantity = 3, priority = Priorities.AUTONOMOUS) {
    return {
      operationId: `op_${Date.now()}_smelt_${item}_${Math.random().toString(36).substr(2, 4)}`,
      intentName: 'craft',
      skillName: 'craft',
      params: { mode: 'smelt', item, quantity },
      requiredPermission: 'guest',
      priority,
      locks: ['inventory', 'movement'],
      timeoutMs: 120000,
      dangerous: false,
      isControl: false,
      dependsOn: []
    };
  }

  /**
   * Health heartbeat check for AIBrain.
   * @returns {{ ok: boolean, ready: boolean }}
   */
  ping() {
    return {
      ok: true,
      ready: true
    };
  }
}

module.exports = GoalPlannerService;
