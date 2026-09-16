const Permission = require('./permission.model');
const AuditLog = require('../../../models/AuditLog');
const { PermissionLevels: Roles } = require('../../../config/constants');
const eventBus = require('../../core/EventBus');
const persistenceManager = require('../../core/PersistenceManager');

// Numeric permission tier weights
const PermissionTiers = Object.freeze({
  OWNER: 4,
  ADMIN: 3,
  TRUSTED: 2,
  GUEST: 1,
  BLOCKED: 0
});

// Map string role names to tier numbers
const RoleToTier = {
  [Roles.OWNER]: PermissionTiers.OWNER,
  [Roles.ADMIN]: PermissionTiers.ADMIN,
  [Roles.TRUSTED]: PermissionTiers.TRUSTED,
  [Roles.GUEST]: PermissionTiers.GUEST,
  [Roles.BLOCKED]: PermissionTiers.BLOCKED
};

/**
 * PermissionManager - 5-tier role-based access controller with auto-expiring temporary grants,
 * security audit logging, rate limiting, and brute-force lockout protection.
 */
class PermissionManager {
  constructor() {
    this.ownerUsername = (process.env.OWNER_USERNAME || '').trim();
    this.rateLimitMap = new Map(); // username -> array of timestamps in last 60s
    this.failedAttemptsMap = new Map(); // username -> array of timestamps in last 5m
    this.tempBlockedUsers = new Map(); // username -> unblockTimestamp
    this.localPermissions = new Map(); // username -> role string

    // Start auto-expiration timer (every 60 seconds)
    this.expirationTimer = setInterval(() => {
      this.checkExpirations().catch((err) => {
        // Silently catch background expiration errors
      });
    }, 60000);
    if (this.expirationTimer && typeof this.expirationTimer.unref === 'function') {
      this.expirationTimer.unref();
    }
  }

  /**
   * Evaluates if a user has sufficient authorization level to execute a command.
   * 
   * @param {string} username - Minecraft username
   * @param {number|string} requiredLevel - Required numeric tier (0-4) or Role name
   * @returns {Promise<boolean>}
   */
  async hasPermission(username, requiredLevel = PermissionTiers.GUEST) {
    if (!username) return false;

    // 1. Owner always has absolute bypass authorization
    const lower = username.toLowerCase();
    if (this.ownerUsername && lower === this.ownerUsername.toLowerCase()) {
      return true;
    }

    // 2. Check temporary lockout
    const tempBlock = this.tempBlockedUsers.get(username.toLowerCase());
    if (tempBlock && Date.now() < tempBlock) {
      return false;
    } else if (tempBlock) {
      this.tempBlockedUsers.delete(username.toLowerCase());
    }

    const targetTier = typeof requiredLevel === 'string'
      ? (RoleToTier[requiredLevel] !== undefined ? RoleToTier[requiredLevel] : PermissionTiers.GUEST)
      : requiredLevel;

    // 3. If MongoDB is offline, use local in-memory permissions with instant lookup
    const mongoose = require('mongoose');
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      const role = this.localPermissions.get(lower) || Roles.GUEST;
      const userTier = RoleToTier[role] !== undefined ? RoleToTier[role] : PermissionTiers.GUEST;
      return userTier >= targetTier && userTier > PermissionTiers.BLOCKED;
    }

    try {
      const doc = await Permission.findOne({ username: lower });
      if (!doc) {
        return PermissionTiers.GUEST >= targetTier;
      }

      // Check explicit expiration
      if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
        doc.permissionLevel = Roles.GUEST;
        doc.expiresAt = null;
        await doc.save();
        return PermissionTiers.GUEST >= targetTier;
      }

      const userTier = RoleToTier[doc.permissionLevel] !== undefined
        ? RoleToTier[doc.permissionLevel]
        : PermissionTiers.GUEST;

      return userTier >= targetTier && userTier > PermissionTiers.BLOCKED;
    } catch (err) {
      const role = this.localPermissions.get(lower) || Roles.GUEST;
      const userTier = RoleToTier[role] !== undefined ? RoleToTier[role] : PermissionTiers.GUEST;
      return userTier >= targetTier && userTier > PermissionTiers.BLOCKED;
    }
  }

  /**
   * Grants a role level to a user, optionally with auto-expiring time duration.
   * 
   * @param {string} username - Target player
   * @param {string} role - Role name ('admin', 'trusted', 'guest', 'blocked')
   * @param {string} grantedBy - Issuer username
   * @param {number|null} [durationMs=null] - Duration before auto-demotion in milliseconds
   * @returns {Promise<Object>}
   */
  async grant(username, role, grantedBy, durationMs = null) {
    const lower = (username || '').toLowerCase();
    if (this.ownerUsername && lower === this.ownerUsername.toLowerCase()) {
      eventBus.emit('log:entry', { severity: 'WARN', category: 'SECURITY', message: 'Attempted to modify owner privileges blocked.' });
      return null;
    }
    const normalizedUser = username.toLowerCase();
    const expiresAt = durationMs ? new Date(Date.now() + durationMs) : null;
    this.localPermissions.set(normalizedUser, role);

    const mongoose = require('mongoose');
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      eventBus.emit('permission.granted', { username, role, grantedBy, expiresAt });
      eventBus.emit('log:entry', {
        severity: 'INFO',
        category: 'SECURITY',
        message: `Granted role '${role}' to ${username} by ${grantedBy}${durationMs ? ` (Expires in ${Math.round(durationMs / 60000)}m)` : ''}`
      });
      return { username: normalizedUser, permissionLevel: role, grantedBy, grantedAt: new Date(), expiresAt };
    }

    try {
      const doc = await Permission.findOneAndUpdate(
        { username: normalizedUser },
        {
          $set: {
            permissionLevel: role,
            grantedBy: grantedBy || this.ownerUsername,
            grantedAt: new Date(),
            expiresAt
          },
          $push: {
            history: {
              action: 'granted',
              level: role,
              by: grantedBy || this.ownerUsername,
              at: new Date()
            }
          }
        },
        { upsert: true, new: true }
      );

      eventBus.emit('permission.granted', { username, role, grantedBy, expiresAt });
      eventBus.emit('log:entry', {
        severity: 'INFO',
        category: 'SECURITY',
        message: `Granted role '${role}' to ${username} by ${grantedBy}${durationMs ? ` (Expires in ${Math.round(durationMs / 60000)}m)` : ''}`
      });

      return doc;
    } catch (err) {
      console.error('[PermissionManager] Grant error:', err.message);
      return null;
    }
  }

  /**
   * Revokes a user's permissions and places them in BLOCKED state.
   * @param {string} username - Target player
   * @param {string} revokedBy - Issuer
   */
  async revoke(username, revokedBy) {
    return this.grant(username, Roles.BLOCKED, revokedBy);
  }

  /**
   * Runs periodic expiration sweep demoting expired roles back to GUEST.
   */
  async checkExpirations() {
    try {
      const now = new Date();
      const expiredDocs = await Permission.find({
        expiresAt: { $ne: null, $lt: now },
        permissionLevel: { $ne: Roles.GUEST }
      });

      for (const doc of expiredDocs) {
        const prevRole = doc.permissionLevel;
        doc.permissionLevel = Roles.GUEST;
        doc.expiresAt = null;
        doc.history.push({
          action: 'expired',
          level: Roles.GUEST,
          by: 'system',
          at: now
        });
        await doc.save();

        eventBus.emit('permission.expired', { username: doc.username, previousRole: prevRole });
        eventBus.emit('log:entry', {
          severity: 'WARN',
          category: 'SECURITY',
          message: `Temporary role '${prevRole}' expired for ${doc.username}. Demoted to GUEST.`
        });
      }
    } catch (err) {
      // MongoDB may be offline; silently skip
    }
  }

  /**
   * Records a security audit attempt to MongoDB and persistent storage.
   * @param {string} username - Command sender
   * @param {string} command - Command text
   * @param {boolean} allowed - Whether authorization was granted
   * @param {string} [reason=''] - Rejection reason if denied
   */
  async logAttempt(username, command, allowed, reason = '') {
    const entry = {
      username,
      command,
      allowed,
      reason,
      timestamp: new Date()
    };

    try {
      await AuditLog.create(entry);
    } catch (err) {
      // Non-fatal if Mongo write fails
    }

    persistenceManager.saveLog({
      severity: allowed ? 'INFO' : 'WARN',
      category: 'AUDIT',
      message: `[${allowed ? 'ALLOWED' : 'DENIED'}] <${username}> "${command}" ${reason ? `(${reason})` : ''}`
    });
  }

  /**
   * Sliding window rate limiter (max 10 commands per 60 seconds).
   * Owner is exempt.
   * 
   * @param {string} username - Sender
   * @returns {boolean} True if within rate limit, false if rate exceeded
   */
  checkRateLimit(username) {
    if (!username) return true;
    const lower = username.toLowerCase();
    if (this.ownerUsername && lower === this.ownerUsername.toLowerCase()) {
      return true; // Owner is exempt from rate limiting
    }

    const now = Date.now();
    const windowStart = now - 60000;
    const key = username.toLowerCase();

    let timestamps = this.rateLimitMap.get(key) || [];
    timestamps = timestamps.filter((t) => t > windowStart);
    timestamps.push(now);
    this.rateLimitMap.set(key, timestamps);

    if (timestamps.length > 10) {
      eventBus.emit('log:entry', {
        severity: 'WARN',
        category: 'SECURITY',
        message: `Rate limit exceeded for user ${username} (>10 cmds/min)`
      });
      return false;
    }

    return true;
  }

  /**
   * Tracks failed command or auth attempts. If 3 failures within 5 minutes occur,
   * auto-locks the account for 10 minutes.
   * @param {string} username
   */
  recordFailedAttempt(username) {
    if (!username) return;
    const now = Date.now();
    const windowStart = now - 300000; // 5 minutes
    const key = username.toLowerCase();

    let fails = this.failedAttemptsMap.get(key) || [];
    fails = fails.filter((t) => t > windowStart);
    fails.push(now);
    this.failedAttemptsMap.set(key, fails);

    if (fails.length >= 3) {
      const lockUntil = now + 600000; // 10 minutes
      this.tempBlockedUsers.set(key, lockUntil);
      eventBus.emit('security.auto_blocked', { username, lockUntil });
      eventBus.emit('log:entry', {
        severity: 'CRITICAL',
        category: 'SECURITY',
        message: `User ${username} auto-blocked for 10 minutes (3 failed auth attempts in 5m)`
      });
    }
  }
}

module.exports = {
  PermissionManager,
  PermissionTiers
};
