const Location = require('../models/Location');
const Chest = require('../models/Chest');
const { LocationTypes } = require('../config/constants');

/**
 * LocationRegistry - Database-backed management for POIs (bases, farms, mines, chests, waypoints).
 */
class LocationRegistry {
  /**
   * Registers or updates a base location.
   * @param {string} name - Base identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {boolean} [isPrimary=false] - Whether this base is designated as primary
   * @param {string} [registeredBy='system'] - User or system tag
   * @returns {Promise<import('mongoose').Document>}
   */
  async registerBase(name, position, isPrimary = false, registeredBy = 'system') {
    if (isPrimary) {
      // Clear previous primary base flag if setting a new primary
      await Location.updateMany({ type: LocationTypes.BASE, isPrimary: true }, { isPrimary: false });
    }

    return Location.findOneAndUpdate(
      { name },
      {
        name,
        type: LocationTypes.BASE,
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: Math.round(position.z),
        dimension: position.dimension || 'overworld',
        isPrimary,
        registeredBy,
        registeredAt: new Date()
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Registers or updates a farm location.
   * @param {string} name - Farm identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {string} [cropType='wheat'] - Crop identifier (wheat, carrot, potato, sugar_cane)
   * @param {string} [registeredBy='system'] - Registering user
   * @returns {Promise<import('mongoose').Document>}
   */
  async registerFarm(name, position, cropType = 'wheat', registeredBy = 'system') {
    return Location.findOneAndUpdate(
      { name },
      {
        name,
        type: LocationTypes.FARM,
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: Math.round(position.z),
        dimension: position.dimension || 'overworld',
        metadata: { cropType },
        registeredBy,
        registeredAt: new Date()
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Registers or updates a mining site location.
   * @param {string} name - Mine identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {string} [oreType='iron'] - Target ore type
   * @param {string} [registeredBy='system'] - Registering user
   * @returns {Promise<import('mongoose').Document>}
   */
  async registerMine(name, position, oreType = 'iron', registeredBy = 'system') {
    return Location.findOneAndUpdate(
      { name },
      {
        name,
        type: LocationTypes.MINE,
        x: Math.round(position.x),
        y: Math.round(position.y),
        z: Math.round(position.z),
        dimension: position.dimension || 'overworld',
        metadata: { oreType },
        registeredBy,
        registeredAt: new Date()
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Retrieves the current primary base location coordinates.
   * @returns {Promise<{ name: string, x: number, y: number, z: number, dimension: string }|null>}
   */
  async getPrimaryBase() {
    const base = await Location.findOne({ type: LocationTypes.BASE, isPrimary: true });
    if (!base) return null;
    return {
      name: base.name,
      x: base.x,
      y: base.y,
      z: base.z,
      dimension: base.dimension || 'overworld'
    };
  }

  /**
   * Finds the nearest registered chest by 3D Euclidean distance, filtered by category.
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Reference point
   * @param {string|null} [category=null] - Optional chest category filter
   * @returns {Promise<import('mongoose').Document|null>} Nearest chest document or null
   */
  async findNearestChest(position, category = null) {
    const query = {};
    if (position.dimension) query.dimension = position.dimension;
    if (category) query.category = category;

    const chests = await Chest.find(query);
    if (!chests || chests.length === 0) return null;

    let nearest = null;
    let minDistance = Infinity;

    for (const chest of chests) {
      const dx = chest.x - position.x;
      const dy = chest.y - position.y;
      const dz = chest.z - position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = chest;
      }
    }

    return nearest;
  }

  /**
   * Lists all locations of a specified type.
   * @param {'base'|'farm'|'mine'|'waypoint'} type - Location category
   * @returns {Promise<Array<import('mongoose').Document>>}
   */
  async listByType(type) {
    return Location.find({ type }).sort({ name: 1 });
  }

  /**
   * Health heartbeat check.
   * @returns {{ ok: boolean }}
   */
  ping() {
    return { ok: true };
  }
}

module.exports = LocationRegistry;
