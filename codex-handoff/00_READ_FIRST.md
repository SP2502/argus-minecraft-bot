# 00 — READ FIRST
**ARGUS Minecraft Bot · Codex Handoff Pack · November 2026**

---

## Objective Baseline

The owner has confirmed: **the bot joins the Minecraft server successfully. Higher-level autonomous features do not work properly in live gameplay.** This is the governing truth for all repair work. README claims, release notes ("production release"), and the compliance matrix ("43/43 FULLY IMPLEMENTED") are **documentation artefacts**, not live-gameplay evidence.

---

## Repository Facts

| Field | Value |
|---|---|
| **Clone path** | `%USERPROFILE%\Downloads\Projects\argus` |
| **Git remote** | `https://github.com/SP2502/argus-minecraft-bot.git` |
| **Commit SHA (inspected)** | `97f0ba6016b170eb48762b1651481f5051e1bbd1` |
| **Branch** | `main` |
| **Node.js** | v22.18.0 |
| **npm** | 10.9.3 |
| **Key dependencies** | mineflayer ^4.23.0, mineflayer-pathfinder ^2.4.5, mongoose ^8.3.0, express ^4.19.2, ws ^8.16.0, dotenv ^16.4.5 |

---

## How to Consume This Pack

**Read these four files in order, then begin work:**

1. **This file** — orientation and trust rules
2. [`04_KNOWN_FINDINGS.md`](04_KNOWN_FINDINGS.md) — the 10 source-mapped findings; confidence and affected flows
3. [`02_COMMAND_EXECUTION_TRACES.md`](02_COMMAND_EXECUTION_TRACES.md) — step-by-step traces from chat message to Mineflayer call
4. [`08_CODEX_FIRST_TASK.md`](08_CODEX_FIRST_TASK.md) — ready-to-paste first repair prompt

After those four, use as reference:
- [`01_SYSTEM_ARCHITECTURE.md`](01_SYSTEM_ARCHITECTURE.md) — component map, init sequence, state ownership, events
- [`03_MODULE_AND_FILE_INDEX.md`](03_MODULE_AND_FILE_INDEX.md) — file-by-file index with exports and consumers
- [`05_FEATURE_REALITY_MATRIX.csv`](05_FEATURE_REALITY_MATRIX.csv) — full Part 0–11 requirement coverage table
- [`06_RUNTIME_BASELINE_AND_TESTS.md`](06_RUNTIME_BASELINE_AND_TESTS.md) — test inventory, mock vs live, proposed acceptance checklist
- [`07_REPAIR_ORDER_FOR_CODEX.md`](07_REPAIR_ORDER_FOR_CODEX.md) — dependency-aware phased repair plan
- [`09_INTEGRATION_CONTRACTS.md`](09_INTEGRATION_CONTRACTS.md) — schema, skill, event, state, persistence contracts
- [`10_KNOWN_UNKNOWNS.md`](10_KNOWN_UNKNOWNS.md) — what cannot be determined without live execution
- [`11_PROVENANCE_MANIFEST.json`](11_PROVENANCE_MANIFEST.json) — full generation audit trail
- [`12_CODEX_NAVIGATION_INDEX.md`](12_CODEX_NAVIGATION_INDEX.md) — "to fix X, open files A/B/C" quick lookup

---

## Trust Hierarchy (Codex must observe this)

| Evidence Level | Meaning |
|---|---|
| **OBSERVED IN SOURCE** | Visible by reading the cloned files at the commit above |
| **USER-REPORTED** | Owner's firsthand live-use report; not independently reproduced |
| **TEST-CLAIM IN REPOSITORY** | Assertion in existing docs/tests; not independently verified as live |
| **VERIFIED BY EXECUTION** | Actually run in this workspace with exact command and output |
| **UNKNOWN / NOT TESTED** | No reliable evidence |

**A passing unit test does NOT prove the feature works in live Minecraft.**
**A file or class existing does NOT mean its feature works.**
**A success response from a command does NOT mean the in-game action completed.**

---

## Critical Starting Paths

| What you need | File(s) |
|---|---|
| Bot entry point and lifecycle | `index.js` |
| Dependency injection container | `src/core/BotContext.js` |
| Chat message → command pipeline | `src/modules/commands/adapters/MinecraftChatAdapter.js` → `src/modules/commands/UnifiedCommandGateway.js` |
| Intent routing schema | `src/modules/commands/CommandSchemas.js` |
| NLP parser | `src/modules/nlp/IntentParser.js` |
| Task scheduling | `src/core/TaskManager.js` |
| Skill dispatch | `src/core/SkillRegistry.js` |
| Known broken dispatch paths | `04_KNOWN_FINDINGS.md` Findings F01, F02 |

---

## What Is Confirmed Working

- **OBSERVED IN SOURCE:** Bot connects and spawns (Mineflayer create, auth, spawn lifecycle in `index.js`)
- **USER-REPORTED:** Bot joins Minecraft server successfully
- **OBSERVED IN SOURCE:** Chat adapter attaches listeners to Mineflayer `chat`, `whisper`, `playerChat`, `messagestr` events
- **TEST-CLAIM IN REPOSITORY:** 104/104 unit tests pass (`docs/TESTING.md`) — these are mock/unit tests
- **OBSERVED IN SOURCE:** NLP, TaskManager, BotContext, SkillRegistry, CommandSchemas code exists and is internally consistent in many areas

## What Is Not Confirmed Working

- **USER-REPORTED:** Any autonomous feature beyond server connection
- **OBSERVED IN SOURCE:** `inventory` and `locations` skill names referenced in `CommandSchemas.js` are not registered in `SkillRegistry.js` (Finding F01)
- **OBSERVED IN SOURCE:** Several `isControl: true` intents have no handler in `executeControlOperation()` and return false success (Finding F02)
- **OBSERVED IN SOURCE:** `plan.missing` is never checked before dispatch (Finding F03)
- **OBSERVED IN SOURCE:** Combat scanner reads non-authoritative task field (Finding F04)
- **OBSERVED IN SOURCE:** `retrace_steps` does not set the mode `NavigationSkill.run()` requires (Finding F05)

---

## Boundaries for Codex

- Do not break or rewrite working connection/spawn logic unless a finding directly targets it
- Do not claim a repair is complete until a command produces an observable in-game effect
- Begin with the most verifiable dispatch chain: a simple status command end-to-end, then an action command
- Refer to `08_CODEX_FIRST_TASK.md` for the exact starting scope

> **Generated:** 2026-11-23 | **Commit:** 97f0ba6016b170eb48762b1651481f5051e1bbd1
