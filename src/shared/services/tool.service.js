const toolTiers = require('../../modules/inventory/tool-tiers');

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
      const fallbackTools = [`iron_${toolType}`, `stone_${toolType}`, `wooden_${toolType}`];
      for (const tool of fallbackTools) {
        try {
          await this.ctx.crafting.autoCraftMissing(tool, 1);
          bestTool = this.getBestTool(toolType);
          if (bestTool) break;
        } catch (e) {}
      }
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
   * Autonomous Idle Tool Maintenance & Upgrade Engine.
   * Scans the bot's inventory for tool gaps, durability wear, and upgrade opportunities.
   * Crafts superior tool tiers (e.g. wood -> stone -> iron -> diamond) and organizes hotbar.
   * 
   * @returns {Promise<{ upgraded: boolean, tool?: string, reason?: string }>}
   */
  async maintainAndUpgradeTools() {
    if (!this.bot || !this.bot.inventory || !this.ctx || !this.ctx.crafting) {
      return { upgraded: false };
    }

    const count = (name) => {
      if (this.ctx.inv && typeof this.ctx.inv.countItem === 'function') {
        return this.ctx.inv.countItem(name);
      }
      return this.bot.inventory.items()
        .filter((i) => i && i.name && (i.name === name || i.name.endsWith(`_${name}`)))
        .reduce((sum, i) => sum + (i.count || 1), 0);
    };

    const diamonds = count('diamond');
    const ironIngots = count('iron_ingot');
    const cobblestone = count('cobblestone');
    const planks = count('planks');
    const logs = count('log');

    // Tool categories to maintain in priority order: pickaxe, axe, sword, shovel
    const toolCategories = [
      { type: 'pickaxe', reqDiamond: 3, reqIron: 3, reqCobble: 3, reqPlanks: 3 },
      { type: 'axe', reqDiamond: 3, reqIron: 3, reqCobble: 3, reqPlanks: 3 },
      { type: 'sword', reqDiamond: 2, reqIron: 2, reqCobble: 2, reqPlanks: 2 },
      { type: 'shovel', reqDiamond: 1, reqIron: 1, reqCobble: 1, reqPlanks: 1 }
    ];

    for (const cat of toolCategories) {
      const current = this.getBestTool(cat.type);
      const material = current ? this._extractMaterial(current.name) : 'none';
      const tier = current ? (toolTiers[material] || 1) : 0;
      const isDamaged = current ? this.isAboutToBreak(current, 20) : false;

      // 1. Upgrade to Diamond (Tier 4)
      if ((tier < 4 || isDamaged) && diamonds >= cat.reqDiamond) {
        const targetTool = `diamond_${cat.type}`;
        if (current && current.name === targetTool && !isDamaged) continue;
        const crafted = await this.ctx.crafting.autoCraftMissing(targetTool, 1);
        if (crafted) {
          if (this.ctx.inv && typeof this.ctx.inv.organizeHotbar === 'function') {
            try { await this.ctx.inv.organizeHotbar(); } catch (e) {}
          }
          return { upgraded: true, tool: targetTool, reason: isDamaged ? 'replacement' : 'tier_upgrade' };
        }
      }

      // 2. Upgrade to Iron (Tier 3)
      if ((tier < 3 || isDamaged) && ironIngots >= cat.reqIron) {
        const targetTool = `iron_${cat.type}`;
        if (current && current.name === targetTool && !isDamaged) continue;
        const crafted = await this.ctx.crafting.autoCraftMissing(targetTool, 1);
        if (crafted) {
          if (this.ctx.inv && typeof this.ctx.inv.organizeHotbar === 'function') {
            try { await this.ctx.inv.organizeHotbar(); } catch (e) {}
          }
          return { upgraded: true, tool: targetTool, reason: isDamaged ? 'replacement' : 'tier_upgrade' };
        }
      }

      // 3. Upgrade to Stone (Tier 2)
      if ((tier < 2 || isDamaged) && cobblestone >= cat.reqCobble) {
        const targetTool = `stone_${cat.type}`;
        if (current && current.name === targetTool && !isDamaged) continue;
        const crafted = await this.ctx.crafting.autoCraftMissing(targetTool, 1);
        if (crafted) {
          if (this.ctx.inv && typeof this.ctx.inv.organizeHotbar === 'function') {
            try { await this.ctx.inv.organizeHotbar(); } catch (e) {}
          }
          return { upgraded: true, tool: targetTool, reason: isDamaged ? 'replacement' : 'tier_upgrade' };
        }
      }

      // 4. Basic Wood Tool (Tier 1) if bot has NO tool of this type
      if (tier < 1 && (planks >= cat.reqPlanks || logs >= 1)) {
        const targetTool = `wooden_${cat.type}`;
        const crafted = await this.ctx.crafting.autoCraftMissing(targetTool, 1);
        if (crafted) {
          if (this.ctx.inv && typeof this.ctx.inv.organizeHotbar === 'function') {
            try { await this.ctx.inv.organizeHotbar(); } catch (e) {}
          }
          return { upgraded: true, tool: targetTool, reason: 'missing_tool' };
        }
      }
    }

    // 5. Shield Crafting & Equipping if missing
    const hasShield = this.bot.inventory.items().some((i) => i && i.name === 'shield');
    if (!hasShield && ironIngots >= 1 && (planks >= 6 || logs >= 2)) {
      const crafted = await this.ctx.crafting.autoCraftMissing('shield', 1);
      if (crafted) {
        const shieldItem = this.bot.inventory.items().find((i) => i && i.name === 'shield');
        if (shieldItem && typeof this.bot.equip === 'function') {
          try { await this.bot.equip(shieldItem, 'off-hand'); } catch (e) {}
        }
        return { upgraded: true, tool: 'shield', reason: 'defense' };
      }
    }

    return { upgraded: false };
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
