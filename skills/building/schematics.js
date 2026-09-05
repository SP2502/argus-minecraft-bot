/**
 * Procedural Schematics Generator for Argus Building Subsystem.
 * Generates relative offset coordinates { dx, dy, dz, blockType } for procedural structures.
 */

/**
 * Generates an emergency or basic survival shelter with an entrance opening and roof.
 * @param {string} [material='cobblestone'] - Primary building block
 * @param {number} [width=3] - Outer width along X (minimum 3)
 * @param {number} [height=3] - Outer height along Y (minimum 3)
 * @param {number} [depth=3] - Outer depth along Z (minimum 3)
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function generateShelter(material = 'cobblestone', width = 3, height = 3, depth = 3) {
  const blocks = [];
  const w = Math.max(3, width);
  const h = Math.max(3, height);
  const d = Math.max(3, depth);

  const doorX = Math.floor(w / 2);
  const doorZ = 0; // Front entrance

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < d; dz++) {
        const isWall = (dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1);
        const isRoof = (dy === h - 1);
        const isFloor = (dy === 0);

        // Entrance cutout (2 blocks high at front center)
        if (dx === doorX && dz === doorZ && (dy === 0 || dy === 1)) {
          continue;
        }

        if (isRoof || isWall || isFloor) {
          blocks.push({ dx, dy, dz, blockType: material });
        }
      }
    }
  }

  return blocks;
}

/**
 * Generates a defensive linear wall.
 * @param {number} [length=8] - Length in blocks
 * @param {number} [height=3] - Wall height in blocks
 * @param {string} [material='cobblestone'] - Building block
 * @param {string} [orientation='x'] - 'x' or 'z' alignment
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function generateWall(length = 8, height = 3, material = 'cobblestone', orientation = 'x') {
  const blocks = [];
  const len = Math.max(1, length);
  const h = Math.max(1, height);

  for (let dy = 0; dy < h; dy++) {
    for (let i = 0; i < len; i++) {
      const dx = orientation === 'z' ? 0 : i;
      const dz = orientation === 'z' ? i : 0;
      blocks.push({ dx, dy, dz, blockType: material });
    }
  }

  return blocks;
}

/**
 * Generates a flat platform or foundation floor.
 * @param {number} [width=5] - Width along X
 * @param {number} [depth=5] - Depth along Z
 * @param {string} [material='oak_planks'] - Building block
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function generateFloor(width = 5, depth = 5, material = 'oak_planks') {
  const blocks = [];
  const w = Math.max(1, width);
  const d = Math.max(1, depth);

  for (let dx = 0; dx < w; dx++) {
    for (let dz = 0; dz < d; dz++) {
      blocks.push({ dx, dy: 0, dz, blockType: material });
    }
  }

  return blocks;
}

/**
 * Generates a rectangular room or solid cube.
 * @param {number} [width=4] - Width along X
 * @param {number} [height=3] - Height along Y
 * @param {number} [depth=4] - Depth along Z
 * @param {string} [material='cobblestone'] - Building block
 * @param {boolean} [hollow=true] - If true, hollow interior
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function generateCube(width = 4, height = 3, depth = 4, material = 'cobblestone', hollow = true) {
  const blocks = [];
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const d = Math.max(1, depth);

  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      for (let dz = 0; dz < d; dz++) {
        if (!hollow || dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1 || dy === 0 || dy === h - 1) {
          blocks.push({ dx, dy, dz, blockType: material });
        }
      }
    }
  }

  return blocks;
}

/**
 * Generates an ascending staircase.
 * @param {number} [height=4] - Step count / total elevation
 * @param {string} [material='cobblestone'] - Building block
 * @param {string} [direction='north'] - Direction of ascent ('north', 'south', 'east', 'west')
 * @returns {Array<{ dx: number, dy: number, dz: number, blockType: string }>}
 */
function generateStairs(height = 4, material = 'cobblestone', direction = 'north') {
  const blocks = [];
  const h = Math.max(1, height);

  const dirMap = {
    north: { stepX: 0, stepZ: -1 },
    south: { stepX: 0, stepZ: 1 },
    east: { stepX: 1, stepZ: 0 },
    west: { stepX: -1, stepZ: 0 }
  };

  const delta = dirMap[direction.toLowerCase()] || dirMap.north;

  for (let step = 0; step < h; step++) {
    const curX = step * delta.stepX;
    const curZ = step * delta.stepZ;
    // Solid pillar underneath step to ensure structural support
    for (let dy = 0; dy <= step; dy++) {
      blocks.push({ dx: curX, dy, dz: curZ, blockType: material });
    }
  }

  return blocks;
}

module.exports = {
  generateShelter,
  generateWall,
  generateFloor,
  generateCube,
  generateStairs
};
