/**
 * TargetFinderService - Reusable spatial querying for blocks, entities, and regions.
 * Features must query this service instead of writing ad-hoc search loops.
 */
class TargetFinderService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   */
  constructor(bot) {
    this.bot = bot;
  }

  /**
   * Finds the nearest block matching one of the specified block names or IDs.
   * @param {string[]|number[]} blockNames - List of block names or type IDs
   * @param {number} [radius=32] - Search radius in blocks
   * @returns {import('prismarine-block').Block|null} The nearest matching block or null
   */
  findNearestBlock(blockNames = [], radius = 32) {
    if (!this.bot || !this.bot.findBlock) return null;
    try {
      let matcher;
      if (typeof blockNames === 'function') {
        matcher = blockNames;
      } else if (Array.isArray(blockNames)) {
        const set = new Set(blockNames.map((n) => (typeof n === 'string' ? n.toLowerCase() : n)));
        matcher = (block) => block && (set.has(block.name) || set.has(block.type));
      } else if (typeof blockNames === 'string') {
        const clean = blockNames.toLowerCase();
        matcher = (block) => block && block.name === clean;
      } else {
        matcher = (block) => block && block.name !== 'air';
      }

      return this.bot.findBlock({
        matching: matcher,
        maxDistance: radius
      });
    } catch (err) {
      console.error('[TargetFinderService] Error finding nearest block:', err.message);
      return null;
    }
  }

  /**
   * Finds the nearest entity satisfying the filter condition.
   * @param {Function} entityFilter - Predicate function (entity: Entity) => boolean
   * @param {number} [radius=32] - Search radius in blocks
   * @returns {import('mineflayer').Entity|null}
   */
  findNearestEntity(entityFilter, radius = 32) {
    if (!this.bot || !this.bot.nearestEntity) return null;
    try {
      return this.bot.nearestEntity((entity) => {
        if (!entity || !entity.position) return false;
        const dist = this.bot.entity.position.distanceTo(entity.position);
        if (dist > radius) return false;
        return entityFilter ? entityFilter(entity) : true;
      });
    } catch (err) {
      console.error('[TargetFinderService] Error finding nearest entity:', err.message);
      return null;
    }
  }

  /**
   * Finds all blocks within a radius satisfying an optional predicate or target block array.
   * @param {Function|Array<string|number>|string} [predicate] - Predicate function, array of block names, or string
   * @param {number} [radius=16] - Search radius in blocks
   * @param {number} [limit=50] - Maximum matching blocks to return
   * @returns {Array<any>} List of matching blocks
   */
  findAllInRadius(predicate, radius = 16, limit = 50) {
    if (!this.bot || !this.bot.entity || !this.bot.entity.position) return [];

    let matchFn;
    if (typeof predicate === 'function') {
      matchFn = predicate;
    } else if (Array.isArray(predicate)) {
      const set = new Set(predicate.map((p) => (typeof p === 'string' ? p.toLowerCase() : p)));
      matchFn = (block) => block && (set.has(block.name) || set.has(block.type));
    } else if (typeof predicate === 'string') {
      const clean = predicate.toLowerCase();
      matchFn = (block) => block && block.name === clean;
    } else {
      matchFn = (block) => block && block.name !== 'air';
    }

    // 1. Try Mineflayer native optimized bot.findBlocks when available
    if (typeof this.bot.findBlocks === 'function') {
      try {
        const positions = this.bot.findBlocks({
          matching: matchFn,
          maxDistance: radius,
          count: limit || 50
        });
        if (positions && positions.length > 0) {
          return positions.map((pos) => this.bot.blockAt(pos, false)).filter(Boolean);
        }
        return [];
      } catch (err) {
        // Fallback to spatial scan if findBlocks is unsupported in mock or throws
      }
    }

    // 2. Spatial scan fallback (bounded vertically for performance)
    const results = [];
    const botPos = this.bot.entity.position.floored();
    const minY = Math.max(-16, -radius);
    const maxY = Math.min(24, radius);

    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        for (let y = minY; y <= maxY; y++) {
          const checkPos = botPos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos, false);
          if (block && block.name !== 'air' && matchFn(block)) {
            results.push(block);
            if (limit && results.length >= limit) {
              return results;
            }
          }
        }
      }
    }
    return results;
  }

  /**
   * Health heartbeat check for AIBrain.
   * @returns {{ ok: boolean }}
   */
  ping() {
    return {
      ok: Boolean(this.bot)
    };
  }
}

module.exports = TargetFinderService;
