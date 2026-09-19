const tokenizer = require('./CommandTokenizer');
const spellCorrector = require('./SpellCorrector');
const entityExtractor = require('./EntityExtractor');
const intentRegistry = require('./IntentRegistry');
const synonymRegistry = require('./SynonymRegistry');
const nlpThresholds = require('./nlp-thresholds');

/**
 * IntentParser - Natural Language understanding parser mapping raw player input
 * into validated structured intent classifications and extracted entity slots.
 */
class IntentParser {
  /**
   * Parses natural language input into classified intents and entities.
   * 
   * @param {string} rawInput - Natural language command text
   * @param {Object} [context={}] - Conversation and environment context
   * @returns {Object} Parse result payload
   * 
   * @example
   * const result = intentParser.parse('mine 64 diamonds then go home');
   */
  parse(rawInput = '', context = {}) {
    if (!rawInput || typeof rawInput !== 'string') {
      return {
        confidence: 0,
        intents: [],
        entities: {},
        corrections: [],
        suggestedCorrections: [],
        ambiguities: [],
        normalizedText: '',
        rawText: rawInput
      };
    }

    const trimmed = rawInput.trim();

    // 1. Spell Correction Pass
    const {
      correctedText,
      appliedCorrections,
      suggestedCorrections
    } = spellCorrector.correct(trimmed, context);

    // 2. Split into Sub-Clauses for Compound Statements
    const clauses = tokenizer.splitClauses(correctedText);
    const parsedIntents = [];
    const aggregatedEntities = {};
    const ambiguities = [];

    for (const clause of clauses) {
      const clauseText = clause.text;
      const clauseEntities = entityExtractor.extract(clauseText, context);
      Object.assign(aggregatedEntities, clauseEntities);

      // Score against all registered intents
      const scored = this._scoreIntents(clauseText, clauseEntities);

      if (scored.length > 0) {
        const best = scored[0];
        parsedIntents.push({
          name: best.intentName,
          confidence: best.confidence,
          definition: best.definition,
          entities: clauseEntities,
          clauseText,
          connector: clause.connector
        });
      } else {
        // Fallback: check synonym verb matches
        const fallback = this._fallbackVerbMatch(clauseText, clauseEntities);
        if (fallback) {
          parsedIntents.push(fallback);
        }
      }
    }

    // Calculate aggregate confidence score
    let totalScore = 0;
    for (const item of parsedIntents) {
      totalScore += item.confidence;
    }
    const avgConfidence = parsedIntents.length > 0
      ? Math.round((totalScore / parsedIntents.length) * 100) / 100
      : 0;

    return {
      confidence: avgConfidence,
      intents: parsedIntents,
      entities: aggregatedEntities,
      corrections: appliedCorrections,
      suggestedCorrections,
      ambiguities,
      normalizedText: correctedText,
      rawText: rawInput
    };
  }

  /**
   * Scores all registered phrases against a clause.
   * @private
   */
  _scoreIntents(clauseText, entities) {
    const tokens = tokenizer.tokenize(clauseText);
    const clauseTokens = new Set(tokens.map((t) => t.normalized));
    const scored = [];

    for (const { phrase, intentName, definition } of intentRegistry.phrases) {
      const phraseWords = phrase.split(/\s+/).map((w) => w.toLowerCase());
      let matches = 0;
      let templateSlots = 0;

      for (const pw of phraseWords) {
        if (pw.startsWith('{') && pw.endsWith('}')) {
          templateSlots++;
          const slot = pw.slice(1, -1).replace('?', '');
          if (entities[slot] || entities.modifiers[slot]) {
            matches++;
          }
        } else if (clauseTokens.has(pw)) {
          matches++;
        }
      }

      const totalRequired = phraseWords.length;
      const score = totalRequired > 0 ? matches / totalRequired : 0;

      if (score >= nlpThresholds.MIN_INTENT_CONFIDENCE) {
        scored.push({
          intentName,
          confidence: Math.round(score * 100) / 100,
          matchedWords: matches,
          definition
        });
      }
    }

    return scored.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.matchedWords - a.matchedWords;
    });
  }

  /**
   * Fallback verb matching using canonical SynonymRegistry.
   * @private
   */
  _fallbackVerbMatch(clauseText, entities) {
    const lower = clauseText.toLowerCase();

    for (const [intentName, aliases] of Object.entries(synonymRegistry.intents)) {
      for (const alias of aliases) {
        if (lower.startsWith(alias) || lower.includes(alias)) {
          const def = intentRegistry.getIntent(intentName) || {
            name: intentName,
            requiredPermission: 'trusted',
            priorityKey: 'OWNER_TASK',
            skillName: intentName
          };

          return {
            name: intentName,
            confidence: 0.85,
            definition: def,
            entities,
            clauseText,
            connector: null
          };
        }
      }
    }

    return null;
  }

  /**
   * Health ping for AIBrain subsystem audit.
   * @returns {{ ok: boolean, module: string, intentsLoaded: number }}
   */
  ping() {
    const count = intentRegistry.getAllIntents().length;
    return {
      ok: count > 0,
      module: 'IntentParser',
      intentsLoaded: count
    };
  }
}

module.exports = new IntentParser();
