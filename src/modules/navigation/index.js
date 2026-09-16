const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register navigation and location domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'navigation.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'locations.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  NavigationSkill: require('./navigation.skill'),
  NavigationService: require('./navigation.service'),
  LocationRegistry: require('./locations.repository'),
  Location: require('./location.model'),
  movementCosts: require('./movement-costs'),
};
