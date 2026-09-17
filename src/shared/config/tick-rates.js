/**
 * AI Decision Engine Tick Rates in Milliseconds
 */
module.exports = Object.freeze({
  COMBAT: 50,          // Fast reaction loop when under hostile engagement
  ACTIVE: 100,         // Loop rate when tasks are actively processing
  IDLE: 500,           // Normal background monitoring rate
  DASHBOARD_ONLY: 1000 // Low frequency rate when completely idle
});
