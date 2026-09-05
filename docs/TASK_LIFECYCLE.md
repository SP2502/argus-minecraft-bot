# Argus Task Lifecycle & Preemption Model

The `core/TaskManager.js` engine schedules all bot activities using a priority-preemptive state machine.

```
       [ USER / NLP / DASHBOARD / CRON ]
                       |
                       v
                 +-----------+
                 |  PENDING  | (Gateway validation & disambiguation)
                 +-----------+
                       |
                       v
                 +-----------+
    +----------->|  QUEUED   |<----------------------+
    |            +-----------+                       |
    |                  |                             |
    |                  v                             |
    |            +-----------+                       |
    |            |  STARTING | (Lock Acquisition)    |
    |            +-----------+                       |
    |                  |                             |
    |                  v                             |
    |            +-----------+     Preemption        |
    |            |  RUNNING  |-----------------------+
    |            +-----------+ (SkillSuspended with checkpoint)
    |                  |
    |    +-------------+-------------+
    |    |             |             |
    v    v             v             v
+-----------+    +-----------+ +-----------+
| CANCELLED |    |  SUCCESS  | |  FAILED   |
+-----------+    +-----------+ +-----------+
```

## State Definitions

1. **PENDING**: Command received, parsed by NLP, permissions verified by `PermissionManager`.
2. **QUEUED**: Enqueued in descending order of `priority` (100 = Survival, 95 = Combat, 90 = Task, 85 = Time, 75 = Resource, 30 = Idle).
3. **STARTING**: Schedular verifies resource locks (`movement`, `inventory`, `crafting`, etc.) are free and atomically claims them in `LockManager`.
4. **RUNNING**: Skill instance instantiated and `.run(params)` executes. Checkpoints emitted periodically.
5. **SUSPENDED**: Higher-priority task arrived. Active skill caught `SkillSuspended`, captured current progress in `task.checkpoint`, and re-queued at index 0.
6. **SUCCESS**: Task completed all objectives cleanly; locks released.
7. **FAILED**: Unhandled error thrown. Skill aborted, locks released.
8. **CANCELLED**: Explicit user cancellation (`cancel`, `stop`, `emergency stop`) or shutdown.

## Priority Formula & Preemption

$$ \text{Priority} = \text{Base Priority} + \text{Urgency Modifier} + \text{Risk Factor} $$

- **Base Priority**: Derived from task category (e.g. `SURVIVAL: 100`, `COMBAT: 95`, `MANUAL_TASK: 90`, `AUTONOMOUS: 70`, `IDLE: 30`).
- **Urgency Modifier**: Dynamic hunger/durability depletion scale (up to +50 points).
- **Risk Factor**: Nearby hostile entity threat density (up to +30 points).

If an incoming task has higher priority than the currently running task, `taskManager.preempt(newTask)` calls `activeSkill.abort()`. The running skill persists its checkpoint, yields locks, and allows the higher-priority task to run immediately.
