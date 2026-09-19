/**
 * DashboardCommandAdapter - Bridges real-time WebSocket dashboard commands to UnifiedCommandGateway.
 */
class DashboardCommandAdapter {
  /**
   * @param {import('../../core/BotContext')} ctx - BotContext container
   */
  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Handles an incoming command from a WebSocket client.
   * 
   * @param {import('ws').WebSocket} ws - Client socket instance
   * @param {Object} payload - Message payload
   * @param {Object} [sessionInfo={}] - Authenticated session identity
   */
  async handleCommand(ws, payload, sessionInfo = {}) {
    const rawMessage = payload.message || '';
    const senderId = sessionInfo.username || sessionInfo.userId || process.env.OWNER_USERNAME || 'DashboardOwner';
    const senderRole = sessionInfo.role || process.env.DASHBOARD_DEFAULT_ROLE || 'owner';

    const request = {
      source: 'dashboard',
      senderId,
      senderDisplayName: `Web:${senderId}`,
      message: rawMessage,
      sessionId: ws.clientId || `ws_${Date.now()}`,
      metadata: {
        role: senderRole,
        ip: sessionInfo.ip || null
      }
    };

    if (!this.ctx || !this.ctx.commandGateway) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'dashboard.command.result',
          data: {
            ok: false,
            status: 'offline',
            message: 'Bot is currently offline or connecting to Minecraft. Command Gateway will become available once bot spawns in-game.'
          }
        }));
      }
      return;
    }

    try {
      const response = await this.ctx.commandGateway.execute(request);

      // Send result directly back to the requesting dashboard client
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify({
          type: 'dashboard.command.result',
          data: response
        }));
      }

      // Log & route through messageRouter
      if (this.ctx.messageRouter) {
        await this.ctx.messageRouter.respondToCommand(request, response);
      }
    } catch (err) {
      if (ws.readyState === 1) {
        ws.send(JSON.stringify({
          type: 'dashboard.command.result',
          data: {
            ok: false,
            status: 'error',
            message: `Execution error: ${err.message}`
          }
        }));
      }
    }
  }
}

module.exports = DashboardCommandAdapter;
