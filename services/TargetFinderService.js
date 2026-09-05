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
      const matcher = (block) => {
        if (!block) return false;
        return blockNames.includes(block.name);
      };
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
   * Finds all blocks within a radius satisfying an optional predicate.
   * @param {Function} [predicate] - Evaluation predicate (block: Block) => boolean
   * @param {number} [radius=16] - Search radius in blocks
   * @returns {Array<any>} List of matching blocks
   */
  findAllInRadius(predicate, radius = 16) {
    if (!this.bot || !this.bot.entity || !this.bot.entity.position) return [];
    const results = [];
    const botPos = this.bot.entity.position.floored();
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        for (let y = -radius; y <= radius; y++) {
          const checkPos = botPos.offset(x, y, z);
          const block = this.bot.blockAt(checkPos);
          if (block && block.name !== 'air' && (!predicate || predicate(block))) {
            results.push(block);
          }
        }
      }
    }
    return results;
  }
}

module.exports = TargetFinderService;
