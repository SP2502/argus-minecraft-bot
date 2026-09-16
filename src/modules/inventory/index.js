const path = require('path');
const intentRegistry = require('../nlp/IntentRegistry');

intentRegistry.registerIntentFile(path.join(__dirname, 'inventory.intents.json'));
intentRegistry.registerIntentFile(path.join(__dirname, 'crafting.intents.json'));

const InventoryService = require('./inventory.service');
const chestInteraction = require('./chest-interaction');
const CraftingService = require('./crafting.service');
const CraftSkill = require('./crafting.skill');
const craftingData = require('./crafting.data');
const craftingConfig = require('./crafting.config');
const itemCategories = require('./item-categories');
const toolTiers = require('./tool-tiers');

module.exports = {
  InventoryService,
  chestInteraction,
  openChest: chestInteraction.openChest,
  moveItemsToChest: chestInteraction.moveItemsToChest,
  closeChest: chestInteraction.closeChest,
  getChestContents: chestInteraction.getChestContents,
  CraftingService,
  CraftSkill,
  craftingData,
  craftingConfig,
  itemCategories,
  toolTiers
};
