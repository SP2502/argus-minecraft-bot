/**
 * Building Policies - Pure Decision and Sorting Logic for Construction.
 * Zero Mineflayer calls — 100% deterministic and unit-testable.
 */
const buildingData = require('./buildingData');

/**
 * Sorts block coordinates in optimal placement sequence.
 * Invariant:
 * 1. Strictly ascending by layer (dy = 0, then dy = 1, dy = 2...).
 * 2. Within each layer, furthest blocks from entry/stand point are placed first
 *    so the bot doesn't trap itself inside or block its line-of-sight.
 * 
 * @param {Array<{ dx: number, dy: number, dz: number, blockType: string }>} blocks
 * @param {{ dx?: number, dz?: number }} [entryPoint={ dx: 0, dz: 0 }]
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function sortPlacementOrder(blocks = [], entryPoint = { dx: 0, dz: 0 }) {
  const sorted = [...blocks];
  const eX = entryPoint.dx || 0;
  const eZ = entryPoint.dz || 0;

  sorted.sort((a, b) => {
    // 1. Layer-by-layer (bottom-up)
    if (a.dy !== b.dy) {
      return a.dy - b.dy;
    }

    // 2. Furthest from entry point first within the same layer
    const distA = Math.hypot(a.dx - eX, a.dz - eZ);
    const distB = Math.hypot(b.dx - eX, b.dz - eZ);
    return distB - distA;
  });

  return sorted;
}

/**
 * Aggregates required materials for a given set of blocks.
 * @param {Array<{ blockType: string }>} blocks
 * @returns {{ requirements: Record<string, number>, totalBlocks: number }}
 */
function calculateRequiredMaterials(blocks = []) {
  const requirements = {};
  let totalBlocks = 0;

  for (const b of blocks) {
    if (!b || !b.blockType) continue;
    requirements[b.blockType] = (requirements[b.blockType] || 0) + 1;
    totalBlocks++;
  }

  return { requirements, totalBlocks };
}

/**
 * Determines whether a block is a non-structural soft obstacle that can be cleared safely.
 * @param {string} blockName
 * @returns {boolean}
 */
function isSoftObstacle(blockName) {
  if (!blockName || blockName === 'air') return false;
  if (buildingData.softObstacleBlocks.includes(blockName)) return true;
  if (blockName.endsWith('_flower') || blockName.endsWith('_tulip') || blockName.includes('grass')) {
    return true;
  }
  return false;
}

/**
 * Finds an adjacent solid reference block and normal face vector to place a new block against.
 * 
 * @param {{ x: number, y: number, z: number }} targetPos - Target position
 * @param {Function} isSolidFn - Function (pos: {x,y,z}) => boolean
 * @returns {{ referencePos: { x: number, y: number, z: number }, faceVector: { x: number, y: number, z: number } } | null}
 */
function findReferenceBlock(targetPos, isSolidFn) {
  if (!targetPos || typeof isSolidFn !== 'function') return null;

  // Face vectors pointing from reference block to target block
  // Bottom face has highest priority (placing on top of floor/ground)
  const candidateFaces = [
    { face: { x: 0, y: 1, z: 0 }, offset: { x: 0, y: -1, z: 0 } }, // Below target (place on top)
    { face: { x: 0, y: 0, z: 1 }, offset: { x: 0, y: 0, z: -1 } }, // North of target (place on south)
    { face: { x: 0, y: 0, z: -1 }, offset: { x: 0, y: 0, z: 1 } }, // South of target (place on north)
    { face: { x: 1, y: 0, z: 0 }, offset: { x: -1, y: 0, z: 0 } }, // West of target (place on east)
    { face: { x: -1, y: 0, z: 0 }, offset: { x: 1, y: 0, z: 0 } }, // East of target (place on west)
    { face: { x: 0, y: -1, z: 0 }, offset: { x: 0, y: 1, z: 0 } }  // Above target (place on bottom)
  ];

  for (const candidate of candidateFaces) {
    const refPos = {
      x: targetPos.x + candidate.offset.x,
      y: targetPos.y + candidate.offset.y,
      z: targetPos.z + candidate.offset.z
    };
    if (isSolidFn(refPos)) {
      return {
        referencePos: refPos,
        faceVector: candidate.face
      };
    }
  }

  return null;
}

/**
 * Calculates absolute bounding box for a structure relative to origin.
 * @param {{ x: number, y: number, z: number }} origin
 * @param {Array<{ dx: number, dy: number, dz: number }>} blocks
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }}
 */
function calculateBoundingBox(origin, blocks = []) {
  if (!blocks || blocks.length === 0) {
    return { minX: origin.x, maxX: origin.x, minY: origin.y, maxY: origin.y, minZ: origin.z, maxZ: origin.z };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const b of blocks) {
    const wx = origin.x + b.dx;
    const wy = origin.y + b.dy;
    const wz = origin.z + b.dz;

    if (wx < minX) minX = wx;
    if (wx > maxX) maxX = wx;
    if (wy < minY) minY = wy;
    if (wy > maxY) maxY = wy;
    if (wz < minZ) minZ = wz;
    if (wz > maxZ) maxZ = wz;
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

module.exports = {
  sortPlacementOrder,
  calculateRequiredMaterials,
  isSoftObstacle,
  findReferenceBlock,
  calculateBoundingBox
};
