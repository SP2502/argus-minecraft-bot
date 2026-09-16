const commandPolicies = require('../security/command-policies');

/**
 * ConversationContextManager - Session-scoped conversation memory, pronoun resolution,
 * and pending clarification state tracking.
 */
class ConversationContextManager {
  constructor() {
    this.contexts = new Map(); // Key: `${source}:${senderId}` -> Context Object

    // Periodic sweep for expired contexts (every 2 minutes)
    this.cleanupTimer = setInterval(() => {
      this.sweepExpired();
    }, 120000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  /**
   * Generates unique composite key for a request.
   * @private
   */
  _getKey(request) {
    const source = request.source || 'minecraft';
    const senderId = request.senderId || 'unknown';
    return `${source}:${senderId.toLowerCase()}`;
  }

  /**
   * Gets or initializes conversation context for a sender/session.
   * @param {Object} request
   * @returns {Object} Context record
   */
  getContext(request) {
    const key = this._getKey(request);
    let ctx = this.contexts.get(key);

    if (!ctx) {
      ctx = {
        key,
        senderId: request.senderId,
        source: request.source,
        sessionId: request.sessionId || null,
        lastInteractions: [],
        lastTask: null,
        pronouns: {
          them: null,
          it: null,
          there: null
        },
        pending: null, // clarification | confirmation | correction
        expiresAt: Date.now() + commandPolicies.CONTEXT_TTL_MS
      };
      this.contexts.set(key, ctx);
    } else {
      ctx.expiresAt = Date.now() + commandPolicies.CONTEXT_TTL_MS;
    }

    return ctx;
  }

  /**
   * Records an interaction snippet into the conversation history.
   * @param {Object} request
   * @param {Object} data
   */
  rememberInteraction(request, data) {
    const ctx = this.getContext(request);
    ctx.lastInteractions.push({
      text: data.text,
      intent: data.intent,
      timestamp: Date.now()
    });

    if (ctx.lastInteractions.length > commandPolicies.MAX_CONTEXT_INTERACTIONS) {
      ctx.lastInteractions.shift();
    }

    // Update pronoun memory if items or locations were present
    if (data.entities) {
      if (data.entities.item || data.entities.targetOre) {
        ctx.pronouns.them = data.entities.item || data.entities.targetOre;
        ctx.pronouns.it = data.entities.item || data.entities.targetOre;
      }
      if (data.entities.location && data.entities.location.name) {
        ctx.pronouns.there = data.entities.location.name;
        ctx.pronouns.it = data.entities.location.name;
      }
    }
  }

  /**
   * Stores a pending question, clarification, or confirmation for this sender.
   * @param {Object} request
   * @param {Object} pendingObj
   * @param {number} [ttlMs=60000]
   */
  setPending(request, pendingObj, ttlMs = commandPolicies.CLARIFICATION_TTL_MS) {
    const ctx = this.getContext(request);
    ctx.pending = {
      ...pendingObj,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs
    };
  }

  /**
   * Retrieves active pending action, returning null if expired.
   * @param {Object} request
   * @returns {Object|null}
   */
  getPending(request) {
    const ctx = this.getContext(request);
    if (!ctx.pending) return null;

    if (Date.now() > ctx.pending.expiresAt) {
      ctx.pending = null;
      return null;
    }

    return ctx.pending;
  }

  /**
   * Clears pending clarification or confirmation state.
   * @param {Object} request
   */
  clearPending(request) {
    const ctx = this.getContext(request);
    ctx.pending = null;
  }

  /**
   * Replaces pronouns ('them', 'it', 'there') with remembered antecedents.
   * @param {string} text
   * @param {Object} request
   * @returns {string}
   */
  resolvePronouns(text = '', request) {
    if (!text) return text;
    const ctx = this.getContext(request);
    let resolved = text;

    if (ctx.pronouns.them) {
      resolved = resolved.replace(/\b(?:them|those)\b/gi, ctx.pronouns.them);
    }
    if (ctx.pronouns.it) {
      resolved = resolved.replace(/\bit\b/gi, ctx.pronouns.it);
    }
    if (ctx.pronouns.there) {
      resolved = resolved.replace(/\bthere\b/gi, ctx.pronouns.there);
    }

    return resolved;
  }

  /**
   * Resolves natural language user choice from a numbered options list.
   * Examples: '1', 'first', 'the first one', '2', 'second', 'last', or exact option text.
   * 
   * @param {string} text - User answer
   * @param {Array<any>} options - Candidate list
   * @returns {any|null} Matching option or null
   */
  resolveSelection(text = '', options = []) {
    if (!text || !Array.isArray(options) || options.length === 0) return null;
    const clean = text.toLowerCase().trim();

    // 1. Numeric index (1-based: "1", "2", "3")
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 1 && num <= options.length) {
      return options[num - 1];
    }

    // 2. Positional words ("first", "first one", "the first one", "second", "last", "one", "two")
    if (clean === 'first' || clean === 'first one' || clean === 'the first one' || clean === '1st' || clean === 'the first' || clean === 'one') {
      return options[0];
    }
    if (clean === 'second' || clean === 'second one' || clean === 'the second one' || clean === '2nd' || clean === 'the second' || clean === 'two') {
      return options.length > 1 ? options[1] : null;
    }
    if (clean === 'third' || clean === 'third one' || clean === 'the third one' || clean === '3rd' || clean === 'the third' || clean === 'three') {
      return options.length > 2 ? options[2] : null;
    }
    if (clean === 'last' || clean === 'last one' || clean === 'the last one' || clean === 'the last') {
      return options[options.length - 1];
    }

    // 3. Exact text matching against label or value
    for (const opt of options) {
      const optStr = typeof opt === 'string'
        ? opt.toLowerCase()
        : (opt.label || opt.name || JSON.stringify(opt)).toLowerCase();

      if (optStr === clean || optStr.includes(clean)) {
        return opt;
      }
    }

    return null;
  }

  /**
   * Remembers the last queued or active task for resume/status queries.
   * @param {Object} request
   * @param {Object} task
   */
  rememberTask(request, task) {
    const ctx = this.getContext(request);
    ctx.lastTask = {
      id: task.id,
      skillName: task.skillName,
      params: task.params,
      status: task.status,
      timestamp: Date.now()
    };
  }

  /**
   * Cleans up expired conversation context records.
   */
  sweepExpired() {
    const now = Date.now();
    for (const [key, ctx] of this.contexts.entries()) {
      if (now > ctx.expiresAt) {
        this.contexts.delete(key);
      }
    }
  }
}

module.exports = new ConversationContextManager();
