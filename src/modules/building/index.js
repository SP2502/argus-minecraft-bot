const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register building domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'building.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  BuildSkill: require('./building.skill'),
  schematics: require('./schematics'),
  buildingData: require('./building.data'),
  buildingPolicies: require('./building.policy'),
  buildingConfig: require('./building.config'),
};
