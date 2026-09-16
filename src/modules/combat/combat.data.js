/**
 * Combat Data - Static Definitions for Mobs, Weapons, Threat Ratings, and Drops.
 * Pure data — no Mineflayer calls and no logic.
 */
module.exports = {
  hostileMobs: [
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'witch',
    'enderman', 'drowned', 'husk', 'stray', 'pillager', 'vindicator',
    'phantom', 'slime', 'magma_cube', 'blaze', 'ghast', 'wither_skeleton',
    'piglin_brute', 'ravager', 'warden', 'evoker', 'shulker', 'silverfish'
  ],

  passiveMobs: [
    'player', 'villager', 'iron_golem', 'wolf', 'cat', 'horse',
    'donkey', 'mule', 'cow', 'sheep', 'pig', 'chicken', 'bee',
    'allay', 'fox', 'axolotl', 'parrot', 'strider', 'snow_golem'
  ],

  baseThreatScores: {
    creeper: 95,
    warden: 100,
    wither_skeleton: 90,
    piglin_brute: 90,
    vindicator: 85,
    evoker: 85,
    witch: 85,
    skeleton: 80,
    stray: 80,
    pillager: 80,
    blaze: 80,
    enderman: 75,
    phantom: 75,
    drowned: 70,
    cave_spider: 70,
    spider: 65,
    husk: 65,
    zombie: 60,
    slime: 40,
    magma_cube: 40,
    silverfish: 35
  },

  weaponTiers: {
    netherite_axe: 10,
    diamond_axe: 9,
    iron_axe: 9,
    stone_axe: 9,
    netherite_sword: 8,
    diamond_sword: 7,
    wooden_axe: 7,
    iron_sword: 6,
    stone_sword: 5,
    wooden_sword: 4
  },

  combatDrops: [
    'rotten_flesh', 'bone', 'string', 'spider_eye', 'gunpowder',
    'arrow', 'ender_pearl', 'blaze_rod', 'slime_ball', 'magma_cream',
    'totem_of_undying', 'iron_ingot', 'gold_ingot', 'emerald', 'bow'
  ],

  aliases: {
    zombies: 'zombie',
    skeletons: 'skeleton',
    creepers: 'creeper',
    spiders: 'spider',
    witches: 'witch',
    endermen: 'enderman',
    phantoms: 'phantom',
    pillagers: 'pillager',
    drowned: 'drowned',
    monsters: 'any',
    hostiles: 'any',
    mobs: 'any',
    enemies: 'any',
    threats: 'any'
  },

  defaults: {
    mode: 'hunt',
    targetMob: 'any',
    quantity: 10,
    searchRadius: 32,
    collectDrops: true,
    allowRetreat: true
  }
};
