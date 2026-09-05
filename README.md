# Argus — Autonomous Event-Driven Minecraft Bot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Minecraft](https://img.shields.io/badge/Minecraft-1.19.4%2B-blue.svg)](https://minecraft.net/)
[![Tests](https://img.shields.io/badge/Tests-60%2F60%20Passing-brightgreen.svg)]()

Argus is a production-grade, event-driven autonomous Minecraft bot built on Node.js and Mineflayer. Engineered for long-term survival, base logistics, agricultural self-sustainment, tactical combat, procedural construction, and deep branch-mining, Argus operates reliably through in-game chat, an authenticated REST API, and a real-time WebGL 3D dashboard.

---

## Architecture Overview

```
+-------------------------------------------------------------------------+
|                              Command Sources                            |
|       Minecraft Chat      |   Web Dashboard    |     REST API (v1)      |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                         UnifiedCommandGateway                           |
|  - 5-Tier RBAC (Owner 4, Admin 3, Trusted 2, Guest 1, Blocked 0)        |
|  - 100+ NLP Intent Recognition & Levenshtein Spell Correction           |
|  - Multi-Turn Disambiguation & 2-Phase Critical Action Confirmation     |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                               TaskManager                               |
|  - Priority Queue (Survival 100 -> Idle 30) with Preemptive Execution   |
|  - Authoritative LockManager (5-Minute Timeout & Deadlock Prevention)   |
+-------------------------------------------------------------------------+
                                     │
                 +───────────────────┴───────────────────+
                 ▼                                       ▼
+---------------------------------+     +---------------------------------+
|            AIBrain              |     |          Domain Skills          |
|  - Adaptive Tick Scheduler:     |     |  - MineSkill (Corridors & Veins)|
|      Combat: 50ms (20 TPS)      |     |  - FarmSkill (16-Seed Reserve)  |
|      Active: 100ms (10 TPS)     |     |  - BuildSkill (50-Blk Checkpt)  |
|      Idle:   500ms (2 TPS)      |     |  - ChopTreeSkill (Replanting)   |
|      Dash:   1000ms (1 TPS)     |     |  - CombatSkill (Tactical Kiting)|
|  - Subsystem Heartbeat Watchdog |     |  - LogisticsSkill (Warehouse)   |
|  - Ambient Bed & Eat Routines   |     |  - CraftSkill (Auto-Crafting)   |
+---------------------------------+     +---------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                     Shared Services & Mineflayer                        |
|  NavigationService (Sole Pathing Authority) | SafetyService (<3 Hearts) |
|  InventoryService (Fixed Hotbar Layout)     | ToolService (Durability)  |
+-------------------------------------------------------------------------+
                                     │
                                     ▼
+-------------------------------------------------------------------------+
|                     EventBus & Telemetry Hub                            |
|  WebSocket Live Stream | WebGL 3D Dashboard | 5-Minute Checksum Snapshots|
+-------------------------------------------------------------------------+
```

---

## Canonical Feature Compendium (Parts 0–11)

- **Part 0: Infrastructure & API Server**: Express RESTful endpoints, WebSocket live streaming, 7-level structured logger, 5-minute SHA-256 state snapshots with last-known-good corruption recovery, and graceful shutdown on `SIGINT`/`SIGTERM`.
- **Part 1: Central AI Brain**: Adaptive tick scheduler (50ms combat, 100ms active task, 500ms idle, 1000ms dashboard), 50ms priority formula evaluation, subsystem heartbeats, and autonomous ambient homestead routines (sleeping at night, auto-eating).
- **Part 2: Security & 5-Tier RBAC**: `ShadowPace` anchored as permanent immutable Tier-4 Owner; granular permissions (Admin, Trusted, Guest, Blocked); sliding rate limit (10 cmds/min); 3-strike brute force lockout (10m block).
- **Part 3: Communication & Event Bus**: Decoupled pub/sub event bus, priority message routing, and optional outbound webhook dispatcher.
- **Part 4: Natural Language Processing**: 100+ NLP intents, clause tokenization, Levenshtein distance typo auto-correction, coordinate parsing (3D, 2D, relative), and interactive disambiguation.
- **Part 5: Navigation & Spatial Awareness**: Authoritative pathfinding wrapper around `mineflayer-pathfinder`, dynamic terrain hazard avoidance (lava, fire, void), and emergency retreat on low health.
- **Part 6: Mining**: Deep branch-mining, ore priority ranks, vein BFS scanning, mandatory slot-6 hotbar water bucket guard, straight down/up digging prohibition, torches placed every 8 blocks, and deep escape waypoints every 64 blocks below Y=-40.
- **Part 7: Farming**: Autonomous crop harvesting, immediate replanting, bone meal acceleration, and strict preservation of at least 16 seeds during storage deposit.
- **Part 8: Building**: Procedural schematics (walls, floors, shelters, stairs), layer-by-layer placement order, temporary scaffolding assembly/cleanup, and checkpoint emissions every 50 blocks.
- **Part 9: Combat & Tactical Defense**: Threat scoring, weapon rating, shield blocking against skeletons, kiting creepers, low-health retreat, and guaranteed friendly protection for all players, villagers, golems, and tamed pets.
- **Part 10: Inventory & Warehouse Logistics**: Fixed hotbar layout (0=Weapon, 1-3=Tools, 6=Water, 8=Food, Off=Shield/Totem), durability warnings at 20% and critical action at 5%, container spatial indexing, and kit restocking (`miner`, `warrior`, `woodcutter`, `farmer`).
- **Part 11: Task Manager & Integration**: Priority queue preemption, single authoritative `LockManager` with 5-minute timeout protection, suspended task checkpoints, and rollback.

---

## Prerequisites

- **Node.js**: `v20.x` or later (LTS recommended)
- **Minecraft Server**: Java Edition 1.19.4+ (Vanilla, Paper, Spigot, Fabric)
- **MongoDB**: Optional (For persistent container indexing; falls back automatically to local atomic JSON state)

---

## Installation & Setup

```bash
# Clone repository
git clone https://github.com/argus-bot/argus.git
cd argus

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run test suite
npm test

# Launch Argus
npm start
```

---

## Configuration (`.env`)

```env
OWNER_USERNAME=ShadowPace
MC_HOST=localhost
MC_PORT=25565
MC_VERSION=1.19.4
API_PORT=3000
MONGODB_URI=mongodb://localhost:27017/argus
DASHBOARD_PASSWORD=admin
DASHBOARD_SESSION_SECRET=your_secure_secret_key_here
```

---

## Web Dashboard & Telemetry

Open `http://localhost:3000` in your web browser:
- **WebGL 3D Map**: Real-time visualization of bot coordinates and surrounding voxel terrain.
- **Live Vitals**: Health, hunger, active tick rate, and current task progress.
- **Interactive Command Panel**: Send authenticated commands directly into the `UnifiedCommandGateway`.
- **Log Streamer**: Filter logs by severity and subsystem category in real time.

---

## Docker Deployment

```bash
# Build the production image
docker build -t argus-bot:1.0.0 .

# Run with persistent volume
docker run -d \
  --name argus \
  -p 3000:3000 \
  -e MC_HOST="your.server.ip" \
  -e OWNER_USERNAME="ShadowPace" \
  -v argus_data:/data \
  argus-bot:1.0.0
```

---

## Render.com Deployment

Argus includes a native `render.yaml` configuration:
1. Connect repository to Render.
2. Select Web Service deployment.
3. Attach a Persistent Disk mounted to `/data`.
4. Define environment variables in the Render dashboard.

---

## Limitations

- **Java Edition Only**: Bedrock Edition is not supported.
- **Prismarine Physics**: Fast Elytra flight and complex Redstone machine interaction are not modeled.
- **Single-World Scope**: Dimension changes (Nether/End) are scheduled for Phases 14–15.

---

## Contributing & License

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening pull requests.

Argus is free and open-source software released under the [MIT License](LICENSE).
