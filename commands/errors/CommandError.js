/**
 * CommandError - Base structured error for command pipeline issues.
 */
class CommandError extends Error {
  /**
   * @param {string} message - Safe user-facing message
   * @param {string} [code='COMMAND_ERROR'] - Error code
   * @param {Object} [details=null] - Internal debug details
   */
  constructor(message, code = 'COMMAND_ERROR', details = null) {
    super(message);
    this.name = 'CommandError';
    this.code = code;
    this.details = details;
  }
}

module.exports = CommandError;
