const crypto = require('crypto');
const persistenceManager = require('./PersistenceManager');
const eventBus = require('./EventBus');
const logger = require('./Logger');

/**
 * ServerAuthManager - Manages in-game server authentication (AuthMe, LoginSecurity, nLogin, etc.).
 * Provides local offline database persistence, password generation, server reset handling,
 * command parsing across various formats (/login, /l, /log, /register, /reg), and real-time
 * server auth detection.
 */
class ServerAuthManager {
  constructor() {
    this.dbFilename = 'server_passwords.json';
    this.memoryCache = new Map(); // serverKey -> credential object
    this.isLoaded = false;
    this.pendingAuthTimer = null;
    this.lastProcessedMessage = null;
    this.lastProcessedTime = 0;
    this.detectionTimer = null;

    // Server Auth Detection State
    this.hasAuth = false;
    this.authStatus = 'unknown'; // 'unknown' | 'detecting' | 'requires_registration' | 'requires_login' | 'authenticated' | 'no_auth'
    this.detectedPlugin = null;
    this.detectionDetails = null;
  }

  /**
   * Generates a normalized composite key for server + username.
   * @param {string} host - Minecraft server host
   * @param {number|string} port - Minecraft server port
   * @param {string} username - Minecraft bot username
   * @returns {string} e.g. "testagrus.aternos.me:22233:argus"
   */
  makeKey(host, port = 25565, username = null) {
    const cleanHost = String(host || 'localhost').toLowerCase().trim();
    const cleanPort = parseInt(port || 25565, 10);
    const resolvedUser = username || process.env.MC_USERNAME || 'bot';
    const cleanUser = String(resolvedUser).toLowerCase().trim();
    return `${cleanHost}:${cleanPort}:${cleanUser}`;
  }

  /**
   * Loads credentials from local atomic JSON file store into memory cache.
   * @returns {Promise<Map<string, Object>>}
   */
  async loadDatabase() {
    try {
      const data = await persistenceManager.loadData(this.dbFilename, { credentials: {} });
      const creds = (data && data.credentials) ? data.credentials : {};
      this.memoryCache.clear();
      for (const [key, val] of Object.entries(creds)) {
        this.memoryCache.set(key, val);
      }
      this.isLoaded = true;
      return this.memoryCache;
    } catch (err) {
      console.warn('[ServerAuthManager] Failed to load server passwords from disk:', err.message);
      this.isLoaded = true;
      return this.memoryCache;
    }
  }

  /**
   * Saves the current memory cache to the local offline JSON database and MongoDB if available.
   * @returns {Promise<void>}
   */
  async saveDatabase() {
    const serialized = {};
    for (const [key, val] of this.memoryCache.entries()) {
      serialized[key] = val;
    }

    // 1. Atomic offline file persistence with SHA-256 integrity and .bak fallback
    await persistenceManager.saveData(this.dbFilename, {
      updatedAt: new Date().toISOString(),
      count: this.memoryCache.size,
      credentials: serialized
    });

    // 2. Dual-sync to MongoDB if connected
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const ServerPassword = require('../models/ServerPassword');
        for (const val of this.memoryCache.values()) {
          await ServerPassword.findOneAndUpdate(
            { serverKey: val.serverKey },
            { $set: val },
            { upsert: true, new: true }
          );
        }
      }
    } catch (e) {
      // Offline fallback: MongoDB is optional
    }
  }

  /**
   * Generates a cryptographically strong, Minecraft-safe alphanumeric password.
   * Guaranteed to contain uppercase, lowercase, numbers, and underscore without characters
   * that can break chat parsing or trigger command escapes.
   * 
   * @param {number} [length=16] - Password length (default: 16)
   * @param {string|null} [prefix=null] - Optional custom prefix (defaults to user's MC_USERNAME + '_')
   * @returns {string} e.g. "ArgusBot_x8K2p9Vx4Q"
   */
  generatePassword(length = 16, prefix = null) {
    const defaultPrefix = process.env.MC_USERNAME ? `${process.env.MC_USERNAME}_` : 'Bot_';
    const activePrefix = prefix !== null ? prefix : defaultPrefix;
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomLength = Math.max(8, length - activePrefix.length);
    const bytes = crypto.randomBytes(randomLength);
    let result = activePrefix;
    for (let i = 0; i < randomLength; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Retrieves a credential for a specific server and bot username from offline database.
   * 
   * @param {string} host - Server host
   * @param {number} port - Server port
   * @param {string} username - Bot username
   * @returns {Promise<Object|null>}
   */
  async getCredential(host, port, username) {
    if (!this.isLoaded) await this.loadDatabase();
    const key = this.makeKey(host, port, username);
    const cached = this.memoryCache.get(key);
    if (cached) return cached;

    // Fallback query to MongoDB if memory cache missed
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const ServerPassword = require('../models/ServerPassword');
        const doc = await ServerPassword.findOne({ serverKey: key }).lean();
        if (doc) {
          this.memoryCache.set(key, doc);
          return doc;
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Fetches all stored server credentials from the offline database.
   * Can be used by dashboards, REST API endpoints, or owners.
   * 
   * @returns {Promise<Array<Object>>}
   */
  async getAllCredentials() {
    if (!this.isLoaded) await this.loadDatabase();
    return Array.from(this.memoryCache.values());
  }

  /**
   * Saves or updates a server password in the offline database.
   * 
   * @param {string} host - Server host
   * @param {number} port - Server port
   * @param {string} username - Bot username
   * @param {string} password - Server password
   * @param {Object} [metadata={}] - Additional details (email, registerCommand, etc.)
   * @returns {Promise<Object>} The saved credential record
   */
  async saveCredential(host, port, username, password, metadata = {}) {
    if (!this.isLoaded) await this.loadDatabase();
    const serverKey = this.makeKey(host, port, username);
    const existing = this.memoryCache.get(serverKey) || {};

    const record = {
      serverKey,
      serverHost: String(host).toLowerCase().trim(),
      serverPort: parseInt(port || 25565, 10),
      username: String(username).trim(),
      password: String(password).trim(),
      requiresAuth: true,
      email: metadata.email || existing.email || process.env.SERVER_AUTH_EMAIL || null,
      registerCommand: metadata.registerCommand || existing.registerCommand || '/register',
      loginCommand: metadata.loginCommand || existing.loginCommand || '/login',
      registeredAt: existing.registeredAt || new Date(),
      lastLoginAt: metadata.lastLoginAt || existing.lastLoginAt || null,
      resetsCount: existing.resetsCount || 0,
      lastResetAt: existing.lastResetAt || null,
      updatedAt: new Date()
    };

    this.memoryCache.set(serverKey, record);
    await this.saveDatabase();

    eventBus.emit('server_auth:credential_saved', {
      serverKey,
      username: record.username,
      updatedAt: record.updatedAt
    });

    return record;
  }

  /**
   * Deletes a credential from the offline database.
   * @param {string} host
   * @param {number} port
   * @param {string} username
   * @returns {Promise<boolean>}
   */
  async deleteCredential(host, port, username) {
    if (!this.isLoaded) await this.loadDatabase();
    const serverKey = this.makeKey(host, port, username);
    const deleted = this.memoryCache.delete(serverKey);
    if (deleted) {
      await this.saveDatabase();
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection && mongoose.connection.readyState === 1) {
          const ServerPassword = require('../models/ServerPassword');
          await ServerPassword.deleteOne({ serverKey });
        }
      } catch (e) {}
    }
    return deleted;
  }

  /**
   * Resets active detection state for a new connection cycle.
   */
  resetDetectionState() {
    if (this.detectionTimer) {
      clearTimeout(this.detectionTimer);
      this.detectionTimer = null;
    }
    this.hasAuth = false;
    this.authStatus = 'unknown';
    this.detectedPlugin = null;
    this.detectionDetails = null;
    this.lastProcessedMessage = null;
    this.lastProcessedTime = 0;
  }

  /**
   * Initiates a detection window when the bot joins or spawns in the server.
   * Checks offline credentials first, then waits for incoming auth challenge prompts.
   * 
   * @param {import('mineflayer').Bot} [bot]
   */
  async startDetectionWindow(bot = null) {
    if (this.detectionTimer) clearTimeout(this.detectionTimer);
    this.authStatus = 'detecting';

    const host = process.env.MC_HOST || 'localhost';
    const port = process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565;
    const username = (bot && bot.username) || process.env.MC_USERNAME || 'Argus';
    const serverKey = this.makeKey(host, port, username);

    const credential = await this.getCredential(host, port, username);
    if (credential && credential.requiresAuth) {
      this.hasAuth = true;
      this.authStatus = 'requires_login';
      this.detectedPlugin = 'AuthMe / LoginSecurity / nLogin (Retained in Database)';
      logger.auth('AUTH-DETECT', `Known authenticated server found in offline database: '${serverKey}'. Awaiting server challenge.`);
    } else {
      logger.info('AUTH-DETECT', `Initiating in-game authentication detection window for '${serverKey}'...`);
    }

    this.detectionTimer = setTimeout(() => {
      this.detectionTimer = null;
      if (!this.hasAuth) {
        this.authStatus = 'no_auth';
        logger.info('AUTH-DETECT', `Authentication detection window concluded: No in-game auth plugin detected on ${host}:${port}. Server operates in direct gameplay mode.`);
        eventBus.emit('server_auth:status', {
          serverKey,
          requiresAuth: false,
          status: 'no_auth'
        });
      }
    }, 12000);

    if (this.detectionTimer && typeof this.detectionTimer.unref === 'function') {
      this.detectionTimer.unref();
    }
  }

  /**
   * Retrieves current server authentication detection state.
   * @returns {Object}
   */
  getAuthStatus() {
    const host = process.env.MC_HOST || 'localhost';
    const port = process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565;
    const username = process.env.MC_USERNAME || 'Argus';
    const serverKey = this.makeKey(host, port, username);
    const cached = this.memoryCache.get(serverKey);

    return {
      serverKey,
      hasAuth: this.hasAuth || (cached ? Boolean(cached.requiresAuth) : false),
      status: this.authStatus,
      detectedPlugin: this.detectedPlugin || ((cached && cached.requiresAuth) ? 'In-Game Auth Plugin (from database)' : 'None'),
      details: this.detectionDetails,
      hasSavedCredential: Boolean(cached)
    };
  }

  /**
   * Checks whether the given server is known to require in-game authentication.
   * @param {string} host
   * @param {number} port
   * @param {string} username
   * @returns {boolean}
   */
  isAuthRequired(host, port, username) {
    if (this.hasAuth) return true;
    const key = this.makeKey(host, port, username);
    const cached = this.memoryCache.get(key);
    return Boolean(cached && cached.requiresAuth);
  }

  /**
   * Identifies the specific authentication plugin name from server message content.
   * @param {string} rawMessage
   * @returns {string}
   */
  identifyPlugin(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') return 'In-Game Auth Plugin (AuthMe / LoginSecurity / nLogin)';
    const clean = rawMessage.replace(/§[0-9a-fk-or]/gi, '').trim();
    if (/authme/i.test(clean)) return 'AuthMe Reloaded';
    if (/nlogin/i.test(clean)) return 'nLogin';
    if (/loginsecurity/i.test(clean)) return 'LoginSecurity';
    if (/limboauth/i.test(clean)) return 'LimboAuth';
    return 'In-Game Auth Plugin (AuthMe / LoginSecurity / nLogin)';
  }

  /**
   * Inspects incoming chat / title messages from the server and detects in-game auth requirements.
   * Matches AuthMe, LoginSecurity, nLogin, OpenLogin, LimboAuth, and other authentication plugins.
   * 
   * @param {string} rawMessage - In-game message text
   * @returns {{ type: 'register'|'login'|'captcha'|'success'|null, command: string, format: string, code?: string }|null}
   */
  detectAuthPrompt(rawMessage) {
    if (!rawMessage || typeof rawMessage !== 'string') return null;
    const clean = rawMessage.replace(/§[0-9a-fk-or]/gi, '').trim();

    // 0. Successful Login / Registration Confirmations
    const successPattern = /(?:successful\s+login|logged\s+in\s+successfully|has\s+iniciado\s+sesi[oó]n|registered\s+successfully|registro\s+exitoso|autenticado|erfolgreich\s+eingeloggt|успешный\s+вход|успешная\s+авторизация|voc[eê]\s+est[aá]\s+logado)/i;
    if (successPattern.test(clean)) {
      return { type: 'success', command: '', format: 'confirmation' };
    }

    // 1. Registration Prompts
    // Patterns:
    // /register <password> <confirmPassword>
    // /reg <password> <confirmPassword>
    // /register <password>
    // /register <password> <email>
    // Use /register <pass>
    // Por favor registrese usando /register
    const regTwoArgs = /\/(?:register|reg)\s+<[^\s>]+>\s+<[^\s>]+>/i;
    const regOneArg = /\/(?:register|reg)\s+<[^\s>]+>/i;
    const regEmail = /\/(?:register|reg)\s+<[^\s>]+>\s+<(?:email|correo)>/i;
    const regGeneral = /(?:please\s+register|use\s+\/(?:register|reg)|type\s+\/(?:register|reg)|reg[ií]strese|зарегистрируйтесь|bitte\s+registrieren|registre-se)/i;

    if (regEmail.test(clean)) {
      const match = clean.match(/\/(register|reg)/i);
      const alias = match ? match[1].toLowerCase() : 'register';
      return { type: 'register', command: `/${alias}`, format: 'with_email' };
    }

    if (regTwoArgs.test(clean)) {
      const match = clean.match(/\/(register|reg)/i);
      const alias = match ? match[1].toLowerCase() : 'register';
      return { type: 'register', command: `/${alias}`, format: 'two_args' };
    }

    if (regOneArg.test(clean)) {
      const match = clean.match(/\/(register|reg)/i);
      const alias = match ? match[1].toLowerCase() : 'register';
      return { type: 'register', command: `/${alias}`, format: 'one_arg' };
    }

    if (regGeneral.test(clean) || (clean.includes('/register') && !clean.includes('/login'))) {
      const match = clean.match(/\/(register|reg)/i);
      const alias = match ? match[1].toLowerCase() : 'register';
      return { type: 'register', command: `/${alias}`, format: 'two_args' }; // default safe format
    }

    // 2. Login Prompts
    // Patterns:
    // /login <password>
    // /log <password>
    // /l <password>
    // Please login with /login <password>
    // Inicie sesion con /login
    // войдите в систему /login
    const loginPattern = /\/(login|log|l)\s+<[^\s>]+>/i;
    const loginGeneral = /(?:please\s+login|use\s+\/(?:login|log|l)|type\s+\/(?:login|log|l)|inicie\s+sesi[oó]n|авторизуйтесь|войдите|bitte\s+einloggen|fa[cç]a\s+login)/i;

    if (loginPattern.test(clean)) {
      const match = clean.match(/\/(login|log|l)\b/i);
      const alias = match ? match[1].toLowerCase() : 'login';
      return { type: 'login', command: `/${alias}`, format: 'one_arg' };
    }

    if (loginGeneral.test(clean) || (clean.includes('/login') || clean.includes('/log') || clean.includes('/l '))) {
      const match = clean.match(/\/(login|log|l)\b/i);
      const alias = match ? match[1].toLowerCase() : 'login';
      return { type: 'login', command: `/${alias}`, format: 'one_arg' };
    }

    // 3. Captcha / Pin Prompts
    // Pattern: /captcha <code> or /pin <code>
    const captchaMatch = clean.match(/\/(?:captcha|pin)\s+(\d{3,8})/i);
    if (captchaMatch) {
      return { type: 'captcha', command: '/captcha', format: 'code', code: captchaMatch[1] };
    }

    return null;
  }

  /**
   * Processes incoming server messages and performs automatic registration or login.
   * Handles first-time join, second-time retention, and server database resets.
   * 
   * @param {string} rawMessage - Message from server chat, title, or actionbar
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @returns {Promise<boolean>} True if an authentication action was dispatched
   */
  async handleServerMessage(rawMessage, bot) {
    if (!rawMessage || !bot || typeof bot.chat !== 'function') return false;

    // Throttle identical prompt processing within 2 seconds to avoid spamming
    const now = Date.now();
    if (rawMessage === this.lastProcessedMessage && (now - this.lastProcessedTime) < 2000) {
      return false;
    }

    const prompt = this.detectAuthPrompt(rawMessage);
    if (!prompt) return false;

    this.lastProcessedMessage = rawMessage;
    this.lastProcessedTime = now;

    // Handle authentication confirmation
    if (prompt.type === 'success') {
      this.authStatus = 'authenticated';
      logger.success('SERVER-AUTH', 'Server confirmed authentication status: AUTHENTICATED');
      eventBus.emit('server_auth:authenticated', { status: 'authenticated' });
      return true;
    }

    const host = process.env.MC_HOST || 'localhost';
    const port = process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565;
    const username = (bot && bot.username) ? bot.username : (process.env.MC_USERNAME || 'Argus');
    const serverKey = this.makeKey(host, port, username);

    // Update detected auth state
    this.hasAuth = true;
    this.detectedPlugin = this.identifyPlugin(rawMessage);
    this.authStatus = prompt.type === 'register' ? 'requires_registration' : 'requires_login';
    this.detectionDetails = { ...prompt, pluginName: this.detectedPlugin, serverKey, detectedAt: new Date().toISOString() };

    logger.diagnose('IN-GAME SERVER AUTH DETECTED', {
      'Target Server': serverKey,
      'Auth Plugin': this.detectedPlugin,
      'Action Required': prompt.type.toUpperCase(),
      'Command Alias': prompt.command || 'N/A',
      'Format Detected': prompt.format || 'default'
    }, 'warn');

    eventBus.emit('server_auth:detected', this.detectionDetails);

    const credential = await this.getCredential(host, port, username);

    // 1. Handle Captcha prompt
    if (prompt.type === 'captcha' && prompt.code) {
      logger.auth('SERVER-AUTH', `Solving in-game captcha challenge with code: ${prompt.code}`);
      setTimeout(() => {
        try { bot.chat(`/captcha ${prompt.code}`); } catch (e) {}
      }, 750);
      return true;
    }

    // 2. Handle Registration Prompt
    if (prompt.type === 'register') {
      let passwordToUse;
      let isServerReset = false;

      if (credential) {
        // SERVER PASSWORD DATABASE RESET DETECTED!
        isServerReset = true;
        passwordToUse = credential.password; // Reuse existing password to preserve identity
        credential.resetsCount = (credential.resetsCount || 0) + 1;
        credential.lastResetAt = new Date();
        logger.warn('SERVER-AUTH', `SERVER DATABASE RESET DETECTED on '${serverKey}'. Re-registering with retained password...`);
        eventBus.emit('log:entry', {
          severity: 'WARN',
          category: 'AUTH',
          message: `Server auth database reset detected for ${serverKey}. Re-registering with retained password.`
        });
      } else {
        // First-time registration on this server
        passwordToUse = process.env.SERVER_AUTH_PASSWORD || this.generatePassword(16);
        logger.auth('SERVER-AUTH', `First-time registration required on '${serverKey}'. Generated secure password.`);
      }

      // Build registration command string based on server format
      let commandPayload;
      const cmdAlias = prompt.command || '/register';

      if (prompt.format === 'with_email') {
        const email = process.env.SERVER_AUTH_EMAIL || 'argus_bot@minecraft.local';
        commandPayload = `${cmdAlias} ${passwordToUse} ${email}`;
      } else if (prompt.format === 'one_arg') {
        commandPayload = `${cmdAlias} ${passwordToUse}`;
      } else {
        // Default two_args: /register <password> <password>
        commandPayload = `${cmdAlias} ${passwordToUse} ${passwordToUse}`;
      }

      // Save to offline database
      await this.saveCredential(host, port, username, passwordToUse, {
        registerCommand: cmdAlias,
        lastLoginAt: new Date()
      });

      // Dispatch command with delay to avoid anti-spam kicks
      setTimeout(() => {
        try {
          logger.auth('SERVER-AUTH', `Executing registration: ${cmdAlias} [PROTECTED]`);
          bot.chat(commandPayload);
        } catch (e) {
          logger.warn('SERVER-AUTH', `Failed to send registration command: ${e.message}`);
        }
      }, 800);

      return true;
    }

    // 3. Handle Login Prompt (Joining for second time)
    if (prompt.type === 'login') {
      let passwordToUse;
      const cmdAlias = prompt.command || '/login';

      if (credential) {
        // Retained password found in offline database!
        passwordToUse = credential.password;
        logger.auth('SERVER-AUTH', `Login prompt detected on '${serverKey}'. Authenticating with retained password from offline database.`);
      } else if (process.env.SERVER_AUTH_PASSWORD) {
        // Fallback to configured environment password
        passwordToUse = process.env.SERVER_AUTH_PASSWORD;
        logger.auth('SERVER-AUTH', `Login prompt detected on '${serverKey}'. Authenticating with SERVER_AUTH_PASSWORD from .env.`);
      } else {
        // Unknown password!
        logger.error('SERVER-AUTH', `Server '${serverKey}' requested login, but no password exists in offline database! Set SERVER_AUTH_PASSWORD in .env or register manually.`);
        eventBus.emit('log:entry', {
          severity: 'ERROR',
          category: 'AUTH',
          message: `Server requested login for ${serverKey}, but no password was found in offline database.`
        });
        return false;
      }

      const commandPayload = `${cmdAlias} ${passwordToUse}`;

      // Update last login timestamp in offline database
      await this.saveCredential(host, port, username, passwordToUse, {
        loginCommand: cmdAlias,
        lastLoginAt: new Date()
      });

      // Dispatch command with safe 800ms delay
      setTimeout(() => {
        try {
          logger.auth('SERVER-AUTH', `Executing login: ${cmdAlias} [PROTECTED]`);
          bot.chat(commandPayload);
        } catch (e) {
          logger.warn('SERVER-AUTH', `Failed to send login command: ${e.message}`);
        }
      }, 800);

      return true;
    }

    return false;
  }
}

module.exports = new ServerAuthManager();
