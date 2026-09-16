/**
 * HumanoidBehaviorService - Ultra-Realistic Human Mimicry & Anti-Bot Evasion Engine.
 * 
 * Prevents anti-bot / anti-AFK detection plugins (Matrix, Vulcan, GrimAC, Negativity, NCP) from flagging the bot.
 * Features:
 * - Smooth cubic/sinusoidal head saccades (Zero angle snaps).
 * - Organic non-deterministic timing with Poisson jitter (Zero fixed timer patterns).
 * - Social player mimicry (Crouch-greeting when players sneak nearby, eye contact tracking).
 * - Realistic human fidget actions (arm swings, quickbar cycling, sneak-taps, weight shifts).
 */
class HumanoidBehaviorService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   * @param {import('../core/BotContext')} [ctx] - BotContext reference
   */
  constructor(bot, ctx = null) {
    this.bot = bot;
    this.ctx = ctx;
    this.enabled = true;
    this.lastActionTime = Date.now();
    this.nextActionDelayMs = this._calculateNextDelay();
    this.isExecutingAction = false;
    this.interpolatingLook = false;

    this.stats = {
      totalActions: 0,
      headTurns: 0,
      sneaks: 0,
      swings: 0,
      playerGreetings: 0,
      lastAction: 'None'
    };
  }

  /**
   * Generates a non-deterministic delay using Gaussian/Poisson jitter.
   * Prevents heuristic detection from fixed interval analyzers.
   * @private
   * @returns {number} Delay in milliseconds (2200ms - 6800ms)
   */
  _calculateNextDelay() {
    const base = 3500;
    const jitter = (Math.random() - 0.5) * 2000;
    const variance = Math.random() * 1500;
    return Math.max(1800, Math.round(base + jitter + variance));
  }

  /**
   * Main evaluation loop invoked by AIBrain or background scheduler.
   * @param {number} [idleDurationMs=0]
   * @returns {Promise<boolean>} True if a human-like action was executed
   */
  async evaluate(idleDurationMs = 0) {
    if (!this.enabled || !this.bot || !this.bot.entity) return false;
    if (this.isExecutingAction || this.interpolatingLook) return false;

    // Do not disrupt high-priority combat or movement
    if (this.ctx && this.ctx.safety && this.ctx.safety.isCritical()) return false;
    if (this.ctx && this.ctx.nav && (this.ctx.nav.currentGoal || this.ctx.nav.isFollowing)) return false;
    if (this.ctx && this.ctx.ambient && this.ctx.ambient.isSleeping) return false;

    const now = Date.now();
    if (now - this.lastActionTime < this.nextActionDelayMs) {
      return false;
    }

    this.lastActionTime = now;
    this.nextActionDelayMs = this._calculateNextDelay();
    this.isExecutingAction = true;

    try {
      // 1. Social Player Mimicry: check if a player is close and crouching
      const nearbyPlayer = this._findNearbyPlayer(7);
      if (nearbyPlayer) {
        const isPlayerSneaking = Boolean(
          nearbyPlayer.entity.metadata &&
          nearbyPlayer.entity.metadata[0] !== undefined &&
          (nearbyPlayer.entity.metadata[0] & 0x02) !== 0
        );

        if (isPlayerSneaking) {
          await this.crouchGreeting(nearbyPlayer.entity);
          return true;
        }

        // 40% chance to glance at nearby player's face
        if (Math.random() < 0.40) {
          await this.glanceAtPlayer(nearbyPlayer.entity);
          return true;
        }
      }

      // 2. Weighted Random Human Fidget Selection
      const rand = Math.random();

      if (rand < 0.35) {
        // 35% Smooth subtle head movement
        await this.smoothHeadLook();
      } else if (rand < 0.55) {
        // 20% Wider natural survey of surroundings
        await this.smoothWideLook();
      } else if (rand < 0.70) {
        // 15% Idle sneak / shift tap
        await this.idleFidgetSneak();
      } else if (rand < 0.82) {
        // 12% Arm swing / tool test
        await this.idleArmSwing();
      } else if (rand < 0.92) {
        // 10% Quickbar slot inspection
        await this.hotbarInspect();
      } else {
        // 8% Micro weight shift / tiny step
        await this.microStep();
      }

      return true;
    } catch (err) {
      // Non-fatal if animation interrupted
      return false;
    } finally {
      this.isExecutingAction = false;
    }
  }

  /**
   * Smoothly interpolates head yaw and pitch over multiple ticks to mimic human mouse movement.
   * Completely avoids robotic single-frame angle snaps.
   * 
   * @param {number} targetYaw - Target yaw in radians
   * @param {number} targetPitch - Target pitch in radians
   * @param {number} [steps=8] - Number of interpolation frames
   */
  async interpolateRotation(targetYaw, targetPitch, steps = 8) {
    if (!this.bot || !this.bot.entity) return;
    this.interpolatingLook = true;

    const startYaw = this.bot.entity.yaw;
    const startPitch = this.bot.entity.pitch;

    for (let i = 1; i <= steps; i++) {
      // Sinusoidal ease-in-out curve
      const t = i / steps;
      const ease = 0.5 * (1 - Math.cos(Math.PI * t));

      const curYaw = startYaw + (targetYaw - startYaw) * ease;
      const curPitch = startPitch + (targetPitch - startPitch) * ease;

      if (typeof this.bot.look === 'function') {
        try {
          await this.bot.look(curYaw, curPitch, true);
        } catch (e) {
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 40)); // ~20-25 FPS interpolation
    }

    this.interpolatingLook = false;
  }

  /**
   * Executes a small, natural head movement (±5° to ±20° yaw, ±10° pitch).
   */
  async smoothHeadLook() {
    if (!this.bot || !this.bot.entity) return;
    const curYaw = this.bot.entity.yaw;
    const curPitch = this.bot.entity.pitch;

    const dYaw = (Math.random() - 0.5) * (Math.PI / 4); // ±22.5 degrees
    const dPitch = (Math.random() - 0.5) * (Math.PI / 6); // ±15 degrees

    const targetYaw = curYaw + dYaw;
    const targetPitch = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, curPitch + dPitch));

    await this.interpolateRotation(targetYaw, targetPitch, 6 + Math.floor(Math.random() * 4));
    this.stats.headTurns++;
    this.stats.totalActions++;
    this.stats.lastAction = 'Micro Head Movement';
  }

  /**
   * Executes a broader natural gaze looking at a point of interest or landscape.
   */
  async smoothWideLook() {
    if (!this.bot || !this.bot.entity) return;
    const curYaw = this.bot.entity.yaw;

    // Turn 40 to 80 degrees left or right
    const sign = Math.random() < 0.5 ? -1 : 1;
    const dYaw = sign * (0.6 + Math.random() * 0.6);
    const targetPitch = (Math.random() - 0.5) * 0.3;

    await this.interpolateRotation(curYaw + dYaw, targetPitch, 10 + Math.floor(Math.random() * 5));
    this.stats.headTurns++;
    this.stats.totalActions++;
    this.stats.lastAction = 'Wide Environment Survey';
  }

  /**
   * Smoothly faces a nearby player, looking at their eye level.
   * @param {import('mineflayer').Entity} playerEntity
   */
  async glanceAtPlayer(playerEntity) {
    if (!playerEntity || !playerEntity.position || !this.bot.entity) return;
    const eyePos = playerEntity.position.offset(0, 1.62, 0);

    const dx = eyePos.x - this.bot.entity.position.x;
    const dy = eyePos.y - (this.bot.entity.position.y + 1.62);
    const dz = eyePos.z - this.bot.entity.position.z;

    const targetYaw = Math.atan2(-dx, -dz);
    const groundDist = Math.sqrt(dx * dx + dz * dz);
    const targetPitch = Math.atan2(dy, groundDist);

    await this.interpolateRotation(targetYaw, targetPitch, 8);
    this.stats.totalActions++;
    this.stats.lastAction = 'Glance at Player';
  }

  /**
   * The universal Minecraft friendly greeting: double-tap crouch in response to a player sneak.
   * @param {import('mineflayer').Entity} [playerEntity]
   */
  async crouchGreeting(playerEntity = null) {
    if (!this.bot) return;

    if (playerEntity) {
      await this.glanceAtPlayer(playerEntity);
    }

    if (typeof this.bot.setControlState === 'function') {
      // First crouch
      this.bot.setControlState('sneak', true);
      await new Promise((r) => setTimeout(r, 180 + Math.random() * 80));
      this.bot.setControlState('sneak', false);
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 60));

      // Second crouch
      this.bot.setControlState('sneak', true);
      await new Promise((r) => setTimeout(r, 160 + Math.random() * 70));
      this.bot.setControlState('sneak', false);
    }

    this.stats.playerGreetings++;
    this.stats.sneaks += 2;
    this.stats.totalActions += 2;
    this.stats.lastAction = 'Player Crouch-Greeting';
  }

  /**
   * Simulates an accidental or idle sneak tap (shift tap).
   */
  async idleFidgetSneak() {
    if (!this.bot || typeof this.bot.setControlState !== 'function') return;

    const duration = 250 + Math.floor(Math.random() * 400); // 250-650ms
    this.bot.setControlState('sneak', true);
    await new Promise((r) => setTimeout(r, duration));
    this.bot.setControlState('sneak', false);

    this.stats.sneaks++;
    this.stats.totalActions++;
    this.stats.lastAction = 'Idle Sneak Tap';
  }

  /**
   * Simulates an idle arm swing (player clicking in the air).
   */
  async idleArmSwing() {
    if (!this.bot || typeof this.bot.swingArm !== 'function') return;

    this.bot.swingArm('right');
    this.stats.swings++;
    this.stats.totalActions++;
    this.stats.lastAction = 'Idle Arm Swing';
  }

  /**
   * Simulates player inspecting or scrolling their hotbar.
   */
  async hotbarInspect() {
    if (!this.bot || typeof this.bot.setQuickBarSlot !== 'function') return;
    const currentSlot = this.bot.quickBarSlot || 0;
    const nextSlot = (currentSlot + 1) % 9;

    this.bot.setQuickBarSlot(nextSlot);
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    this.bot.setQuickBarSlot(currentSlot);

    this.stats.totalActions++;
    this.stats.lastAction = 'Hotbar Slot Inspection';
  }

  /**
   * Simulates a micro weight shift or tiny footstep, defeating server AFK timers.
   */
  async microStep() {
    if (!this.bot || typeof this.bot.setControlState !== 'function') return;

    const directions = ['forward', 'back', 'left', 'right'];
    const dir = directions[Math.floor(Math.random() * directions.length)];

    this.bot.setControlState(dir, true);
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 80)); // 100-180ms tiny step
    this.bot.setControlState(dir, false);

    this.stats.totalActions++;
    this.stats.lastAction = 'Micro Step Weight Shift';
  }

  /**
   * Locates the nearest other player within proximity.
   * @private
   * @param {number} radius
   * @returns {Object|null}
   */
  _findNearbyPlayer(radius = 7) {
    if (!this.bot || !this.bot.players || !this.bot.entity) return null;

    let closest = null;
    let minDist = radius;

    for (const [name, player] of Object.entries(this.bot.players)) {
      if (!player || !player.entity || name === this.bot.username) continue;
      const dist = this.bot.entity.position.distanceTo(player.entity.position);
      if (dist < minDist) {
        minDist = dist;
        closest = player;
      }
    }

    return closest;
  }

  /**
   * Telemetry health ping.
   * @returns {{ ok: boolean, enabled: boolean, stats: Object }}
   */
  ping() {
    return {
      ok: Boolean(this.bot),
      enabled: this.enabled,
      stats: this.stats
    };
  }
}

module.exports = HumanoidBehaviorService;
