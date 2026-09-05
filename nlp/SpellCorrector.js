const nlpThresholds = require('../config/nlpThresholds');
const synonymRegistry = require('./SynonymRegistry');

/**
 * SpellCorrector - Levenshtein-based typo corrector and suggestion engine.
 */
class SpellCorrector {
  constructor() {
    this.staticVocabulary = new Set([
      'mine', 'farm', 'go', 'home', 'base', 'goto', 'follow', 'stop', 'pause', 'resume',
      'continue', 'status', 'inventory', 'store', 'retrieve', 'deposit', 'drop', 'clear',
      'grant', 'revoke', 'macro', 'run', 'create', 'delete', 'wheat', 'carrot', 'potato',
      'beetroot', 'melon', 'pumpkin', 'bamboo', 'diamond', 'iron', 'gold', 'coal', 'copper',
      'redstone', 'lapis', 'emerald', 'netherite', 'stone', 'cobblestone', 'wood', 'log',
      'stack', 'stacks', 'all', 'full', 'half', 'north', 'south', 'east', 'west', 'up', 'down',
      'fast', 'safely', 'quietly', 'bone', 'meal', 'bonemeal', 'help', 'yes', 'no', 'cancel',
      'to', 'at', 'in', 'on', 'of', 'for', 'and', 'the', 'my', 'is', 'it', 'as', 'or', 'by', 'an', 'if', 'do', 'so', 'be', 'with', 'from',
      'then', 'after', 'afterwards', 'when', 'unless', 'about', 'into', 'out', 'where', 'one', 'two', 'three', 'first', 'second', 'last',
      'cut', 'chop', 'harvest', 'gather', 'collect', 'lumber', 'trees', 'tree', 'logs',
      'kill', 'slay', 'hunt', 'protect', 'guard', 'defend', 'patrol', 'zombie', 'skeleton', 'creeper', 'spider', 'witch', 'hostiles', 'monsters', 'enemies', 'mobs',
      'craft', 'make', 'forge', 'smelt', 'cook', 'bake',
      'build', 'construct', 'erect', 'shelter', 'wall', 'floor', 'platform', 'stairs', 'staircase', 'cube', 'box', 'bricks', 'glass',
      'warehouse', 'storage', 'chests', 'chest', 'organize', 'restock', 'resupply', 'supplies', 'locate', 'audit', 'catalog',
      'miner', 'woodcutter', 'warrior', 'farmer', 'kit',
      'ambient', 'sleep', 'wake', 'bed', 'nap'
    ]);
  }

  /**
   * Computes Damerau-Levenshtein distance between two strings with transposition support.
   * @param {string} a
   * @param {string} b
   * @returns {number} Integer edit distance
   */
  levenshteinDistance(a = '', b = '') {
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [];
      matrix[i][0] = i;
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        const cost = s1.charAt(j - 1) === s2.charAt(i - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,       // deletion
          matrix[i][j - 1] + 1,       // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );

        // Adjacent transposition
        if (i > 1 && j > 1 && s2.charAt(i - 1) === s1.charAt(j - 2) && s2.charAt(i - 2) === s1.charAt(j - 1)) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Computes similarity score between 0.0 and 1.0.
   * @param {string} a
   * @param {string} b
   * @returns {number} Score between 0.0 and 1.0
   */
  similarity(a, b) {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const dist = this.levenshteinDistance(a, b);
    if (dist === 0) return 1.0;
    if (dist === 1 && maxLen <= 6) return 0.92; // 1-edit typo on short words
    return Math.max(0, (maxLen - dist) / maxLen);
  }

  /**
   * Finds the best match in vocabulary for a given token.
   * @param {string} token - Word to correct
   * @param {Set<string>|Array<string>} [customVocab] - Optional dynamic vocabulary
   * @returns {{ match: string|null, score: number }}
   */
  findBestMatch(token, customVocab = null) {
    if (!token || token.length < 2) return { match: null, score: 0 };
    const vocab = customVocab || this.staticVocabulary;

    let bestMatch = null;
    let bestScore = 0;

    for (const word of vocab) {
      const score = this.similarity(token, word);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = word;
      }
    }

    return { match: bestMatch, score: bestScore };
  }

  /**
   * Generates top N suggestions for a token.
   * @param {string} token
   * @param {Set<string>|Array<string>} [vocab]
   * @param {number} [limit=3]
   * @returns {Array<{ word: string, score: number }>}
   */
  suggest(token, vocab = this.staticVocabulary, limit = 3) {
    const scored = [];
    for (const word of vocab) {
      const score = this.similarity(token, word);
      if (score >= nlpThresholds.SUGGEST_CORRECTION_CONFIDENCE) {
        scored.push({ word, score });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Performs spelling correction across a full text string.
   * 
   * @param {string} text - Raw natural language text
   * @param {Object} [context={}] - Contextual vocabulary (locations, players, items)
   * @returns {{ correctedText: string, appliedCorrections: Array<{from: string, to: string, confidence: number}>, suggestedCorrections: Array<{from: string, to: string, confidence: number}>, confidence: number }}
   */
  correct(text = '', context = {}) {
    if (!text) {
      return { correctedText: '', appliedCorrections: [], suggestedCorrections: [], confidence: 1.0 };
    }

    // Build dynamic vocabulary
    const vocab = new Set(this.staticVocabulary);
    if (context.locations && Array.isArray(context.locations)) {
      context.locations.forEach((loc) => vocab.add(loc.toLowerCase()));
    }
    if (context.players && Array.isArray(context.players)) {
      context.players.forEach((p) => vocab.add(p.toLowerCase()));
    }
    if (context.macros && Array.isArray(context.macros)) {
      context.macros.forEach((m) => vocab.add(m.toLowerCase()));
    }

    const words = text.split(/\s+/);
    const correctedWords = [];
    const appliedCorrections = [];
    const suggestedCorrections = [];
    let totalConfidence = 0;

    for (const rawWord of words) {
      const clean = rawWord.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!clean || clean.length < 2 || !isNaN(Number(clean))) {
        correctedWords.push(rawWord);
        totalConfidence += 1.0;
        continue;
      }

      // Check if word is already a recognized canonical word or synonym alias
      if (vocab.has(clean) || synonymRegistry.itemAliases[clean] || (synonymRegistry.kitAliases && synonymRegistry.kitAliases[clean])) {
        correctedWords.push(rawWord);
        totalConfidence += 1.0;
        continue;
      }

      const { match, score } = this.findBestMatch(clean, vocab);

      if (match && score >= nlpThresholds.AUTO_CORRECT_CONFIDENCE) {
        // High confidence (>0.90): auto-correct
        correctedWords.push(match);
        appliedCorrections.push({ from: rawWord, to: match, confidence: score });
        totalConfidence += score;
      } else if (match && score >= nlpThresholds.SUGGEST_CORRECTION_CONFIDENCE) {
        // Medium confidence (0.70-0.90): suggest correction
        correctedWords.push(rawWord);
        suggestedCorrections.push({ from: rawWord, to: match, confidence: score });
        totalConfidence += score;
      } else {
        correctedWords.push(rawWord);
        totalConfidence += score;
      }
    }

    const avgConfidence = words.length > 0 ? totalConfidence / words.length : 1.0;

    return {
      correctedText: correctedWords.join(' '),
      appliedCorrections,
      suggestedCorrections,
      confidence: Math.round(avgConfidence * 100) / 100
    };
  }
}

module.exports = new SpellCorrector();
