const CommandError = require('./CommandError');

/**
 * AuthorizationError - Thrown when a user lacks required permission tier.
 */
class AuthorizationError extends CommandError {
  /**
   * @param {string} message - Error description
   * @param {string} [requiredTier='unknown'] - Required tier name
   * @param {string} [actualTier='unknown'] - User tier name
   */
  constructor(message, requiredTier = 'unknown', actualTier = 'unknown') {
    super(message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
    this.requiredTier = requiredTier;
    this.actualTier = actualTier;
  }
}

module.exports = AuthorizationError;
