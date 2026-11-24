# 06 — Runtime Baseline and Tests
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

---

## Owner-Reported Runtime Baseline

**Evidence level:** USER-REPORTED (not independently reproduced in this workspace)

| Behavior | Status | Notes |
|---|---|---|
| Bot connects to Minecraft server | **Working** | Owner confirmed |
| Bot spawns and joins world | **Working** | Owner confirmed |
| Advanced autonomous features | **Not working** | Owner confirmed ("do not function properly") |
| Specific feature failures | Unknown | No detailed per-command live trace provided |

This is the **overriding baseline**. No documentation claim, unit test result, or compliance matrix entry takes precedence over it.

---

## Existing Test Inventory

### Test Runner
```
npm test
# Runs: node --test
# Discovers: test/**/*.test.js
# Count per TESTING.md: 104/104 passing
```
**Note:** Test count was not re-verified with execution in this workspace. `TEST-CLAIM IN REPOSITORY` applies.

### Test Organization

| Directory | Test Files | Purpose |
|---|---|---|
| `test/core/` | `action-queue.test.js`, `advanced-logging-auth-detection.test.js` | Core scheduler, logging |
| `test/integration/` | `auth-network.test.js`, `command-to-task.integration.test.js`, `dashboard-api.integration.test.js`, `inventory.integration.test.js`, `navigation.integration.test.js`, `security.integration.test.js`, `startup.integration.test.js` | Integration (all mocked) |
| `test/invariants/` | `final-invariants.test.js` | 13 safety/invariant assertions |
| `test/modules/behavior/` | `ambient-command.test.js`, `ambient-service.test.js` | Ambient behaviors |
| `test/modules/building/` | `build-skill.test.js`, `building-command.test.js`, `building-policies.test.js`, `schematics.test.js` | Building skill |
| `test/modules/combat/` | `combat-command.test.js`, `combat-defense-humanoid.test.js`, `combat-helper.test.js`, `combat-policies.test.js`, `combat-skill.test.js`, `mob-tactics.test.js` | Combat skill |
| `test/modules/commands/` | `command-planner.test.js`, `confirmation-manager.test.js`, `unified-gateway.test.js` | Command pipeline |
| `test/modules/dashboard/` | `session-auth.test.js` | Dashboard auth |
| `test/modules/forestry/` | `chop-tree-skill.test.js`, `forestry-policies.test.js`, `tree-analyzer.test.js`, `woodcutting-command.test.js` | Forestry |
| `test/modules/inventory/` | `craft-skill.test.js`, `crafting-command.test.js`, `crafting-service.test.js`, `logistics-command.test.js`, `logistics-service.test.js`, `logistics-skill.test.js` | Inventory/crafting |
| `test/modules/nlp/` | `coordinate-parser.test.js`, `quantity-parser.test.js`, `spell-corrector.test.js` | NLP |
| `test/modules/server-auth/` | `server-auth.test.js` | Server auto-login |
| `test/shared/` | `action-queue.test.js`, `advanced-logging-auth-detection.test.js` | Action queue, logging |

---

## Mock vs Real Minecraft Distinction

> **ALL existing tests use mocked Mineflayer.** None require a live Minecraft server.

### How Tests Mock Mineflayer
Tests construct minimal `bot` objects with fake `health`, `food`, `inventory`, `entity`, and `players` properties. They do not:
- Connect to any server
- Use `mineflayer.createBot()`
- Use `mineflayer-pathfinder`
- Perform actual block dig/place operations
- Measure real-world timing or physics

### What Tests Can Prove
- Logic correctness of pure functions (parsers, validators, calculators)
- State machine transitions in TaskManager/LockManager
- Intent parsing output
- Permission tier enforcement
- Confirmation challenge flow
- Safety threshold calculations
- Event emission on state change

### What Tests Cannot Prove
- That commands reach the bot from real Minecraft chat
- That `bot.dig()`, `bot.placeBlock()`, `bot.attack()` produce in-game effects
- That `mineflayer-pathfinder` navigates correctly
- That inventory window transactions complete
- That reconnection and queue restore work after a real disconnect

---

## Final Invariants Coverage (`test/invariants/final-invariants.test.js`)

| Invariant | Claim | Evidence |
|---|---|---|
| Brute-force lockout (3 fails) | Activated after 3 auth failures | MOCK_OR_UNIT_TEST_CLAIM |
| Rate limit enforcement (10/min) | 11th command denied | MOCK_OR_UNIT_TEST_CLAIM |
| Owner cannot be blocked/demoted | Revoke rejected for owner | MOCK_OR_UNIT_TEST_CLAIM |
| Rate limit owner exemption | Owner bypasses rate limit | MOCK_OR_UNIT_TEST_CLAIM |
| Food safety threshold (< 6 food) | isLowFood returns true | MOCK_OR_UNIT_TEST_CLAIM |
| Combat retreat (< 6 HP) | isCritical returns true | MOCK_OR_UNIT_TEST_CLAIM |
| Combat retreat (< 10 HP) | isLowHealth returns true | MOCK_OR_UNIT_TEST_CLAIM |
| Tool warning (≤ 20% durability) | isWarning returns true | MOCK_OR_UNIT_TEST_CLAIM |
| Tool critical (≤ 5% durability) | isCritical returns true | MOCK_OR_UNIT_TEST_CLAIM |
| Water bucket slot-6 | Slot assignment attempted | MOCK_OR_UNIT_TEST_CLAIM (see F08) |
| 16-seed farming reserve | Seeds retained | MOCK_OR_UNIT_TEST_CLAIM |
| Lock timeout release (> 5 min) | Force-released | MOCK_OR_UNIT_TEST_CLAIM |
| Building checkpoint (50 blocks) | Event emitted | MOCK_OR_UNIT_TEST_CLAIM |

---

## Proposed Controlled Acceptance Checklist (For Codex)

**Purpose:** Observable end-to-end tests that can be run with a local/singleplayer Minecraft instance. These are **proposed**, not completed.

### Prerequisites
- Minecraft Java Edition (version matching `.env` `MC_VERSION`)
- Local server or singleplayer with LAN open
- `.env` configured: `MC_HOST`, `MC_PORT`, `MC_USERNAME` (offline mode), `OWNER_USERNAME` matching your in-game name
- `AUTH_MODE=offline`
- No `REQUIRE_PREFIX` or prefix set to something simple

### Phase 1 — Connection and Command Reception

| Test | Pass Condition |
|---|---|
| Bot spawns | Bot appears in-game, no crash |
| Owner sends `status` | Bot replies in chat with health/position |
| Owner sends `where are you` | Bot replies with coordinates |
| Non-owner guest sends `status` | Bot replies (guest permission) |
| Non-owner sends `mine 64 diamonds` | Bot denies (admin permission required) |
| Rate limit test | 11th command in 60s is denied |

### Phase 2 — Navigation

| Test | Pass Condition |
|---|---|
| `follow me` | Bot follows owner |
| `stop following` | Bot stops |
| Register a base: `register base home` | Bot acknowledges (once F01 fixed) |
| `go home` | Bot navigates to registered base |
| `go to 100 64 100` | Bot navigates to coordinates |
| `retrace steps` | Bot retraces path (once F05 fixed) |

### Phase 3 — Inventory / Crafting

| Test | Pass Condition |
|---|---|
| `show inventory` | Bot lists inventory |
| `sort inventory` | Bot sorts (once F01 fixed) |
| `craft iron pickaxe` | Bot crafts if materials present |

### Phase 4 — Mining

| Test | Pass Condition |
|---|---|
| `mine 10 coal` | Bot mines 10 coal, returns |
| `mine 5 diamonds` | Bot mines diamonds at Y-59 |

### Phase 5 — Complex Autonomous

| Test | Pass Condition |
|---|---|
| `farm` | Bot harvests mature crops, replants |
| `combat` | Bot engages hostile mob, retreats at < 6 HP |
| `guard` | Bot patrols/protects area |
