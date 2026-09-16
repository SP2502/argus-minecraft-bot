const test = require('node:test');
const assert = require('node:assert');
const UnifiedCommandGateway = require('../src/modules/commands/UnifiedCommandGateway');
const CommandPlanner = require('../src/modules/commands/CommandPlanner');
const intentParser = require('../src/modules/nlp/IntentParser');
const conversationContext = require('../src/modules/commands/ConversationContextManager');
const confirmationManager = require('../src/modules/commands/ConfirmationManager');

test('Ambient & Homestead Commands - Gateway NLP, Planning, and RBAC Execution', async () => {
  let toggledState = null;
  let sleepTriggered = false;
  let wakeTriggered = false;

  const mockCtx = {
    bot: { username: 'Argus', health: 20, food: 20, entity: { position: { x: 0, y: 64, z: 0 } } },
    locations: {
      listByType: async () => [],
      getBase: async (name) => ({ name, x: 50, y: 64, z: 50 })
    },
    permissions: {
      checkRateLimit: () => true,
      hasPermission: async (username, role) => {
        if (username === 'AdminPlayer' || username === 'OwnerPlayer') return true;
        if (username === 'TrustedPlayer') return role === 'trusted' || role === 'guest';
        if (username === 'GuestPlayer') return role === 'guest';
        return false;
      },
      recordFailedAttempt: () => {}
    },
    conversationContext,
    confirmations: confirmationManager,
    nlp: intentParser,
    taskManager: {
      addTask: () => {}
    },
    messageRouter: {
      handleSocialGreeting: () => false,
      respondToCommand: async () => {}
    },
    ambient: {
      toggle: async (enable) => {
        toggledState = enable;
        return enable;
      },
      checkSleepRoutine: async () => {
        sleepTriggered = true;
        return true;
      },
      wake: async () => {
        wakeTriggered = true;
      }
    }
  };

  mockCtx.commandPlanner = new CommandPlanner(mockCtx);
  const gateway = new UnifiedCommandGateway(mockCtx);

  // 1. "enable ambient" by TrustedPlayer -> allowed (status: success)
  const enableReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'enable ambient'
  };
  const enableRes = await gateway.execute(enableReq);
  assert.strictEqual(enableRes.ok, true);
  assert.strictEqual(enableRes.status, 'success');
  assert.strictEqual(toggledState, true);

  // 2. "disable ambient" by TrustedPlayer -> allowed (status: success)
  const disableReq = {
    source: 'dashboard',
    senderId: 'TrustedPlayer',
    message: 'disable ambient'
  };
  const disableRes = await gateway.execute(disableReq);
  assert.strictEqual(disableRes.ok, true);
  assert.strictEqual(disableRes.status, 'success');
  assert.strictEqual(toggledState, false);

  // 3. "sleep" by TrustedPlayer -> allowed (status: success)
  const sleepReq = {
    source: 'minecraft',
    senderId: 'TrustedPlayer',
    message: 'sleep'
  };
  const sleepRes = await gateway.execute(sleepReq);
  assert.strictEqual(sleepRes.ok, true);
  assert.strictEqual(sleepRes.status, 'success');
  assert.strictEqual(sleepTriggered, true);

  // 4. "wake up" by GuestPlayer -> allowed (guest permission tier)
  const wakeReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'wake up'
  };
  const wakeRes = await gateway.execute(wakeReq);
  assert.strictEqual(wakeRes.ok, true);
  assert.strictEqual(wakeRes.status, 'success');
  assert.strictEqual(wakeTriggered, true);

  // 5. "enable ambient" by GuestPlayer -> denied (requires TRUSTED)
  const guestDeniedReq = {
    source: 'minecraft',
    senderId: 'GuestPlayer',
    message: 'enable ambient'
  };
  const guestDeniedRes = await gateway.execute(guestDeniedReq);
  assert.strictEqual(guestDeniedRes.ok, false);
  assert.strictEqual(guestDeniedRes.status, 'denied');
});
