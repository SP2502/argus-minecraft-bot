const combatData = require('../skills/combat/combatData');
const combatPolicies = require('../skills/combat/combatPolicies');
const combatConfig = require('../config/combatConfig');

/**
 * CombatHelperService - Evaluates hostiles, threat rankings, loadouts, and tactical maneuvers.
 * Shared service reusable by CombatSkill, SafetyService, and Guard tasks.
 */
class CombatHelperService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    this.whitelist = [];
  }

  /**
   * Sets the whitelisted player usernames protected from attack.
   * @param {string[]} players
   */
  setWhitelist(players = []) {
    this.whitelist = players.map((p) => p.toLowerCase());
  }

  /**
   * Calculates a numerical threat score for a given entity based on mob type, proximity, and targeting.
   * @param {import('mineflayer').Entity} entity - Target entity
   * @returns {number} Threat rating (0 = harmless, 100 = critical threat)
   */
  threatScore(entity) {
    if (!entity || !entity.position) return 0;
    if (this.isAlly(entity)) return 0;

    const mobName = (entity.name || '').toLowerCase();
    const baseScore = combatData.baseThreatScores[mobName] || (combatData.hostileMobs.includes(mobName) ? 50 : 0);
    if (baseScore === 0) return 0;

    const botPos = this.bot.entity ? this.bot.entity.position : null;
    if (!botPos) return baseScore;

    const dist = typeof botPos.distanceTo === 'function'
      ? botPos.distanceTo(entity.position)
      : Math.sqrt(
          Math.pow(botPos.x - entity.position.x, 2) +
          Math.pow(botPos.y - entity.position.y, 2) +
          Math.pow(botPos.z - entity.position.z, 2)
        );

    // Closer distance increases threat proportionally up to +30 points
    const proximityBoost = Math.max(0, Math.round((32 - Math.min(dist, 32)) * (30 / 32)));

    // Extra danger for close creepers
    const creeperDanger = (mobName === 'creeper' && dist < 7) ? 25 : 0;

    return Math.min(100, baseScore + proximityBoost + creeperDanger);
  }

  /**
   * Evaluates and selects the highest damage weapon currently available in the bot inventory.
   * Rates weapons by base tier damage + enchantment bonuses.
   * 
   * @returns {Object|null} The best weapon item or null
   */
  pickBestWeapon() {
    if (!this.bot || !this.bot.inventory) return null;
    const items = this.bot.inventory.items();
    let bestItem = null;
    let highestScore = -1;

    for (const item of items) {
      const baseDamage = combatData.weaponTiers[item.name];
      if (baseDamage !== undefined) {
        let score = baseDamage;

        // Enchantments bonus (Sharpness, Smite)
        if (item.nbt && item.nbt.value && item.nbt.value.Enchantments) {
          const enchants = item.nbt.value.Enchantments.value && item.nbt.value.Enchantments.value.value;
          if (Array.isArray(enchants)) {
            for (const ench of enchants) {
              const id = ench.id && ench.id.value;
              const lvl = ench.lvl && ench.lvl.value ? Number(ench.lvl.value) : 1;
              if (id === 'minecraft:sharpness' || id === 'sharpness') {
                score += lvl * 1.25;
              } else if (id === 'minecraft:smite' || id === 'smite') {
                score += lvl * 1.5;
              } else if (id === 'minecraft:fire_aspect' || id === 'fire_aspect') {
                score += lvl * 1.0;
              }
            }
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestItem = item;
        }
      }
    }

    return bestItem;
  }

  /**
   * Equips the best available weapon into main hand.
   * @returns {Promise<boolean>}
   */
  async equipBestWeapon() {
    const bestWeapon = this.pickBestWeapon();
    if (!bestWeapon) return false;

    try {
      await this.bot.equip(bestWeapon, 'hand');
      return true;
    } catch (err) {
      console.warn('[CombatHelperService] Failed to equip weapon:', err.message);
      return false;
    }
  }

  /**
   * Finds and equips a shield into the off-hand slot.
   * @returns {Promise<boolean>}
   */
  async equipShield() {
    if (!this.bot || !this.bot.inventory) return false;

    // Check if shield is already in off-hand
    const offhandSlot = this.bot.inventory.slots[45];
    if (offhandSlot && offhandSlot.name === 'shield') {
      return true;
    }

    const shieldItem = this.bot.inventory.items().find((i) => i.name === 'shield');
    if (!shieldItem) return false;

    try {
      await this.bot.equip(shieldItem, 'off-hand');
      return true;
    } catch (err) {
      console.warn('[CombatHelperService] Failed to equip shield:', err.message);
      return false;
    }
  }

  /**
   * Checks whether an entity is considered a friendly ally or protected entity.
   * @param {import('mineflayer').Entity} entity
   * @returns {boolean}
   */
  isAlly(entity) {
    return combatPolicies.isProtectedAlly(entity, this.whitelist);
  }

  /**
   * Calculates the recommended tactical maneuver for a given entity.
   * @param {import('mineflayer').Entity} entity
   * @returns {'tactical_retreat'|'kite_creeper'|'shield_block'|'melee_rush'}
   */
  calculateTactics(entity) {
    const hasShield = Boolean(
      (this.bot.inventory && this.bot.inventory.slots[45] && this.bot.inventory.slots[45].name === 'shield') ||
      (this.bot.inventory && this.bot.inventory.items().some((i) => i.name === 'shield'))
    );

    const botStatus = {
      health: this.bot.health !== undefined ? this.bot.health : 20,
      food: this.bot.food !== undefined ? this.bot.food : 20,
      position: this.bot.entity ? this.bot.entity.position : null,
      hasShield
    };

    return combatPolicies.getTacticalAction(entity, botStatus);
  }
}

module.exports = CombatHelperService;
