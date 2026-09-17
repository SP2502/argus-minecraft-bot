# Argus System Architecture

Argus is an autonomous, event-driven Minecraft bot designed with layered separation of concerns, preemptive task orchestration, and real-time telemetry streaming.

```
+-------------------------------------------------------------------------+
|                              Command Sources                            |
|       Minecraft Chat      |   Web Dashboard    |     REST API (v1)      |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                         UnifiedCommandGateway                           |
|       - ConversationContextManager (History & Disambiguation)           |
|       - NLP IntentParser & SpellCorrector (100+ Intents, Fuzzy Match)   |
|       - PermissionManager (5-Tier RBAC, Sliding Rate Limiter)           |
|       - ConfirmationManager (Critical Action Two-Phase Commit)          |
|       - CommandPlanner (Parameter Normalization & Task Sequencing)      |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                               TaskManager                               |
|       - Priority-Ranked Task Queue (Survival 100 -> Idle 30)            |
|       - Single Authoritative LockManager (5-Minute Timeout Protection)  |
|       - Preemption Engine (Suspends lower tasks, resumes at checkpoint) |
+-------------------------------------------------------------------------+
                                     |
                 +-------------------+-------------------+
                 |                                       |
                 v                                       v
+---------------------------------+     +---------------------------------+
|            AIBrain              |     |          Domain Skills          |
| - Adaptive Ticks:               |     | - MineSkill (Vein & Corridor)   |
|     Combat: 50ms (20 TPS)       |     | - FarmSkill (16-Seed Reserve)   |
|     Active: 100ms (10 TPS)      |     | - BuildSkill (50-Blk Checkpoint)|
|     Idle:   500ms (2 TPS)       |     | - ChopTreeSkill (Tree Family)   |
|     Dash:   1000ms (1 TPS)      |     | - CombatSkill (Shield & Tactics)|
| - Subsystem Heartbeat Watchdog  |     | - LogisticsSkill (Warehouse)    |
| - Ambient Homestead Behaviors   |     | - CraftSkill (Dependency Graph) |
+---------------------------------+     +---------------------------------+
                 |                                       |
                 +-------------------+-------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                            Shared Services                              |
|   NavigationService   |  InventoryService   |   SafetyService           |
|   ToolService         |  LogisticsService   |   CraftingService         |
|   TargetFinderService |  CombatHelperService|   LocationRegistry        |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                        Mineflayer Bot & World                           |
|   Physics Engine, Chunk Cache, Entity Tracking, Inventory Window Slots  |
+-------------------------------------------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                                EventBus                                 |
|   Central Pub/Sub Decoupling All Modules and Telemetry Subscribers      |
+-------------------------------------------------------------------------+
                                     |
           +-------------------------+-------------------------+
           |                                                   |
           v                                                   v
+-----------------------+                           +---------------------+
|      Telemetry        |                           |     Persistence     |
| - WebSocket Streamer  |                           | - 5-Minute Snapshot |
| - Express REST Server |                           | - SHA-256 Checksums |
| - WebGL 3D Dashboard  |                           | - Last-Known-Good   |
| - 7-Level Async Logger|                           | - StateStore Mongo  |
+-----------------------+                           +---------------------+
```

## Core Architectural Guarantees

1. **Decoupled Event Bus Topology**:
   Subsystems do not directly call foreign skills. State changes, damage alerts, completed tasks, and telemetry broadcast through `src/core/EventBus.js`.
2. **Single-Lock Ownership**:
   All locks (`movement`, `inventory`, `crafting`, `combat`, `vision`) are managed by `src/core/LockManager.js`. Leaked locks expire after 5 minutes.
3. **Strict Navigation Authority**:
   `src/modules/navigation/navigation.service.js` is the sole owner of movement. Skills request trajectories and yield to safety interventions.
4. **Safety Preemption**:
   `src/shared/services/safety.service.js` continuously checks health and environmental hazards. If health drops below 3 hearts (6 hp) or critical danger is detected, current work yields immediately to emergency retreat.

## Hybrid Feature-Based Architecture Layout

The codebase is organized into three clear structural tiers under `src/`:

```text
src/
├── core/                       # Global runtime and orchestrator infrastructure
│   ├── AIBrain.js              # Adaptive tick engine & subsystem heartbeat watchdog
│   ├── AuthManager.js          # Player authentication & owner privileges
│   ├── BotContext.js           # Shared runtime dependency injection container
│   ├── EventBus.js             # Decoupled pub/sub event broadcaster
│   ├── LockManager.js          # Mutex manager with 5-minute timeout protection
│   ├── SkillRegistry.js        # Dynamic skill loader & lifecycle registry
│   ├── TaskManager.js          # Priority-preemptive task scheduler & queue
│   ├── base.skill.js           # Abstract BaseSkill class with safetyCheckLoop
│   └── skill.template.js       # Reference template for domain skills
├── modules/                    # Self-contained domain feature modules (colocated data, policies, intents, skills)
│   ├── behavior/               # Ambient presence, interaction smoothing, humanoid behaviors
│   ├── building/               # Procedural schematics, wall/shelter construction, 50-block checkpoints
│   ├── combat/                 # Target scoring, kiting, shield blocking, mob tactics
│   ├── commands/               # Gateway, planning, schemas, confirmation, adapters
│   ├── dashboard/              # Express REST API, WebSocket streaming, session auth, UI
│   ├── farming/                # Crop harvesting, replanting, 16-seed reserve policy
│   ├── forestry/               # Tree family detection, bounded BFS log felling, replanting
│   ├── inventory/              # Hotbar slot-6 water layout, item valuation, crafting graphs
│   ├── logistics/              # Container indexing, spatial warehouse search, kit restock
│   ├── mining/                 # Deep branch mining, ore priorities, slot-6 water guard
│   ├── navigation/             # Pathfinding wrappers, location repository, hazard costs
│   ├── nlp/                    # Tokenizer, parsers, typo correction, intent registry
│   ├── security/               # 5-tier RBAC, rate limits, 3-strike brute-force lockout
│   └── server-auth/            # Offline database passwords, server reset auto-re-register
└── shared/                     # Cross-cutting support services and utilities
    ├── communication/          # Message router and webhook dispatcher
    ├── config/                 # Global priorities, constants, tick rates, safety thresholds
    ├── observability/          # 7-level structured logger, audit & statistics models
    ├── persistence/            # Persistence manager, state store, checksum backups
    └── services/               # Action queue, pathfinding geometry, safety sensor, tool evaluator
```

### Public API Contract Principle

Every domain module under `src/modules/` provides an intentional public `index.js` file exposing its supported external surface. Subsystems interacting across module boundaries import from module roots (e.g. `require('../../modules/combat')`), avoiding fragile deep imports into internal implementation details.

### One-Way Dependency Direction

To maintain high architectural cohesion and prevent cyclic dependencies, Argus enforces a strictly unidirectional flow:

```text
UI / Minecraft Chat / REST / Dashboard
                 │
                 ▼
         Command Gateway
                 │
                 ▼
          Security / RBAC
                 │
                 ▼
           TaskManager
                 │
                 ▼
          Domain Skills
                 │
                 ▼
         Domain Services
                 │
                 ▼
Mineflayer / Database / Filesystem
```

- Adapters never execute skills directly; all requests pass through the Command Gateway.
- Services never invoke skills or command gateways.
- Core coordinates module registration and execution without coupling to specific domain implementations.

### Behavior Subsystem Philosophy

Argus implements server-policy-compliant automation and interaction smoothing:
- Natural movement interpolation avoiding abrupt yaw/pitch snapping.
- Idle presence behavior (sleeping in claimed beds, hunger monitoring).
- Interaction smoothing during tactical evasion and navigation.

### Quality Criteria & Verification Commands

1. **Automated Test Suite**:
   ```bash
   npm test
   ```
   Requires 104 passing tests across 34 suites, 0 failures, 0 skipped.

2. **Circular Dependency Verification**:
   ```bash
   npx madge --circular --extensions js src
   node scripts/check-cycles.js .
   ```
   Requires 0 circular dependencies.

3. **Release Artifact Invariant**:
   Generated release bundles (such as `ARGUS_FINAL_RELEASE_1.0.0_2026-09-05.zip`) and baseline checksum manifests (`SHA256SUMS`) are historical release snapshots and are not manually edited or regenerated during routine source refactor operations.
