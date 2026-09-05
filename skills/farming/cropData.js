/**
 * Crop Configuration Data
 * Pure data mapping: priorities, crop block metadata, growth estimates, and bone meal rules.
 */
module.exports = {
  // Crop priorities (higher = farm/harvest first during multi-crop routines)
  priorities: {
    cocoa: 25,
    nether_wart: 25,
    sugar_cane: 20,
    bamboo: 20,
    melon: 15,
    pumpkin: 15,
    wheat: 10,
    carrot: 10,
    potato: 10,
    beetroot: 10
  },

  // Crop block definitions and planting requirements
  crops: {
    wheat: {
      blockName: 'wheat',
      maxAge: 7, // Fully grown at metadata age 7
      seedItem: 'wheat_seeds',
      cropItem: 'wheat',
      plantOn: 'farmland'
    },
    carrot: {
      blockName: 'carrots',
      maxAge: 7,
      seedItem: 'carrot',
      cropItem: 'carrot',
      plantOn: 'farmland'
    },
    potato: {
      blockName: 'potatoes',
      maxAge: 7,
      seedItem: 'potato',
      cropItem: 'potato',
      plantOn: 'farmland'
    },
    beetroot: {
      blockName: 'beetroots',
      maxAge: 3,
      seedItem: 'beetroot_seeds',
      cropItem: 'beetroot',
      plantOn: 'farmland'
    },
    melon: {
      blockName: 'melon',
      maxAge: null, // Stem produces block; presence check
      seedItem: 'melon_seeds',
      cropItem: 'melon',
      plantOn: 'farmland'
    },
    pumpkin: {
      blockName: 'pumpkin',
      maxAge: null,
      seedItem: 'pumpkin_seeds',
      cropItem: 'pumpkin',
      plantOn: 'farmland'
    },
    sugar_cane: {
      blockName: 'sugar_cane',
      maxAge: null,
      seedItem: 'sugar_cane',
      cropItem: 'sugar_cane',
      plantOn: ['sand', 'dirt', 'grass_block', 'podzol', 'red_sand']
    },
    bamboo: {
      blockName: 'bamboo',
      maxAge: null,
      seedItem: 'bamboo',
      cropItem: 'bamboo',
      plantOn: ['sand', 'dirt', 'grass_block', 'podzol']
    },
    nether_wart: {
      blockName: 'nether_wart',
      maxAge: 3,
      seedItem: 'nether_wart',
      cropItem: 'nether_wart',
      plantOn: 'soul_sand'
    },
    cocoa: {
      blockName: 'cocoa',
      maxAge: 2, // 0 to 2 in modern Minecraft (or 3 in legacy)
      seedItem: 'cocoa_beans',
      cropItem: 'cocoa_beans',
      plantOn: 'jungle_log'
    }
  },

  // Growth time estimates in seconds (for dashboard ETAs and telemetry)
  growthTimes: {
    wheat: 1440,
    carrot: 1440,
    potato: 1440,
    beetroot: 1080,
    melon: 1800,
    pumpkin: 1800,
    sugar_cane: 1080,
    bamboo: 1080,
    nether_wart: 2400,
    cocoa: 1800
  },

  // Bone meal application flags
  useBoneMeal: {
    wheat: true,
    carrot: true,
    potato: true,
    beetroot: false,
    melon: true,
    pumpkin: true,
    sugar_cane: true,
    bamboo: true,
    nether_wart: false,
    cocoa: true
  }
};
