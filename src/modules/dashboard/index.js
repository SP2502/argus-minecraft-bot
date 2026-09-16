const { startServer } = require('./api/server');
const sessionAuth = require('./session-auth');

module.exports = {
  startServer,
  sessionAuth,
  createSessionToken: sessionAuth.createSessionToken,
  verifySessionToken: sessionAuth.verifySessionToken,
  extractBearerToken: sessionAuth.extractBearerToken,
  validateConfig: sessionAuth.validateConfig
};
