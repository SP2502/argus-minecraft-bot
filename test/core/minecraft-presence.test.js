const { EventEmitter } = require('node:events');
const assert = require('node:assert/strict');
const test = require('node:test');
const trackMinecraftPresence = require('../../src/core/minecraft-presence');

test('requires spawning and recent Minecraft packets before reporting in-world presence', () => {
  const bot = new EventEmitter();
  bot._client = Object.assign(new EventEmitter(), { state: 'play', socket: { destroyed: false } });
  bot.entity = { position: { x: 0, y: 64, z: 0 } };
  bot.username = 'Argus';
  bot.players = {
    Argus: {},
    SP2502: { entity: { position: { x: 3, y: 64, z: 4 } } }
  };
  let time = 1000;
  const read = trackMinecraftPresence(bot, () => time);

  assert.equal(read('SP2502').state, 'connecting');
  assert.equal(read('SP2502').online, false);
  bot.emit('spawn');
  assert.equal(read('sp2502').state, 'connected');
  assert.equal(read('sp2502').ownerDistance, 5);
  assert.equal(read('sp2502').playerCount, 2);
  assert.equal(read('sp2502').botListed, true);

  delete bot.players.SP2502.entity;
  assert.equal(read('SP2502').ownerListed, true);
  assert.equal(read('SP2502').ownerDistance, null);

  time += 41000;
  assert.equal(read('SP2502').state, 'stale');
  assert.equal(read('SP2502').playerCount, null);
  bot._client.emit('packet');
  bot._client.emit('keep_alive');
  assert.equal(read('SP2502').state, 'connected');
  assert.equal(read('SP2502').keepAlivePackets, 1);

  bot._client.socket.destroyed = true;
  assert.equal(read('SP2502').state, 'disconnected');
  assert.equal(read('SP2502').online, false);
});

test('dashboard stream traffic cannot renew expired Minecraft presence', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const script = fs.readFileSync(path.join(__dirname, '../../src/modules/dashboard/public/state/DashboardState.js'), 'utf8');
  let time = 1000;
  const window = {};
  vm.runInNewContext(script, { window, Date: { now: () => time }, console });
  const state = window.dashboardState;
  assert.equal(state.getMinecraftIndicator().label, 'Checking');
  state.setState('serverConfig', { online: true, connectionState: 'connected', presenceReceivedAt: time });
  assert.equal(state.getMinecraftIndicator().label, 'In world');
  time += 13000;
  state.markFresh();
  state.checkFreshness();
  assert.equal(state.get('connection').isStale, false);
  assert.equal(state.get('serverConfig').online, false);
  assert.equal(state.getMinecraftIndicator().label, 'Signal stale');
});
