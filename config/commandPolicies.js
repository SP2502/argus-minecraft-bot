/**
 * Unified Command Policy Configuration
 */
module.exports = {
  MAX_COMMAND_LENGTH: Number(process.env.MAX_COMMAND_LENGTH || 500),
  MAX_REQUESTED_QUANTITY: Number(process.env.MAX_REQUESTED_QUANTITY || 2304), // 36 stacks (full inventory)
  DEFAULT_MINE_QUANTITY: 64,
  DEFAULT_FARM_MODE: 'harvest_mature',
  CLARIFICATION_TTL_MS: 60000,
  CONFIRMATION_TTL_MS: 60000,
  CONTEXT_TTL_MS: 10 * 60 * 1000, // 10 minutes
  MAX_CONTEXT_INTERACTIONS: 10,
  REQUIRE_PREFIX: process.env.REQUIRE_PREFIX === 'true',
  PREFIX: process.env.ARGUS_PREFIX || '',
};
