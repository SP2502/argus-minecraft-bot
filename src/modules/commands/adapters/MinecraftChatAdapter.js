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
    this.recentEvents = new Map(); // dedupKey -> timestamp
  }

  /**
   * Dispatches an incoming chat or whisper message through UnifiedCommandGateway.
   * @private
   */
  async _handlePlayerMessage(username, rawMessage, isWhisper = false) {
    if (!username || !rawMessage) return;
    const botName = this.ctx.bot ? this.ctx.bot.username : (process.env.MC_USERNAME || 'Argus');
    if (username.toLowerCase() === (botName || '').toLowerCase() || username === 'ALERT') return;

    // Filter out bot's own chat output prefixes (e.g. "Status:", "Coordinates:", "Inventory:")
    if (['status', 'coordinates', 'inventory', 'uptime', 'command', 'warning', 'error'].includes(username.toLowerCase())) {
      return;
    }

    // Verify that sender is an actual online player on the server
    if (this.ctx.bot && this.ctx.bot.players) {
      const isOnline = Object.keys(this.ctx.bot.players).some(
        (p) => p.toLowerCase() === username.toLowerCase() && p.toLowerCase() !== (botName || '').toLowerCase()
      );
      if (!isOnline && !['console', 'admin', 'owner'].includes(username.toLowerCase())) {
        return;
      }
    }

    // Deduplication check (1500ms window)
    const cleanMsg = rawMessage.trim();
    const dedupKey = `${isWhisper ? 'w' : 'c'}:${username.toLowerCase()}:${cleanMsg.toLowerCase()}`;
    const now = Date.now();
    const lastSeen = this.recentEvents.get(dedupKey);
    if (lastSeen && now - lastSeen < 1500) {
      return;
    }
    this.recentEvents.set(dedupKey, now);

    // Prune stale dedup cache
    if (this.recentEvents.size > 100) {
      for (const [k, t] of this.recentEvents.entries()) {
        if (now - t > 5000) this.recentEvents.delete(k);
      }
    }

    // Strip direct bot mention prefix if user addressed bot by name (e.g. "Argus, status" or "@Argus help")
    const botPrefixRegex = new RegExp(`^(?:@?${botName}|@?bot)[,:]?\\s*`, 'i');
    const strippedMsg = cleanMsg.replace(botPrefixRegex, '').trim();
    const finalMsg = strippedMsg.length > 0 ? strippedMsg : cleanMsg;

    // Friendly greeting check
    if (this.ctx.messageRouter && this.ctx.messageRouter.handleSocialGreeting(username, finalMsg)) {
      return;
    }

    const request = {
      source: 'minecraft',
      senderId: username,
      senderDisplayName: username,
      message: finalMsg,
      sessionId: isWhisper ? `mc_whisper:${username}` : `mc:${username}`,
      metadata: {
        timestamp: now,
        isWhisper,
        rawMessage: cleanMsg
      }
    };

    try {
      console.log(`[MinecraftChatAdapter] Received command from <${username}>: "${cleanMsg}" (executing: "${finalMsg}")`);
      const response = await this.ctx.commandGateway.execute(request);
      if (this.ctx.messageRouter && response) {
        await this.ctx.messageRouter.respondToCommand(request, response);
      }
    } catch (err) {
      console.error('[MinecraftChatAdapter] Unhandled gateway error:', err.message);
    }
  }

  /**
   * Attaches chat, whisper, playerChat, and modern messagestr listeners to Mineflayer bot.
   */
  attach() {
    if (this.isAttached || !this.ctx.bot) return;

    const bot = this.ctx.bot;
    const botName = bot.username || process.env.MC_USERNAME || 'Argus';

    // Helper to get online player names excluding the bot
    const getOnlinePlayers = () => {
      if (!bot.players) return [];
      return Object.keys(bot.players).filter((n) => n.toLowerCase() !== botName.toLowerCase());
    };

    // Helper to find player username by UUID
    const findUsernameByUuid = (uuid) => {
      if (!uuid || !bot.players) return null;
      for (const [username, player] of Object.entries(bot.players)) {
        if (player.uuid === uuid) return username;
      }
      return null;
    };

    // 1. Standard Mineflayer In-Game Public Chat Listener
    bot.on('chat', async (username, message) => {
      await this._handlePlayerMessage(username, message, false);
    });

    // 2. In-Game Private Whisper Listener (/tell, /msg, /w)
    bot.on('whisper', async (username, message) => {
      await this._handlePlayerMessage(username, message, true);
    });

    // 3. Native Minecraft 1.19+ / 1.21 playerChat Protocol Packet
    if (bot._client) {
      bot._client.on('playerChat', async (data) => {
        if (!data) return;
        const rawText = data.plainMessage || (data.formattedMessage ? (() => {
          try {
            const parsed = JSON.parse(data.formattedMessage);
            return parsed.text || parsed;
          } catch (e) { return null; }
        })() : null);

        if (!rawText) return;

        let sender = findUsernameByUuid(data.sender);
        if (!sender && data.senderName) {
          try {
            const parsedName = JSON.parse(data.senderName);
            sender = parsedName.text || parsedName;
          } catch (e) {
            sender = data.senderName;
          }
        }
        if (!sender) {
          const online = getOnlinePlayers();
          if (online.length === 1) sender = online[0];
        }

        if (sender) {
          await this._handlePlayerMessage(sender, rawText, false);
        }
      });
    }

    // 4. Comprehensive Fallback Listener on messagestr
    bot.on('messagestr', async (rawMsg, position, jsonMsg, senderUuid) => {
      if (!rawMsg || typeof rawMsg !== 'string') return;
      const clean = rawMsg.replace(/§[0-9a-fk-orx]/gi, '').replace(/\u001b\[[0-9;]*m/g, '').trim();
      if (!clean) return;

      const isWhisper = position === 'whisper';

      // Case A: UUID provided in event
      if (senderUuid) {
        const username = findUsernameByUuid(senderUuid);
        if (username) {
          return await this._handlePlayerMessage(username, clean, isWhisper);
        }
      }

      // Case B: In-game whisper patterns
      // Example: "ShadowPace2502 whispers to you: status"
      const whisperPattern1 = clean.match(/^([A-Za-z0-9_]{3,16})\s+whispers(?:\s+to\s+you)?:?\s*(.+)$/i);
      if (whisperPattern1 && whisperPattern1[1].toLowerCase() !== botName.toLowerCase()) {
        return await this._handlePlayerMessage(whisperPattern1[1], whisperPattern1[2].trim(), true);
      }

      // Example: "[ShadowPace2502 -> me] status" or "[ShadowPace2502 -> Argus] status"
      const whisperPattern2 = clean.match(/^\[([A-Za-z0-9_]{3,16})\s*->\s*(?:me|you|${botName})\]\s*(.+)$/i);
      if (whisperPattern2 && whisperPattern2[1].toLowerCase() !== botName.toLowerCase()) {
        return await this._handlePlayerMessage(whisperPattern2[1], whisperPattern2[2].trim(), true);
      }

      // Case C: Angle brackets: <PlayerName> message or [Rank] <PlayerName> message
      const angleBracketMatch = clean.match(/^(?:\[[^\]]+\]\s*)*<([A-Za-z0-9_]{3,16})>\s*(.+)$/);
      if (angleBracketMatch && angleBracketMatch[1].toLowerCase() !== botName.toLowerCase()) {
        return await this._handlePlayerMessage(angleBracketMatch[1], angleBracketMatch[2].trim(), false);
      }

      // Case D: Prefixed colon / arrow: [Admin] [Owner] PlayerName: message or PlayerName » message
      const colonMatch = clean.match(/^(?:\[[^\]]+\]\s*|\([^)]+\)\s*|\w+\s*\|\s*)*([A-Za-z0-9_]{3,16})\s*[:»>]\s*(.+)$/);
      if (colonMatch && colonMatch[1].toLowerCase() !== botName.toLowerCase()) {
        return await this._handlePlayerMessage(colonMatch[1], colonMatch[2].trim(), false);
      }

      // Case E: Match against active online players
      const online = getOnlinePlayers();
      for (const player of online) {
        const escaped = player.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const playerRegex = new RegExp(`(?:^|\\s|<|\\[)${escaped}(?:>|\\]|:|»|>|\\s*:)\\s*(.+)$`, 'i');
        const match = clean.match(playerRegex);
        if (match) {
          return await this._handlePlayerMessage(player, match[1].trim(), false);
        }
      }

      // Case F: Single non-bot player on server in chat position
      if (position === 'chat' && online.length === 1) {
        return await this._handlePlayerMessage(online[0], clean, false);
      }
    });

    this.isAttached = true;
    console.log('[MinecraftChatAdapter] Full-spectrum Minecraft chat, whisper, playerChat, and messagestr adapters attached.');
  }

  detach() {
    this.isAttached = false;
  }
}

module.exports = MinecraftChatAdapter;
