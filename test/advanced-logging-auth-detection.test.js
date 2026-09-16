const test = require('node:test');
const assert = require('node:assert');
const serverAuthManager = require('../core/ServerAuthManager');
const { PermissionManager, PermissionTiers } = require('../security/PermissionManager');
const logger = require('../core/Logger');

test('Dynamic Owner Configuration & Elimination of Hardcoded Names', async (t) => {
  await t.test('PermissionManager strictly uses configured owner and rejects arbitrary ShadowPace without config', async () => {
    const pm = new PermissionManager();
    // Test with a completely custom owner name
    pm.ownerUsername = 'SuperGamer999';

    // SuperGamer999 has owner bypass
    assert.strictEqual(await pm.hasPermission('SuperGamer999', PermissionTiers.OWNER), true);
    assert.strictEqual(await pm.hasPermission('supergamer999', PermissionTiers.OWNER), true);
    assert.strictEqual(pm.checkRateLimit('SuperGamer999'), true);

    // ShadowPace does NOT have owner bypass when not configured as owner!
    assert.strictEqual(await pm.hasPermission('ShadowPace', PermissionTiers.OWNER), false);
    // Non-owner should not be able to bypass rate limits
    for (let i = 0; i < 10; i++) {
      pm.checkRateLimit('ShadowPace');
    }
    assert.strictEqual(pm.checkRateLimit('ShadowPace'), false, 'Unconfigured ShadowPace is subject to rate limiting');
  });

  await t.test('Owner privileges cannot be demoted or granted away', async () => {
    const pm = new PermissionManager();
    pm.ownerUsername = 'AlphaLeader';

    const res = await pm.grant('AlphaLeader', 'guest', 'AdminUser');
    assert.strictEqual(res, null, 'Owner modification was blocked');
    assert.strictEqual(await pm.hasPermission('AlphaLeader', PermissionTiers.OWNER), true);
  });
});

test('Server Authentication Detection Engine', async (t) => {
  await t.test('detectAuthPrompt identifies AuthMe, LoginSecurity, nLogin, and multi-language prompts', () => {
    // English AuthMe
    const p1 = serverAuthManager.detectAuthPrompt('Please register with: /register <password> <confirmPassword>');
    assert.strictEqual(p1.type, 'register');
    assert.strictEqual(p1.command, '/register');
    assert.strictEqual(p1.format, 'two_args');

    // Russian / English login prompt
    const p2 = serverAuthManager.detectAuthPrompt('Пожалуйста, авторизуйтесь: /login <password>');
    assert.strictEqual(p2.type, 'login');
    assert.strictEqual(p2.command, '/login');

    // Spanish register prompt
    const p3 = serverAuthManager.detectAuthPrompt('Por favor usa /register <password>');
    assert.strictEqual(p3.type, 'register');

    // Portuguese login prompt
    const p4 = serverAuthManager.detectAuthPrompt('Por favor faça login usando /l <password>');
    assert.strictEqual(p4.type, 'login');
    assert.strictEqual(p4.command, '/l');

    // Success confirmation prompt
    const p5 = serverAuthManager.detectAuthPrompt('§aSuccessful login! Welcome back to the server.');
    assert.strictEqual(p5.type, 'success');
  });

  await t.test('identifyPlugin recognizes specific auth systems from chat packets', () => {
    assert.strictEqual(serverAuthManager.identifyPlugin('[AuthMe] Please login using /login'), 'AuthMe Reloaded');
    assert.strictEqual(serverAuthManager.identifyPlugin('[nLogin] Registre-se usando /register'), 'nLogin');
    assert.strictEqual(serverAuthManager.identifyPlugin('[LoginSecurity] Password required: /login'), 'LoginSecurity');
    assert.strictEqual(serverAuthManager.identifyPlugin('[LimboAuth] Please authenticate'), 'LimboAuth');
    assert.strictEqual(serverAuthManager.identifyPlugin('Type /login <password> to play'), 'In-Game Auth Plugin (AuthMe / LoginSecurity / nLogin)');
  });

  await t.test('getAuthStatus reports detection and offline database state', async () => {
    serverAuthManager.resetDetectionState();
    const initialStatus = serverAuthManager.getAuthStatus();
    assert.strictEqual(initialStatus.status, 'unknown');
    assert.strictEqual(initialStatus.hasAuth, false);

    // Simulate detection of an AuthMe prompt
    const fakeBot = {
      username: 'ArgusBot',
      chat: () => {}
    };
    await serverAuthManager.handleServerMessage('[AuthMe] Use /register <password> <confirmPassword> to play!', fakeBot);

    const activeStatus = serverAuthManager.getAuthStatus();
    assert.strictEqual(activeStatus.hasAuth, true);
    assert.strictEqual(activeStatus.status, 'requires_registration');
    assert.strictEqual(activeStatus.detectedPlugin, 'AuthMe Reloaded');
    assert.strictEqual(activeStatus.details.type, 'register');
  });
});

test('Advanced Troubleshooting Logger Diagnostics', async (t) => {
  await t.test('Logger diagnose and diagnoseError handle error remedies without throwing', () => {
    assert.doesNotThrow(() => {
      logger.info('TEST', 'Testing info level logging');
      logger.success('TEST', 'Testing success level logging');
      logger.warn('TEST', 'Testing warn level logging');
      logger.network('TEST', 'Testing network logging');
      logger.auth('TEST', 'Testing auth logging');

      logger.diagnose('TEST DIAGNOSTIC CARD', {
        'Server': 'testagrus.aternos.me:22233',
        'Status': 'DIAGNOSIS_OK'
      }, 'info');

      // Test troubleshooting advice generation for ECONNREFUSED
      const err = new Error('connect ECONNREFUSED 127.0.0.1:22233');
      err.code = 'ECONNREFUSED';
      logger.diagnoseError(err, { host: 'testagrus.aternos.me', port: 22233 });
    });
  });
});
