# 04 — Known Findings
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

These are the **ten supplied findings** only. No independent bug hunting was performed.
Evidence labels are defined in `00_READ_FIRST.md`.

---

## F01 — Unregistered Skill Names Referenced by Executable Commands

**Confidence:** OBSERVED IN SOURCE
**Classification:** Direct source mismatch

### Evidence
`CommandSchemas.js` maps the following **non-control** intents to skill names that do not exist in `SkillRegistry.js`:

| CommandSchemas.js Intent | Schema `skillName` | isControl | SkillRegistry has it? |
|---|---|---|---|
| `sort_inventory` | `inventory` | false | ❌ NO |
| `store_all` | `inventory` | false | ❌ NO |
| `store_item` | `inventory` | false | ❌ NO |
| `retrieve_item` | `inventory` | false | ❌ NO |
| `drop_item` | `inventory` | false | ❌ NO |
| `drop_all` | `inventory` | false | ❌ NO |
| `register_base` | `locations` | false | ❌ NO |
| `register_farm` | `locations` | false | ❌ NO |
| `register_mine` | `locations` | false | ❌ NO |
| `set_waypoint` | `locations` | false | ❌ NO |
| `remove_waypoint` | `locations` | false | ❌ NO |

**Registered skills** in `SkillRegistry.js`: `mine`, `farm`, `chop_tree`, `combat`, `craft`, `build`, `logistics`, `navigation`

**Additional skill names in schemas not registered** (all `isControl:true`, so handled via `executeControlOperation` and do not reach SkillRegistry — however, any future non-control routing would fail):
`control`, `security`, `communication`, `macro`, `core`

### Failure Path (OBSERVED IN SOURCE)
`UnifiedCommandGateway.execute()` → non-control plan → `taskManager.enqueue({ skillName:'inventory' })` → `TaskManager.runNext()` → `SkillRegistry.loadSkill('inventory', ctx)` → **throws** `Error("[SkillRegistry] Skill 'inventory' is not registered. Available skills: [mine, farm, chop_tree, combat, craft, build, logistics, navigation]")` → task transitions to FAILED → player receives error message.

### Affected Flows
- All inventory management commands (`sort inventory`, `store all`, `store item`, `retrieve item`, `drop item`, `drop all`)
- All location registration commands (`register base`, `register farm`, `register mine`, `set waypoint`, `remove waypoint`)

### Codex Investigation Questions
1. Was an `InventorySkill` and `LocationsSkill` planned but never created? Or should these route through existing services differently?
2. Should `sort_inventory`, `show_inventory`, etc. be re-routed as `isControl:true` with direct handler in `executeControlOperation`?
3. Should `register_base` etc. create/update Location documents via `ctx.locations` directly in a control handler?

---

## F02 — Unsupported Control Intents Receive False Success

**Confidence:** OBSERVED IN SOURCE
**Classification:** Direct source mismatch

### Evidence
`UnifiedCommandGateway.executeControlOperation()` ends with:
```javascript
default:
  break;
}
return CommandResponse.success(`Control operation '${op.intentName}' executed.`);
```

Control intents in `CommandSchemas.js` that have **no** `switch` case in `executeControlOperation`:

| Intent | Expected behavior |
|---|---|
| `queue` | Show current task queue |
| `cancel` | Cancel a specific task by ID |
| `list_bases` | List registered bases |
| `list_farms` | List registered farms |
| `list_mines` | List registered mines |
| `list_waypoints` | List all waypoints |
| `who_has_access` | Show permission list |
| `security_log` | Show command audit log |
| `quiet_mode_on` | Suppress non-critical chat |
| `quiet_mode_off` | Restore chat verbosity |
| `dnd` | Do-not-disturb mode on |
| `dnd_off` | Do-not-disturb mode off |
| `show_macro` | Show a macro's steps |
| `delete_macro` | Delete a named macro |

**Note:** `resume` and `cancel` have cases but `cancel` without a `taskId` parameter may not function as expected. Cross-check these before marking as implemented.

### Failure Path (OBSERVED IN SOURCE)
Player sends `queue` → parsed as intent `queue` → `isControl:true` → `executeControlOperation()` → no matching case → `default: break` → returns `CommandResponse.success("Control operation 'queue' executed.")` → player sees success but nothing happened.

### Affected Flows
14+ unhandled control intents silently succeed.

### Codex Investigation Questions
1. For each unhandled intent, determine intended data source (e.g., `ctx.taskManager.getQueueSnapshot()` for `queue`; `ctx.locations.listByType()` for `list_bases`)
2. Implement explicit handlers or return an explicit "not yet implemented" error — do not leave the false success default

---

## F03 — Planner's Unresolved Prerequisites Not Checked Before Dispatch

**Confidence:** OBSERVED IN SOURCE
**Classification:** Direct source mismatch

### Evidence
`CommandPlanner._buildOperation()` populates `missing[]` for unresolved required elements (e.g., unregistered named navigation targets add `"Location 'X' is not registered."` to `missing`).

`UnifiedCommandGateway.execute()` checks:
```javascript
if (plan.ambiguities && plan.ambiguities.length > 0) {
  // prompts user
}
// ⚠ No corresponding check for plan.missing
```
`plan.missing` is populated but never checked before `taskManager.enqueue()` is called.

### Failure Path (OBSERVED IN SOURCE)
Compound command with unregistered location → `plan.missing = ["Location 'farmA' is not registered."]` → no early return → `enqueue()` → skill tries to navigate → fails inside skill with less helpful error than an early "Location not registered" message.

### Codex Fix
Add before the enqueue branch:
```javascript
if (plan.missing && plan.missing.length > 0) {
  return CommandResponse.error(`Cannot execute: ${plan.missing.join('; ')}`);
}
```

---

## F04 — Background Combat Scanner Reads Non-Authoritative Task Field

**Confidence:** OBSERVED IN SOURCE; runtime impact UNKNOWN / NOT TESTED
**Classification:** Direct source mismatch

### Evidence
`index.js` (500ms combat scan interval, inside `bot.on('spawn')`):
```javascript
const currentTask = botContext.taskManager && botContext.taskManager.currentTask;
```

`TaskManager.js`:
- Authoritative field: `this.activeTask` (set/cleared in `runNext()`)
- Also sets: `this.ctx.currentTask = task` (on the BotContext, not on TaskManager)
- `TaskManager` does **not** have a property named `currentTask`

`BotContext.js`: Has `this.currentTask = null` as a plain property, set by `TaskManager.runNext()` finally block.

So `botContext.taskManager.currentTask` is `undefined` (TaskManager has no such field), while the actual state is in `botContext.currentTask`.

### Impact
The combat scan's check for "is there an active task?" always returns falsy, potentially allowing the combat scanner to trigger autonomous combat actions even when a planned task is active.

### Codex Fix Target
Change `index.js` combat scan to read `botContext.taskManager.activeTask || botContext.currentTask`.

---

## F05 — Retrace Command Does Not Set the Navigation Mode It Requires

**Confidence:** OBSERVED IN SOURCE; runtime effect depends on parsed params
**Classification:** Direct source path mismatch

### Evidence
`CommandSchemas.js`:
```javascript
retrace_steps: { skillName: 'navigation', isControl: false, ... }
```

`CommandPlanner._buildOperation()` sets `params.mode` only for:
- `follow` → `params.mode = 'follow'`
- `stop_following` → `params.mode = 'stop_following'`
- `go_home` → `params.targetLocation = 'primary_base'` (no explicit mode)

No explicit `params.mode = 'retrace_steps'` for `retrace_steps` intent.

`NavigationSkill.run(params)`:
```javascript
const mode = params.mode || (params.player ? 'follow' : (params.position || params.location) ? 'go_to' : 'go_home');
```
Without `params.mode`, no player, no position → falls through to `'go_home'`.

The actual `retrace` mode is handled:
```javascript
if (mode === 'retrace' || mode === 'retrace_steps') {
  const success = await this.ctx.nav.retracePath();
  return { success, mode: 'retrace' };
}
```
But it is never reached via the current plan → dispatch chain.

### Codex Fix Target
In `CommandPlanner._buildOperation()`, add:
```javascript
if (intentName === 'retrace_steps') {
  params.mode = 'retrace_steps';
}
```

---

## F06 — Cancellation Potentially Releases Locks Before Work Has Stopped

**Confidence:** INFERRED CONCURRENCY RISK; not a reproduced race
**Classification:** Inferred design risk

### Evidence
`TaskManager.cancelTask(taskId)`:
```javascript
if (this.activeTask && this.activeTask.id === taskId) {
  const task = this.activeTask;
  this._transition(task, TaskState.CANCELLED);
  if (this.activeSkillInstance) {
    this.activeSkillInstance.abort(); // sets aborted flag
  }
  this.lockManager.releaseLocks(taskId); // locks released immediately
  this.activeTask = null;
  this.activeSkillInstance = null;
  return true;
}
```

`BaseSkill.abort()` sets `this.aborted = true`, but the async `skill.run()` call is still awaited in `runNext()`. The in-flight Mineflayer actions (dig, navigate) may not stop immediately. Meanwhile, locks are released and `runNext()` might begin another task.

### Codex Investigation Target
Test cancellation under a long-running navigation or dig operation. Confirm that `mineflayer-pathfinder`'s goal is actually cleared when `abort()` is called, and that subsequent tasks do not start while the previous action is mid-execution.

---

## F07 — Queue Writes Are Asynchronous and Not Visibly Ordered

**Confidence:** INFERRED DURABILITY RISK; not a reproduced data-loss event
**Classification:** Inferred design risk

### Evidence
`TaskManager._transition()`:
```javascript
this._persistQueue().catch(() => {});
```
Called without `await`. Multiple rapid state changes (enqueue, start, complete) trigger multiple overlapping `persistenceManager.saveData('task_queue.json', ...)` calls. No ordering or versioning is applied.

`TaskManager.restoreQueue()` comment: tasks with unresolved `dependsOn` are skipped ("assumed complete").

### Codex Investigation Target
Determine if queue corruption on rapid task cycling is observable. If persistence is critical, add write serialization or debouncing.

---

## F08 — Mining Hotbar Invariant Is Not Fully Established

**Confidence:** OBSERVED IN SOURCE
**Classification:** Direct source mismatch between stated guarantee and checked condition

### Evidence
`MineSkill.run()`:
```javascript
if (typeof this.ctx.inv.organizeHotbar === 'function') {
  try { await this.ctx.inv.organizeHotbar(); } catch (e) {} // errors suppressed
}
const hasWaterBucket = this.ctx.inv.hasItem('water_bucket');
if (!hasWaterBucket && targetY < 0) {
  throw new SkillAbort('Hazardous mining aborted: Water bucket in slot 6 cannot be guaranteed.');
}
```

`InventoryService.hasItem('water_bucket')` checks **presence in inventory** (any slot), not specifically slot 6. `organizeHotbar()` is called, but its error is suppressed. If `organizeHotbar()` fails to place the water bucket in slot 6, `hasItem` still returns true (bucket is in inventory), and the SkillAbort is not thrown, but the slot-6 invariant is violated.

`docs/ARGUS_COMPLIANCE_MATRIX.md` claims: "Water bucket assigned to hotbar slot 6 — VERIFIED."

Existing test `test/invariants/final-invariants.test.js` validates "attempted slot moves" with a mock inventory — not real Mineflayer window behavior.

### Codex Fix Target
After `organizeHotbar()`, verify that `bot.inventory.slots[45 + 6]?.name === 'water_bucket'` (hotbar slot 6 = inventory window slot 45+6=51 in Mineflayer).

---

## F09 — "Production Release" Documentation Conflicts with Readiness Matrix

**Confidence:** OBSERVED IN SOURCE
**Classification:** Documentation conflict

### Evidence

| Document | Claim |
|---|---|
| `docs/RELEASE_NOTES.md` | "Version 1.0.0 — Production Release. Enterprise-grade." |
| `docs/ARGUS_COMPLIANCE_MATRIX.md` | "43/43 requirements FULLY IMPLEMENTED. 0 gaps." |
| `docs/TESTING.md` | "104/104 tests passing." |
| `docs/FEATURE_READINESS.md` | Navigation, Inventory, Crafting: `UNIT-TESTED ONLY`; Combat, Mining, Building, Logistics, Farming: `MANUAL TEST REQUIRED` |
| **Owner live report** | "Joining works. Higher-level features do not work." |

The compliance matrix's claim of "Runtime Verification: Verified via REST requests" and "Verified live broadcast loop" does not establish that autonomous in-game actions work. `FEATURE_READINESS.md` explicitly labels all major gameplay domains as requiring further verification.

### Codex Target
Do not make release readiness claims until a controlled, Minecraft-version-specific live acceptance test for each domain passes.

---

## F10 — Command Ingestion and Owner Identity Are High-Value Diagnostic Starting Points

**Confidence:** INVESTIGATION LEAD ONLY; not a known source-level root cause
**Classification:** Investigation lead

### Evidence
The pipeline from server join to command execution passes through multiple stages:
1. Bot spawns → `BotContext` constructed
2. `MinecraftChatAdapter.attach()` → listeners registered
3. Chat message arrives → `_handlePlayerMessage` → player online check (`bot.players`)
4. Rate limit → NLP → plan → auth (`OWNER_USERNAME` from env) → dispatch

A bot that connects may still fail at any subsequent stage. Known risk points:
- `OWNER_USERNAME` not set or mismatched → owner commands denied
- `bot.players` lookup missing player (chat format or timing) → message silently dropped
- `AUTH_MODE` misconfigured → auth failure at Mojang/server level
- Prefix policy enabled unexpectedly → all commands ignored

### Codex Target
Add stage telemetry: `received → parsed → authorized → planned → dispatched → action_started → effect_verified / error`. Reproduce with simple `status` command before any autonomous feature.
