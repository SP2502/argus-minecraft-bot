/**
 * Dangerous and Destructive Operation Definitions
 * Any command matching these definitions MUST go through ConfirmationManager.
 */
const DangerousIntents = Object.freeze(new Set([
  'drop_all',
  'clear_waypoints',
  'remove_waypoint',
  'delete_base',
  'delete_farm',
  'delete_mine',
  'delete_macro',
  'revoke_permission',
  'block_user',
  'attack_player',
  'shutdown',
  'restart',
  'reset_state'
]));

/**
 * Checks if an operation or intent requires explicit user confirmation.
 * @param {string} intentName - Intent name (e.g. 'drop_all', 'delete_macro')
 * @param {Object} [params={}] - Operation parameters
 * @returns {boolean} True if confirmation is required
 */
function requiresConfirmation(intentName, params = {}) {
  if (!intentName) return false;
  const normalized = intentName.toLowerCase().trim();

  if (DangerousIntents.has(normalized)) {
    return true;
  }

  // Dropping items with mode 'all'
  if (normalized === 'drop_item' && (params.quantity === 'all' || params.all === true)) {
    return true;
  }

  return false;
}

module.exports = {
  DangerousIntents,
  requiresConfirmation
};
