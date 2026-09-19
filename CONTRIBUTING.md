# Contributing to Argus

Thank you for your interest in contributing to Argus, the autonomous open-source Minecraft bot!

## Development Setup

- **Node.js**: `v20.x` or later (LTS recommended)
- **npm**: `v10.x` or later
- **Minecraft Server**: Java Edition 1.19.4+ (or compatible vanilla/Paper server)
- **MongoDB**: Optional (MongoDB 6+ for container indexing; falls back automatically to local persistent JSON state)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/argus-bot/argus.git
cd argus

# Install dependencies
npm install

# Run the test suite
npm test

# Copy environment variables
cp .env.example .env

# Start the bot
npm start
```

## Architectural Rules (Strict Invariants)

Argus follows a strict layered, event-driven architecture designed to prevent race conditions, safety hazards, and subsystem conflicts. Every contributor must abide by these rules:

1. **Never bypass the Gateway/RBAC**:
   All user, chat, API, and dashboard commands must pass through `UnifiedCommandGateway` -> `PermissionManager` -> `CommandPlanner` -> `TaskManager`. No external source may invoke skills or services directly.
2. **Never create a second LockManager**:
   There is exactly ONE central, authoritative `LockManager` in `core/LockManager.js`. Every skill and task acquires its resource locks (`movement`, `inventory`, `crafting`, etc.) through `TaskManager`. Do not invent secondary locking systems.
3. **Never create competing navigation ownership**:
   `NavigationService` (backed by `mineflayer-pathfinder`) is the sole owner of bot movement. Skills request movement through `ctx.nav.goTo(...)` and must never directly control bot velocities or create competing pathfinding loops.
4. **Never violate the slot-6 mining invariant**:
   Before hazardous mining begins, hotbar slot 6 (slot 42 in prismarine window) MUST contain a water bucket. If this cannot be guaranteed, mining must abort immediately. Never dig straight down below feet or straight up above head.
5. **Never violate the 16-seed farming invariant**:
   The bot must preserve at least 16 seeds in inventory for replanting. When depositing items to chests or dropping low-value items, seeds must never be depleted below 16.
6. **Durability Protection**:
   Tools reaching 20% durability emit warnings; tools at <= 5% durability trigger critical tool switches or task retreat before item destruction occurs.
7. **Emergency Retreat (<3 Hearts)**:
   When health drops below 6 points (< 3 hearts), `SafetyService.isCritical()` and `shouldRetreat()` trigger an emergency return home.

## Code Organization

- `core/`: Central coordination (`AIBrain`, `TaskManager`, `LockManager`, `EventBus`, `PersistenceManager`, `BotContext`, `AuthManager`).
- `services/`: Reusable, stateless domain helpers (`NavigationService`, `InventoryService`, `ToolService`, `SafetyService`, `LogisticsService`, `CraftingService`, `CombatHelperService`).
- `skills/`: Goal-oriented autonomous routines (`MineSkill`, `FarmSkill`, `BuildSkill`, `ChopTreeSkill`, `CombatSkill`, `LogisticsSkill`, `CraftSkill`).
- `commands/`: Gateway, adapters (`MinecraftChatAdapter`, `DashboardCommandAdapter`, `RestCommandAdapter`), command schemas, planning.
- `security/`: 5-tier role-based access control, sliding rate limiter, failed-auth auto-block.
- `nlp/`: Intent parsing, tokenization, spell correction, entity extraction.
- `api/`: Express REST endpoints, WebSocket live telemetry streaming, static web dashboard.

## Pull Request Guidelines

- Ensure `npm test` passes completely with zero failures.
- Add regression tests for any new features or bug fixes in `test/`.
- Ensure clean code formatting and no hardcoded personal credentials or secrets.
- Update documentation in `docs/` and `README.md` if public APIs or command schemas change.
