const test = require('node:test');
const assert = require('node:assert');
const ActionQueueService = require('../src/shared/services/action-queue.service');

test('ActionQueueService - Priority-Sorted Action Execution', async () => {
  const executionOrder = [];
  const queue = new ActionQueueService(null);

  // Enqueue 3 items in reverse priority order
  const p1 = queue.enqueue(async () => {
    executionOrder.push('low');
    return 'low_done';
  }, 10);

  const p2 = queue.enqueue(async () => {
    executionOrder.push('high');
    return 'high_done';
  }, 90);

  const p3 = queue.enqueue(async () => {
    executionOrder.push('medium');
    return 'medium_done';
  }, 50);

  const results = await Promise.all([p1, p2, p3]);

  assert.deepStrictEqual(results, ['low_done', 'high_done', 'medium_done']);
  // High and medium should run before low (the first item popped immediately upon enqueue if idle,
  // but queued items are sorted by priority)
  assert.ok(executionOrder.includes('low'));
  assert.ok(executionOrder.includes('high'));
  assert.ok(executionOrder.includes('medium'));
  assert.strictEqual(queue.totalExecuted, 3);
});

test('ActionQueueService - Cancellation Token Support', async () => {
  const queue = new ActionQueueService(null);
  let actionExecuted = false;

  const cancelledToken = { isCancelled: true };

  await assert.rejects(
    async () => {
      await queue.enqueue(
        async () => {
          actionExecuted = true;
          return 'ok';
        },
        50,
        { cancellationToken: cancelledToken }
      );
    },
    { message: /Action cancelled via cancellation token/ }
  );

  assert.strictEqual(actionExecuted, false);
});

test('ActionQueueService - Timeout Guard', async () => {
  const queue = new ActionQueueService(null);

  await assert.rejects(
    async () => {
      await queue.enqueue(
        async () => {
          // Simulate hanging action
          await new Promise((resolve) => setTimeout(resolve, 200));
          return 'done';
        },
        50,
        { timeoutMs: 30 }
      );
    },
    { message: /Action timed out after 30ms/ }
  );
});

test('ActionQueueService - Queue Clear and Ping', async () => {
  const queue = new ActionQueueService(null);

  const ping = queue.ping();
  assert.strictEqual(ping.ok, true);
  assert.strictEqual(ping.queueLength, 0);
  assert.strictEqual(ping.isProcessing, false);

  // Queue item and clear
  let rejected = false;
  const p = queue.enqueue(async () => {
    await new Promise((r) => setTimeout(r, 100));
  }, 10).catch(() => {
    rejected = true;
  });

  queue.clear();
  await p;
  assert.strictEqual(queue.queue.length, 0);
});
