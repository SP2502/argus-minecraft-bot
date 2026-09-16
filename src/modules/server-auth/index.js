const serverAuthManager = require('./server-auth.service');
const ServerPassword = require('./server-password.model');
const createServerAuthRouter = require('./server-auth.routes');

module.exports = {
  serverAuthManager,
  ServerAuthManager: serverAuthManager,
  ServerPassword,
  createServerAuthRouter
};
