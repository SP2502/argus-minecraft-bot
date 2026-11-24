# 09 — Integration Contracts
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

---

## Command Request Schema

All three adapters (Minecraft Chat, REST, Dashboard) construct this object before calling `UnifiedCommandGateway.execute()`:

```javascript
{
  source: 'minecraft' | 'dashboard' | 'rest',
  senderId: string,           // MC username or dashboard session ID
  senderDisplayName: string,  // Human-readable name
  message: string,            // Raw command text (before normalization)
  sessionId: string | null,   // 'mc:Username', 'mc_whisper:Username', socket ID, etc.
  metadata: {
    timestamp: number,        // Date.now()
    isWhisper: boolean,
    rawMessage: string
  }
}
```

---

## CommandResponse Contract

```javascript
// Factory methods:
CommandResponse.success(message, data?)  → { status:'success', message, data }
CommandResponse.error(message)           → { status:'error', message }
CommandResponse.denied(message)          → { status:'denied', message }
CommandResponse.info(message, data?)     → { status:'info', message, data }
```

---

## NLP Parse Result Schema

`nlp.parse(text)` returns:

```javascript
{
  intents: [
    {
      name: string,         // e.g. 'mine', 'follow', 'status'
      confidence: number,   // 0.0–1.0
      entities: { ... }     // per-intent entity extraction
    }
  ],
  entities: {
    item: string | null,
    quantity: { value: number, mode: 'exact'|'all'|'at_least' } | null,
    player: string | null,
    location: { type: 'coordinates'|'named_location'|'relative_coordinates', ... } | null,
    time: { durationMs: number } | null,
    role: string | null,
    name: string | null,
    steps: string[] | null
  },
  suggestedCorrections: [{ from: string, to: string, confidence: number }],
  rawText: string
}
```

---

## CommandPlanner Plan Schema

`commandPlanner.plan(parseResult, requestContext)` returns:

```javascript
{
  planId: string,
  type: 'empty' | 'control' | 'single' | 'sequence',
  operations: [OperationDescriptor],
  ambiguities: [AmbiguityDescriptor],
  missing: string[],           // ⚠ NOT checked before dispatch (F03)
  isIntelligentWorkflow: boolean,
  preparationExplanation: string | null,
  summary: string | null
}
```

**OperationDescriptor:**
```javascript
{
  operationId: string,
  intentName: string,          // e.g. 'mine'
  skillName: string,           // e.g. 'mine' (must match SkillRegistry key)
  params: { ... },             // Built by _buildOperation; see per-intent tables
  requiredPermission: 'guest'|'trusted'|'admin'|'owner',
  priority: number,
  locks: string[],             // e.g. ['movement', 'inventory', 'tool:pickaxe']
  dangerous: boolean,
  isControl: boolean,
  available: boolean,
  dependsOn: string[],         // operationIds this must wait for
  ambiguities: AmbiguityDescriptor[],
  missing: string[]
}
```

---

## TaskManager Enqueue Schema

`taskManager.enqueue(taskDef)` accepts:

```javascript
{
  skillName: string,           // MUST be in SkillRegistry.registry
  params: { ... },
  priority: number,
  requestedBy: string,         // senderId
  locks: string[],
  dependsOn: string[],         // operationIds or task IDs
  operationId: string,
  timeoutMs: number,           // default: 300000 (5 min)
  maxRetries: number,          // default: 2
  checkpoint: null
}
```

---

## Task State Machine

```
PENDING → QUEUED → STARTING → RUNNING → SUCCESS
                                     ↘ FAILED (retry → PENDING, or final FAILED)
                                     ↘ SUSPENDED
                                     ↘ CANCELLED
         BLOCKED (dependency not met)
```

**Events emitted at each transition:**
- `task.state_changed` → `{ task, from, to }`
- `task.queued`, `task.running`, `task.success`, `task.failed`, `task.suspended`, `task.cancelled`
- `log:entry` with severity level

---

## Skill Interface (BaseSkill)

Each skill must extend `BaseSkill` and implement `run(params)`:

```javascript
class MySkill extends BaseSkill {
  constructor(ctx) { super(ctx); }

  async run(params = {}) {
    // this.ctx        — BotContext
    // this.bot        — this.ctx.bot (Mineflayer)
    // this.aborted    — boolean, set by abort()
    // await this.safetyCheckLoop() — health/hunger check
    // throw new SkillAbort(reason) — intentional termination
    // throw new SkillSuspended(checkpoint) — suspend for resumption
    return { success: true, ... };
  }

  abort() {
    super.abort(); // sets this.aborted = true
    // also stop any Mineflayer pathfinder goal
  }
}
```

---

## SkillRegistry — Key Interface Mismatch

| `CommandSchemas.js` skillName | `SkillRegistry.js` has? | Effect |
|---|---|---|
| `mine` | ✅ YES | Routes correctly |
| `farm` | ✅ YES | Routes correctly |
| `chop_tree` | ✅ YES | Routes correctly |
| `combat` | ✅ YES | Routes correctly |
| `craft` | ✅ YES | Routes correctly |
| `build` | ✅ YES | Routes correctly |
| `logistics` | ✅ YES | Routes correctly |
| `navigation` | ✅ YES | Routes correctly |
| `inventory` | ❌ NO | Throws on runNext() |
| `locations` | ❌ NO | Throws on runNext() |
| `control` | ❌ NO | isControl:true so never reaches SkillRegistry |
| `security` | ❌ NO | isControl:true so never reaches SkillRegistry |
| `communication` | ❌ NO | isControl:true so never reaches SkillRegistry |
| `macro` | ❌ NO | isControl:true for most; run_macro is not control |
| `core` | ❌ NO | isControl:true so never reaches SkillRegistry |

---

## Permission Tier Map

| Tier Value | Tier Name | Key Permissions |
|---|---|---|
| 4 | owner | All commands; immutable; cannot be revoked |
| 3 | admin | mine, farm, combat, build, index_chests, grant_permission |
| 2 | trusted | craft, go_to, follow, sort_inventory, sort_warehouse, guard |
| 1 | guest | status, where_are_you, health_status, uptime, show_inventory, find_item |
| 0 | blocked | No commands |

**Owner determination:** `OWNER_USERNAME` environment variable; fallback `ShadowPace2502` hardcoded in `BotContext.js`.

---

## Lock Names Used by Skills

| Lock Name | Acquired By |
|---|---|
| `movement` | navigation, mine, farm, chop_tree, combat, build, logistics |
| `inventory` | mine, farm, craft, build, logistics, all inventory commands |
| `combat` | combat, guard, patrol |
| `building` | build |
| `warehouse` | logistics, sort_warehouse, restock, index_chests |
| `tool:pickaxe` | mine, build |
| `tool:hoe` | farm |
| `tool:axe` | chop_tree |
| `tool:weapon` | combat, guard, patrol |

Lock timeout: 5 minutes (300,000ms). Force-released by `LockManager.checkLockTimeouts()`.

---

## MongoDB Models Used

| Model | File | Key Fields |
|---|---|---|
| Location | `src/modules/navigation/location.model.js` | name, type, x, y, z |
| Permission | `src/modules/security/permission.model.js` | username, tier, grantedBy |
| CommandAudit | `src/modules/security/command-audit.model.js` | commandId, source, senderId, normalizedText, finalStatus |
| Macro | `src/modules/commands/macro.model.js` | name, steps (string[]) |
| Chest | `src/modules/logistics/chest.model.js` | position, label, contents |

---

## Environment Variables (names only — no values)

| Variable | Purpose |
|---|---|
| `MC_HOST` | Minecraft server hostname |
| `MC_PORT` | Minecraft server port |
| `MC_USERNAME` | Bot's Minecraft username |
| `MC_VERSION` | Minecraft version (e.g., '1.21.1') |
| `AUTH_MODE` | `offline` or `microsoft` |
| `OWNER_USERNAME` | Bot owner's exact in-game username |
| `MONGODB_URI` | MongoDB connection string (optional) |
| `API_PORT` / `PORT` | Dashboard API port (default 3000) |
| `WEBHOOK_URL` | Optional outbound webhook endpoint |
| `SESSION_SECRET` | Dashboard session signing secret |
| `API_KEY` | REST API authentication key |

---

## Known Interface Mismatches (from Findings)

| Location | Mismatch | Finding |
|---|---|---|
| `index.js` combat scan | Reads `taskManager.currentTask` (undefined) instead of `taskManager.activeTask` | F04 |
| `CommandPlanner._buildOperation` | Does not set `params.mode` for `retrace_steps` | F05 |
| `CommandSchemas.js` → `skillName:'inventory'` | SkillRegistry has no 'inventory' skill | F01 |
| `CommandSchemas.js` → `skillName:'locations'` | SkillRegistry has no 'locations' skill | F01 |
| `executeControlOperation` default return | Returns success for unhandled intents | F02 |
| `execute()` pipeline | Does not check `plan.missing` before dispatch | F03 |
| `MineSkill.run()` hotbar check | `hasItem()` checks inventory, not slot 6 | F08 |
| `cancelTask()` lifecycle | Releases locks before async skill.run() settles | F06 |
| `_transition()` persistence | Fire-and-forget; no ordering guarantee | F07 |
