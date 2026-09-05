const { Router } = require('express');

/**
 * RestCommandAdapter - REST HTTP endpoint router for programmatic command execution.
 * Mounts POST /api/commands and task query/cancellation routes.
 * 
 * @param {import('../../core/BotContext')} ctx - Central dependency container
 * @returns {import('express').Router}
 */
function createRestCommandRouter(ctx) {
  const router = Router();

  // POST /api/commands - Execute arbitrary natural language command
  router.post('/commands', async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        ok: false,
        status: 'error',
        message: 'Request body must include a non-empty "message" string property.'
      });
    }

    const apiKey = req.headers['x-api-key'];
    const configuredKey = process.env.API_KEY || null;

    // Optional API key validation
    if (configuredKey && apiKey !== configuredKey) {
      return res.status(401).json({
        ok: false,
        status: 'denied',
        message: 'Invalid or missing X-API-Key header.'
      });
    }

    const senderId = apiKey ? `api:${apiKey.substr(0, 6)}` : (process.env.OWNER_USERNAME || 'RestAdmin');

    const request = {
      source: 'rest',
      senderId,
      senderDisplayName: `REST:${senderId}`,
      message,
      sessionId: `rest_${req.ip}`,
      metadata: {
        ip: req.ip,
        userAgent: req.headers['user-agent']
      }
    };

    try {
      const response = await ctx.commandGateway.execute(request);
      const httpStatus = response.status === 'denied' ? 403 : response.status === 'error' ? 400 : 200;
      return res.status(httpStatus).json(response);
    } catch (err) {
      return res.status(500).json({
        ok: false,
        status: 'error',
        message: `Internal gateway error: ${err.message}`
      });
    }
  });

  // GET /api/tasks - Retrieve TaskManager queue snapshot
  router.get('/tasks', (req, res) => {
    if (!ctx.taskManager) {
      return res.json({ activeTask: null, queue: [], isPaused: false });
    }
    return res.json(ctx.taskManager.getQueueSnapshot());
  });

  // POST /api/tasks/:id/cancel - Routes cancellation safely through gateway
  router.post('/tasks/:id/cancel', async (req, res) => {
    const taskId = req.params.id;
    const request = {
      source: 'rest',
      senderId: process.env.OWNER_USERNAME || 'RestAdmin',
      message: `cancel task ${taskId}`,
      sessionId: `rest_${req.ip}`
    };

    const response = await ctx.commandGateway.execute(request);
    return res.json(response);
  });

  return router;
}

module.exports = {
  createRestCommandRouter
};
