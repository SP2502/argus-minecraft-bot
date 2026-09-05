/**
 * MinecraftChatAdapter - Connects Mineflayer chat stream to the UnifiedCommandGateway.
 * Ensures zero command logic exists in chat event listeners.
 */
class MinecraftChatAdapter {
  /**
   * @param {import('../../core/BotContext')} ctx - BotContext instance
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.isAttached = false;
  }

  /**
   * Attaches the singleton chat listener to the Mineflayer bot instance.
   */
  attach() {
    if (this.isAttached || !this.ctx.bot) return;

    this.ctx.bot.on('chat', async (username, message) => {
      // Ignore bot's own messages
      if (username === this.ctx.bot.username) return;

      const request = {
        source: 'minecraft',
        senderId: username,
        senderDisplayName: username,
        message: message,
        sessionId: `mc:${username}`,
        metadata: {
          timestamp: Date.now()
        }
      };

      try {
        const response = await this.ctx.commandGateway.execute(request);
        if (this.ctx.messageRouter && response) {
          await this.ctx.messageRouter.respondToCommand(request, response);
        }
      } catch (err) {
        console.error('[MinecraftChatAdapter] Unhandled gateway error:', err.message);
      }
    });

    this.isAttached = true;
    console.log('[MinecraftChatAdapter] Minecraft chat adapter attached to UnifiedCommandGateway.');
  }
}

module.exports = MinecraftChatAdapter;
