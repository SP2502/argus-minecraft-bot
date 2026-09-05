/**
 * Shared System Constants, Enums, and Mappings
 */

const PermissionLevels = Object.freeze({
  OWNER: 'owner',
  ADMIN: 'admin',
  TRUSTED: 'trusted',
  GUEST: 'guest',
  BLOCKED: 'blocked'
});

const PermissionLevelValues = Object.freeze({
  owner: 4,
  admin: 3,
  trusted: 2,
  guest: 1,
  blocked: 0
});

const CombatModes = Object.freeze({
  DEFENSIVE: 'defensive',
  OFFENSIVE: 'offensive',
  PASSIVE: 'passive',
  FLEE: 'flee'
});

const LogSeverity = Object.freeze({
  CRITICAL: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4,
  TRACE: 5
});

const Categories = Object.freeze({
  API: 'API',
  NAV: 'NAV',
  MINE: 'MINE',
  FARM: 'FARM',
  BUILD: 'BUILD',
  COMBAT: 'COMBAT',
  INV: 'INV',
  TASK: 'TASK',
  AI: 'AI',
  SECURITY: 'SECURITY',
  COMM: 'COMM'
});

const LocationTypes = Object.freeze({
  BASE: 'base',
  FARM: 'farm',
  MINE: 'mine',
  WAYPOINT: 'waypoint'
});

module.exports = {
  PermissionLevels,
  PermissionLevelValues,
  CombatModes,
  LogSeverity,
  Categories,
  LocationTypes
};
