const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register combat domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'combat.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  CombatSkill: require('./combat.skill'),
  CombatService: require('./combat.service'),
  MobTactics: require('./mob-tactics'),
  combatPolicies: require('./combat.policy'),
  combatData: require('./combat.data'),
  combatConfig: require('./combat.config'),
};
