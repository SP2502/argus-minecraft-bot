/**
 * Combat and Defense Configuration Tuning Parameters
 * Single source of truth for combat timings, radii, and tactical thresholds.
 */
module.exports = {
  DEFAULT_SEARCH_RADIUS: 32,
  GUARD_PERIMETER_RADIUS: 16,
  CREEPER_KITE_DISTANCE: 6,
  RETREAT_HEALTH_THRESHOLD: 8,
  ATTACK_COOLDOWN_MS: 625, // Optimized 1.6 attack speed cooldown for Minecraft 1.9+
  SHIELD_BLOCK_DURATION_MS: 1500,
  MAX_PATROL_WAYPOINTS: 8,
  DROP_COLLECTION_RADIUS: 10,
  MELEE_ENGAGE_DISTANCE: 3.2,
  TARGET_SCAN_INTERVAL_MS: 500,
  FLEE_TIMEOUT_MS: 5000
};
