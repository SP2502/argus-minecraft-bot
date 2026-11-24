# 03 — Module and File Index
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

Grouped by subsystem. Each entry: path | purpose | key exports | important consumers.

---

## Entry Point

| File | Purpose | Key Exports / Notes |
|---|---|---|
| `index.js` | Bootstrap, Mineflayer lifecycle, reconnect, combat scan | `bootstrap()`, `initBot()`, `cleanupBot()`, `scheduleReconnect()` |
| `package.json` | Dependencies, scripts | `start: node index.js`, `test: node --test` |
| `.env.example` | Required environment variables | `MC_HOST`, `MC_PORT`, `MC_USERNAME`, `AUTH_MODE`, `OWNER_USERNAME`, `MONGODB_URI`, `API_PORT`, `MC_VERSION` |
| `render.yaml` | Render.com deployment config | — |
| `Dockerfile` | Docker container spec | — |

---

## Core (`src/core/`)

| File | Purpose | Key Exports | Consumers |
|---|---|---|---|
| `BotContext.js` | DI container; constructs all services on spawn | `BotContext` class | `index.js`, every Skill, every Service |
| `AIBrain.js` | Adaptive tick loop, priority evaluation, heartbeats | `AIBrain` class | `index.js` |
| `TaskManager.js` | Priority scheduler, state machine, lock coordination | `{ TaskManager, TaskState }` | `BotContext`, `UnifiedCommandGateway`, `AIBrain` |
| `SkillRegistry.js` | Skill name → class map, instantiation | `{ registry, registerSkill, loadSkill }` | `TaskManager.runNext()` |
| `EventBus.js` | Singleton Node EventEmitter pub/sub | default export (EventBus instance) | All modules |
| `AuthManager.js` | Mineflayer bot creation with auth mode | `createBot()`, `authMode` | `index.js` |
| `LockManager.js` | Named resource lock acquire/release with timeout | `LockManager` class | `TaskManager` |
| `base.skill.js` | BaseSkill abstract class | `{ BaseSkill, SkillAbort, SkillSuspended }` | All skill classes |
| `skill.template.js` | Reference skill template | — | — |

---

## Commands (`src/modules/commands/`)

| File | Purpose | Key Exports | Consumers |
|---|---|---|---|
| `UnifiedCommandGateway.js` | Single command entry point; auth, NLP, plan, dispatch | `UnifiedCommandGateway` class | `BotContext`, all adapters |
| `CommandSchemas.js` | Intent → { permission, priority, locks, skillName, isControl } | Frozen schema object | `CommandPlanner._buildOperation`, `UnifiedCommandGateway` |
| `CommandPlanner.js` | NLP → executable plan; entity params, location resolution | `CommandPlanner` class | `BotContext`, `UnifiedCommandGateway` |
| `CommandResponse.js` | Response factory (success, error, denied, info) | `CommandResponse` class | All gateway methods |
| `ConfirmationManager.js` | 60s dangerous-command challenge | `ConfirmationManager` | `BotContext`, `UnifiedCommandGateway` |
| `ConversationContextManager.js` | Multi-turn conversation state | `ConversationContextManager` | `BotContext`, `UnifiedCommandGateway` |
| `dangerous-commands.js` | List of dangerous intent names | `requiresConfirmation(intent)` | `CommandPlanner._buildOperation` |
| `macro.model.js` | Mongoose Macro schema | `Macro` model | `UnifiedCommandGateway` |
| `index.js` | Re-exports commands module | — | — |
| `adapters/MinecraftChatAdapter.js` | Mineflayer chat events → gateway | `MinecraftChatAdapter` | `index.js` (on spawn) |
| `adapters/RestCommandAdapter.js` | Express route handler → gateway | `RestCommandAdapter` | Dashboard API server |
| `adapters/DashboardCommandAdapter.js` | WebSocket message → gateway | `DashboardCommandAdapter` | Dashboard WebSocket |
| `errors/AmbiguityError.js` | Thrown for ambiguous intents | `AmbiguityError` | `CommandPlanner` |
| `errors/AuthorizationError.js` | Thrown for auth failures | `AuthorizationError` | `UnifiedCommandGateway` |
| `errors/CommandError.js` | General command errors | `CommandError` | — |
| `errors/ConfirmationRequiredError.js` | Thrown when confirmation needed | `ConfirmationRequiredError` | `UnifiedCommandGateway` |

---

## NLP (`src/modules/nlp/`)

| File | Purpose | Key Exports |
|---|---|---|
| `IntentParser.js` | Main intent + entity parsing | `IntentParser` class, `parse(text)` |
| `CommandTokenizer.js` | Tokenizes compound commands (`then`, `and`) | `CommandTokenizer` |
| `SpellCorrector.js` | Levenshtein-based typo correction | `SpellCorrector` |
| `IntentRegistry.js` | Loads and merges intent data files | `IntentRegistry` |
| `EntityExtractor.js` | Extracts item, quantity, player, location entities | `EntityExtractor` |
| `QuantityParser.js` | Parses numeric quantities and "all" | `QuantityParser` |
| `CoordinateParser.js` | Parses XYZ coordinates and relative offsets | `CoordinateParser` |
| `SynonymRegistry.js` | Synonym expansion | `SynonymRegistry` |
| `TimeExpressionParser.js` | Parses duration expressions | `TimeExpressionParser` |
| `nlp-thresholds.js` | Confidence thresholds | constants |
| `intents.json` | Base intent definitions | — |
| `intent-data/communication.json` | Communication intents | — |
| `intent-data/core.json` | Core/query intents | — |
| `intent-data/macros.json` | Macro intents | — |
| `intent-data/task-control.json` | Task control intents | — |
| `index.js` | Exports `{ intentParser, parse, ping }` | NLP module interface |

---

## Navigation (`src/modules/navigation/`)

| File | Purpose | Key Exports |
|---|---|---|
| `navigation.skill.js` | NavigationSkill: follow, go_to, go_home, retrace | `NavigationSkill` |
| `navigation.service.js` | Wraps mineflayer-pathfinder: `goTo`, `followEntity`, `returnHome`, `retracePath`, `stopFollowing` | `NavigationService` |
| `location.model.js` | Mongoose Location schema | `Location` model |
| `locations.repository.js` | CRUD for named locations | `LocationRegistry` |
| `navigation.intents.json` | Navigation intent definitions | — |
| `locations.intents.json` | Location management intent definitions | — |
| `movement-costs.js` | Terrain cost weights | constants |
| `index.js` | Re-exports `{ NavigationService, LocationRegistry, NavigationSkill }` | — |

---

## Mining (`src/modules/mining/`)

| File | Purpose | Key Exports |
|---|---|---|
| `mining.skill.js` | MineSkill: ore scan, navigate, dig, inventory check | `MineSkill` |
| `mining.data.js` | Ore names, Y-level targets, priority ranks | `oreData` |
| `mining.intents.json` | Mining intent definitions | — |
| `index.js` | Re-exports `{ MineSkill }` | — |

---

## Farming (`src/modules/farming/`)

| File | Purpose | Key Exports |
|---|---|---|
| `farming.skill.js` | FarmSkill: crop harvest, replant, seed reserve | `FarmSkill` |
| `crops.data.js` | Crop maturity checks, replant items | `cropsData` |
| `farming.intents.json` | Farming intent definitions | — |
| `index.js` | Re-exports `{ FarmSkill }` | — |

---

## Forestry (`src/modules/forestry/`)

| File | Purpose | Key Exports |
|---|---|---|
| `forestry.skill.js` | ChopTreeSkill: tree detection, full-tree chop | `ChopTreeSkill` |
| `forestry.config.js` | Safe tree distance from base | config |
| `forestry.data.js` | Log/sapling data | data |
| `forestry.policy.js` | `shouldPreserveTree()` | `forestryPolicy` |
| `tree-analyzer.js` | Identifies connected tree blocks | `TreeAnalyzer` |
| `forestry.intents.json` | Woodcutting intent definitions | — |
| `index.js` | Re-exports `{ ChopTreeSkill }` | — |

---

## Inventory / Crafting (`src/modules/inventory/`)

| File | Purpose | Key Exports |
|---|---|---|
| `inventory.service.js` | `hasItem`, `isFull`, `organizeHotbar`, `depositAll`, `dropLowValueItems` | `InventoryService` |
| `crafting.service.js` | Recipe lookup, crafting table interaction | `CraftingService` |
| `crafting.skill.js` | CraftSkill: craft and smelt | `CraftSkill` |
| `crafting.config.js` | Crafting configuration | — |
| `crafting.data.js` | Recipe data | — |
| `crafting.intents.json` | Crafting intent definitions | — |
| `chest-interaction.js` | Chest open/close/transfer helpers | `ChestInteraction` |
| `item-categories.js` | Item category classifications | — |
| `item-value.js` | Item value rankings for discard prioritization | — |
| `tool-tiers.js` | Tool tier rankings | — |
| `inventory.intents.json` | Inventory intent definitions | — |
| `index.js` | Re-exports `{ InventoryService, CraftingService, CraftSkill }` | — |

---

## Combat (`src/modules/combat/`)

| File | Purpose | Key Exports |
|---|---|---|
| `combat.skill.js` | CombatSkill: targeted attack, guard, patrol | `CombatSkill` |
| `combat.service.js` | `getImmediateThreat`, `defendAgainst`, `setWhitelist` | `CombatService` |
| `combat.policy.js` | Whitelist, friendly fire prevention | `combatPolicy` |
| `combat.data.js` | Mob threat scores, tactics data | `combatData` |
| `mob-tactics.js` | Per-mob tactical actions (kite, block, etc.) | `MobTactics` |
| `combat.config.js` | Combat configuration constants | — |
| `combat.intents.json` | Combat intent definitions | — |
| `index.js` | Re-exports `{ CombatSkill, CombatService }` | — |

---

## Building (`src/modules/building/`)

| File | Purpose | Key Exports |
|---|---|---|
| `building.skill.js` | BuildSkill: layer-by-layer placement, scaffold, checkpoint | `BuildSkill` |
| `schematics.js` | Procedural blueprint generators (walls, floors, shelters) | `Schematics` |
| `building.policy.js` | Build permission checks | `buildingPolicy` |
| `building.data.js` | Block material data | — |
| `building.config.js` | Building configuration | — |
| `building.intents.json` | Building intent definitions | — |
| `index.js` | Re-exports `{ BuildSkill }` | — |

---

## Logistics (`src/modules/logistics/`)

| File | Purpose | Key Exports |
|---|---|---|
| `logistics.skill.js` | LogisticsSkill: sort warehouse, restock, index chests | `LogisticsSkill` |
| `logistics.service.js` | `findItemInWarehouse`, chest indexing | `LogisticsService` |
| `logistics.config.js` | Logistics configuration | — |
| `logistics.data.js` | Category/item classification data | — |
| `logistics.intents.json` | Logistics intent definitions | — |
| `chest.model.js` | Mongoose Chest schema | `Chest` model |
| `index.js` | Re-exports `{ LogisticsSkill, LogisticsService }` | — |

---

## Behavior (`src/modules/behavior/`)

| File | Purpose | Key Exports |
|---|---|---|
| `ambient-behavior.service.js` | Auto-eat, bed sleep, ambient routines | `AmbientBehaviorService` |
| `humanoid-behavior.service.js` | Anti-bot mimicry (head movement, idle animations) | `HumanoidBehaviorService` |
| `ambient.config.js` | Ambient behavior configuration | — |
| `ambient.intents.json` | Ambient mode intent definitions | — |
| `greetings.js` | Social greeting detection patterns | — |
| `index.js` | Re-exports both services | — |

---

## Security (`src/modules/security/`)

| File | Purpose | Key Exports |
|---|---|---|
| `permission.service.js` | 5-tier RBAC, rate limiting, lockouts | `PermissionManager` |
| `permission.model.js` | Mongoose Permission schema | `Permission` model |
| `command-audit.model.js` | Mongoose CommandAudit schema | `CommandAudit` model |
| `command-policies.js` | Prefix policy, max length constants | `commandPolicies` |
| `permissions.intents.json` | Security/permission intent definitions | — |
| `index.js` | Re-exports `{ PermissionManager }` | — |

---

## Dashboard (`src/modules/dashboard/`)

| File | Purpose | Key Exports |
|---|---|---|
| `api/server.js` | Express + WebSocket server startup | `startServer(ctx, port)` |
| `api/websocket.js` | WebSocket broadcast loop | `WebSocketManager` |
| `api/routes/` | REST route handlers (status, commands, nav, inventory, etc.) | route modules |
| `session-auth.js` | Session token validation | `verifySessionToken`, `validateConfig` |
| `public/` | Frontend HTML/JS/CSS | served statically |

---

## Shared Services (`src/shared/services/`)

| File | Purpose | Key Exports |
|---|---|---|
| `navigation/navigation.service.js` (also in modules) | — | — |
| `goal-planner.service.js` | Decomposes mine/craft goals into prerequisite steps | `GoalPlannerService.decompose(op, inv)` |
| `safety.service.js` | `isCritical()`, `shouldRetreat()`, `checkAutoEat()`, hazard scan | `SafetyService` |
| `tool.service.js` | `getBestTool`, `equipBest`, `isWarning`, `isCritical` | `ToolService` |
| `target-finder.service.js` | `findNearestBlock`, `findNearestEntity` | `TargetFinderService` |
| `action-queue.service.js` | Batched action execution | `ActionQueueService` |

---

## Shared Persistence (`src/shared/persistence/`)

| File | Purpose | Key Exports |
|---|---|---|
| `persistence-manager.js` | JSON file I/O, snapshot saves, state load/restore | `persistenceManager` singleton |
| `state-store.js` | MongoDB connect/disconnect wrapper | `StateStore` |
| `models/audit-log.model.js` | Mongoose AuditLog schema | — |
| `models/statistics.model.js` | Mongoose Statistics schema | — |

---

## Shared Config (`src/shared/config/`)

| File | Purpose |
|---|---|
| `priorities.js` | Priority constants: `EMERGENCY=100`, `SECURITY_ALERT=90`, `OWNER_COMMAND=85`, etc. |
| `tick-rates.js` | `COMBAT=50`, `ACTIVE=100`, `IDLE=500`, `DASHBOARD=1000` ms |
| `constants.js` | General constants |
| `safety-thresholds.js` | Health/hunger safety levels |

---

## Tests

| Directory | Contents |
|---|---|
| `test/core/` | TaskManager, action queue |
| `test/modules/commands/` | CommandPlanner, ConfirmationManager, UnifiedCommandGateway |
| `test/modules/combat/` | Combat skill, service, policies, mob tactics |
| `test/modules/building/` | Build skill, schematics, policies |
| `test/modules/forestry/` | ChopTree skill, policies, tree analyzer |
| `test/modules/inventory/` | Craft skill, crafting service, logistics |
| `test/modules/nlp/` | CoordinateParser, QuantityParser, SpellCorrector |
| `test/modules/dashboard/` | Session auth |
| `test/modules/server-auth/` | Server auth |
| `test/modules/behavior/` | Ambient/humanoid services |
| `test/integration/` | auth-network, command-to-task, dashboard-api, inventory, navigation, security, startup |
| `test/invariants/` | final-invariants.test.js (104 assertions across all subsystems) |
| `test/shared/` | Action queue, advanced logging |

**All tests use mocked Mineflayer.** None require a live server. See `06_RUNTIME_BASELINE_AND_TESTS.md` for details.

---

## Documentation Files (`docs/`)

| File | Contents | Trust Level |
|---|---|---|
| `FEATURE_READINESS.md` | Per-feature runtime status table | TEST-CLAIM (many labeled UNIT-TESTED ONLY or MANUAL TEST REQUIRED) |
| `RELEASE_NOTES.md` | 1.0.0 "production release" notes | TEST-CLAIM (conflicts with live report) |
| `ARGUS_COMPLIANCE_MATRIX.md` | 43/43 "FULLY IMPLEMENTED" | TEST-CLAIM (conflicts with live report) |
| `TESTING.md` | 104/104 unit tests | TEST-CLAIM (mock tests only) |
| `ARCHITECTURE.md` | Architecture overview | OBSERVED IN SOURCE (matches code broadly) |
| `API.md` | REST API reference | OBSERVED IN SOURCE |
| `EVENT_BUS.md` | Event catalog | OBSERVED IN SOURCE |
| `TASK_LIFECYCLE.md` | Task state machine | OBSERVED IN SOURCE |
| `SECURITY.md` | Security model | OBSERVED IN SOURCE |
| `ARGUS_SPEC_MAPPING.md` | Spec-to-code mapping | TEST-CLAIM |
| `DASHBOARD_DATA_CONTRACT.md` | Dashboard API contract | OBSERVED IN SOURCE |
| `operations/AGENT_HANDOFF.md` | Previous handoff doc | Reference |
| `operations/BOT_COMMANDS.md` | Command reference | Reference |
