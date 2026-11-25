const assert = require('node:assert/strict');
const test = require('node:test');
const createMinecraftDiagnostics = require('../../src/core/minecraft-diagnostics');

test('classifies transport, version, and keepalive failures by attempt phase', () => {
  let time = 100;
  const tracker = createMinecraftDiagnostics(() => time);
  tracker.begin('1.21.4', 'offline');
  tracker.fail('connect ETIMEDOUT', 'ETIMEDOUT');
  assert.equal(tracker.snapshot().failure.category, 'transport');
  tracker.scheduleRetry(120000);
  assert.equal(tracker.snapshot().nextRetryAt, 120100);

  time = 200;
  tracker.begin('auto', 'offline');
  assert.equal(tracker.snapshot().nextRetryAt, null);
  tracker.advance('login');
  tracker.fail('Unsupported protocol version: -1');
  assert.equal(tracker.snapshot().failure.category, 'protocol');
  assert.equal(tracker.snapshot().failure.label, 'Server did not advertise a usable Minecraft version');

  tracker.begin('1.21.4', 'offline');
  tracker.advance('spawn', '1.21.4');
  tracker.advance('world');
  tracker.fail('Timed out', 'KICKED');
  assert.equal(tracker.snapshot().failure.category, 'keepalive');
  assert.equal(tracker.snapshot().negotiatedVersion, '1.21.4');
});
