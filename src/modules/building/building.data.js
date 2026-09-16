/**
 * Building Data - Static Definitions for Construction Materials, Obstacles, and Presets.
 * Pure data — no Mineflayer calls and no logic.
 */
module.exports = {
  validBuildingMaterials: [
    'cobblestone',
    'stone',
    'stone_bricks',
    'oak_planks',
    'birch_planks',
    'spruce_planks',
    'acacia_planks',
    'dark_oak_planks',
    'jungle_planks',
    'mangrove_planks',
    'cherry_planks',
    'dirt',
    'bricks',
    'glass',
    'sandstone',
    'cobbled_deepslate'
  ],

  softObstacleBlocks: [
    'grass',
    'tall_grass',
    'short_grass',
    'dandelion',
    'poppy',
    'blue_orchid',
    'allium',
    'azure_bluet',
    'red_tulip',
    'orange_tulip',
    'white_tulip',
    'pink_tulip',
    'oxeye_daisy',
    'cornflower',
    'lily_of_the_valley',
    'fern',
    'large_fern',
    'dead_bush',
    'snow',
    'brown_mushroom',
    'red_mushroom'
  ],

  defaultDimensions: {
    shelter: { width: 3, height: 3, depth: 3, material: 'cobblestone' },
    wall: { length: 8, height: 3, material: 'cobblestone', orientation: 'x' },
    floor: { width: 5, depth: 5, material: 'oak_planks' },
    cube: { width: 4, height: 3, depth: 4, material: 'cobblestone', hollow: true },
    stairs: { height: 4, material: 'cobblestone', direction: 'north' }
  },

  aliases: {
    shelter: 'shelter',
    house: 'shelter',
    hut: 'shelter',
    bunker: 'shelter',
    base: 'shelter',
    wall: 'wall',
    barrier: 'wall',
    fence: 'wall',
    floor: 'floor',
    platform: 'floor',
    slab: 'floor',
    ground: 'floor',
    cube: 'cube',
    box: 'cube',
    room: 'cube',
    stairs: 'stairs',
    staircase: 'stairs',
    steps: 'stairs'
  },

  materialAliases: {
    wood: 'oak_planks',
    planks: 'oak_planks',
    wooden_planks: 'oak_planks',
    cobble: 'cobblestone',
    stonebrick: 'stone_bricks',
    stone_brick: 'stone_bricks',
    deepslate: 'cobbled_deepslate',
    brick: 'bricks'
  },

  adjacentFaces: [
    { x: 0, y: -1, z: 0 }, // bottom
    { x: 0, y: 1, z: 0 },  // top
    { x: -1, y: 0, z: 0 }, // west
    { x: 1, y: 0, z: 0 },  // east
    { x: 0, y: 0, z: -1 }, // north
    { x: 0, y: 0, z: 1 }   // south
  ]
};
