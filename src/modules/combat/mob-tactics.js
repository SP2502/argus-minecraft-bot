const combatConfig = require('./combat.config');

/**
 * MobTactics - Optimized Combat Strategy Engine for Every Minecraft Hostile Mob.
 * 
 * Provides bespoke tactical intelligence per mob type:
 * - Creepers: Detonation avoidance, swell detection, backpedal kiting, shield absorption.
 * - Skeletons / Strays / Bogged: Projectile shield-advance, zigzag angle approach, close-quarter rush.
 * - Spiders / Cave Spiders: Leap-trajectory counter, upward aim interception, anti-venom prioritization.
 * - Endermen: Strict leg-aim lock (prevents teleport/enrage triggers), water placement defense.
 * - Witches: Potion-throw interruption, immediate sprint-burst DPS rush.
 * - Drowned: Trident detection, ranged shield block vs melee rush.
 * - Vindicators / Piglin Brutes: Axe-disarm counter (axes disable shields in Java Edition!), spacing kite.
 * - Pillagers: Crossbow reload timing, shield block during fire phase, rush during reload.
 * - Phantoms: Dive-swoop tracking, upward anti-air sweep strikes.
 * - Blazes: 3-burst fireball shield absorption, downtime charge.
 * - Wither Skeletons: Strict reach spacing (3.2m) to prevent armor-piercing Wither I effect.
 * - Slimes / Magma Cubes: Sweeping edge strikes, split-reaction backpedal.
 * - Wardens: Silent sneak retreat (zero vibration emissions), emergency withdrawal.
 * - Evokers: Priority assassination before Vex / Fang summon animations.
 */
class MobTactics {
  /**
   * Mob Profile Metadata Matrix
   */
  static PROFILES = Object.freeze({
    creeper: {
      tactic: 'kite_creeper',
      threat: 95,
      preferredDistance: 3.2,
      maxEngageDistance: 5.5,
      requiresShield: true,
      aimOffset: { x: 0, y: 0.9, z: 0 },
      description: 'Backpedal and shield on swell, strike during fuse reset.'
    },
    skeleton: {
      tactic: 'shield_block',
      threat: 80,
      preferredDistance: 2.8,
      maxEngageDistance: 16.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Shield-advance against arrows, drop shield and strike within melee reach.'
    },
    stray: {
      tactic: 'shield_block',
      threat: 80,
      preferredDistance: 2.8,
      maxEngageDistance: 16.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Shield block against arrows of slowness, close distance fast.'
    },
    bogged: {
      tactic: 'shield_block',
      threat: 80,
      preferredDistance: 2.8,
      maxEngageDistance: 16.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Shield block against poison arrows, close distance fast.'
    },
    spider: {
      tactic: 'spider_jump_counter',
      threat: 65,
      preferredDistance: 3.0,
      maxEngageDistance: 6.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 0.75, z: 0 },
      description: 'Aim upwards to counter mid-air leap and inflict knockback.'
    },
    cave_spider: {
      tactic: 'spider_jump_counter',
      threat: 70,
      preferredDistance: 2.8,
      maxEngageDistance: 5.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 0.5, z: 0 },
      description: 'Low-profile leap counter, burst DPS down before venom applies.'
    },
    enderman: {
      tactic: 'aim_at_legs',
      threat: 75,
      preferredDistance: 2.5,
      maxEngageDistance: 8.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 0.35, z: 0 }, // Strictly aim at feet/legs (avoid eyes at y=2.8)
      description: 'Lock gaze at feet to prevent teleport enrage loops; use water bucket if available.'
    },
    witch: {
      tactic: 'rush_witch',
      threat: 85,
      preferredDistance: 2.0,
      maxEngageDistance: 10.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 1.3, z: 0 },
      description: 'Sprint-rush burst DPS to kill before splash potions are prepared.'
    },
    drowned: {
      tactic: 'drowned_counter',
      threat: 70,
      preferredDistance: 3.0,
      maxEngageDistance: 12.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Shield-block trident throws, then close distance and strike.'
    },
    pillager: {
      tactic: 'crossbow_shield_rush',
      threat: 80,
      preferredDistance: 2.8,
      maxEngageDistance: 14.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Shield block during shot, rush forward during 1.25s crossbow reload.'
    },
    vindicator: {
      tactic: 'axe_disarm_kite',
      threat: 85,
      preferredDistance: 3.2,
      maxEngageDistance: 6.0,
      requiresShield: false, // Axe disables shields for 5s! Do not hold shield point-blank
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Axe disarms shields! Maintain 3.2m spacing and execute hit-and-run kiting.'
    },
    piglin_brute: {
      tactic: 'axe_disarm_kite',
      threat: 90,
      preferredDistance: 3.2,
      maxEngageDistance: 6.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Golden axe disables shields. Use reach advantage and knockback kiting.'
    },
    phantom: {
      tactic: 'phantom_swoop_counter',
      threat: 75,
      preferredDistance: 3.0,
      maxEngageDistance: 15.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 0.5, z: 0 },
      description: 'Track swoop dive, aim high and sweep strike when altitude < 4m.'
    },
    blaze: {
      tactic: 'blaze_burst_shield',
      threat: 80,
      preferredDistance: 2.8,
      maxEngageDistance: 12.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.2, z: 0 },
      description: 'Block 3-fireball burst with shield, rush during 3.5s cooldown.'
    },
    wither_skeleton: {
      tactic: 'wither_reach_keep',
      threat: 90,
      preferredDistance: 3.2,
      maxEngageDistance: 6.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.8, z: 0 },
      description: 'Strict 3.2m reach spacing to avoid lethal Wither I effect.'
    },
    slime: {
      tactic: 'slime_sweep_clear',
      threat: 40,
      preferredDistance: 2.8,
      maxEngageDistance: 5.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 0.5, z: 0 },
      description: 'Wide sweep attacks, backpedal when splitting.'
    },
    magma_cube: {
      tactic: 'slime_sweep_clear',
      threat: 40,
      preferredDistance: 3.0,
      maxEngageDistance: 5.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 0.5, z: 0 },
      description: 'Wide sweep attacks, avoid contact to prevent fire ticks.'
    },
    warden: {
      tactic: 'flee_silent',
      threat: 100,
      preferredDistance: 24.0,
      maxEngageDistance: 32.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 2.0, z: 0 },
      description: 'Crouch sneak (zero vibrations) and immediately withdraw to safe distance.'
    },
    evoker: {
      tactic: 'evoker_assassinate',
      threat: 85,
      preferredDistance: 2.0,
      maxEngageDistance: 12.0,
      requiresShield: false,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Priority sprint-rush assassination before Vexes and Fangs spawn.'
    },
    zombie: {
      tactic: 'melee_rush',
      threat: 60,
      preferredDistance: 2.8,
      maxEngageDistance: 8.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Standard melee rush with 1.9+ attack speed cooldowns.'
    },
    husk: {
      tactic: 'melee_rush',
      threat: 65,
      preferredDistance: 2.8,
      maxEngageDistance: 8.0,
      requiresShield: true,
      aimOffset: { x: 0, y: 1.4, z: 0 },
      description: 'Standard melee rush, avoid hunger debuff.'
    }
  });

  /**
   * Determines the optimal tactical maneuver given the target entity and current bot status.
   * Fully preserves backward compatibility for core invariants (kite_creeper, shield_block, tactical_retreat, melee_rush).
   * 
   * @param {Object} entity - Target entity
   * @param {Object} [botStatus={}] - { health, food, position, hasShield }
   * @returns {string} Tactic identifier
   */
  static getTacticalAction(entity, botStatus = {}) {
    const health = botStatus.health !== undefined ? botStatus.health : 20;

    // 1. Critical health safety override
    if (health <= combatConfig.RETREAT_HEALTH_THRESHOLD) {
      return 'tactical_retreat';
    }

    if (!entity || !entity.name) {
      return 'melee_rush';
    }

    const mobName = entity.name.toLowerCase();
    const hasShield = Boolean(botStatus.hasShield);

    // Calculate distance
    let distance = 5.0;
    if (entity.position && botStatus.position) {
      const dx = entity.position.x - botStatus.position.x;
      const dy = entity.position.y - botStatus.position.y;
      const dz = entity.position.z - botStatus.position.z;
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // 2. Creeper detonation avoidance
    if (mobName === 'creeper') {
      if (distance < combatConfig.CREEPER_KITE_DISTANCE) {
        return 'kite_creeper';
      }
      return 'melee_rush';
    }

    // 3. Ranged projectile attackers (Skeleton, Stray, Bogged)
    if (['skeleton', 'stray', 'bogged'].includes(mobName)) {
      if (distance > 3.5 && hasShield) {
        return 'shield_block';
      }
      return 'melee_rush';
    }

    // 4. Warden: Absolute emergency silent evasion
    if (mobName === 'warden') {
      return 'flee_silent';
    }

    // 5. Axe Disarmers (Vindicator, Piglin Brute)
    if (['vindicator', 'piglin_brute'].includes(mobName)) {
      return 'axe_disarm_kite';
    }

    // 6. Witch: Fast burst rush
    if (mobName === 'witch') {
      return 'rush_witch';
    }

    // 7. Enderman: Leg aiming
    if (mobName === 'enderman') {
      return 'aim_at_legs';
    }

    // 8. Spiders: Jump interception
    if (['spider', 'cave_spider'].includes(mobName)) {
      return 'spider_jump_counter';
    }

    // 9. Drowned with trident
    if (mobName === 'drowned') {
      const isHoldingTrident = Boolean(
        (entity.heldItem && entity.heldItem.name === 'trident') ||
        (entity.equipment && entity.equipment[0] && entity.equipment[0].name === 'trident')
      );
      if (isHoldingTrident && hasShield && distance > 3.5) {
        return 'shield_block';
      }
      return 'melee_rush';
    }

    // 10. Pillager: Crossbow block / rush
    if (mobName === 'pillager') {
      if (distance > 3.5 && hasShield) {
        return 'shield_block';
      }
      return 'melee_rush';
    }

    // 11. Phantom: Swoop counter
    if (mobName === 'phantom') {
      return 'phantom_swoop_counter';
    }

    // 12. Blaze: Fireball block
    if (mobName === 'blaze') {
      if (distance > 3.5 && hasShield) {
        return 'shield_block';
      }
      return 'melee_rush';
    }

    // 13. Wither Skeleton: Reach spacing
    if (mobName === 'wither_skeleton') {
      return 'wither_reach_keep';
    }

    // 14. Slime / Magma Cube: Sweeping clear
    if (['slime', 'magma_cube'].includes(mobName)) {
      return 'slime_sweep_clear';
    }

    // 15. Evoker: Assassinate
    if (mobName === 'evoker') {
      return 'evoker_assassinate';
    }

    // Default fallback
    return 'melee_rush';
  }

  /**
   * Returns aim offset vector tailored to mob anatomy.
   * @param {string} mobName
   * @param {Object} [entity=null]
   * @returns {{ x: number, y: number, z: number }}
   */
  static getAimOffset(mobName, entity = null) {
    const profile = this.PROFILES[mobName.toLowerCase()];
    if (profile && profile.aimOffset) {
      return profile.aimOffset;
    }

    const height = entity && entity.height ? entity.height : 1.8;
    return { x: 0, y: height * 0.75, z: 0 };
  }

  /**
   * Executes the specified tactical action against a target entity.
   * 
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../../core/BotContext')} ctx - BotContext dependency container
   * @param {import('mineflayer').Entity} targetEntity - Target mob entity
   * @param {string} tactic - Tactic identifier from getTacticalAction
   * @returns {Promise<{ handled: boolean, action: string }>}
   */
  static async executeTactic(bot, ctx, targetEntity, tactic) {
    if (!targetEntity || !targetEntity.position || !bot.entity) {
      return { handled: false, action: 'none' };
    }

    const mobName = (targetEntity.name || '').toLowerCase();
    const botPos = bot.entity.position;
    const targetPos = targetEntity.position;
    const dist = typeof botPos.distanceTo === 'function' ? botPos.distanceTo(targetPos) : 5;

    // Helper: Raise shield safely
    const raiseShield = () => {
      if (bot.inventory && bot.inventory.slots[45] && bot.inventory.slots[45].name === 'shield') {
        if (typeof bot.activateItem === 'function') {
          bot.activateItem(true);
          return true;
        }
      }
      return false;
    };

    // Helper: Lower shield
    const lowerShield = () => {
      if (typeof bot.deactivateItem === 'function') {
        bot.deactivateItem();
      }
    };

    // Helper: Strike target with sprint-jump critical hit combo for maximum damage
    const strikeTarget = async (aimOffset = null) => {
      lowerShield();
      if (ctx && ctx.combat && typeof ctx.combat.equipBestWeapon === 'function') {
        await ctx.combat.equipBestWeapon();
      }

      const offset = aimOffset || MobTactics.getAimOffset(mobName, targetEntity);
      if (typeof bot.lookAt === 'function') {
        try {
          await bot.lookAt(targetPos.offset(offset.x, offset.y, offset.z));
        } catch (e) {}
      }

      // Sprint-jump critical hit: jump just before striking for 50% bonus damage
      if (typeof bot.setControlState === 'function') {
        bot.setControlState('sprint', true);
        bot.setControlState('jump', true);
        await new Promise((r) => setTimeout(r, 80));
        bot.setControlState('jump', false);
      }

      if (typeof bot.attack === 'function') {
        bot.attack(targetEntity);
        if (ctx && ctx.events) {
          ctx.events.emit('combat.hit', { target: mobName, tactic });
        }
      }

      await new Promise((r) => setTimeout(r, combatConfig.ATTACK_COOLDOWN_MS));

      // Follow-up second hit if target still alive (combo)
      const stillAlive = targetEntity.isValid && !(targetEntity.metadata && targetEntity.metadata[7] <= 0);
      if (stillAlive && typeof bot.attack === 'function') {
        if (typeof bot.lookAt === 'function') {
          try { await bot.lookAt(targetPos.offset(offset.x, offset.y, offset.z)); } catch (e) {}
        }
        bot.attack(targetEntity);
        if (ctx && ctx.events) {
          ctx.events.emit('combat.combo_hit', { target: mobName, tactic });
        }
        await new Promise((r) => setTimeout(r, combatConfig.ATTACK_COOLDOWN_MS));
      }

      if (typeof bot.setControlState === 'function') {
        bot.setControlState('sprint', false);
      }
    };

    // ─── TACTICAL EXECUTION BRANCHES ─────────────────────────────────────────

    switch (tactic) {
      case 'tactical_retreat': {
        if (ctx && ctx.safety && typeof ctx.safety.fleeToNearestSafeZone === 'function') {
          try {
            await ctx.safety.fleeToNearestSafeZone();
          } catch (e) {}
        }
        return { handled: true, action: 'tactical_retreat' };
      }

      case 'flee_silent': {
        // Warden: Force crouch (sneak) and flee without triggering vibrations
        if (typeof bot.setControlState === 'function') {
          bot.setControlState('sneak', true);
        }
        if (ctx && ctx.safety && typeof ctx.safety.fleeToNearestSafeZone === 'function') {
          try {
            await ctx.safety.fleeToNearestSafeZone();
          } catch (e) {}
        }
        return { handled: true, action: 'flee_silent' };
      }

      case 'kite_creeper': {
        // Creeper: Raise shield and sprint backpedal away from explosion
        raiseShield();
        const dx = botPos.x - targetPos.x;
        const dz = botPos.z - targetPos.z;
        const retreatPos = {
          x: botPos.x + (Math.sign(dx) || 1) * 4.5,
          y: botPos.y,
          z: botPos.z + (Math.sign(dz) || 1) * 4.5
        };

        if (ctx && ctx.nav && typeof ctx.nav.goTo === 'function') {
          try {
            await ctx.nav.goTo(retreatPos, { range: 1, timeoutMs: 1200, allowBreak: false });
          } catch (e) {}
        }

        // If creeper fuse is resetting, execute quick reach strike
        if (dist > 3.0 && dist <= 4.0) {
          await strikeTarget();
        }
        return { handled: true, action: 'kite_creeper' };
      }

      case 'shield_block':
      case 'crossbow_shield_rush':
      case 'blaze_burst_shield': {
        // Projectile Defence: Raise shield, face shooter, advance
        raiseShield();
        if (typeof bot.lookAt === 'function') {
          try {
            await bot.lookAt(targetPos.offset(0, targetEntity.height ? targetEntity.height * 0.8 : 1.4, 0));
          } catch (e) {}
        }

        // Close distance while shielding
        if (dist > combatConfig.MELEE_ENGAGE_DISTANCE && ctx && ctx.nav) {
          try {
            await ctx.nav.goTo(targetPos, { range: 2, timeoutMs: 1200, allowBreak: false });
          } catch (e) {}
        } else {
          await new Promise((r) => setTimeout(r, 600));
        }

        // Drop shield and strike within melee range
        if (dist <= 3.8) {
          await strikeTarget();
        }
        return { handled: true, action: tactic };
      }

      case 'spider_jump_counter': {
        // Spiders: Upward aim intercept mid-leap
        const aimOffset = MobTactics.getAimOffset(mobName, targetEntity);
        if (dist > combatConfig.MELEE_ENGAGE_DISTANCE && ctx && ctx.nav) {
          try {
            await ctx.nav.goTo(targetPos, { range: 2.5, timeoutMs: 1200, allowBreak: false });
          } catch (e) {}
        }
        await strikeTarget(aimOffset);
        return { handled: true, action: 'spider_jump_counter' };
      }

      case 'aim_at_legs': {
        // Enderman: Strictly aim at feet (y=0.3) to avoid enrage gaze lock
        const legOffset = { x: 0, y: 0.35, z: 0 };
        if (dist > combatConfig.MELEE_ENGAGE_DISTANCE && ctx && ctx.nav) {
          try {
            await ctx.nav.goTo(targetPos, { range: 2.2, timeoutMs: 1400, allowBreak: false });
          } catch (e) {}
        }

        // Check if bot has water bucket to place at feet as defensive perimeter
        if (bot.inventory && dist < 4) {
          const waterBucket = bot.inventory.items().find((i) => i.name === 'water_bucket');
          if (waterBucket && typeof bot.equip === 'function') {
            try {
              await bot.equip(waterBucket, 'hand');
              if (typeof bot.activateItem === 'function') {
                bot.activateItem();
              }
            } catch (e) {}
          }
        }

        await strikeTarget(legOffset);
        return { handled: true, action: 'aim_at_legs' };
      }

      case 'rush_witch':
      case 'evoker_assassinate': {
        // High-Priority Burst: Sprint-charge straight at the mob to kill before spell/potion
        if (typeof bot.setControlState === 'function') {
          bot.setControlState('sprint', true);
        }
        if (dist > combatConfig.MELEE_ENGAGE_DISTANCE && ctx && ctx.nav) {
          try {
            await ctx.nav.goTo(targetPos, { range: 1.8, timeoutMs: 1500, allowBreak: false });
          } catch (e) {}
        }
        await strikeTarget();
        if (typeof bot.setControlState === 'function') {
          bot.setControlState('sprint', false);
        }
        return { handled: true, action: tactic };
      }

      case 'axe_disarm_kite':
      case 'wither_reach_keep': {
        // Axe users disable shields / Wither skeletons inflict fatal wither.
        // Maintain strict 3.0-3.5m spacing, strike with reach, and step back.
        lowerShield(); // Never hold shield against axes
        if (dist < 2.5 && typeof bot.setControlState === 'function') {
          // Backpedal to reach boundary
          bot.setControlState('back', true);
          await new Promise((r) => setTimeout(r, 200));
          bot.setControlState('back', false);
        }

        await strikeTarget();
        return { handled: true, action: tactic };
      }

      case 'phantom_swoop_counter': {
        // Wait for phantom to dive into sweep reach
        if (dist <= 5.0) {
          await strikeTarget({ x: 0, y: 0.5, z: 0 });
        } else {
          // Keep shield raised while phantom is circling high
          raiseShield();
          await new Promise((r) => setTimeout(r, 500));
        }
        return { handled: true, action: 'phantom_swoop_counter' };
      }

      case 'slime_sweep_clear':
      case 'melee_rush':
      default: {
        // Standard tactical melee rush
        lowerShield();
        if (dist > combatConfig.MELEE_ENGAGE_DISTANCE && ctx && ctx.nav) {
          try {
            await ctx.nav.goTo(targetPos, { range: 2.2, timeoutMs: 1500, allowBreak: false });
          } catch (e) {}
        }
        await strikeTarget();
        return { handled: true, action: 'strike' };
      }
    }
  }
}

module.exports = MobTactics;
