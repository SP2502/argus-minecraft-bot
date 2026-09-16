const { BaseSkill } = require('../../../skills/BaseSkill');
const combatData = require('./combat.data');
const combatPolicies = require('./combat.policy');
const combatConfig = require('./combat.config');
const CombatHelperService = require('./combat.service');
const MobTactics = require('./mob-tactics');
const eventBus = require('../../core/EventBus');

/**
 * CombatSkill - Autonomous combat, hostile mob hunting, bodyguard protection, and base patrol.
 * Reuses NavigationService, TargetFinderService, ToolService, SafetyService, and InventoryService.
 */
class CombatSkill extends BaseSkill {
  /**
   * @param {import('../../core/BotContext')} ctx - BotContext dependency container
   */
  constructor(ctx) {
    super(ctx);
    this.name = 'combat';
    this.combatHelper = (ctx && ctx.combat) ? ctx.combat : new CombatHelperService(ctx.bot, ctx);
  }

  /**
   * Executes autonomous combat according to specified parameters and mode.
   * 
   * @param {Object} [params={}]
   * @param {'hunt'|'guard'|'patrol'} [params.mode='hunt'] - Combat operation mode
   * @param {string} [params.targetMob='any'] - Target mob name or 'any'
   * @param {number} [params.quantity=10] - Number of mobs to defeat in hunt mode
   * @param {number} [params.searchRadius=32] - Search radius in blocks
   * @param {string} [params.targetPlayer=null] - Player to guard in guard mode
   * @param {string|Object} [params.location=null] - Base location to defend or patrol
   * @param {Object} taskContext - TaskManager execution and checkpoint context
   * @returns {Promise<{mobsDefeated: number, damageDealt: number, durationMs: number}>}
   */
  async run(params = {}, taskContext) {
    const mode = params.mode || combatData.defaults.mode;
    const rawMob = params.targetMob || params.mob || combatData.defaults.targetMob;
    const targetMob = combatData.aliases[rawMob.toLowerCase()] || rawMob.toLowerCase();
    const targetQuantity = params.quantity !== undefined ? params.quantity : combatData.defaults.quantity;
    const searchRadius = params.searchRadius || combatConfig.DEFAULT_SEARCH_RADIUS;

    let mobsDefeated = (taskContext && taskContext.checkpoint && taskContext.checkpoint.mobsDefeated) || 0;
    const startTime = Date.now();

    eventBus.emit('combat.started', { mode, targetMob, targetQuantity, mobsDefeated });
    this.ctx.messageRouter.send(3, `Combat engaged: [${mode.toUpperCase()}] targeting ${targetMob} (Goal: ${targetQuantity}).`);

    // Prepare Loadout: Weapon + Shield
    await this.combatHelper.equipBestWeapon();
    await this.combatHelper.equipShield();

    // Setup player whitelist for guard mode
    if (this.ctx.permissions && typeof this.ctx.permissions.getTrustedPlayers === 'function') {
      const trusted = await this.ctx.permissions.getTrustedPlayers();
      this.combatHelper.setWhitelist(trusted);
    }

    try {
      if (mode === 'guard') {
        await this._runGuardLoop(params, taskContext);
      } else if (mode === 'patrol') {
        await this._runPatrolLoop(params, taskContext);
      } else {
        // Default: 'hunt' / 'clear'
        mobsDefeated = await this._runHuntLoop(targetMob, targetQuantity, searchRadius, mobsDefeated, taskContext);
      }
    } finally {
      this._lowerShield();
    }

    const durationMs = Date.now() - startTime;
    const result = { mobsDefeated, durationMs };

    eventBus.emit('combat.completed', result);
    this.ctx.messageRouter.send(3, `Combat operation complete: ${mobsDefeated} hostile targets eliminated.`);
    return result;
  }

  /**
   * Main hunting loop: locates matching hostiles and eliminates them.
   * @private
   */
  async _runHuntLoop(targetMob, targetQuantity, searchRadius, mobsDefeated, taskContext) {
    let consecutiveNoTargets = 0;

    while (mobsDefeated < targetQuantity) {
      await this._verifyCombatReadiness(taskContext);
      await this.safetyCheckLoop(taskContext);

      // Find highest threat hostile target
      const targetEntity = this._findHighestThreatHostile(targetMob, searchRadius);
      if (!targetEntity) {
        consecutiveNoTargets++;
        if (consecutiveNoTargets >= 3) {
          break; // Area is clear
        }
        await new Promise((r) => setTimeout(r, combatConfig.TARGET_SCAN_INTERVAL_MS));
        continue;
      }

      consecutiveNoTargets = 0;
      const defeated = await this._engageTarget(targetEntity, taskContext);
      if (defeated) {
        mobsDefeated++;
        eventBus.emit('combat.mob_killed', { mobType: targetEntity.name, mobsDefeated, targetQuantity });
        await this._collectCombatDrops(targetEntity.position);

        if (taskContext && typeof taskContext.saveCheckpoint === 'function') {
          taskContext.saveCheckpoint({ mode: 'hunt', targetMob, mobsDefeated, targetQuantity });
        }
      }
    }

    return mobsDefeated;
  }

  /**
   * Guard loop: guards a player or base location and eliminates approaching threats.
   * @private
   */
  async _runGuardLoop(params, taskContext) {
    const guardTargetName = params.targetPlayer;
    let guardPos = null;

    if (params.location && this.ctx.locations) {
      const loc = typeof params.location === 'string' ? await this.ctx.locations.getBase(params.location) : params.location;
      if (loc && loc.x !== undefined) guardPos = loc;
    }

    let iterations = 0;
    const maxIterations = 20; // Bound loop for task safety

    while (iterations < maxIterations) {
      await this.safetyCheckLoop(taskContext);
      await this._verifyCombatReadiness(taskContext);
      iterations++;

      // If guarding player, ensure proximity
      if (guardTargetName && this.bot.players && this.bot.players[guardTargetName]) {
        const playerEntity = this.bot.players[guardTargetName].entity;
        if (playerEntity && this.bot.entity) {
          const dist = this.bot.entity.position.distanceTo(playerEntity.position);
          if (dist > 6) {
            await this.ctx.nav.goTo(playerEntity.position, { range: 3, timeoutMs: 3000 });
          }
        }
      } else if (guardPos && this.bot.entity) {
        const dist = this.bot.entity.position.distanceTo(guardPos);
        if (dist > 10) {
          await this.ctx.nav.goTo(guardPos, { range: 2, timeoutMs: 4000 });
        }
      }

      // Check perimeter for approaching hostiles
      const threat = this._findHighestThreatHostile('any', combatConfig.GUARD_PERIMETER_RADIUS);
      if (threat) {
        this.ctx.messageRouter.send(3, `Perimeter alert: Intercepting hostile ${threat.name}!`);
        await this._engageTarget(threat, taskContext);
        await this._collectCombatDrops(threat.position);
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  /**
   * Patrol loop: moves along perimeter waypoints around base.
   * @private
   */
  async _runPatrolLoop(params, taskContext) {
    let basePos = this.bot.entity ? this.bot.entity.position : { x: 0, y: 64, z: 0 };
    if (params.location && this.ctx.locations) {
      const loc = typeof params.location === 'string' ? await this.ctx.locations.getBase(params.location) : params.location;
      if (loc && loc.x !== undefined) basePos = loc;
    }

    // Generate circular patrol perimeter
    const radius = 16;
    const waypoints = [
      { x: basePos.x + radius, y: basePos.y, z: basePos.z },
      { x: basePos.x, y: basePos.y, z: basePos.z + radius },
      { x: basePos.x - radius, y: basePos.y, z: basePos.z },
      { x: basePos.x, y: basePos.y, z: basePos.z - radius }
    ];

    for (const wp of waypoints) {
      await this.safetyCheckLoop(taskContext);
      await this._verifyCombatReadiness(taskContext);

      // Move toward waypoint
      await this.ctx.nav.goTo(wp, { range: 3, timeoutMs: 6000 });

      // Check for threats along route
      const threat = this._findHighestThreatHostile('any', combatConfig.GUARD_PERIMETER_RADIUS);
      if (threat) {
        await this._engageTarget(threat, taskContext);
        await this._collectCombatDrops(threat.position);
      }
    }
  }

  /**
   * Engages a single target entity using tactical maneuvers.
   * @private
   */
  async _engageTarget(targetEntity, taskContext) {
    eventBus.emit('combat.engaged', { mobType: targetEntity.name, position: targetEntity.position });
    let attackAttempts = 0;
    const maxAttempts = 15;

    while (attackAttempts < maxAttempts) {
      await this._verifyCombatReadiness(taskContext);
      await this.safetyCheckLoop(taskContext);

      // Check if entity is still valid and alive
      if (!targetEntity.isValid || (targetEntity.metadata && targetEntity.metadata[7] <= 0)) {
        return true; // Target killed
      }

      const tactics = this.combatHelper.calculateTactics(targetEntity);

      if (tactics === 'tactical_retreat') {
        await this._executeEmergencyRetreat(taskContext);
        return false;
      }

      // Execute mob-optimized tactical maneuver via MobTactics engine
      await MobTactics.executeTactic(this.bot, this.ctx, targetEntity, tactics);
      attackAttempts++;

      if (!targetEntity.isValid || (targetEntity.metadata && targetEntity.metadata[7] <= 0)) {
        return true;
      }
    }

    return !targetEntity.isValid;
  }

  /**
   * Scans nearby entities and selects the candidate with the highest threat score.
   * @private
   */
  _findHighestThreatHostile(targetMob, radius) {
    if (!this.bot.entities) return null;

    let bestTarget = null;
    let highestThreat = -1;

    for (const entity of Object.values(this.bot.entities)) {
      if (!entity || !entity.position) continue;
      if (this.bot.entity && this.bot.entity.position.distanceTo(entity.position) > radius) continue;

      if (combatPolicies.isHostile(entity, targetMob) && !this.combatHelper.isAlly(entity)) {
        const score = this.combatHelper.threatScore(entity);
        if (score > highestThreat) {
          highestThreat = score;
          bestTarget = entity;
        }
      }
    }

    return bestTarget;
  }

  /**
   * Checks tool durability and critical health thresholds before engaging.
   * @private
   */
  async _verifyCombatReadiness(taskContext) {
    const health = this.bot.health !== undefined ? this.bot.health : 20;
    if (health <= combatConfig.RETREAT_HEALTH_THRESHOLD) {
      await this._executeEmergencyRetreat(taskContext);
    }

    // Check weapon durability
    const heldWeapon = this.bot.heldItem;
    if (heldWeapon && this.ctx.tools && this.ctx.tools.isAboutToBreak(heldWeapon, 5)) {
      const backupEquipped = await this.combatHelper.equipBestWeapon();
      if (!backupEquipped || this.ctx.tools.isAboutToBreak(this.bot.heldItem, 5)) {
        throw new Error('Weapon durability is critical and no replacement is available.');
      }
    }
  }

  /**
   * Executes emergency retreat, consumable consumption, and safe withdrawal.
   * @private
   */
  async _executeEmergencyRetreat(taskContext) {
    eventBus.emit('combat.retreat', { health: this.bot.health, reason: 'Critical health during combat' });
    this.ctx.messageRouter.send(1, 'Critical health during combat! Executing tactical retreat.');

    if (this.ctx.safety && typeof this.ctx.safety.fleeToNearestSafeZone === 'function') {
      await this.ctx.safety.fleeToNearestSafeZone();
    }

    // Attempt to consume food or golden apple to recover
    if (this.ctx.inv && typeof this.ctx.inv.eatFood === 'function') {
      await this.ctx.inv.eatFood();
    }

    throw new Error('Combat suspended: Bot health dropped to critical threshold.');
  }

  /**
   * Collects dropped combat loot around the defeated mob.
   * @private
   */
  async _collectCombatDrops(centerPos) {
    if (!this.bot.entities || !centerPos) return;

    for (const entity of Object.values(this.bot.entities)) {
      if (entity.name === 'item' && entity.position) {
        const dist = Math.sqrt(
          Math.pow(entity.position.x - centerPos.x, 2) +
          Math.pow(entity.position.z - centerPos.z, 2)
        );

        if (dist <= combatConfig.DROP_COLLECTION_RADIUS) {
          const itemMeta = entity.metadata && entity.metadata[8];
          const itemName = itemMeta ? itemMeta.name : 'item';

          if (combatPolicies.shouldCollectCombatDrop(itemName)) {
            await this.ctx.nav.goTo(entity.position, { range: 1, allowBreak: false, timeoutMs: 2500 });
          }
        }
      }
    }
  }

  _raiseShield() {
    if (this.bot.inventory && this.bot.inventory.slots[45] && this.bot.inventory.slots[45].name === 'shield') {
      if (typeof this.bot.activateItem === 'function') {
        this.bot.activateItem(true);
      }
    }
  }

  _lowerShield() {
    if (typeof this.bot.deactivateItem === 'function') {
      this.bot.deactivateItem();
    }
  }
}

module.exports = CombatSkill;
