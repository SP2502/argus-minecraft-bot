const CommandTokenizer = require('./CommandTokenizer');
const CoordinateParser = require('./CoordinateParser');
const EntityExtractor = require('./EntityExtractor');
const IntentParser = require('./IntentParser');
const IntentRegistry = require('./IntentRegistry');
const QuantityParser = require('./QuantityParser');
const SpellCorrector = require('./SpellCorrector');
const SynonymRegistry = require('./SynonymRegistry');
const TimeExpressionParser = require('./TimeExpressionParser');
const nlpThresholds = require('./nlp-thresholds');

/**
 * NLPModule - Unified Natural Language Processing Subsystem.
 * Exposes IntentParser, EntityExtractor, Tokenizer, SpellCorrector, Registries,
 * and unified NLP execution API for BotContext, CommandGateway, and AIBrain.
 */
class NLPModule {
  constructor() {
    this.tokenizer = CommandTokenizer;
    this.coordinateParser = CoordinateParser;
    this.entityExtractor = EntityExtractor;
    this.intentParser = IntentParser;
    this.intentRegistry = IntentRegistry;
    this.quantityParser = QuantityParser;
    this.spellCorrector = SpellCorrector;
    this.synonymRegistry = SynonymRegistry;
    this.timeParser = TimeExpressionParser;
    this.thresholds = nlpThresholds;

    // Backward-compatible named exports
    this.CommandTokenizer = CommandTokenizer;
    this.CoordinateParser = CoordinateParser;
    this.EntityExtractor = EntityExtractor;
    this.IntentParser = IntentParser;
    this.IntentRegistry = IntentRegistry;
    this.QuantityParser = QuantityParser;
    this.SpellCorrector = SpellCorrector;
    this.SynonymRegistry = SynonymRegistry;
    this.TimeExpressionParser = TimeExpressionParser;
    this.nlpThresholds = nlpThresholds;
  }

  /**
   * Main parsing entry point: resolves natural language into structured intents and entities.
   * @param {string} rawInput - Natural language text
   * @param {Object} [context={}] - Environment context
   * @returns {Object} Parse result
   */
  parse(rawInput, context = {}) {
    return this.intentParser.parse(rawInput, context);
  }

  /**
   * Tokenizes text into words, symbols, and quoted literals.
   */
  tokenize(text) {
    return this.tokenizer.tokenize(text);
  }

  /**
   * Splits compound commands joined by 'then', 'and', or punctuation.
   */
  splitClauses(text) {
    return this.tokenizer.splitClauses(text);
  }

  /**
   * Extracts entity slots (quantities, ores, items, coordinates, durations).
   */
  extractEntities(text, context = {}) {
    return this.entityExtractor.extract(text, context);
  }

  /**
   * Performs typo detection and auto-correction.
   */
  correct(text, context = {}) {
    return this.spellCorrector.correct(text, context);
  }

  /**
   * Parses coordinates (absolute, 2D, or relative).
   */
  parseCoordinates(text, botPos = null) {
    return this.coordinateParser.parse(text, botPos);
  }

  /**
   * Parses quantity expressions ("64", "2 stacks", "half a stack").
   */
  parseQuantity(text) {
    return this.quantityParser.parse(text);
  }

  /**
   * Parses duration and time expressions.
   */
  parseTime(text) {
    return this.timeParser.parse(text);
  }

  /**
   * Health ping for AIBrain health check.
   */
  ping() {
    return typeof this.intentParser.ping === 'function'
      ? this.intentParser.ping()
      : { ok: true, module: 'NLP', intentsLoaded: this.intentRegistry.getAllIntents().length };
  }

  /**
   * Returns all loaded intent definitions.
   */
  getAllIntents() {
    return this.intentRegistry.getAllIntents();
  }
}

const nlpInstance = new NLPModule();
nlpInstance.NLPModule = NLPModule;
module.exports = nlpInstance;

