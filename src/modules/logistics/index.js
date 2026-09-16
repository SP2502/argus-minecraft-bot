const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register logistics domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'logistics.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  LogisticsSkill: require('./logistics.skill'),
  LogisticsService: require('./logistics.service'),
  logisticsData: require('./logistics.data'),
  logisticsConfig: require('./logistics.config'),
  Chest: require('./chest.model'),
};
