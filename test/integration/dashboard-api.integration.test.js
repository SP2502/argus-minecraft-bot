const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const EventEmitter = require('events');
const { WebSocket } = require('ws');
const BotContext = require('../../src/core/BotContext');
const { startServer } = require('../../src/modules/dashboard');

// Configure test secrets meeting validation criteria
process.env.DASHBOARD_PASSWORD = 'TestPassword123!';
process.env.DASHBOARD_SESSION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.DASHBOARD_SESSION_TTL_MS = '3600000';

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusIntegrationBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: { x: 50, y: 64, z: -100, floored: () => ({ x: 50, y: 64, z: -100 }) },
    yaw: 0,
    pitch: 0
  };
  bot.inventory = {
    items: () => [],
    slots: new Array(45).fill(null)
  };
  bot.loadPlugin = () => {};
  bot.pathfinder = {
    setGoal: () => {},
    setMovements: () => {},
    stop: () => {}
  };
  return bot;
}

function httpRequest(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test('Dashboard HTTP & WebSocket API Integration Suite', async (t) => {
  const bot = createMockBot();
  const ctx = new BotContext(bot);
  const { server, wss } = startServer(ctx, 0);

  let port;
  await new Promise((resolve) => {
    server.on('listening', () => {
      port = server.address().port;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise((resolve) => {
      wss.close(() => {
        server.close(resolve);
      });
    });
  });

  let validToken = null;

  await t.test('Root and static assets are served from dashboard public directory', async () => {
    const rootRes = await httpRequest(port, '/');
    assert.strictEqual(rootRes.status, 200);
    assert.ok(rootRes.body.includes('Argus Bot - Real-Time Dashboard'));

    const cssRes = await httpRequest(port, '/css/dashboard.css');
    assert.strictEqual(cssRes.status, 200);
    assert.ok(cssRes.body.length > 0);

    const jsRes = await httpRequest(port, '/js/dashboard.js');
    assert.strictEqual(jsRes.status, 200);
    assert.ok(jsRes.body.length > 0);
  });

  await t.test('REST security: unauthorized requests without Bearer token are rejected', async () => {
    const unauthRes = await httpRequest(port, '/api/status');
    assert.strictEqual(unauthRes.status, 401);
    const parsed = JSON.parse(unauthRes.body);
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.message, 'Authentication required.');
  });

  await t.test('Authentication endpoint: invalid password rejected; valid password issues session token', async () => {
    const badLogin = await httpRequest(port, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' })
    });
    assert.strictEqual(badLogin.status, 401);

    const goodLogin = await httpRequest(port, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'TestPassword123!' })
    });
    assert.strictEqual(goodLogin.status, 200);
    const body = JSON.parse(goodLogin.body);
    assert.strictEqual(body.ok, true);
    assert.ok(body.token, 'Token string returned');
    assert.ok(!goodLogin.body.includes(process.env.DASHBOARD_PASSWORD), 'Password must never be printed');
    assert.ok(!goodLogin.body.includes(process.env.DASHBOARD_SESSION_SECRET), 'Secret must never be printed');
    validToken = body.token;
  });

  await t.test('Authenticated REST: GET /api/status returns telemetry snapshot with token', async () => {
    const statusRes = await httpRequest(port, '/api/status', {
      headers: { 'Authorization': `Bearer ${validToken}` }
    });
    assert.strictEqual(statusRes.status, 200);
    const data = JSON.parse(statusRes.body);
    assert.strictEqual(data.username, 'ArgusIntegrationBot');
    assert.strictEqual(data.health, 20);
    assert.strictEqual(data.food, 20);
    assert.deepStrictEqual(data.position, { x: 50, y: 64, z: -100 });
  });

  await t.test('WebSocket connection: rejects unauthenticated upgrade and accepts valid token', async () => {
    // 1. Unauthenticated WS rejection
    await new Promise((resolve) => {
      const wsBad = new WebSocket(`ws://127.0.0.1:${port}`);
      wsBad.on('error', (err) => {
        assert.ok(err.message.includes('401'));
        resolve();
      });
      wsBad.on('open', () => {
        wsBad.close();
        assert.fail('Unauthenticated WS must not connect');
      });
    });

    // 2. Authenticated WS success
    await new Promise((resolve, reject) => {
      const wsGood = new WebSocket(`ws://127.0.0.1:${port}/?token=${encodeURIComponent(validToken)}`);
      let gotInit = false;

      wsGood.on('open', () => {
        // Connected
      });

      wsGood.on('message', (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'init') {
          gotInit = true;
          assert.strictEqual(msg.data.username, 'ArgusIntegrationBot');
          wsGood.send(JSON.stringify({ type: 'ping' }));
        } else if (msg.type === 'pong') {
          assert.ok(gotInit, 'Received init before pong');
          wsGood.close();
          resolve();
        }
      });

      wsGood.on('error', reject);
    });
  });
});
