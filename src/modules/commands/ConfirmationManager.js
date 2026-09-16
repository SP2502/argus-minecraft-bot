const commandPolicies = require('../security/command-policies');

/**
 * ConfirmationManager - Enforces explicit user confirmation for dangerous or destructive operations.
 * Binds confirmation requests to specific sender identities and sessions.
 */
class ConfirmationManager {
  constructor() {
    this.confirmations = new Map(); // confirmationId -> Confirmation Record

    // Cleanup expired confirmations every 30s
    this.timer = setInterval(() => {
      this.expireConfirmations();
    }, 30000);
    if (this.timer.unref) this.timer.unref();
  }

  /**
   * Creates a pending confirmation challenge bound to the requester.
   * 
   * @param {Object} request - Requester context
   * @param {Object} operation - Operation to execute upon confirmation
   * @param {Object} exactParams - Validated operation parameters
   * @param {string} promptMessage - Human-readable warning prompt
   * @param {number} [ttlMs=60000] - Expiry in milliseconds
   * @returns {Object} Confirmation record
   */
  requestConfirmation(request, operation, exactParams, promptMessage, ttlMs = commandPolicies.CONFIRMATION_TTL_MS) {
    const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const record = {
      confirmationId,
      commandId: request.commandId || `cmd_${Date.now()}`,
      senderId: request.senderId,
      source: request.source,
      sessionId: request.sessionId || null,
      operation,
      exactParams,
      promptMessage,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      status: 'pending'
    };

    this.confirmations.set(confirmationId, record);
    return record;
  }

  /**
   * Resolves an answer ('yes' / 'no') against a pending confirmation.
   * 
   * @param {Object} request - Requester
   * @param {string} answer - User input
   * @returns {{ status: 'confirmed'|'denied'|'not_found'|'wrong_sender', operation?: Object, exactParams?: Object }}
   */
  resolveConfirmation(request, answer = '') {
    const cleanAnswer = answer.toLowerCase().trim();
    const isYes = ['yes', 'y', 'confirm', 'sure', 'proceed'].includes(cleanAnswer);
    const isNo = ['no', 'n', 'cancel', 'abort', 'nevermind'].includes(cleanAnswer);

    if (!isYes && !isNo) {
      return { status: 'not_found' };
    }

    // Find latest pending confirmation for this sender
    let matchedRecord = null;
    const now = Date.now();

    for (const record of this.confirmations.values()) {
      if (record.status === 'pending' && now <= record.expiresAt) {
        if (record.senderId.toLowerCase() === request.senderId.toLowerCase() && record.source === request.source) {
          matchedRecord = record;
          break;
        }
      }
    }

    if (!matchedRecord) {
      return { status: 'not_found' };
    }

    // Enforce sender match
    if (matchedRecord.senderId.toLowerCase() !== request.senderId.toLowerCase()) {
      return { status: 'wrong_sender' };
    }

    if (isYes) {
      matchedRecord.status = 'confirmed';
      this.confirmations.delete(matchedRecord.confirmationId);
      return {
        status: 'confirmed',
        operation: matchedRecord.operation,
        exactParams: matchedRecord.exactParams
      };
    } else {
      matchedRecord.status = 'denied';
      this.confirmations.delete(matchedRecord.confirmationId);
      return {
        status: 'denied',
        operation: matchedRecord.operation
      };
    }
  }

  /**
   * Retrieves pending confirmation for a specific sender.
   * @param {Object} request
   * @returns {Object|null}
   */
  getPending(request) {
    const now = Date.now();
    for (const record of this.confirmations.values()) {
      if (record.status === 'pending' && now <= record.expiresAt) {
        if (record.senderId.toLowerCase() === request.senderId.toLowerCase() && record.source === request.source) {
          return record;
        }
      }
    }
    return null;
  }

  /**
   * Sweeps expired confirmations.
   */
  expireConfirmations() {
    const now = Date.now();
    for (const [id, record] of this.confirmations.entries()) {
      if (now > record.expiresAt) {
        this.confirmations.delete(id);
      }
    }
  }
}

module.exports = new ConfirmationManager();
