/**
 * Ambient Behavior and Autonomous Homestead Routine Configuration
 * Tuning parameters for idle scheduling, sleep cycles, self-sustainment, and maintenance.
 */
module.exports = {
  ENABLED: true,
  IDLE_TRIGGER_DELAY_MS: 15000,      // 15 seconds of idle before evaluating ambient routines
  BED_SEARCH_RADIUS: 32,             // Search radius for discovering beds
  BED_INTERACTION_RANGE: 2.5,        // Max distance to reach and use a bed
  MIN_FOOD_THRESHOLD: 14,            // Triggers autonomous eating if food drops below this
  INVENTORY_FULL_THRESHOLD: 0.75,    // 75% slot usage triggers autonomous warehouse sorting
  MAINTENANCE_COOLDOWN_MS: 180000,   // Minimum 3 minutes between maintenance checks
  PATROL_COOLDOWN_MS: 300000,        // Minimum 5 minutes between ambient perimeter patrols
  
  BED_BLOCK_NAMES: [
    'white_bed', 'orange_bed', 'magenta_bed', 'light_blue_bed',
    'yellow_bed', 'lime_bed', 'pink_bed', 'gray_bed',
    'light_gray_bed', 'cyan_bed', 'purple_bed', 'blue_bed',
    'brown_bed', 'green_bed', 'red_bed', 'black_bed', 'bed'
  ],

  EDIBLE_FOODS: [
    'cooked_beef', 'steak', 'cooked_porkchop', 'cooked_mutton',
    'cooked_chicken', 'cooked_salmon', 'cooked_cod', 'bread',
    'baked_potato', 'golden_carrot', 'apple', 'carrot', 'sweet_berries'
  ]
};
