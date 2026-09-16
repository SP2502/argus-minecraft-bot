const mongoose = require('mongoose');
const Location = require('../models/Location');
const Chest = require('../models/Chest');
const { LocationTypes } = require('../config/constants');

/**
 * LocationRegistry - Dual-Mode (MongoDB + Offline In-Memory) POI & Base Management.
 * Seamlessly functions with or without an active MongoDB connection.
 */
class LocationRegistry {
  constructor() {
    this.memoryLocations = new Map();
    this.memoryChests = [];
  }

  /**
   * Checks if MongoDB connection is open and ready.
   * @private
   * @returns {boolean}
   */
  _isDbConnected() {
    return Boolean(mongoose.connection && mongoose.connection.readyState === 1);
  }

  /**
   * Registers or updates a base location.
   * @param {string} name - Base identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {boolean} [isPrimary=false] - Whether this base is designated as primary
   * @param {string} [registeredBy='system'] - User or system tag
   * @returns {Promise<Object>}
   */
  async registerBase(name, position, isPrimary = false, registeredBy = 'system') {
    const doc = {
      name,
      type: LocationTypes.BASE,
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
      dimension: position.dimension || 'overworld',
      isPrimary,
      registeredBy,
      registeredAt: new Date()
    };

    if (isPrimary) {
      for (const loc of this.memoryLocations.values()) {
        if (loc.type === LocationTypes.BASE) loc.isPrimary = false;
      }
    }
    this.memoryLocations.set(name, doc);

    if (this._isDbConnected()) {
      try {
        if (isPrimary) {
          await Location.updateMany({ type: LocationTypes.BASE, isPrimary: true }, { isPrimary: false });
        }
        return await Location.findOneAndUpdate({ name }, doc, { upsert: true, new: true });
      } catch (err) {
        // Fallback to memory
      }
    }

    return doc;
  }

  /**
   * Registers or updates a farm location.
   * @param {string} name - Farm identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {string} [cropType='wheat'] - Crop identifier (wheat, carrot, potato, sugar_cane)
   * @param {string} [registeredBy='system'] - Registering user
   * @returns {Promise<Object>}
   */
  async registerFarm(name, position, cropType = 'wheat', registeredBy = 'system') {
    const doc = {
      name,
      type: LocationTypes.FARM,
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
      dimension: position.dimension || 'overworld',
      metadata: { cropType },
      registeredBy,
      registeredAt: new Date()
    };
    this.memoryLocations.set(name, doc);

    if (this._isDbConnected()) {
      try {
        return await Location.findOneAndUpdate({ name }, doc, { upsert: true, new: true });
      } catch (e) {}
    }

    return doc;
  }

  /**
   * Registers or updates a mining site location.
   * @param {string} name - Mine identifier name
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Coordinates
   * @param {string} [oreType='iron'] - Target ore type
   * @param {string} [registeredBy='system'] - Registering user
   * @returns {Promise<Object>}
   */
  async registerMine(name, position, oreType = 'iron', registeredBy = 'system') {
    const doc = {
      name,
      type: LocationTypes.MINE,
      x: Math.round(position.x),
      y: Math.round(position.y),
      z: Math.round(position.z),
      dimension: position.dimension || 'overworld',
      metadata: { oreType },
      registeredBy,
      registeredAt: new Date()
    };
    this.memoryLocations.set(name, doc);

    if (this._isDbConnected()) {
      try {
        return await Location.findOneAndUpdate({ name }, doc, { upsert: true, new: true });
      } catch (e) {}
    }

    return doc;
  }

  /**
   * Retrieves the current primary base location coordinates.
   * @returns {Promise<{ name: string, x: number, y: number, z: number, dimension: string }|null>}
   */
  async getPrimaryBase() {
    if (this._isDbConnected()) {
      try {
        const base = await Location.findOne({ type: LocationTypes.BASE, isPrimary: true });
        if (base) {
          return {
            name: base.name,
            x: base.x,
            y: base.y,
            z: base.z,
            dimension: base.dimension || 'overworld'
          };
        }
      } catch (e) {}
    }

    for (const loc of this.memoryLocations.values()) {
      if (loc.type === LocationTypes.BASE && loc.isPrimary) {
        return {
          name: loc.name,
          x: loc.x,
          y: loc.y,
          z: loc.z,
          dimension: loc.dimension || 'overworld'
        };
      }
    }

    return null;
  }

  /**
   * Finds the nearest registered chest by 3D Euclidean distance, filtered by category.
   * @param {{ x: number, y: number, z: number, dimension?: string }} position - Reference point
   * @param {string|null} [category=null] - Optional chest category filter
   * @returns {Promise<Object|null>} Nearest chest document or null
   */
  async findNearestChest(position, category = null) {
    if (this._isDbConnected()) {
      try {
        const query = {};
        if (position.dimension) query.dimension = position.dimension;
        if (category) query.category = category;

        const chests = await Chest.find(query);
        if (chests && chests.length > 0) {
          return this._findNearestInList(chests, position);
        }
      } catch (e) {}
    }

    const filtered = this.memoryChests.filter((c) => !category || c.category === category);
    return this._findNearestInList(filtered, position);
  }

  /**
   * @private
   */
  _findNearestInList(list, position) {
    if (!list || list.length === 0) return null;
    let nearest = null;
    let minDistance = Infinity;

    for (const item of list) {
      const dx = item.x - position.x;
      const dy = item.y - position.y;
      const dz = item.z - position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = item;
      }
    }

    return nearest;
  }

  /**
   * Lists all locations of a specified type.
   * @param {'base'|'farm'|'mine'|'waypoint'} type - Location category
   * @returns {Promise<Array<Object>>}
   */
  async listByType(type) {
    if (this._isDbConnected()) {
      try {
        return await Location.find({ type }).sort({ name: 1 });
      } catch (e) {}
    }

    const results = [];
    for (const loc of this.memoryLocations.values()) {
      if (loc.type === type) {
        results.push(loc);
      }
    }
    return results;
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
