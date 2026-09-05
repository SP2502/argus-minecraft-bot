/**
 * Tool Material Tiers and Enchantment Valuation
 * Used by ToolService to score and select optimal gear.
 */
module.exports = {
  netherite: 5,
  diamond: 4,
  iron: 3,
  stone: 2,
  wood: 1,
  wooden: 1,
  gold: 1,
  golden: 1,

  // Weight multipliers for enchantments
  enchantmentWeight: {
    efficiency: 0.5, // Each level adds +0.5 to effective tier
    fortune: 0.3,
    silk_touch: 0.2,
    unbreaking: 0.2,
    sharpness: 0.5,
    power: 0.5
  },

  /**
   * Calculates the composite effective tier score of a tool given its material and enchantments.
   * @param {string} material - Material identifier (e.g., 'diamond', 'iron', 'stone')
   * @param {Object<string, number>} [enchantments={}] - Dictionary of enchantment names and levels
   * @returns {number} Composite numerical score
   * @example
   * const score = toolTiers.getEffectiveTier('iron', { efficiency: 4 }); // 3 + 2.0 = 5.0
   */
  getEffectiveTier(material, enchantments = {}) {
    let tier = this[material] || 0;
    if (enchantments.efficiency) tier += enchantments.efficiency * this.enchantmentWeight.efficiency;
    if (enchantments.fortune) tier += enchantments.fortune * this.enchantmentWeight.fortune;
    if (enchantments.silk_touch) tier += this.enchantmentWeight.silk_touch;
    if (enchantments.unbreaking) tier += enchantments.unbreaking * this.enchantmentWeight.unbreaking;
    if (enchantments.sharpness) tier += enchantments.sharpness * this.enchantmentWeight.sharpness;
    if (enchantments.power) tier += enchantments.power * this.enchantmentWeight.power;
    return tier;
  }
};
