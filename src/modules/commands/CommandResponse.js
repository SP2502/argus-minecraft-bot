/**
 * CommandResponse - Standardized response object for all command executions across Chat, Dashboard, and REST.
 */
class CommandResponse {
  /**
   * @param {Object} options
   * @param {boolean} [options.ok=false] - Whether operation was accepted or succeeded
   * @param {'success'|'queued'|'clarification'|'confirmation_required'|'denied'|'error'|'info'} [options.status='error'] - Status enum
   * @param {string} [options.message=''] - Human readable response text
   * @param {any} [options.data=null] - Supplementary structured data (options, confirmations, stats)
   * @param {string[]} [options.taskIds=[]] - Associated queued task IDs
   * @param {string|null} [options.commandId=null] - Unique command audit ID
   * @param {'source_only'|'owner_whisper'|'public'|'dashboard'|'silent'} [options.delivery='source_only'] - Routing target
   */
  constructor({
    ok = false,
    status = 'error',
    message = '',
    data = null,
    taskIds = [],
    commandId = null,
    delivery = 'source_only'
  } = {}) {
    this.ok = ok;
    this.status = status;
    this.message = message;
    this.data = data;
    this.taskIds = Array.isArray(taskIds) ? taskIds : [];
    this.commandId = commandId;
    this.delivery = delivery;
    this.timestamp = Date.now();
  }

  static success(message, data = null, delivery = 'source_only') {
    return new CommandResponse({ ok: true, status: 'success', message, data, delivery });
  }

  static queued(message, taskIds = [], delivery = 'source_only') {
    return new CommandResponse({ ok: true, status: 'queued', message, taskIds, delivery });
  }

  static clarification(message, options = [], data = null) {
    return new CommandResponse({
      ok: true,
      status: 'clarification',
      message,
      data: { options, ...data },
      delivery: 'source_only'
    });
  }

  static confirmationRequired(message, confirmationId, operation) {
    return new CommandResponse({
      ok: false,
      status: 'confirmation_required',
      message,
      data: { confirmationId, operation },
      delivery: 'source_only'
    });
  }

  static denied(message, delivery = 'source_only') {
    return new CommandResponse({ ok: false, status: 'denied', message, delivery });
  }

  static error(message, details = null) {
    return new CommandResponse({ ok: false, status: 'error', message, data: details, delivery: 'source_only' });
  }

  static info(message, data = null, delivery = 'source_only') {
    return new CommandResponse({ ok: true, status: 'info', message, data, delivery });
  }
}

module.exports = CommandResponse;
