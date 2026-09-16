const combatData = require('./combatData');
const combatConfig = require('../../config/combatConfig');
const MobTactics = require('./MobTactics');

/**
 * Pure combat decision policies and threat evaluations.
 * Contains no Mineflayer bot or network calls.
 */
module.exports = {
  MobTactics,

  /**
   * Evaluates whether an entity is a hostile target.
   * @param {Object} entity
   * @param {string} [targetMob='any']
   * @returns {boolean}
   */
  isHostile(entity, targetMob = 'any') {
    if (!entity || !entity.name) return false;
    const name = entity.name.toLowerCase();

    // Specific mob requested
    if (targetMob && targetMob !== 'any') {
      const canonicalTarget = combatData.aliases[targetMob.toLowerCase()] || targetMob.toLowerCase();
      return name === canonicalTarget;
    }

    return combatData.hostileMobs.includes(name);
  },

  /**
   * Checks if an entity is protected from harm (allies, tamed pets, villagers, whitelisted players).
   * @param {Object} entity
   * @param {string[]} [playerWhitelist=[]]
   * @returns {boolean}
   */
  isProtectedAlly(entity, playerWhitelist = []) {
    if (!entity) return false;

    // Player checks
    if (entity.type === 'player' || entity.name === 'player') {
      const username = entity.username || entity.name;
      if (!username) return true; // Default safe: protect unidentified players
      if (playerWhitelist.includes(username.toLowerCase())) return true;
      return false;
    }

    // Passive & utility mobs
    if (combatData.passiveMobs.includes(entity.name.toLowerCase())) {
      return true;
    }

    return false;
  },

  /**
   * Determines the optimal tactical maneuver given the target entity and current bot status.
   * @param {Object} entity - Target entity
   * @param {Object} botStatus - { health, food, position, hasShield }
   * @returns {string} Tactical action identifier
   */
  getTacticalAction(entity, botStatus = {}) {
    return MobTactics.getTacticalAction(entity, botStatus);
  },

  /**
   * Determines if a nearby dropped item should be collected post-combat.
   * @param {string} itemName
   * @returns {boolean}
   */
  shouldCollectCombatDrop(itemName) {
    if (!itemName) return false;
    const clean = itemName.toLowerCase().replace('minecraft:', '');
    return combatData.combatDrops.includes(clean);
  }
};
