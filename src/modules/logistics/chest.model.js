const mongoose = require('mongoose');

/**
 * Chest Schema - Persists discovered or registered chest locations and contents
 */
const ChestSchema = new mongoose.Schema({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, required: true },
  dimension: { type: String, default: 'overworld' },
  label: { type: String, default: '' },
  category: { type: String, default: 'general' },
  contents: [
    {
      name: { type: String },
      count: { type: Number, default: 0 },
      slot: { type: Number }
    }
  ],
  registeredBy: { type: String, default: 'system' },
  registeredAt: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now }
});

ChestSchema.index({ x: 1, y: 1, z: 1, dimension: 1 }, { unique: true });

module.exports = mongoose.model('Chest', ChestSchema);
