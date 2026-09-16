const mongoose = require('mongoose');

/**
 * Location Schema - Persists known key locations (bases, farms, mines, waypoints)
 */
const LocationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  type: {
    type: String,
    enum: ['base', 'farm', 'mine', 'waypoint'],
    required: true
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  z: { type: Number, required: true },
  dimension: { type: String, default: 'overworld' },
  isPrimary: { type: Boolean, default: false },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  registeredBy: { type: String, default: 'system' },
  registeredAt: { type: Date, default: Date.now },
  lastVisited: { type: Date },
  visitCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Location', LocationSchema);
