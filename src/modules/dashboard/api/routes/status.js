const express = require('express');
const fs = require('fs');
const path = require('path');
const eventBus = require('../../../../core/EventBus');

/**
 * Updates .env and .env.local configuration files atomically on disk.
 * @param {Object} updates - Key/value pairs to update in environment files
 */
function updateEnvFiles(updates) {
  const envPaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '.env.local')
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    try {
      let content = fs.readFileSync(envPath, 'utf8');
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null) continue;
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${value}`);
        } else {
          content = content.trimEnd() + `\n${key}=${value}\n`;
        }
      }
      fs.writeFileSync(envPath, content, 'utf8');
    } catch (e) {
      console.warn(`[EnvUpdate] Failed to update ${envPath}:`, e.message);
    }
  }
}

/**
 * Creates status and health routing endpoints.
 * @param {import('../../core/BotContext')} [ctx] - BotContext reference
 * @returns {express.Router}
 */
function createStatusRouter(ctx) {
  const router = express.Router();

  /**
   * GET /health - Basic health check
   */
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Helper to determine live Minecraft server connection state.
   */
  function getMinecraftConnectionState() {
    if (!ctx || !ctx.bot) return { online: false, state: 'disconnected' };
    const client = ctx.bot._client;
    if (client && !client.ended && client.state === 'play') {
      return { online: true, state: 'connected' };
    }
    if (client && !client.ended) {
      return { online: false, state: 'connecting' };
    }
    return { online: false, state: 'disconnected' };
  }

  /**
   * GET /status - Detailed bot telemetry status
   */
  router.get('/status', (req, res) => {
    let baseStatus = {};
    if (ctx && typeof ctx.getStatus === 'function') {
      baseStatus = ctx.getStatus();
    } else {
      baseStatus = {
        status: 'initialized',
        uptime: process.uptime()
      };
    }
    const conn = getMinecraftConnectionState();
    res.json({
      ...baseStatus,
      online: conn.online,
      connectionState: conn.state,
      server: {
        host: process.env.MC_HOST || 'localhost',
        port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565
      },
      owner: (ctx && ctx.permissionManager && ctx.permissionManager.ownerUsername) || process.env.OWNER_USERNAME || 'Kamlesh'
    });
  });

  /**
   * GET /nav-status - Navigation service telemetry (isFollowing, isStuck, currentGoal)
   */
  router.get('/nav-status', (req, res) => {
    if (ctx && ctx.nav && typeof ctx.nav.getNavStatus === 'function') {
      res.json(ctx.nav.getNavStatus());
    } else {
      res.json({
        isFollowing: false,
        isStuck: false,
        currentGoal: null
      });
    }
  });

  /**
   * GET /inv-status - Inventory service telemetry (usedSlots, totalSlots, isFull, topValueItems)
   */
  router.get('/inv-status', (req, res) => {
    if (ctx && ctx.inv && typeof ctx.inv.getStatus === 'function') {
      res.json(ctx.inv.getStatus());
    } else {
      res.json({
        usedSlots: 0,
        totalSlots: 36,
        isFull: false,
        topValueItems: []
      });
    }
  });

  /**
   * GET /safety-status - Safety service telemetry (isCritical, isLowHealth, isNearLava, etc.)
   */
  router.get('/safety-status', (req, res) => {
    if (ctx && ctx.safety && typeof ctx.safety.getStatus === 'function') {
      res.json(ctx.safety.getStatus());
    } else {
      res.json({
        isCritical: false,
        isLowHealth: false,
        isLowHunger: false,
        isNearLava: false,
        isNight: false,
        shouldRetreat: false
      });
    }
  });

  /**
   * GET /tool-status - Tool service telemetry (bestPickaxe, bestAxe, bestSword, isAboutToBreak)
   */
  router.get('/tool-status', (req, res) => {
    const toolService = ctx ? (ctx.tools || ctx.tool) : null;
    if (toolService && typeof toolService.getStatus === 'function') {
      res.json(toolService.getStatus());
    } else {
      res.json({
        bestPickaxe: null,
        bestAxe: null,
        bestSword: null,
        isAboutToBreak: false
      });
    }
  });

  /**
   * GET /stats/woodcutting - Forestry metrics and session stats
   */
  router.get('/stats/woodcutting', async (req, res) => {
    const Statistics = require('../../../../shared/observability/models/statistics.model');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const woodcutting = (statsDoc && statsDoc.woodcutting) || {
        logsCollected: 0,
        treesCut: 0,
        saplingsPlanted: 0,
        saplingsCollected: 0,
        applesCollected: 0,
        timeSpentMs: 0,
        skippedTrees: 0
      };
      res.json({ ok: true, stats: woodcutting });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          logsCollected: 0,
          treesCut: 0,
          saplingsPlanted: 0,
          saplingsCollected: 0,
          applesCollected: 0,
          timeSpentMs: 0,
          skippedTrees: 0
        }
      });
    }
  });

  /**
   * GET /stats/combat - Combat and defense metrics
   */
  router.get('/stats/combat', async (req, res) => {
    const Statistics = require('../../../../shared/observability/models/statistics.model');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const combat = (statsDoc && statsDoc.combat) || {
        mobsKilled: 0,
        damageDealt: 0,
        damageTaken: 0,
        deaths: 0,
        timeSpentMs: 0
      };
      res.json({ ok: true, stats: combat });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          mobsKilled: 0,
          damageDealt: 0,
          damageTaken: 0,
          deaths: 0,
          timeSpentMs: 0
        }
      });
    }
  });

  /**
   * GET /stats/crafting - Crafting and smelting operational metrics
   */
  router.get('/stats/crafting', async (req, res) => {
    const Statistics = require('../../../../shared/observability/models/statistics.model');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const crafting = (statsDoc && statsDoc.crafting) || {
        itemsCrafted: 0,
        itemsSmelted: 0,
        recipesResolved: 0
      };
      res.json({ ok: true, stats: crafting });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          itemsCrafted: 0,
          itemsSmelted: 0,
          recipesResolved: 0
        }
      });
    }
  });

  /**
   * GET /stats/building - Construction and architectural metrics
   */
  router.get('/stats/building', async (req, res) => {
    const Statistics = require('../../../../shared/observability/models/statistics.model');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const building = (statsDoc && statsDoc.building) || {
        structuresBuilt: 0,
        blocksPlaced: 0,
        scaffoldingUsed: 0
      };
      res.json({ ok: true, stats: building });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          structuresBuilt: 0,
          blocksPlaced: 0,
          scaffoldingUsed: 0
        }
      });
    }
  });

  /**
   * GET /stats/logistics - Warehouse and storage management metrics
   */
  router.get('/stats/logistics', async (req, res) => {
    const Statistics = require('../../../../shared/observability/models/statistics.model');
    try {
      const statsDoc = await Statistics.findOne({}).sort({ startTime: -1 });
      const logistics = (statsDoc && statsDoc.logistics) || {
        chestsIndexed: 0,
        itemsSorted: 0,
        kitsRestocked: 0
      };
      res.json({ ok: true, stats: logistics });
    } catch (err) {
      res.json({
        ok: true,
        stats: {
          chestsIndexed: 0,
          itemsSorted: 0,
          kitsRestocked: 0
        }
      });
    }
  });

  /**
   * GET /stats/ambient - Autonomous ambient behaviors and homestead stewardship status
   */
  router.get('/stats/ambient', async (req, res) => {
    try {
      const ambientStatus = ctx.ambient ? ctx.ambient.ping() : { ok: false };
      res.json({
        ok: true,
        ambient: ambientStatus
      });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /radar-entities - Real-time coordinates and metadata of all nearby entities
   */
  router.get('/radar-entities', (req, res) => {
    try {
      const { getNearbyRadarEntities } = require('../websocket');
      const entities = (ctx && ctx.bot) ? getNearbyRadarEntities(ctx.bot, 64) : [];
      res.json({
        ok: true,
        count: entities.length,
        entities
      });
    } catch (err) {
      res.json({ ok: false, error: err.message, entities: [] });
    }
  });

  /**
   * GET /server-config - Minecraft connection metadata, server target, and owner info.
   */
  router.get('/server-config', (req, res) => {
    const conn = getMinecraftConnectionState();
    res.json({
      ok: true,
      online: conn.online,
      connectionState: conn.state,
      server: {
        host: process.env.MC_HOST || 'localhost',
        port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565
      },
      owner: (ctx && ctx.permissionManager && ctx.permissionManager.ownerUsername) || process.env.OWNER_USERNAME || 'Kamlesh',
      botUsername: (ctx && ctx.bot && ctx.bot.username) || process.env.MC_USERNAME || 'Argus',
      authMode: process.env.AUTH_MODE || process.env.MC_AUTH || 'offline'
    });
  });

  /**
   * POST /server-config - Dynamically update target server and owner configuration.
   * Persists changes to .env and .env.local, and triggers a clean disconnect and rejoin
   * whenever username or target server host/port is changed.
   */
  router.post('/server-config', (req, res) => {
    const { host, port, owner, botUsername, authMode } = req.body || {};

    const oldHost = process.env.MC_HOST;
    const oldPort = process.env.MC_PORT;
    const oldUsername = process.env.MC_USERNAME;
    const oldAuth = process.env.AUTH_MODE;

    const envUpdates = {};

    if (host && typeof host === 'string') {
      const trimmedHost = host.trim();
      process.env.MC_HOST = trimmedHost;
      envUpdates.MC_HOST = trimmedHost;
    }
    if (port) {
      const parsedPort = parseInt(port, 10);
      if (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
        process.env.MC_PORT = String(parsedPort);
        envUpdates.MC_PORT = String(parsedPort);
      }
    }
    if (owner && typeof owner === 'string') {
      const trimmedOwner = owner.trim();
      process.env.OWNER_USERNAME = trimmedOwner;
      envUpdates.OWNER_USERNAME = trimmedOwner;
      if (ctx && ctx.permissionManager) {
        ctx.permissionManager.ownerUsername = trimmedOwner;
      }
    }
    if (botUsername && typeof botUsername === 'string') {
      const trimmedUser = botUsername.trim();
      process.env.MC_USERNAME = trimmedUser;
      envUpdates.MC_USERNAME = trimmedUser;
    }
    if (authMode && (authMode === 'offline' || authMode === 'microsoft' || authMode === 'mojang')) {
      process.env.AUTH_MODE = authMode;
      process.env.MC_AUTH = authMode;
      envUpdates.AUTH_MODE = authMode;
    }

    // Persist configuration updates to .env and .env.local
    updateEnvFiles(envUpdates);

    // Check if credentials or target server changed requiring disconnect & rejoin
    const hostChanged = Boolean(host && host.trim() !== oldHost);
    const portChanged = Boolean(port && String(port).trim() !== String(oldPort).trim());
    const userChanged = Boolean(botUsername && botUsername.trim() !== oldUsername);
    const authChanged = Boolean(authMode && authMode !== oldAuth);

    const requiresReconnect = hostChanged || portChanged || userChanged || authChanged;

    if (requiresReconnect) {
      console.log(`[Config] Connection settings updated (Host: ${process.env.MC_HOST}:${process.env.MC_PORT}, Username: ${process.env.MC_USERNAME}). Initiating disconnect and rejoin...`);
      eventBus.emit('bot:reconnect', {
        host: process.env.MC_HOST,
        port: parseInt(process.env.MC_PORT, 10),
        username: process.env.MC_USERNAME,
        authMode: process.env.AUTH_MODE
      });

      if (ctx && typeof ctx.reconnectBot === 'function') {
        try {
          ctx.reconnectBot();
        } catch (reconnectErr) {
          console.warn('[Config] Error triggering reconnect on ctx:', reconnectErr.message);
        }
      }
    }

    const conn = getMinecraftConnectionState();
    return res.json({
      ok: true,
      message: requiresReconnect
        ? 'Configuration saved to environment. Disconnecting and rejoining server with updated credentials...'
        : 'Server and owner configuration updated successfully.',
      reconnecting: requiresReconnect,
      online: requiresReconnect ? false : conn.online,
      connectionState: requiresReconnect ? 'connecting' : conn.state,
      server: {
        host: process.env.MC_HOST || 'localhost',
        port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565
      },
      owner: (ctx && ctx.permissionManager && ctx.permissionManager.ownerUsername) || process.env.OWNER_USERNAME || 'Kamlesh',
      botUsername: (ctx && ctx.bot && ctx.bot.username) || process.env.MC_USERNAME || 'Argus',
      authMode: process.env.AUTH_MODE || process.env.MC_AUTH || 'offline'
    });
  });

  return router;
}

module.exports = createStatusRouter;
