const test = require('node:test');
const assert = require('node:assert');
const confirmationManager = require('../../../src/modules/commands/ConfirmationManager');

test('ConfirmationManager - Sender Bound Confirmation Flow', () => {
  const requestUserA = {
    source: 'minecraft',
    senderId: 'Alice',
    sessionId: 'mc:Alice'
  };

  const requestUserB = {
    source: 'minecraft',
    senderId: 'Bob',
    sessionId: 'mc:Bob'
  };

  // User A requests dangerous drop
  const record = confirmationManager.requestConfirmation(
    requestUserA,
    { intentName: 'drop_all', skillName: 'inventory' },
    { item: 'diamond', all: true },
    'Confirm drop all diamonds?'
  );

  assert.ok(record.confirmationId.startsWith('conf_'));

  // User B tries to say 'yes' -> Must NOT confirm User A's action
  const resB = confirmationManager.resolveConfirmation(requestUserB, 'yes');
  assert.strictEqual(resB.status, 'not_found');

  // User A says 'yes' -> Successfully confirmed
  const resA = confirmationManager.resolveConfirmation(requestUserA, 'yes');
  assert.strictEqual(resA.status, 'confirmed');
  assert.strictEqual(resA.operation.intentName, 'drop_all');
});
