const express = require('express');
const serverAuthManager = require('../../core/ServerAuthManager');

/**
 * Creates REST API router for fetching and managing offline server passwords.
 * @returns {express.Router}
 */
function createServerAuthRouter() {
  const router = express.Router();

  /**
   * GET /api/auth/status - Returns current in-game server auth detection status
   */
  router.get('/status', (req, res) => {
    try {
      const status = serverAuthManager.getAuthStatus();
      return res.json({ ok: true, ...status });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/auth/server-passwords - Fetches all credentials from the offline database
   */
  router.get('/server-passwords', async (req, res) => {
    try {
      const credentials = await serverAuthManager.getAllCredentials();
      return res.json({
        ok: true,
        count: credentials.length,
        credentials
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/auth/server-passwords/:serverKey - Fetches a specific server credential
   */
  router.get('/server-passwords/:serverKey', async (req, res) => {
    try {
      const { serverKey } = req.params;
      const all = await serverAuthManager.getAllCredentials();
      const match = all.find((c) => c.serverKey.toLowerCase() === serverKey.toLowerCase());
      if (!match) {
        return res.status(404).json({ ok: false, message: `No credential found for server key '${serverKey}'` });
      }
      return res.json({ ok: true, credential: match });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/auth/server-passwords - Saves or updates a server password in the offline database
   */
  router.post('/server-passwords', async (req, res) => {
    try {
      const { host, port, username, password, email, registerCommand, loginCommand } = req.body;
      if (!host || !password) {
        return res.status(400).json({
          ok: false,
          message: 'Request body must include "host" and "password".'
        });
      }

      const saved = await serverAuthManager.saveCredential(
        host,
        port || 25565,
        username || process.env.MC_USERNAME || 'bot',
        password,
        { email, registerCommand, loginCommand }
      );

      return res.json({ ok: true, message: 'Server credential saved to offline database.', credential: saved });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  /**
   * DELETE /api/auth/server-passwords/:serverKey - Deletes a credential from the offline database
   */
  router.delete('/server-passwords/:serverKey', async (req, res) => {
    try {
      const { serverKey } = req.params;
      const parts = serverKey.split(':');
      if (parts.length < 2) {
        return res.status(400).json({ ok: false, message: 'Invalid serverKey format. Expected host:port:username' });
      }
      const host = parts[0];
      const port = parts[1];
      const username = parts[2] || process.env.MC_USERNAME || 'bot';

      const deleted = await serverAuthManager.deleteCredential(host, port, username);
      if (!deleted) {
        return res.status(404).json({ ok: false, message: 'Credential not found.' });
      }
      return res.json({ ok: true, message: 'Credential deleted successfully.' });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  });

  return router;
}

module.exports = createServerAuthRouter;
