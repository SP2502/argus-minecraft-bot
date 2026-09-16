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

    // 1. In-Game Public Chat Listener
    this.ctx.bot.on('chat', async (username, message) => {
      // Ignore bot's own messages, system broadcast tags, or non-player entities
      if (!username || username === this.ctx.bot.username || username === 'ALERT' || username.startsWith('[')) return;
      if (this.ctx.bot.players && !this.ctx.bot.players[username]) return;

      // Handle friendly social greetings first
      if (this.ctx.messageRouter && this.ctx.messageRouter.handleSocialGreeting(username, message)) {
        return;
      }

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

    // 2. In-Game Private Whisper Listener (/tell, /msg, /w)
    this.ctx.bot.on('whisper', async (username, message) => {
      if (!username || username === this.ctx.bot.username) return;

      if (this.ctx.messageRouter && this.ctx.messageRouter.handleSocialGreeting(username, message)) {
        return;
      }

      const request = {
        source: 'minecraft',
        senderId: username,
        senderDisplayName: username,
        message: message,
        sessionId: `mc_whisper:${username}`,
        metadata: {
          timestamp: Date.now(),
          isWhisper: true
        }
      };

      try {
        const response = await this.ctx.commandGateway.execute(request);
        if (this.ctx.messageRouter && response) {
          await this.ctx.messageRouter.respondToCommand(request, response);
        }
      } catch (err) {
        console.error('[MinecraftChatAdapter] Unhandled whisper gateway error:', err.message);
      }
    });

    this.isAttached = true;
    console.log('[MinecraftChatAdapter] Minecraft chat and whisper adapters attached to UnifiedCommandGateway.');
  }

  detach() {
    this.isAttached = false;
  }
}

module.exports = MinecraftChatAdapter;
