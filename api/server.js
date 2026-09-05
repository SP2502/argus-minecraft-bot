const http = require('http');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const createStatusRouter = require('./routes/status');
const { createRestCommandRouter } = require('../commands/adapters/RestCommandAdapter');
const { setupWebSocketServer } = require('./websocket');
const CommandAudit = require('../models/CommandAudit');

/**
 * Creates and starts Express HTTP and WebSocket API server.
 * @param {import('../core/BotContext')} ctx - BotContext instance
 * @param {number} [port] - Server port (defaults to process.env.PORT or 3000)
 * @returns {{ app: express.Application, server: http.Server, wss: import('ws').WebSocketServer }}
 */
function startServer(ctx, port = process.env.PORT || 3000) {
  const app = express();
  app.use(express.json());

  // Serve static assets from public/
  app.use(express.static(path.join(__dirname, '../public')));

  // 1. Mount API status and telemetry routes
  const statusRouter = createStatusRouter(ctx);
  app.use('/api', statusRouter);

  // 2. Mount REST Command & Task Router
  if (ctx) {
    const restCommandRouter = createRestCommandRouter(ctx);
    app.use('/api', restCommandRouter);
  }

  // 3. Dashboard Authentication Endpoint: POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    const { password, username } = req.body;
    const configuredPassword = process.env.DASHBOARD_PASSWORD || 'admin';
    const secret = process.env.DASHBOARD_SESSION_SECRET || 'secret_argus_key_2026';

    if (password !== configuredPassword) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid dashboard password.'
      });
    }

    const user = username || process.env.OWNER_USERNAME || 'DashboardOwner';
    const role = process.env.DASHBOARD_DEFAULT_ROLE || 'owner';
    const expiresAt = Date.now() + Number(process.env.DASHBOARD_SESSION_TTL_MS || 28800000);

    const tokenPayload = `${user}:${role}:${expiresAt}`;
    const signature = crypto.createHmac('sha256', secret).update(tokenPayload).digest('hex');
    const sessionToken = `${Buffer.from(tokenPayload).toString('base64')}.${signature}`;

    return res.json({
      ok: true,
      token: sessionToken,
      username: user,
      role,
      expiresAt
    });
  });

  // 4. Command Audit History: GET /api/commands/history?limit=50
  app.get('/api/commands/history', async (req, res) => {
    try {
      const limit = Math.min(100, parseInt(req.query.limit || '50', 10));
      const history = await CommandAudit.find({}).sort({ timestamp: -1 }).limit(limit);
      return res.json({ ok: true, history });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 5. Root route serves web dashboard
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  const server = http.createServer(app);
  const wss = setupWebSocketServer(server, ctx);

  server.listen(port, () => {
    console.log(`[API Server] Real-Time Dashboard & REST Gateway listening on port ${port}`);
  });

  return { app, server, wss };
}

module.exports = {
  startServer
};
