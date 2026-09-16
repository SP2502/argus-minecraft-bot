require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const authManager = require('./core/AuthManager');
const persistenceManager = require('./core/PersistenceManager');
const StateStore = require('./core/StateStore');
const BotContext = require('./core/BotContext');
const AIBrain = require('./core/AIBrain');
const { startServer } = require('./api/server');
const eventBus = require('./core/EventBus');
const MinecraftChatAdapter = require('./commands/adapters/MinecraftChatAdapter');
const serverAuthManager = require('./core/ServerAuthManager');
const logger = require('./core/Logger');

let bot = null;
let botContext = null;
let aiBrain = null;
let apiServer = null;
let chatAdapter = null;
let lastHealth = 20;
let initialHealthReceived = false;
let isShuttingDown = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const BASE_RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 120000; // 2 minutes max

const stateStore = new StateStore();

// Dynamic BotContext proxy so API server and WebSocket remain valid across reconnects
const ctxProxy = new Proxy({}, {
  get(target, prop) {
    if (!botContext) return undefined;
    const val = botContext[prop];
    if (typeof val === 'function') {
      return val.bind(botContext);
    }
    return val;
  }
});

/**
 * Starts or restarts the Mineflayer bot instance and lifecycle listeners.
 */
function initBot() {
  if (isShuttingDown) return;

  const targetHost = process.env.MC_HOST || 'localhost';
  const targetPort = process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565;
  const currentBotName = process.env.MC_USERNAME || 'Argus';
  const authMode = authManager.authMode;

  try {
    logger.network('MINEFLAYER', `Establishing connection to ${targetHost}:${targetPort} as '${currentBotName}' (${authMode})...`);
    serverAuthManager.resetDetectionState();
    bot = authManager.createBot();
    initialHealthReceived = false;

    // GrimAC & Modern Anti-Cheat Movement Fix (Mineflayer Issue #3791)
    // Send expected tick_end packet on physics ticks ONLY if supported by the server protocol (1.21.3+)
    bot.on('physicTick', () => {
      if (bot._client && bot._client.state === 'play' && bot.registry) {
        try {
          const toServer = bot.registry.protocol && bot.registry.protocol.play && bot.registry.protocol.play.toServer;
          if (toServer && toServer.types && toServer.types.packet_tick_end) {
            bot._client.write('tick_end', {});
          }
        } catch (e) {
          // Ignored
        }
      }
    });

    // In-Game Server Authentication Detection & Auto-Login/Register (Chat, Title, Subtitle, ActionBar)
    bot.on('messagestr', async (msg) => {
      try {
        await serverAuthManager.handleServerMessage(msg, bot);
      } catch (err) {
        logger.warn('SERVER-AUTH', `Message processing error: ${err.message}`);
      }
    });

    bot.on('title', async (text) => {
      try {
        await serverAuthManager.handleServerMessage(text, bot);
      } catch (err) {}
    });

    bot.on('subtitle', async (text) => {
      try {
        await serverAuthManager.handleServerMessage(text, bot);
      } catch (err) {}
    });

    bot.on('actionBar', async (text) => {
      try {
        await serverAuthManager.handleServerMessage(text, bot);
      } catch (err) {}
    });

    bot.on('login', () => {
      logger.success('MINEFLAYER', `Handshake authenticated. Logged in as '${bot.username}' (${authMode.toUpperCase()} mode).`);
      eventBus.emit('log:entry', {
        severity: 'SUCCESS',
        category: 'AUTH',
        message: `Logged in as ${bot.username} (${authMode.toUpperCase()})`
      });
    });

    bot.once('spawn', () => {
      reconnectAttempts = 0; // Reset exponential backoff on successful server connection
      const posX = bot.entity ? Math.round(bot.entity.position.x) : 0;
      const posY = bot.entity ? Math.round(bot.entity.position.y) : 0;
      const posZ = bot.entity ? Math.round(bot.entity.position.z) : 0;
      logger.success('MINEFLAYER', `Bot spawned in world at (${posX}, ${posY}, ${posZ}). Subsystems initializing...`);

      // Initialize BotContext and dependency container
      botContext = new BotContext(bot);
      lastHealth = bot.health !== undefined ? bot.health : 20;

      // Attach singleton MinecraftChatAdapter directly to UnifiedCommandGateway
      chatAdapter = new MinecraftChatAdapter(botContext);
      chatAdapter.attach();

      // Start in-game server auth detection window
      serverAuthManager.startDetectionWindow(bot);

      // Delay AI Brain activation slightly to allow surrounding chunks to fully settle
      setTimeout(() => {
        if (!bot || !bot.entity) return;
        aiBrain = new AIBrain(botContext);
        aiBrain.start();
        const botName = bot.username || process.env.MC_USERNAME || 'Bot';
        logger.info('AIBRAIN', `${botName} autonomous brain active and idling safely.`);
      }, 2000);

      eventBus.emit('bot:ready', { username: bot.username });
      const activeBotName = bot.username || process.env.MC_USERNAME || 'Bot';
      botContext.messageRouter.send(3, `${activeBotName} system operational. Unified Command Gateway, TaskManager, and Security active.`);

      // Greet owner if already online when bot joins
      const ownerName = (process.env.OWNER_USERNAME || '').trim();
      const isOwnerOnline = Boolean(ownerName) && Object.keys(bot.players || {}).some(
        name => name.toLowerCase() === ownerName.toLowerCase()
      );
      if (isOwnerOnline) {
        setTimeout(() => {
          if (bot && typeof bot.chat === 'function') {
            try {
              bot.chat(`Master ${ownerName}, ${activeBotName} has connected and is ready for your orders!`);
            } catch (e) {}
          }
        }, 2500);
      }
    });

    bot.on('playerJoined', (player) => {
      if (!player || !player.username || player.username === bot.username) return;
      logger.info('PLAYER', `Player '${player.username}' joined the server.`);
      eventBus.emit('log:entry', {
        severity: 'INFO',
        category: 'SECURITY',
        message: `Player ${player.username} joined the server.`
      });

      const ownerName = (process.env.OWNER_USERNAME || '').trim();
      const isOwner = Boolean(ownerName) && player.username.toLowerCase() === ownerName.toLowerCase();
      const activeName = bot.username || process.env.MC_USERNAME || 'Bot';

      if (isOwner) {
        setTimeout(() => {
          if (!bot || typeof bot.chat !== 'function') return;
          try {
            bot.chat(`Welcome back, Master ${player.username}! ${activeName} is at your service.`);
          } catch (e) {}
        }, 1500);

        // Turn to look at owner if in range
        setTimeout(() => {
          try {
            const pEntity = bot.players[player.username] ? bot.players[player.username].entity : null;
            if (pEntity && bot.entity) {
              bot.lookAt(pEntity.position.offset(0, 1.6, 0));
            }
          } catch (e) {}
        }, 2000);
      } else {
        setTimeout(() => {
          if (!bot || typeof bot.chat !== 'function') return;
          try {
            bot.chat(`Welcome, ${player.username}! I am ${activeName}, an autonomous assistant. Type 'help' for commands.`);
          } catch (e) {}
        }, 2000);
      }
    });

    bot.on('playerLeft', (player) => {
      if (!player || !player.username) return;
      logger.info('PLAYER', `Player '${player.username}' left the server.`);
      eventBus.emit('log:entry', {
        severity: 'INFO',
        category: 'SECURITY',
        message: `Player ${player.username} left the server.`
      });

      const ownerName = (process.env.OWNER_USERNAME || '').trim();
      if (Boolean(ownerName) && player.username.toLowerCase() === ownerName.toLowerCase()) {
        if (botContext && botContext.nav) {
          try { botContext.nav.stopFollowing(); } catch (e) {}
        }
      }
    });

    bot.on('death', () => {
      logger.warn('MINEFLAYER', 'Bot died. Respawning in 1.5 seconds...');
      setTimeout(() => {
        try {
          if (bot && typeof bot.respawn === 'function') {
            bot.respawn();
            logger.info('MINEFLAYER', 'Respawn packet dispatched.');
          }
        } catch (e) {
          logger.warn('MINEFLAYER', `Respawn error: ${e.message}`);
        }
      }, 1500);
    });

    bot.on('health', () => {
      if (!initialHealthReceived) {
        initialHealthReceived = true;
        lastHealth = bot.health !== undefined ? bot.health : 20;
        return;
      }

      // Track damage hits and update SafetyService
      if (botContext && botContext.safety) {
        if (bot.health !== undefined && bot.health < lastHealth) {
          botContext.safety.recordDamage();
          botContext.messageRouter.send(1, `Bot took damage! Health: ${bot.health}/20`, {
            eventType: 'DAMAGE_ALERT',
            health: bot.health,
            food: bot.food
          });

          // Instantly trigger tactical self-defense against attacking threat
          if (botContext.combat && typeof botContext.combat.handleUnderAttack === 'function') {
            botContext.combat.handleUnderAttack().catch((err) => {
              logger.warn('COMBAT', `Defense retaliation error: ${err.message}`);
            });
          }
        }
        lastHealth = bot.health !== undefined ? bot.health : 20;

        setTimeout(() => {
          if (botContext && botContext.safety) {
            if (Date.now() - botContext.safety.lastDamageTime >= 10000) {
              botContext.safety.resetDamageTracker();
            }
          }
        }, 10000);
      }

      eventBus.emit('bot:health', {
        health: bot.health,
        food: bot.food
      });
    });

    bot.on('entityHurt', (entity) => {
      if (!entity || !bot.entity || entity !== bot.entity) return;
      logger.warn('COMBAT', `Bot entity injured! Scanning for immediate hostile threats...`);
      if (botContext && botContext.combat && typeof botContext.combat.handleUnderAttack === 'function') {
        botContext.combat.handleUnderAttack().catch((err) => {
          logger.warn('COMBAT', `entityHurt defense retaliation error: ${err.message}`);
        });
      }
    });

    bot.on('kicked', (reason) => {
      const reasonStr = formatKickReason(reason);
      const lower = reasonStr.toLowerCase();

      logger.diagnose('SERVER DISCONNECT / KICK DETECTED', {
        'Kick Reason': reasonStr,
        'Target Server': `${targetHost}:${targetPort}`,
        'Bot Username': (bot && bot.username) || currentBotName,
        'Spawned In World': Boolean(bot && bot.entity),
        'Health': (bot && bot.health !== undefined) ? `${bot.health}/20` : 'N/A'
      }, 'warn');

      eventBus.emit('bot:kicked', reasonStr);
      if (botContext && botContext.messageRouter) {
        botContext.messageRouter.send(1, `Kicked from server: ${reasonStr}`, { eventType: 'BOT_KICKED', reason: reasonStr });
      }
      cleanupBot();

      // Analyze kick reason to prevent infinite reconnect loop amplification
      if (lower.includes('banned') || lower.includes('blacklisted')) {
        logger.error('BOT', `Permanent ban detected: "${reasonStr}". Halting automatic reconnect loop.`);
        return;
      }

      if (lower.includes('whitelist') || lower.includes('white-listed')) {
        logger.warn('BOT', `Server whitelist active ("${reasonStr}"). Retrying with extended 60s backoff...`);
        scheduleReconnect(60000, true);
        return;
      }

      if (lower.includes('already connected') || lower.includes('logged in from another location') || lower.includes('duplicate login')) {
        logger.warn('BOT', `Duplicate session detected on server ("${reasonStr}"). Waiting 30s for ghost connection to clear...`);
        scheduleReconnect(30000, true);
        return;
      }

      if (lower.includes('outdated client') || lower.includes('outdated server')) {
        logger.warn('BOT', `Version mismatch detected ("${reasonStr}"). Check MC_VERSION in .env (or set MC_VERSION=auto to auto-detect). Retrying in 20s...`);
        scheduleReconnect(20000, true);
        return;
      }

      // Standard exponential backoff
      scheduleReconnect();
    });

    bot.on('error', (err) => {
      logger.diagnoseError(err, {
        host: targetHost,
        port: targetPort,
        username: (bot && bot.username) || currentBotName,
        authMode
      });
      eventBus.emit('bot:error', err);
      if (botContext && botContext.messageRouter) {
        botContext.messageRouter.send(1, `Mineflayer error: ${err.message}`, { eventType: 'BOT_ERROR', error: err.message });
      }
    });

    bot.on('end', (reason) => {
      const reasonStr = formatKickReason(reason);
      logger.warn('MINEFLAYER', `Connection ended. Reason: "${reasonStr}"`);
      eventBus.emit('bot:ended', reasonStr);
      cleanupBot();
      scheduleReconnect();
    });

  } catch (err) {
    logger.diagnoseError(err, {
      host: targetHost,
      port: targetPort,
      username: currentBotName,
      authMode
    });
    scheduleReconnect();
  }
}

/**
 * Formats a Mineflayer kicked/end reason into a clean human-readable string.
 * @param {string|Object} reason
 * @returns {string}
 */
function formatKickReason(reason) {
  if (!reason) return 'Unknown reason';
  if (typeof reason === 'string') return reason;
  if (reason.extra && Array.isArray(reason.extra)) {
    const text = reason.extra.map((e) => (typeof e === 'object' ? e.text || '' : String(e))).join('').trim();
    if (text) return text;
  }
  if (reason.text) return String(reason.text).trim();
  if (typeof reason.toString === 'function' && reason.toString() !== '[object Object]') {
    return reason.toString().trim();
  }
  try {
    return JSON.stringify(reason);
  } catch (e) {
    return String(reason);
  }
}

/**
 * Cleans up existing bot sub-components before reconnecting.
 */
function cleanupBot() {
  if (aiBrain) {
    try { aiBrain.stop(); } catch (e) {}
    aiBrain = null;
  }
  if (chatAdapter) {
    try { chatAdapter.detach(); } catch (e) {}
    chatAdapter = null;
  }
  if (botContext && botContext.nav) {
    try { botContext.nav.stopFollowing(); } catch (e) {}
  }
  if (botContext && botContext.taskManager) {
    try { botContext.taskManager.cancelAll('reconnecting'); } catch (e) {}
  }
}

/**
 * Schedules auto-reconnection with exponential backoff if not already pending.
 * @param {number|null} [explicitDelayMs=null] - Optional forced delay in milliseconds
 * @param {boolean} [isCustomReason=false] - Whether this is a custom delay without incrementing exponential attempts
 */
function scheduleReconnect(explicitDelayMs = null, isCustomReason = false) {
  if (isShuttingDown || reconnectTimer) return;

  let delayMs;
  if (explicitDelayMs !== null) {
    delayMs = explicitDelayMs;
  } else {
    // Exponential backoff: 5s, 10s, 20s, 40s, 80s, up to 120s
    delayMs = Math.min(BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY_MS);
    if (!isCustomReason) {
      reconnectAttempts++;
    }
  }

  logger.network('RECONNECT', `Scheduling reconnect (attempt #${reconnectAttempts}) in ${delayMs / 1000} seconds...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initBot();
  }, delayMs);
}

/**
 * Initializes persistent data storage, database connection, Mineflayer bot instance, and core systems.
 */
async function bootstrap() {
  const host = process.env.MC_HOST || 'localhost';
  const port = process.env.MC_PORT || 25565;
  const username = process.env.MC_USERNAME || 'Argus';
  const owner = (process.env.OWNER_USERNAME || '').trim() || '[NOT CONFIGURED]';
  const authMode = process.env.AUTH_MODE || 'offline';
  const apiPort = process.env.API_PORT || process.env.PORT || 3000;

  logger.diagnose('ARGUS AUTONOMOUS SYSTEM INITIALIZING', {
    'Target Server': `${host}:${port}`,
    'Bot Username': username,
    'Owner Username': owner,
    'Auth Mode': authMode,
    'Minecraft Version': process.env.MC_VERSION || 'auto-detect',
    'Dashboard API Port': apiPort,
    'Node.js Version': process.version,
    'Operating System': `${process.platform} (${process.arch})`
  }, 'info');

  try {
    // 1. Initialize persistent storage directory
    await persistenceManager.ensureDataDir();
    const platformInfo = persistenceManager.getPlatformInfo();
    logger.info('STORAGE', `Persistent Storage Directory: ${persistenceManager.dataDir} (${platformInfo.platform})`);

    // 2. Start API & WebSocket server
    if (!apiServer) {
      apiServer = startServer(ctxProxy, apiPort);
    }

    // 3. Connect to MongoDB persistence store (or graceful local fallback)
    await stateStore.connect(process.env.MONGODB_URI);

    // 4. Start bot connection
    initBot();

  } catch (error) {
    logger.error('BOOTSTRAP', `Fatal startup error: ${error.message}`, error);
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown on SIGINT / SIGTERM.
 */
async function shutdown(signal) {
  isShuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

  cleanupBot();

  // Persist current state snapshot, task checkpoints, and flush logs
  try {
    const shutdownSnapshot = {
      timestamp: Date.now(),
      signal,
      taskQueue: botContext && botContext.taskManager ? botContext.taskManager.getQueueSnapshot() : null,
      savedAt: new Date().toISOString()
    };
    await persistenceManager.saveState(shutdownSnapshot);
    await persistenceManager.saveLog({
      severity: 'INFO',
      category: 'SYSTEM',
      message: `Clean graceful shutdown completed via ${signal}. State snapshot persisted.`
    });
    console.log('[Shutdown] State snapshot and logs persisted successfully.');
  } catch (persistErr) {
    console.warn('[Shutdown] Failed to persist state during shutdown:', persistErr.message);
  }

  if (bot) {
    try {
      bot.quit();
      console.log('[Shutdown] Bot disconnected from server.');
    } catch (e) {
      // ignore
    }
  }

  await stateStore.disconnect();

  if (apiServer && apiServer.server) {
    apiServer.server.close(() => {
      console.log('[Shutdown] API server closed.');
    });
  }

  console.log('[Shutdown] Shutdown complete. Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Execute bot bootstrap
bootstrap();
