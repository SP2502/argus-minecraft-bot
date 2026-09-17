# Argus Event Bus Specification

`src/core/EventBus.js` is the centralized, asynchronous pub/sub nervous system of Argus. It prevents tight coupling between high-level autonomous routines, API endpoints, WebSocket streamers, and hardware adapters.

## Core Event Catalog

### System & Lifecycle Events
- `bot:ready`: Fired when the bot successfully spawns in the world and all services mount.
  - Payload: `{ username: string }`
- `bot:health`: Fired on in-game health and hunger updates.
  - Payload: `{ health: number, food: number }`
- `bot:error`: Emitted on Mineflayer or network protocol errors.
  - Payload: `Error`
- `bot:kicked`: Emitted when disconnected from server.
  - Payload: `string`

### AI & Scheduling Events
- `ai.tick_rate_changed`: Emitted when adaptive tick rates dynamically adjust.
  - Payload: `{ mode: 'combat'|'active'|'idle'|'dashboard_only', tickRateMs: number }`
- `ai.heartbeat`: Periodic health broadcast across registered subsystems every 5s.
  - Payload: `{ modules: Object, tickRateMs: number, mode: string }`
- `ai.idle`: Emitted when task queue has been idle for > 15s.
  - Payload: `{ idleDurationMs: number }`
- `module.unhealthy`: Emitted when a subsystem fails its ping or times out (>2s).
  - Payload: `{ module: string, error: string }`

### Task Orchestration Events
- `task.queued`: Emitted when a planned task enters the priority queue.
  - Payload: `TaskObject`
- `task.started`: Emitted when task locks are acquired and execution begins.
  - Payload: `TaskObject`
- `task.paused`: Emitted when a task temporarily yields for safety or inventory full.
  - Payload: `{ reason: string }`
- `task.suspended`: Emitted when higher-priority work preempts the active task.
  - Payload: `TaskObject` (with `checkpoint`)
- `task.completed`: Emitted on successful termination of a task.
  - Payload: `TaskObject`
- `task.failed`: Emitted when a skill throws an uncaught error.
  - Payload: `TaskObject`
- `task.cancelled`: Emitted when a user or administrator aborts a task.
  - Payload: `TaskObject`

### Security & Permission Events
- `permission.granted`: Emitted when a user is granted a role.
  - Payload: `{ username, role, grantedBy, expiresAt }`
- `permission.expired`: Emitted when temporary role expires and demotes to Guest.
  - Payload: `{ username, previousRole }`
- `security.auto_blocked`: Emitted when 3 failed authorizations trigger a 10-minute lock.
  - Payload: `{ username, lockUntil }`

### Domain Skill Events
- `mining.block_mined`: `{ block, mined, total }`
- `mining.escape_route_saved`: `{ position }`
- `farming.crop_harvested`: `{ crop, position, harvested, replanted }`
- `building.block_placed`: `{ blockType, position, progress, percent }`
- `building.checkpoint`: `{ structure, material, blocksPlaced, totalBlocks, origin, timestamp }`
- `combat.started`: `{ mode, targetMob, targetQuantity }`
- `combat.hit`: `{ target, attempt }`
- `combat.mob_killed`: `{ mobType, mobsDefeated, targetQuantity }`
- `logistics.chest_indexed`: `{ position, category, label, itemCount }`
- `logistics.item_transferred`: `{ action, item, count, chest }`

### Telemetry & Logging
- `log:entry`: Real-time structured log entries forwarded to WebSocket and persistent files.
  - Payload: `{ severity: 'CRITICAL'|'ERROR'|'WARN'|'INFO'|'SUCCESS'|'DEBUG'|'TRACE', category: string, message: string }`
