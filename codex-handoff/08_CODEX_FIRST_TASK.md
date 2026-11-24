# 08 — Codex First Task

**Ready-to-paste Codex prompt. Scope is narrow and verifiable. Do not expand scope in this first task.**

---

## Paste This Prompt to Codex

---

**ARGUS Minecraft Bot — First Repair Task**

Repository: `%USERPROFILE%\Downloads\Projects\argus`
Commit: `97f0ba6016b170eb48762b1651481f5051e1bbd1`
Node.js: v22.18.0

**Context (read first):**
- `codex-handoff/00_READ_FIRST.md`
- `codex-handoff/04_KNOWN_FINDINGS.md`
- `codex-handoff/02_COMMAND_EXECUTION_TRACES.md`

**Your Scope:** Fix the five source-confirmed dispatch breakages listed below. Do not fix anything else in this task. Do not restructure or refactor files outside the listed changes.

---

### Fix 1 — plan.missing guard (Finding F03)

**File:** `src/modules/commands/UnifiedCommandGateway.js`

After the `plan.ambiguities` check block (around the `if (plan.ambiguities && plan.ambiguities.length > 0)` check), add:

```javascript
// Guard: check for unresolved required parameters before dispatch
if (plan.missing && plan.missing.length > 0) {
  return CommandResponse.error(`Cannot execute: ${plan.missing.join('; ')}`);
}
```

**Test:** Add a unit test in `test/modules/commands/unified-gateway.test.js`:
- Mock CommandPlanner to return `plan.missing = ["Location 'farmA' is not registered."]`
- Verify gateway returns a CommandResponse with an error message, not a task enqueue

---

### Fix 2 — retrace_steps mode (Finding F05)

**File:** `src/modules/commands/CommandPlanner.js`

In `_buildOperation(intentItem, entities, requestContext, index)`, after the `stop_following` params block, add:

```javascript
// Retrace Steps: set mode so NavigationSkill routes correctly
if (intentName === 'retrace_steps') {
  params.mode = 'retrace_steps';
}
```

**Test:** Add a unit test in `test/modules/commands/command-planner.test.js`:
- Build operation for intent `retrace_steps`
- Verify `op.params.mode === 'retrace_steps'`

---

### Fix 3 — Combat scanner task field (Finding F04)

**File:** `index.js`

Find the `setInterval` block (runs every 500ms) that contains:
```javascript
const currentTask = botContext.taskManager && botContext.taskManager.currentTask;
```

Change to:
```javascript
const currentTask = (botContext.taskManager && botContext.taskManager.activeTask) || botContext.currentTask;
```

**Test:** Add a log assertion test or document that `taskManager.currentTask` is undefined and `activeTask` is the authoritative field.

---

### Fix 4 — Unhandled control intents (Finding F02, partial)

**File:** `src/modules/commands/UnifiedCommandGateway.js`

In `executeControlOperation()`, before the `default: break;` add cases for the highest-priority unhandled intents:

```javascript
case 'queue': {
  const snapshot = this.taskManager ? this.taskManager.getQueueSnapshot() : null;
  if (!snapshot) return CommandResponse.info('No task manager available.');
  const active = snapshot.activeTask ? `Active: ${snapshot.activeTask.skillName}` : 'No active task.';
  const queued = snapshot.queue.length > 0
    ? `Queued (${snapshot.queue.length}): ${snapshot.queue.map(t => t.skillName).join(', ')}`
    : 'Queue is empty.';
  return CommandResponse.info(`${active} | ${queued}`);
}

case 'list_bases':
  if (this.ctx && this.ctx.locations) {
    const bases = await this.ctx.locations.listByType('base');
    return CommandResponse.info(
      bases && bases.length > 0
        ? `Registered bases: ${bases.map(b => `${b.name} (${Math.round(b.x)}, ${Math.round(b.y)}, ${Math.round(b.z)})`).join(' | ')}`
        : 'No bases registered.'
    );
  }
  return CommandResponse.info('Location service unavailable.');

case 'list_farms':
  if (this.ctx && this.ctx.locations) {
    const farms = await this.ctx.locations.listByType('farm');
    return CommandResponse.info(farms && farms.length > 0 ? `Registered farms: ${farms.map(f => f.name).join(', ')}` : 'No farms registered.');
  }
  return CommandResponse.info('Location service unavailable.');

case 'list_mines':
  if (this.ctx && this.ctx.locations) {
    const mines = await this.ctx.locations.listByType('mine');
    return CommandResponse.info(mines && mines.length > 0 ? `Registered mines: ${mines.map(m => m.name).join(', ')}` : 'No mines registered.');
  }
  return CommandResponse.info('Location service unavailable.');

case 'list_waypoints':
  if (this.ctx && this.ctx.locations) {
    const wps = await this.ctx.locations.listByType('waypoint');
    return CommandResponse.info(wps && wps.length > 0 ? `Waypoints: ${wps.map(w => w.name).join(', ')}` : 'No waypoints registered.');
  }
  return CommandResponse.info('Location service unavailable.');

case 'show_macro': {
  const macroName = op.params && op.params.name;
  if (!macroName) return CommandResponse.error('Specify a macro name.');
  const m = await Macro.findOne({ name: macroName.toLowerCase() });
  if (!m) return CommandResponse.error(`Macro '${macroName}' not found.`);
  return CommandResponse.info(`Macro '${m.name}': ${m.steps.join(' → ')}`);
}

case 'quiet_mode_on':
  if (this.ctx && this.ctx.messageRouter) {
    this.ctx.messageRouter.quietMode = true;
    return CommandResponse.success('Quiet mode enabled. Non-critical messages suppressed.');
  }
  return CommandResponse.info('Message router unavailable.');

case 'quiet_mode_off':
  if (this.ctx && this.ctx.messageRouter) {
    this.ctx.messageRouter.quietMode = false;
    return CommandResponse.success('Quiet mode disabled.');
  }
  return CommandResponse.info('Message router unavailable.');
```

**Also replace** the final `return CommandResponse.success(...)` default with an explicit error:
```javascript
// Change:
return CommandResponse.success(`Control operation '${op.intentName}' executed.`);
// To:
return CommandResponse.error(`Control operation '${op.intentName}' is not yet implemented.`);
```

**Test:** Add tests for `queue`, `list_bases`, `quiet_mode_on` with mocked ctx.

---

### Fix 5 — Unregistered inventory skill commands (Finding F01, show_inventory pathway check)

Before tackling the full inventory/locations dispatch rewrite (a larger task), add a **guard and informative error** so users get a clear message instead of a confusing SkillRegistry stack trace:

**Option A (quick guard):** In `UnifiedCommandGateway.execute()`, before `taskManager.enqueue()`, check if the skill name is registered:

```javascript
// Before enqueueing, verify skill is registered
const unregisteredSkills = ['inventory', 'locations'];
if (unregisteredSkills.includes(op.skillName) && !op.isControl) {
  return CommandResponse.error(
    `Command '${op.intentName}' is not yet implemented in this version. ` +
    `See available commands with 'help'.`
  );
}
```

**Long-term (separate task):** Create `InventorySkill` and `LocationsSkill` or route via control handlers.

---

### Acceptance Criteria for This Task

1. `plan.missing` check: gateway test passes for missing-param scenario
2. `retrace_steps` planner test: `params.mode === 'retrace_steps'`  
3. `queue` command: returns actual queue state, not false success
4. `list_bases` command: returns location list (or "no bases registered")
5. `sort_inventory` command: returns clear "not yet implemented" error (not SkillRegistry error)
6. `retrace steps` → bot navigates retrace path, not home (live test, once nav service supports it)
7. No existing tests broken: `npm test` still passes

---

**Do not:** fix mining, farming, combat, building, or webhook features in this task.
**Do not:** rewrite the NLP, BotContext, or TaskManager.
**Do not:** claim live functionality until a live Minecraft test is run.

---
*Handoff generated: 2026-11-23 | Commit: 97f0ba6016b170eb48762b1651481f5051e1bbd1*
