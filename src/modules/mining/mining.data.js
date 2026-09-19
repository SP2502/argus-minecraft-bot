/**
 * Ore Configuration Data
 * Pure data mapping: priorities, optimal Y-levels (1.18+ world generation), and block identifiers.
 */
module.exports = {
  // Ore priorities (higher = mine first during opportunistic scanning)
  priorities: {
    ancient_debris: 100,
    diamond: 100,
    emerald: 95,
    gold: 70,
    iron: 60,
    redstone: 50,
    lapis: 40,
    coal: 30,
    copper: 25
  },

  // Optimal mining Y-levels per ore type in modern Minecraft
  yLevels: {
    ancient_debris: { min: 8, max: 22, best: 15 },
    diamond: { min: -64, max: -59, best: -59 },
    emerald: { min: -16, max: 320, best: 232 },
    gold: { min: -64, max: 32, best: -16 },
    iron: { min: -64, max: 320, best: 16 },
    redstone: { min: -64, max: -32, best: -59 },
    lapis: { min: -64, max: 64, best: 0 },
    coal: { min: 0, max: 320, best: 96 },
    copper: { min: -16, max: 112, best: 48 },
    stone: { min: -64, max: 320, best: 64 },
    cobblestone: { min: -64, max: 320, best: 64 }
  },

  // Standard and deepslate block names for each ore type
  blockNames: {
    ancient_debris: ['ancient_debris'],
    diamond: ['diamond_ore', 'deepslate_diamond_ore'],
    emerald: ['emerald_ore', 'deepslate_emerald_ore'],
    gold: ['gold_ore', 'deepslate_gold_ore', 'nether_gold_ore'],
    iron: ['iron_ore', 'deepslate_iron_ore'],
    redstone: ['redstone_ore', 'deepslate_redstone_ore'],
    lapis: ['lapis_ore', 'lapis_lazuli_ore', 'deepslate_lapis_ore'],
    coal: ['coal_ore', 'deepslate_coal_ore'],
    copper: ['copper_ore', 'deepslate_copper_ore'],
    stone: ['stone', 'cobblestone', 'deepslate', 'cobbled_deepslate', 'diorite', 'andesite', 'granite'],
    cobblestone: ['stone', 'cobblestone', 'deepslate', 'cobbled_deepslate']
  }
};
