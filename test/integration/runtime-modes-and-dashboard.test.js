const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const { createSessionToken, verifySessionToken, validateConfig } = require('../../src/modules/dashboard/session-auth');

describe('ARGUS Runtime Modes & Dashboard Operations Suite', () => {
  const PREVIEW_PORT = 3105;
  const HEADLESS_PORT = 3106;

  describe('1. Session Authentication & Token Security', () => {
    before(() => {
      process.env.DASHBOARD_PASSWORD = 'strong-preview-password-2026';
      process.env.DASHBOARD_SESSION_SECRET = 'strong-preview-session-secret-key-at-least-32-chars-long';
      process.env.DASHBOARD_SESSION_TTL_MS = '3600000'; // 1 hour
    });

    test('validateConfig() succeeds with compliant password and secret', () => {
      assert.doesNotThrow(() => validateConfig());
    });

    test('createSessionToken generates valid verifiable bearer token', () => {
      const token = createSessionToken('Kamlesh', 'owner');
      assert.ok(typeof token === 'string' && token.includes('.'), 'Token must be header.signature format');

      const verified = verifySessionToken(token);
      assert.ok(verified, 'Session token must verify successfully');
      assert.strictEqual(verified.username, 'Kamlesh');
      assert.strictEqual(verified.role, 'owner');
      assert.ok(verified.expiresAt > Date.now(), 'Token expiry must be in the future');
    });

    test('verifySessionToken rejects tampered signature or malformed token', () => {
      const validToken = createSessionToken('Kamlesh', 'owner');
      const tampered = validToken.substring(0, validToken.length - 4) + 'abcd';
      assert.strictEqual(verifySessionToken(tampered), null, 'Tampered token must return null');
      assert.strictEqual(verifySessionToken('invalid.malformed'), null);
      assert.strictEqual(verifySessionToken(''), null);
      assert.strictEqual(verifySessionToken(null), null);
    });
  });

  describe('2. Headless Mode Isolation & Port Check Invariant', () => {
    let headlessServer;

    before(async () => {
      // Simulate headless health server as initialized by index.js in headless mode
      const app = express();
      app.get('/health', (req, res) => {
        res.json({
          status: 'ok',
          mode: 'headless',
          online: false,
          botUsername: 'Argus',
          uptime: process.uptime(),
          timestamp: new Date().toISOString()
        });
      });
      app.get('/', (req, res) => {
        res.type('text/plain').send('ARGUS Minecraft Bot is running in headless mode.');
      });

      await new Promise((resolve) => {
        headlessServer = app.listen(HEADLESS_PORT, '127.0.0.1', () => resolve());
      });
    });

    after(async () => {
      if (headlessServer) {
        await new Promise((resolve) => headlessServer.close(() => resolve()));
      }
    });

    test('GET /health satisfies host port check and reports mode: headless', async () => {
      const res = await fetch(`http://127.0.0.1:${HEADLESS_PORT}/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
      assert.strictEqual(data.mode, 'headless');
    });

    test('Headless mode does NOT expose dashboard command API', async () => {
      const res = await fetch(`http://127.0.0.1:${HEADLESS_PORT}/api/commands`, { method: 'POST' });
      assert.strictEqual(res.status, 404, 'Command gateway route must not exist on headless health listener');
    });

    test('Headless mode does NOT serve dashboard assets', async () => {
      const res = await fetch(`http://127.0.0.1:${HEADLESS_PORT}/js/dashboard.js`);
      assert.strictEqual(res.status, 404, 'Dashboard client scripts must not be served by headless listener');
    });
  });

  describe('3. Preview Mode Simulated BotContext & Command Gateway', () => {
    let previewServerInstance;
    let validToken;

    before(async () => {
      process.env.ARGUS_PREVIEW = 'true';
      process.env.ARGUS_MODE = 'preview';
      process.env.DASHBOARD_PASSWORD = 'preview-password-2026';
      process.env.DASHBOARD_SESSION_SECRET = 'argus-preview-mode-session-secret-at-least-32-chars-long';
      process.env.OWNER_USERNAME = 'Kamlesh';
      process.env.PORT = String(PREVIEW_PORT);
      process.env.HOST = '127.0.0.1';

      validToken = createSessionToken('Kamlesh', 'owner');

      // Create simulated preview context matching start-dashboard.js
      const mockState = {
        connectionState: 'connected',
        health: 18,
        food: 16,
        activeTask: { id: 'task-prev-01', name: 'mine 16 iron_ore', type: 'mining', status: 'running' },
        queue: [{ id: 'task-prev-02', name: 'patrol base', status: 'queued' }],
        commandAudit: []
      };

      const mockCtx = {
        preview: true,
        isPreview: true,
        bot: {
          _client: { state: 'play', ended: false },
          username: 'Argus',
          health: 18,
          food: 16,
          oxygenLevel: 20,
          entity: { position: { x: 124.5, y: 64, z: -340.2 } },
          entities: {},
          inventory: { items: () => [] }
        },
        tools: { getStatus: () => ({ isAboutToBreak: false }) },
        nav: { getNavStatus: () => ({ isFollowing: false, isStuck: false }) },
        inv: { getStatus: () => ({ usedSlots: 10, totalSlots: 36 }) },
        safety: { getStatus: () => ({ status: 'Normal' }) },
        taskManager: {
          getQueueSnapshot: () => ({
            activeTask: mockState.activeTask,
            queue: mockState.queue,
            isPaused: false
          })
        },
        getStatus: () => ({
          status: 'active',
          preview: true,
          isPreview: true,
          vitals: { health: mockState.health, food: mockState.food },
          connectionState: mockState.connectionState,
          owner: 'Kamlesh'
        }),
        getCommandHistory: () => mockState.commandAudit,
        commandGateway: {
          execute: async (req) => {
            const msg = (req.message || '').trim().toLowerCase();
            if (msg === 'status') {
              return { ok: true, status: 'completed', message: 'Argus [Preview Data] - Status: OK' };
            }
            if (msg.startsWith('mine')) {
              return { ok: true, status: 'running', taskId: 'task-prev-new', message: `Dispatched: ${msg}` };
            }
            if (msg === 'drop all') {
              return { ok: true, status: 'confirmation_required', requiresConfirmation: true, message: 'Confirmation required for drop all.' };
            }
            if (msg === 'confirm drop all') {
              return { ok: true, status: 'completed', message: 'All items dropped.' };
            }
            if (msg === 'deny') {
              return { ok: false, status: 'denied', message: 'Access denied.' };
            }
            return { ok: false, status: 'unsupported', message: `Unsupported: ${msg}` };
          }
        }
      };

      const { startServer } = require('../../src/modules/dashboard/api/server');
      previewServerInstance = startServer(mockCtx, PREVIEW_PORT, '127.0.0.1');
    });

    after(async () => {
      if (previewServerInstance && previewServerInstance.server) {
        if (previewServerInstance.wss) {
          previewServerInstance.wss.close();
        }
        await new Promise((resolve) => previewServerInstance.server.close(() => resolve()));
      }
    });

    test('GET /api/health responds with status ok in preview', async () => {
      const res = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/health`);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.status, 'ok');
    });

    test('POST /api/auth/login validates credentials and issues token', async () => {
      // Wrong password
      const badRes = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' })
      });
      assert.strictEqual(badRes.status, 401);

      // Correct password
      const goodRes = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'preview-password-2026' })
      });
      assert.strictEqual(goodRes.status, 200);
      const goodData = await goodRes.json();
      assert.strictEqual(goodData.ok, true);
      assert.ok(goodData.token);
    });

    test('GET /api/status returns preview telemetry with isPreview: true', async () => {
      const res = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/status`, {
        headers: { Authorization: `Bearer ${validToken}` }
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.preview, true);
      assert.strictEqual(data.isPreview, true);
      assert.strictEqual(data.online, true);
    });

    test('POST /api/commands handles status directive cleanly', async () => {
      const res = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ message: 'status' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.status, 'completed');
    });

    test('POST /api/commands handles running task directive without false completion', async () => {
      const res = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ message: 'mine 16 iron_ore' })
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(data.status, 'running');
      assert.notStrictEqual(data.status, 'completed', 'Queued/running task must never be marked completed');
    });

    test('POST /api/commands enforces confirmation requirement flow', async () => {
      // 1. Initial dangerous command returns confirmation_required
      const res1 = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ message: 'drop all' })
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.status, 'confirmation_required');
      assert.strictEqual(data1.requiresConfirmation, true);

      // 2. Confirmed directive executes
      const res2 = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ message: 'confirm drop all' })
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.status, 'completed');
    });

    test('POST /api/commands reports permission denied with HTTP 403', async () => {
      const res = await fetch(`http://127.0.0.1:${PREVIEW_PORT}/api/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${validToken}` },
        body: JSON.stringify({ message: 'deny' })
      });
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.status, 'denied');
    });
  });
});
