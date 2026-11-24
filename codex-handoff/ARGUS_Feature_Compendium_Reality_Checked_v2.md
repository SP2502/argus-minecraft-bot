# ARGUS Minecraft Bot — Complete Feature Compendium
## Reality-Checked Revision v2 · November 2026

---

> **REALITY CHECK — November 2026**
>
> This is a carefully revised version of the original 27-page ARGUS feature specification.
> All original Parts 0–11, feature categories, and terminology are preserved.
>
> **The bot's owner reports:** Joining the Minecraft server is the only reliably working
> live behavior. Autonomous features are not independently verified in live gameplay.
>
> This document is a **requirements-to-code-and-evidence map**, not production certification.
> Claims marked `MOCK_OR_UNIT_TEST_CLAIM` are based on mock unit tests only.
> Claims marked `USER_REPORTED_NONFUNCTIONAL` come from the owner's direct experience.
> Claims marked `SOURCE_MAPPING_CONFLICT` indicate the source contradicts documentation.
> Only claims marked `OBSERVED_IN_SOURCE` or `LIVE_VERIFIED` have direct, independent support.
>
> *Original PDF preserved at: `argus\reference\ARGUS_Original_Feature_Compendium.pdf`*
> *Commit inspected: `97f0ba6016b170eb48762b1651481f5051e1bbd1`*

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Part 0: API Server & Real-Time Dashboard](#part-0-api-server--real-time-dashboard)
- [Part 1: Central AI Brain & Decision Engine](#part-1-central-ai-brain--decision-engine)
- [Part 2: Access Control & Security](#part-2-access-control--security)
- [Part 3: Communication & Event System](#part-3-communication--event-system)
- [Part 4: Natural Language Processing](#part-4-natural-language-processing)
- [Part 5: Navigation & Pathfinding](#part-5-navigation--pathfinding)
- [Part 6: Mining & Resource Extraction](#part-6-mining--resource-extraction)
- [Part 7: Farming & Agriculture](#part-7-farming--agriculture)
- [Part 8: Building & Construction](#part-8-building--construction)
- [Part 9: Combat & Defense](#part-9-combat--defense)
- [Part 10: Inventory Management & Crafting](#part-10-inventory-management--crafting)
- [Part 11: Task Manager & System Integration](#part-11-task-manager--system-integration)
- [Complete System Integration](#complete-system-integration)

---

## Executive Summary

**Intended capability (original specification):**
ARGUS is a production-grade, modular Minecraft bot with 11 interconnected parts designed for maximum reliability, intelligence, and silent operation. The system uses event-driven architecture, database persistence, and advanced AI decision-making to operate autonomously while remaining under owner control. Total features designed: 500+. Estimated lines of code: 15,000–20,000.

**Reality-checked status (November 2026):**

| Domain | Source Present | Test Coverage | Live-Verified | Priority Gaps |
|---|---|---|---|---|
| API / Dashboard | Yes | Mock/unit | No | P2 |
| AI Brain / Scheduler | Yes | Mock/unit | No | P2 |
| Access Control | Yes | Mock/unit | No (env-dependent) | P1 |
| Communication | Partial | Mock/unit | No | P1 |
| NLP | Yes | Mock/unit | No | P1 |
| Navigation | Yes | Mock/unit | No | P1 |
| Mining | Yes | Mock/unit | No | P1 |
| Farming | Yes | Mock/unit | No | P2 |
| Building | Yes | Mock/unit | No | P3 |
| Combat | Yes | Mock/unit | No | P1 |
| Inventory/Crafting | **Partial (dispatch broken)** | Mock/unit | No | **P1 — BROKEN** |
| Task Manager | Yes | Mock/unit | No | P1 |

**Codex work required:** All domains require live verification. Six source-confirmed dispatch defects (F01–F05, F08) block core commands before live testing can proceed.

---

## Part 0: API Server & Real-Time Dashboard

### Core Infrastructure

**Intended capability:** Express.js REST API with health checks, state queries, and statistics endpoints; WebSocket real-time streaming for live bot vitals, logs, and events; rate limiting (100 requests/minute per IP) with API key authentication; CORS configuration.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Express REST API | `src/modules/dashboard/api/server.js` | Integration test (mocked) | SOURCE_PRESENT | Live HTTP not independently verified |
| WebSocket streaming | `src/modules/dashboard/api/websocket.js` | Integration test (mocked) | SOURCE_PRESENT | Browser WebSocket not tested |
| Rate limiting (REST) | Express middleware in `server.js` | Mocked | SOURCE_PRESENT | Not tested against real traffic |
| API key auth | `server.js` | Session auth test (mocked) | SOURCE_PRESENT | `API_KEY` env var required |

### Advanced Logging System

**Intended capability:** 7-level severity (Critical=0 through Trace=6); async file writing with batching; category-based filtering; log rotation (100MB, 7 days); real-time WebSocket broadcasting.

| Feature | Implementation Path | Test Evidence | Actual Status |
|---|---|---|---|
| 7-level severity logger | `src/shared/observability/logger.js` | Invariants test | SOURCE_PRESENT |
| Async batched writes | `logger.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM |
| Log rotation | `logger.js` | Not tested | NOT_EVALUATED |
| WebSocket log broadcast | `src/modules/dashboard/api/websocket.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM |

### State Persistence & Recovery

**Intended capability:** Snapshot every 5 minutes → `state_snapshot.json`; delta encoding; event sourcing; atomic writes; checksum verification; graceful recovery from corruption.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Periodic snapshots | `src/shared/persistence/persistence-manager.js` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM | Async fire-and-forget (Finding F07) |
| SHA-256 checksum | `persistence-manager.js` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM | Not tested with actual file corruption |
| Atomic writes | `persistence-manager.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Race condition risk (F07) |
| State restore on reconnect | `index.js` + `persistence-manager.js` | Partial | SOURCE_PRESENT | Queue restore skips unresolved deps |

### Production Web Dashboard

**Intended capability:** WebGL 3D world viewer; predictive alerts; comparative analytics; live monitoring panels; mobile responsive; dark mode; data export.

| Feature | Implementation Path | Actual Status |
|---|---|---|
| WebGL 3D viewer | `src/modules/dashboard/public/js/dashboard.js` | SOURCE_PRESENT (not live-tested) |
| Live monitoring panels | `src/modules/dashboard/public/` | SOURCE_PRESENT |
| Data export | Dashboard routes | SOURCE_PRESENT |

**Codex Phase:** P2 — requires browser live test after command pipeline is verified.

---

## Part 1: Central AI Brain & Decision Engine

### Decision Engine

**Intended capability:** Context evaluation every tick (50ms); multi-factor decision making; priority formula: `Priority = Base_Priority + Urgency_Modifier + Risk_Factor`.

| Feature | Implementation Path | Test Evidence | Actual Status |
|---|---|---|---|
| Adaptive ticks (50ms/100ms/500ms/1000ms) | `src/core/AIBrain.js`, `src/shared/config/tick-rates.js` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM |
| Priority formula evaluation | `AIBrain.evaluatePriority()` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM |
| Subsystem heartbeats (5s/2s timeout) | `AIBrain.checkHeartbeats()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM |
| Combat threat detection (live) | `AIBrain.evaluateTick()` → `combat.getImmediateThreat()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM |

### Resource Allocation & Conflict Resolution

**Intended capability:** Atomic resource locking; deadlock prevention (5-minute timeout); emergency owner command override.

| Feature | Implementation Path | Actual Status | Limitations |
|---|---|---|---|
| Resource lock acquisition | `src/core/LockManager.js` | MOCK_OR_UNIT_TEST_CLAIM | Lock override not explicitly tested |
| 5-minute lock timeout | `LockManager.checkLockTimeouts()` | MOCK_OR_UNIT_TEST_CLAIM | Verified with mock |
| Task preemption | `TaskManager.preempt()` | MOCK_OR_UNIT_TEST_CLAIM | Live preemption not tested |

### Intelligent Goal Decomposition

**Intended capability:** "Mine diamonds" decomposes into prerequisite tool crafting chain.

| Feature | Implementation Path | Actual Status |
|---|---|---|
| Goal decomposition | `src/shared/services/goal-planner.service.js` + `CommandPlanner.js` | SOURCE_PRESENT |
| Prerequisite chain building | `GoalPlannerService.decompose()` | NOT_EVALUATED (not fully inspected) |

**Codex Phase:** P2 — test decomposition produces correct subtasks before live skill execution.

---

## Part 2: Access Control & Security

### Role-Based Access Control

**Intended capability:** 5-tier RBAC (Owner=4, Admin=3, Trusted=2, Guest=1, Blocked=0); ShadowPace anchored as immutable Tier-4 owner; brute-force lockout; sliding-window rate limiting.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| 5-tier RBAC | `src/modules/security/permission.service.js` | Invariants + integration test | MOCK_OR_UNIT_TEST_CLAIM | Live permission check depends on correct `OWNER_USERNAME` env var (F10) |
| Owner anchoring (ShadowPace) | `permission.service.js`, `BotContext.js` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM | Hardcoded fallback `ShadowPace2502` in BotContext; `OWNER_USERNAME` env var is authoritative |
| Brute-force lockout | `permission.service.js` | Invariants + security test | MOCK_OR_UNIT_TEST_CLAIM | Depends on correct chat sender identification |
| Rate limiting (10/min) | `permission.service.js` | Invariants + integration test | MOCK_OR_UNIT_TEST_CLAIM | Owner exempt |
| Dangerous command confirmation | `src/modules/commands/ConfirmationManager.js` | Confirmation + integration test | MOCK_OR_UNIT_TEST_CLAIM | 60s window; live behavior not tested |

**⚠ CRITICAL GAP:** If `OWNER_USERNAME` environment variable is not set or does not exactly match the in-game username, all admin/owner commands will be denied. This is a first-priority diagnostic item (F10).

**Codex Phase:** P1 — verify OWNER_USERNAME before all other features.

---

## Part 3: Communication & Event System

### Event Bus

**Intended capability:** Centralized pub/sub event bus decoupling all modules.

| Feature | Implementation Path | Actual Status |
|---|---|---|
| EventBus (Node EventEmitter) | `src/core/EventBus.js` | OBSERVED_IN_SOURCE |
| Cross-module event emission | Used by TaskManager, AIBrain, all skills | OBSERVED_IN_SOURCE |

### Message Routing

**Intended capability:** Priority message routing; in-game chat formatting; quiet mode; DND mode.

| Feature | Implementation Path | Actual Status | Limitations |
|---|---|---|---|
| Priority message routing | `src/shared/communication/MessageRouter.js` | SOURCE_PRESENT | `bot.chat()` output not live-tested |
| Quiet mode on/off | `CommandSchemas.js` → `skillName:'communication'`, `isControl:true` | **SOURCE_MAPPING_CONFLICT** | No handler in `executeControlOperation`; returns false success (F02) |
| DND / DND off | Same as quiet mode | **SOURCE_MAPPING_CONFLICT** | Same as quiet mode |
| Outbound webhooks | `src/shared/communication/WebhookDispatcher.js` | SOURCE_PRESENT | `WEBHOOK_URL` env var required; not tested |

**⚠ FINDING F02 applies:** `quiet_mode_on`, `quiet_mode_off`, `dnd`, `dnd_off` are all `isControl:true` but have no case in `executeControlOperation()`. They return a false success message.

**Codex Phase:** P1 — implement quiet mode and DND handlers in executeControlOperation.

---

## Part 4: Natural Language Processing

### Intent Recognition & Parsing

**Intended capability:** 100+ intent recognition; compound command tokenization ("mine 64 diamonds then go home"); Levenshtein spell correction; disambiguation.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Intent parser | `src/modules/nlp/IntentParser.js` | NLP unit tests | SOURCE_PRESENT | Accuracy not independently measured |
| Compound command tokenization | `src/modules/nlp/CommandTokenizer.js` | NLP unit tests | MOCK_OR_UNIT_TEST_CLAIM | Real chat input not tested |
| Spell correction | `src/modules/nlp/SpellCorrector.js` | Spell corrector test | MOCK_OR_UNIT_TEST_CLAIM | Verified with known typos |
| Entity extraction | `src/modules/nlp/EntityExtractor.js` | Integration tests | MOCK_OR_UNIT_TEST_CLAIM | Edge cases not tested |
| Multi-modal disambiguation | `src/modules/commands/ConversationContextManager.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Live multi-turn not tested |

### Command Planning

**Intended capability:** Translate NLP output to executable plan; resolve named locations; flag missing prerequisites.

| Feature | Implementation Path | Actual Status | Limitations |
|---|---|---|---|
| Plan generation | `src/modules/commands/CommandPlanner.js` | MOCK_OR_UNIT_TEST_CLAIM | — |
| Ambiguity detection | `CommandPlanner.plan()` → `ambiguities[]` | MOCK_OR_UNIT_TEST_CLAIM | Prompts user for clarification |
| **Missing prerequisite guard** | `CommandPlanner.plan()` → `missing[]` | **SOURCE_MAPPING_CONFLICT** | **`missing[]` populated but NOT checked before dispatch (F03)** |

**⚠ FINDING F03:** `plan.missing` is built correctly but `UnifiedCommandGateway.execute()` never reads it before enqueueing tasks. Commands with missing prerequisites proceed and fail late inside skills.

**Codex Phase:** P1 — add `plan.missing` check immediately.

---

## Part 5: Navigation & Pathfinding

### Movement Modes

**Intended capability:** Authoritative navigation service (no competing pathing); dynamic movement costs; hazard avoidance; retrace steps; follow player; go home; emergency flee.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Follow player | `src/modules/navigation/navigation.skill.js` → `_executeFollow()` | Integration test (mock) | MOCK_OR_UNIT_TEST_CLAIM | Live following not tested |
| Go to coordinates | `navigation.skill.js` → `_executeGoTo()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Pathfinder integration not live-tested |
| Go home | `navigation.skill.js` → `_executeReturnHome()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Requires registered base; F03 means no early error if base missing |
| **Retrace steps** | `navigation.skill.js` → retrace mode | — | **SOURCE_MAPPING_CONFLICT** | **CommandPlanner does not set `params.mode='retrace_steps'`; falls back to go_home (F05)** |
| Stop following | `CommandSchemas.js` → `isControl:true`; handled in gateway | Mock test | SOURCE_PRESENT | — |
| Hazard avoidance | `src/modules/navigation/movement-costs.js` + `safety.service.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Real terrain not tested |
| Emergency return home | `src/shared/services/safety.service.js` → `returnHome()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Real health threshold not tested |

**⚠ FINDING F05 — Retrace Steps:** The `retrace_steps` intent maps to the navigation skill but `CommandPlanner._buildOperation()` does not set `params.mode = 'retrace_steps'`. When `NavigationSkill.run()` receives params with no mode and no player/position, it defaults to `go_home`. Retrace steps silently navigates home instead of retracing.

### Location Registry

**Intended capability:** Named locations for bases, farms, mines, waypoints; persistent in MongoDB.

| Feature | Implementation Path | Actual Status | **Known Gap** |
|---|---|---|---|
| Register base/farm/mine/waypoint | `CommandSchemas.js` → `skillName:'locations'` | **SOURCE_MAPPING_CONFLICT** | **'locations' skill not in SkillRegistry; throws on dispatch (F01)** |
| List bases/farms/mines/waypoints | `CommandSchemas.js` → `isControl:true` | **SOURCE_MAPPING_CONFLICT** | **No handler in executeControlOperation; false success (F02)** |
| Location storage | `src/modules/navigation/locations.repository.js`, MongoDB | SOURCE_PRESENT | CRUD code exists; dispatch path broken |

**Codex Phase:** P1 — `register_base`, `register_farm`, `register_mine`, `set_waypoint`, `list_bases`, `list_farms`, `list_mines`, `list_waypoints` all require fixes before location-dependent features work.

---

## Part 6: Mining & Resource Extraction

### Mining Operations

**Intended capability:** Ore priority ranks; vein BFS cluster traversal; branch mining; opportunistic secondary ore collection; torch placement every 8 blocks; deep escape waypoints.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Ore scanning and mining loop | `src/modules/mining/mining.skill.js` | Mock/invariants test | MOCK_OR_UNIT_TEST_CLAIM | USER_REPORTED_NONFUNCTIONAL |
| Ore priority ranks | `src/modules/mining/mining.data.js` | — | SOURCE_PRESENT | — |
| Torch placement | `mining.skill.js` → `_placeTorchIfPossible()` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | `bot.placeBlock()` not live-tested |
| Deep escape waypoints | `mining.skill.js` (every 64 blocks below Y=-40) | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Location registration for waypoints requires fixed dispatch |

### Safety Invariants for Mining

**Intended capability:** Water bucket guaranteed in hotbar slot 6 before hazardous mining; prohibit straight down/up digging.

| Feature | Implementation Path | Actual Status | **Known Gap (F08)** |
|---|---|---|---|
| **Water bucket slot-6 invariant** | `mining.skill.js` → `inv.hasItem()` | **SOURCE_MAPPING_CONFLICT** | `hasItem()` checks ANY slot, not slot 6 specifically. `organizeHotbar()` errors are suppressed. Slot-6 invariant weaker than stated. |
| Straight down/up prohibition | `mining.skill.js` position check | MOCK_OR_UNIT_TEST_CLAIM | Mock-verified; live behavior not tested |

**⚠ FINDING F08:** `docs/ARGUS_COMPLIANCE_MATRIX.md` claims the water bucket invariant is fully verified. Source shows `hasItem('water_bucket')` only confirms the item exists somewhere in inventory. If `organizeHotbar()` fails silently (errors are caught and ignored), the bucket may not be in slot 6, and no abort is triggered.

**Codex Phase:** P1 — fix hotbar slot verification; P2 — live mine test.

---

## Part 7: Farming & Agriculture

### Autonomous Crop Management

**Intended capability:** Detect and harvest mature crops only; immediate replanting after harvest; 16-seed reserve maintained at all times; support for wheat, carrots, potatoes, beets.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Crop harvest loop | `src/modules/farming/farming.skill.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | USER_REPORTED_NONFUNCTIONAL |
| Maturity detection | `src/modules/farming/crops.data.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Real block state not tested |
| Immediate replanting | `farming.skill.js` | Mock test | MOCK_OR_UNIT_TEST_CLAIM | Real item use not tested |
| 16-seed reserve invariant | `src/modules/inventory/inventory.service.js` → `dropLowValueItems()` | Integration test (mock) | MOCK_OR_UNIT_TEST_CLAIM | Real inventory window not tested |

**Codex Phase:** P2 — requires working inventory and navigation before live farming test.

---

## Part 8: Building & Construction

### Procedural Construction

**Intended capability:** Procedural schematics (walls, floors, shelters, stairs); layer-by-layer block placement; temporary scaffolding with cleanup; 50-block checkpoint persistence.

| Feature | Implementation Path | Test Evidence | Actual Status |
|---|---|---|---|
| Procedural schematics | `src/modules/building/schematics.js` | Schematics test (mock) | MOCK_OR_UNIT_TEST_CLAIM |
| Layer-by-layer placement | `src/modules/building/building.skill.js` | Build skill test (mock) | MOCK_OR_UNIT_TEST_CLAIM |
| Scaffolding cleanup | `building.skill.js` + `building.policy.js` | Policies test (mock) | MOCK_OR_UNIT_TEST_CLAIM |
| 50-block checkpoint | `building.skill.js` | Invariants test (mock) | MOCK_OR_UNIT_TEST_CLAIM |

**Codex Phase:** P3 — requires navigation and inventory working in live before build live test.

---

## Part 9: Combat & Defense

### Threat Detection & Response

**Intended capability:** Threat scoring with distance/weapon/damage weighting; tactical maneuvers (kite creeper, shield block skeleton); allied entity protection; background combat scan.

| Feature | Implementation Path | Test Evidence | Actual Status | **Known Gap** |
|---|---|---|---|---|
| Threat scoring | `src/modules/combat/combat.service.js` + `combat.data.js` | Combat helper test (mock) | MOCK_OR_UNIT_TEST_CLAIM | — |
| Tactical maneuvers | `combat.policy.js` + `mob-tactics.js` | Mob tactics test (mock) | MOCK_OR_UNIT_TEST_CLAIM | Real mob AI not tested |
| Allied entity protection | `combat.policy.js` | Defense test (mock) | MOCK_OR_UNIT_TEST_CLAIM | — |
| **Background combat scanner** | `index.js` setInterval 500ms | — | **SOURCE_MAPPING_CONFLICT** | **Scanner reads `taskManager.currentTask` (undefined field); task yield check never works (F04)** |

**⚠ FINDING F04 — Combat Scanner:** The 500ms background combat scan in `index.js` reads `botContext.taskManager.currentTask`. `TaskManager` has no field named `currentTask` — the authoritative field is `activeTask`. The check `const currentTask = botContext.taskManager.currentTask` always returns `undefined`. This means the combat scanner cannot detect whether a planned task is active, potentially causing unauthorized autonomous combat during scheduled operations.

**Codex Phase:** P1 — fix combat scanner field reference; P2 — live combat test.

---

## Part 10: Inventory Management & Crafting

### Inventory Commands

**Intended capability:** Show, sort, store, retrieve, drop inventory items; fixed hotbar layout (slot 0=weapon, 1-3=tool, 6=water bucket, 8=food, offhand=shield).

| Feature | Implementation Path | Actual Status | **Critical Gap** |
|---|---|---|---|
| **Sort inventory** | `CommandSchemas.js` → `skillName:'inventory'` | **SOURCE_MAPPING_CONFLICT** | **'inventory' not in SkillRegistry; throws on dispatch (F01)** |
| **Store all / Store item** | `CommandSchemas.js` → `skillName:'inventory'` | **SOURCE_MAPPING_CONFLICT** | **Same F01 — command fails at dispatch** |
| **Retrieve item / Drop item** | `CommandSchemas.js` → `skillName:'inventory'` | **SOURCE_MAPPING_CONFLICT** | **Same F01** |
| Show inventory | `CommandSchemas.js` → `isControl:true`; handled in gateway | SOURCE_PRESENT | Works via executeControlOperation |
| **Fixed hotbar layout** | `src/modules/inventory/inventory.service.js` → `organizeHotbar()` | **SOURCE_MAPPING_CONFLICT** | **organizeHotbar() errors suppressed; slot 6 water bucket not verified per slot (F08)** |
| Tool durability safety | `src/shared/services/tool.service.js` | MOCK_OR_UNIT_TEST_CLAIM | Mock-verified; live swap not tested |

### Crafting

**Intended capability:** Recipe resolution; crafting table location; smelt via furnace.

| Feature | Implementation Path | Test Evidence | Actual Status |
|---|---|---|---|
| Craft skill | `src/modules/inventory/crafting.skill.js` | Craft skill test (mock) | MOCK_OR_UNIT_TEST_CLAIM |
| Crafting service | `src/modules/inventory/crafting.service.js` | Crafting service test (mock) | MOCK_OR_UNIT_TEST_CLAIM |
| Smelt (furnace) | `crafting.skill.js` with furnace mode | Mock test | MOCK_OR_UNIT_TEST_CLAIM |

### Location Registration (also Part 10 per compendium)

**Intended capability:** Register bases, farms, mines, waypoints via commands; list all registered locations.

| Feature | Actual Status | Critical Gap |
|---|---|---|
| Register base/farm/mine/waypoint | **SOURCE_MAPPING_CONFLICT** | **F01 — 'locations' skill not registered; throws on dispatch** |
| List bases/farms/mines/waypoints | **SOURCE_MAPPING_CONFLICT** | **F02 — isControl:true but no handler; false success** |

**Codex Phase:** P1 — all inventory management commands and location registration require immediate dispatch fixes.

### Warehouse Logistics

**Intended capability:** Warehouse indexing; categorized sorting; kit restocking.

| Feature | Implementation Path | Actual Status |
|---|---|---|
| Index chests | `src/modules/logistics/logistics.skill.js` | MOCK_OR_UNIT_TEST_CLAIM |
| Sort warehouse | `logistics.skill.js` | MOCK_OR_UNIT_TEST_CLAIM |
| Restock | `logistics.skill.js` | MOCK_OR_UNIT_TEST_CLAIM |
| Find item | `src/modules/logistics/logistics.service.js`; handled in gateway | SOURCE_PRESENT |

---

## Part 11: Task Manager & System Integration

### Priority Scheduling

**Intended capability:** Priority-preemptive task queue; single-lock ownership with 5-minute timeout; suspended task checkpoint resumption; queue persistence across reconnects.

| Feature | Implementation Path | Test Evidence | Actual Status | Limitations |
|---|---|---|---|---|
| Priority preemptive queue | `src/core/TaskManager.js` | Integration test (mock) | MOCK_OR_UNIT_TEST_CLAIM | Real preemption not live-tested |
| State machine (pending→running→success/failed) | `TaskManager._transition()` | Mock tests | MOCK_OR_UNIT_TEST_CLAIM | — |
| Resource lock ownership | `src/core/LockManager.js` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM | — |
| 5-minute lock timeout | `LockManager.checkLockTimeouts()` | Invariants test | MOCK_OR_UNIT_TEST_CLAIM | — |
| **Queue persistence (async)** | `TaskManager._persistQueue()` | — | **SOURCE_MAPPING_CONFLICT** | **Fire-and-forget writes; overlap risk (F07)** |
| **Cancellation safety** | `TaskManager.cancelTask()` | — | **SOURCE_MAPPING_CONFLICT** | **Locks released before async skill.run() settles (F06)** |

### Task Control Commands

**Intended capability:** Stop, resume, cancel, stop_all; view task queue; cancel specific tasks.

| Command | Implementation | Actual Status |
|---|---|---|
| `stop` | executeControlOperation case 'stop' | SOURCE_PRESENT |
| `stop_all` | executeControlOperation case 'stop_all' | SOURCE_PRESENT |
| `resume` | executeControlOperation case 'resume' | SOURCE_PRESENT |
| `cancel` | executeControlOperation case 'cancel' | SOURCE_PRESENT (may not support task ID param) |
| **`queue`** (view queue) | No case in executeControlOperation | **SOURCE_MAPPING_CONFLICT (F02)** |

### Macro System

**Intended capability:** Create, run, list, delete, show named macros.

| Feature | Actual Status |
|---|---|
| `create_macro` | SOURCE_PRESENT (handled in gateway) |
| `run_macro` | SOURCE_PRESENT (recursively calls execute()) |
| `list_macros` | SOURCE_PRESENT (handled in gateway) |
| `show_macro` | **SOURCE_MAPPING_CONFLICT** (F02 — no handler; false success) |
| `delete_macro` | **SOURCE_MAPPING_CONFLICT** (F02 — no handler; false success) |

**Codex Phase:** P1 — fix queue display, show_macro, delete_macro, cancel lifecycle.

---

## Complete System Integration

### Data Flow Example (from original specification)

The following is the **intended** data flow. Steps marked ✓ have source code present. Steps marked ⚠ have known gaps.

```
User Command: "mine 64 diamonds"

├→ Part 4 (NLP): Parse command → {action: MINE, item: diamond, qty: 64} ✓
├→ Part 2 (Security): Check authorization → User = Owner → ✓ (depends on OWNER_USERNAME)
├→ Part 11 (Task Manager): Create task → ✓ (source present)
├→ Part 1 (AI Brain): Evaluate → ✓ (tick loop exists)
├→ Part 11: Acquire locks [movement, inventory_slots, tool:pickaxe] → ✓
├→ Part 10 (Inventory): Check for pickaxe → ✓ (source present)
├→ Part 5 (Navigation): Calculate path to mining area (Y:-59) → ✓ (source present, live unverified)
├→ Part 6 (Mining): Begin mining operation → ✓ (source present, live USER_REPORTED_NONFUNCTIONAL)
│   ├→ Inventory > 90% full → pause ✓
│   ├→ Navigate to nearest chest ✓
│   ├→ Store ores (inventory skill) → ⚠ 'inventory' skill not registered (F01)
│   └→ Resume mining ✓ (if store worked)
├→ Task complete
├→ Part 11: Release locks ✓
├→ Part 3 (Communication): Whisper to owner ✓ (source present, live unverified)
└→ Part 0 (Dashboard): Update stats ✓ (source present)
```

### System-Wide Features (Actual vs. Original Claim)

| Claim | Reality-Checked Status |
|---|---|
| "Silent operation: Minimal public chat, comprehensive dashboard monitoring" | SOURCE_PRESENT — quiet mode/DND broken (F02) |
| "Fail-safe architecture: Graceful degradation when modules fail" | PARTIAL — heartbeat exists; failsafe on broken skills is error messages |
| "Event-driven communication: Loose coupling via event bus pattern" | OBSERVED_IN_SOURCE — EventBus is fully wired |
| "Performance-optimized: Action batching, adaptive tick rates, connection pooling" | MOCK_OR_UNIT_TEST_CLAIM — tick rates verified with mocks |
| "Database persistence: MongoDB/PostgreSQL for critical data" | SOURCE_PRESENT — MONGODB_URI env var required; fallback to local JSON |
| "Auto-save system: Every 5 minutes + on critical events" | SOURCE_PRESENT — async writes have ordering risk (F07) |

---

## Summary Table — All Features

| Part | Features Specified | Source Present | Mock-Tested | LIVE_VERIFIED | Has Active Bug | Codex Priority |
|---|---|---|---|---|---|---|
| Part 0 (API/Dashboard) | ~20 | Yes | Partial | No | No | P2 |
| Part 1 (AI Brain) | ~15 | Yes | Partial | No | No | P2 |
| Part 2 (Security) | ~8 | Yes | Yes | No | Yes (env-dep) | P1 |
| Part 3 (Communication) | ~6 | Partial | Partial | No | Yes (F02) | P1 |
| Part 4 (NLP) | ~10 | Yes | Yes | No | Yes (F03) | P1 |
| Part 5 (Navigation) | ~8 | Partial | Partial | No | Yes (F05, F01) | P1 |
| Part 6 (Mining) | ~8 | Yes | Partial | No | Yes (F08) | P1 |
| Part 7 (Farming) | ~5 | Yes | Partial | No | No | P2 |
| Part 8 (Building) | ~6 | Yes | Partial | No | No | P3 |
| Part 9 (Combat) | ~8 | Yes | Partial | No | Yes (F04) | P1 |
| Part 10 (Inventory) | ~12 | Partial | Partial | No | Yes (F01, F02, F08) | P1 |
| Part 11 (Tasks) | ~8 | Yes | Partial | No | Yes (F02, F06, F07) | P1 |

---

*ARGUS Feature Compendium — Reality-Checked Revision v2*
*Generated: November 2026 | Commit: `97f0ba6016b170eb48762b1651481f5051e1bbd1`*
*Original specification preserved at: `argus\reference\ARGUS_Original_Feature_Compendium.pdf`*
*Codex handoff package: `argus\codex-handoff\`*
