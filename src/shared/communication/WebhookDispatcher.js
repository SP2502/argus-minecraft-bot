/**
 * WebhookDispatcher - Dispatches critical operational notifications to Discord and Slack webhooks.
 */
class WebhookDispatcher {
  constructor() {
    this.discordUrl = process.env.DISCORD_WEBHOOK_URL || null;
    this.slackUrl = process.env.SLACK_WEBHOOK_URL || null;
  }

  /**
   * Dispatches an alert or event payload to configured external webhook endpoints.
   * 
   * @param {string} eventType - Event category or title (e.g. 'CRITICAL_ALERT', 'TASK_FAILED')
   * @param {Object} payload - Notification data
   * @param {string} [payload.severity='INFO'] - Severity level (CRITICAL, ERROR, WARN, INFO)
   * @param {string} [payload.message=''] - Human readable text message
   * @param {Object} [payload.data={}] - Supplementary key-value telemetry
   * @returns {Promise<boolean>} True if delivered or safely skipped
   */
  async dispatch(eventType, payload = {}) {
    if (!this.discordUrl && !this.slackUrl) {
      return true; // No webhooks configured; skip silently
    }

    const {
      severity = 'INFO',
      message = '',
      data = {}
    } = payload;

    const formattedPayload = {
      timestamp: new Date().toISOString(),
      event_type: eventType,
      severity,
      message,
      data
    };

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
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Discord webhook failed:', err.message);
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
        }).catch((err) => {
          console.warn('[WebhookDispatcher] Slack webhook failed:', err.message);
        })
      );
    }

    await Promise.allSettled(promises);
    return true;
  }
}

module.exports = WebhookDispatcher;
