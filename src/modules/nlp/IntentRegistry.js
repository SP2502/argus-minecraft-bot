const fs = require('fs');
const path = require('path');

/**
 * IntentRegistry - Central registry for data-driven intent definitions across all feature domains.
 * Supports central built-in loading and modular feature-local intent registration.
 */
class IntentRegistry {
  /**
   * @param {Object} [options={}]
   * @param {boolean} [options.autoLoadBuiltins=true] - Whether to load default central intent-data files
   */
  constructor(options = {}) {
    this.intents = new Map();       // name -> intent definition
    this.intentSources = new Map(); // name -> source file path or origin
    this.phrases = [];              // array of { phrase, intentName, definition }

    if (options.autoLoadBuiltins !== false) {
      this.loadBuiltInIntents();
    }
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
        this.registerIntentFile(filePath);
      } catch (err) {
        console.warn(`[IntentRegistry] Error loading ${file}:`, err.message);
      }
    }
  }

  /**
   * Registers an external or module-local intent definition file (*.json or *.intents.json).
   * @param {string} filePath - Path to the JSON intent file
   * @returns {Array<Object>} List of newly registered intent definitions
   */
  registerIntentFile(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error(`Invalid intent file path: "${filePath}"`);
    }

    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Intent file not found: "${resolvedPath}"`);
    }

    let raw;
    try {
      raw = fs.readFileSync(resolvedPath, 'utf-8');
    } catch (readErr) {
      throw new Error(`Failed to read intent file "${resolvedPath}": ${readErr.message}`);
    }

    let content;
    try {
      content = JSON.parse(raw);
    } catch (jsonErr) {
      throw new Error(`Malformed JSON in intent file "${resolvedPath}": ${jsonErr.message}`);
    }

    const items = Array.isArray(content) ? content : [content];
    const registered = [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      this.registerIntent(item, resolvedPath);
      registered.push(item);
    }

    return registered;
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
   * @param {string} [source='unknown'] - Origin file or module of the intent definition
   */
  registerIntent(definition, source = 'unknown') {
    if (!definition || !definition.name) return;
    const name = definition.name.toLowerCase().trim();

    if (this.intents.has(name)) {
      const existingSource = this.intentSources.get(name) || 'unknown';
      throw new Error(
        `Duplicate intent ID "${name}" detected in "${source}". Already registered by "${existingSource}".`
      );
    }

    this.intents.set(name, definition);
    this.intentSources.set(name, source);

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

  /**
   * Clears all registered intents and phrases (used for testing and resets).
   */
  clear() {
    this.intents.clear();
    this.intentSources.clear();
    this.phrases = [];
  }
}

const defaultInstance = new IntentRegistry();
defaultInstance.IntentRegistry = IntentRegistry;
module.exports = defaultInstance;
