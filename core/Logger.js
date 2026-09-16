const eventBus = require('./EventBus');
const persistenceManager = require('./PersistenceManager');

// ANSI Color definitions for terminal output
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[91m',
  green: '\x1b[92m',
  yellow: '\x1b[93m',
  blue: '\x1b[94m',
  magenta: '\x1b[95m',
  cyan: '\x1b[96m',
  white: '\x1b[97m',
  gray: '\x1b[90m'
};

const SEVERITY_STYLES = {
  INFO: { color: COLORS.cyan, badge: 'INFO ' },
  SUCCESS: { color: COLORS.green, badge: ' OK  ' },
  WARN: { color: COLORS.yellow, badge: 'WARN ' },
  ERROR: { color: COLORS.red, badge: 'ERROR' },
  DEBUG: { color: COLORS.gray, badge: 'DEBUG' },
  NETWORK: { color: COLORS.blue, badge: 'NETWR' },
  AUTH: { color: COLORS.yellow, badge: ' AUTH' },
  SECURITY: { color: COLORS.magenta, badge: 'SECUR' }
};

/**
 * Advanced Troubleshooting Logger
 * Provides colorized terminal logging, diagnostic breakdowns, actionable troubleshooting hints,
 * eventBus streaming to WebSockets, and asynchronous file persistence.
 */
class Logger {
  constructor() {
    this.isTty = Boolean(process.stdout && process.stdout.isTTY !== false);
    this.logLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
  }

  /**
   * Formats current timestamp as YYYY-MM-DD HH:mm:ss.SSS
   * @returns {string}
   */
  getTimestamp() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}.${ms}`;
  }

  /**
   * Core logging handler. Formats terminal output, emits on EventBus, and persists to disk.
   */
  log(severity = 'INFO', category = 'SYSTEM', message = '', details = null) {
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.INFO;
    const ts = this.getTimestamp();
    const catFormatted = `[${category.toUpperCase()}]`.padEnd(14);

    let consoleLine;
    if (this.isTty) {
      consoleLine = `${COLORS.dim}[${ts}]${COLORS.reset} ${style.color}${COLORS.bold}[${style.badge}]${COLORS.reset} ${COLORS.bold}${catFormatted}${COLORS.reset} ${message}`;
    } else {
      consoleLine = `[${ts}] [${style.badge}] ${catFormatted} ${message}`;
    }

    if (severity === 'ERROR') {
      console.error(consoleLine);
    } else if (severity === 'WARN') {
      console.warn(consoleLine);
    } else {
      console.log(consoleLine);
    }

    if (details) {
      if (typeof details === 'object') {
        const indent = '    ';
        try {
          const formatted = JSON.stringify(details, null, 2)
            .split('\n')
            .map(line => indent + (this.isTty ? `${COLORS.gray}${line}${COLORS.reset}` : line))
            .join('\n');
          console.log(formatted);
        } catch (e) {
          console.log(indent + String(details));
        }
      } else {
        console.log(`    ${details}`);
      }
    }

    // Broadcast to WebSocket and dashboard subscribers
    eventBus.emit('log:entry', {
      timestamp: new Date().toISOString(),
      severity,
      category,
      message,
      details: details ? (typeof details === 'object' ? details : { text: String(details) }) : undefined
    });

    // Save to persistent storage asynchronously
    persistenceManager.saveLog({
      severity,
      category,
      message: details ? `${message} | details: ${JSON.stringify(details)}` : message
    });
  }

  info(category, message, details = null) {
    this.log('INFO', category, message, details);
  }

  success(category, message, details = null) {
    this.log('SUCCESS', category, message, details);
  }

  warn(category, message, details = null) {
    this.log('WARN', category, message, details);
  }

  error(category, message, details = null) {
    this.log('ERROR', category, message, details);
  }

  debug(category, message, details = null) {
    if (this.logLevel === 'debug') {
      this.log('DEBUG', category, message, details);
    }
  }

  network(category, message, details = null) {
    this.log('NETWORK', category, message, details);
  }

  auth(category, message, details = null) {
    this.log('AUTH', category, message, details);
  }

  security(category, message, details = null) {
    this.log('SECURITY', category, message, details);
  }

  /**
   * Outputs an advanced troubleshooting card with actionable diagnostics.
   * @param {string} title - Section title
   * @param {Record<string, any>} fields - Key-value diagnosis fields
   * @param {'info'|'warn'|'error'|'success'} [status='info']
   */
  diagnose(title, fields = {}, status = 'info') {
    const borderColor = status === 'error' ? COLORS.red : status === 'warn' ? COLORS.yellow : status === 'success' ? COLORS.green : COLORS.cyan;
    const border = '═'.repeat(68);
    const ts = this.getTimestamp();

    console.log(`\n${borderColor}╔${border}╗${COLORS.reset}`);
    console.log(`${borderColor}║${COLORS.reset} ${COLORS.bold}${title.toUpperCase().padEnd(66)}${COLORS.reset} ${borderColor}║${COLORS.reset}`);
    console.log(`${borderColor}║${COLORS.reset} ${COLORS.dim}Timestamp: ${ts.padEnd(55)}${COLORS.reset} ${borderColor}║${COLORS.reset}`);
    console.log(`${borderColor}╠${border}╣${COLORS.reset}`);

    for (const [key, value] of Object.entries(fields)) {
      const formattedKey = `${key}:`.padEnd(20);
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      console.log(`${borderColor}║${COLORS.reset}  ${COLORS.bold}${formattedKey}${COLORS.reset} ${valStr.padEnd(44)} ${borderColor}║${COLORS.reset}`);
    }

    console.log(`${borderColor}╚${border}╝${COLORS.reset}\n`);
  }

  /**
   * Analyzes an error object and prints targeted troubleshooting solutions.
   * @param {Error|Object|string} err
   * @param {Object} context - Bot / network state
   */
  diagnoseError(err, context = {}) {
    const errMsg = err && err.message ? err.message : String(err || 'Unknown error');
    const errCode = err && err.code ? err.code : 'N/A';
    let remedy = 'Inspect server logs and network connectivity.';

    if (errCode === 'ECONNREFUSED') {
      remedy = 'The Minecraft server refused the connection. The server is likely OFFLINE, or the port is wrong. If using Aternos, turn ON the server in the web dashboard first.';
    } else if (errCode === 'ETIMEDOUT') {
      remedy = 'Connection attempt timed out. Check whether the host address is reachable and not blocked by a firewall.';
    } else if (errCode === 'ENOTFOUND') {
      remedy = 'DNS resolution failed. Check if MC_HOST in .env is spelled correctly and your DNS is working.';
    } else if (errMsg.includes('whitelist')) {
      remedy = 'The bot username is not on the server whitelist. Add the bot with "/whitelist add <MC_USERNAME>".';
    } else if (errMsg.includes('already connected') || errMsg.includes('duplicate')) {
      remedy = 'Another client is logged in with this username. Wait for ghost connection to time out or change MC_USERNAME.';
    } else if (errMsg.includes('outdated')) {
      remedy = 'Minecraft protocol version mismatch. Adjust MC_VERSION in .env or set MC_VERSION=auto.';
    } else if (errMsg.includes('banned')) {
      remedy = 'The bot account or IP has been banned on the server.';
    }

    this.diagnose('CONNECTION & ERROR TROUBLESHOOTING', {
      'Error Code': errCode,
      'Error Message': errMsg,
      'Target Server': `${context.host || process.env.MC_HOST || 'localhost'}:${context.port || process.env.MC_PORT || 25565}`,
      'Bot Username': context.username || process.env.MC_USERNAME || 'Argus',
      'Auth Mode': context.authMode || process.env.AUTH_MODE || 'offline',
      'Recommended Action': remedy
    }, 'error');
  }
}

module.exports = new Logger();
