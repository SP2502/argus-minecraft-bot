const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionToken, verifySessionToken, extractBearerToken } = require('../../../src/modules/dashboard');

test('SessionAuth creates and verifies signed dashboard sessions', () => {
  const originalPassword = process.env.DASHBOARD_PASSWORD;
  const originalSecret = process.env.DASHBOARD_SESSION_SECRET;
  process.env.DASHBOARD_PASSWORD = 'a-secure-dashboard-password';
  process.env.DASHBOARD_SESSION_SECRET = 'a-secure-dashboard-session-secret-with-32-characters';

  try {
    const token = createSessionToken('ShadowPace', 'owner');
    assert.equal(verifySessionToken(token).username, 'ShadowPace');
    assert.equal(verifySessionToken(`${token}tampered`), null);
    assert.equal(extractBearerToken({ authorization: `Bearer ${token}` }), token);
    assert.equal(extractBearerToken({ authorization: 'Basic credentials' }), null);
  } finally {
    if (originalPassword === undefined) delete process.env.DASHBOARD_PASSWORD;
    else process.env.DASHBOARD_PASSWORD = originalPassword;
    if (originalSecret === undefined) delete process.env.DASHBOARD_SESSION_SECRET;
    else process.env.DASHBOARD_SESSION_SECRET = originalSecret;
  }
});
