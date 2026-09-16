/**
 * Logistics Data - Static Definitions for Storage Categories, Container Types, and Kit Aliases.
 * Pure data — no Mineflayer calls and no logic.
 */
module.exports = {
  validContainers: [
    'chest',
    'trapped_chest',
    'barrel',
    'ender_chest',
    'shulker_box'
  ],

  categories: [
    'ores',
    'crops',
    'logs',
    'blocks',
    'tools',
    'food',
    'general'
  ],

  categoryAliases: {
    ores: 'ores',
    ore: 'ores',
    minerals: 'ores',
    metals: 'ores',
    vault: 'ores',
    crops: 'crops',
    farm: 'crops',
    harvest: 'crops',
    logs: 'logs',
    wood: 'logs',
    timber: 'logs',
    lumber: 'logs',
    blocks: 'blocks',
    stone: 'blocks',
    building: 'blocks',
    masonry: 'blocks',
    tools: 'tools',
    armory: 'tools',
    weapons: 'tools',
    gear: 'tools',
    equipment: 'tools',
    food: 'food',
    pantry: 'food',
    rations: 'food',
    general: 'general',
    misc: 'general',
    storage: 'general',
    overflow: 'general'
  },

  kitAliases: {
    miner: 'miner',
    mining: 'miner',
    mine: 'miner',
    woodcutter: 'woodcutter',
    lumberjack: 'woodcutter',
    wood: 'woodcutter',
    logger: 'woodcutter',
    warrior: 'warrior',
    fighter: 'warrior',
    guard: 'warrior',
    combat: 'warrior',
    soldier: 'warrior',
    farmer: 'farmer',
    farming: 'farmer',
    default: 'default',
    standard: 'default',
    kit: 'default'
  }
};
