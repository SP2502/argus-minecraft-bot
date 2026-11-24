const WORLD_SIGNAL_TIMEOUT_MS = 40000;

module.exports = function trackMinecraftPresence(bot, now = Date.now) {
  const client = bot._client;
  let spawnedAt = null;
  let lastPacketAt = null;
  let keepAlivePackets = 0;

  function recordWorldPacket() {
    if (client.state === 'play') lastPacketAt = now();
  }

  client.on('packet', recordWorldPacket);
  client.on('keep_alive', () => {
    if (client.state === 'play') keepAlivePackets++;
  });
  bot.on('spawn', () => {
    spawnedAt = now();
    lastPacketAt = spawnedAt;
  });

  return (ownerUsername) => {
    const sampleAt = now();
    const open = !client.ended && !client.socket?.destroyed;
    const inWorld = open && client.state === 'play' && spawnedAt !== null && Boolean(bot.entity);
    const fresh = inWorld && lastPacketAt !== null && sampleAt - lastPacketAt <= WORLD_SIGNAL_TIMEOUT_MS;
    const state = fresh ? 'connected' : (inWorld ? 'stale' : (open ? 'connecting' : 'disconnected'));
    const players = fresh && bot.players ? Object.entries(bot.players) : null;
    const ownerName = ownerUsername?.trim().toLowerCase();
    const owner = players?.find(([name]) => name.toLowerCase() === ownerName);
    const ownerPosition = owner?.[1]?.entity?.position;
    const botPosition = bot.entity?.position;
    const distance = ownerPosition && botPosition ?
      Math.hypot(ownerPosition.x - botPosition.x, ownerPosition.y - botPosition.y, ownerPosition.z - botPosition.z) : null;

    return {
      online: fresh,
      state,
      spawnedAt,
      lastPacketAt,
      keepAlivePackets,
      playerCount: players?.length ?? null,
      ownerListed: players && ownerName ? Boolean(owner) : null,
      ownerDistance: Number.isFinite(distance) ? Math.round(distance) : null,
      botListed: players && bot.username ?
        players.some(([name]) => name.toLowerCase() === bot.username.toLowerCase()) : null
    };
  };
};
