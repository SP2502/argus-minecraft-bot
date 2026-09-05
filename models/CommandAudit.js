const mongoose = require('mongoose');

/**
 * CommandAudit Schema - Complete forensic execution log of all command attempts from all sources
 */
const CommandAuditSchema = new mongoose.Schema({
  commandId: { type: String, required: true, unique: true, index: true },
  source: { type: String, enum: ['minecraft', 'dashboard', 'rest'], required: true },
  senderId: { type: String, required: true, index: true },
  senderDisplayName: { type: String, default: '' },
  sessionId: { type: String, default: null },
  rawText: { type: String, required: true },
  normalizedText: { type: String, required: true },
  parseConfidence: { type: Number, default: 0 },
  corrections: [{ type: mongoose.Schema.Types.Mixed }],
  plannedOperations: [{ type: mongoose.Schema.Types.Mixed }],
  authorizationResult: { type: Boolean, default: false },
  finalStatus: { type: String, default: 'pending' },
  taskIds: [{ type: String }],
  errorDetail: { type: String, default: null },
  timestamp: { type: Date, default: Date.now, index: true }
});

CommandAuditSchema.index({ senderId: 1, timestamp: -1 });

module.exports = mongoose.model('CommandAudit', CommandAuditSchema);
