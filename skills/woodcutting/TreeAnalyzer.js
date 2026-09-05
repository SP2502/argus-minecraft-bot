const treeData = require('./treeData');
const forestryConfig = require('../../config/forestryConfig');

/**
 * TreeAnalyzer - Identifies and analyzes tree structures in the Minecraft world.
 * Pure forestry analysis logic only — does not handle navigation, combat, storage, or commands.
 */
class TreeAnalyzer {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {typeof treeData} [treeDataModule=treeData] - Tree definitions
   * @param {typeof forestryConfig} [configModule=forestryConfig] - Configuration limits
   */
  constructor(bot, treeDataModule = treeData, configModule = forestryConfig) {
    this.bot = bot;
    this.treeData = treeDataModule;
    this.config = configModule;
  }

  /**
   * Determines which configured tree family owns a log/stem block.
   * @param {string} blockName - Minecraft block identifier (e.g. 'oak_log')
   * @returns {string|null} Family name (e.g. 'oak') or null
   */
  getFamilyForLog(blockName) {
    if (!blockName) return null;
    const clean = blockName.toLowerCase().replace('minecraft:', '');

    for (const [familyName, familyDef] of Object.entries(this.treeData.families)) {
      if (familyDef.logBlocks.includes(clean) || familyDef.strippedLogBlocks.includes(clean)) {
        return familyName;
      }
    }
    return null;
  }

  /**
   * Analyzes a connected tree trunk starting at a candidate log block.
   * Uses bounded iterative BFS on adjacent log blocks, never unbounded recursion.
   * 
   * @param {Object} startPosition - {x, y, z} of candidate log
   * @param {Object} [options={}]
   * @returns {Object} TreeAnalysis shape
   */
  analyzeTree(startPosition, options = {}) {
    const block = this._getBlock(startPosition);
    if (!block) {
      return {
        family: null,
        rootPosition: null,
        logPositions: [],
        leafPositions: [],
        estimatedHeight: 0,
        naturalEvidence: { isNatural: false, reason: 'Start block not loaded' },
        safe: false,
        warnings: ['Candidate block is unloaded or invalid']
      };
    }

    const family = options.family || this.getFamilyForLog(block.name);
    if (!family) {
      return {
        family: null,
        rootPosition: null,
        logPositions: [],
        leafPositions: [],
        estimatedHeight: 0,
        naturalEvidence: { isNatural: false, reason: `Block '${block.name}' is not a recognized tree log` },
        safe: false,
        warnings: ['Unrecognized block type']
      };
    }

    const familyDef = this.treeData.families[family];
    const logPositions = this.findConnectedLogs(startPosition, family, options);
    const warnings = [];

    if (logPositions.length === 0) {
      return {
        family,
        rootPosition: null,
        logPositions: [],
        leafPositions: [],
        estimatedHeight: 0,
        naturalEvidence: { isNatural: false, reason: 'No connected logs discovered' },
        safe: false,
        warnings: ['Empty log cluster']
      };
    }

    if (logPositions.length >= this.config.MAX_LOGS_PER_TREE) {
      warnings.push(`Exceeded MAX_LOGS_PER_TREE (${this.config.MAX_LOGS_PER_TREE}); potentially mega-structure or artificial`);
    }

    // Determine root (lowest Y log) and canopy bounds
    let minY = Infinity;
    let maxY = -Infinity;
    let rootLog = logPositions[0];

    for (const pos of logPositions) {
      if (pos.y < minY) {
        minY = pos.y;
        rootLog = pos;
      }
      if (pos.y > maxY) {
        maxY = pos.y;
      }
    }

    const estimatedHeight = (maxY - minY) + 1;
    const leafPositions = this._findNearbyLeaves(logPositions, familyDef);

    const naturalEvidence = this.isLikelyNaturalTree({
      family,
      rootPosition: rootLog,
      logPositions,
      leafPositions,
      estimatedHeight
    }, options);

    const isSafe = naturalEvidence.isNatural && logPositions.length < this.config.MAX_LOGS_PER_TREE;

    return {
      family,
      rootPosition: rootLog,
      logPositions,
      leafPositions,
      estimatedHeight,
      naturalEvidence,
      safe: isSafe,
      warnings
    };
  }

  /**
   * Finds connected trunk/log positions for one tree, bounded by config limits.
   * Uses bounded iterative BFS supporting vertical and horizontal connections.
   * 
   * @param {Object} startPosition - Starting {x, y, z}
   * @param {string} family - Target tree family
   * @param {Object} [options={}]
   * @returns {Array<Object>}
   */
  findConnectedLogs(startPosition, family, options = {}) {
    const familyDef = this.treeData.families[family];
    if (!familyDef) return [];

    const maxLogs = options.maxLogs || this.config.MAX_LOGS_PER_TREE;
    const queue = [{ x: Math.floor(startPosition.x), y: Math.floor(startPosition.y), z: Math.floor(startPosition.z) }];
    const visited = new Set();
    const result = [];

    const key = (p) => `${p.x},${p.y},${p.z}`;
    visited.add(key(queue[0]));

    while (queue.length > 0 && result.length < maxLogs) {
      const current = queue.shift();
      const b = this._getBlock(current);

      if (b && (familyDef.logBlocks.includes(b.name) || familyDef.strippedLogBlocks.includes(b.name))) {
        result.push(current);

        // Search 26 adjacent neighbors (horizontal, vertical, diagonal)
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              const neighbor = { x: current.x + dx, y: current.y + dy, z: current.z + dz };
              const nKey = key(neighbor);

              if (!visited.has(nKey)) {
                visited.add(nKey);
                const nb = this._getBlock(neighbor);
                if (nb && (familyDef.logBlocks.includes(nb.name) || familyDef.strippedLogBlocks.includes(nb.name))) {
                  queue.push(neighbor);
                }
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Validates that the candidate has a plausible ground/root block and canopy evidence.
   * Avoids cutting player-built log structures, houses, or containers.
   * 
   * @param {Object} treeAnalysis
   * @param {Object} [options={}]
   * @returns {{ isNatural: boolean, reason: string }}
   */
  isLikelyNaturalTree(treeAnalysis, options = {}) {
    const { family, rootPosition, logPositions, leafPositions } = treeAnalysis;
    const familyDef = this.treeData.families[family];
    if (!familyDef || !rootPosition) {
      return { isNatural: false, reason: 'Missing family or root definition' };
    }

    // 1. Check for player container or sensitive structure blocks touching the trunk
    const protectedBlockTypes = new Set([
      'chest', 'trapped_chest', 'barrel', 'shulker_box', 'ender_chest',
      'furnace', 'blast_furnace', 'smoker', 'crafting_table', 'bed',
      'beehive', 'bee_nest', 'sign', 'wall_sign', 'scaffolding', 'hopper',
      'dispenser', 'dropper', 'door', 'iron_door', 'oak_door', 'torch', 'lantern'
    ]);

    for (const logPos of logPositions) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const adjPos = { x: logPos.x + dx, y: logPos.y, z: logPos.z + dz };
          const adjBlock = this._getBlock(adjPos);
          if (adjBlock && protectedBlockTypes.has(adjBlock.name)) {
            return { isNatural: false, reason: `Adjacent protected structure block '${adjBlock.name}' detected` };
          }
        }
      }
    }

    // 2. Validate ground/root block under lowest log
    const groundPos = { x: rootPosition.x, y: rootPosition.y - 1, z: rootPosition.z };
    const groundBlock = this._getBlock(groundPos);
    let validGround = false;

    if (groundBlock && familyDef.plantableGround.includes(groundBlock.name)) {
      validGround = true;
    } else if (groundBlock && (familyDef.logBlocks.includes(groundBlock.name) || groundBlock.name === 'dirt' || groundBlock.name === 'grass_block')) {
      validGround = true;
    }

    // 3. Validate canopy / leaf evidence
    const hasLeaves = leafPositions && leafPositions.length > 0;

    if (validGround && hasLeaves) {
      return { isNatural: true, reason: 'Valid plantable ground substrate and matching leaf canopy present' };
    }

    if (validGround && !hasLeaves) {
      // Small trees or dead branches might have sparse leaves; check if top log has adjacent leaves
      return { isNatural: false, reason: 'Ground substrate is valid but no matching leaf canopy found' };
    }

    if (!validGround && hasLeaves) {
      return { isNatural: false, reason: `Unnatural ground block '${groundBlock ? groundBlock.name : 'air'}' under trunk` };
    }

    return { isNatural: false, reason: 'No valid ground substrate and no leaf canopy present' };
  }

  /**
   * Returns a top-down order of log positions to cut (highest Y first).
   * Top-down cutting avoids trapping the bot in leaves and prevents floating logs.
   * 
   * @param {Object} treeAnalysis
   * @returns {Array<Object>}
   */
  getSafeCutOrder(treeAnalysis) {
    if (!treeAnalysis || !Array.isArray(treeAnalysis.logPositions)) return [];

    // Sort descending by Y coordinate; break ties with distance from root
    return [...treeAnalysis.logPositions].sort((a, b) => {
      if (b.y !== a.y) {
        return b.y - a.y;
      }
      return (b.x + b.z) - (a.x + a.z);
    });
  }

  /**
   * Finds a safe nearby ground position from which a log can be reached.
   * Only performs local block/solid checks without calling bot.pathfinder.
   * 
   * @param {Object} logPosition
   * @returns {Object|null} {x, y, z} standing position or null
   */
  getAccessPosition(logPosition) {
    if (!logPosition) return null;
    const candidates = [];

    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) === 0) continue;
        if (Math.abs(dx) + Math.abs(dz) > 3) continue;

        // Check vertical stand offsets around log level and ground level
        for (let dy = 0; dy >= -3; dy--) {
          const standPos = { x: logPosition.x + dx, y: logPosition.y + dy, z: logPosition.z + dz };
          const footBlock = this._getBlock(standPos);
          const headBlock = this._getBlock({ x: standPos.x, y: standPos.y + 1, z: standPos.z });
          const groundBlock = this._getBlock({ x: standPos.x, y: standPos.y - 1, z: standPos.z });

          // Safe standing position: solid ground beneath, 2 non-solid air/leaf blocks for player body
          const isGroundSolid = groundBlock && groundBlock.boundingBox === 'block';
          const isBodyClear = footBlock && (footBlock.boundingBox === 'empty' || footBlock.name.includes('leaves') || footBlock.name.includes('air'));
          const isHeadClear = headBlock && (headBlock.boundingBox === 'empty' || headBlock.name.includes('leaves') || headBlock.name.includes('air'));

          if (isGroundSolid && isBodyClear && isHeadClear) {
            candidates.push(standPos);
            break;
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Pick closest ground stand position
    return candidates[0];
  }

  /**
   * Helper scanning for nearby matching leaf blocks.
   * @private
   */
  _findNearbyLeaves(logPositions, familyDef) {
    const leafPositions = [];
    const maxLeaves = 40;
    const checked = new Set();
    const key = (p) => `${p.x},${p.y},${p.z}`;

    for (const logPos of logPositions) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -1; dy <= 3; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            const p = { x: logPos.x + dx, y: logPos.y + dy, z: logPos.z + dz };
            const pKey = key(p);
            if (!checked.has(pKey)) {
              checked.add(pKey);
              const b = this._getBlock(p);
              if (b && familyDef.leafBlocks.includes(b.name)) {
                leafPositions.push(p);
                if (leafPositions.length >= maxLeaves) {
                  return leafPositions;
                }
              }
            }
          }
        }
      }
    }

    return leafPositions;
  }

  /**
   * Safe block lookup helper supporting mock objects and Mineflayer world.
   * @private
   */
  _getBlock(pos) {
    if (!pos) return null;
    if (!this.bot || typeof this.bot.blockAt !== 'function') return null;

    const v3Pos = { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) };
    try {
      return this.bot.blockAt(v3Pos, false);
    } catch (e) {
      return null;
    }
  }
}

module.exports = TreeAnalyzer;
