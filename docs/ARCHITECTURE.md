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
   Subsystems do not directly call foreign skills. State changes, damage alerts, completed tasks, and telemetry broadcast through `core/EventBus.js`.
2. **Single-Lock Ownership**:
   All locks (`movement`, `inventory`, `crafting`, `combat`, `vision`) are managed by `core/LockManager.js`. Leaked locks expire after 5 minutes.
3. **Strict Navigation Authority**:
   `services/NavigationService.js` is the sole owner of movement. Skills request trajectories and yields to safety interventions.
4. **Safety Preemption**:
   `SafetyService` continuously checks health and environmental hazards. If health drops below 3 hearts (6 hp) or critical danger is detected, current work yields immediately to `returnHome()`.
