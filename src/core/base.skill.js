/**
 * SkillAbort - Error thrown when a skill must abort immediately due to critical danger or interruption.
 */
class SkillAbort extends Error {
  constructor(message = 'Skill execution aborted due to critical conditions') {
    super(message);
    this.name = 'SkillAbort';
  }
}

/**
 * SkillSuspended - Error thrown when a skill gracefully yields execution to a higher-priority task.
 */
class SkillSuspended extends Error {
  /**
   * @param {string} [message='Skill execution suspended for higher priority task'] - Reason message
   * @param {Object} [checkpoint=null] - Saved intermediate progress state to resume later
   */
  constructor(message = 'Skill execution suspended for higher priority task', checkpoint = null) {
    super(message);
    this.name = 'SkillSuspended';
    this.checkpoint = checkpoint;
  }
}

/**
 * BaseSkill - Abstract base class for all bot skills and features.
 * 
 * Enforces the architectural invariant:
 * "Skills must never duplicate navigation, safety, inventory, or tool logic."
 * All features must consume these capabilities via `this.ctx.<service>`.
 */
class BaseSkill {
  /**
   * @param {import('../core/BotContext')} ctx - Bot context dependency container
   */
  constructor(ctx) {
    if (new.target === BaseSkill) {
      throw new TypeError('Cannot construct BaseSkill instances directly (abstract class)');
    }
    if (!ctx) {
      throw new Error('[BaseSkill] BotContext must be provided to skill constructor');
    }
    this.ctx = ctx;
    this.bot = ctx.bot;
    this.name = this.constructor.name;
    this.aborted = false;
    this.currentTaskId = null;
  }

  /**
   * Main execution loop for the skill. Must be implemented by subclasses.
   * @param {Object} [params] - Skill parameters
   * @returns {Promise<any>}
   * @throws {Error} If not implemented by subclass
   */
  async run(params = {}) {
    throw new Error(`[${this.name}] Method 'run(params)' must be implemented by subclass`);
  }

  /**
   * Signals the skill that preemption is requested so checkpoint progress can be saved.
   */
  requestSuspend() {
    this.suspendRequested = true;
  }

  /**
   * Checks whether the TaskManager has requested this task to yield / suspend.
   * @param {string} [taskId] - Optional taskId override
   * @returns {boolean}
   */
  shouldSuspend(taskId = this.currentTaskId) {
    if (this.suspendRequested) return true;
    if (!this.ctx || !this.ctx.taskManager) return false;
    return Boolean(taskId && this.ctx.taskManager.isSuspendRequested(taskId));
  }

  /**
   * Safety & preemption guard helper. Checks critical health/hunger/environment conditions
   * and checks if preemption/suspension was requested by a higher-priority task.
   * 
   * Skills should call `await this.safetyCheckLoop(checkpointData)` within loops.
   * @param {Object} [checkpointData=null] - Optional intermediate progress data
   * @throws {SkillSuspended} When a higher-priority task requests execution lock (checkpoint preserved)
   * @throws {SkillAbort} When safety conditions are critical or abort was requested
   */
  async safetyCheckLoop(checkpointData = null) {
    // 1. Check for preemption suspension FIRST so checkpoint progress is captured!
    if (this.shouldSuspend(this.currentTaskId)) {
      throw new SkillSuspended(`[${this.name}] Suspended for higher priority task`, checkpointData);
    }

    // 2. Explicit cancellation or abort
    if (this.aborted) {
      throw new SkillAbort(`[${this.name}] Execution explicitly aborted.`);
    }

    // 2.5 Autonomous Self-Survival Protocol (Auto-eat, drowning, fire, potion, shield)
    if (this.ctx && this.ctx.safety && typeof this.ctx.safety.runSafetyProtocol === 'function') {
      try {
        await this.ctx.safety.runSafetyProtocol();
      } catch (safetyErr) {
        // Non-fatal
      }
    } else if (this.ctx && this.ctx.safety && typeof this.ctx.safety.checkAutoEat === 'function') {
      try {
        await this.ctx.safety.checkAutoEat();
      } catch (eatErr) {
        // Non-fatal
      }
    }

    // 3. Critical safety hazard abort
    if (this.ctx && this.ctx.safety && typeof this.ctx.safety.isCritical === 'function' && this.ctx.safety.isCritical()) {
      this.aborted = true;
      throw new SkillAbort(`[${this.name}] Aborted: Health/Food is at critical threshold!`);
    }
  }

  /**
   * Signals the skill to abort gracefully at the next safe opportunity.
   */
  abort() {
    this.aborted = true;
  }
}

module.exports = {
  BaseSkill,
  SkillAbort,
  SkillSuspended
};
