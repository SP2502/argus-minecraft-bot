const mongoose = require('mongoose');

/**
 * AuditLog Schema - Records authorization attempts, commands, and security incidents
 */
const AuditLogSchema = new mongoose.Schema({
  username: { type: String, required: true },
  command: { type: String, required: true },
  allowed: { type: Boolean, required: true },
  reason: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ username: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
