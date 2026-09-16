/**
 * Movement Cost Constants for Pathfinding
 * Configures the penalty / cost for navigating through different terrain and block types.
 */
module.exports = Object.freeze({
  PLAINS: 1.0,
  WATER: 1.5,
  LAVA: 100.0,
  MOB_DENSE: 2.0,
  FARMLAND: 10.0,      // High cost to avoid trampling crops
  NIGHT_OUTDOORS: 1.2, // Slight penalty for unlit outdoor navigation at night
  CLIFF: 5.0,          // Penalty for steep vertical drops
  LADDER: 0.5          // Prefer ladders for vertical traversal
});
