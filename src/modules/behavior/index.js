const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

intentRegistry.registerIntentFile(path.join(__dirname, 'ambient.intents.json'));

const HumanoidBehaviorService = require('./humanoid-behavior.service');
const AmbientBehaviorService = require('./ambient-behavior.service');
const ambientConfig = require('./ambient.config');
const greetings = require('./greetings');

module.exports = {
  HumanoidBehaviorService,
  AmbientBehaviorService,
  ambientConfig,
  greetings
};
