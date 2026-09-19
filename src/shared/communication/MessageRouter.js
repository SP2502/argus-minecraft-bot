const eventBus = require('../../core/EventBus');
const WebhookDispatcher = require('./WebhookDispatcher');
const persistenceManager = require('../persistence/persistence-manager');
const { greetings } = require('../../modules/behavior');

/**
 * MessageRouter - 4-tier communication routing, message batching/deduplication,
 * quiet-mode/DND suppression, and conversational social responses.
 */
class MessageRouter {
  /**
   * @param {import('mineflayer').Bot} [bot] - Mineflayer bot instance
   * @param {string} [ownerUsername] - Owner username
   * @param {WebhookDispatcher} [webhookDispatcher] - Webhook dispatcher instance
   */
  constructor(bot = null, ownerUsername = process.env.OWNER_USERNAME || 'OwnerPlayer', webhookDispatcher = null) {
    this.bot = bot;
    this.ownerUsername = ownerUsername;
    this.webhooks = webhookDispatcher || new WebhookDispatcher();

    this.isQuietMode = false;
    this.dndUntil = 0;
    this.recentMessages = new Map(); // message -> timestamp (10s dedup)
    this.batchBuffer = new Map(); // batchKey -> array of messages (30s batching)

    // Start 30s batch flush timer
    this.batchFlushTimer = setInterval(() => {
      this.flushBatchBuffer();
    }, 30000);
    if (this.batchFlushTimer && typeof this.batchFlushTimer.unref === 'function') {
      this.batchFlushTimer.unref();
    }
  }

  /**
   * Dispatches a message through the 4-tier routing matrix.
   * 
   * @param {1|2|3|4} priorityLevel - Priority tier (1=Critical, 2=Important, 3=Routine, 4=Debug)
   * @param {string} message - Message text
   * @param {Object} [meta={}] - Supplementary metadata
   * @param {boolean} [meta.batchable=false] - Whether routine messages should be aggregated
   * @param {string} [meta.batchKey='general'] - Aggregation bucket key
   * @param {string} [meta.eventType='ALERT'] - Event type for webhooks
   * @returns {Promise<boolean>}
   */
  async send(priorityLevel = 3, message = '', meta = {}) {
    if (!message) return false;

    // 1. Duplicate Suppression (10 seconds)
    const now = Date.now();
    const lastSent = this.recentMessages.get(message);
    if (lastSent && now - lastSent < 10000) {
      return false; // Suppress duplicate
    }
    this.recentMessages.set(message, now);

    // Clean old dedup entries
    if (this.recentMessages.size > 200) {
      for (const [msg, time] of this.recentMessages.entries()) {
        if (now - time > 10000) this.recentMessages.delete(msg);
      }
    }

    const inDND = this.isQuietMode || (now < this.dndUntil);

    switch (priorityLevel) {
      // Tier 1: CRITICAL (Public Chat + Dashboard Log + Webhook) - Always bypasses DND
      case 1:
        if (this.bot && typeof this.bot.chat === 'function') {
          try {
            this.bot.chat(`[ALERT] ${message}`);
          } catch (e) {
            // ignore
          }
        }
        eventBus.emit('log:entry', {
          severity: 'CRITICAL',
          category: 'ROUTER',
          message: `[Tier 1] ${message}`
        });
        await this.webhooks.dispatch(meta.eventType || 'CRITICAL_ALERT', {
          severity: 'CRITICAL',
          message,
          data: meta
        });
        break;

      // Tier 2: IMPORTANT (Owner Whisper + Dashboard Log)
      case 2:
        if (!inDND && this.bot && typeof this.bot.whisper === 'function' && this.ownerUsername) {
          try {
            this.bot.whisper(this.ownerUsername, `[Argus] ${message}`);
          } catch (e) {
            // ignore
          }
        }
        eventBus.emit('log:entry', {
          severity: 'INFO',
          category: 'ROUTER',
          message: `[Tier 2] ${message}`
        });
        break;

      // Tier 3: ROUTINE (Dashboard Log Only, with optional 30s aggregation)
      case 3:
        if (meta.batchable) {
          const key = meta.batchKey || 'routine';
          const list = this.batchBuffer.get(key) || [];
          list.push(message);
          this.batchBuffer.set(key, list);
        } else {
          eventBus.emit('log:entry', {
            severity: 'INFO',
            category: 'ROUTER',
            message: `[Tier 3] ${message}`
          });
        }
        break;

      // Tier 4: DEBUG (Persistent File Log Only)
      case 4:
      default:
        persistenceManager.saveLog({
          severity: 'DEBUG',
          category: 'DEBUG',
          message
        });
        break;
    }

    return true;
  }

  /**
   * Flushes aggregated Tier 3 messages to the dashboard log.
   * @private
   */
  flushBatchBuffer() {
    if (this.batchBuffer.size === 0) return;

    for (const [key, messages] of this.batchBuffer.entries()) {
      if (messages.length === 0) continue;
      const count = messages.length;
      eventBus.emit('log:entry', {
        severity: 'INFO',
        category: 'BATCH',
        message: `[Batch: ${key}] Aggregated ${count} operations in the last 30s.`
      });
    }
    this.batchBuffer.clear();
  }

  /**
   * Enables or disables Quiet Mode (suppresses all except Priority 1).
   * @param {boolean} enabled
   */
  setQuietMode(enabled) {
    this.isQuietMode = Boolean(enabled);
    eventBus.emit('log:entry', {
      severity: 'INFO',
      category: 'ROUTER',
      message: `Quiet mode ${this.isQuietMode ? 'enabled' : 'disabled'}`
    });
  }

  /**
   * Enables Do Not Disturb (DND) for a specific duration.
   * @param {number} durationMs - Duration in milliseconds
   */
  setDND(durationMs) {
    this.dndUntil = Date.now() + durationMs;
    eventBus.emit('log:entry', {
      severity: 'INFO',
      category: 'ROUTER',
      message: `Do Not Disturb activated for ${Math.round(durationMs / 60000)} minutes`
    });
  }

  /**
   * Evaluates incoming chat messages for friendly social greeting interactions.
   * @param {string} username - Chat sender
   * @param {string} message - Chat text
   * @returns {boolean} True if greeting matched and was answered
   */
  handleSocialGreeting(username, message) {
    if (!message || !this.bot) return false;
    const lower = message.trim().toLowerCase();
    const botName = (this.bot.username || process.env.MC_USERNAME || 'bot').toLowerCase();

    const dynamicPatterns = [
      `hi ${botName}`,
      `hello ${botName}`,
      `hey ${botName}`,
      `status ${botName}`,
      ...greetings.patterns
    ];

    const isMatch = dynamicPatterns.some((pattern) => lower.includes(pattern));
    if (isMatch) {
      const rawReply = greetings.responses[Math.floor(Math.random() * greetings.responses.length)];
      const botDisplayName = this.bot.username || process.env.MC_USERNAME || 'Assistant';
      const reply = rawReply.replace(/Argus/g, botDisplayName);
      try {
        this.bot.chat(reply);
        return true;
      } catch (e) {
        return false;
      }
    }

    return false;
  }

  /**
   * Routes a structured CommandResponse to the appropriate communication channel based on origin source.
   * 
   * @param {Object} request - Origin command request
   * @param {import('../commands/CommandResponse')} response - Formatted command response
   */
  async _sendMinecraftChat(message, whisperTarget = null) {
    if (!this.bot || typeof this.bot.chat !== 'function') {
      console.warn('[MessageRouter] Cannot send in-game chat: bot instance is unavailable.');
      return;
    }
    const clean = String(message).trim();
    if (!clean) return;

    // Split multi-line responses to avoid packet overflow or spam kick
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    // Limit to max 5 lines per single output burst to avoid server kick
    const cappedLines = lines.slice(0, 5);
    if (lines.length > 5) {
      cappedLines.push(`...and ${lines.length - 5} more items. (Use specific help topic)`);
    }

    for (let i = 0; i < cappedLines.length; i++) {
      const line = cappedLines[i];
      try {
        if (whisperTarget && typeof this.bot.whisper === 'function') {
          this.bot.whisper(whisperTarget, line);
          console.log(`[MessageRouter] Whispered to <${whisperTarget}>: "${line}"`);
        } else {
          this.bot.chat(line);
          console.log(`[MessageRouter] Sent in-game chat: "${line}"`);
        }
      } catch (err) {
        console.warn(`[MessageRouter] Failed to dispatch chat packet: ${err.message}`);
      }
      if (cappedLines.length > 1 && i < cappedLines.length - 1) {
        // Safe 950ms spacing between chat lines prevents server disconnect.spam kicks
        await new Promise(r => setTimeout(r, 950));
      }
    }
  }

  async respondToCommand(request, response) {
    if (!response || !response.message) return;

    const source = request.source || 'minecraft';
    const delivery = response.delivery || 'source_only';
    const botDisplayName = (this.bot && this.bot.username) ? this.bot.username : (process.env.MC_USERNAME || 'Bot');

    // 1. Minecraft In-Game Chat Channel
    if (source === 'minecraft') {
      if (delivery === 'owner_whisper') {
        await this._sendMinecraftChat(`[${botDisplayName}] ${response.message}`, this.ownerUsername);
      } else if (request.metadata && request.metadata.isWhisper) {
        // Reply via whisper if command came via whisper
        await this._sendMinecraftChat(response.message, request.senderId);
      } else {
        // Direct response to public chat
        await this._sendMinecraftChat(response.message);
      }

      eventBus.emit('log:entry', {
        severity: response.ok ? 'SUCCESS' : 'WARN',
        category: 'COMMAND',
        message: `<${request.senderId}> ${response.message}`
      });
      return;
    }

    // 2. Dashboard Channel: Log to dashboard telemetry stream only; do NOT speak in Minecraft chat
    if (source === 'dashboard') {
      eventBus.emit('log:entry', {
        severity: response.ok ? 'SUCCESS' : 'WARN',
        category: 'DASHBOARD',
        message: `[Web:${request.senderId}] ${response.message}`
      });
      return;
    }

    // 3. REST API Channel: Audited separately
    if (source === 'rest') {
      eventBus.emit('log:entry', {
        severity: response.ok ? 'INFO' : 'WARN',
        category: 'REST',
        message: `[REST:${request.senderId}] ${response.message}`
      });
    }
  }

  /**
   * Health heartbeat check for AIBrain.
   * @returns {{ ok: boolean, isQuietMode: boolean }}
   */
  ping() {
    return {
      ok: true,
      isQuietMode: Boolean(this.isQuietMode)
    };
  }

  /**
   * Records an entry into the in-memory activity timeline.
   * @param {Object} entry
   */
  recordTimeline(entry) {
    if (!this.timeline) this.timeline = [];
    const item = {
      id: `tl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      type: entry.type || 'NOTIFICATION',
      level: entry.level || 'INFO',
      message: entry.message || '',
      user: entry.user || null,
      channel: entry.channel || 'all',
      metadata: entry.metadata || {}
    };
    this.timeline.push(item);
    // Keep last 1000 items in memory
    if (this.timeline.length > 1000) {
      this.timeline.shift();
    }
    return item;
  }

  /**
   * Searches timeline items by query, type, or level.
   * @param {Object} filters
   * @returns {Array}
   */
  searchTimeline(filters = {}) {
    if (!this.timeline) this.timeline = [];
    const { query, level, type, limit = 50 } = filters;
    let results = this.timeline;

    if (level) {
      results = results.filter(i => i.level.toUpperCase() === level.toUpperCase());
    }
    if (type) {
      results = results.filter(i => i.type.toLowerCase() === type.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      results = results.filter(i => 
        i.message.toLowerCase().includes(q) ||
        (i.user && i.user.toLowerCase().includes(q))
      );
    }

    return results.slice(-limit);
  }

  /**
   * Exports the activity timeline as JSON or CSV format.
   * @param {'json'|'csv'} format
   * @returns {string}
   */
  exportTimeline(format = 'json') {
    if (!this.timeline) this.timeline = [];
    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'type', 'level', 'user', 'message'];
      const rows = this.timeline.map(t => 
        [t.id, t.timestamp, t.type, t.level, t.user || '', `"${(t.message || '').replace(/"/g, '""')}"`].join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(this.timeline, null, 2);
  }

  /**
   * Sends owner-targeted status updates (confirmations, errors, progress, completions).
   * @param {'confirm'|'error'|'progress'|'complete'} type
   * @param {string} text
   * @param {Object} [meta={}]
   */
  async notifyOwner(type, text, meta = {}) {
    const prefixes = {
      confirm: '✅ [Confirm]',
      error: '❌ [Error]',
      progress: '⏳ [Progress]',
      complete: '🎉 [Complete]'
    };
    const prefix = prefixes[type] || '[Notice]';
    const message = `${prefix} ${text}`;

    this.recordTimeline({
      type: `OWNER_${type.toUpperCase()}`,
      level: type === 'error' ? 'ERROR' : 'INFO',
      message: text,
      user: this.ownerUsername,
      metadata: meta
    });

    if (this.bot && typeof this.bot.whisper === 'function' && this.ownerUsername) {
      try {
        this.bot.whisper(this.ownerUsername, `[Argus] ${message}`);
      } catch (e) {
        // ignore
      }
    }

    eventBus.emit('log:entry', {
      severity: type === 'error' ? 'ERROR' : 'INFO',
      category: 'OWNER_COMM',
      message: `<Whisper:${this.ownerUsername}> ${message}`
    });

    return true;
  }
}

module.exports = MessageRouter;
