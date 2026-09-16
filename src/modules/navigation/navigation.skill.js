const { BaseSkill, SkillAbort, SkillSuspended } = require('../../../skills/BaseSkill');

/**
 * NavigationSkill - Autonomous movement, waypoint travel, and player following.
 * Wraps NavigationService to integrate with TaskManager priority and safety preemption.
 */
class NavigationSkill extends BaseSkill {
  /**
   * Main navigation entry point.
   * @param {Object} params
   * @param {'follow'|'go_to'|'go_home'|'retrace'} [params.mode]
   * @param {string} [params.player] - Player to follow
   * @param {string} [params.senderId] - Originating sender
   * @param {{x: number, y: number, z: number}} [params.position] - Target coordinates
   * @param {string} [params.location] - Named location
   * @param {number} [params.distance=3] - Follow distance
   */
  async run(params = {}) {
    this.aborted = false;
    const mode = params.mode || (params.player ? 'follow' : (params.position || params.location) ? 'go_to' : 'go_home');

    // 1. Follow Player Mode
    if (mode === 'follow') {
      const targetName = params.player || params.senderId || (process.env.OWNER_USERNAME || '').trim();
      if (!targetName) {
        throw new Error('[NavigationSkill] No target player or owner specified to follow.');
      }
      return await this._executeFollow(targetName, params.distance || 3);
    }

    // 2. Go To Coordinates / Named Location Mode
    if (mode === 'go_to') {
      return await this._executeGoTo(params);
    }

    // 3. Return Home Mode
    if (mode === 'go_home' || mode === 'return_home') {
      return await this._executeReturnHome();
    }

    // 4. Retrace Steps Mode
    if (mode === 'retrace' || mode === 'retrace_steps') {
      const success = await this.ctx.nav.retracePath();
      return { success, mode: 'retrace' };
    }

    throw new Error(`[NavigationSkill] Unknown navigation mode '${mode}'`);
  }

  /**
   * Continuously follows target player entity until stopped, suspended, or aborted.
   * @private
   */
  async _executeFollow(playerName, distance = 3) {
    const playerObj = this.bot.players[playerName];
    if (!playerObj) {
      throw new Error(`Player '${playerName}' is not connected to the server.`);
    }

    let targetEntity = playerObj.entity;
    if (!targetEntity) {
      this.ctx.messageRouter.send(3, `Waiting for ${playerName} to enter visual range...`);
      // Wait up to 10 seconds for player entity to appear in render distance
      const startTime = Date.now();
      while (!targetEntity && Date.now() - startTime < 10000 && !this.aborted) {
        await new Promise((r) => setTimeout(r, 500));
        targetEntity = this.bot.players[playerName] ? this.bot.players[playerName].entity : null;
      }
      if (!targetEntity) {
        throw new Error(`Player '${playerName}' is too far away or not in loaded chunks.`);
      }
    }

    this.ctx.messageRouter.send(3, `Following ${playerName} (maintaining ${distance} blocks distance)...`);
    const followHandle = await this.ctx.nav.followEntity(targetEntity, { distance });

    try {
      while (!this.aborted) {
        await this.safetyCheckLoop();

        // Check if follow was cancelled externally
        if (!this.ctx.nav.isFollowing) {
          break;
        }

        // Keep entity reference fresh if player respawns or teleports
        const freshPlayer = this.bot.players[playerName];
        if (!freshPlayer) {
          break; // Player disconnected
        }

        await new Promise((r) => setTimeout(r, 1000));
      }
    } finally {
      followHandle.stopFollowing();
    }

    return { success: true, mode: 'follow', target: playerName };
  }

  /**
   * Navigates to a target coordinate or named location.
   * @private
   */
  async _executeGoTo(params) {
    let targetPos = params.position;

    // Resolve named location if string passed
    if (!targetPos && params.location) {
      if (this.ctx.locations) {
        const named = await this.ctx.locations.findNearestChest(this.bot.entity.position, params.location);
        if (named) {
          targetPos = { x: named.x, y: named.y, z: named.z };
        }
      }
    }

    if (!targetPos || typeof targetPos.x !== 'number') {
      throw new Error('[NavigationSkill] No valid coordinates or location found for go_to.');
    }

    this.ctx.messageRouter.send(3, `Navigating to (${Math.round(targetPos.x)}, ${Math.round(targetPos.y)}, ${Math.round(targetPos.z)})...`);
    const result = await this.ctx.nav.goTo(targetPos, {
      timeout: params.timeout || 60000,
      range: params.range || 2
    });

    if (!result.success) {
      throw new Error(`[NavigationSkill] Failed to reach destination: ${result.reason || 'Timeout or path blocked'}`);
    }

    this.ctx.messageRouter.send(3, `Arrived at destination (${Math.round(targetPos.x)}, ${Math.round(targetPos.y)}, ${Math.round(targetPos.z)}).`);
    return { success: true, mode: 'go_to', position: targetPos };
  }

  /**
   * Returns to primary home base.
   * @private
   */
  async _executeReturnHome() {
    this.ctx.messageRouter.send(3, 'Returning to primary home base...');
    const result = await this.ctx.nav.returnHome();
    if (!result.success) {
      throw new Error(`[NavigationSkill] Return home failed: ${result.reason || 'No path found'}`);
    }
    this.ctx.messageRouter.send(3, 'Safely returned home.');
    return { success: true, mode: 'return_home' };
  }

  /**
   * Aborts navigation immediately and clears goals.
   */
  abort() {
    super.abort();
    if (this.ctx && this.ctx.nav) {
      this.ctx.nav.stopFollowing();
    }
  }
}

module.exports = NavigationSkill;
