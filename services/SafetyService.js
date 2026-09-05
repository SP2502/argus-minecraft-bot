const safetyThresholds = require('../config/safetyThresholds');

/**
 * SafetyService - Autonomous survival, hazard monitoring, damage tracking, and emergency retreat coordinator.
 * 
 * Invariant: Every feature skill should call `shouldRetreat()` or `isCritical()` in its main loop.
 */
class SafetyService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference for navigation and location queries
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    this.lastDamageTime = 0;
    this.consecutiveDamageCount = 0;
  }

  /**
   * Evaluates if the bot is in immediate critical danger.
   * Checks for critical health (<5), starvation (<4), sustained damage spikes (>=3 hits), or active burning.
   * 
   * @returns {boolean} True if in critical condition
   * @example
   * if (ctx.safety.isCritical()) { await this.safetyCheckLoop(); }
   */
  isCritical() {
    if (!this.bot) return false;
    const health = this.bot.health !== undefined ? this.bot.health : 20;
    const food = this.bot.food !== undefined ? this.bot.food : 20;
    const isBurning = Boolean(this.bot.entity && !this.bot.entity.isInWater && this.bot.entity.isBurning);

    return (
      health < safetyThresholds.CRITICAL_HEALTH ||
      food < safetyThresholds.CRITICAL_HUNGER ||
      this.consecutiveDamageCount >= safetyThresholds.CONSECUTIVE_DAMAGE_THRESHOLD ||
      isBurning
    );
  }

  /**
   * Checks if bot health has dropped below the low health warning threshold (<10).
   * 
   * @returns {boolean}
   * @example
   * if (ctx.safety.isLowHealth()) { ... }
   */
  isLowHealth() {
    if (!this.bot) return false;
    const health = this.bot.health !== undefined ? this.bot.health : 20;
    return health < safetyThresholds.LOW_HEALTH;
  }

  /**
   * Checks if bot hunger has dropped below the low hunger warning threshold (<6).
   * 
   * @returns {boolean}
   * @example
   * if (ctx.safety.isLowHunger()) { ... }
   */
  isLowHunger() {
    if (!this.bot) return false;
    const food = this.bot.food !== undefined ? this.bot.food : 20;
    return food < safetyThresholds.LOW_HUNGER;
  }

  /**
   * Scans adjacent voxel neighborhood for lava, fire, or burning blocks.
   * 
   * @param {number} [radius=safetyThresholds.LAVA_SCAN_RADIUS] - Scan radius in blocks
   * @returns {boolean} True if any hazardous fluid/fire block is within radius
   * @example
   * const nearLava = ctx.safety.isNearLava(3);
   */
  isNearLava(radius = safetyThresholds.LAVA_SCAN_RADIUS) {
    if (!this.bot || !this.bot.findBlock) return false;
    try {
      const hazard = this.bot.findBlock({
        matching: (block) => {
          if (!block) return false;
          return ['lava', 'flowing_lava', 'fire', 'soul_fire', 'magma_block'].includes(block.name);
        },
        maxDistance: radius
      });
      return hazard !== null;
    } catch (err) {
      return false;
    }
  }

  /**
   * Checks if the in-game world time represents nighttime (hostile mobs active).
   * 
   * @returns {boolean} True if nighttime
   * @example
   * if (ctx.safety.isNight()) { ... }
   */
  isNight() {
    if (!this.bot || !this.bot.time) return false;
    if (typeof this.bot.time.isDay === 'boolean') {
      return !this.bot.time.isDay;
    }
    const timeOfDay = this.bot.time.timeOfDay || 0;
    return timeOfDay >= 13000 && timeOfDay <= 23000;
  }

  /**
   * Checks whether the bot is currently located outdoors exposed to the sky.
   * 
   * @returns {boolean} True if sky light is present or no solid blocks are overhead
   * @example
   * if (ctx.safety.isOutdoors()) { ... }
   */
  isOutdoors() {
    if (!this.bot || !this.bot.entity || !this.bot.entity.position) return false;
    const pos = this.bot.entity.position.floored();
    const currentBlock = this.bot.blockAt(pos);

    if (currentBlock && currentBlock.skyLight !== undefined) {
      return currentBlock.skyLight > 0;
    }

    // Fallback: check 20 blocks directly above
    for (let dy = 1; dy <= 20; dy++) {
      const checkBlock = this.bot.blockAt(pos.offset(0, dy, 0));
      if (checkBlock && checkBlock.boundingBox === 'block') {
        return false;
      }
    }
    return true;
  }

  /**
   * Queries the location registry for the nearest registered base or safe point.
   * 
   * @param {import('./LocationRegistry')} [locationRegistry] - Optional registry override
   * @returns {Promise<{ x: number, y: number, z: number, name?: string }|null>}
   * @example
   * const safeZone = await ctx.safety.getNearestSafeZone();
   */
  async getNearestSafeZone(locationRegistry = null) {
    const registry = locationRegistry || (this.ctx && this.ctx.locations);
    if (!registry) return null;

    try {
      const primaryBase = await registry.getPrimaryBase();
      if (primaryBase) {
        return {
          x: primaryBase.x,
          y: primaryBase.y,
          z: primaryBase.z,
          name: primaryBase.name || 'Primary Base'
        };
      }

      const allBases = await registry.listByType('base');
      if (allBases && allBases.length > 0) {
        const botPos = this.bot.entity ? this.bot.entity.position : { x: 0, y: 0, z: 0 };
        let nearest = null;
        let minDist = Infinity;

        for (const base of allBases) {
          const dx = base.x - botPos.x;
          const dy = base.y - botPos.y;
          const dz = base.z - botPos.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < minDist) {
            minDist = dist;
            nearest = base;
          }
        }
        return nearest ? { x: nearest.x, y: nearest.y, z: nearest.z, name: nearest.name } : null;
      }
    } catch (err) {
      console.warn('[SafetyService] Error finding registered safe zone:', err.message);
    }

    return null;
  }

  /**
   * Disengages ongoing activities and immediately paths the bot to the nearest registered safe zone.
   * 
   * @param {import('./LocationRegistry')} [locationRegistry] - Optional registry override
   * @returns {Promise<boolean>} True if safe zone was reached
   * @throws {Error} If no safe zone is found or navigation is unavailable
   * @example
   * await ctx.safety.fleeToNearestSafeZone();
   */
  async fleeToNearestSafeZone(locationRegistry = null) {
    const safeZone = await this.getNearestSafeZone(locationRegistry);
    if (!safeZone) {
      throw new Error('[SafetyService] Cannot flee: No registered safe zone or base available.');
    }

    if (!this.ctx || !this.ctx.nav) {
      throw new Error('[SafetyService] NavigationService unavailable for emergency flee.');
    }

    console.warn(`[SafetyService] Emergency evacuation to safe zone '${safeZone.name}' at (${safeZone.x}, ${safeZone.y}, ${safeZone.z})`);
    const result = await this.ctx.nav.goTo(safeZone, { timeout: 30000 });
    return result.success;
  }

  /**
   * Evaluates composite retreat conditions.
   * Returns true if in critical danger, or low health while adjacent to hazardous terrain.
   * 
   * @returns {boolean} True if bot must retreat
   * @example
   * if (ctx.safety.shouldRetreat()) { await ctx.safety.fleeToNearestSafeZone(); }
   */
  shouldRetreat() {
    return this.isCritical() || (this.isLowHealth() && this.isNearLava());
  }

  /**
   * Records a damage hit against the bot and updates damage frequency tracking.
   * Called automatically by bot 'health' event listeners.
   */
  recordDamage() {
    this.consecutiveDamageCount++;
    this.lastDamageTime = Date.now();
    console.warn(`[SafetyService] Bot damaged! Consecutive hits: ${this.consecutiveDamageCount}`);
  }

  /**
   * Resets consecutive damage hit counter to zero.
   * Called when no damage has occurred for the cooldown window (10s).
   */
  resetDamageTracker() {
    if (this.consecutiveDamageCount > 0) {
      this.consecutiveDamageCount = 0;
      console.log('[SafetyService] Consecutive damage tracker reset.');
    }
  }

  /**
   * Returns a snapshot of safety telemetry for status dashboards and API endpoints.
   * 
   * @returns {{ isCritical: boolean, isLowHealth: boolean, isLowHunger: boolean, isNearLava: boolean, isNight: boolean, shouldRetreat: boolean }}
   */
  getStatus() {
    return {
      isCritical: this.isCritical(),
      isLowHealth: this.isLowHealth(),
      isLowHunger: this.isLowHunger(),
      isNearLava: this.isNearLava(),
      isNight: this.isNight(),
      shouldRetreat: this.shouldRetreat()
    };
  }

  /**
   * Health heartbeat check.
   * @returns {{ ok: boolean, isCritical: boolean }}
   */
  ping() {
    return {
      ok: Boolean(this.bot),
      isCritical: this.isCritical()
    };
  }
}

module.exports = SafetyService;
