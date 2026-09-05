const CommandError = require('./CommandError');

/**
 * ConfirmationRequiredError - Thrown when a dangerous or destructive operation requires confirmation.
 */
class ConfirmationRequiredError extends CommandError {
  /**
   * @param {string} message - Warning confirmation prompt message
   * @param {string} confirmationId - Generated unique confirmation ID
   * @param {Object} operation - Operation details requiring confirmation
   */
  constructor(message, confirmationId, operation) {
    super(message, 'CONFIRMATION_REQUIRED');
    this.name = 'ConfirmationRequiredError';
    this.confirmationId = confirmationId;
    this.operation = operation;
  }
}

module.exports = ConfirmationRequiredError;
