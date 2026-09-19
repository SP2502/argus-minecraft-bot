const mongoose = require('mongoose');

/**
 * Statistics Schema - Tracks runtime session metrics and operational stats
 */
const StatisticsSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  mining: { type: mongoose.Schema.Types.Mixed, default: {} },
  farming: { type: mongoose.Schema.Types.Mixed, default: {} },
  woodcutting: {
    logsCollected: { type: Number, default: 0 },
    treesCut: { type: Number, default: 0 },
    saplingsPlanted: { type: Number, default: 0 },
    saplingsCollected: { type: Number, default: 0 },
    applesCollected: { type: Number, default: 0 },
    timeSpentMs: { type: Number, default: 0 },
    skippedTrees: { type: Number, default: 0 }
  },
  combat: { type: mongoose.Schema.Types.Mixed, default: {} },
  building: { type: mongoose.Schema.Types.Mixed, default: {} },
  distanceTraveled: { type: Number, default: 0 },
  tasksCompleted: { type: Number, default: 0 },
  uptime: { type: Number, default: 0 }
});

module.exports = mongoose.model('Statistics', StatisticsSchema);
