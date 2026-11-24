# 05 — Feature Reality Matrix (Markdown)
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

> See [`05_FEATURE_REALITY_MATRIX.csv`](05_FEATURE_REALITY_MATRIX.csv) for the machine-readable version.

**Evidence Labels:**
- `SOURCE_PRESENT` — Code exists and is internally coherent
- `MOCK_OR_UNIT_TEST_CLAIM` — Passes unit/mock tests; live unverified
- `OBSERVED_IN_SOURCE` — Directly confirmed by reading source
- `SOURCE_MAPPING_CONFLICT` — Source contradicts documentation claim
- `USER_REPORTED_NONFUNCTIONAL` — Owner live report says not working
- `NOT_EVALUATED` — No evidence in either direction
- `LIVE_VERIFIED` — Actually demonstrated in live Minecraft (none verified here)

**Codex Priority:** P1=Blocking (fix first), P2=High, P3=Medium, P4=Low/deferred

---

## Part 0 — API Server & Dashboard

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Express REST API | `src/modules/dashboard/api/server.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| WebSocket streaming | `src/modules/dashboard/api/websocket.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| 7-level logging | `src/shared/observability/logger.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| State persistence/snapshots | `src/shared/persistence/persistence-manager.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| Graceful shutdown | `index.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P3 |
| WebGL dashboard | `src/modules/dashboard/public/` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P3 |

---

## Part 1 — AI Brain & Decision Engine

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Adaptive ticks | `src/core/AIBrain.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Priority formula | `src/core/AIBrain.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Heartbeat monitoring | `src/core/AIBrain.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| Ambient behaviors | `src/modules/behavior/` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| Goal decomposition | `src/shared/services/goal-planner.service.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |

---

## Part 2 — Access Control & Security

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Owner anchoring | `src/modules/security/permission.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P1 |
| 5-tier RBAC | `src/modules/security/permission.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P1 |
| Brute-force lockout | `src/modules/security/permission.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Rate limiting | `src/modules/security/permission.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Dangerous command confirmation | `src/modules/commands/ConfirmationManager.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |

---

## Part 3 — Communication

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Event bus | `src/core/EventBus.js` | OBSERVED_IN_SOURCE | OBSERVED_IN_SOURCE | P2 |
| Message routing | `src/shared/communication/MessageRouter.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P1 |
| Webhook dispatch | `src/shared/communication/WebhookDispatcher.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P4 |
| Quiet mode / DND | `CommandSchemas.js` (isControl:true) | SOURCE_MAPPING_CONFLICT | SOURCE_MAPPING_CONFLICT | P1 |

> ⚠ `quiet_mode_on`, `quiet_mode_off`, `dnd`, `dnd_off` are control intents with **no handler** in `executeControlOperation` — return false success (F02)

---

## Part 4 — NLP

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Intent recognition | `src/modules/nlp/IntentParser.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P1 |
| Spell correction | `src/modules/nlp/SpellCorrector.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Multi-step command planning | `src/modules/commands/CommandPlanner.js` | SOURCE_MAPPING_CONFLICT | MOCK_OR_UNIT_TEST_CLAIM | P1 |

> ⚠ `plan.missing` not checked before dispatch (F03)

---

## Part 5 — Navigation

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Follow player | `src/modules/navigation/navigation.skill.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Go to coordinates/location | `navigation.skill.js`, `CommandPlanner.js` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | P1 |
| Go home | `navigation.skill.js`, `NavigationService` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |
| **Retrace steps** | `navigation.skill.js`, `CommandPlanner.js` | SOURCE_MAPPING_CONFLICT | USER_REPORTED_NONFUNCTIONAL | **P1** |
| Stop following | `CommandSchemas.js`, `executeControlOperation` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |
| Hazard avoidance | `src/modules/navigation/movement-costs.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |
| Emergency return home | `src/shared/services/safety.service.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |

---

## Part 6 — Mining

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Ore scanning and mining loop | `src/modules/mining/mining.skill.js` | OBSERVED_IN_SOURCE | USER_REPORTED_NONFUNCTIONAL | P2 |
| **Water bucket slot-6 invariant** | `mining.skill.js`, `inventory.service.js` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | **P1** |
| Safe dig invariants | `mining.skill.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P3 |
| Torch placement | `mining.skill.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P3 |
| Inventory check/deposit loop | `mining.skill.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |

---

## Part 7 — Farming

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Crop harvest and replant | `src/modules/farming/farming.skill.js` | OBSERVED_IN_SOURCE | USER_REPORTED_NONFUNCTIONAL | P2 |
| 16-seed reserve invariant | `src/modules/inventory/inventory.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |

---

## Part 8 — Building

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Procedural schematics | `src/modules/building/schematics.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| Layer-by-layer placement | `src/modules/building/building.skill.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| 50-block checkpoint | `building.skill.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |

---

## Part 9 — Combat

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Threat scoring | `src/modules/combat/combat.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Tactical maneuvers | `combat.policy.js`, `mob-tactics.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| Friendly fire protection | `combat.policy.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| **Background combat scanner** | `index.js` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | **P1** |

> ⚠ Combat scanner reads `botContext.taskManager.currentTask` (undefined field) — task yield check never works (F04)

---

## Part 10 — Inventory & Crafting

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| **Inventory management commands** | `CommandSchemas.js` → `skillName:'inventory'` | SOURCE_MAPPING_CONFLICT | USER_REPORTED_NONFUNCTIONAL | **P1** |
| Show inventory | `UnifiedCommandGateway.executeControlOperation` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P2 |
| **Fixed hotbar layout** | `inventory.service.js` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | **P1** |
| Tool durability safety | `src/shared/services/tool.service.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Crafting | `src/modules/inventory/crafting.skill.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Warehouse logistics | `src/modules/logistics/logistics.skill.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P3 |
| **Location registration commands** | `CommandSchemas.js` → `skillName:'locations'` | SOURCE_MAPPING_CONFLICT | USER_REPORTED_NONFUNCTIONAL | **P1** |
| **Location listing commands** | `CommandSchemas.js` (isControl:true, no handler) | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | **P1** |

---

## Part 11 — Task Manager & Integration

| Feature | Source Path | Evidence | Status | Priority |
|---|---|---|---|---|
| Priority preemptive queue | `src/core/TaskManager.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P1 |
| Lock ownership and timeout | `src/core/LockManager.js` | OBSERVED_IN_SOURCE | MOCK_OR_UNIT_TEST_CLAIM | P2 |
| Task checkpoint resumption | `TaskManager.js`, `base.skill.js` | OBSERVED_IN_SOURCE | NOT_EVALUATED | P3 |
| Queue persistence on reconnect | `TaskManager.js` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | P2 |
| **Control commands (queue/cancel list)** | `UnifiedCommandGateway.executeControlOperation` | SOURCE_MAPPING_CONFLICT | NOT_EVALUATED | **P1** |

---

## Priority Summary

| Priority | Count | Key Items |
|---|---|---|
| **P1 (Blocking)** | 11 | Inventory skill registration (F01), false success control intents (F02), plan.missing check (F03), combat scanner field (F04), retrace mode (F05), hotbar slot guard (F08), owner username env, location commands dispatch |
| **P2 (High)** | 18 | Navigation live testing, follow/go_home, most security paths, crafting, most combat |
| **P3 (Medium)** | 11 | Building, farming, forestry, logging, ambient behaviors |
| **P4 (Low)** | 3 | Webhooks, advanced analytics, ML-style pattern recognition |
