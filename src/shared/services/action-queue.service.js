/**
 * ActionQueueService - Manages serial, priority-sorted, and batched low-level atomic actions.
 * Ensures bot actions (e.g. click, look, swing, eat, sleep) are executed cleanly without
 * race conditions, dropped packets, or hanging promises.
 */
class ActionQueueService {
  /**
   * @param {import('mineflayer').Bot} bot - Mineflayer bot instance
   */
  constructor(bot) {
    this.bot = bot;
    this.queue = [];
    this.isProcessing = false;
    this.totalExecuted = 0;
  }

  /**
   * Enqueues an atomic action to be executed in priority order.
   * Higher priority actions jump ahead of lower priority actions.
   * 
   * @param {Function} actionFn - Async function returning a promise
   * @param {number} [priority=0] - Action priority (higher = sooner)
   * @param {Object} [options={}] - Additional execution options
   * @param {number} [options.timeoutMs=10000] - Max execution timeout in ms
   * @param {{ isCancelled?: boolean }|Function} [options.cancellationToken=null] - Optional cancellation token
   * @returns {Promise<any>}
   */
  async enqueue(actionFn, priority = 0, options = {}) {
    const timeoutMs = options.timeoutMs || 10000;
    const cancellationToken = options.cancellationToken || null;

    return new Promise((resolve, reject) => {
      const item = {
        actionFn,
        priority,
        timeoutMs,
        cancellationToken,
        resolve,
        reject,
        enqueuedAt: Date.now()
      };

      // Insert in priority-sorted order (descending)
      let insertIndex = this.queue.length;
      for (let i = 0; i < this.queue.length; i++) {
        if (priority > this.queue[i].priority) {
          insertIndex = i;
          break;
        }
      }
      this.queue.splice(insertIndex, 0, item);

      this.processNext();
    });
  }

  /**
   * Processes the next item in the priority queue.
   * @private
   */
  async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const item = this.queue.shift();

    // Check cancellation token before running
    const isCancelled = item.cancellationToken && (
      typeof item.cancellationToken === 'function'
        ? item.cancellationToken()
        : Boolean(item.cancellationToken.isCancelled)
    );

    if (isCancelled) {
      item.reject(new Error('Action cancelled via cancellation token before execution.'));
      this.isProcessing = false;
      this.processNext();
      return;
    }

    let timer = null;
    let timedOut = false;

    try {
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(new Error(`Action timed out after ${item.timeoutMs}ms.`));
        }, item.timeoutMs);
      });

      const result = await Promise.race([item.actionFn(), timeoutPromise]);
      if (timer) clearTimeout(timer);
      this.totalExecuted++;
      item.resolve(result);
    } catch (err) {
      if (timer) clearTimeout(timer);
      item.reject(err);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }

  /**
   * Cancels queued actions matching an optional filter predicate.
   * @param {Function} [predicate] - (item) => boolean
   */
  cancel(predicate = null) {
    if (!predicate) {
      this.clear();
      return;
    }

    const remaining = [];
    for (const item of this.queue) {
      if (predicate(item)) {
        item.reject(new Error('Action cancelled by queue filter'));
      } else {
        remaining.push(item);
      }
    }
    this.queue = remaining;
  }

  /**
   * Clears all pending actions from the queue with an error.
   */
  clear() {
    this.queue.forEach((item) => item.reject(new Error('Action queue cleared')));
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Subsystem health check and stats reporting.
   * @returns {{ ok: boolean, queueLength: number, isProcessing: boolean, totalExecuted: number }}
   */
  ping() {
    return {
      ok: true,
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      totalExecuted: this.totalExecuted
    };
  }
}

module.exports = ActionQueueService;
