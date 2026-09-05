const forestryConfig = require('../../config/forestryConfig');
const treeData = require('./treeData');

/**
 * Pure forestry policy rules and decision evaluation functions.
 * No direct Mineflayer bot or database calls exist in this module.
 */
module.exports = {
  /**
   * Evaluates whether a candidate tree should be preserved (skipped) from cutting.
   * 
   * @param {Object} treeAnalysis - Analysis result from TreeAnalyzer
   * @param {Object} params - User/Task parameters
   * @param {Array<Object>} [protectedLocations=[]] - Registered bases / waypoints
   * @returns {{ shouldPreserve: boolean, reason?: string }}
   */
  shouldPreserveTree(treeAnalysis, params = {}, protectedLocations = []) {
    if (!treeAnalysis) {
      return { shouldPreserve: true, reason: 'Invalid or null tree analysis' };
    }

    if (!treeAnalysis.safe) {
      return { shouldPreserve: true, reason: treeAnalysis.warnings.join('; ') || 'Tree marked unsafe' };
    }

    if (!treeAnalysis.naturalEvidence || !treeAnalysis.naturalEvidence.isNatural) {
      return { shouldPreserve: true, reason: treeAnalysis.naturalEvidence ? treeAnalysis.naturalEvidence.reason : 'Suspected player-built structure' };
    }

    const familyDef = treeData.families[treeAnalysis.family];
    const maxHeight = (familyDef && familyDef.maxSafeHeight) || forestryConfig.MAX_TREE_HEIGHT_OVERWORLD;
    if (treeAnalysis.estimatedHeight > maxHeight) {
      return { shouldPreserve: true, reason: `Tree height (${treeAnalysis.estimatedHeight}) exceeds max safe limit (${maxHeight})` };
    }

    // Check distance to protected bases/locations unless explicit override
    if (!params.allowNearBase && Array.isArray(protectedLocations)) {
      const root = treeAnalysis.rootPosition;
      for (const loc of protectedLocations) {
        if (loc.x !== undefined && loc.z !== undefined) {
          const dx = root.x - loc.x;
          const dz = root.z - loc.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const safeRadius = loc.radius || forestryConfig.SAFE_TREE_DISTANCE_FROM_BASE;

          if (dist < safeRadius) {
            return {
              shouldPreserve: true,
              reason: `Tree too close (${Math.round(dist)}m) to protected location '${loc.name || 'Base'}' (min ${safeRadius}m)`
            };
          }
        }
      }
    }

    return { shouldPreserve: false };
  },

  /**
   * Returns the count of saplings required to replant a given tree family.
   * @param {string} family - Tree family name
   * @returns {number} Required sapling count (e.g. 4 for dark_oak, 1 for oak)
   */
  getReplantRequirement(family) {
    if (!family) return 1;
    const def = treeData.families[family.toLowerCase()];
    return (def && def.requiresSaplings) ? def.requiresSaplings : 1;
  },

  /**
   * Determines if a nearby dropped item should be collected.
   * @param {string} itemName
   * @param {Object} [params={}]
   * @returns {boolean}
   */
  shouldCollectDrop(itemName, params = {}) {
    if (!itemName) return false;
    const clean = itemName.toLowerCase();

    // Logs / Stems
    if (clean.endsWith('_log') || clean.endsWith('_stem') || clean.endsWith('_wood') || clean.endsWith('_hyphae')) {
      return true;
    }

    // Saplings / Propagules / Fungi
    if (params.collectSaplings !== false) {
      if (clean.endsWith('_sapling') || clean === 'mangrove_propagule' || clean.endsWith('_fungus')) {
        return true;
      }
    }

    // Apples & Food
    if (params.collectApples !== false && clean === 'apple') {
      return true;
    }

    // Sticks
    if (clean === 'stick') {
      return true;
    }

    return false;
  },

  /**
   * Verifies whether a tree species is valid for the current dimension.
   * @param {string} treeFamily - Tree species family
   * @param {string} currentDimension - 'overworld' | 'nether' | 'the_end'
   * @returns {boolean}
   */
  isAllowedDimension(treeFamily, currentDimension = 'overworld') {
    if (!treeFamily || treeFamily === 'any') return true;

    const cleanDim = currentDimension.toLowerCase().replace('minecraft:', '');
    const cleanFam = treeFamily.toLowerCase();

    if (cleanFam === 'any_nether') {
      return cleanDim === 'nether';
    }

    const def = treeData.families[cleanFam];
    if (!def) return true;

    return def.dimension === cleanDim;
  }
};
