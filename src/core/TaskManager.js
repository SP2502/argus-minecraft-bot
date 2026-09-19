const Priorities = require('../shared/config/priorities');
const LockManager = require('./LockManager');
const SkillRegistry = require('./SkillRegistry');
const { SkillSuspended, SkillAbort } = require('./base.skill');
const persistenceManager = require('../shared/persistence/persistence-manager');

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
    this.lockManager = new LockManager(ctx ? (ctx.events || ctx.eventBus) : null);
    this.suspendRequests = new Set();
    this.completedTaskIds = new Set();
    this.failedTaskIds = new Map();
  }

  /**
   * Internal centralized task state machine transition helper.
   * Logs and emits all lifecycle events uniformly: pending -> queued -> running -> success/failed/suspended/cancelled.
   * @private
   */
  _transition(task, newState, details = {}) {
    if (!task) return;
    const oldState = task.status;
    task.status = newState;

    if (newState === TaskState.RUNNING && !task.startedAt) {
      task.startedAt = Date.now();
    }
    if ([TaskState.SUCCESS, TaskState.FAILED, TaskState.CANCELLED].includes(newState)) {
      task.completedAt = Date.now();
    }
    if (details.result !== undefined) task.result = details.result;
    if (details.error !== undefined) task.error = details.error;
    if (details.checkpoint !== undefined) task.checkpoint = details.checkpoint;

    if (newState === TaskState.SUCCESS) {
      this.completedTaskIds.add(task.id);
      if (task.operationId) this.completedTaskIds.add(task.operationId);
      console.log(`[TaskManager] Task ${task.id} [${task.skillName}] completed successfully.`);
    }

    if (newState === TaskState.FAILED || newState === TaskState.CANCELLED) {
      const errMsg = details.error || task.error || 'Unknown error';
      this.failedTaskIds.set(task.id, errMsg);
      if (task.operationId) this.failedTaskIds.set(task.operationId, errMsg);
      console.error(`[TaskManager] Task ${task.id} [${task.skillName}] ${newState.toUpperCase()}: ${errMsg}`);
      if (this.ctx && this.ctx.messageRouter && newState === TaskState.FAILED) {
        try {
          this.ctx.messageRouter.send(3, `⚠️ Task [${task.skillName}] failed: ${errMsg}`);
        } catch (e) {}
      }
    }

    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task.state_changed', { task, from: oldState, to: newState });
      this.ctx.events.emit(`task.${newState}`, task);

      const severity = newState === TaskState.FAILED ? 'ERROR'
        : newState === TaskState.SUCCESS ? 'SUCCESS'
        : newState === TaskState.SUSPENDED || newState === TaskState.CANCELLED ? 'WARN'
        : 'INFO';

      this.ctx.events.emit('log:entry', {
        severity,
        category: 'TASK',
        message: `Task ${task.id} [${task.skillName}] state transition: ${oldState} → ${newState}`
      });
    }

    // Persist queue state changes to survive reconnects (fire-and-forget)
    this._persistQueue().catch(() => {});
  }

  /**
   * Persists the current pending/blocked queue to disk so it survives reconnects.
   * Only saves tasks that have not yet started running.
   * @private
   */
  async _persistQueue() {
    try {
      const saveable = this.queue
        .filter((t) => t.status !== 'running')
        .map((t) => ({
          skillName: t.skillName,
          params: t.params,
          priority: t.priority,
          requestedBy: t.requestedBy,
          locks: t.locks,
          dependsOn: t.dependsOn,
          operationId: t.operationId,
          timeoutMs: t.timeoutMs,
          retryCount: t.retryCount || 0,
          maxRetries: t.maxRetries || 2,
          checkpoint: t.checkpoint || null
        }));
      await persistenceManager.saveData('task_queue.json', { queue: saveable, savedAt: Date.now() });
    } catch (e) {
      // Non-fatal
    }
  }

  /**
   * Restores a previously persisted task queue from disk.
   * Called on bot spawn/reconnect to resume interrupted work.
   * @returns {Promise<number>} Number of tasks restored
   */
  async restoreQueue() {
    try {
      const saved = await persistenceManager.loadData('task_queue.json', { queue: [] });
      if (!saved || !Array.isArray(saved.queue) || saved.queue.length === 0) return 0;

      // Only restore if saved within the last 30 minutes (stale queues are discarded)
      const ageMs = Date.now() - (saved.savedAt || 0);
      if (ageMs > 30 * 60 * 1000) {
        console.log('[TaskManager] Persisted queue is older than 30 minutes — discarding stale tasks.');
        await persistenceManager.saveData('task_queue.json', { queue: [], savedAt: Date.now() });
        return 0;
      }

      // Build a mapping from old operationId -> new task object so we can remap dependsOn
      // Tasks are saved in queue order (topological), so we process them in order
      const oldOpIdToNewTask = new Map();
      const restoredTasks = [];

      for (const t of saved.queue) {
        if (!t.skillName) continue;

        // Remap dependsOn: replace old operationId references with new task IDs
        let remappedDependsOn = [];
        if (Array.isArray(t.dependsOn) && t.dependsOn.length > 0) {
          for (const depId of t.dependsOn) {
            const mappedTask = oldOpIdToNewTask.get(depId);
            if (mappedTask) {
              // Use both task id and operationId so dependency check finds it
              remappedDependsOn.push(mappedTask.id);
              if (mappedTask.operationId) remappedDependsOn.push(mappedTask.operationId);
            }
            // If the dependency can't be mapped, skip it (assume it was completed)
          }
        }

        const newTask = this.addTask(
          t.skillName,
          t.params || {},
          t.priority,
          t.requestedBy || 'restored',
          t.locks,
          remappedDependsOn,
          t.operationId,
          t.timeoutMs
        );

        // Register old operationId -> new task for dependency remapping
        if (t.operationId) {
          oldOpIdToNewTask.set(t.operationId, newTask);
        }
        restoredTasks.push(newTask);
      }

      const restored = restoredTasks.length;
      if (restored > 0) {
        console.log(`[TaskManager] Restored ${restored} pending task(s) from disk after reconnect.`);
      }
      // Clear persisted queue after restoration to avoid double-restore
      await persistenceManager.saveData('task_queue.json', { queue: [], savedAt: Date.now() });
      return restored;
    } catch (e) {
      console.warn('[TaskManager] Failed to restore queue:', e.message);
      return 0;
    }
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
   * @param {string[]} [dependsOn=[]] - Precursor task / operation IDs
   * @param {string|null} [operationId=null] - Upstream plan operation identifier
   * @returns {Object} The created task object
   * 
   * @example
   * const taskId = ctx.taskManager.addTask('mine', { targetOre: 'diamond', quantity: 32 }, 60, 'Player1');
   */
  addTask(skillName, params = {}, priority = Priorities.AUTONOMOUS, requestedBy = 'system', locks = ['movement', 'inventory'], dependsOn = [], operationId = null, timeoutMs = null) {
    const isLongSkill = ['chop_tree', 'mine', 'build', 'farm', 'craft'].includes(skillName.toLowerCase());
    const task = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      operationId: operationId || null,
      skillName: skillName.toLowerCase(),
      params: params || {},
      priority: typeof priority === 'number' ? priority : Priorities.AUTONOMOUS,
      status: TaskState.PENDING,
      requestedBy: requestedBy || 'system',
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      locks: Array.isArray(locks) ? locks : ['movement', 'inventory'],
      dependsOn: Array.isArray(dependsOn) ? dependsOn : [],
      timeoutMs: timeoutMs || (params && params.timeoutMs) || (isLongSkill ? 180000 : 60000),
      retryCount: 0,
      maxRetries: 2,
      result: null,
      error: null,
      checkpoint: null
    };

    // Log initial creation state: pending
    if (this.ctx && this.ctx.events) {
      this.ctx.events.emit('task.created', task);
      this.ctx.events.emit('log:entry', {
        severity: 'INFO',
        category: 'TASK',
        message: `Task ${task.id} [${task.skillName}] initialized with state: ${task.status}`
      });
    }

    // Priority Queue Insertion (Descending: highest priority first)
    const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
    if (insertIndex === -1) {
      this.queue.push(task);
    } else {
      this.queue.splice(insertIndex, 0, task);
    }

    // Explicit state transition: pending -> queued
    this._transition(task, TaskState.QUEUED);

    // Check if preemption of current active task is warranted
    if (this.activeTask && task.priority > this.activeTask.priority) {
      this.preempt(task);
    }

    return task;
  }

  /**
   * Core scheduler execution loop. Picks the highest-priority unblocked task,
   * acquires locks, and executes the skill with full error, preemption, and timeout handling.
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

    // 1. Cancel queued tasks whose precursor dependencies have permanently failed (exhausted retries)
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const candidate = this.queue[i];
      if (candidate.dependsOn && candidate.dependsOn.length > 0) {
        const failedDep = candidate.dependsOn.find((depId) => this.failedTaskIds.has(depId));
        if (failedDep) {
          // Find the failed predecessor task to check its retry count
          const failedTask = this.queue.find((t) => t.id === failedDep || t.operationId === failedDep);
          const exhaustedRetries = !failedTask || (failedTask.retryCount || 0) >= (failedTask.maxRetries || 2);
          if (exhaustedRetries) {
            this.queue.splice(i, 1);
            const depErr = this.failedTaskIds.get(failedDep);
            this._transition(candidate, TaskState.CANCELLED, {
              error: `Prerequisite dependency '${failedDep}' failed: ${depErr}`
            });
          }
        }
      }
    }

    // 2. Find first task in queue whose dependencies are satisfied AND locks are available
    let taskIndex = -1;
    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];

      // Check unsatisfied dependency barrier
      if (candidate.dependsOn && candidate.dependsOn.length > 0) {
        const hasUnmet = candidate.dependsOn.some((depId) => !this.completedTaskIds.has(depId));
        if (hasUnmet) {
          if (candidate.status !== TaskState.BLOCKED) {
            this._transition(candidate, TaskState.BLOCKED);
          }
          continue;
        }
      }

      if (this.lockManager.acquireLocks(candidate.id, candidate.locks)) {
        taskIndex = i;
        break;
      } else {
        if (candidate.status !== TaskState.BLOCKED) {
          this._transition(candidate, TaskState.BLOCKED);
        }
      }
    }

    if (taskIndex === -1) {
      return false; // All pending tasks currently blocked on locks or unsatisfied dependencies
    }

    const task = this.queue.splice(taskIndex, 1)[0];
    this.activeTask = task;
    this.ctx.currentTask = task;

    // Explicit state transition: queued -> running
    this._transition(task, TaskState.RUNNING);

    let timeoutHandle = null;

    try {
      // Instantiate skill from registry
      const skill = SkillRegistry.loadSkill(task.skillName, this.ctx);
      skill.currentTaskId = task.id;
      this.activeSkillInstance = skill;

      // Pass saved checkpoint if resuming a previously suspended task
      const executionParams = task.checkpoint
        ? { ...task.params, checkpoint: task.checkpoint }
        : task.params;

      // Execution timeout watchdog (cancels hung tasks)
      const isLongTask = ['chop_tree', 'mine', 'build', 'farm', 'craft'].includes(task.skillName);
      const defaultTimeout = isLongTask ? 180000 : 60000;
      const timeoutMs = task.timeoutMs || defaultTimeout;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          if (skill && typeof skill.abort === 'function') {
            skill.abort();
          }
          const timeoutErr = new Error(`Task execution timed out after ${timeoutMs}ms`);
          timeoutErr.name = 'TaskTimeoutError';
          reject(timeoutErr);
        }, timeoutMs);
        if (timeoutHandle && typeof timeoutHandle.unref === 'function') {
          timeoutHandle.unref();
        }
      });

      const result = await Promise.race([
        skill.run(executionParams),
        timeoutPromise
      ]);

      if (timeoutHandle) clearTimeout(timeoutHandle);

      // Explicit state transition: running -> success
      this._transition(task, TaskState.SUCCESS, { result });
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);

      if (err instanceof SkillSuspended) {
        // Preemption suspension: checkpoint saved matching where task actually stopped
        const savedCheckpoint = err.checkpoint !== undefined ? err.checkpoint : task.checkpoint;
        this._transition(task, TaskState.SUSPENDED, { checkpoint: savedCheckpoint });
        // Re-queue suspended task based on priority so higher-priority tasks execute first
        const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
        if (insertIndex === -1) {
          this.queue.push(task);
        } else {
          this.queue.splice(insertIndex, 0, task);
        }
      } else if (err.name === 'TaskTimeoutError') {
        // Task hung watchdog triggered: check retry budget before marking as permanently failed
        task.retryCount = (task.retryCount || 0) + 1;
        if (task.retryCount <= (task.maxRetries || 2)) {
          console.warn(`[TaskManager] Task ${task.id} [${task.skillName}] timed out — retrying (attempt ${task.retryCount}/${task.maxRetries || 2})...`);
          task.status = TaskState.PENDING;
          const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
          if (insertIndex === -1) this.queue.push(task);
          else this.queue.splice(insertIndex, 0, task);
        } else {
          this._transition(task, TaskState.FAILED, { error: err.message });
          if (this.ctx && this.ctx.events) {
            this.ctx.events.emit('task.timeout', task);
            this.ctx.events.emit('log:entry', {
              severity: 'ERROR',
              category: 'TASK',
              message: `Task timed out and permanently cancelled after ${task.retryCount} retries: [${task.skillName}] (${task.id})`
            });
          }
        }
      } else {
        // General error: check retry budget
        task.retryCount = (task.retryCount || 0) + 1;
        if (task.retryCount <= (task.maxRetries || 2) && !err.message.includes('aborted') && !err.message.includes('SkillAbort')) {
          console.warn(`[TaskManager] Task ${task.id} [${task.skillName}] failed (${err.message}) — retrying (attempt ${task.retryCount}/${task.maxRetries || 2}) in 3s...`);
          await new Promise((r) => setTimeout(r, 3000));
          task.status = TaskState.PENDING;
          const insertIndex = this.queue.findIndex((t) => t.priority < task.priority);
          if (insertIndex === -1) this.queue.push(task);
          else this.queue.splice(insertIndex, 0, task);
        } else {
          this._transition(task, TaskState.FAILED, { error: err.message });
        }
      }
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
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

    if (this.activeSkillInstance && typeof this.activeSkillInstance.requestSuspend === 'function') {
      this.activeSkillInstance.requestSuspend();
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
      this._transition(task, TaskState.CANCELLED);
      this.lockManager.releaseLocks(taskId);
      return true;
    }

    // Check active
    if (this.activeTask && this.activeTask.id === taskId) {
      const task = this.activeTask;
      this._transition(task, TaskState.CANCELLED);
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
      this._transition(task, TaskState.CANCELLED);
      this.lockManager.releaseLocks(task.id);
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

  /**
   * Health heartbeat check for AIBrain.
   * @returns {{ ok: boolean, activeTask: string|null, queueLength: number, isPaused: boolean }}
   */
  ping() {
    return {
      ok: true,
      activeTask: this.activeTask ? this.activeTask.id : null,
      queueLength: this.queue ? this.queue.length : 0,
      isPaused: Boolean(this.isPaused)
    };
  }
}

module.exports = {
  TaskManager,
  TaskState
};
