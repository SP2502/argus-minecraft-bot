const combatData = require('./combat.data');
const combatPolicies = require('./combat.policy');
const combatConfig = require('./combat.config');
const MobTactics = require('./mob-tactics');

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
   * Evaluates the appropriate tactical response for an engaged target entity.
   * @param {import('mineflayer').Entity} targetEntity
   * @returns {'tactical_retreat'|'kite_creeper'|'shield_block'|'melee_rush'}
   */
  calculateTactics(targetEntity) {
    if (!targetEntity) return 'melee_rush';
    const botStatus = {
      health: this.bot ? this.bot.health : 20,
      position: this.bot && this.bot.entity ? this.bot.entity.position : null,
      hasShield: Boolean(this.bot && this.bot.inventory && this.bot.inventory.slots[45] && this.bot.inventory.slots[45].name === 'shield')
    };
    return MobTactics.getTacticalAction(targetEntity, botStatus);
  }

  /**
   * Raises shield in off-hand to block incoming attacks.
   * @returns {boolean} True if shield was raised
   */
  raiseShield() {
    if (this.bot && this.bot.inventory && this.bot.inventory.slots[45] && this.bot.inventory.slots[45].name === 'shield') {
      if (typeof this.bot.activateItem === 'function') {
        this.bot.activateItem(true);
        return true;
      }
    }
    return false;
  }

  /**
   * Lowers active shield.
   */
  lowerShield() {
    if (this.bot && typeof this.bot.deactivateItem === 'function') {
      this.bot.deactivateItem();
    }
  }

  /**
   * Scans for all active hostile mob threats within the specified radius.
   * Sorted descending by threat rating.
   * 
   * @param {number} [radius=14] - Scan radius in blocks
   * @returns {Array<import('mineflayer').Entity>}
   */
  findNearbyThreats(radius = 14) {
    if (!this.bot || !this.bot.entities) return [];
    const botPos = this.bot.entity ? this.bot.entity.position : null;
    if (!botPos) return [];

    const threats = [];
    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || !entity.position) continue;
      if (entity.isValid === false) continue;
      if (entity.metadata && entity.metadata[7] <= 0) continue; // Dead entity

      const dist = typeof botPos.distanceTo === 'function'
        ? botPos.distanceTo(entity.position)
        : Math.sqrt(
            Math.pow(botPos.x - entity.position.x, 2) +
            Math.pow(botPos.y - entity.position.y, 2) +
            Math.pow(botPos.z - entity.position.z, 2)
          );

      if (dist > radius) continue;

      if (combatPolicies.isHostile(entity, 'any') && !this.isAlly(entity)) {
        threats.push({
          entity,
          distance: dist,
          score: this.threatScore(entity)
        });
      }
    }

    threats.sort((a, b) => b.score - a.score);
    return threats.map((t) => t.entity);
  }

  /**
   * Returns the single highest threat hostile entity within proximity.
   * @param {number} [radius=12]
   * @returns {import('mineflayer').Entity|null}
   */
  getImmediateThreat(radius = 12) {
    const threats = this.findNearbyThreats(radius);
    return threats.length > 0 ? threats[0] : null;
  }

  /**
   * Identifies the hostile entity most likely responsible for attacking the bot.
   * @param {number} [radius=16]
   * @returns {import('mineflayer').Entity|null}
   */
  findAttacker(radius = 16) {
    const threats = this.findNearbyThreats(radius);
    if (threats.length === 0) return null;

    // First priority: mob within immediate melee reach (< 3.5m)
    const botPos = this.bot.entity ? this.bot.entity.position : null;
    if (botPos) {
      const closeThreat = threats.find((t) => {
        const d = typeof botPos.distanceTo === 'function' ? botPos.distanceTo(t.position) : 99;
        return d <= 4.0;
      });
      if (closeThreat) return closeThreat;
    }

    // Second priority: highest threat mob (e.g. skeleton shooting or creeper)
    return threats[0];
  }

  /**
   * Executes immediate tactical defense against a threatening hostile mob.
   * Equips weapons, manages shields, looks at target, and attacks.
   * 
   * @param {import('mineflayer').Entity} targetEntity
   * @returns {Promise<{ defeated: boolean, action: string }>}
   */
  async defendAgainst(targetEntity) {
    if (!targetEntity || !targetEntity.position) {
      return { defeated: true, action: 'none' };
    }

    // 1. Prepare Combat Equipment
    await this.equipBestWeapon();
    await this.equipShield();

    const tactics = this.calculateTactics(targetEntity);

    // 2. Execute mob-optimized tactical maneuver
    const execution = await MobTactics.executeTactic(this.bot, this.ctx, targetEntity, tactics);

    const isDefeated = !targetEntity.isValid || (targetEntity.metadata && targetEntity.metadata[7] <= 0);
    return { defeated: isDefeated, action: execution.action || tactics };
  }

  /**
   * Responds immediately when the bot is under attack.
   * Identifies attacker, equips weapon/shield, and counters.
   * @returns {Promise<boolean>} True if retaliation was engaged
   */
  async handleUnderAttack() {
    const attacker = this.findAttacker(16);
    if (!attacker) return false;

    console.warn(`[CombatHelperService] Under attack by hostile '${attacker.name}'! Launching immediate defense.`);
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('combat.under_attack', { attacker: attacker.name });
    }

    await this.defendAgainst(attacker);
    return true;
  }

  /**
   * Subsystem health ping.
   * @returns {{ ok: boolean, nearbyThreats: number }}
   */
  ping() {
    return {
      ok: Boolean(this.bot),
      nearbyThreats: this.findNearbyThreats(10).length
    };
  }
}

module.exports = CombatHelperService;
