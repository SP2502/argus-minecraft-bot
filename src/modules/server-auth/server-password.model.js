const mongoose = require('mongoose');

/**
 * ServerPassword Schema - Stores server-specific authentication credentials
 * for servers requiring in-game AuthMe / LoginSecurity / nLogin authentication.
 */
const ServerPasswordSchema = new mongoose.Schema({
  serverKey: { type: String, required: true, unique: true, index: true }, // e.g. "testagrus.aternos.me:22233:argus"
  serverHost: { type: String, required: true, index: true },
  serverPort: { type: Number, default: 25565 },
  username: { type: String, required: true, index: true },
  password: { type: String, required: true },
  email: { type: String, default: null },
  registerCommand: { type: String, default: '/register' },
  loginCommand: { type: String, default: '/login' },
  registeredAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },
  resetsCount: { type: Number, default: 0 },
  lastResetAt: { type: Date, default: null },
  updatedAt: { type: Date, default: Date.now }
});

ServerPasswordSchema.index({ serverHost: 1, serverPort: 1, username: 1 });

module.exports = mongoose.model('ServerPassword', ServerPasswordSchema);
