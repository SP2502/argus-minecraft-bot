const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

// Register forestry domain intents
try {
  intentRegistry.registerIntentFile(path.join(__dirname, 'forestry.intents.json'));
} catch (_err) {
  // Ignore if already registered
}

module.exports = {
  ChopTreeSkill: require('./forestry.skill'),
  TreeAnalyzer: require('./tree-analyzer'),
  treeData: require('./forestry.data'),
  forestryPolicies: require('./forestry.policy'),
  forestryConfig: require('./forestry.config'),
};
