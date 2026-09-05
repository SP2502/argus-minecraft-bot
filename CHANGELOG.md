# Changelog

All notable changes to the Argus autonomous Minecraft bot project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-05 (Production Free Open-Source Release)

### Added
- **Unified Command Gateway**: Unified ingress supporting in-game chat, authenticated REST API, and WebSocket WebGL dashboard commands.
- **5-Tier Role-Based Access Control**: Centralized `PermissionManager` with `ShadowPace` anchored as permanent immutable Tier-4 Owner, sliding window rate limiting (10 cmds/min), and 3-strike brute-force lockout.
- **Preemptive Task Scheduling**: `TaskManager` with composite priority formula, preemption engine, suspended task checkpoints, and rollback.
- **Single-Lock Resource Coordinator**: Central `LockManager` governing `movement`, `inventory`, `crafting`, `combat`, and `vision` locks with 5-minute timeout guards.
- **Adaptive Cognitive Tick Scheduler**: Dynamic tick loop in `AIBrain` adjusting between Combat (50ms), Active Tasks (100ms), Idle (500ms), and Dashboard Only (1000ms).
- **Core Safety Invariants**:
  - Slot-6 hotbar water bucket verified prior to hazardous deep mining.
  - 16-seed reservation preserved on all agricultural chest deposits and discards.
  - 50-block checkpoint emissions during structural assembly.
  - Automatic emergency retreat triggered whenever health falls below 3 hearts (6 hp).
  - Prohibited intentional straight-down and straight-up mining.
  - Torch placement every 8 blocks and deep-mining escape waypoints below Y=-40.
  - Durability warning alerts at 20% and critical tool switches/retreat at 5%.
  - Unconditional combat protection for all players, villagers, iron golems, and tamed pets.
- **Autonomous Ambient Behaviors**: Homestead bed sleeping during night/thunderstorms, auto-eat hunger recovery, and idle warehouse sorting.
- **Persistence & Crash Recovery**: Atomic JSON writes with SHA-256 checksums, `.bak` backup state restoration, 5-minute snapshot cycle, and graceful shutdown signal handling (`SIGINT`/`SIGTERM`).
- **WebGL 3D Dashboard**: Browser-based spatial voxel viewer, live health/hunger vitals, activity timelines, and interactive command console.
- **Exhaustive Native Test Suite**: 60 test suites and subtests passing with 100% success rate using `node:test`.

### Fixed
- Enforced permanent owner immutability preventing runtime role demotions.
- Fixed `MineSkill` to verify hotbar slot 6 water bucket before hazardous mining.
- Fixed `BuildSkill` to emit `building.checkpoint` every 50 blocks placed.
- Resolved crash recovery fallback in `PersistenceManager` using SHA-256 verification.
- Corrected shutdown handler in `index.js` to persist state snapshots and flush logs before exit.

### Security
- Verified zero hardcoded credentials, API keys, tokens, or personal paths.
- Added MIT License and comprehensive open-source contributor documentation.
