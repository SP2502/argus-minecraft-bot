const commandPolicies = require('../security/command-policies');

const NUMBER_WORDS = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100
};

/**
 * QuantityParser - Parses numeric values, number words, stack units, and relative quantifiers.
 */
class QuantityParser {
  /**
   * Parses quantity expressions from natural language tokens or text.
   * 
   * @param {string} text - Input text snippet
   * @returns {{ value: number|null, mode: 'exact'|'all'|'relative_half'|'relative_some'|'default', raw: string, error?: string }}
   */
  parse(text = '') {
    if (!text || typeof text !== 'string') {
      return { value: null, mode: 'default', raw: '' };
    }

    const clean = text.toLowerCase().trim().replace(/,/g, '');

    // 1. Relative Quantifiers
    if (clean === 'all' || clean === 'everything' || clean === 'max' || clean === 'full') {
      return { value: null, mode: 'all', raw: text };
    }
    if (clean === 'half' || clean === 'half of it') {
      return { value: 32, mode: 'relative_half', raw: text };
    }
    if (clean === 'some' || clean === 'a few' || clean === 'a couple') {
      return { value: 16, mode: 'relative_some', raw: text };
    }

    // 2. Minecraft Stack Multipliers (e.g. "2 stacks", "a stack", "half stack", "3 staks")
    const stackRegex = /^(?:(\d+|a|one|two|three|four|five|six|seven|eight|half)\s+)?(?:staks?|stacks?)$/i;
    const stackMatch = clean.match(stackRegex);
    if (stackMatch) {
      let multiplier = 1;
      const countPart = stackMatch[1];
      if (countPart === 'half') {
        return { value: 32, mode: 'exact', raw: text };
      } else if (countPart && countPart !== 'a') {
        multiplier = !isNaN(Number(countPart)) ? Number(countPart) : (NUMBER_WORDS[countPart] || 1);
      }
      const total = multiplier * 64;
      return this._validateCap(total, text);
    }

    // Dozen Multiplier
    if (clean === 'a dozen' || clean === 'dozen') {
      return { value: 12, mode: 'exact', raw: text };
    }

    // 3. Plain Numeric (e.g. "64", "128", "1024")
    const num = Number(clean);
    if (!isNaN(num) && Number.isInteger(num) && num > 0) {
      return this._validateCap(num, text);
    }

    // 4. Number Words (e.g. "sixty four", "twenty", "thirty two")
    const words = clean.split(/\s+/);
    let totalWordNum = 0;
    let validWordFound = false;

    for (const w of words) {
      if (NUMBER_WORDS[w] !== undefined) {
        totalWordNum += NUMBER_WORDS[w];
        validWordFound = true;
      }
    }

    if (validWordFound && totalWordNum > 0) {
      return this._validateCap(totalWordNum, text);
    }

    return { value: null, mode: 'default', raw: text };
  }

  /**
   * Helper validating requested quantity against policy limits.
   * @private
   */
  _validateCap(amount, raw) {
    if (amount <= 0) {
      return { value: 1, mode: 'exact', raw, error: 'Quantity must be positive (defaulted to 1).' };
    }

    const maxAllowed = commandPolicies.MAX_REQUESTED_QUANTITY;
    if (amount > maxAllowed) {
      return {
        value: maxAllowed,
        mode: 'exact',
        raw,
        warning: `Requested quantity (${amount}) exceeds maximum allowed inventory capacity (${maxAllowed}). Capped at ${maxAllowed}.`
      };
    }

    return { value: amount, mode: 'exact', raw };
  }
}

module.exports = new QuantityParser();
