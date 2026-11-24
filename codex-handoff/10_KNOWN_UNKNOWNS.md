# 10 — Known Unknowns
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

---

## What Cannot Be Established Without Live Execution

The following cannot be determined from source reading alone. They require a live Minecraft environment with the bot connected.

| Unknown | Why It Cannot Be Determined from Source |
|---|---|
| Whether ANY command is received from chat | Chat format varies by server implementation; `bot.players` online check can silently drop messages |
| Whether `OWNER_USERNAME` is correctly matched | Exact string comparison is case-sensitive; env var may be blank or mismatched |
| Whether `AUTH_MODE=microsoft` works | Requires active Microsoft/Mojang account credentials and OAuth flow |
| Whether `mineflayer-pathfinder` navigates correctly | Pathfinding success depends on server world geometry, MC version, and plugin configuration |
| Whether `bot.dig()` works for mining | Server may have anti-cheat or permission restrictions |
| Whether chest interactions work | Mineflayer window API behavior varies by MC version |
| Whether `retracePath()` has a working implementation | `NavigationService.retracePath()` exists but its path history recording was not inspected |
| Whether ambient behaviors trigger in-game | `AmbientBehaviorService.evaluate()` logic depends on bot game state |
| Whether MongoDB is available | `MONGODB_URI` env var may not be set; fallback to local JSON |
| Whether `organizeHotbar()` succeeds | Real Mineflayer inventory window slot assignment can fail silently |
| Whether server auth (auto-login) works for the owner's server | Plugin type and message format vary by server |
| Root causes of all owner-reported failures | No live command trace or error log was provided; F10 identifies this as a diagnostic lead |
| Whether craft recipes are available for the MC version | Recipe availability depends on `MC_VERSION` and mineflayer-pathfinder recipe data |
| Whether goal decomposition produces correct prerequisite chains | `GoalPlannerService.decompose()` was not inspected in full |
| Whether any test covers mineflayer-pathfinder integration | All navigation tests use mocked `nav` objects |

---

## Version and Environment Constraints

| Constraint | Status |
|---|---|
| Minecraft Java Edition version | Specified via `MC_VERSION` env var; `auto-detect` is risky with strict servers |
| Mineflayer version (`^4.23.0`) | Semver range; patch differences may affect protocol compatibility |
| mineflayer-pathfinder version (`^2.4.5`) | May not support all world geometries |
| Node.js v22 compatibility | Confirmed installed; no known incompatibilities seen |
| MongoDB version | Unknown; Mongoose `^8.3.0` is used |
| Operating system | Windows (confirmed); Docker deployment also supported (Dockerfile present) |

---

## Explicit Separation of Claims from Proof

| Claim | Source | Proof Status |
|---|---|---|
| "104/104 unit tests passing" | `docs/TESTING.md` | TEST-CLAIM IN REPOSITORY (not independently run) |
| "43/43 requirements FULLY IMPLEMENTED" | `docs/ARGUS_COMPLIANCE_MATRIX.md` | TEST-CLAIM IN REPOSITORY (conflicts with live report) |
| "Production release v1.0.0" | `docs/RELEASE_NOTES.md` | TEST-CLAIM IN REPOSITORY (conflicts with live report) |
| "Navigation: UNIT-TESTED ONLY" | `docs/FEATURE_READINESS.md` | Accurate — unit tests with mocks |
| "Combat: MANUAL TEST REQUIRED" | `docs/FEATURE_READINESS.md` | Accurate — not live tested |
| "Bot connects to server" | Owner report | USER-REPORTED (not reproduced here) |
| "Advanced features don't work" | Owner report | USER-REPORTED (not reproduced here) |
| `sort_inventory` throws SkillRegistry error | Source comparison | OBSERVED IN SOURCE (Finding F01) |
| `queue` returns false success | Source reading | OBSERVED IN SOURCE (Finding F02) |
| `plan.missing` not checked | Source reading | OBSERVED IN SOURCE (Finding F03) |
| Combat scanner reads wrong field | Source comparison | OBSERVED IN SOURCE (Finding F04) |
| `retrace_steps` falls back to go_home | Source reading | OBSERVED IN SOURCE (Finding F05) |

---

## Missing Inputs That Would Help Codex

| Missing Input | Value if Available |
|---|---|
| Live error logs from owner's failed sessions | Would identify exact failure point in pipeline (chat receive? authorize? dispatch?) |
| Owner's `.env` configuration (env var names, not values) | Would confirm OWNER_USERNAME, AUTH_MODE, MC_VERSION are set |
| Minecraft server type (vanilla / Paper / Spigot / plugin) | Would confirm whether custom chat formats affect MinecraftChatAdapter parsing |
| Minecraft version being used | Would confirm pathfinder and protocol compatibility |
| Any live error messages the bot has shown | Would narrow down failing features |
| Test results from `npm test` with current dependencies | Would confirm 104 tests still pass or flag regressions |

---

## Items That Were Not Inspected in Full

The following files and directories were not fully read in this engagement and may contain additional implementation details relevant to Codex:

| Path | Reason Not Fully Inspected |
|---|---|
| `src/modules/navigation/navigation.service.js` | Referenced but not fully read; `retracePath()` implementation unclear |
| `src/shared/services/goal-planner.service.js` | Only purpose documented from BotContext; full decompose logic not read |
| `src/modules/dashboard/api/routes/` | Route files not individually inspected |
| `src/modules/dashboard/public/js/dashboard.js` | Frontend not inspected |
| `src/modules/farming/farming.skill.js` | Not individually read |
| `src/modules/forestry/forestry.skill.js` | Not individually read |
| `src/modules/combat/combat.skill.js` | Not individually read |
| `src/modules/logistics/logistics.skill.js` | Not individually read |
| All `*.intents.json` files | NLP intent data files; content not inspected |
| `test/integration/*.test.js` | Integration test implementations not read in detail |
