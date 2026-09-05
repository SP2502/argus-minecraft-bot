const mongoose = require('mongoose');

/**
 * Permission Schema - Persists player authorization and role levels
 */
const PermissionSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  permissionLevel: {
    type: String,
    enum: ['owner', 'admin', 'trusted', 'guest', 'blocked'],
    default: 'guest'
  },
  grantedBy: { type: String, default: 'system' },
  grantedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
  history: [
    {
      level: { type: String, required: true },
      grantedBy: { type: String, default: 'system' },
      grantedAt: { type: Date, default: Date.now },
      reason: { type: String, default: '' }
    }
  ]
});

module.exports = mongoose.model('Permission', PermissionSchema);
