const fs = require('fs');
const path = require('path');

/**
 * IntentRegistry - Central registry for data-driven intent definitions across all feature domains.
 */
class IntentRegistry {
  constructor() {
    this.intents = new Map(); // name -> intent definition
    this.phrases = [];        // array of { phrase, intentName, definition }
    this.loadBuiltInIntents();
  }

  /**
   * Loads all JSON intent definitions from nlp/intent-data/
   * @private
   */
  loadBuiltInIntents() {
    const dataDir = path.join(__dirname, 'intent-data');
    if (!fs.existsSync(dataDir)) return;

    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(content)) {
          for (const item of content) {
            this.registerIntent(item);
          }
        }
      } catch (err) {
        console.warn(`[IntentRegistry] Error loading ${file}:`, err.message);
      }
    }
  }

  /**
   * Registers a single intent schema definition.
   * @param {Object} definition
   * @param {string} definition.name - Unique intent identifier
   * @param {string[]} definition.phrases - Trigger phrase templates
   * @param {string} [definition.requiredPermission='guest'] - Required role tier
   * @param {string} [definition.priorityKey='AUTONOMOUS'] - Priorities enum key
   * @param {string} [definition.skillName] - Target Skill/service
   * @param {string[]} [definition.requiredEntities=[]] - Required entities
   * @param {string[]} [definition.optionalEntities=[]] - Optional entities
   * @param {Object} [definition.defaultParams={}] - Default parameters
   * @param {boolean} [definition.destructive=false] - Whether operation is destructive
   * @param {boolean} [definition.available=true] - Whether feature is currently implemented
   * @param {boolean} [definition.supportsCompound=true] - Whether intent can participate in sequences
   */
  registerIntent(definition) {
    if (!definition || !definition.name) return;
    const name = definition.name.toLowerCase().trim();

    this.intents.set(name, definition);

    if (Array.isArray(definition.phrases)) {
      for (const phrase of definition.phrases) {
        this.phrases.push({
          phrase: phrase.toLowerCase(),
          intentName: name,
          definition
        });
      }
    }
  }

  /**
   * Retrieves intent definition by name.
   * @param {string} name
   * @returns {Object|null}
   */
  getIntent(name) {
    return this.intents.get(name.toLowerCase().trim()) || null;
  }

  /**
   * Returns all registered intent definitions.
   * @returns {Array<Object>}
   */
  getAllIntents() {
    return Array.from(this.intents.values());
  }
}

module.exports = new IntentRegistry();
