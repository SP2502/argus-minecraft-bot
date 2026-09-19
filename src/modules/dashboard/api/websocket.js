const { WebSocketServer, WebSocket } = require('ws');
const eventBus = require('../../../core/EventBus');
const persistenceManager = require('../../../shared/persistence/persistence-manager');
const authManager = require('../../../core/AuthManager');
const { verifySessionToken } = require('../session-auth');

/**
 * Broadcasts a JSON message payload to all actively connected WebSocket clients.
 * @param {WebSocketServer} wss - WebSocket server instance
 * @param {Object} payload - Message object to serialize and send
 */
function broadcast(wss, payload) {
  if (!wss || !wss.clients) return;
  const msgStr = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msgStr);
    }
  });
}

/**
 * Extracts radar entity telemetry from a Mineflayer bot instance.
 * @param {import('mineflayer').Bot} bot - Bot instance
 * @param {number} [maxDistance=64] - Radius in meters
 * @returns {Array<Object>} List of nearby entities with coordinates and metadata
 */
function getNearbyRadarEntities(bot, maxDistance = 64) {
  if (!bot || !bot.entity || !bot.entities) return [];
  const botPos = bot.entity.position;
  const results = [];
  const hostileNames = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'slime',
    'phantom', 'drowned', 'husk', 'stray', 'pillager', 'vindicator', 'ravager',
    'evoker', 'vex', 'warden', 'piglin_brute', 'blaze', 'ghast', 'magma_cube',
    'wither_skeleton', 'wither', 'ender_dragon', 'silverfish', 'endermite',
    'cave_spider', 'shulker', 'guardian', 'elder_guardian', 'zoglin', 'breeze', 'bogged'
  ]);

  for (const id in bot.entities) {
    const entity = bot.entities[id];
    if (!entity || entity === bot.entity || !entity.position) continue;

    const dx = entity.position.x - botPos.x;
    const dy = entity.position.y - botPos.y;
    const dz = entity.position.z - botPos.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    if (distSq > maxDistance * maxDistance) continue;
    const dist = Math.sqrt(distSq);

    const rawName = entity.name || entity.username || entity.displayName || (entity.type === 'player' ? 'Player' : 'Mob');
    const entityType = entity.type || 'mob';
    const isPlayer = entityType === 'player' || Boolean(entity.username);
    const isHostile = hostileNames.has((rawName || '').toLowerCase()) || entity.isHostile === true;

    results.push({
      id: entity.id,
      name: entity.username || rawName,
      type: isPlayer ? 'player' : (isHostile ? 'hostile' : 'passive'),
      isHostile,
      x: Math.round(entity.position.x * 10) / 10,
      y: Math.round(entity.position.y * 10) / 10,
      z: Math.round(entity.position.z * 10) / 10,
      relX: Math.round(dx * 10) / 10,
      relY: Math.round(dy * 10) / 10,
      relZ: Math.round(dz * 10) / 10,
      distance: Math.round(dist * 10) / 10
    });
  }

  results.sort((a, b) => a.distance - b.distance);
  return results.slice(0, 50);
}

/**
 * Attaches a WebSocket server to an HTTP server instance and coordinates telemetry streaming.
 * @param {import('http').Server} httpServer - Node HTTP server instance
 * @param {import('../core/BotContext')} [ctx] - BotContext reference
 * @returns {WebSocketServer}
 */
function setupWebSocketServer(httpServer, ctx) {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const session = verifySessionToken(requestUrl.searchParams.get('token'));
    if (!session) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, session));
  });

  wss.on('error', (err) => {
    console.warn('[WebSocketServer] WSS error:', err.message);
  });

  // 1. Client connection handler
  wss.on('connection', (ws, req, session) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[WebSocket] Dashboard client connected from ${clientIp}`);

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send initial snapshot package: status, platform info, auth status, inventory
    const initialStatus = ctx && typeof ctx.getStatus === 'function' ? ctx.getStatus() : {};
    const platformInfo = persistenceManager.getPlatformInfo();
    const authStatus = authManager.getAuthStatus();

    ws.send(JSON.stringify({
      type: 'init',
      data: initialStatus,
      platform: platformInfo,
      auth: authStatus
    }));

    ws.send(JSON.stringify({
      type: 'platform.info',
      data: platformInfo
    }));

    ws.send(JSON.stringify({
      type: 'auth.status',
      data: authStatus
    }));

    // Send inventory snapshot if bot inventory is populated
    if (ctx && ctx.bot && ctx.bot.inventory) {
      const slots = ctx.bot.inventory.items().map((item) => ({
        slot: item.slot,
        name: item.name,
        count: item.count,
        durability: ctx.tools ? ctx.tools.getDurabilityPercent(item) : 100
      }));
      ws.send(JSON.stringify({ type: 'inventory.changed', data: { slots } }));
    }

    // Process incoming client commands (e.g. Dashboard Console input)
    const DashboardCommandAdapter = require('../../commands/adapters/DashboardCommandAdapter');
    const dashboardAdapter = new DashboardCommandAdapter(ctx);

    ws.on('message', async (message) => {
      try {
        const parsed = JSON.parse(message.toString());

        if (parsed.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if ((parsed.type === 'dashboard.command' || parsed.type === 'chat.command') && parsed.message) {
          await dashboardAdapter.handleCommand(ws, parsed, session);
        }
      } catch (err) {
        console.warn('[WebSocket] Error processing client message:', err.message);
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Dashboard client disconnected (${clientIp})`);
    });

    ws.on('error', (err) => {
      console.error(`[WebSocket] Client socket error:`, err.message);
    });
  });

  // 2. Wire EventBus subscriptions to WebSocket broadcasts
  eventBus.on('bot:health', (data) => {
    broadcast(wss, { type: 'bot.health.change', data });
  });

  eventBus.on('task.queued', (data) => {
    broadcast(wss, { type: 'task.queued', data });
  });

  eventBus.on('task.started', (data) => {
    broadcast(wss, { type: 'task.started', data });
  });

  eventBus.on('task.completed', (data) => {
    broadcast(wss, { type: 'task.completed', data });
  });

  eventBus.on('task.suspended', (data) => {
    broadcast(wss, { type: 'task.suspended', data });
  });

  eventBus.on('task.failed', (data) => {
    broadcast(wss, { type: 'task.failed', data });
  });

  eventBus.on('task.paused', (data) => {
    broadcast(wss, { type: 'log.entry', data: { severity: 'WARN', category: 'TASK', message: `Task paused: ${data.reason}` } });
  });

  eventBus.on('mining.block_mined', (data) => {
    broadcast(wss, { type: 'log.entry', data: { severity: 'INFO', category: 'MINE', message: `Mined ${data.block} (${data.mined}/${data.total})` } });
  });

  eventBus.on('farming.crop_harvested', (data) => {
    broadcast(wss, { type: 'farming.crop_harvested', data });
  });

  // Forestry Events
  eventBus.on('forestry.started', (data) => {
    broadcast(wss, { type: 'forestry.started', data });
  });

  eventBus.on('forestry.log_cut', (data) => {
    broadcast(wss, { type: 'forestry.log_cut', data });
  });

  eventBus.on('forestry.tree_completed', (data) => {
    broadcast(wss, { type: 'forestry.tree_completed', data });
  });

  eventBus.on('forestry.replanted', (data) => {
    broadcast(wss, { type: 'forestry.replanted', data });
  });

  eventBus.on('forestry.skipped', (data) => {
    broadcast(wss, { type: 'forestry.skipped', data });
  });

  eventBus.on('forestry.completed', (data) => {
    broadcast(wss, { type: 'forestry.completed', data });
  });

  // Combat & Defense Events
  eventBus.on('combat.started', (data) => {
    broadcast(wss, { type: 'combat.started', data });
  });

  eventBus.on('combat.engaged', (data) => {
    broadcast(wss, { type: 'combat.engaged', data });
  });

  eventBus.on('combat.hit', (data) => {
    broadcast(wss, { type: 'combat.hit', data });
  });

  eventBus.on('combat.mob_killed', (data) => {
    broadcast(wss, { type: 'combat.mob_killed', data });
  });

  eventBus.on('combat.retreat', (data) => {
    broadcast(wss, { type: 'combat.retreat', data });
  });

  eventBus.on('combat.completed', (data) => {
    broadcast(wss, { type: 'combat.completed', data });
  });

  // Crafting & Smelting Events
  eventBus.on('crafting.started', (data) => {
    broadcast(wss, { type: 'crafting.started', data });
  });

  eventBus.on('crafting.item_crafted', (data) => {
    broadcast(wss, { type: 'crafting.item_crafted', data });
  });

  eventBus.on('smelting.started', (data) => {
    broadcast(wss, { type: 'smelting.started', data });
  });

  eventBus.on('smelting.item_smelted', (data) => {
    broadcast(wss, { type: 'smelting.item_smelted', data });
  });

  eventBus.on('crafting.completed', (data) => {
    broadcast(wss, { type: 'crafting.completed', data });
  });

  // Building Events
  eventBus.on('building.started', (data) => {
    broadcast(wss, { type: 'building.started', data });
  });

  eventBus.on('building.block_placed', (data) => {
    broadcast(wss, { type: 'building.block_placed', data });
  });

  eventBus.on('building.completed', (data) => {
    broadcast(wss, { type: 'building.completed', data });
  });

  // Logistics Events
  eventBus.on('logistics.started', (data) => {
    broadcast(wss, { type: 'logistics.started', data });
  });

  eventBus.on('logistics.chest_indexed', (data) => {
    broadcast(wss, { type: 'logistics.chest_indexed', data });
  });

  eventBus.on('logistics.item_transferred', (data) => {
    broadcast(wss, { type: 'logistics.item_transferred', data });
  });

  eventBus.on('logistics.completed', (data) => {
    broadcast(wss, { type: 'logistics.completed', data });
  });

  // Ambient & Homestead Events
  eventBus.on('ambient.sleep', (data) => {
    broadcast(wss, { type: 'ambient.sleep', data });
  });

  eventBus.on('ambient.wake', (data) => {
    broadcast(wss, { type: 'ambient.wake', data });
  });

  eventBus.on('ambient.ate', (data) => {
    broadcast(wss, { type: 'ambient.ate', data });
  });

  eventBus.on('ambient.toggled', (data) => {
    broadcast(wss, { type: 'ambient.toggled', data });
  });

  eventBus.on('ai.heartbeat', (data) => {
    broadcast(wss, { type: 'ai.heartbeat', data });
  });

  eventBus.on('ai.tick_rate_changed', (data) => {
    broadcast(wss, { type: 'ai.tick_rate_changed', data });
  });

  eventBus.on('module.unhealthy', (data) => {
    broadcast(wss, { type: 'module.unhealthy', data });
  });

  eventBus.on('log:entry', (entry) => {
    broadcast(wss, { type: 'log.entry', data: entry });
  });

  // 3. Periodic Position & Radar Entities Broadcast (Throttled to 1 FPS / 1000ms)
  let lastPosBroadcast = 0;
  const positionInterval = setInterval(() => {
    const now = Date.now();
    if (ctx && ctx.bot && ctx.bot.entity && (now - lastPosBroadcast >= 1000)) {
      const pos = ctx.bot.entity.position;
      const yaw = ctx.bot.entity.yaw || 0;
      broadcast(wss, {
        type: 'bot.position.update',
        data: {
          x: Math.round(pos.x * 10) / 10,
          y: Math.round(pos.y * 10) / 10,
          z: Math.round(pos.z * 10) / 10,
          yaw: Math.round(yaw * 100) / 100,
          dimension: (ctx.bot.game && ctx.bot.game.dimension) || 'overworld'
        }
      });

      const radarEntities = getNearbyRadarEntities(ctx.bot);
      broadcast(wss, {
        type: 'radar.entities',
        data: { entities: radarEntities }
      });

      lastPosBroadcast = now;
    }
  }, 1000);

  // 4. Periodic Inventory Broadcast (Every 3 seconds)
  const invInterval = setInterval(() => {
    if (ctx && ctx.bot && ctx.bot.inventory) {
      const slots = ctx.bot.inventory.items().map((item) => ({
        slot: item.slot,
        name: item.name,
        count: item.count,
        durability: ctx.tools ? ctx.tools.getDurabilityPercent(item) : 100
      }));
      broadcast(wss, { type: 'inventory.changed', data: { slots } });
    }
  }, 3000);

  // 5. Heartbeat Interval (30s)
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();

      if (ctx && typeof ctx.getStatus === 'function' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now(), status: ctx.getStatus() }));
      }
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(positionInterval);
    clearInterval(invInterval);
    clearInterval(heartbeatInterval);
  });

  return wss;
}

module.exports = {
  setupWebSocketServer,
  broadcast,
  getNearbyRadarEntities
};
