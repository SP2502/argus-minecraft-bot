/**
 * SynonymRegistry - Canonical synonym dictionary for verbs, items, locations, and units.
 */
class SynonymRegistry {
  constructor() {
    this.intents = {
      mine: ['mine', 'dig', 'extract', 'gather ore', 'get ore', 'excavate', 'quarry'],
      farm: ['farm', 'harvest', 'cultivate', 'grow crops', 'reap', 'plant'],
      chop_tree: [
        'cut tree', 'cut trees', 'chop tree', 'chop trees', 'lumber',
        'collect wood', 'get wood', 'harvest wood', 'get logs', 'cut wood', 'chop wood', 'chop', 'cut'
      ],
      combat: [
        'kill', 'slay', 'hunt', 'eliminate', 'attack', 'clear hostiles', 'clear enemies', 'clear monsters', 'fight'
      ],
      guard: [
        'protect', 'guard', 'defend', 'bodyguard', 'watch over', 'shield'
      ],
      patrol: [
        'patrol', 'scout', 'perimeter'
      ],
      craft: [
        'craft', 'make', 'create item', 'forge', 'build item', 'construct item'
      ],
      smelt: [
        'smelt', 'cook', 'bake', 'melt ore', 'refine'
      ],
      build: [
        'build', 'construct', 'erect', 'assemble structure', 'build structure'
      ],
      sort_warehouse: [
        'sort warehouse', 'sort chests', 'organize base', 'organize chests', 'sort storage', 'store to warehouse', 'deposit to warehouse'
      ],
      restock: [
        'restock', 'resupply', 'get supplies', 'restock supplies', 'refill supplies'
      ],
      index_chests: [
        'index chests', 'scan warehouse', 'index warehouse', 'scan chests', 'audit storage', 'catalog warehouse'
      ],
      find_item: [
        'find item', 'where is', 'locate item', 'search for item', 'lookup item', 'locate', 'find'
      ],
      go_to: ['go to', 'travel to', 'move to', 'head to', 'navigate to', 'walk to', 'run to', 'goto', 'go'],
      go_home: ['go home', 'return home', 'head home', 'back home', 'retreat home', 'home'],
      go_back: ['go back', 'return', 'back'],
      follow: ['follow', 'come with', 'trail', 'come with me', 'follow me'],
      stop_following: ['stop following', 'unfollow', 'stay here', 'stay'],
      store_all: ['store all', 'deposit all', 'put away all', 'stash all', 'dump inventory', 'store everything', 'empty inventory'],
      store_item: ['store', 'deposit', 'put away', 'stash'],
      retrieve_item: ['get', 'take', 'withdraw', 'bring', 'retrieve', 'grab'],
      sort_inventory: ['sort', 'sort inventory', 'organize', 'tidy inventory', 'compact'],
      show_inventory: ['inventory', 'show inventory', 'inv', 'check inventory', 'what are you carrying'],
      status: ['status', 'how are you', 'what are you doing', 'system status', 'info'],
      stop: ['stop', 'halt', 'cancel', 'cancel current', 'pause', 'wait', 'freeze'],
      resume: ['resume', 'continue', 'unpause'],
      grant_permission: ['grant', 'give permission', 'authorize', 'allow', 'permit'],
      revoke_permission: ['revoke', 'unauthorize', 'disallow', 'ban', 'block user'],
      run_macro: ['run macro', 'exec macro', 'execute macro', 'run'],
      create_macro: ['create macro', 'define macro', 'new macro', 'record macro'],
      delete_macro: ['delete macro', 'remove macro'],
      ambient_mode: ['ambient', 'ambient mode', 'homestead', 'idle routine'],
      sleep: ['sleep', 'nap', 'bed'],
      wake: ['wake', 'wake up', 'get up']
    };

    this.itemAliases = {
      rocks: 'cobblestone',
      rock: 'cobblestone',
      cobble: 'cobblestone',
      cobblestone: 'cobblestone',
      stone: 'stone',
      wood: 'oak_log',
      log: 'oak_log',
      logs: 'oak_log',
      plank: 'oak_planks',
      planks: 'oak_planks',
      dimond: 'diamond',
      dimonds: 'diamond',
      diamonds: 'diamond',
      diamond: 'diamond',
      iron: 'iron_ingot',
      irons: 'iron_ingot',
      iron_ore: 'iron_ore',
      gold: 'gold_ingot',
      golds: 'gold_ingot',
      gold_ore: 'gold_ore',
      coal: 'coal',
      coals: 'coal',
      copper: 'copper_ingot',
      redstone: 'redstone',
      lapis: 'lapis_lazuli',
      emerald: 'emerald',
      emeralds: 'emerald',
      netherite: 'netherite_ingot',
      dirt: 'dirt',
      sand: 'sand',
      gravel: 'gravel',
      seeds: 'wheat_seeds',
      wheat: 'wheat',
      carrot: 'carrot',
      carrots: 'carrot',
      potato: 'potato',
      potatoes: 'potato',
      beetroot: 'beetroot',
      beetroots: 'beetroot',
      cane: 'sugar_cane',
      sugarcane: 'sugar_cane',
      sugar_cane: 'sugar_cane',
      melon: 'melon',
      pumpkin: 'pumpkin',
      bamboo: 'bamboo',
      food: 'bread',
      torches: 'torch',
      torch: 'torch',
      pickaxe: 'iron_pickaxe',
      pick: 'iron_pickaxe',
      axe: 'iron_axe',
      shovel: 'iron_shovel',
      spade: 'iron_shovel',
      hoe: 'iron_hoe',
      sword: 'iron_sword',
      bone_meal: 'bone_meal',
      bonemeal: 'bone_meal'
    };

    this.treeAliases = {
      wood: 'any',
      log: 'any',
      logs: 'any',
      tree: 'any',
      trees: 'any',
      darkoak: 'dark_oak',
      dark_oak: 'dark_oak',
      netherwood: 'any_nether',
      oak: 'oak',
      birch: 'birch',
      spruce: 'spruce',
      jungle: 'jungle',
      acacia: 'acacia',
      mangrove: 'mangrove',
      cherry: 'cherry',
      crimson: 'crimson',
      warped: 'warped'
    };

    this.mobAliases = {
      zombies: 'zombie',
      skeletons: 'skeleton',
      creepers: 'creeper',
      spiders: 'spider',
      witches: 'witch',
      endermen: 'enderman',
      phantoms: 'phantom',
      pillagers: 'pillager',
      drowned: 'drowned',
      mobs: 'any',
      hostiles: 'any',
      monsters: 'any',
      enemies: 'any',
      threats: 'any',
      zombie: 'zombie',
      skeleton: 'skeleton',
      creeper: 'creeper',
      spider: 'spider',
      witch: 'witch'
    };

    this.structureAliases = {
      shelter: 'shelter',
      house: 'shelter',
      hut: 'shelter',
      bunker: 'shelter',
      base: 'shelter',
      wall: 'wall',
      barrier: 'wall',
      fence: 'wall',
      floor: 'floor',
      platform: 'floor',
      slab: 'floor',
      ground: 'floor',
      cube: 'cube',
      box: 'cube',
      room: 'cube',
      stairs: 'stairs',
      staircase: 'stairs',
      steps: 'stairs'
    };

    this.kitAliases = {
      miner: 'miner',
      mining: 'miner',
      woodcutter: 'woodcutter',
      lumberjack: 'woodcutter',
      wood: 'woodcutter',
      warrior: 'warrior',
      fighter: 'warrior',
      combat: 'warrior',
      guard: 'warrior',
      farmer: 'farmer',
      farming: 'farmer',
      default: 'default',
      standard: 'default'
    };

    this.locationAliases = {
      home: 'primary_base',
      main_base: 'primary_base',
      spawn: 'spawn',
      mine: 'mine',
      farm: 'farm',
      forest: 'forest'
    };

    this.quantities = {
      stack: 64,
      stacks: 64,
      stak: 64,
      staks: 64,
      dozen: 12,
      half_stack: 32,
      half: 32,
      inventory: 2304,
      full: 2304
    };
  }

  /**
   * Resolves canonical tree type from an alias.
   * @param {string} raw
   * @returns {string} Canonical tree family or 'any'
   */
  resolveTreeType(raw) {
    if (!raw) return 'any';
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.treeAliases[clean] || this.treeAliases[raw.toLowerCase()] || clean;
  }

  /**
   * Resolves canonical mob type from an alias.
   * @param {string} raw
   * @returns {string} Canonical mob name or 'any'
   */
  resolveMobType(raw) {
    if (!raw) return 'any';
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.mobAliases[clean] || this.mobAliases[raw.toLowerCase()] || clean;
  }

  /**
   * Resolves canonical structure name from an alias.
   * @param {string} raw
   * @returns {string} Canonical structure name
   */
  resolveStructure(raw) {
    if (!raw) return 'shelter';
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.structureAliases[clean] || this.structureAliases[raw.toLowerCase()] || clean;
  }

  /**
   * Resolves canonical kit name from an alias.
   * @param {string} raw
   * @returns {string} Canonical kit name
   */
  resolveKit(raw) {
    if (!raw) return 'default';
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.kitAliases[clean] || this.kitAliases[raw.toLowerCase()] || clean;
  }

  /**
   * Resolves canonical item name from an alias.
   * @param {string} raw - Input term
   * @returns {string} Canonical item name or original
   */
  resolveItem(raw) {
    if (!raw) return raw;
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.itemAliases[clean] || this.itemAliases[raw.toLowerCase()] || clean;
  }

  /**
   * Resolves canonical location alias.
   * @param {string} raw
   * @returns {string}
   */
  resolveLocation(raw) {
    if (!raw) return raw;
    const clean = raw.toLowerCase().trim().replace(/\s+/g, '_');
    return this.locationAliases[clean] || clean;
  }

  /**
   * Dynamically registers a synonym or alias.
   * @param {'intents'|'itemAliases'|'locationAliases'|'quantities'} category
   * @param {string} alias
   * @param {any} canonical
   */
  register(category, alias, canonical) {
    if (this[category]) {
      this[category][alias.toLowerCase().trim()] = canonical;
    }
  }
}

module.exports = new SynonymRegistry();
