/**
 * Safety Service Threshold Constants
 * Centralized safety boundaries and hazard scan configurations.
 */
module.exports = Object.freeze({
  CRITICAL_HEALTH: 6,               // < 6 health (< 3 hearts) triggers emergency retreat
  CRITICAL_HUNGER: 4,               // < 4 food (2 hunger shanks) triggers critical hunger state
  LOW_HEALTH: 10,                   // < 10 health (5 hearts)
  LOW_HUNGER: 6,                    // < 6 food (3 hunger shanks)
  CONSECUTIVE_DAMAGE_THRESHOLD: 3,  // Number of rapid hits before triggering panic retreat
  DAMAGE_RESET_MS: 10000,           // 10 seconds of no damage to reset consecutive damage counter
  LAVA_SCAN_RADIUS: 3               // Voxel radius to scan for adjacent lava / fire
});
