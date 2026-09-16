/**
 * ChestInteract - Low-level helpers for interacting with chest and container blocks.
 * Pure functions operating on the passed-in bot and container objects.
 */

/**
 * Opens a chest block at the specified coordinates.
 * Looks at the chest, initiates opening, and returns the opened container window instance.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @param {{ x: number, y: number, z: number }} chestPosition - Chest block coordinates
 * @returns {Promise<import('mineflayer').Chest|import('prismarine-windows').Window>} Opened chest container window
 * @throws {Error} If chest block is not found or fails to open
 * @example
 * const chest = await openChest(bot, { x: 100, y: 64, z: 200 });
 */
async function openChest(bot, chestPosition) {
  if (!bot || !chestPosition) {
    throw new Error('[ChestInteract] Invalid bot or chestPosition provided.');
  }

  const pos = {
    x: Math.floor(chestPosition.x),
    y: Math.floor(chestPosition.y),
    z: Math.floor(chestPosition.z)
  };

  const chestBlock = bot.blockAt(pos);
  if (!chestBlock) {
    throw new Error(`[ChestInteract] No block loaded at (${pos.x}, ${pos.y}, ${pos.z}).`);
  }

  const validContainers = ['chest', 'trapped_chest', 'barrel', 'ender_chest', 'shulker_box'];
  const isContainer = validContainers.some((name) => chestBlock.name.includes(name));

  if (!isContainer) {
    throw new Error(`[ChestInteract] Block at (${pos.x}, ${pos.y}, ${pos.z}) is '${chestBlock.name}', not a recognized container.`);
  }

  // Look toward chest before opening
  try {
    await bot.lookAt(chestBlock.position.offset(0.5, 0.5, 0.5));
  } catch (lookErr) {
    // Non-critical if lookAt fails
  }

  const chest = await bot.openContainer(chestBlock);
  return chest;
}

/**
 * Deposits specified item stacks into an open chest container.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @param {import('mineflayer').Chest|import('prismarine-windows').Window} chest - Open chest window
 * @param {Array<{ type: number, metadata?: number|null, count: number, name?: string }>} items - Items to deposit
 * @returns {Promise<{ depositedCount: number, success: boolean }>}
 * @example
 * await moveItemsToChest(bot, chest, [{ type: 264, count: 10 }]);
 */
async function moveItemsToChest(bot, chest, items) {
  if (!chest || !Array.isArray(items)) {
    return { depositedCount: 0, success: false };
  }

  let totalDeposited = 0;

  for (const item of items) {
    if (!item || item.count <= 0) continue;
    try {
      // In Mineflayer, chest.deposit takes (itemType, metadata, count)
      await chest.deposit(item.type, item.metadata || null, item.count);
      totalDeposited += item.count;
    } catch (err) {
      console.warn(`[ChestInteract] Failed to deposit item ${item.name || item.type}:`, err.message);
    }
  }

  return { depositedCount: totalDeposited, success: true };
}

/**
 * Closes an open container window safely.
 * 
 * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
 * @param {import('mineflayer').Chest|import('prismarine-windows').Window} chest - Open container window
 * @returns {Promise<void>}
 * @example
 * await closeChest(bot, chest);
 */
async function closeChest(bot, chest) {
  if (chest && typeof chest.close === 'function') {
    try {
      chest.close();
    } catch (err) {
      console.warn('[ChestInteract] Error closing chest:', err.message);
    }
  }
}

/**
 * Returns an array of item descriptors currently inside the chest.
 * 
 * @param {import('mineflayer').Chest|import('prismarine-windows').Window} chest - Open chest container
 * @returns {Array<{ name: string, type: number, count: number, slot: number }>}
 * @example
 * const contents = getChestContents(chest);
 */
function getChestContents(chest) {
  if (!chest) return [];
  const items = typeof chest.containerItems === 'function'
    ? chest.containerItems()
    : (chest.items ? chest.items() : []);

  return items.map((item) => ({
    name: item.name,
    type: item.type,
    count: item.count,
    slot: item.slot
  }));
}

module.exports = {
  openChest,
  moveItemsToChest,
  closeChest,
  getChestContents
};
