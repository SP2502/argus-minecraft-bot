const test = require('node:test');
const assert = require('node:assert');
const MobTactics = require('../skills/combat/MobTactics');

test('MobTactics - Tactic Resolution Across All Minecraft Hostile Mobs', () => {
  const botHealthyWithShield = { health: 20, position: { x: 0, y: 64, z: 0 }, hasShield: true };
  const botHealthyNoShield = { health: 20, position: { x: 0, y: 64, z: 0 }, hasShield: false };
  const botCritical = { health: 5, position: { x: 0, y: 64, z: 0 }, hasShield: true };

  // 1. Critical health safety check
  assert.strictEqual(MobTactics.getTacticalAction({ name: 'zombie' }, botCritical), 'tactical_retreat');

  // 2. Creeper
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'creeper', position: { x: 3, y: 64, z: 0 } }, botHealthyWithShield),
    'kite_creeper'
  );

  // 3. Skeletons / Strays / Bogged
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'skeleton', position: { x: 10, y: 64, z: 0 } }, botHealthyWithShield),
    'shield_block'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'stray', position: { x: 8, y: 64, z: 0 } }, botHealthyWithShield),
    'shield_block'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'bogged', position: { x: 8, y: 64, z: 0 } }, botHealthyWithShield),
    'shield_block'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'skeleton', position: { x: 10, y: 64, z: 0 } }, botHealthyNoShield),
    'melee_rush'
  );

  // 4. Warden (Silent evasion)
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'warden', position: { x: 15, y: 64, z: 0 } }, botHealthyWithShield),
    'flee_silent'
  );

  // 5. Axe Disarmers (Vindicator, Piglin Brute)
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'vindicator', position: { x: 4, y: 64, z: 0 } }, botHealthyWithShield),
    'axe_disarm_kite'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'piglin_brute', position: { x: 4, y: 64, z: 0 } }, botHealthyWithShield),
    'axe_disarm_kite'
  );

  // 6. Witch (Burst charge)
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'witch', position: { x: 6, y: 64, z: 0 } }, botHealthyWithShield),
    'rush_witch'
  );

  // 7. Enderman (Leg Aim)
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'enderman', position: { x: 5, y: 64, z: 0 } }, botHealthyWithShield),
    'aim_at_legs'
  );

  // 8. Spiders (Jump counter)
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'spider', position: { x: 4, y: 64, z: 0 } }, botHealthyWithShield),
    'spider_jump_counter'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'cave_spider', position: { x: 3, y: 64, z: 0 } }, botHealthyWithShield),
    'spider_jump_counter'
  );

  // 9. Drowned with Trident vs Normal
  const drownedTrident = {
    name: 'drowned',
    position: { x: 8, y: 64, z: 0 },
    heldItem: { name: 'trident' }
  };
  const drownedMelee = {
    name: 'drowned',
    position: { x: 8, y: 64, z: 0 }
  };
  assert.strictEqual(MobTactics.getTacticalAction(drownedTrident, botHealthyWithShield), 'shield_block');
  assert.strictEqual(MobTactics.getTacticalAction(drownedMelee, botHealthyWithShield), 'melee_rush');

  // 10. Pillager
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'pillager', position: { x: 7, y: 64, z: 0 } }, botHealthyWithShield),
    'shield_block'
  );

  // 11. Phantom
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'phantom', position: { x: 6, y: 70, z: 0 } }, botHealthyWithShield),
    'phantom_swoop_counter'
  );

  // 12. Blaze
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'blaze', position: { x: 7, y: 64, z: 0 } }, botHealthyWithShield),
    'shield_block'
  );

  // 13. Wither Skeleton
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'wither_skeleton', position: { x: 4, y: 64, z: 0 } }, botHealthyWithShield),
    'wither_reach_keep'
  );

  // 14. Slime & Magma Cube
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'slime', position: { x: 3, y: 64, z: 0 } }, botHealthyWithShield),
    'slime_sweep_clear'
  );
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'magma_cube', position: { x: 3, y: 64, z: 0 } }, botHealthyWithShield),
    'slime_sweep_clear'
  );

  // 15. Evoker
  assert.strictEqual(
    MobTactics.getTacticalAction({ name: 'evoker', position: { x: 6, y: 64, z: 0 } }, botHealthyWithShield),
    'evoker_assassinate'
  );
});

test('MobTactics - Aim Offsets and Anatomy Tuning', () => {
  // Enderman aim should target feet (y <= 0.4) to avoid gazing at eyes
  const endermanAim = MobTactics.getAimOffset('enderman');
  assert.ok(endermanAim.y <= 0.4, `Enderman aim Y (${endermanAim.y}) should be at feet level <= 0.4`);

  // Spider aim should compensate upwards (y >= 0.7) for leap arc
  const spiderAim = MobTactics.getAimOffset('spider');
  assert.ok(spiderAim.y >= 0.7, `Spider aim Y (${spiderAim.y}) should compensate for leap >= 0.7`);

  // Standard mob
  const zombieAim = MobTactics.getAimOffset('zombie');
  assert.ok(zombieAim.y >= 1.2, `Zombie aim Y (${zombieAim.y}) should be upper torso/head >= 1.2`);
});

test('MobTactics - Execution Logic & Maneuvers', async () => {
  let lookTarget = null;
  let attackTarget = null;
  let controlStates = {};
  let activated = false;
  let deactivated = false;

  const mockBot = {
    entity: {
      position: {
        x: 0,
        y: 64,
        z: 0,
        distanceTo: () => 3.0
      }
    },
    inventory: {
      items: () => [{ name: 'diamond_sword' }, { name: 'water_bucket' }],
      slots: { 45: { name: 'shield' } }
    },
    lookAt: async (pos) => { lookTarget = pos; },
    attack: (entity) => { attackTarget = entity; },
    activateItem: (offhand) => { if (offhand) activated = true; },
    deactivateItem: () => { deactivated = true; },
    setControlState: (ctrl, state) => { controlStates[ctrl] = state; },
    equip: async () => true
  };

  const mockCtx = {
    bot: mockBot,
    combat: { equipBestWeapon: async () => true },
    events: { emit: () => {} },
    nav: { goTo: async () => true },
    safety: { fleeToNearestSafeZone: async () => true }
  };

  // Test Enderman execution (aim at legs)
  const endermanTarget = {
    name: 'enderman',
    position: {
      x: 3,
      y: 64,
      z: 0,
      offset: (dx, dy, dz) => ({ x: 3 + dx, y: 64 + dy, z: 0 + dz })
    }
  };
  const resEnderman = await MobTactics.executeTactic(mockBot, mockCtx, endermanTarget, 'aim_at_legs');
  assert.strictEqual(resEnderman.handled, true);
  assert.strictEqual(resEnderman.action, 'aim_at_legs');
  assert.ok(lookTarget !== null);
  assert.ok(lookTarget.y <= 64.4, 'Enderman look target must be aimed at feet');

  // Test Warden execution (silent sneak retreat)
  const wardenTarget = {
    name: 'warden',
    position: { x: 5, y: 64, z: 0 }
  };
  const resWarden = await MobTactics.executeTactic(mockBot, mockCtx, wardenTarget, 'flee_silent');
  assert.strictEqual(resWarden.handled, true);
  assert.strictEqual(resWarden.action, 'flee_silent');
  assert.strictEqual(controlStates.sneak, true, 'Sneak must be activated against Warden');
});
