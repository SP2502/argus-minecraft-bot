const Priorities = require('../config/priorities');
const LockManager = require('./LockManager');
const SkillRegistry = require('./SkillRegistry');
const { SkillSuspended, SkillAbort } = require('../skills/BaseSkill');

/**
 * Task State Constants
 */
const TaskState = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  BLOCKED: 'blocked',
  STARTING: 'starting',
  RUNNING: 'running',
  SUSPENDED: 'suspended',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

/**
 * TaskManager - Priority-driven preemptive scheduler with resource locking and atomic lifecycle orchestration.
 */
class TaskManager {
  /**
   * @param {import('./BotContext')} ctx - BotContext dependency container
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.queue = [];
    this.activeTask = null;
    this.activeSkillInstance = null;
    this.isPaused = false;
    this.lockManager = new LockManager();
    this.suspendRequests = new Set();
  }

  /**
   * Creates and enqueues a new prioritized task.
   * If the incoming task has higher priority than the currently running task, it triggers preemption.
   * 
   * @param {string} skillName - Name of registered skill to execute (e.g. 'mine', 'farm')
   * @param {Object} [params={}] - Parameters passed to the skill's run() method
   * @param {number} [priority=Priorities.AUTONOMOUS] - Priority weighting score
   * @param {string} [requestedBy='system'] - Requesting player or module
   * @param {string[]} [locks=['movement', 'inventory']] - Resource locks required
   * @returns {Object} The created task object
   * 
   * @example
   * const taskId = ctx.taskManager.addTask('mine', { targetOre: 'diamond', quantity: 32 }, 60, 'Player1');
   */
  addTask(skillName, params = {}, priority = Priorities.AUTONOMOUS, requestedBy = 'system', locks = ['movement', 'inventory']) {
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      skillName: skillName.toLowerCase(),
      params: params || {},
      priority: typeof priority === 'number' ? priority : Priorities.AUTONOMOUS,
      status: TaskState.QUEUED,
      requestedBy: requestedBy || 'system',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      locks: Array.isArray(locks) ? locks : ['movement', 'inventory'],
      result: null,
      error: null,
      checkpoint: null
    };

    // Priority Queue Insertion (Descending: highest priority first)
    const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task.queued', task);
      this.ctx.events.emit('log:entry', {
        severity: 'INFO',
        category: 'TASK',
        message: `Task queued: [${task.skillName}] by ${task.requestedBy} (Priority: ${task.priority})`
      });
    }

    // Check if preemption of current active task is warranted
    if (this.activeTask && task.priority > this.activeTask.priority) {
      this.preempt(task);
    }

    return task;
  }

  /**
   * Core scheduler execution loop. Picks the highest-priority unblocked task,
   * acquires locks, and executes the skill with full error and preemption handling.
   * 
   * @returns {Promise<boolean>} True if a task was processed, false if idle or waiting
   */
  async runNext() {
    if (this.isPaused || this.activeTask || this.queue.length === 0) {
      return false;
    }

    // Clean up any leaked or deadlocked locks (>5m)
    const timedOut = this.lockManager.checkLockTimeouts();
    if (timedOut.length > 0) {
      for (const tId of timedOut) {
        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('log:entry', {
            severity: 'ERROR',
            category: 'TASK',
            message: `Task ${tId} force-released due to lock timeout (>5m).`
          });
        }
      }
    }

    // Find first task in queue whose required locks are available
    let taskIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];
      if (this.lockManager.acquireLocks(candidate.id, candidate.locks)) {
        taskIndex = i;
        break;
      } else {
        candidate.status = TaskState.BLOCKED;
      }
    }

    if (taskIndex === -1) {
      return false; // All pending tasks currently blocked on locks
    }

    const task = this.queue.splice(taskIndex, 1)[0];
    this.activeTask = task;
    task.status = TaskState.RUNNING;
    task.startedAt = Date.now();
    this.ctx.currentTask = task;

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task.started', task);
    }

    try {
      // Instantiate skill from registry
      const skill = SkillRegistry.loadSkill(task.skillName, this.ctx);
      skill.currentTaskId = task.id;
      this.activeSkillInstance = skill;

      // Pass saved checkpoint if resuming a previously suspended task
      const executionParams = task.checkpoint
        ? { ...task.params, checkpoint: task.checkpoint }
        : task.params;

      const result = await skill.run(executionParams);

      task.status = TaskState.SUCCESS;
      task.result = result;
      task.completedAt = Date.now();

      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('task.completed', task);
        this.ctx.events.emit('log:entry', {
          severity: 'SUCCESS',
          category: 'TASK',
          message: `Task completed successfully: [${task.skillName}] (${task.id})`
        });
      }
    } catch (err) {
      if (err instanceof SkillSuspended) {
        task.status = TaskState.SUSPENDED;
        task.checkpoint = err.checkpoint || task.checkpoint;
        // Re-queue suspended task to resume after higher priority task finishes
        this.queue.unshift(task);

        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('task.suspended', task);
          this.ctx.events.emit('log:entry', {
            severity: 'WARN',
            category: 'TASK',
            message: `Task suspended for preemption: [${task.skillName}]`
          });
        }
      } else {
        task.status = TaskState.FAILED;
        task.error = err.message;
        task.completedAt = Date.now();

        if (this.ctx && this.ctx.events) {
          this.ctx.events.emit('task.failed', task);
          this.ctx.events.emit('log:entry', {
            severity: 'ERROR',
            category: 'TASK',
            message: `Task failed: [${task.skillName}] - ${err.message}`
          });
        }
      }
    } finally {
      this.lockManager.releaseLocks(task.id);
      this.suspendRequests.delete(task.id);
      this.activeTask = null;
      this.activeSkillInstance = null;
      this.ctx.currentTask = null;
    }

    return true;
  }

  /**
   * Preempts the currently executing task in favor of a higher-priority task.
   * @param {Object} newTask - Incoming high-priority task
   */
  preempt(newTask) {
    if (!this.activeTask) return;
    console.warn(`[TaskManager] Preempting task ${this.activeTask.id} (${this.activeTask.priority}) for higher priority task ${newTask.id} (${newTask.priority})`);
    this.suspendRequests.add(this.activeTask.id);

    if (this.activeSkillInstance) {
      this.activeSkillInstance.abort();
    }
  }

  /**
   * Checks if a task has received a suspension request.
   * @param {string} taskId - Task identifier
   * @returns {boolean}
   */
  isSuspendRequested(taskId) {
    return this.suspendRequests.has(taskId);
  }

  /**
   * Cancels a specific queued or active task.
   * @param {string} taskId - Task identifier
   * @returns {boolean} True if task was found and cancelled
   */
  cancelTask(taskId) {
    // Check queue
    const index = this.queue.findIndex((t) => t.id === taskId);
    if (index !== -1) {
      const task = this.queue.splice(index, 1)[0];
      task.status = TaskState.CANCELLED;
      task.completedAt = Date.now();
      this.lockManager.releaseLocks(taskId);
      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('task.cancelled', task);
      }
      return true;
    }

    // Check active
    if (this.activeTask && this.activeTask.id === taskId) {
      this.activeTask.status = TaskState.CANCELLED;
      if (this.activeSkillInstance) {
        this.activeSkillInstance.abort();
      }
      this.lockManager.releaseLocks(taskId);
      this.activeTask = null;
      this.activeSkillInstance = null;
      return true;
    }

    return false;
  }

  /**
   * Cancels all pending and currently running tasks (Emergency Stop).
   * @param {string} [requestedBy='system'] - Issuer
   */
  cancelAll(requestedBy = 'system') {
    for (const task of this.queue) {
      task.status = TaskState.CANCELLED;
      task.completedAt = Date.now();
      this.lockManager.releaseLocks(task.id);
      if (this.ctx && this.ctx.events) {
        this.ctx.events.emit('task.cancelled', task);
      }
    }
    this.queue = [];

    if (this.activeTask) {
      this.cancelTask(this.activeTask.id);
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('log:entry', {
        severity: 'CRITICAL',
        category: 'TASK',
        message: `All tasks cancelled by ${requestedBy}`
      });
    }
  }

  /**
   * Pauses the task scheduler.
   */
  pause() {
    this.isPaused = true;
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task_manager:paused');
    }
  }

  /**
   * Resumes the task scheduler.
   */
  resume() {
    this.isPaused = false;
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task_manager:resumed');
    }
  }

  /**
   * Returns a snapshot of the active task, queue, and locks for dashboard visualization.
   * @returns {{ activeTask: Object|null, queue: Object[], locks: Object, isPaused: boolean }}
   */
  getQueueSnapshot() {
    return {
      activeTask: this.activeTask,
      queue: [...this.queue],
      locks: this.lockManager.getSnapshot(),
      isPaused: this.isPaused
    };
  }
}

module.exports = {
  TaskManager,
  TaskState
};
