#!/usr/bin/env node
/**
 * ARGUS Dashboard Preview Launcher
 * 
 * Starts an explicit, isolated local development preview of the ARGUS operations dashboard
 * without requiring a live Minecraft server, Aternos session, MongoDB instance, or production credentials.
 * Binds strictly to localhost (127.0.0.1) with simulated BotContext telemetry and local command handling.
 */

// Configure environment defaults for preview mode before loading any modules
process.env.ARGUS_MODE = 'preview';
process.env.ARGUS_PREVIEW = 'true';
process.env.PORT = process.env.PORT || '3000';
process.env.HOST = '127.0.0.1';
process.env.DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'preview-password-2026';
process.env.DASHBOARD_SESSION_SECRET = process.env.DASHBOARD_SESSION_SECRET || 'preview-session-secret-at-least-32-chars-long';
process.env.OWNER_USERNAME = process.env.OWNER_USERNAME || 'Kamlesh';
process.env.MC_HOST = process.env.MC_HOST || 'localhost';
process.env.MC_PORT = process.env.MC_PORT || '25565';
process.env.MC_USERNAME = process.env.MC_USERNAME || 'Argus';
process.env.AUTH_MODE = process.env.AUTH_MODE || 'offline';

const path = require('path');
const eventBus = require('../src/core/EventBus');
const { startServer } = require('../src/modules/dashboard/api/server');

// Simulated state for preview session
const previewState = {
  connectionState: 'connected', // 'connected' | 'reconnecting' | 'disconnected'
  disconnectReason: null,
  health: 18,
  food: 16,
  oxygen: 20,
  position: { x: 124.5, y: 64.0, z: -340.2 },
  yaw: 1.57,
  pitch: 0.1,
  dimension: 'overworld',
  activeTask: {
    id: 'task-prev-01',
    name: 'mine 16 iron_ore',
    type: 'mining',
    status: 'running',
    progress: 68,
    step: 'Digging vein at Y=14',
    source: 'Web Console',
    priority: 'Normal (50)',
    locks: ['movement', 'inventory'],
    startTime: Date.now() - 45000
  },
  queue: [
    { id: 'task-prev-02', name: 'deposit iron in base chest', type: 'inventory', status: 'queued', priority: 'Normal (50)', source: 'Scheduler' },
    { id: 'task-prev-03', name: 'patrol base perimeter', type: 'patrol', status: 'queued', priority: 'Low (20)', source: 'Heartbeat' }
  ],
  isPaused: false,
  commandAudit: [
    { id: 'cmd-prev-02', message: 'mine 16 iron_ore', senderId: 'Kamlesh', status: 'running', timestamp: new Date(Date.now() - 45000).toISOString() },
    { id: 'cmd-prev-01', message: 'status', senderId: 'Kamlesh', status: 'completed', timestamp: new Date(Date.now() - 120000).toISOString() }
  ]
};

// Create simulated BotContext matching real bot interfaces
const mockCtx = {
  preview: true,
  isPreview: true,
  bot: {
    _client: {
      get state() {
        return previewState.connectionState === 'connected' ? 'play' : 'handshaking';
      },
      get ended() {
        return previewState.connectionState === 'disconnected';
      }
    },
    username: process.env.MC_USERNAME,
    get health() { return previewState.health; },
    get food() { return previewState.food; },
    get oxygenLevel() { return previewState.oxygen; },
    entity: {
      get position() { return previewState.position; },
      get yaw() { return previewState.yaw; },
      get pitch() { return previewState.pitch; }
    },
    entities: {
      '101': { id: 101, type: 'player', username: 'Alex_Mining', position: { x: 130.2, y: 64, z: -334.8 } },
      '202': { id: 202, type: 'mob', name: 'zombie', isHostile: true, position: { x: 142.0, y: 63, z: -358.5 } },
      '303': { id: 303, type: 'mob', name: 'cow', isHostile: false, position: { x: 118.0, y: 65, z: -328.0 } }
    },
    inventory: {
      items: () => [
        { slot: 36, name: 'diamond_pickaxe', count: 1 },
        { slot: 37, name: 'iron_sword', count: 1 },
        { slot: 38, name: 'cooked_beef', count: 24 },
        { slot: 39, name: 'iron_ingot', count: 16 },
        { slot: 40, name: 'torch', count: 64 },
        { slot: 41, name: 'cobblestone', count: 64 },
        { slot: 42, name: 'cobblestone', count: 64 }
      ]
    }
  },
  permissionManager: {
    ownerUsername: process.env.OWNER_USERNAME
  },
  tools: {
    getDurabilityPercent: (item) => (item.name && item.name.includes('diamond') ? 85 : 92),
    getStatus: () => ({
      bestPickaxe: 'diamond_pickaxe (85%)',
      bestAxe: 'iron_axe (92%)',
      bestSword: 'diamond_sword (95%)',
      isAboutToBreak: false
    })
  },
  nav: {
    getNavStatus: () => ({
      isFollowing: false,
      isStuck: false,
      currentGoal: { x: 140, y: 64, z: -320 },
      distanceRemaining: 18.2
    })
  },
  inv: {
    getStatus: () => ({
      usedSlots: 14,
      totalSlots: 36,
      isFull: false,
      topValueItems: [
        { name: 'diamond_pickaxe', count: 1 },
        { name: 'iron_ingot', count: 16 },
        { name: 'cooked_beef', count: 24 }
      ]
    })
  },
  safety: {
    getStatus: () => ({
      isCritical: previewState.health <= 6,
      isLowHealth: previewState.health <= 10,
      isLowHunger: previewState.food <= 6,
      isNearLava: false,
      isNight: false,
      shouldRetreat: previewState.health <= 6,
      status: previewState.health <= 6 ? 'CRITICAL' : 'Normal'
    })
  },
  taskManager: {
    getQueueSnapshot: () => ({
      activeTask: previewState.activeTask,
      queue: previewState.queue,
      isPaused: previewState.isPaused
    })
  },
  getStatus: () => ({
    status: previewState.connectionState === 'connected' ? 'active' : 'idle',
    uptime: process.uptime(),
    preview: true,
    isPreview: true,
    mode: 'preview',
    disconnectReason: previewState.disconnectReason,
    vitals: {
      health: previewState.health,
      maxHealth: 20,
      food: previewState.food,
      oxygen: previewState.oxygen
    },
    spatial: {
      dimension: previewState.dimension,
      position: previewState.position,
      yaw: previewState.yaw,
      pitch: previewState.pitch,
      headingCardinal: 'E'
    },
    connectionState: previewState.connectionState,
    server: {
      host: process.env.MC_HOST,
      port: parseInt(process.env.MC_PORT, 10)
    },
    owner: process.env.OWNER_USERNAME,
    botUsername: process.env.MC_USERNAME,
    authMode: process.env.AUTH_MODE
  }),
  getCommandHistory: () => previewState.commandAudit,
  commandGateway: {
    execute: async (request) => {
      const msg = (request.message || '').trim();
      const sender = request.senderId || process.env.OWNER_USERNAME;
      const lower = msg.toLowerCase();

      // Help
      if (lower === 'help') {
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: true,
          status: 'completed',
          message: 'ARGUS Preview Directives: "status", "mine <amount> <ore>", "chop <amount> <wood>", "stop", "pause", "resume", "drop all" (requires confirmation), "simulate disconnect", "simulate connect", "simulate lowhealth", "simulate heal".'
        };
      }

      // Status
      if (lower === 'status') {
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: true,
          status: 'completed',
          message: `Argus [Preview Data] - Status: ${previewState.connectionState.toUpperCase()}, Health: ${previewState.health}/20, Hunger: ${previewState.food}/20, Pos: (${previewState.position.x}, ${previewState.position.y}, ${previewState.position.z}).`
        };
      }

      // Stop
      if (lower === 'stop') {
        previewState.activeTask = null;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        eventBus.emit('task:cancelled', { reason: 'User requested stop via Preview Command Deck' });
        return {
          ok: true,
          status: 'completed',
          message: 'Active directive halted. Bot is idle.'
        };
      }

      // Pause / Resume
      if (lower === 'pause') {
        previewState.isPaused = true;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Task queue paused.' };
      }
      if (lower === 'resume') {
        previewState.isPaused = false;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Task queue resumed.' };
      }

      // Destructive Confirmation Flow (drop all / reset)
      if (lower === 'drop all' || lower === 'reset' || lower === 'destroy') {
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'confirmation_required', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: true,
          status: 'confirmation_required',
          requiresConfirmation: true,
          confirmationWord: 'CONFIRM',
          message: `Confirmation required: "${msg}" is a destructive action. Confirm with "confirm ${msg}" to proceed.`
        };
      }

      if (lower === 'confirm drop all' || lower === 'confirm reset') {
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: true,
          status: 'completed',
          message: 'Confirmed: Dropped all inventory items.'
        };
      }

      // Simulation commands for preview testing
      if (lower === 'simulate disconnect') {
        previewState.connectionState = 'disconnected';
        previewState.disconnectReason = 'Connection closed by remote host (timed out)';
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Simulated Minecraft disconnect. State is now DISCONNECTED.' };
      }

      if (lower === 'simulate connect') {
        previewState.connectionState = 'connected';
        previewState.disconnectReason = null;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Simulated Minecraft connection established. State is now CONNECTED.' };
      }

      if (lower === 'simulate lowhealth') {
        previewState.health = 4;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Simulated hazard state: Health set to 4.0 HP (CRITICAL).' };
      }

      if (lower === 'simulate heal') {
        previewState.health = 20;
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'completed', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return { ok: true, status: 'completed', message: 'Simulated recovery: Health restored to 20.0 HP.' };
      }

      // Denied / unauthorized preview test
      if (lower === 'deny' || lower === 'op') {
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'denied', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: false,
          status: 'denied',
          message: 'Permission denied: Command restricted to bot owner.'
        };
      }

      // Autonomous Tasks (mine, chop, patrol, craft)
      if (lower.startsWith('mine') || lower.startsWith('chop') || lower.startsWith('craft') || lower.startsWith('patrol')) {
        const newTaskId = `task-prev-${Date.now()}`;
        previewState.activeTask = {
          id: newTaskId,
          name: msg,
          type: lower.startsWith('mine') ? 'mining' : lower.startsWith('chop') ? 'forestry' : 'navigation',
          status: 'running',
          progress: 5,
          step: `Initializing autonomous plan for "${msg}"`,
          source: 'Preview Web Console',
          priority: 'Normal (50)',
          locks: ['movement', 'inventory'],
          startTime: Date.now()
        };
        const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'running', timestamp: new Date().toISOString() };
        previewState.commandAudit.unshift(audit);
        return {
          ok: true,
          status: 'running',
          taskId: newTaskId,
          message: `Dispatched preview directive: "${msg}". Autonomous agent executing.`
        };
      }

      // Fallback unsupported
      const audit = { id: `cmd-prev-${Date.now()}`, message: msg, senderId: sender, status: 'unsupported', timestamp: new Date().toISOString() };
      previewState.commandAudit.unshift(audit);
      return {
        ok: false,
        status: 'unsupported',
        message: `Command "${msg}" is unsupported or unknown in preview mode. Type "help" for supported preview directives.`
      };
    }
  }
};

/**
 * Main launcher function
 */
async function main() {
  const port = parseInt(process.env.PORT, 10) || 3000;
  const host = process.env.HOST || '127.0.0.1';

  console.log('===============================================================');
  console.log('  ARGUS MINECRAFT BOT - LOCAL DASHBOARD PREVIEW MODE           ');
  console.log('===============================================================');
  console.log(`  Preview Host:       http://${host}:${port}`);
  console.log(`  Environment:        Preview (No Minecraft / DB required)`);
  console.log(`  Default Password:   ${process.env.DASHBOARD_PASSWORD}`);
  console.log(`  Configured Owner:   ${process.env.OWNER_USERNAME}`);
  console.log('---------------------------------------------------------------');
  console.log('  Starting Express API and WebSocket preview server on localhost...');

  const { app, server, wss } = startServer(mockCtx, port, host);

  // Periodic telemetry drift to simulate subtle real-time updates in preview
  const telemetryInterval = setInterval(() => {
    // Subtle coordinate drift
    previewState.position.x = Math.round((124.5 + (Math.sin(Date.now() / 10000) * 1.5)) * 10) / 10;
    previewState.position.z = Math.round((-340.2 + (Math.cos(Date.now() / 10000) * 1.5)) * 10) / 10;

    // Advance active task progress if running
    if (previewState.activeTask && previewState.activeTask.status === 'running') {
      previewState.activeTask.progress = (previewState.activeTask.progress + 2) % 100;
    }

    // Broadcast heartbeat via websocket
    if (wss && wss.clients) {
      const payload = JSON.stringify({
        type: 'bot.telemetry',
        data: mockCtx.getStatus()
      });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          try { client.send(payload); } catch (e) {}
        }
      });
    }
  }, 2000);

  function shutdown(signal) {
    console.log(`\n[Preview] Received ${signal}. Shutting down preview dashboard server...`);
    clearInterval(telemetryInterval);
    if (wss && wss.clients) {
      for (const client of wss.clients) {
        try { client.terminate(); } catch (e) {}
      }
      wss.close();
    }
    server.close(() => {
      console.log('[Preview] Preview server terminated successfully.');
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[Preview] Fatal error starting dashboard preview:', err);
  process.exit(1);
});
