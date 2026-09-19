const test = require('node:test');
const assert = require('node:assert');
const EventEmitter = require('events');
const BotContext = require('../../src/core/BotContext');
const { PermissionTiers } = require('../../src/modules/security');

function createMockBot() {
  const bot = new EventEmitter();
  bot.username = 'ArgusSecurityBot';
  bot.health = 20;
  bot.food = 20;
  bot.entity = {
    position: { x: 0, y: 64, z: 0, floored: () => ({ x: 0, y: 64, z: 0 }) }
  };
  bot.inventory = {
    items: () => [],
    slots: new Array(45).fill(null)
  };
  bot.loadPlugin = () => {};
  bot.pathfinder = {
    setGoal: () => {},
    setMovements: () => {},
    stop: () => {}
  };
  return bot;
}

test('Security Subsystem, RBAC & Brute-Force Lockout Integration Suite', async (t) => {
  await t.test('5-Tier RBAC enforces role requirements on incoming commands', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const owner = 'SecurityMaster';
    ctx.permissionManager.ownerUsername = owner;

    // Guest user attempts admin-level command ('mine 16 iron_ore')
    const guestRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: 'RandomGuest',
      message: 'mine 16 iron_ore'
    });

    assert.strictEqual(guestRes.status, 'denied');
    assert.ok(guestRes.message.includes("requires 'ADMIN' role tier"));

    // Owner attempts same command -> allowed & queued
    const ownerRes = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: owner,
      message: 'mine 16 iron_ore'
    });

    assert.strictEqual(ownerRes.status, 'queued');
  });

  await t.test('Compound command plans are atomically rejected if ANY step exceeds permissions', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const owner = 'SecurityMaster';
    ctx.permissionManager.ownerUsername = owner;

    // Grant 'trusted' to player. Trusted can 'go_to', but cannot 'mine' (requires admin)
    await ctx.permissionManager.grant('TrustedPlayer', 'trusted', owner);

    const res = await ctx.commandGateway.execute({
      source: 'minecraft',
      senderId: 'TrustedPlayer',
      message: 'mine 16 iron_ore then go home'
    });

    assert.strictEqual(res.status, 'denied');
    assert.ok(res.message.includes("requires 'ADMIN' role tier"));
    assert.strictEqual(ctx.taskManager.getQueueSnapshot().queue.length, 0, 'No tasks were queued');
  });

  await t.test('Brute-force protection auto-blocks attacker after 3 failed attempts in 5 minutes', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    ctx.permissionManager.ownerUsername = 'SecurityMaster';

    const attacker = 'BadActor';

    // Send 3 unauthorized attempts
    for (let i = 0; i < 3; i++) {
      const res = await ctx.commandGateway.execute({
        source: 'minecraft',
        senderId: attacker,
        message: 'mine 64 diamonds'
      });
      assert.strictEqual(res.status, 'denied');
    }

    // Verify attacker is temporarily blocked
    assert.strictEqual(ctx.permissionManager.tempBlockedUsers.has(attacker.toLowerCase()), true, 'User is auto-blocked in tempBlockedUsers after 3 failed attempts');

    // Subsequent command should be blocked even if asking for public status
    const blockedRes = await ctx.permissionManager.hasPermission(attacker, PermissionTiers.GUEST);
    assert.strictEqual(blockedRes, false, 'Blocked user denied even lowest tier permission');
  });

  await t.test('Owner privileges are immutable and cannot be revoked or demoted', async () => {
    const bot = createMockBot();
    const ctx = new BotContext(bot);
    const owner = 'ImmortalOwner';
    ctx.permissionManager.ownerUsername = owner;

    // Attempt to demote owner to guest
    const res = await ctx.permissionManager.grant(owner, 'guest', 'MaliciousAdmin');
    assert.strictEqual(res, null, 'Owner demotion must return null');

    // Attempt to revoke owner
    const revokeRes = await ctx.permissionManager.revoke(owner, 'MaliciousAdmin');
    assert.strictEqual(revokeRes, null, 'Owner revocation must return null');

    // Confirm owner retains max tier
    const isOwner = await ctx.permissionManager.hasPermission(owner, PermissionTiers.OWNER);
    assert.strictEqual(isOwner, true, 'Owner retains Tier 4 privileges');
  });
});
