/**
 * Crafting Data - Fuel hierarchy, smeltable mapping, and recipe structures.
 * Pure data — no Mineflayer calls and no logic.
 */
module.exports = {
  fuelRatings: {
    lava_bucket: 100,
    coal_block: 80,
    dried_kelp_block: 20,
    blaze_rod: 12,
    coal: 8,
    charcoal: 8,
    oak_log: 1.5,
    birch_log: 1.5,
    spruce_log: 1.5,
    dark_oak_log: 1.5,
    acacia_log: 1.5,
    jungle_log: 1.5,
    oak_planks: 1.5,
    birch_planks: 1.5,
    spruce_planks: 1.5,
    dark_oak_planks: 1.5,
    acacia_planks: 1.5,
    jungle_planks: 1.5,
    stick: 0.5
  },

  smeltableRecipes: {
    raw_iron: { output: 'iron_ingot', cookTime: 10 },
    raw_gold: { output: 'gold_ingot', cookTime: 10 },
    raw_copper: { output: 'copper_ingot', cookTime: 10 },
    cobblestone: { output: 'stone', cookTime: 10 },
    sand: { output: 'glass', cookTime: 10 },
    clay_ball: { output: 'brick', cookTime: 10 },
    beef: { output: 'cooked_beef', cookTime: 10 },
    porkchop: { output: 'cooked_porkchop', cookTime: 10 },
    mutton: { output: 'cooked_mutton', cookTime: 10 },
    chicken: { output: 'cooked_chicken', cookTime: 10 },
    potato: { output: 'baked_potato', cookTime: 10 },
    cod: { output: 'cooked_cod', cookTime: 10 },
    salmon: { output: 'cooked_salmon', cookTime: 10 }
  },

  recipes: {
    oak_planks: {
      ingredients: [{ name: 'oak_log', count: 1 }],
      resultCount: 4,
      requiresTable: false
    },
    birch_planks: {
      ingredients: [{ name: 'birch_log', count: 1 }],
      resultCount: 4,
      requiresTable: false
    },
    spruce_planks: {
      ingredients: [{ name: 'spruce_log', count: 1 }],
      resultCount: 4,
      requiresTable: false
    },
    stick: {
      ingredients: [{ name: 'oak_planks', count: 2 }],
      resultCount: 4,
      requiresTable: false
    },
    torch: {
      ingredients: [{ name: 'coal', count: 1 }, { name: 'stick', count: 1 }],
      resultCount: 4,
      requiresTable: false
    },
    crafting_table: {
      ingredients: [{ name: 'oak_planks', count: 4 }],
      resultCount: 1,
      requiresTable: false
    },
    furnace: {
      ingredients: [{ name: 'cobblestone', count: 8 }],
      resultCount: 1,
      requiresTable: true
    },
    chest: {
      ingredients: [{ name: 'oak_planks', count: 8 }],
      resultCount: 1,
      requiresTable: true
    },
    wooden_pickaxe: {
      ingredients: [{ name: 'oak_planks', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    stone_pickaxe: {
      ingredients: [{ name: 'cobblestone', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    iron_pickaxe: {
      ingredients: [{ name: 'iron_ingot', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    diamond_pickaxe: {
      ingredients: [{ name: 'diamond', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    wooden_axe: {
      ingredients: [{ name: 'oak_planks', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    stone_axe: {
      ingredients: [{ name: 'cobblestone', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    iron_axe: {
      ingredients: [{ name: 'iron_ingot', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    diamond_axe: {
      ingredients: [{ name: 'diamond', count: 3 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    wooden_sword: {
      ingredients: [{ name: 'oak_planks', count: 2 }, { name: 'stick', count: 1 }],
      resultCount: 1,
      requiresTable: true
    },
    stone_sword: {
      ingredients: [{ name: 'cobblestone', count: 2 }, { name: 'stick', count: 1 }],
      resultCount: 1,
      requiresTable: true
    },
    iron_sword: {
      ingredients: [{ name: 'iron_ingot', count: 2 }, { name: 'stick', count: 1 }],
      resultCount: 1,
      requiresTable: true
    },
    diamond_sword: {
      ingredients: [{ name: 'diamond', count: 2 }, { name: 'stick', count: 1 }],
      resultCount: 1,
      requiresTable: true
    },
    wooden_shovel: {
      ingredients: [{ name: 'oak_planks', count: 1 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    stone_shovel: {
      ingredients: [{ name: 'cobblestone', count: 1 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    iron_shovel: {
      ingredients: [{ name: 'iron_ingot', count: 1 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    diamond_shovel: {
      ingredients: [{ name: 'diamond', count: 1 }, { name: 'stick', count: 2 }],
      resultCount: 1,
      requiresTable: true
    },
    shield: {
      ingredients: [{ name: 'oak_planks', count: 6 }, { name: 'iron_ingot', count: 1 }],
      resultCount: 1,
      requiresTable: true
    },
    bucket: {
      ingredients: [{ name: 'iron_ingot', count: 3 }],
      resultCount: 1,
      requiresTable: true
    }
  },

  aliases: {
    pickaxe: 'stone_pickaxe',
    axe: 'stone_axe',
    sword: 'iron_sword',
    table: 'crafting_table',
    torches: 'torch',
    sticks: 'stick',
    planks: 'oak_planks',
    iron: 'raw_iron',
    gold: 'raw_gold',
    copper: 'raw_copper'
  }
};
