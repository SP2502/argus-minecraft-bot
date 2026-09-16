/**
 * Logistics and Warehouse Management Configuration Tuning Parameters
 * Single source of truth for chest discovery radii, cache timeouts, and restock limits.
 */
module.exports = {
  CHEST_SEARCH_RADIUS: 24,
  MAX_CHEST_INDEX_COUNT: 64,
  CACHE_TTL_MS: 300000, // 5 minutes
  INTERACTION_RANGE: 2.5,
  TRANSFER_COOLDOWN_MS: 150,

  defaultKits: {
    default: {
      items: [
        { name: 'iron_sword', count: 1, type: 'weapon' },
        { name: 'iron_pickaxe', count: 1, type: 'tool' },
        { name: 'bread', count: 16, type: 'food' },
        { name: 'torch', count: 32, type: 'light' }
      ]
    },
    miner: {
      items: [
        { name: 'iron_pickaxe', count: 2, type: 'tool' },
        { name: 'iron_shovel', count: 1, type: 'tool' },
        { name: 'torch', count: 64, type: 'light' },
        { name: 'bread', count: 16, type: 'food' }
      ]
    },
    woodcutter: {
      items: [
        { name: 'iron_axe', count: 2, type: 'tool' },
        { name: 'oak_sapling', count: 8, type: 'sapling' },
        { name: 'bread', count: 16, type: 'food' }
      ]
    },
    warrior: {
      items: [
        { name: 'diamond_sword', count: 1, type: 'weapon', fallback: 'iron_sword' },
        { name: 'shield', count: 1, type: 'defense' },
        { name: 'cooked_beef', count: 16, type: 'food', fallback: 'bread' }
      ]
    },
    farmer: {
      items: [
        { name: 'iron_hoe', count: 1, type: 'tool' },
        { name: 'bone_meal', count: 32, type: 'farming' },
        { name: 'bread', count: 16, type: 'food' }
      ]
    }
  }
};
