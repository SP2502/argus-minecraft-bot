const test = require('node:test');
const assert = require('node:assert');
const authManager = require('../core/AuthManager');

test('AuthManager & Network Reliability Test Suite', async (t) => {
  await t.test('Keep-Alive Timeout Configuration', () => {
    delete process.env.CHECK_TIMEOUT_INTERVAL;
    const credsDefault = authManager.loadCredentials();
    assert.strictEqual(credsDefault.checkTimeoutInterval, 60000, 'Default keep-alive timeout is 60,000ms (60s)');

    process.env.CHECK_TIMEOUT_INTERVAL = '90000';
    const credsCustom = authManager.loadCredentials();
    assert.strictEqual(credsCustom.checkTimeoutInterval, 90000, 'Custom CHECK_TIMEOUT_INTERVAL is respected');
    delete process.env.CHECK_TIMEOUT_INTERVAL;
  });

  await t.test('Version Resolution & Auto-Detection', () => {
    process.env.MC_VERSION = 'auto';
    const credsAuto = authManager.loadCredentials();
    assert.strictEqual(credsAuto.version, false, "'auto' version sets version to false for Mineflayer ping auto-detection");

    process.env.MC_VERSION = 'false';
    const credsFalse = authManager.loadCredentials();
    assert.strictEqual(credsFalse.version, false, "'false' version sets version to false");

    process.env.MC_VERSION = '1.20.4';
    const credsExplicit = authManager.loadCredentials();
    assert.strictEqual(credsExplicit.version, '1.20.4', 'Explicit version string is preserved');

    delete process.env.MC_VERSION;
    const credsDefault = authManager.loadCredentials();
    assert.strictEqual(credsDefault.version, false, 'Unset version defaults to false for auto-detection');
  });

  await t.test('Kick Reason Extraction Formatting', () => {
    // String reason
    const formatKickReason = (reason) => {
      if (!reason) return 'Unknown reason';
      if (typeof reason === 'string') return reason;
      if (reason.extra && Array.isArray(reason.extra)) {
        const text = reason.extra.map((e) => (typeof e === 'object' ? e.text || '' : String(e))).join('').trim();
        if (text) return text;
      }
      if (reason.text) return String(reason.text).trim();
      if (typeof reason.toString === 'function' && reason.toString() !== '[object Object]') {
        return reason.toString().trim();
      }
      try {
        return JSON.stringify(reason);
      } catch (e) {
        return String(reason);
      }
    };

    assert.strictEqual(formatKickReason('Kicked by admin'), 'Kicked by admin');
    assert.strictEqual(
      formatKickReason({ extra: [{ text: 'Outdated client! ' }, { text: 'Please use 1.20.2' }] }),
      'Outdated client! Please use 1.20.2'
    );
    assert.strictEqual(
      formatKickReason({ text: 'You are already connected to this server!' }),
      'You are already connected to this server!'
    );
  });

  await t.test('Exponential Backoff Progression', () => {
    const BASE_DELAY = 5000;
    const MAX_DELAY = 120000;
    const computeDelay = (attempt) => Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);

    assert.strictEqual(computeDelay(0), 5000, 'Attempt 0 delay is 5s');
    assert.strictEqual(computeDelay(1), 10000, 'Attempt 1 delay is 10s');
    assert.strictEqual(computeDelay(2), 20000, 'Attempt 2 delay is 20s');
    assert.strictEqual(computeDelay(3), 40000, 'Attempt 3 delay is 40s');
    assert.strictEqual(computeDelay(4), 80000, 'Attempt 4 delay is 80s');
    assert.strictEqual(computeDelay(5), 120000, 'Attempt 5 capped at 120s max');
    assert.strictEqual(computeDelay(10), 120000, 'Attempt 10 capped at 120s max');
  });
});
