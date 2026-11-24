# 01 — System Architecture
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

---

## High-Level Component Map

```mermaid
flowchart TD
    MC["Minecraft Server\n(Mineflayer TCP)"]
    CHAT["MinecraftChatAdapter\nsrc/modules/commands/adapters/MinecraftChatAdapter.js"]
    REST["RestCommandAdapter\nsrc/modules/commands/adapters/RestCommandAdapter.js"]
    DASH["DashboardCommandAdapter\nsrc/modules/commands/adapters/DashboardCommandAdapter.js"]
    GW["UnifiedCommandGateway\nsrc/modules/commands/UnifiedCommandGateway.js"]
    NLP["NLP / IntentParser\nsrc/modules/nlp/IntentParser.js"]
    PLAN["CommandPlanner\nsrc/modules/commands/CommandPlanner.js"]
    PERM["PermissionManager\nsrc/modules/security/permission.service.js"]
    TM["TaskManager\nsrc/core/TaskManager.js"]
    SR["SkillRegistry\nsrc/core/SkillRegistry.js"]
    SKILLS["Skills\nmine|farm|chop_tree|combat|craft|build|logistics|navigation"]
    MFAPI["Mineflayer APIs\nbot.dig / bot.placeBlock / pathfinder / bot.attack"]
    EB["EventBus\nsrc/core/EventBus.js"]
    BC["BotContext\nsrc/core/BotContext.js"]
    BRAIN["AIBrain\nsrc/core/AIBrain.js"]
    WS["WebSocket / Dashboard\nsrc/modules/dashboard/"]

    MC -->|chat / whisper / messagestr| CHAT
    CHAT -->|execute(request)| GW
    REST -->|execute(request)| GW
    DASH -->|execute(request)| GW
    GW --> PERM
    GW --> NLP
    GW --> PLAN
    GW --> TM
    TM --> SR
    SR --> SKILLS
    SKILLS --> MFAPI
    SKILLS --> EB
    BC -.->|provides| GW
    BC -.->|provides| TM
    BC -.->|provides| SKILLS
    BRAIN -->|tick loop| TM
    EB -->|events| WS
    BRAIN -->|heartbeat| BC
```

---

## Bootstrap / Initialization Sequence

**File:** `index.js` — `bootstrap()` function

1. `persistenceManager.ensureDataDir()` — create local data directory
2. `startServer(ctxProxy, apiPort)` — Express + WebSocket API server starts
3. `stateStore.connect(MONGODB_URI)` — MongoDB connect (or graceful local fallback)
4. `initBot()` — Mineflayer bot creation starts

**`initBot()` sequence:**
1. `authManager.createBot()` — creates Mineflayer bot with env config: `MC_HOST`, `MC_PORT`, `MC_USERNAME`, `AUTH_MODE`
2. `bot.on('physicTick')` — GrimAC anti-cheat tick_end packet workaround
3. `bot.on('messagestr')` — server auth message handler (login/register on plugin servers)
4. **`bot.on('spawn')`** — main lifecycle entry:
   - `new BotContext(bot)` — full DI container construction
   - `new AIBrain(ctx)` — cognitive loop
   - `chatAdapter = new MinecraftChatAdapter(ctx); chatAdapter.attach()` — chat listeners
   - `aiBrain.start()` — autonomous tick loop begins
   - `taskManager.restoreQueue()` — restore persisted queue
5. `setInterval` (500ms) — combat scan (**⚠ see Finding F04: reads `botContext.taskManager.currentTask`, not `activeTask`**)

**Reconnect:** Exponential backoff (5s → 120s max) via `scheduleReconnect()`.

---

## BotContext — Dependency Injection Container

**File:** `src/core/BotContext.js`

BotContext is constructed on every `bot.on('spawn')` and passed to every skill, service, and module. It is the single source of truth for all subsystem references.

| Property | Type | Provides |
|---|---|---|
| `bot` | Mineflayer.Bot | Raw Mineflayer instance |
| `events` / `eventBus` | EventBus | Pub/sub bus (same instance) |
| `skills` | SkillRegistry | `loadSkill(name, ctx)` |
| `locations` | LocationRegistry | Named location CRUD |
| `nav` | NavigationService | `goTo`, `followEntity`, `returnHome`, `retracePath` |
| `inv` / `inventory` | InventoryService | `hasItem`, `isFull`, `organizeHotbar`, `depositAll` |
| `tools` / `tool` | ToolService | `getBestTool`, `equipBest` |
| `crafting` | CraftingService | recipe resolution |
| `combat` | CombatHelperService | `getImmediateThreat`, `defendAgainst` |
| `logistics` | LogisticsService | `findItemInWarehouse` |
| `ambient` | AmbientBehaviorService | `toggle`, `evaluate`, `checkSleepRoutine` |
| `humanoid` | HumanoidBehaviorService | Anti-bot mimicry |
| `goalPlanner` | GoalPlannerService | `decompose(op, inv)` |
| `webhooks` | WebhookDispatcher | Outbound HTTP notifications |
| `messageRouter` | MessageRouter | `send(priority, msg)`, `respondToCommand` |
| `permissionManager` / `permissions` | PermissionManager | RBAC, rate limiting |
| `serverAuth` | serverAuthManager | Auto-login for plugin servers |
| `taskManager` | TaskManager | Queue, `enqueue`, `runNext`, `cancelTask` |
| `conversationContext` | ConversationContextManager | Multi-turn state |
| `confirmations` | ConfirmationManager | Dangerous command 2-phase |
| `nlp` | NLP module index | `parse(text)` |
| `commandPlanner` | CommandPlanner | `plan(parseResult, ctx)` |
| `commandGateway` | UnifiedCommandGateway | `execute(request)` |
| `currentTask` | Object\|null | ⚠ Set by TaskManager `runNext()` finally block; also read by combat scanner in `index.js` |

**⚠ UNASSESSED OBSERVATION:** `BotContext.currentTask` is set to `null` in `TaskManager.runNext()` finally block, mirroring `TaskManager.activeTask`. The combat scanner in `index.js` reads `botContext.taskManager.currentTask` — but `TaskManager` has no field named `currentTask`; it uses `this.activeTask`. This is Finding F04.

---

## AIBrain — Autonomous Tick Loop

**File:** `src/core/AIBrain.js`

Runs on adaptive interval: combat=50ms, active-task=100ms, idle=500ms, dashboard=1000ms.

**`evaluateTick()` logic:**
1. Auto-eat if food low
2. `safety.isCritical()` → emergency return home
3. `combat.getImmediateThreat(10)` → self-defense if mob within 10m
4. `taskManager.getQueueSnapshot()` → if `activeTask` exists, stay at active rate; if queue non-empty, call `runNext()`
5. Idle → humanoid mimicry, ambient behaviors

**Heartbeat:** Every 5s, pings all registered modules; emits `module.unhealthy` on failure.

---

## TaskManager — Scheduler State Machine

**File:** `src/core/TaskManager.js`

**Task states:** `pending → queued → starting → running → (success | failed | suspended | cancelled | blocked)`

**Key properties:**
- `this.activeTask` — the **authoritative** currently running task (or null)
- `this.activeSkillInstance` — the running skill instance
- `this.queue` — priority-sorted array of pending tasks
- `this.lockManager` — `LockManager` instance

**`enqueue(taskDef)`:**
1. Creates task object with id, skillName, params, priority, locks, dependsOn
2. Checks `dependsOn` completion via `completedTaskIds` and `failedTaskIds`
3. Acquires locks via `LockManager.acquireLocks()`
4. Sorts into `this.queue` by priority (descending)
5. Emits `task.queued`

**`runNext()`:**
1. Checks `isPaused`, `activeTask` (skips if already running)
2. Dequeues highest-priority task
3. `_transition(task, STARTING)`
4. `SkillRegistry.loadSkill(task.skillName, ctx)` — **⚠ throws if skill name not registered (Finding F01)**
5. `_transition(task, RUNNING)`; sets `this.activeTask = task`, `this.ctx.currentTask = task`
6. Calls `skill.run(params)` with timeout wrapper
7. Finally: releases locks, clears `activeTask` and `ctx.currentTask`

**⚠ Persistence risk (Finding F07):** `_transition()` calls `_persistQueue().catch(() => {})` — fire-and-forget, no ordering guarantee.

**`cancelTask(taskId)`:**
- Calls `skill.abort()`, then immediately clears `activeTask` and releases locks (Finding F06: async race with running skill).

---

## SkillRegistry — Registered Skills

**File:** `src/core/SkillRegistry.js`

| Registered Name | Class | File |
|---|---|---|
| `mine` | MineSkill | `src/modules/mining/mining.skill.js` |
| `farm` | FarmSkill | `src/modules/farming/farming.skill.js` |
| `chop_tree` | ChopTreeSkill | `src/modules/forestry/forestry.skill.js` |
| `combat` | CombatSkill | `src/modules/combat/combat.skill.js` |
| `craft` | CraftSkill | `src/modules/inventory/crafting.skill.js` |
| `build` | BuildSkill | `src/modules/building/building.skill.js` |
| `logistics` | LogisticsSkill | `src/modules/logistics/logistics.skill.js` |
| `navigation` | NavigationSkill | `src/modules/navigation/navigation.skill.js` |

**NOT registered (but referenced in CommandSchemas.js):**
- `inventory` — referenced by `sort_inventory`, `store_all`, `store_item`, `retrieve_item`, `drop_item`, `drop_all`, `show_inventory` (Finding F01)
- `locations` — referenced by `register_base`, `list_bases`, `register_farm`, `list_farms`, `register_mine`, `list_mines`, `set_waypoint`, `list_waypoints`, `remove_waypoint` (Finding F01)
- `control` — referenced by `stop`, `resume`, `cancel`, `stop_all`, `queue`
- `security` — referenced by `grant_permission`, `revoke_permission`, `who_has_access`, `security_log`
- `communication` — referenced by `quiet_mode_on`, `quiet_mode_off`, `dnd`, `dnd_off`
- `macro` — referenced by `create_macro`, `run_macro`, `list_macros`, `show_macro`, `delete_macro`
- `core` — referenced by `help`, `status`, `where_are_you`, `health_status`, `uptime`

**Note:** Many of the above (`isControl: true`) are handled directly in `UnifiedCommandGateway.executeControlOperation()` and never reach `SkillRegistry.loadSkill()`. But non-control variants with these skill names (`sort_inventory`, `store_all`, `register_base`, etc.) **will** hit `loadSkill()` and throw.

---

## Command Pipeline — Unified Command Gateway

**File:** `src/modules/commands/UnifiedCommandGateway.js`

`execute(request)` pipeline steps:
1. Normalize text, strip formatting codes
2. Apply prefix policy (`commandPolicies.REQUIRE_PREFIX`)
3. Strip bot name callout (e.g., "Argus, do X" → "do X")
4. Length validation
5. Rate limit check (`permissions.checkRateLimit`)
6. Pending conversation state intercept
7. Confirmation intercept (`yes`/`no` routing)
8. Social greeting intercept (`messageRouter.handleSocialGreeting`)
9. `nlp.parse(normalized)` — intent + entities
10. Handle parse failure (spell-correct suggestion)
11. `commandPlanner.plan(parseResult, requestContext)` → `plan`
12. Check `plan.ambiguities` → prompt user if ambiguous
13. **⚠ No check on `plan.missing` here (Finding F03)**
14. Authorization check: `permissions.checkPermission(senderId, requiredPermission)`
15. If `plan.type === 'control'` → `executeControlOperation(request, op)`
16. Else → `taskManager.enqueue(taskDef)` for each operation
17. `createAudit()` → MongoDB + EventBus

**`executeControlOperation(request, op)` switch cases (implemented):**
`help`, `status`, `where_are_you`, `health_status`, `uptime`, `stop`, `stop_all`, `resume`, `cancel`, `grant_permission`, `revoke_permission`, `show_inventory`, `stop_following`, `create_macro`, `list_macros`, `find_item`, `ambient_mode`, `sleep`, `wake`

**Default return:** `CommandResponse.success("Control operation '...' executed.")` — **⚠ applies to all unhandled intents (Finding F02)**

---

## State Ownership Map

| Data | Owned By | Persisted |
|---|---|---|
| Active task | `TaskManager.activeTask` | No (memory only) |
| Task queue | `TaskManager.queue` | Yes — `task_queue.json` via `persistenceManager` |
| Named locations | `LocationRegistry` | MongoDB (Location model) |
| Permissions | `PermissionManager` | MongoDB (Permission model) |
| Command audits | `CommandAudit` Mongoose model | MongoDB |
| Macros | `Macro` Mongoose model | MongoDB |
| Chest inventory index | `LogisticsService` | In-memory + optional persistence |
| Bot health/position | Mineflayer bot state | None (live only) |
| Session tokens | `session-auth.js` | In-memory Map |
| State snapshots | `persistenceManager` | `data/state_snapshot.json` |

---

## Event Bus — Key Events

**File:** `src/core/EventBus.js` (extends Node.js EventEmitter)

| Event | Publisher | Subscriber |
|---|---|---|
| `task.state_changed` | TaskManager._transition | Dashboard WebSocket |
| `task.queued` | TaskManager.enqueue | AIBrain (implicit via snapshot) |
| `task.running` | TaskManager._transition | Dashboard |
| `task.success` / `task.failed` | TaskManager._transition | Dashboard, MessageRouter |
| `command.audit` | UnifiedCommandGateway | Dashboard, logger |
| `mining.block_mined` | MineSkill.run | Dashboard stats |
| `ai.heartbeat` | AIBrain.checkHeartbeats | Dashboard |
| `module.unhealthy` | AIBrain.checkHeartbeats | Logger |
| `log:entry` | Multiple | Logger, Dashboard WebSocket |
| `bot:reconnect` | index.js / dashboard | index.js reconnect handler |
| `task_manager:paused` / `resumed` | TaskManager | Dashboard |

---

## Security / RBAC

**File:** `src/modules/security/permission.service.js`

5 tiers: `0=blocked`, `1=guest`, `2=trusted`, `3=admin`, `4=owner`

- Owner username set via `OWNER_USERNAME` env var; hardcoded fallback `ShadowPace2502` visible in `BotContext.js` combat whitelist
- Rate limit: 10 commands/minute for non-owners
- Brute-force: 3 auth failures in 5 min → 10 min lockout
- Dangerous command confirmation: 60s challenge window (`ConfirmationManager`)
