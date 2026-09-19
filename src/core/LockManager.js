/**
 * LockManager - Granular resource lock coordinator preventing race conditions and resource contention.
 * Managed locks include: 'movement', 'inventory', 'combat', 'chat', 'crafting', 'vision'.
 */
class LockManager {
  /**
   * @param {import('events').EventEmitter} [events] - EventBus instance for observable audit logs
   */
  constructor(events = null) {
    this.events = events;
    this.locks = new Map(); // Key: lockName (string), Value: { taskId: string, acquiredAt: number }
    this.lockTimeoutMs = 300000; // 5 minutes max lock retention
  }

  /**
   * Attempts to atomically acquire all requested resource locks.
   * @param {string} taskId - Unique task identifier
   * @param {string[]} lockNames - Array of lock names required
   * @returns {boolean} True if all locks were successfully acquired
   */
  acquireLocks(taskId, lockNames = []) {
    if (!Array.isArray(lockNames) || lockNames.length === 0) return true;

    // First check if ANY requested lock is held by a different task
    for (const name of lockNames) {
      if (this.locks.has(name)) {
        const holding = this.locks.get(name);
        if (holding.taskId !== taskId) {
          return false; // Contention: lock held by another task
        }
      }
    }

    // Atomically grant all locks to taskId
    const now = Date.now();
    for (const name of lockNames) {
      this.locks.set(name, { taskId, acquiredAt: now });
    }

    if (this.events) {
      this.events.emit('lock:acquired', { taskId, locks: lockNames });
      this.events.emit('log:entry', {
        severity: 'INFO',
        category: 'LOCK',
        message: `Locks acquired by ${taskId}: [${lockNames.join(', ')}]`
      });
    }

    return true;
  }

  /**
   * Releases all resource locks held by a specific task.
   * @param {string} taskId - Unique task identifier
   * @returns {string[]} List of released lock names
   */
  releaseLocks(taskId) {
    if (!taskId) return [];
    const released = [];
    for (const [lockName, holding] of this.locks.entries()) {
      if (holding.taskId === taskId) {
        this.locks.delete(lockName);
        released.push(lockName);
      }
    }

    if (released.length > 0 && this.events) {
      this.events.emit('lock:released', { taskId, locks: released });
      this.events.emit('log:entry', {
        severity: 'INFO',
        category: 'LOCK',
        message: `Locks released by ${taskId}: [${released.join(', ')}]`
      });
    }

    return released;
  }

  /**
   * Checks whether a specific resource lock is currently held.
   * @param {string} lockName - Lock identifier (e.g. 'movement')
   * @returns {boolean}
   */
  isLockHeld(lockName) {
    return this.locks.has(lockName);
  }

  /**
   * Checks for deadlock or leaked locks held beyond the maximum lock duration (5 minutes).
   * @returns {string[]} List of taskIds whose locks were force-released due to timeout
   */
  checkLockTimeouts() {
    const now = Date.now();
    const timedOutTasks = new Set();

    for (const [lockName, holding] of this.locks.entries()) {
      if (now - holding.acquiredAt > this.lockTimeoutMs) {
        console.warn(`[LockManager] Lock '${lockName}' held by task ${holding.taskId} timed out (>5m). Force releasing.`);
        timedOutTasks.add(holding.taskId);
        this.locks.delete(lockName);
      }
    }

    return Array.from(timedOutTasks);
  }

  /**
   * Returns a snapshot of all currently active locks for telemetry.
   * @returns {Object<string, { taskId: string, durationMs: number }>}
   */
  getSnapshot() {
    const snapshot = {};
    const now = Date.now();
    for (const [lockName, holding] of this.locks.entries()) {
      snapshot[lockName] = {
        taskId: holding.taskId,
        durationMs: now - holding.acquiredAt
      };
    }
    return snapshot;
  }
}

module.exports = LockManager;
