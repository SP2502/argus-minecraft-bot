const { Movements } = require('mineflayer-pathfinder');
const MovementCosts = require('../../modules/navigation/movement-costs');

/**
 * PathfindingUtil - Pure helper functions and movement configuration generators for NavigationService.
 */

/**
 * Creates and configures a safe `Movements` instance for Mineflayer Pathfinder.
 * Configured to avoid lava, prevent crop trampling, manage water traversal, and respect entity boundaries.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @returns {Movements} Configured Movements instance
 * @example
 * const movements = createSafeMovements(bot);
 * bot.pathfinder.setMovements(movements);
 */
function createSafeMovements(bot) {
  const movements = new Movements(bot);

  // Default safety constraints
  movements.canDig = false; // Do not break blocks by default unless explicitly permitted
  movements.allow1by1towers = false;
  movements.allowParkour = true;       // Enable parkour gap-jumping
  movements.allowSprinting = true;     // Enable full sprint speed
  movements.allowFreeMotion = false;
  movements.canJump = true;            // Allow jumping over obstacles
  movements.liquidCost = MovementCosts.WATER;

  // Retrieve Minecraft registry data if available
  const mcData = bot.registry || (bot.version && require('minecraft-data')(bot.version));

  if (mcData) {
    // Avoid hazardous blocks
    if (mcData.blocksByName.lava) {
      movements.blocksToAvoid.add(mcData.blocksByName.lava.id);
    }
    if (mcData.blocksByName.flowing_lava) {
      movements.blocksToAvoid.add(mcData.blocksByName.flowing_lava.id);
    }
    if (mcData.blocksByName.fire) {
      movements.blocksToAvoid.add(mcData.blocksByName.fire.id);
    }
    if (mcData.blocksByName.soul_fire) {
      movements.blocksToAvoid.add(mcData.blocksByName.soul_fire.id);
    }
    if (mcData.blocksByName.sweet_berry_bush) {
      movements.blocksToAvoid.add(mcData.blocksByName.sweet_berry_bush.id);
    }
    if (mcData.blocksByName.cactuses || mcData.blocksByName.cactus) {
      const cactusId = (mcData.blocksByName.cactus || mcData.blocksByName.cactuses).id;
      movements.blocksToAvoid.add(cactusId);
    }

    // Protect farmland from being trampled
    if (mcData.blocksByName.farmland) {
      movements.blocksToAvoid.add(mcData.blocksByName.farmland.id);
    }
  }

  return movements;
}

/**
 * Checks if a 3D coordinate is physically safe for the bot to stand on.
 * Requires solid ground underneath, no lava/fire, and 2 blocks of non-suffocating vertical clearance.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @param {{ x: number, y: number, z: number }} position - Target 3D coordinate
 * @returns {boolean} True if position is safe for standing
 * @example
 * const isSafe = isPositionSafe(bot, { x: 100, y: 64, z: -200 });
 */
function isPositionSafe(bot, position) {
  if (!bot || !bot.world || !position) return false;

  const bx = Math.floor(position.x);
  const by = Math.floor(position.y);
  const bz = Math.floor(position.z);

  // Check world vertical bounds
  if (by < -64 || by > 319) return false;

  const groundBlock = bot.blockAt({ x: bx, y: by - 1, z: bz });
  const feetBlock = bot.blockAt({ x: bx, y: by, z: bz });
  const headBlock = bot.blockAt({ x: bx, y: by + 1, z: bz });

  if (!groundBlock || !feetBlock || !headBlock) return false;

  // Ground must be solid (not air, water, lava, fire)
  const isGroundHarmful = ['lava', 'flowing_lava', 'fire', 'soul_fire', 'air', 'void_air'].includes(groundBlock.name);
  if (isGroundHarmful || groundBlock.boundingBox !== 'block') {
    return false;
  }

  // Feet and head space must not be solid/suffocating or hazardous
  const isFeetHazard = ['lava', 'flowing_lava', 'fire', 'soul_fire', 'cactus', 'sweet_berry_bush'].includes(feetBlock.name);
  const isHeadHazard = ['lava', 'flowing_lava', 'fire', 'soul_fire'].includes(headBlock.name);

  if (isFeetHazard || isHeadHazard) return false;
  if (feetBlock.boundingBox === 'block' || headBlock.boundingBox === 'block') {
    return false;
  }

  return true;
}

/**
 * Creates a stuck detection tracker that monitors position changes over time.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @param {number} [thresholdSeconds=10] - Number of seconds without significant displacement before declaring stuck
 * @returns {{ check: () => boolean, reset: () => void, getElapsedTime: () => number }}
 * @example
 * const stuckDetector = getStuckDetector(bot, 10);
 * if (stuckDetector.check()) {
 *   console.warn("Bot is stuck!");
 * }
 */
function getStuckDetector(bot, thresholdSeconds = 10) {
  let lastPos = null;
  let lastMovedTime = Date.now();
  const thresholdMs = thresholdSeconds * 1000;
  const minDistanceMoved = 1.0; // Distance in blocks required to count as movement

  return {
    /**
     * Checks if the bot is currently considered stuck.
     * @returns {boolean} True if stuck
     */
    check() {
      if (!bot || !bot.entity || !bot.entity.position) return false;

      const currentPos = bot.entity.position;
      const now = Date.now();

      if (!lastPos) {
        lastPos = currentPos.clone ? currentPos.clone() : { ...currentPos };
        lastMovedTime = now;
        return false;
      }

      const dx = currentPos.x - lastPos.x;
      const dy = currentPos.y - lastPos.y;
      const dz = currentPos.z - lastPos.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist >= minDistanceMoved) {
        // Bot has moved sufficiently; reset tracker
        lastPos = currentPos.clone ? currentPos.clone() : { ...currentPos };
        lastMovedTime = now;
        return false;
      }

      // Check if time elapsed exceeds stuck threshold
      return (now - lastMovedTime) >= thresholdMs;
    },

    /**
     * Resets the stuck tracker to current position and time.
     */
    reset() {
      if (bot && bot.entity && bot.entity.position) {
        lastPos = bot.entity.position.clone ? bot.entity.position.clone() : { ...bot.entity.position };
      } else {
        lastPos = null;
      }
      lastMovedTime = Date.now();
    },

    /**
     * Returns milliseconds elapsed since last significant movement.
     * @returns {number}
     */
    getElapsedTime() {
      return Date.now() - lastMovedTime;
    }
  };
}

module.exports = {
  createSafeMovements,
  isPositionSafe,
  getStuckDetector
};
