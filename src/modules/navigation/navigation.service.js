const { pathfinder, goals } = require('mineflayer-pathfinder');
const { createSafeMovements, getStuckDetector } = require('../../../services/PathfindingUtil');
const LocationRegistry = require('./locations.repository');

/**
 * ============================================================================
 * ALL feature skills MUST navigate through this service.
 * Never call bot.pathfinder directly from a skill file.
 * ============================================================================
 * 
 * NavigationService manages path calculation, obstacle avoidance, stuck detection & recovery,
 * entity following, and home base navigation.
 */
class NavigationService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {LocationRegistry} [locationRegistry] - Optional location registry instance
   */
  constructor(bot, locationRegistry = null) {
    this.bot = bot;
    this.locationRegistry = locationRegistry || new LocationRegistry();
    this.movements = null;

    // Navigation state tracking
    this.isFollowing = false;
    this.followTarget = null;
    this.followInterval = null;
    this.currentGoal = null;
    this.stuckDetector = getStuckDetector(this.bot, 10);
    this.breadcrumbs = [];

    this.initPathfinder();
  }

  /**
   * Initializes mineflayer-pathfinder plugin and sets up safe default movements.
   * @private
   */
  initPathfinder() {
    if (!this.bot.pathfinder) {
      this.bot.loadPlugin(pathfinder);
    }

    const setup = () => {
      this.movements = createSafeMovements(this.bot);
      if (this.bot.pathfinder) {
        this.bot.pathfinder.setMovements(this.movements);
      }
    };

    if (this.bot.registry) {
      setup();
    } else {
      this.bot.once('spawn', setup);
    }
  }

  /**
   * Navigates the bot to a specific 3D coordinate with timeout, stuck detection, and recovery.
   * 
   * @param {{ x: number, y: number, z: number }} position - Target coordinates or Vec3
   * @param {Object} [options={}] - Navigation options
   * @param {number} [options.timeout=60000] - Navigation timeout in milliseconds (default: 60s)
   * @param {Function} [options.onStuck] - Custom callback invoked if the bot gets stuck
   * @param {string[]} [options.avoidEntities=[]] - Entity types to avoid pathing near
   * @param {boolean} [options.allowBreak=false] - Whether the bot is allowed to break blocking blocks
   * @param {number} [options.range=1] - Distance tolerance to goal
   * @returns {Promise<{ success: boolean, timeMs?: number, reason?: string }>}
   * 
   * @example
   * const result = await ctx.nav.goTo({ x: 120, y: 64, z: -350 }, { timeout: 45000, allowBreak: false });
   * if (result.success) {
   *   console.log(`Arrived in ${result.timeMs}ms`);
   * }
   */
  async goTo(position, options = {}) {
    // 1. Input Validation
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' || typeof position.z !== 'number') {
      return { success: false, reason: 'Invalid target position provided. Position must contain numeric x, y, z.' };
    }

    const targetPos = {
      x: Math.floor(position.x),
      y: Math.floor(position.y),
      z: Math.floor(position.z)
    };

    if (this.bot.entity && this.bot.entity.position) {
      this.breadcrumbs.push(this.bot.entity.position.floored());
      if (this.breadcrumbs.length > 10) this.breadcrumbs.shift();
    }

    const startTime = Date.now();
    const timeoutMs = options.timeout !== undefined ? options.timeout : 60000;
    const allowBreak = Boolean(options.allowBreak);
    const range = options.range !== undefined ? options.range : 1;

    // 2. Configure movements
    if (!this.movements) {
      this.movements = createSafeMovements(this.bot);
    }
    this.movements.canDig = allowBreak;
    this.bot.pathfinder.setMovements(this.movements);

    // 3. Set goal and state
    this.currentGoal = targetPos;
    this.stuckDetector.reset();

    const goal = range > 1
      ? new goals.GoalNear(targetPos.x, targetPos.y, targetPos.z, range)
      : new goals.GoalBlock(targetPos.x, targetPos.y, targetPos.z);

    let stuckCheckTimer = null;
    let isStuckRecovering = false;

    try {
      // 4. Wrap pathfinder goto with stuck monitoring and timeout
      const navigationPromise = new Promise((resolve, reject) => {
        // Periodic stuck monitor
        stuckCheckTimer = setInterval(async () => {
          if (isStuckRecovering) return;

          if (this.isStuck()) {
            isStuckRecovering = true;
            const recovered = await this._attemptStuckRecovery(options.onStuck, allowBreak);
            isStuckRecovering = false;

            if (!recovered) {
              clearInterval(stuckCheckTimer);
              this.bot.pathfinder.stop();
              reject(new Error('Stuck, manual intervention needed'));
            }
          }
        }, 2000);

        this.bot.pathfinder.goto(goal)
          .then(() => resolve(true))
          .catch((err) => reject(err));
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Navigation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      await Promise.race([navigationPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      return { success: true, timeMs: elapsed };
    } catch (err) {
      this.bot.pathfinder.stop();
      return { success: false, reason: err.message || 'Navigation failed' };
    } finally {
      if (stuckCheckTimer) {
        clearInterval(stuckCheckTimer);
      }
      this.currentGoal = null;
      this.stuckDetector.reset();
    }
  }

  /**
   * Internal stuck recovery sequence:
   * 1. Try a small jump (200ms)
   * 2. Wait 3s, check if still stuck
   * 3. Try breaking 1 blocking non-blacklisted adjacent block
   * 4. Call onStuck callback if provided
   * 
   * @private
   * @param {Function} [onStuckCallback] - Optional user callback
   * @param {boolean} [allowBreak=false] - Whether block breaking is permitted
   * @returns {Promise<boolean>} True if recovered, false if still stuck
   */
  async _attemptStuckRecovery(onStuckCallback, allowBreak = false) {
    console.warn('[NavigationService] Stuck detected. Initiating recovery protocol...');

    // Step 1: Small jump
    this.bot.setControlState('jump', true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    this.bot.setControlState('jump', false);

    // Wait 3 seconds to see if bot continues moving
    await new Promise((resolve) => setTimeout(resolve, 3000));
    if (!this.isStuck()) {
      console.log('[NavigationService] Recovered after jump.');
      this.stuckDetector.reset();
      return true;
    }

    // Step 2: Try breaking one blocking block if permitted
    if (allowBreak && this.bot.entity && this.bot.entity.position) {
      const blacklist = ['bedrock', 'chest', 'trapped_chest', 'ender_chest', 'spawner', 'barrier', 'diamond_block'];
      const offsets = [
        { x: 1, y: 1, z: 0 },
        { x: -1, y: 1, z: 0 },
        { x: 0, y: 1, z: 1 },
        { x: 0, y: 1, z: -1 },
        { x: 1, y: 0, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 0, y: 0, z: 1 },
        { x: 0, y: 0, z: -1 }
      ];

      const currentPos = this.bot.entity.position.floored();
      for (const off of offsets) {
        const checkPos = currentPos.offset(off.x, off.y, off.z);
        const block = this.bot.blockAt(checkPos);
        if (block && block.boundingBox === 'block' && !blacklist.includes(block.name) && this.bot.canDigBlock(block)) {
          try {
            console.log(`[NavigationService] Clearing obstacle block ${block.name} at ${checkPos}`);
            await this.bot.dig(block);
            this.stuckDetector.reset();
            return true;
          } catch (digErr) {
            console.warn('[NavigationService] Failed to dig blocking block:', digErr.message);
          }
        }
      }
    }

    // Step 3: Execute custom stuck callback if provided
    if (typeof onStuckCallback === 'function') {
      try {
        await onStuckCallback();
        this.stuckDetector.reset();
        return !this.isStuck();
      } catch (cbErr) {
        console.error('[NavigationService] Error during onStuck callback:', cbErr.message);
      }
    }

    return false;
  }

  /**
   * Continuously follows an entity, recalculating the path every 2 seconds.
   * 
   * @param {import('mineflayer').Entity} entity - Target entity to follow
   * @param {Object} [options={}] - Follow options
   * @param {number} [options.distance=4] - Target follow distance in blocks
   * @returns {{ stopFollowing: () => void }} Object containing stopFollowing method
   * 
   * @example
   * const followHandle = await ctx.nav.followEntity(playerEntity, { distance: 3 });
   * // Later:
   * followHandle.stopFollowing();
   */
  async followEntity(entity, options = {}) {
    if (!entity || !entity.position) {
      throw new Error('[NavigationService] Cannot follow null or invalid entity');
    }

    this.stopFollowing();

    const distance = options.distance !== undefined ? options.distance : 4;
    this.isFollowing = true;
    this.followTarget = entity;

    if (!this.movements) {
      this.movements = createSafeMovements(this.bot);
    }
    this.bot.pathfinder.setMovements(this.movements);

    const updateFollowGoal = () => {
      if (!this.isFollowing || !this.followTarget || !this.followTarget.isValid) {
        this.stopFollowing();
        return;
      }

      if (this.bot.entity && this.followTarget.position) {
        const dist = this.bot.entity.position.distanceTo(this.followTarget.position);
        if (dist > 50) {
          console.warn('[NavigationService] Target entity exceeded 50 blocks distance. Stopping follow.');
          this.stopFollowing();
          return;
        }
      }

      const goal = new goals.GoalFollow(this.followTarget, distance);
      this.bot.pathfinder.setGoal(goal, true);
    };

    updateFollowGoal();
    this.followInterval = setInterval(updateFollowGoal, 2000);

    return {
      stopFollowing: () => this.stopFollowing()
    };
  }

  /**
   * Stops any ongoing follow operation or pathfinder goal.
   * @example
   * ctx.nav.stopFollowing();
   */
  stopFollowing() {
    if (this.followInterval) {
      clearInterval(this.followInterval);
      this.followInterval = null;
    }
    this.isFollowing = false;
    this.followTarget = null;
    this.currentGoal = null;

    if (this.bot && this.bot.pathfinder) {
      this.bot.pathfinder.setGoal(null);
    }
  }

  /**
   * Navigates the bot to its primary home base registered in the database.
   * 
   * @returns {Promise<{ success: boolean, timeMs?: number, reason?: string }>}
   * @throws {Error} If no primary base is registered in LocationRegistry
   * 
   * @example
   * const result = await ctx.nav.returnHome();
   */
  async returnHome() {
    const home = await this.locationRegistry.getPrimaryBase();
    if (!home) {
      throw new Error('[NavigationService] No primary base registered in LocationRegistry.');
    }

    console.log(`[NavigationService] Returning home to '${home.name}' at (${home.x}, ${home.y}, ${home.z})`);
    return this.goTo({ x: home.x, y: home.y, z: home.z });
  }

  /**
   * Checks if the bot is currently stuck based on position displacement over 10 seconds.
   * @returns {boolean} True if stuck
   * 
   * @example
   * if (ctx.nav.isStuck()) { ... }
   */
  isStuck() {
    return this.stuckDetector.check();
  }

  /**
   * Retraces the path back along recorded breadcrumb coordinates.
   * @returns {Promise<boolean>}
   */
  async retracePath() {
    if (!this.breadcrumbs || this.breadcrumbs.length === 0) {
      return false;
    }
    const previous = this.breadcrumbs.pop();
    if (!previous) return false;
    const res = await this.goTo(previous, { timeout: 15000, range: 1 });
    return res.success;
  }

  /**
   * Returns current navigation telemetry status.
   * @returns {{ isFollowing: boolean, isStuck: boolean, currentGoal: {x: number, y: number, z: number}|null }}
   */
  getNavStatus() {
    return {
      isFollowing: this.isFollowing,
      isStuck: this.isStuck(),
      currentGoal: this.currentGoal
    };
  }

  /**
   * Health heartbeat check.
   * @returns {{ ok: boolean, isMoving: boolean }}
   */
  ping() {
    return {
      ok: Boolean(this.bot && this.bot.pathfinder),
      isMoving: Boolean(this.currentGoal || this.isFollowing)
    };
  }
}

module.exports = NavigationService;
