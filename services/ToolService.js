const toolTiers = require('../src/modules/inventory/tool-tiers');

/**
 * ToolService - Evaluates, scores, equips, and tracks durability of equipment and tools.
 * Features must select and equip tools through this service.
 */
class ToolService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
  }

  /**
   * Evaluates the best available tool of a given type in inventory and equips it to the bot's hand.
   * 
   * @param {'pickaxe'|'axe'|'hoe'|'shovel'|'sword'|'bow'} toolType - Tool category to equip
   * @param {boolean} [autoCraft=false] - Attempt to auto-craft replacement tool if missing
   * @returns {Promise<import('prismarine-item').Item|null>} The equipped item, or null if none available
   * @example
   * const tool = await ctx.tools.equipBest('pickaxe');
   * if (tool) console.log(`Equipped ${tool.name}`);
   */
  async equipBest(toolType, autoCraft = false) {
    let bestTool = this.getBestTool(toolType);
    if (!bestTool && autoCraft && this.ctx && this.ctx.crafting) {
      const fallbackTool = `stone_${toolType}`;
      await this.ctx.crafting.autoCraftMissing(fallbackTool, 1);
      bestTool = this.getBestTool(toolType);
    }
    if (!bestTool) {
      return null;
    }

    try {
      await this.bot.equip(bestTool, 'hand');

      // Emit warning event if equipped tool is at or below warning threshold (<=20%)
      if (this.isWarning(bestTool) && this.ctx && this.ctx.events) {
        this.ctx.events.emit('tool.durability_warning', {
          tool: bestTool.name,
          durabilityPercent: this.getDurabilityPercent(bestTool),
          isCritical: this.isCritical(bestTool)
        });
      }

      return bestTool;
    } catch (err) {
      console.warn(`[ToolService] Failed to equip ${bestTool.name}:`, err.message);
      return null;
    }
  }

  /**
   * Finds and returns the best tool of a given type without equipping it.
   * Ranks tools by material tier and enchantment modifiers.
   * 
   * @param {'pickaxe'|'axe'|'hoe'|'shovel'|'sword'|'bow'} toolType - Tool category
   * @returns {import('prismarine-item').Item|null} The best tool item or null
   * @example
   * const pickaxe = ctx.tools.getBestTool('pickaxe');
   */
  getBestTool(toolType) {
    if (!this.bot || !this.bot.inventory || !toolType) return null;

    const normalizedType = toolType.toLowerCase().trim();
    const items = this.bot.inventory.items();

    // Filter items matching tool type
    const candidateTools = items.filter((item) => {
      if (!item || !item.name) return false;
      if (normalizedType === 'bow') return item.name === 'bow' || item.name === 'crossbow';
      return item.name.endsWith(`_${normalizedType}`) || item.name === normalizedType;
    });

    if (candidateTools.length === 0) return null;

    // Score candidates based on material and enchantments
    let bestTool = null;
    let highestScore = -1000;

    for (const item of candidateTools) {
      const material = this._extractMaterial(item.name);
      const enchants = this._extractEnchantments(item);
      const score = toolTiers.getEffectiveTier(material, enchants);

      // Invariant: Durability <= 5% triggers tool switching before destruction
      // Severely penalize critically damaged tools (<=5%) so healthy tools are always preferred
      const durabilityPercent = this.getDurabilityPercent(item);
      const isCrit = durabilityPercent <= 5;
      const isWarn = durabilityPercent <= 20;
      const durabilityPenalty = isCrit ? 100.0 : (isWarn ? 0.5 : 0);
      const finalScore = score - durabilityPenalty;

      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestTool = item;
      }
    }

    return bestTool;
  }

  /**
   * Calculates the remaining durability percentage (0% to 100%) for a given item.
   * 
   * @param {import('prismarine-item').Item} item - Item to inspect
   * @returns {number} Durability percentage
   * @example
   * const durability = ctx.tools.getDurabilityPercent(pickaxeItem);
   */
  getDurabilityPercent(item) {
    if (!item) return 100;

    const mcData = this.bot.registry || (this.bot.version && require('minecraft-data')(this.bot.version));
    const maxDurability = item.maxDurability || (mcData && mcData.items[item.type] && mcData.items[item.type].maxDurability);

    if (!maxDurability) {
      return 100; // Item is not damageable (e.g. blocks or basic materials)
    }

    // In Mineflayer/prismarine-item, durabilityUsed / metadata records damage taken
    const damage = item.durabilityUsed !== undefined
      ? item.durabilityUsed
      : (typeof item.metadata === 'number' ? item.metadata : 0);

    const remaining = Math.max(0, maxDurability - damage);
    return Math.round((remaining / maxDurability) * 100);
  }

  /**
   * Checks whether the inventory contains at least two tools of the specified category.
   * 
   * @param {string} toolType - Category of tool (e.g., 'pickaxe', 'axe')
   * @returns {boolean} True if a backup tool exists
   * @example
   * if (!ctx.tools.hasBackup('pickaxe')) { ... }
   */
  hasBackup(toolType) {
    if (!this.bot || !this.bot.inventory || !toolType) return false;
    const normalized = toolType.toLowerCase().trim();
    const items = this.bot.inventory.items();

    const count = items.filter((item) => {
      if (!item || !item.name) return false;
      if (normalized === 'bow') return item.name === 'bow' || item.name === 'crossbow';
      return item.name.endsWith(`_${normalized}`) || item.name === normalized;
    }).length;

    return count >= 2;
  }

  /**
   * Checks if an item is critically damaged and about to break.
   * 
   * @param {import('prismarine-item').Item} item - Item to evaluate
   * @param {number} [thresholdPercent=10] - Durability threshold percentage
   * @returns {boolean} True if durability is at or below threshold
   * @example
   * if (ctx.tools.isAboutToBreak(heldItem)) { ... }
   */
  isAboutToBreak(item, thresholdPercent = 10) {
    if (!item) return false;
    return this.getDurabilityPercent(item) <= thresholdPercent;
  }

  /**
   * Evaluates if an item has reached the warning durability threshold (<=20%).
   * @param {import('prismarine-item').Item} item
   * @returns {boolean}
   */
  isWarning(item) {
    if (!item) return false;
    return this.getDurabilityPercent(item) <= 20;
  }

  /**
   * Evaluates if an item has reached the critical durability threshold (<=5%).
   * @param {import('prismarine-item').Item} item
   * @returns {boolean}
   */
  isCritical(item) {
    if (!item) return false;
    return this.getDurabilityPercent(item) <= 5;
  }

  /**
   * Determines the appropriate tool category for harvesting a specific block name.
   * 
   * @param {string} blockName - Name of the block (e.g. 'iron_ore', 'oak_log', 'dirt')
   * @returns {'pickaxe'|'axe'|'shovel'|'hoe'|null} The recommended tool type or null
   * @example
   * const toolType = ctx.tools.getToolForBlock('deepslate_copper_ore'); // 'pickaxe'
   */
  getToolForBlock(blockName) {
    if (!blockName || typeof blockName !== 'string') return null;
    const name = blockName.toLowerCase();

    // Pickaxe targets
    const pickaxeKeywords = ['ore', 'stone', 'cobblestone', 'deepslate', 'diorite', 'andesite', 'granite', 'obsidian', 'terracotta', 'brick', 'sandstone', 'netherrack', 'basalt', 'blackstone', 'quartz'];
    if (pickaxeKeywords.some((kw) => name.includes(kw))) {
      return 'pickaxe';
    }

    // Axe targets
    const axeKeywords = ['log', 'wood', 'plank', 'stem', 'fence', 'door', 'chest', 'crafting_table', 'bookshelf', 'barrel'];
    if (axeKeywords.some((kw) => name.includes(kw))) {
      return 'axe';
    }

    // Shovel targets
    const shovelKeywords = ['dirt', 'sand', 'gravel', 'clay', 'soul_sand', 'soul_soil', 'mud', 'snow', 'podzol', 'mycelium'];
    if (shovelKeywords.some((kw) => name.includes(kw))) {
      return 'shovel';
    }

    // Hoe targets
    const hoeKeywords = ['farmland', 'grass_block', 'hay_block', 'leaves', 'sponge', 'target', 'sculk', 'shroomlight'];
    if (hoeKeywords.some((kw) => name.includes(kw))) {
      return 'hoe';
    }

    return null;
  }

  /**
   * Returns a snapshot of tool availability and durability for telemetry.
   * 
   * @returns {{ bestPickaxe: Object|null, bestAxe: Object|null, bestSword: Object|null, isAboutToBreak: boolean }}
   */
  getStatus() {
    const pickaxe = this.getBestTool('pickaxe');
    const axe = this.getBestTool('axe');
    const sword = this.getBestTool('sword');
    const heldItem = this.bot.heldItem;

    return {
      bestPickaxe: pickaxe ? { name: pickaxe.name, durabilityPercent: this.getDurabilityPercent(pickaxe) } : null,
      bestAxe: axe ? { name: axe.name, durabilityPercent: this.getDurabilityPercent(axe) } : null,
      bestSword: sword ? { name: sword.name, durabilityPercent: this.getDurabilityPercent(sword) } : null,
      isAboutToBreak: heldItem ? this.isAboutToBreak(heldItem, 10) : false
    };
  }

  /**
   * Extracts the material name prefix from a tool item name.
   * @private
   */
  _extractMaterial(itemName) {
    if (!itemName) return 'wood';
    if (itemName.startsWith('netherite_')) return 'netherite';
    if (itemName.startsWith('diamond_')) return 'diamond';
    if (itemName.startsWith('iron_')) return 'iron';
    if (itemName.startsWith('stone_')) return 'stone';
    if (itemName.startsWith('golden_') || itemName.startsWith('gold_')) return 'golden';
    if (itemName.startsWith('wooden_') || itemName.startsWith('wood_')) return 'wood';
    return 'wood';
  }

  /**
   * Extracts enchantment map from an item object.
   * @private
   */
  _extractEnchantments(item) {
    const enchants = {};
    if (!item) return enchants;

    if (Array.isArray(item.enchants)) {
      for (const enc of item.enchants) {
        if (enc && enc.name) {
          enchants[enc.name.toLowerCase()] = enc.lvl || 1;
        }
      }
    }

    if (item.nbt && item.nbt.value && item.nbt.value.Enchantments) {
      const list = item.nbt.value.Enchantments.value.value || [];
      for (const enc of list) {
        if (enc && enc.id && enc.lvl) {
          const encName = enc.id.value.replace('minecraft:', '').toLowerCase();
          enchants[encName] = enc.lvl.value || 1;
        }
      }
    }

    return enchants;
  }

  /**
   * Health heartbeat check.
   * @returns {{ ok: boolean }}
   */
  ping() {
    return {
      ok: Boolean(this.bot)
    };
  }
}

module.exports = ToolService;
