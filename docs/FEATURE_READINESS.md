# Argus Autonomous Agent — Feature Readiness Matrix

This document provides the runtime verification status for all Argus subsystems, command routing paths, and domain services. Status assignments reflect end-to-end runtime verification; presence in the filesystem or isolated unit testing alone does not warrant a `READY` status.

---

## Complete Feature Execution Chain

Every autonomous command flows through the following pipeline:
```text
command input (Minecraft Chat / REST / Dashboard WebSocket)
→ adapter (MinecraftChatAdapter / RestCommandAdapter / DashboardCommandAdapter)
→ UnifiedCommandGateway (single gateway entry point)
→ authentication & RBAC (PermissionManager: 5 tiers, rate limits, lockouts)
→ NLP parser (CommandTokenizer, SpellCorrector, IntentParser, EntityExtractor)
→ intent & entities
→ CommandPlanner (parameter formulation, multi-step dependency graphs, ambiguity detection)
→ TaskManager (priority-based scheduling, resource lock acquisition)
→ SkillRegistry (dynamic loading & instantiation)
→ skill (domain lifecycle execution)
→ domain service (reusable business & Mineflayer service logic)
→ Mineflayer / world operation (pathfinding, digging, placing, inventory transactions)
→ EventBus (telemetry & state notifications)
→ message / log / dashboard output (WebSocket broadcasts, REST responses, chat replies)
```

---

## Feature Readiness Table

Allowed Status Values:
- `READY`: End-to-end verified at runtime with real execution path.
- `PARTIALLY WIRED`: Components connected but some handlers or adapters incomplete.
- `UNIT-TESTED ONLY`: Unit and mock integration tests pass; live physical Minecraft server needed for live world verification.
- `MANUAL TEST REQUIRED`: Domain logic and safety guards pass integration checks; requires controlled in-game environment for final physical validation.
- `BLOCKED`: Blocked on dependency or critical defect.
- `NOT VERIFIED`: Has not yet been verified at runtime.

| Feature | Intent loaded | Gateway path | Planner path | Skill registered | Service wired | Live operation | Safety verified | Dashboard output | Status |
|---|---|---|---|---|---|---|---|---|---|
| **Navigation** | YES (`go_to`, `go_home`, `follow`, `stop_following`) | YES (`execute`) | YES (`plan`) | YES (`NavigationSkill`) | YES (`NavigationService`, `LocationRegistry`) | Mineflayer Pathfinder | YES (Stuck detection, hazard scan, retreat preemption) | YES (`/api/nav-status`, minimap, vitals) | `UNIT-TESTED ONLY` |
| **Inventory** | YES (`show_inventory`, `sort_inventory`, `store_item`, `retrieve_item`, `drop_item`, `drop_all`) | YES (`execute`) | YES (`plan`) | YES (`InventoryService`, `CraftSkill`) | YES (`InventoryService`) | Mineflayer Window / Toss | YES (Water bucket slot-6, 16-seed reserve, tool protection, drop confirmation) | YES (`/api/inv-status`, 36-slot matrix WS) | `UNIT-TESTED ONLY` |
| **Crafting** | YES (`craft`, `smelt`) | YES (`execute`) | YES (`plan`) | YES (`CraftSkill`) | YES (`CraftingService`) | Mineflayer Recipes / Windows | YES (Window cleanup on error, recipe resolution) | YES (EventBus `crafting:*`, log entries) | `UNIT-TESTED ONLY` |
| **Combat** | YES (`combat`, `guard`, `patrol`) | YES (`execute`) | YES (`plan`) | YES (`CombatSkill`) | YES (`CombatService`, `MobTactics`) | Mineflayer Attack / Movement | YES (Ally protection, <6 HP emergency retreat, <10 HP retreat, retaliator) | YES (`/api/safety-status`, VitalsPanel, log entries) | `MANUAL TEST REQUIRED` |
| **Mining** | YES (`mine`) | YES (`execute`) | YES (`plan`) | YES (`MineSkill`) | YES (`ToolService`, `NavigationService`, `SafetyService`) | Mineflayer Dig / Vein Traversal | YES (Slot-6 water bucket guard, 20%/5% durability guard, lava detection) | YES (StatsPanel mining counts, EventBus `mining:*`) | `MANUAL TEST REQUIRED` |
| **Building** | YES (`build`) | YES (`execute`) | YES (`plan`) | YES (`BuildSkill`) | YES (`NavigationService`, `ToolService`, `SafetyService`) | Mineflayer Place / Collision | YES (Bill of materials, reach checks, 50-block checkpoints) | YES (EventBus `building:checkpoint`, log entries) | `MANUAL TEST REQUIRED` |
| **Logistics** | YES (`sort_warehouse`, `restock`, `index_chests`, `find_item`) | YES (`execute`) | YES (`plan`) | YES (`LogisticsSkill`) | YES (`LogisticsService`) | Mineflayer Chest Transactions | YES (Timeout guards, rollback on full chest, idempotent sorting) | YES (REST `/api/commands/execute`, log entries) | `MANUAL TEST REQUIRED` |
| **Farming** | YES (`farm`) | YES (`execute`) | YES (`plan`) | YES (`FarmSkill`) | YES (`InventoryService`, `ToolService`, `SafetyService`) | Mineflayer Dig / Activate | YES (Mature-only harvest, immediate replanting, 16-seed reserve, hoe protection) | YES (StatsPanel crop yields, EventBus `farming:*`) | `MANUAL TEST REQUIRED` |
| **Forestry** | YES (`chop_tree`) | YES (`execute`) | YES (`plan`) | YES (`ChopTreeSkill`) | YES (`TreeAnalyzer`, `ToolService`, `SafetyService`) | Mineflayer Dig / Leaf Decay | YES (Tree family matching, player-built log protection, base distance buffer) | YES (StatsPanel wood telemetry, EventBus `forestry:*`) | `MANUAL TEST REQUIRED` |
| **Server Authentication** | YES (Reactive in-game prompt detection) | YES (`serverAuthManager`) | N/A (Event Engine) | YES (`serverAuthManager`) | YES (`ServerAuthManager`) | Mineflayer Chat Packets | YES (Database reset re-registration, password masking `[PROTECTED]`) | YES (`/api/auth/status`, WebSocket `auth.status`) | `UNIT-TESTED ONLY` |
| **Security / RBAC** | YES (`grant_permission`, `revoke_permission`, `who_has_access`, `security_log`) | YES (`execute`) | YES (`plan`) | YES (`PermissionManager`) | YES (`PermissionManager`) | Runtime State & Database | YES (5 tiers, owner immutability, 3-strike 5m lockout, 10 cmd/min rate limit) | YES (`/api/commands/history`, CommandAudit, LogViewer) | `READY` |
| **Behavior** | YES (`ambient_mode`) | YES (`execute`) | YES (`plan`) | YES (`HumanoidBehaviorService`, `AmbientBehaviorService`) | YES (`HumanoidBehaviorService`, `AmbientBehaviorService`) | Mineflayer Look / Movement | YES (Preemptible by tasks, timer teardown on disconnect, compliant automation) | YES (SystemHealthPanel, log stream) | `MANUAL TEST REQUIRED` |
| **Dashboard & REST Gateway** | YES (REST endpoints & WebSocket messages) | YES (`RestCommandAdapter`, `DashboardCommandAdapter`) | YES (`CommandPlanner`) | YES (All registered skills) | YES (`startServer`, `sessionAuth`, `websocket`) | Express HTTP & WebSocket Server | YES (HMAC session tokens, 401 unauth rejection, zero credential leakage) | YES (Full web dashboard UI, radar, vitals, inventory, logs) | `READY` |

---

## Source-Level Invariant Enforcement Audit

| Invariant | Source File | Function / Class | Automated Test | Runtime Verification | Status |
|---|---|---|---|---|---|
| **Emergency retreat health threshold (<6 HP / <3 hearts)** | `src/shared/config/safety-thresholds.js`, `src/shared/services/safety.service.js` | `SafetyService.shouldRetreat()` | `test/invariants/final-invariants.test.js` (Subtest 10) | Verified in mock damage tests; retreats at health < 6 | **ENFORCED** |
| **Low-health retreat threshold (<10 HP / 5 hearts)** | `src/shared/config/safety-thresholds.js`, `src/shared/services/safety.service.js` | `SafetyService.getStatus()` | `test/invariants/final-invariants.test.js` (Subtest 10) | Verified; flags `isLowHealth` when health < 10 | **ENFORCED** |
| **Tool durability thresholds (20% warning, 5% critical)** | `src/shared/services/tool.service.js` | `ToolService.isWarning()`, `ToolService.isCritical()` | `test/invariants/final-invariants.test.js` (Subtest 11) | Verified; emits warning at <=20%, applies -100 penalty at <=5% | **ENFORCED** |
| **Mining water-bucket guard (Slot 6 / Window 42)** | `src/modules/inventory/inventory.service.js`, `src/modules/mining/mining.skill.js` | `InventoryService.organizeHotbar()`, `MineSkill.run()` | `test/invariants/final-invariants.test.js` (Subtest 12), `test/integration/inventory.integration.test.js` (Subtest 1) | Verified; water bucket assigned to hotbar slot 6 | **ENFORCED** |
| **Farming seed reserve (16 seeds preserved)** | `src/modules/inventory/inventory.service.js` | `InventoryService.dropLowValueItems()` | `test/integration/inventory.integration.test.js` (Subtest 2) | Verified; discards retain minimum 16 seeds/crops | **ENFORCED** |
| **Forestry base buffer (Safe distance from base)** | `src/modules/forestry/forestry.config.js`, `src/modules/forestry/forestry.policy.js` | `forestryPolicy.shouldPreserveTree()` | `test/modules/forestry/forestry-policy.test.js` | Verified; preserves trees within `SAFE_TREE_DISTANCE_FROM_BASE` (12m) | **ENFORCED** |
| **Command rate limit (10 per minute non-owner)** | `src/modules/security/permission.service.js` | `PermissionManager.checkRateLimit()` | `test/invariants/final-invariants.test.js` (Subtest 4), `test/integration/command-to-task.integration.test.js` (Subtest 4) | Verified; 11th command denied; owner is exempt | **ENFORCED** |
| **Brute-force lockout (3 fails in 5m -> 10m lock)** | `src/modules/security/permission.service.js` | `PermissionManager.recordFailedAttempt()` | `test/invariants/final-invariants.test.js` (Subtest 3), `test/integration/security.integration.test.js` (Subtest 3) | Verified; user added to `tempBlockedUsers` for 10 minutes | **ENFORCED** |
| **Dangerous-command confirmation (60s challenge)** | `src/modules/commands/dangerous-commands.js`, `src/modules/commands/ConfirmationManager.js` | `ConfirmationManager.requestConfirmation()`, `resolveConfirmation()` | `test/modules/commands/confirmation-manager.test.js`, `test/integration/command-to-task.integration.test.js` (Subtest 5) | Verified; intercepts dangerous ops; executes on 'yes' | **ENFORCED** |
| **Task lock timeout (5 minutes / 300000ms)** | `src/core/LockManager.js` | `LockManager.checkLockTimeouts()` | `test/invariants/final-invariants.test.js` | Verified; locks held > 5m are force-released | **ENFORCED** |
| **Build checkpoint interval (50 blocks placed)** | `src/modules/building/building.skill.js` | `BuildSkill.run()` | `test/invariants/final-invariants.test.js` (Subtest 13) | Verified; emits `building.checkpoint` every 50 blocks | **ENFORCED** |
| **Session-token expiration (Configured TTL validation)** | `src/modules/dashboard/session-auth.js` | `verifySessionToken()`, `validateConfig()` | `test/modules/dashboard/session-auth.test.js`, `test/integration/dashboard-api.integration.test.js` (Subtest 3 & 4) | Verified; expired tokens rejected; max TTL 7 days enforced | **ENFORCED** |
