const Priorities = require('../shared/config/priorities');
const TickRates = require('../shared/config/tick-rates');

/**
 * AIBrain - Autonomous cognitive decision engine, adaptive tick scheduler, and system health monitor.
 */
class AIBrain {
  /**
   * @param {import('./BotContext')} ctx - Central dependency container
   * @param {number} [initialTickRate=TickRates.IDLE] - Initial loop rate in milliseconds
   */
  constructor(ctx, initialTickRate = TickRates.IDLE) {
    this.ctx = ctx;
    this.tickRateMs = initialTickRate;
    this.currentMode = 'idle';
    this.isRunning = false;
    this.loopTimer = null;
    this.heartbeatTimer = null;
    this.lastActiveTime = Date.now();
    this.modules = new Map(); // name -> pingFn
    this.moduleHealth = new Map(); // name -> { healthy: boolean, lastPing: number, latencyMs: number }

    this.registerDefaultModules();
  }

  /**
   * Registers default core subsystem health pings.
   * @private
   */
  registerDefaultModules() {
    if (!this.ctx) return;

    if (this.ctx.nav) {
      this.registerModule('NavigationService', () => this.ctx.nav.ping());
    }
    if (this.ctx.inv) {
      this.registerModule('InventoryService', () => this.ctx.inv.ping());
    }
    if (this.ctx.safety) {
      this.registerModule('SafetyService', () => this.ctx.safety.ping());
    }
    if (this.ctx.tools) {
      this.registerModule('ToolService', () => this.ctx.tools.ping());
    }
    if (this.ctx.locations) {
      this.registerModule('LocationRegistry', () => this.ctx.locations.ping());
    }
    if (this.ctx.ambient) {
      this.registerModule('AmbientBehaviorService', () => this.ctx.ambient.ping());
    }
    if (this.ctx.combat) {
      this.registerModule('CombatHelperService', () => this.ctx.combat.ping());
    }
    if (this.ctx.humanoid) {
      this.registerModule('HumanoidBehaviorService', () => this.ctx.humanoid.ping());
    }
    if (this.ctx.actionQueue) {
      this.registerModule('ActionQueueService', () => this.ctx.actionQueue.ping());
    }
    if (this.ctx.logistics) {
      this.registerModule('LogisticsService', () => this.ctx.logistics.ping());
    }
    if (this.ctx.crafting) {
      this.registerModule('CraftingService', () => this.ctx.crafting.ping());
    }
    if (this.ctx.target) {
      this.registerModule('TargetFinderService', () => this.ctx.target.ping());
    }
    if (this.ctx.permissionManager) {
      this.registerModule('PermissionManager', () => this.ctx.permissionManager.ping());
    }
    if (this.ctx.taskManager) {
      this.registerModule('TaskManager', () => this.ctx.taskManager.ping());
    }
    if (this.ctx.serverAuth) {
      this.registerModule('ServerAuthManager', () => this.ctx.serverAuth.ping());
    }
    if (this.ctx.commandGateway) {
      this.registerModule('UnifiedCommandGateway', () => this.ctx.commandGateway.ping());
    }
    if (this.ctx.messageRouter) {
      this.registerModule('MessageRouter', () => this.ctx.messageRouter.ping());
    }
    if (this.ctx.skills && this.ctx.skills.registry) {
      this.registerModule('SkillRegistry', () => ({ ok: Object.keys(this.ctx.skills.registry).length >= 8 }));
    }
    if (this.ctx.nlp) {
      this.registerModule('NLP', () => (typeof this.ctx.nlp.ping === 'function' ? this.ctx.nlp.ping() : { ok: true }));
      this.registerModule('IntentParser', () => (typeof this.ctx.nlp.ping === 'function' ? this.ctx.nlp.ping() : { ok: true }));
    }
  }

  /**
   * Registers a subsystem or module ping function for continuous health auditing.
   * @param {string} name - Subsystem name
   * @param {Function} pingFn - Function returning { ok: boolean } or Promise<{ ok: boolean }>
   */
  registerModule(name, pingFn) {
    this.modules.set(name, pingFn);
    this.moduleHealth.set(name, { healthy: true, lastPing: Date.now(), latencyMs: 0 });
  }

  /**
   * Calculates priority score using base priority, urgency, and environmental risk.
   * Priority = Base_Priority + Urgency_Modifier + Risk_Factor
   * 
   * @param {Object} context
   * @param {number} context.basePriority - Nominal base priority (0-100)
   * @param {number} [context.currentNeed=0] - Current depletion or requirement amount
   * @param {number} [context.maxNeed=0] - Maximum capacity or threshold
   * @param {number} [context.threatLevel=0] - Nearby hostile threat score (0-10)
   * @returns {number} Calculated composite priority score
   */
  evaluatePriority(context = {}) {
    const {
      basePriority = Priorities.AUTONOMOUS,
      currentNeed = 0,
      maxNeed = 0,
      threatLevel = 0
    } = context;

    const urgency = maxNeed > 0 ? (currentNeed / maxNeed) * 50 : 0;
    const risk = (Math.min(10, Math.max(0, threatLevel)) / 10) * 30;

    return Math.min(100, Math.round(basePriority + urgency + risk));
  }

  /**
   * Dynamically adjusts the AI loop tick rate based on current operational state.
   * @param {'combat'|'active'|'idle'|'dashboard_only'} mode - Target operating mode
   */
  setTickRate(mode) {
    let newRate = TickRates.IDLE;
    switch (mode) {
      case 'combat':
        newRate = TickRates.COMBAT;
        break;
      case 'active':
        newRate = TickRates.ACTIVE;
        break;
      case 'dashboard_only':
        newRate = TickRates.DASHBOARD_ONLY;
        break;
      case 'idle':
      default:
        newRate = TickRates.IDLE;
        break;
    }

    if (this.currentMode !== mode || this.tickRateMs !== newRate) {
      this.currentMode = mode;
      this.tickRateMs = newRate;

      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('ai.tick_rate_changed', { mode, tickRateMs: this.tickRateMs });
      }
    }
  }

  /**
   * Starts the recursive autonomous decision and heartbeat loops.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[AIBrain] Autonomous decision engine started (Initial Tick: ${this.tickRateMs}ms).`);

    // Recursive tick loop
    const runTick = async () => {
      if (!this.isRunning) return;
      try {
        await this.tick();
      } catch (err) {
        console.error('[AIBrain] Error during decision tick:', err.message);
      } finally {
        if (this.isRunning) {
          this.loopTimer = setTimeout(runTick, this.tickRateMs);
        }
      }
    };

    this.loopTimer = setTimeout(runTick, this.tickRateMs);

    // Module heartbeat loop (Every 5 seconds)
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, 5000);
  }

  /**
   * Stops the AI decision engine and cancels timers.
   */
  stop() {
    this.isRunning = false;
    if (this.loopTimer) clearTimeout(this.loopTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.loopTimer = null;
    this.heartbeatTimer = null;
    console.log('[AIBrain] Autonomous decision engine stopped.');
  }

  /**
   * Primary decision and evaluation loop executed on every adaptive tick.
   */
  async tick() {
    if (!this.ctx) return;

    // 0. Continuous Self-Safety & Survival Protocol (Auto-eat, drowning, fire, potion, shield)
    if (this.ctx.safety && typeof this.ctx.safety.runSafetyProtocol === 'function') {
      try {
        await this.ctx.safety.runSafetyProtocol();
      } catch (safetyErr) {
        // Non-fatal
      }
    } else if (this.ctx.safety && typeof this.ctx.safety.checkAutoEat === 'function') {
      try {
        await this.ctx.safety.checkAutoEat();
      } catch (eatErr) {
        // Non-fatal
      }
    }

    // 1. Critical Safety & Survival Guard
    if (this.ctx.safety && this.ctx.safety.isCritical()) {
      this.setTickRate('combat');
      if (this.ctx.taskManager && !this.ctx.taskManager.activeTask) {
        if (this.ctx.events) {
          this.ctx.events.emit('log:entry', {
            severity: 'CRITICAL',
            category: 'BRAIN',
            message: 'Critical safety breach detected. Triggering emergency returnHome.'
          });
        }
        if (this.ctx.nav) {
          try {
            await this.ctx.nav.returnHome();
          } catch (e) {
            // ignore
          }
        }
      }
      return;
    }

    // 1.5. Proactive Threat Detection & Self-Defense
    if (this.ctx.combat && typeof this.ctx.combat.getImmediateThreat === 'function') {
      const threat = this.ctx.combat.getImmediateThreat(10);
      if (threat) {
        this.setTickRate('combat');
        this.lastActiveTime = Date.now();
        if (this.ctx.events) {
          this.ctx.events.emit('log:entry', {
            severity: 'WARN',
            category: 'COMBAT',
            message: `Hostile mob '${threat.name || 'unknown'}' detected within 10m. Engaging self-defense.`
          });
        }
        try {
          await this.ctx.combat.defendAgainst(threat);
        } catch (combatErr) {
          console.warn('[AIBrain] Error during combat defense:', combatErr.message);
        }
        return;
      }
    }

    // 2. Process Next Task via TaskManager
    if (this.ctx.taskManager) {
      const snapshot = this.ctx.taskManager.getQueueSnapshot();

      if (snapshot.activeTask) {
        this.setTickRate('active');
        this.lastActiveTime = Date.now();
        return;
      }

      if (snapshot.queue.length > 0) {
        this.setTickRate('active');
        this.lastActiveTime = Date.now();
        this.ctx.taskManager.runNext().catch((err) => {
          console.error('[AIBrain] Error during task execution:', err.message);
        });
        return;
      }
    }

    // 3. Queue is Empty - Autonomous Idle Logic
    this.setTickRate('idle');
    const idleDuration = Date.now() - this.lastActiveTime;

    if (idleDuration > 15000) {
      if (this.ctx.events) {
        this.ctx.events.emit('ai.idle', { idleDurationMs: idleDuration });
      }
    }

    // Evaluate Ultra-Realistic Humanoid Anti-Bot Mimicry
    if (this.ctx.humanoid && typeof this.ctx.humanoid.evaluate === 'function') {
      try {
        await this.ctx.humanoid.evaluate(idleDuration);
      } catch (humanoidErr) {
        // Non-fatal animation error
      }
    }

    if (this.ctx.ambient && typeof this.ctx.ambient.evaluate === 'function') {
      try {
        await this.ctx.ambient.evaluate(idleDuration);
      } catch (ambientErr) {
        console.warn('[AIBrain] Error during ambient routine evaluation:', ambientErr.message);
      }
    }
  }

  /**
   * Executes module heartbeats across all registered subsystem ping functions with a 2-second timeout.
   */
  async checkHeartbeats() {
    const results = {};

    for (const [name, pingFn] of this.modules.entries()) {
      const startTime = Date.now();
      let healthy = false;

      try {
        const pingPromise = Promise.resolve(pingFn());
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Ping timeout (>2s)')), 2000)
        );

        const res = await Promise.race([pingPromise, timeoutPromise]);
        healthy = Boolean(res && (res.ok === undefined || res.ok === true));
      } catch (err) {
        healthy = false;
        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('module.unhealthy', { module: name, error: err.message });
        }
      }

      const latencyMs = Date.now() - startTime;
      this.moduleHealth.set(name, { healthy, lastPing: Date.now(), latencyMs });
      results[name] = { healthy, latencyMs };
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('ai.heartbeat', {
        modules: results,
        tickRateMs: this.tickRateMs,
        mode: this.currentMode
      });
    }
  }

  /**
   * Returns current health and operational snapshot for dashboard telemetry.
   * @returns {{ tickRateMs: number, mode: string, modules: Object }}
   */
  getStatus() {
    const modules = {};
    for (const [name, data] of this.moduleHealth.entries()) {
      modules[name] = data;
    }
    return {
      tickRateMs: this.tickRateMs,
      mode: this.currentMode,
      isRunning: this.isRunning,
      modules
    };
  }
}

module.exports = AIBrain;
