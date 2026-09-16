/**
 * Item Category Mappings
 * Used by InventoryService and Skills to categorize Minecraft items.
 */
module.exports = {
  ores: [
    'diamond', 'iron', 'gold', 'emerald', 'coal', 'copper',
    'redstone', 'lapis', 'ancient_debris', 'netherite',
    'raw_iron', 'raw_gold', 'raw_copper',
    'iron_ingot', 'gold_ingot', 'copper_ingot', 'netherite_ingot',
    'diamond_block', 'iron_block', 'gold_block', 'emerald_block',
    'redstone_block', 'lapis_block', 'coal_block', 'copper_block', 'raw_iron_block', 'raw_gold_block', 'raw_copper_block'
  ],
  crops: [
    'wheat', 'carrot', 'potato', 'beetroot', 'melon', 'pumpkin',
    'melon_slice', 'sweet_berries', 'wheat_seeds', 'pumpkin_seeds',
    'melon_seeds', 'beetroot_seeds', 'sugar_cane', 'cocoa_beans', 'nether_wart'
  ],
  logs: [
    'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'dark_oak_log',
    'acacia_log', 'mangrove_log', 'cherry_log', 'crimson_stem', 'warped_stem',
    'stripped_oak_log', 'stripped_birch_log', 'stripped_spruce_log',
    'stripped_jungle_log', 'stripped_dark_oak_log', 'stripped_acacia_log',
    'stripped_mangrove_log', 'stripped_cherry_log', 'stripped_crimson_stem', 'stripped_warped_stem'
  ],
  saplings: [
    'oak_sapling', 'birch_sapling', 'spruce_sapling', 'jungle_sapling',
    'acacia_sapling', 'dark_oak_sapling', 'mangrove_propagule', 'cherry_sapling',
    'crimson_fungus', 'warped_fungus'
  ],
  blocks: [
    'cobblestone', 'stone', 'dirt', 'gravel', 'sand', 'diorite',
    'andesite', 'granite', 'deepslate', 'cobbled_deepslate', 'tuff',
    'calcite', 'sandstone', 'red_sand', 'netherrack', 'end_stone',
    'blackstone', 'basalt', 'obsidian', 'crying_obsidian'
  ],
  tools: [
    'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'golden_pickaxe', 'diamond_pickaxe', 'netherite_pickaxe',
    'wooden_axe', 'stone_axe', 'iron_axe', 'golden_axe', 'diamond_axe', 'netherite_axe',
    'wooden_shovel', 'stone_shovel', 'iron_shovel', 'golden_shovel', 'diamond_shovel', 'netherite_shovel',
    'wooden_hoe', 'stone_hoe', 'iron_hoe', 'golden_hoe', 'diamond_hoe', 'netherite_hoe',
    'wooden_sword', 'stone_sword', 'iron_sword', 'golden_sword', 'diamond_sword', 'netherite_sword',
    'shears', 'flint_and_steel', 'fishing_rod', 'bow', 'crossbow', 'shield'
  ],
  food: [
    'bread', 'cooked_beef', 'cooked_porkchop', 'cooked_mutton',
    'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'cooked_salmon',
    'apple', 'golden_apple', 'enchanted_golden_apple', 'baked_potato',
    'carrot', 'golden_carrot', 'beef', 'porkchop', 'mutton', 'chicken',
    'rabbit', 'cod', 'salmon', 'cookie', 'pumpkin_pie'
  ],

  /**
   * Resolves the primary category of a given item name.
   * @param {string} itemName - Minecraft item identifier
   * @returns {string} Category name (e.g. 'ores', 'crops', 'logs', 'blocks', 'tools', 'food', 'misc')
   * @example
   * const cat = itemCategories.getCategory('iron_ingot'); // 'ores'
   */
  getCategory(itemName) {
    if (!itemName || typeof itemName !== 'string') return 'misc';
    const cleanName = itemName.toLowerCase().trim();

    for (const [category, items] of Object.entries(this)) {
      if (category === 'getCategory') continue;
      if (Array.isArray(items)) {
        if (items.includes(cleanName)) return category;
        // Prefix/substring match for common tool/log/ore variants
        if (category === 'tools' && (cleanName.endsWith('_pickaxe') || cleanName.endsWith('_axe') || cleanName.endsWith('_sword') || cleanName.endsWith('_shovel') || cleanName.endsWith('_hoe'))) {
          return 'tools';
        }
        if (category === 'ores' && (cleanName.includes('ore') || cleanName.includes('raw_') || cleanName.includes('_ingot'))) {
          return 'ores';
        }
        if (category === 'logs' && (cleanName.endsWith('_log') || cleanName.endsWith('_stem') || cleanName.endsWith('_wood'))) {
          return 'logs';
        }
      }
    }
    return 'misc';
  }
};
