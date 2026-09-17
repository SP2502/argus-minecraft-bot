/**
 * Unified Task and Action Priority Levels
 * Single source of truth for priority weighting across the Argus system.
 */
const Priorities = Object.freeze({
  EMERGENCY: 100,
  OWNER_COMMAND: 95,
  SECURITY_ALERT: 90,
  COMBAT: 80,
  RESOURCE_DEPLETION: 70,
  OWNER_TASK: 60,
  MINING_TASK: 60,
  FARMING_TASK: 60,
  WOODCUTTING_TASK: 60,
  AUTONOMOUS: 50,
  INVENTORY: 40,
  IDLE: 30,
  BACKGROUND: 20,
  STATS: 10
});

module.exports = Priorities;
