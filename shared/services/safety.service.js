const safetyThresholds = require('../config/safety-thresholds');

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
    this.lastEatTime = 0;
    this._isEating = false;
    this.lastFireExtinguishTime = 0;
    this.lastPotionCureTime = 0;
    this.isHandlingHazard = false;
    this.lastShieldBlockTime = 0;
  }

  /**
   * Autonomous survival auto-eat routine.
   * Evaluates current health and food level and consumes best available food from inventory.
   * Smooth & reliable: enforces an 8-second cooldown and only eats when actually depleted or damaged.
   * 
   * @returns {Promise<boolean>} True if food was successfully consumed
   */
  async checkAutoEat() {
    if (!this.bot || this.bot.food === undefined) return false;
    const now = Date.now();
    if (now - this.lastEatTime < 8000) return false;

    const food = this.bot.food;
    const health = this.bot.health !== undefined ? this.bot.health : 20;

    // Eat if hungry (<=16) or if injured (<18 health and food < 20 to regenerate)
    const needsFood = food <= 16 || (health < 18 && food < 20);
    if (!needsFood) return false;

    const EDIBLE_FOODS = [
      'golden_apple', 'enchanted_golden_apple', 'golden_carrot',
      'cooked_beef', 'steak', 'cooked_porkchop', 'cooked_mutton',
      'cooked_salmon', 'cooked_chicken', 'baked_potato', 'bread',
      'cooked_cod', 'apple', 'carrot', 'sweet_berries', 'melon_slice',
      'pumpkin_pie', 'cookie', 'dried_kelp', 'beef', 'porkchop', 'mutton'
    ];

    const items = this.bot.inventory ? this.bot.inventory.items() : [];
    let foodItem = null;
    for (const foodName of EDIBLE_FOODS) {
      foodItem = items.find((i) => i.name === foodName);
      if (foodItem) break;
    }

    if (!foodItem) return false;
    if (this._isEating) return false;
    this._isEating = true;

    try {
      if (typeof this.bot.equip === 'function') {
        await this.bot.equip(foodItem, 'hand');
      }
      if (typeof this.bot.consume === 'function') {
        await this.bot.consume();
      }
      console.log(`[SafetyService] Auto-eat: consumed ${foodItem.name}. Health: ${this.bot.health}/20, Food: ${this.bot.food}/20`);
      this.lastEatTime = Date.now();
      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('log:entry', {
          severity: 'INFO',
          category: 'SAFETY',
          message: `Auto-ate ${foodItem.name} (Health: ${this.bot.health}/20, Food: ${this.bot.food}/20)`
        });
      }
      return true;
    } catch (err) {
      return false;
    } finally {
      this._isEating = false;
    }
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

    // Auto-clear stale damage count if bot was restored to full/high health
    if (health >= 18 && this.consecutiveDamageCount > 0 && (Date.now() - (this.lastDamageTime || 0)) > 2000) {
      this.consecutiveDamageCount = 0;
    }

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
   * Drowning Hazard Guard.
   * If bot is submerged in water and oxygen is dropping (oxygenLevel <= 12 out of 20),
   * surfaces aggressively by engaging jump/swim controls until breath is recovered.
   * 
   * @returns {boolean} True if drowning avoidance action is currently active
   */
  checkDrowningHazard() {
    if (!this.bot || !this.bot.entity) return false;
    const oxygen = this.bot.oxygenLevel !== undefined ? this.bot.oxygenLevel : 20;
    const inWater = Boolean(this.bot.entity.isInWater);

    if (inWater && oxygen <= 12) {
      if (typeof this.bot.setControlState === 'function') {
        this.bot.setControlState('jump', true);
      }
      if (oxygen <= 6) {
        console.warn(`[SafetyService] Drowning emergency! Oxygen: ${oxygen}/20. Surfacing immediately.`);
        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('log:entry', {
            severity: 'WARN',
            category: 'SAFETY',
            message: `Drowning warning: Oxygen ${oxygen}/20. Swimming to surface.`
          });
        }
      }
      return true;
    } else if (inWater && oxygen >= 18) {
      // Safely release jump if bot has plenty of air
      if (typeof this.bot.setControlState === 'function' && !this.bot.controlState?.jump) {
        // Leave normal controls
      }
    }
    return false;
  }

  /**
   * Suffocation / Block Collapse Guard.
   * Checks if the bot's head is trapped inside a solid non-transparent block
   * (e.g. falling gravel, sand, or suffocating blocks) and clears or jumps out.
   * 
   * @returns {Promise<boolean>} True if suffocation hazard detected and counter-action executed
   */
  async checkSuffocationHazard() {
    if (!this.bot || !this.bot.entity || !this.bot.entity.position || !this.bot.blockAt) return false;
    try {
      const eyePos = this.bot.entity.position.offset(0, 1.6, 0).floored();
      const eyeBlock = this.bot.blockAt(eyePos);
      if (eyeBlock && eyeBlock.boundingBox === 'block' && eyeBlock.name !== 'air' && eyeBlock.name !== 'water') {
        console.warn(`[SafetyService] Suffocation hazard! Head inside '${eyeBlock.name}'. Attempting escape.`);
        // Try jumping and digging the suffocating block if possible
        if (typeof this.bot.setControlState === 'function') {
          this.bot.setControlState('jump', true);
          setTimeout(() => {
            if (this.bot && typeof this.bot.setControlState === 'function') {
              this.bot.setControlState('jump', false);
            }
          }, 500);
        }
        if (typeof this.bot.dig === 'function' && this.bot.canDigBlock && this.bot.canDigBlock(eyeBlock)) {
          await this.bot.dig(eyeBlock, 'ignore');
        }
        return true;
      }
    } catch (err) {
      // Non-fatal
    }
    return false;
  }

  /**
   * Fire & Lava Extinguishment Protocol.
   * If bot is burning on fire, checks inventory for a water bucket and places it at feet
   * to douse the flames, then retrieves the water source block back into the bucket.
   * 
   * @returns {Promise<boolean>} True if fire was extinguished with water bucket
   */
  async checkFireExtinguishment() {
    if (!this.bot || !this.bot.entity) return false;
    const isBurning = Boolean(this.bot.entity.isBurning && !this.bot.entity.isInWater);
    if (!isBurning) return false;

    const now = Date.now();
    if (now - this.lastFireExtinguishTime < 4000) return false;
    this.lastFireExtinguishTime = now;

    if (!this.bot.inventory) return false;
    const waterBucket = this.bot.inventory.items().find((i) => i.name === 'water_bucket');
    if (!waterBucket) return false;

    try {
      console.warn('[SafetyService] Bot burning! Deploying emergency water bucket at feet.');
      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('log:entry', {
          severity: 'WARN',
          category: 'SAFETY',
          message: 'Fire hazard: Placing water bucket at feet to extinguish flames.'
        });
      }

      if (typeof this.bot.equip === 'function') {
        await this.bot.equip(waterBucket, 'hand');
      }

      const footPos = this.bot.entity.position.floored();
      const blockBelow = this.bot.blockAt ? this.bot.blockAt(footPos.offset(0, -1, 0)) : null;

      if (blockBelow && typeof this.bot.activateBlock === 'function') {
        await this.bot.activateBlock(blockBelow, { x: 0, y: 1, z: 0 });
        
        // Wait 350ms to extinguish, then retrieve water back into bucket
        setTimeout(async () => {
          try {
            const emptyBucket = this.bot.inventory ? this.bot.inventory.items().find((i) => i.name === 'bucket') : null;
            if (emptyBucket && typeof this.bot.equip === 'function') {
              await this.bot.equip(emptyBucket, 'hand');
              const waterBlock = this.bot.blockAt ? this.bot.blockAt(footPos) : null;
              if (waterBlock && (waterBlock.name === 'water' || waterBlock.name === 'flowing_water')) {
                await this.bot.activateBlock(waterBlock);
              }
            }
          } catch (retErr) {
            // Non-fatal
          }
        }, 400);

        return true;
      }
    } catch (err) {
      console.warn('[SafetyService] Failed to place water bucket for fire extinguishment:', err.message);
    }
    return false;
  }

  /**
   * Negative Potion Effects Cleanser.
   * Detects negative status effects (Poison, Wither, Nausea, Slowness) and drinks
   * milk bucket or golden apple if available in inventory.
   * 
   * @returns {Promise<boolean>} True if antidote or healing food was consumed
   */
  async checkNegativePotionEffects() {
    if (!this.bot || !this.bot.entity) return false;
    const effects = this.bot.entity.effects || {};
    const hasHarmfulEffect = Boolean(effects[19] || effects[20] || effects[9] || effects[2]); // Poison, Wither, Nausea, Slowness
    if (!hasHarmfulEffect) return false;

    const now = Date.now();
    if (now - this.lastPotionCureTime < 6000) return false;
    this.lastPotionCureTime = now;

    if (!this.bot.inventory) return false;
    const items = this.bot.inventory.items();
    const milk = items.find((i) => i.name === 'milk_bucket');
    const gapple = items.find((i) => i.name === 'golden_apple' || i.name === 'enchanted_golden_apple');

    const cureItem = milk || gapple;
    if (!cureItem) return false;

    try {
      console.log(`[SafetyService] Harmful potion effect detected. Consuming ${cureItem.name} to neutralize.`);
      if (typeof this.bot.equip === 'function') {
        await this.bot.equip(cureItem, 'hand');
      }
      if (typeof this.bot.consume === 'function') {
        await this.bot.consume();
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Tactical Projectile Defense / Shield Block.
   * Detects nearby hostile ranged attackers (Skeletons, Strays, Pillagers) aiming or within 14m
   * and raises off-hand shield to deflect incoming arrows.
   * 
   * @returns {boolean} True if shield is actively raised
   */
  checkProjectileDefense() {
    if (!this.bot || !this.bot.inventory || !this.bot.entities) return false;

    const offhandSlot = this.bot.inventory.slots[45];
    const hasShield = offhandSlot && offhandSlot.name === 'shield';
    if (!hasShield) {
      // Auto-equip shield if present in inventory
      const shieldItem = this.bot.inventory.items().find((i) => i.name === 'shield');
      if (shieldItem && typeof this.bot.equip === 'function') {
        this.bot.equip(shieldItem, 'off-hand').catch(() => {});
      }
      return false;
    }

    const botPos = this.bot.entity ? this.bot.entity.position : null;
    if (!botPos) return false;

    let rangedThreat = null;
    const RANGED_TYPES = ['skeleton', 'stray', 'pillager', 'piglin', 'drowned'];

    for (const ent of Object.values(this.bot.entities)) {
      if (!ent || !ent.position || ent === this.bot.entity) continue;
      if (ent.isValid === false) continue;
      if (RANGED_TYPES.includes(ent.name)) {
        const dist = typeof botPos.distanceTo === 'function'
          ? botPos.distanceTo(ent.position)
          : Math.sqrt(Math.pow(botPos.x - ent.position.x, 2) + Math.pow(botPos.z - ent.position.z, 2));

        if (dist <= 14) {
          rangedThreat = ent;
          break;
        }
      }
    }

    if (rangedThreat) {
      const now = Date.now();
      this.lastShieldBlockTime = now;
      if (typeof this.bot.lookAt === 'function') {
        this.bot.lookAt(rangedThreat.position.offset(0, 1.4, 0), true).catch(() => {});
      }
      if (typeof this.bot.activateItem === 'function') {
        this.bot.activateItem(true);
      }
      return true;
    } else {
      // Lower shield if no ranged threat within 14m and shield was raised > 1.5s ago
      if (Date.now() - this.lastShieldBlockTime > 1500) {
        if (typeof this.bot.deactivateItem === 'function') {
          this.bot.deactivateItem();
        }
      }
      return false;
    }
  }

  /**
   * Master Autonomous Safety Protocol.
   * Sequentially evaluates all self-preservation layers:
   * 1. Drowning hazard
   * 2. Fire extinguishment
   * 3. Suffocation avoidance
   * 4. Antidote/potion cures
   * 5. Hunger/Health auto-eat
   * 6. Projectile shield defense
   * 
   * @returns {Promise<boolean>} True if any self-safety action was executed
   */
  async runSafetyProtocol() {
    if (this.isHandlingHazard) return false;
    this.isHandlingHazard = true;

    try {
      // 1. Drowning
      if (this.checkDrowningHazard()) {
        return true;
      }

      // 2. Fire Extinguishment
      if (await this.checkFireExtinguishment()) {
        return true;
      }

      // 3. Suffocation
      if (await this.checkSuffocationHazard()) {
        return true;
      }

      // 4. Antidote / Poison
      if (await this.checkNegativePotionEffects()) {
        return true;
      }

      // 5. Auto-Eat
      if (await this.checkAutoEat()) {
        return true;
      }

      // 6. Shield Defense
      if (this.checkProjectileDefense()) {
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[SafetyService] Error in runSafetyProtocol:', err.message);
      return false;
    } finally {
      this.isHandlingHazard = false;
    }
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
