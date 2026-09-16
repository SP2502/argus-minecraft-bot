const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register farming domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'farming.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  FarmSkill: require('./farming.skill'),
  cropsData: require('./crops.data'),
  cropData: require('./crops.data'),
};
