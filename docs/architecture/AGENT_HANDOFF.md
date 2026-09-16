# Argus Autonomous Minecraft Bot — AI Agent Handoff Document

Welcome, AI Engineer / Autonomous Coding Agent. This document provides the complete, authoritative operational and architectural context required to maintain, extend, and deploy Argus without any prior conversation history.

---

## 1. Project Purpose & Current Release State

- **Current Version**: `1.0.0` (Production Free Open-Source Release, MIT License)
- **Primary Objective**: Autonomous, long-term survival, resource harvesting, building construction, agricultural automation, warehouse management, and tactical defense in vanilla-compatible Minecraft worlds (Java Edition 1.19.4+).
- **Control Modalities**:
  1. In-game Minecraft chat messages (via `MinecraftChatAdapter`)
  2. Web-based 3D WebGL Dashboard (via `DashboardCommandAdapter` + WebSockets)
  3. Authenticated RESTful HTTP API (via `RestCommandAdapter`)
- **Testing Verification**: 60/60 suites passing (100% pass rate) using native `node:test`.

---

## 2. Core Architecture & Layered Hierarchy

Argus strictly adheres to a unidirectional layered pipeline:

```
[In-Game Chat / Web Dashboard / REST API]
                   │
                   ▼
       UnifiedCommandGateway
   (ConversationContext -> NLP IntentParser -> PermissionManager -> CommandPlanner)
                   │
                   ▼
              TaskManager
   (Priority Queue: Survival 100 -> Idle 30 | Single Authoritative LockManager)
                   │
                   ▼
         Domain Skill Instance
   (MineSkill / FarmSkill / BuildSkill / CombatSkill / ChopTreeSkill / LogisticsSkill)
                   │
                   ▼
            Shared Services
   (NavigationService / InventoryService / ToolService / SafetyService / CraftingService)
                   │
                   ▼
             Mineflayer Bot
                   │
                   ▼
                EventBus ──► [WebSocket Telemetry, 7-Level Logger, State Snapshots]
```

---

## 3. Critical Invariants (DO NOT VIOLATE)

1. **Owner Immutability**:
   - `ShadowPace` (default, or `process.env.OWNER_USERNAME`) is the permanent Tier-4 Owner.
   - The owner can never be demoted, blocked, or lose privileges at runtime.
2. **Centralized Authorization**:
   - Every user-facing action MUST pass through `UnifiedCommandGateway`. Never call `skill.run()` or service methods directly from network endpoints.
3. **Single Authoritative LockManager**:
   - There is only ONE lock manager (`core/LockManager.js`). Never instantiate secondary locking loops in skills. Locks auto-release after 5 minutes to prevent deadlocks.
4. **Authoritative Movement Authority**:
   - `NavigationService` is the sole owner of bot movement. Skills request movement through `ctx.nav.goTo(...)` and must never compete with pathfinding.
5. **Mining Safety & Water Bucket Guard**:
   - Prior to hazardous deep mining (`yLevel < 0` or below sea level), hotbar slot 6 (slot 42 in prismarine window) MUST contain a water bucket. If slot 6 cannot be guaranteed, mining must abort.
   - Never intentionally dig straight down (below feet) or straight up (above head).
   - Place a torch every 8 blocks; save an escape waypoint every 64 blocks below Y=-40.
6. **Farming 16-Seed Reservation**:
   - The bot MUST retain at least 16 seeds (`wheat_seeds`, `carrot`, `potato`, `beetroot_seeds`) in inventory at all times. Deposits to chests or item discards must never violate this threshold.
7. **Building Checkpoints**:
   - A `building.checkpoint` event MUST be emitted every 50 blocks during structural assembly.
8. **Health Safety & Emergency Retreat**:
   - If health drops below 6 points (< 3 hearts), `SafetyService.isCritical()` and `shouldRetreat()` trigger an emergency retreat to the nearest safe zone or primary base.
9. **Tool Durability Safeguards**:
   - Durability <= 20% triggers a warning event.
   - Durability <= 5% triggers tool switching or skill retreat before tool destruction.
10. **Adaptive Tick Frequencies**:
   - Combat Mode: 50ms (20 TPS)
   - Active Task: 100ms (10 TPS)
   - Idle Mode: 500ms (2 TPS)
   - Dashboard Mode: 1000ms (1 TPS)
11. **Persistence & Graceful Shutdown**:
   - Full state snapshots saved every 5 minutes and on SIGINT/SIGTERM with SHA-256 checksum verification and `.bak` last-known-good recovery.

---

## 4. Complete Repository File Map

### Core Architecture (`core/`)
- `core/AIBrain.js`: Autonomous cognitive loop, adaptive tick rate scheduler, subsystem heartbeat monitor.
- `core/AuthManager.js`: Mineflayer connection configurator (Offline, Mojang, Microsoft credentials).
- `core/BotContext.js`: Central dependency container injecting shared services into skills and gateways.
- `core/EventBus.js`: Asynchronous pub/sub event dispatcher decoupling modules.
- `core/LockManager.js`: Single authoritative resource lock coordinator preventing race conditions.
- `core/Logger.js`: 7-level structured logging engine (Critical, Error, Warn, Info, Success, Debug, Trace).
- `core/PersistenceManager.js`: Atomic file persistence with SHA-256 checksums and `.bak` corruption recovery.
- `core/SkillRegistry.js`: Dynamic registration and instantiation factory for domain skills.
- `core/StateStore.js`: Persistent database connector (MongoDB with fallback to local JSON snapshots).
- `core/TaskManager.js`: Priority-preemptive task scheduler supporting checkpoints and rollback.

### Domain Skills (`skills/`)
- `skills/BaseSkill.js`: Abstract base skill class providing abort signals and safety check loops.
- `skills/SkillTemplate.js`: Boilerplate template for authoring new domain skills.
- `skills/mining/MineSkill.js`: Autonomous ore prospecting, corridor mining, water bucket slot-6 guard.
- `skills/farming/FarmSkill.js`: Autonomous cultivation, harvesting, bone meal, and 16-seed reserve.
- `skills/building/BuildSkill.js`: Layer-by-layer architectural construction with 50-block checkpoints.
- `skills/woodcutting/ChopTreeSkill.js`: Bounded BFS log cluster harvesting and sapling replanting.
- `skills/combat/CombatSkill.js`: Tactical mob defense, creeper kiting, shield blocking, ally protection.
- `skills/logistics/LogisticsSkill.js`: Warehouse container categorization, kit restocking, inventory sorting.
- `skills/crafting/CraftSkill.js`: Workstation crafting and furnace smelting dependency execution.

### Shared Services (`services/`)
- `services/ActionQueueService.js`: Priority-sorted bot action dispatching with cancellation tokens.
- `services/AmbientBehaviorService.js`: Day/night bed sleeping, auto-eat hunger recovery, idle chores.
- `services/ChestInteract.js`: Container interaction primitives (open, deposit, withdraw, close).
- `services/CombatHelperService.js`: Threat scoring formula, weapon rating, shield equipping, whitelist filter.
- `services/CraftingService.js`: Recursive prerequisite recipe dependency graph solver.
- `services/InventoryService.js`: 36-slot inventory manager, fixed hotbar layout, 16-seed deposit reservation.
- `services/ItemValue.js`: Relative item valuation scores for selective discard and preservation.
- `services/LocationRegistry.js`: Spatial coordinate database for bases, farms, mines, and waypoints.
- `services/LogisticsService.js`: Container scanning, spatial warehouse indexing, kit profiles.
- `services/NavigationService.js`: Sole authoritative pathfinding executor wrapping `mineflayer-pathfinder`.
- `services/PathfindingUtil.js`: Geometry math, euclidean distances, bounding box calculations.
- `services/SafetyService.js`: Critical danger detector (<3 hearts, lava proximity, consecutive hits).
- `services/TargetFinderService.js`: Spatial entity and block search sensor using spherical bounding filters.
- `services/ToolService.js`: Equipment evaluator, enchantments parser, durability threshold alerts.

### Natural Language Processing (`nlp/`)
- `nlp/CommandTokenizer.js`: Tokenizer splitting natural language input into typed token streams.
- `nlp/CoordinateParser.js`: Coordinate extractor supporting absolute, 2D, and relative syntax (`~ ~ ~`).
- `nlp/EntityExtractor.js`: Entity resolution for items, quantities, locations, and usernames.
- `nlp/IntentParser.js`: Multi-intent matcher leveraging exact and fuzzy keyword matching.
- `nlp/IntentRegistry.js`: Registry loading structured JSON intent definitions.
- `nlp/QuantityParser.js`: Numeric and written number converter ("half a stack" -> 32).
- `nlp/SpellCorrector.js`: Levenshtein distance typo detection and static domain vocabulary corrector.
- `nlp/SynonymRegistry.js`: Alias and synonym normalizer for ores, trees, mobs, and tools.
- `nlp/TimeExpressionParser.js`: Temporal expression parser ("for 10 minutes", "at night").

### Gateway & Command Routing (`commands/`)
- `commands/CommandPlanner.js`: Translates parsed NLP intents into structured, sequential task plans.
- `commands/CommandResponse.js`: Standardized command execution result envelope.
- `commands/CommandSchemas.js`: Declarative schema registry defining required roles, locks, and parameter types.
- `commands/ConfirmationManager.js`: Sender-bound two-phase commit manager for destructive actions.
- `commands/ConversationContextManager.js`: Multi-turn conversational memory and disambiguation engine.
- `commands/UnifiedCommandGateway.js`: Central authorization and execution gateway for all command sources.
- `commands/adapters/MinecraftChatAdapter.js`: In-game Minecraft chat listener and responder.
- `commands/adapters/DashboardCommandAdapter.js`: Web dashboard command bridge.
- `commands/adapters/RestCommandAdapter.js`: HTTP REST command endpoint adapter.

### Security (`security/`)
- `security/PermissionManager.js`: 5-tier RBAC, sliding window rate limiter, 3-strike brute-force lockout.

### Configuration (`config/`)
- `config/constants.js`: System enums (roles, tiers, log levels, combat modes).
- `config/ambientConfig.js`: Ambient sleep intervals, hunger thresholds, bed block tags.
- `config/buildingConfig.js`: Placement cooldowns, maximum block limits, default building materials.
- `config/combatConfig.js`: Engagement distances, retreat thresholds, attack cooldowns.
- `config/commandPolicies.js`: Command authorization levels and parameter validations.
- `config/craftingConfig.js`: Smelting fuels, recipe configurations.
- `config/dangerousCommands.js`: Operations requiring explicit confirmation before execution.
- `config/forestryConfig.js`: Tree felling radius, minimum leaf counts, replant rules.
- `config/greetings.js`: Social chat greetings and responses.
- `config/itemCategories.js`: Canonical item categorization for warehouse chest indexing.
- `config/logisticsConfig.js`: Kit loadout profiles (`miner`, `warrior`, `woodcutter`, `farmer`).
- `config/movementCosts.js`: Pathfinder hazard weighting penalties (water, lava, fire).
- `config/nlpThresholds.js`: Confidence cutoffs for fuzzy NLP matching.
- `config/priorities.js`: Canonical task priority tiers (Survival 100 -> Idle 30).
- `config/safetyThresholds.js`: Critical health (6 hp / 3 hearts), starvation, lava scan radius.
- `config/tickRates.js`: Adaptive tick intervals in milliseconds (50ms, 100ms, 500ms, 1000ms).
- `config/toolTiers.js`: Material tier rankings and enchantment score multipliers.

---

## 5. Verification Commands

```bash
# Set Node environment
export PATH="/Users/anitaverma/.local/nodejs/bin:$PATH"

# Run complete test suite (60/60 tests)
npm test

# Run individual invariant regression test suite
node --test test/final-invariants.test.js
```

---

## 6. Phase 13+ Strategic Roadmap

Future autonomous development phases to be tackled by incoming AI agents:

### Phase 13: Villager Trading & Emerald Economy
- **Objective**: Automate villager workstation assignment, emerald accumulation, enchanted book trading.
- **Components**: `skills/trading/VillagerTradeSkill.js`, `services/VillagerRegistry.js`.
- **Extension Point**: Register `trade` command schema in `commands/CommandSchemas.js`.

### Phase 14: Nether Traversal & Hazard Navigation
- **Objective**: Autonomous portal construction, safe netherrack bridging, strider navigation, piglin bartering.
- **Components**: `skills/nether/NetherPortalSkill.js`, `config/movementCosts.js` (Nether dimension overrides).
- **Hazard Guards**: Lava lake detection, ceiling ghast deflection with shields.

### Phase 15: The End & Dragon Flight
- **Objective**: Stronghold discovery via Eye of Ender triangulation, End portal activation, Shulker box farming.
- **Components**: `skills/end/StrongholdNavSkill.js`, `skills/end/EnderDragonSkill.js`.

### Phase 16+: Multi-Bot Swarm Coordination
- **Objective**: Peer-to-peer task distribution over Redis/WebSocket cluster; parallel branch mining and mega-structure building.
- **Components**: `core/SwarmCoordinator.js`, `services/DistributedLockManager.js`.
