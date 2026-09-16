const mineflayer = require('mineflayer');

/**
 * AuthManager - Adaptive authentication manager supporting Microsoft (modern OAuth),
 * Mojang (legacy), and Offline (cracked/local) login modes with automatic detection.
 */
class AuthManager {
  constructor() {
    this.authMode = this.detectAuthMode();
    this.credentials = this.loadCredentials();
  }

  /**
   * Automatically detects the appropriate authentication mode based on environment variables and credentials.
   * @returns {'microsoft'|'mojang'|'offline'}
   */
  detectAuthMode() {
    if (process.env.AUTH_MODE) {
      const mode = process.env.AUTH_MODE.toLowerCase().trim();
      if (['microsoft', 'mojang', 'offline'].includes(mode)) {
        return mode;
      }
    }

    const username = (process.env.MC_USERNAME || '').trim();
    if (username.includes('@')) {
      return 'microsoft'; // Email format represents Microsoft / Xbox Live account
    }
    if (process.env.MC_PASSWORD && process.env.MC_PASSWORD.trim() !== '') {
      return 'mojang'; // Plain username + password represents legacy Mojang account
    }
    return 'offline'; // Default for local test servers and cracked servers
  }

  /**
   * Loads connection credentials and server parameters from environment.
   * @returns {Object}
   */
  loadCredentials() {
    let rawVersion = process.env.MC_VERSION || process.env.MINECRAFT_VERSION;
    let version;
    if (!rawVersion || rawVersion === 'auto' || rawVersion === 'false' || rawVersion.trim() === '') {
      version = false; // Triggers Mineflayer auto-detection via server ping
    } else {
      version = rawVersion.trim();
    }

    const checkTimeoutInterval = process.env.CHECK_TIMEOUT_INTERVAL
      ? parseInt(process.env.CHECK_TIMEOUT_INTERVAL, 10)
      : 60000;

    return {
      username: process.env.MC_USERNAME || 'Argus',
      password: process.env.MC_PASSWORD || undefined,
      auth: this.authMode,
      host: process.env.MC_HOST || 'localhost',
      port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565,
      version: version,
      checkTimeoutInterval: checkTimeoutInterval
    };
  }

  /**
   * Creates and initializes a Mineflayer bot with configured authentication mode.
   * @param {Object} [overrideOptions={}] - Optional options override
   * @returns {import('mineflayer').Bot}
   */
  createBot(overrideOptions = {}) {
    this.authMode = this.detectAuthMode();
    this.credentials = this.loadCredentials();

    const baseOptions = {
      host: this.credentials.host,
      port: this.credentials.port,
      version: this.credentials.version,
      checkTimeoutInterval: this.credentials.checkTimeoutInterval,
      ...overrideOptions
    };

    const versionDesc = this.credentials.version ? this.credentials.version : 'AUTO-DETECT (server ping)';
    console.log(`[AuthManager] Initializing connection with Auth Mode: '${this.authMode.toUpperCase()}' for user '${this.credentials.username}' (Version: ${versionDesc}, Keep-Alive Timeout: ${baseOptions.checkTimeoutInterval}ms)`);

    // 1. Microsoft Account (Modern OAuth)
    if (this.authMode === 'microsoft') {
      return mineflayer.createBot({
        ...baseOptions,
        username: this.credentials.username,
        password: this.credentials.password || undefined,
        auth: 'microsoft'
      });
    }

    // 2. Mojang Account (Legacy)
    if (this.authMode === 'mojang') {
      return mineflayer.createBot({
        ...baseOptions,
        username: this.credentials.username,
        password: this.credentials.password,
        auth: 'mojang'
      });
    }

    // 3. Offline Mode (Direct connection)
    return mineflayer.createBot({
      ...baseOptions,
      username: this.credentials.username,
      auth: 'offline'
    });
  }

  /**
   * Returns current active auth mode details for dashboard reporting.
   * @returns {{ authMode: string, username: string, host: string, port: number }}
   */
  getAuthStatus() {
    return {
      authMode: this.authMode,
      username: this.credentials ? this.credentials.username : 'Unknown',
      host: this.credentials ? this.credentials.host : 'localhost',
      port: this.credentials ? this.credentials.port : 25565
    };
  }
}

module.exports = new AuthManager();
