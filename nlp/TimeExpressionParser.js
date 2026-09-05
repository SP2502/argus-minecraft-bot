/**
 * TimeExpressionParser - Parses duration expressions, environmental conditions, and recurring schedules.
 */
class TimeExpressionParser {
  /**
   * Parses time expressions into standardized duration or condition objects.
   * 
   * @param {string} text - Input text snippet
   * @returns {Object|null}
   */
  parse(text = '') {
    if (!text || typeof text !== 'string') return null;
    const clean = text.toLowerCase().trim();

    // 1. Duration: "for 5 minutes", "for 2 hours", "for 30s", "in 10 minutes"
    const durationRegex = /(?:for|in)\s+(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d)/i;
    const durMatch = clean.match(durationRegex);
    if (durMatch) {
      const val = parseFloat(durMatch[1]);
      const unit = durMatch[2].toLowerCase();

      let durationMs = val * 1000;
      if (unit.startsWith('m') && !unit.startsWith('ms')) durationMs = val * 60 * 1000;
      else if (unit.startsWith('h')) durationMs = val * 60 * 60 * 1000;
      else if (unit.startsWith('d')) durationMs = val * 24 * 60 * 60 * 1000;

      return {
        type: 'duration',
        value: val,
        unit,
        durationMs,
        raw: text
      };
    }

    // 2. Conditions: "until night", "until dawn", "until inventory full", "until done"
    const untilRegex = /until\s+(night|day|dawn|dusk|morning|done|full|inventory\s*full|empty)/i;
    const untilMatch = clean.match(untilRegex);
    if (untilMatch) {
      const condition = untilMatch[1].replace(/\s+/g, '_').toLowerCase();
      return {
        type: 'condition',
        condition,
        raw: text
      };
    }

    // 3. Recurring schedule expressions (Structured for future Scheduler phase)
    const everyRegex = /every\s+(\d+)?\s*(seconds?|minutes?|hours?|day)/i;
    const everyMatch = clean.match(everyRegex);
    if (everyMatch) {
      const intervalVal = everyMatch[1] ? parseInt(everyMatch[1], 10) : 1;
      const unit = everyMatch[2].toLowerCase();
      return {
        type: 'schedule_recurring',
        interval: intervalVal,
        unit,
        isRecurring: true,
        raw: text
      };
    }

    return null;
  }
}

module.exports = new TimeExpressionParser();
