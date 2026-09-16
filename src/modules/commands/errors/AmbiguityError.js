const CommandError = require('./CommandError');

/**
 * AmbiguityError - Thrown when a command entity or location has multiple valid interpretations.
 */
class AmbiguityError extends CommandError {
  /**
   * @param {string} message - Clarification prompt message
   * @param {string} ambiguityType - Type of ambiguity (e.g. 'location', 'item', 'target', 'quantity')
   * @param {Array<{ label: string, value: any, description?: string }>} options - Numbered options list
   * @param {Object} [partialPlan=null] - Saved partial plan
   */
  constructor(message, ambiguityType, options = [], partialPlan = null) {
    super(message, 'AMBIGUITY_ERROR');
    this.name = 'AmbiguityError';
    this.ambiguityType = ambiguityType;
    this.options = options;
    this.partialPlan = partialPlan;
  }
}

module.exports = AmbiguityError;
