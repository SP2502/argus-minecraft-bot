const http = require('http');
const path = require('path');
const express = require('express');
const createStatusRouter = require('./routes/status');
const { createRestCommandRouter } = require('../commands/adapters/RestCommandAdapter');
const { setupWebSocketServer } = require('./websocket');
const CommandAudit = require('../models/CommandAudit');
const { createSessionToken, verifySessionToken, extractBearerToken, validateConfig } = require('../core/SessionAuth');

/**
 * Creates and starts Express HTTP and WebSocket API server.
 * @param {import('../core/BotContext')} ctx - BotContext instance
 * @param {number} [port] - Server port (defaults to process.env.PORT or 3000)
 * @returns {{ app: express.Application, server: http.Server, wss: import('ws').WebSocketServer }}
 */
function startServer(ctx, port = process.env.PORT || 3000) {
  validateConfig();
  const app = express();
  app.use(express.json());

  // Serve static assets from public/
  app.use(express.static(path.join(__dirname, '../public')));

  // Dashboard authentication endpoint. All other API routes require its signed session.
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    const configuredPassword = process.env.DASHBOARD_PASSWORD;

    if (password !== configuredPassword) {
      return res.status(401).json({
        ok: false,
        message: 'Invalid dashboard password.'
      });
    }

    const user = process.env.OWNER_USERNAME || 'DashboardOwner';
    const role = 'owner';
    const sessionToken = createSessionToken(user, role);
    const session = verifySessionToken(sessionToken);

    return res.json({
      ok: true,
      token: sessionToken,
      username: user,
      role,
      expiresAt: session.expiresAt
    });
  });

  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    const session = verifySessionToken(extractBearerToken(req.headers));
    if (!session) return res.status(401).json({ ok: false, message: 'Authentication required.' });
    req.auth = session;
    next();
  });

  const statusRouter = createStatusRouter(ctx);
  app.use('/api', statusRouter);

  const createServerAuthRouter = require('./routes/serverAuth');
  const serverAuthRouter = createServerAuthRouter();
  app.use('/api/auth', serverAuthRouter);

  if (ctx) {
    const restCommandRouter = createRestCommandRouter(ctx);
    app.use('/api', restCommandRouter);
  }

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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.warn(`[API Server] Port ${port} is already in use. Retrying on port ${nextPort}...`);
      port = nextPort;
      server.listen(port);
    } else {
      console.error('[API Server] Server error:', err.message);
    }
  });

  server.listen(port, () => {
    console.log(`[API Server] Real-Time Dashboard & REST Gateway listening on port ${port}`);
  });

  return { app, server, wss };
}

module.exports = {
  startServer
};
