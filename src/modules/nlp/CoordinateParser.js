/**
 * CoordinateParser - Parses 3D absolute, 2D ground-level, relative offsets, and named location references.
 */
class CoordinateParser {
  /**
   * Parses coordinate expressions from text.
   * 
   * @param {string} text - Input text
   * @param {Object} [botPos=null] - Bot reference position {x, y, z, yaw}
   * @returns {Object|null} Normalized coordinate or location entity
   */
  parse(text = '', botPos = null) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // 1. Labeled Absolute Coordinates: "x: 100 y: 64 z: -200" or "x=100, y=64, z=-200"
    const labeledRegex = /x[:=]\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*y[:=]\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*z[:=]\s*([+-]?\d+(?:\.\d+)?)/i;
    const labeledMatch = clean.match(labeledRegex);
    if (labeledMatch) {
      return {
        type: 'coordinates',
        x: parseFloat(labeledMatch[1]),
        y: parseFloat(labeledMatch[2]),
        z: parseFloat(labeledMatch[3]),
        relative: false,
        needsSafeY: false,
        raw: text
      };
    }

    // 2. Comma/Space separated 3-Axis: "(100, 64, -200)" or "100 64 -200" or "100, 64, -200"
    const tripleRegex = /^\(?\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/;
    const tripleMatch = clean.match(tripleRegex);
    if (tripleMatch) {
      return {
        type: 'coordinates',
        x: parseFloat(tripleMatch[1]),
        y: parseFloat(tripleMatch[2]),
        z: parseFloat(tripleMatch[3]),
        relative: false,
        needsSafeY: false,
        raw: text
      };
    }

    // 3. Two-Axis 2D Horizontal: "100 -200" or "(100, -200)"
    const doubleRegex = /^\(?\s*([+-]?\d+(?:\.\d+)?)\s*[, ]\s*([+-]?\d+(?:\.\d+)?)\s*\)?$/;
    const doubleMatch = clean.match(doubleRegex);
    if (doubleMatch) {
      const defaultY = botPos ? botPos.y : 64;
      return {
        type: 'coordinates',
        x: parseFloat(doubleMatch[1]),
        y: defaultY,
        z: parseFloat(doubleMatch[2]),
        relative: false,
        needsSafeY: true,
        raw: text
      };
    }

    // 4. Relative Cardinal Offsets: "10 blocks north", "5 east", "3 up", "20 south"
    const relativeDirRegex = /^(\d+)\s*(?:blocks?\s*)?(north|south|east|west|up|down|above|below)$/i;
    const relDirMatch = clean.match(relativeDirRegex);
    if (relDirMatch) {
      const dist = parseInt(relDirMatch[1], 10);
      const dir = relDirMatch[2].toLowerCase();

      let dx = 0, dy = 0, dz = 0;
      switch (dir) {
        case 'north': dz = -dist; break; // In Minecraft, North is -Z
        case 'south': dz = dist; break;  // South is +Z
        case 'east':  dx = dist; break;  // East is +X
        case 'west':  dx = -dist; break; // West is -X
        case 'up':
        case 'above': dy = dist; break;
        case 'down':
        case 'below': dy = -dist; break;
      }

      return {
        type: 'relative_coordinates',
        dx, dy, dz,
        relative: true,
        direction: dir,
        distance: dist,
        raw: text
      };
    }

    // 5. Contextual Keywords: "here", "there", "home", "spawn"
    if (clean === 'here' || clean === 'current position' || clean === 'my location') {
      return {
        type: 'contextual_location',
        keyword: 'here',
        raw: text
      };
    }

    if (clean === 'home' || clean === 'base' || clean === 'spawn' || clean === 'last location') {
      return {
        type: 'named_location',
        name: clean,
        raw: text
      };
    }

    return null;
  }
}

module.exports = new CoordinateParser();
