const test = require('node:test');
const assert = require('node:assert');
const { serverAuthManager } = require('../../../src/modules/server-auth');

test('ServerAuthManager - In-Game Server Auth & Offline Database Suite', async (t) => {
  await t.test('Password Generation - Cryptographic Security & Format', () => {
    const pwd1 = serverAuthManager.generatePassword(16);
    const pwd2 = serverAuthManager.generatePassword(16);
    const customUserPwd = serverAuthManager.generatePassword(16, 'CustomUser_');

    assert.strictEqual(pwd1.length, 16, 'Default generated password is 16 characters');
    assert.strictEqual(customUserPwd.startsWith('CustomUser_'), true, 'Custom prefix is respected');
    assert.notStrictEqual(pwd1, pwd2, 'Passwords are cryptographically random and unique');
    assert.match(pwd1, /^[a-zA-Z0-9_]+$/, 'Contains only safe alphanumeric and underscore characters');
  });

  await t.test('Offline Database - Save, Retain, Fetch, and Delete', async () => {
    const testHost = 'mc.testserver.net';
    const testPort = 25565;
    const testUser = 'ArgusTestBot';
    const testPass = 'Argus_SecretPass123';

    // 1. Save credential to offline database
    const saved = await serverAuthManager.saveCredential(testHost, testPort, testUser, testPass, {
      registerCommand: '/register',
      loginCommand: '/login'
    });
    assert.strictEqual(saved.password, testPass, 'Password stored correctly');
    assert.strictEqual(saved.username, testUser);

    // 2. Fetch credential (retaining password for second-time join)
    const fetched = await serverAuthManager.getCredential(testHost, testPort, testUser);
    assert.ok(fetched, 'Successfully fetched credential from offline database');
    assert.strictEqual(fetched.password, testPass, 'Retained exact password');

    // 3. User can fetch all credentials from database
    const all = await serverAuthManager.getAllCredentials();
    assert.ok(all.length >= 1, 'Database contains stored credentials');
    assert.ok(all.find((c) => c.serverKey === saved.serverKey), 'Contains newly added server key');

    // 4. Delete credential
    const deleted = await serverAuthManager.deleteCredential(testHost, testPort, testUser);
    assert.strictEqual(deleted, true, 'Successfully deleted credential');
    const afterDelete = await serverAuthManager.getCredential(testHost, testPort, testUser);
    assert.strictEqual(afterDelete, null, 'Credential removed from offline database');
  });

  await t.test('Prompt Parsing - Various Register and Login Formats', () => {
    // AuthMe standard
    const p1 = serverAuthManager.detectAuthPrompt('Please register: /register <password> <confirmPassword>');
    assert.deepStrictEqual(p1, { type: 'register', command: '/register', format: 'two_args' });

    // Short alias /reg
    const p2 = serverAuthManager.detectAuthPrompt('Use /reg <password> <confirmPassword>');
    assert.deepStrictEqual(p2, { type: 'register', command: '/reg', format: 'two_args' });

    // Single-arg register
    const p3 = serverAuthManager.detectAuthPrompt('Use /register <password>');
    assert.deepStrictEqual(p3, { type: 'register', command: '/register', format: 'one_arg' });

    // Register with email
    const p4 = serverAuthManager.detectAuthPrompt('Type /register <password> <email>');
    assert.deepStrictEqual(p4, { type: 'register', command: '/register', format: 'with_email' });

    // Standard /login
    const p5 = serverAuthManager.detectAuthPrompt('Please login: /login <password>');
    assert.deepStrictEqual(p5, { type: 'login', command: '/login', format: 'one_arg' });

    // Short alias /l
    const p6 = serverAuthManager.detectAuthPrompt('Please login with /l <password>');
    assert.deepStrictEqual(p6, { type: 'login', command: '/l', format: 'one_arg' });

    // Short alias /log
    const p7 = serverAuthManager.detectAuthPrompt('Please login with /log <password>');
    assert.deepStrictEqual(p7, { type: 'login', command: '/log', format: 'one_arg' });

    // Multilingual Spanish /register
    const p8 = serverAuthManager.detectAuthPrompt('Por favor registrese usando /register <clave> <clave>');
    assert.strictEqual(p8.type, 'register');

    // Captcha code
    const p9 = serverAuthManager.detectAuthPrompt('Type /captcha 4921 to verify you are human');
    assert.deepStrictEqual(p9, { type: 'captcha', command: '/captcha', format: 'code', code: '4921' });
  });

  await t.test('In-Game Lifecycle - Second-time Join & Password Retention', async () => {
    const host = 'mc.retention.org';
    const port = 25565;
    const username = 'RetentionBot';
    const password = 'Argus_Retained999';

    // Simulate pre-existing registration in offline database
    await serverAuthManager.saveCredential(host, port, username, password);

    let sentChat = null;
    const mockBot = {
      username,
      chat: (msg) => { sentChat = msg; }
    };

    process.env.MC_HOST = host;
    process.env.MC_PORT = String(port);

    // Server sends login prompt on second-time join
    await serverAuthManager.handleServerMessage('Please login with /login <password>', mockBot);

    // Wait for the 800ms safety dispatch timer
    await new Promise((r) => setTimeout(r, 900));

    assert.strictEqual(sentChat, `/login ${password}`, 'Bot automatically logged in with retained password');

    // Cleanup
    await serverAuthManager.deleteCredential(host, port, username);
  });

  await t.test('Server Database Reset - Detection and Automatic Re-registration', async () => {
    const host = 'mc.resetserver.org';
    const port = 25565;
    const username = 'ResetBot';
    const password = 'Argus_SafePassReset';

    // Bot previously registered on this server
    await serverAuthManager.saveCredential(host, port, username, password, { resetsCount: 0 });

    let sentChat = null;
    const mockBot = {
      username,
      chat: (msg) => { sentChat = msg; }
    };

    process.env.MC_HOST = host;
    process.env.MC_PORT = String(port);

    // The server database was RESET! Server asks for /register again instead of /login
    await serverAuthManager.handleServerMessage('Server database wiped. Please /register <password> <confirmPassword>', mockBot);

    // Wait for safety dispatch timer
    await new Promise((r) => setTimeout(r, 900));

    assert.strictEqual(sentChat, `/register ${password} ${password}`, 'Re-registered using the retained password');

    // Verify reset counter was incremented in offline database
    const updated = await serverAuthManager.getCredential(host, port, username);
    assert.strictEqual(updated.resetsCount, 1, 'resetsCount incremented to 1');
    assert.ok(updated.lastResetAt, 'lastResetAt timestamp recorded');

    // Cleanup
    await serverAuthManager.deleteCredential(host, port, username);
  });
});
