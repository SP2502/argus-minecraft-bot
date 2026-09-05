require('dotenv').config();

const authManager = require('./core/AuthManager');
const persistenceManager = require('./core/PersistenceManager');
const StateStore = require('./core/StateStore');
const BotContext = require('./core/BotContext');
const AIBrain = require('./core/AIBrain');
const { startServer } = require('./api/server');
const eventBus = require('./core/EventBus');
const MinecraftChatAdapter = require('./commands/adapters/MinecraftChatAdapter');

let bot = null;
let botContext = null;
let aiBrain = null;
let apiServer = null;
let chatAdapter = null;
let lastHealth = 20;
const stateStore = new StateStore();

/**
 * Initializes persistent data storage, database connection, Mineflayer bot instance, and core systems.
 */
async function bootstrap() {
  console.log('====================================================');
  console.log('       ARGUS MINECRAFT BOT - SYSTEM STARTUP         ');
  console.log('====================================================');

  try {
    // 1. Initialize persistent storage directory
    await persistenceManager.ensureDataDir();
    const platformInfo = persistenceManager.getPlatformInfo();
    console.log(`[Bootstrap] Host Platform: ${platformInfo.platform}`);
    console.log(`[Bootstrap] Persistent Storage Directory: ${persistenceManager.dataDir}`);

    // 2. Connect to MongoDB persistence store (or graceful local fallback)
    await stateStore.connect(process.env.MONGODB_URI);

    // 3. Configure and create Mineflayer bot using Adaptive AuthManager
    bot = authManager.createBot();

    // 4. Bot lifecycle event bindings
    bot.on('login', () => {
      console.log(`[Bot] Successfully logged in as '${bot.username}' (Auth: ${authManager.authMode.toUpperCase()}).`);
      eventBus.emit('log:entry', {
        severity: 'SUCCESS',
        category: 'AUTH',
        message: `Logged in as ${bot.username} (${authManager.authMode.toUpperCase()})`
      });
    });

    bot.once('spawn', () => {
      console.log(`[Bot] Bot spawned in world. Initializing runtime context & services...`);

      // Initialize BotContext and dependency container (which mounts UnifiedCommandGateway, TaskManager, Security, NLP)
      botContext = new BotContext(bot);
      lastHealth = bot.health !== undefined ? bot.health : 20;

      // Attach singleton MinecraftChatAdapter directly to UnifiedCommandGateway
      chatAdapter = new MinecraftChatAdapter(botContext);
      chatAdapter.attach();

      // Start autonomous AI brain loop
      aiBrain = new AIBrain(botContext);
      aiBrain.start();

      // Start API & WebSocket telemetry server (serving Web Dashboard & REST Gateway)
      const port = process.env.API_PORT || process.env.PORT || 3000;
      apiServer = startServer(botContext, port);

      eventBus.emit('bot:ready', { username: bot.username });
      botContext.messageRouter.send(3, 'Argus system operational. Unified Command Gateway, TaskManager, and Security active.');
      console.log('[Bot] Argus system is fully operational and idling safely.');
    });

    bot.on('health', () => {
      // Track damage hits and update SafetyService
      if (botContext && botContext.safety) {
        if (bot.health !== undefined && bot.health < lastHealth) {
          botContext.safety.recordDamage();
          botContext.messageRouter.send(1, `Bot took damage! Health: ${bot.health}/20`, {
            eventType: 'DAMAGE_ALERT',
            health: bot.health,
            food: bot.food
          });
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

    bot.on('kicked', (reason) => {
      console.warn('[Bot] Disconnected / Kicked from server:', reason);
      eventBus.emit('bot:kicked', reason);
      if (botContext && botContext.messageRouter) {
        botContext.messageRouter.send(1, `Kicked from server: ${reason}`, { eventType: 'BOT_KICKED', reason });
      }
    });

    bot.on('error', (err) => {
      console.error('[Bot] Mineflayer error encountered:', err.message);
      eventBus.emit('bot:error', err);
      if (botContext && botContext.messageRouter) {
        botContext.messageRouter.send(1, `Mineflayer error: ${err.message}`, { eventType: 'BOT_ERROR', error: err.message });
      }
    });

    bot.on('end', (reason) => {
      console.warn('[Bot] Connection ended:', reason);
      eventBus.emit('bot:ended', reason);
    });

  } catch (error) {
    console.error('[Bootstrap] Fatal startup error:', error);
    process.exit(1);
  }
}

/**
 * Handles graceful shutdown on SIGINT / SIGTERM.
 */
async function shutdown(signal) {
  console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

  if (aiBrain) {
    aiBrain.stop();
  }

  if (botContext && botContext.nav) {
    botContext.nav.stopFollowing();
  }

  if (botContext && botContext.taskManager) {
    botContext.taskManager.cancelAll('shutdown');
  }

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
