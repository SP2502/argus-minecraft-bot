const TICK_END_PROTOCOL = 768; // Minecraft 1.21.2
const MOVEMENT_PACKETS = new Set(['position', 'position_look', 'look', 'flying']);

/** Pairs movement with a tick boundary on older Mineflayer builds talking to Paper 26.3. */
module.exports = function enableMovementTickCompat(bot) {
  const client = bot._client;
  const write = client.write.bind(client);

  client.write = (name, packet) => {
    const result = write(name, packet);
    if (bot.protocolVersion >= TICK_END_PROTOCOL && MOVEMENT_PACKETS.has(name)) {
      write('tick_end', {});
    }
    return result;
  };
};
