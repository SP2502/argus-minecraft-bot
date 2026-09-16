/**
 * CommandTokenizer - Lexical analyzer for Minecraft natural language commands.
 * Preserves spans, handles quoted literals, strips color codes, and normalizes delimiters.
 */
class CommandTokenizer {
  /**
   * Tokenizes an input string into rich token objects.
   * @param {string} input - Raw input string
   * @returns {Array<{ token: string, normalized: string, raw: string, start: number, end: number, isQuoted: boolean }>}
   */
  tokenize(input = '') {
    if (!input || typeof input !== 'string') return [];

    // Strip Minecraft formatting color codes (§a, §r, etc.)
    const cleanInput = input.replace(/§[0-9a-fk-or]/gi, '');
    const tokens = [];

    // Regex to match quoted strings ("..."), words, numbers, and special symbols
    const tokenRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
    let match;

    while ((match = tokenRegex.exec(cleanInput)) !== null) {
      const isDoubleQuoted = match[1] !== undefined;
      const isSingleQuoted = match[2] !== undefined;
      const isQuoted = isDoubleQuoted || isSingleQuoted;

      const raw = match[0];
      const tokenValue = isDoubleQuoted ? match[1] : isSingleQuoted ? match[2] : match[3];

      // Normalize token: lowercase, replace underscores with hyphens or spaces where appropriate
      let normalized = tokenValue.toLowerCase().trim();
      if (!isQuoted) {
        // Strip trailing commas/semicolons from unquoted tokens
        normalized = normalized.replace(/^[,;]+|[,;]+$/g, '');
      }

      if (normalized.length > 0) {
        tokens.push({
          token: tokenValue,
          normalized,
          raw,
          start: match.index,
          end: match.index + raw.length,
          isQuoted
        });
      }
    }

    return tokens;
  }

  /**
   * Splits input into compound sub-clauses based on sequential/conditional connectors.
   * Connectors: 'then', 'and then', 'after that', ';', 'if', 'when', 'unless'.
   * 
   * @param {string} input
   * @returns {Array<{ text: string, connector: string|null, index: number }>}
   */
  splitClauses(input = '') {
    if (!input) return [];
    const clean = input.replace(/§[0-9a-fk-or]/gi, '').trim();

    // Match connectors outside of quotes
    const clauses = [];
    const splitRegex = /\s+(?:then|and then|after that|afterwards|;\s*)\s*|;\s*|\s+and\s+(?=(?:go|mine|farm|store|deposit|retrieve|sort|drop|follow|stay|stop|resume)\b)/i;
    const parts = clean.split(splitRegex);

    for (let i = 0; i < parts.length; i++) {
      const clauseText = parts[i].trim();
      if (clauseText.length > 0) {
        clauses.push({
          text: clauseText,
          connector: i > 0 ? 'then' : null,
          index: i
        });
      }
    }

    return clauses.length > 0 ? clauses : [{ text: clean, connector: null, index: 0 }];
  }
}

module.exports = new CommandTokenizer();
