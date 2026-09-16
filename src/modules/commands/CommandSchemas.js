/**
 * CommandSchemas - Single source of truth for intent execution permissions, priority mappings, and resource locks.
 */
module.exports = Object.freeze({
  // Core & Queries
  help: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'core',
    isControl: true
  },
  status: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'core',
    isControl: true
  },
  where_are_you: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'core',
    isControl: true
  },
  health_status: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'core',
    isControl: true
  },
  uptime: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'core',
    isControl: true
  },

  // Skills
  mine: {
    requiredPermission: 'admin',
    priorityKey: 'MINING_TASK',
    locks: ['movement', 'inventory', 'tool:pickaxe'],
    skillName: 'mine',
    dangerous: false
  },
  farm: {
    requiredPermission: 'admin',
    priorityKey: 'FARMING_TASK',
    locks: ['movement', 'inventory', 'tool:hoe'],
    skillName: 'farm',
    dangerous: false
  },
  chop_tree: {
    requiredPermission: 'admin',
    priorityKey: 'WOODCUTTING_TASK',
    locks: ['movement', 'inventory', 'tool:axe'],
    skillName: 'chop_tree',
    dangerous: false
  },
  combat: {
    requiredPermission: 'admin',
    priorityKey: 'COMBAT',
    locks: ['movement', 'combat', 'inventory', 'tool:weapon'],
    skillName: 'combat',
    dangerous: false
  },
  guard: {
    requiredPermission: 'trusted',
    priorityKey: 'SECURITY_ALERT',
    locks: ['movement', 'combat', 'inventory'],
    skillName: 'combat',
    dangerous: false
  },
  patrol: {
    requiredPermission: 'admin',
    priorityKey: 'AUTONOMOUS',
    locks: ['movement', 'combat'],
    skillName: 'combat',
    dangerous: false
  },
  craft: {
    requiredPermission: 'trusted',
    priorityKey: 'AUTONOMOUS',
    locks: ['inventory'],
    skillName: 'craft',
    dangerous: false
  },
  smelt: {
    requiredPermission: 'trusted',
    priorityKey: 'AUTONOMOUS',
    locks: ['inventory', 'movement'],
    skillName: 'craft',
    dangerous: false
  },
  build: {
    requiredPermission: 'admin',
    priorityKey: 'AUTONOMOUS',
    locks: ['movement', 'inventory', 'building', 'tool:shovel', 'tool:pickaxe'],
    skillName: 'build',
    dangerous: false
  },
  sort_warehouse: {
    requiredPermission: 'trusted',
    priorityKey: 'AUTONOMOUS',
    locks: ['movement', 'inventory', 'warehouse'],
    skillName: 'logistics',
    dangerous: false
  },
  restock: {
    requiredPermission: 'trusted',
    priorityKey: 'AUTONOMOUS',
    locks: ['movement', 'inventory', 'warehouse'],
    skillName: 'logistics',
    dangerous: false
  },
  index_chests: {
    requiredPermission: 'admin',
    priorityKey: 'AUTONOMOUS',
    locks: ['movement', 'inventory', 'warehouse'],
    skillName: 'logistics',
    dangerous: false
  },
  find_item: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'logistics',
    dangerous: false,
    isControl: true
  },
  ambient_mode: {
    requiredPermission: 'trusted',
    priorityKey: 'STATS',
    locks: [],
    skillName: null,
    dangerous: false,
    isControl: true
  },
  sleep: {
    requiredPermission: 'trusted',
    priorityKey: 'STATS',
    locks: [],
    skillName: null,
    dangerous: false,
    isControl: true
  },
  wake: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: null,
    dangerous: false,
    isControl: true
  },

  // Navigation
  go_to: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement'],
    skillName: 'navigation',
    dangerous: false
  },
  go_home: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement'],
    skillName: 'navigation',
    dangerous: false
  },
  follow: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement'],
    skillName: 'navigation',
    dangerous: false
  },
  stop_following: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement'],
    skillName: 'navigation',
    isControl: true
  },
  retrace_steps: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement'],
    skillName: 'navigation'
  },

  // Inventory
  show_inventory: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'inventory',
    isControl: true
  },
  sort_inventory: {
    requiredPermission: 'trusted',
    priorityKey: 'INVENTORY',
    locks: ['inventory'],
    skillName: 'inventory'
  },
  store_all: {
    requiredPermission: 'trusted',
    priorityKey: 'INVENTORY',
    locks: ['movement', 'inventory'],
    skillName: 'inventory'
  },
  store_item: {
    requiredPermission: 'trusted',
    priorityKey: 'INVENTORY',
    locks: ['movement', 'inventory'],
    skillName: 'inventory'
  },
  retrieve_item: {
    requiredPermission: 'trusted',
    priorityKey: 'INVENTORY',
    locks: ['movement', 'inventory'],
    skillName: 'inventory'
  },
  drop_item: {
    requiredPermission: 'trusted',
    priorityKey: 'INVENTORY',
    locks: ['inventory'],
    skillName: 'inventory'
  },
  drop_all: {
    requiredPermission: 'admin',
    priorityKey: 'INVENTORY',
    locks: ['inventory'],
    skillName: 'inventory',
    dangerous: true
  },

  // Task Control
  stop: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'control',
    isControl: true
  },
  resume: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'control',
    isControl: true
  },
  cancel: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'control',
    isControl: true
  },
  stop_all: {
    requiredPermission: 'admin',
    priorityKey: 'EMERGENCY',
    locks: [],
    skillName: 'control',
    isControl: true
  },
  queue: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'control',
    isControl: true
  },

  // Location Registry
  register_base: {
    requiredPermission: 'admin',
    priorityKey: 'OWNER_TASK',
    locks: [],
    skillName: 'locations'
  },
  list_bases: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'locations',
    isControl: true
  },
  register_farm: {
    requiredPermission: 'admin',
    priorityKey: 'OWNER_TASK',
    locks: [],
    skillName: 'locations'
  },
  list_farms: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'locations',
    isControl: true
  },
  register_mine: {
    requiredPermission: 'admin',
    priorityKey: 'OWNER_TASK',
    locks: [],
    skillName: 'locations'
  },
  list_mines: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'locations',
    isControl: true
  },
  set_waypoint: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: [],
    skillName: 'locations'
  },
  list_waypoints: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'locations',
    isControl: true
  },
  remove_waypoint: {
    requiredPermission: 'admin',
    priorityKey: 'OWNER_TASK',
    locks: [],
    skillName: 'locations',
    dangerous: true
  },

  // Permissions & Security
  grant_permission: {
    requiredPermission: 'owner',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'security',
    isControl: true
  },
  revoke_permission: {
    requiredPermission: 'admin',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'security',
    isControl: true,
    dangerous: true
  },
  who_has_access: {
    requiredPermission: 'admin',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'security',
    isControl: true
  },
  security_log: {
    requiredPermission: 'admin',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'security',
    isControl: true
  },

  // Communication
  quiet_mode_on: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'communication',
    isControl: true
  },
  quiet_mode_off: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'communication',
    isControl: true
  },
  dnd: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'communication',
    isControl: true
  },
  dnd_off: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'communication',
    isControl: true
  },

  // Macros
  create_macro: {
    requiredPermission: 'owner',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'macro',
    isControl: true
  },
  run_macro: {
    requiredPermission: 'trusted',
    priorityKey: 'OWNER_TASK',
    locks: ['movement', 'inventory'],
    skillName: 'macro'
  },
  list_macros: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'macro',
    isControl: true
  },
  show_macro: {
    requiredPermission: 'guest',
    priorityKey: 'STATS',
    locks: [],
    skillName: 'macro',
    isControl: true
  },
  delete_macro: {
    requiredPermission: 'owner',
    priorityKey: 'OWNER_COMMAND',
    locks: [],
    skillName: 'macro',
    isControl: true,
    dangerous: true
  }
});
