const combatData = require('./combatData');
const combatConfig = require('../../config/combatConfig');

/**
 * Pure combat decision policies and threat evaluations.
 * Contains no Mineflayer bot or network calls.
 */
module.exports = {
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
   * @returns {'tactical_retreat'|'kite_creeper'|'shield_block'|'melee_rush'}
   */
  getTacticalAction(entity, botStatus = {}) {
    const health = botStatus.health !== undefined ? botStatus.health : 20;

    // 1. Critical health retreat
    if (health <= combatConfig.RETREAT_HEALTH_THRESHOLD) {
      return 'tactical_retreat';
    }

    if (!entity || !entity.position || !botStatus.position) {
      return 'melee_rush';
    }

    const dx = entity.position.x - botStatus.position.x;
    const dy = entity.position.y - botStatus.position.y;
    const dz = entity.position.z - botStatus.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const mobName = (entity.name || '').toLowerCase();

    // 2. Creeper detonation avoidance
    if (mobName === 'creeper') {
      if (distance < combatConfig.CREEPER_KITE_DISTANCE) {
        return 'kite_creeper';
      }
    }

    // 3. Ranged projectile defense
    if (['skeleton', 'stray', 'pillager'].includes(mobName)) {
      if (distance > 5 && botStatus.hasShield) {
        return 'shield_block';
      }
    }

    // 4. Standard melee engagement
    return 'melee_rush';
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
