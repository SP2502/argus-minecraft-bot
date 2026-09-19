/**
 * WebhookDispatcher - Dispatches critical operational notifications to Discord, Slack, Telegram, and Generic webhooks.
 */
class WebhookDispatcher {
  constructor(options = {}) {
    this.discordUrl = options.discordUrl || process.env.DISCORD_WEBHOOK_URL || null;
    this.slackUrl = options.slackUrl || process.env.SLACK_WEBHOOK_URL || null;
    this.telegramToken = options.telegramToken || process.env.TELEGRAM_BOT_TOKEN || null;
    this.telegramChatId = options.telegramChatId || process.env.TELEGRAM_CHAT_ID || null;
    this.genericWebhookUrl = options.genericWebhookUrl || process.env.GENERIC_WEBHOOK_URL || null;

    this.deliveryStats = {
      totalDispatched: 0,
      delivered: 0,
      failed: 0,
      lastError: null
    };
  }

  /**
   * Validates notification payload.
   * @param {Object} payload
   * @returns {{ valid: boolean, error?: string }}
   */
  validatePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Payload must be a valid object' };
    }
    if (!payload.message || typeof payload.message !== 'string') {
      return { valid: false, error: 'Payload message must be a non-empty string' };
    }
    const validSeverities = ['CRITICAL', 'ERROR', 'WARN', 'INFO', 'SUCCESS'];
    if (payload.severity && !validSeverities.includes(payload.severity.toUpperCase())) {
      return { valid: false, error: `Invalid severity: ${payload.severity}` };
    }
    return { valid: true };
  }

  /**
   * Dispatches an alert or event payload to configured external webhook endpoints.
   * 
   * @param {string} eventType - Event category or title (e.g. 'CRITICAL_ALERT', 'TASK_FAILED')
   * @param {Object} payload - Notification data
   * @param {string} [payload.severity='INFO'] - Severity level (CRITICAL, ERROR, WARN, INFO)
   * @param {string} [payload.message=''] - Human readable text message
   * @param {Object} [payload.data={}] - Supplementary key-value telemetry
   * @returns {Promise<{ success: boolean, results: Array }>}
   */
  async dispatch(eventType, payload = {}) {
    const validation = this.validatePayload(payload);
    if (!validation.valid) {
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = validation.error;
      return { success: false, error: validation.error };
    }

    if (!this.discordUrl && !this.slackUrl && (!this.telegramToken || !this.telegramChatId) && !this.genericWebhookUrl) {
      return { success: true, results: [] }; // No webhooks configured; skip safely
    }

    const {
      severity = 'INFO',
      message = '',
      data = {}
    } = payload;

    this.deliveryStats.totalDispatched++;
    const promises = [];

    // 1. Discord Webhook format
    if (this.discordUrl) {
      const color = severity === 'CRITICAL' ? 0xff4757 : severity === 'WARN' ? 0xffa502 : 0x2ed573;
      const discordBody = {
        embeds: [
          {
            title: `🤖 Argus Bot - ${eventType}`,
            description: message,
            color,
            fields: Object.entries(data).map(([k, v]) => ({
              name: k,
              value: String(v),
              inline: true
            })),
            footer: { text: `Severity: ${severity}` },
            timestamp: new Date().toISOString()
          }
        ]
      };

      promises.push(
        fetch(this.discordUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordBody)
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { channel: 'discord', ok: true };
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Discord webhook failed:', err.message);
          return { channel: 'discord', ok: false, error: err.message };
        })
      );
    }

    // 2. Slack Webhook format
    if (this.slackUrl) {
      const slackBody = {
        text: `*[Argus Bot - ${severity}] ${eventType}*\n${message}`
      };

      promises.push(
        fetch(this.slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackBody)
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { channel: 'slack', ok: true };
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Slack webhook failed:', err.message);
          return { channel: 'slack', ok: false, error: err.message };
        })
      );
    }

    // 3. Telegram Bot API format
    if (this.telegramToken && this.telegramChatId) {
      const telegramUrl = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
      const telegramBody = {
        chat_id: this.telegramChatId,
        text: `🚨 *[Argus - ${severity}] ${eventType}*\n${message}`,
        parse_mode: 'Markdown'
      };

      promises.push(
        fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telegramBody)
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { channel: 'telegram', ok: true };
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Telegram notification failed:', err.message);
          return { channel: 'telegram', ok: false, error: err.message };
        })
      );
    }

    // 4. Generic Webhook format
    if (this.genericWebhookUrl) {
      const genericBody = {
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        message,
        data
      };

      promises.push(
        fetch(this.genericWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(genericBody)
        }).then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { channel: 'generic', ok: true };
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Generic webhook failed:', err.message);
          return { channel: 'generic', ok: false, error: err.message };
        })
      );
    }

    const results = await Promise.all(promises);
    const anyFailed = results.some(r => !r.ok);
    if (anyFailed) {
      this.deliveryStats.failed++;
      this.deliveryStats.lastError = results.filter(r => !r.ok).map(r => `${r.channel}: ${r.error}`).join('; ');
    } else {
      this.deliveryStats.delivered++;
    }

    return { success: !anyFailed, results };
  }
}

module.exports = WebhookDispatcher;
