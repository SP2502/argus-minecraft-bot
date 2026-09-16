const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register mining domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'mining.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  MineSkill: require('./mining.skill'),
  miningData: require('./mining.data'),
  oreData: require('./mining.data'),
};
