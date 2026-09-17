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

module.exports = {
  CommandTokenizer,
  CoordinateParser,
  EntityExtractor,
  IntentParser,
  IntentRegistry,
  QuantityParser,
  SpellCorrector,
  SynonymRegistry,
  TimeExpressionParser,
  nlpThresholds
};
