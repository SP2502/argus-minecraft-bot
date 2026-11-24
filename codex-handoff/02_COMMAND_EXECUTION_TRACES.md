# 02 — Command Execution Traces
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

Each trace documents the **code path**, not a live execution. Evidence labels follow the Trust Hierarchy in `00_READ_FIRST.md`.

---

## Trace Legend

- `→` code path step (OBSERVED IN SOURCE)
- `⚠` known gap or finding
- `[?]` behavior depends on runtime state unknown without execution
- `✗ BREAKS HERE` path terminates abnormally based on source analysis

---

## Trace 1: `status`

**Input:** Player types `status` in Minecraft chat

**Code path:**

```
bot.on('chat', username, 'status')
  → MinecraftChatAdapter._handlePlayerMessage(username, 'status', false)
  → Check: bot.players[username] exists? [?] If not online → SILENT DROP
  → Dedup check (1500ms window)
  → messageRouter.handleSocialGreeting(username, 'status') → false (not greeting)
  → ctx.commandGateway.execute({ source:'minecraft', senderId:username, message:'status' })

UnifiedCommandGateway.execute():
  → Normalize: 'status'
  → Prefix policy: [?] depends on REQUIRE_PREFIX env var — if enabled and 'status' lacks prefix → IGNORED
  → Rate limit check → passes (unless 11th command in 60s)
  → No pending confirmation
  → nlp.parse('status')
    → IntentParser → intent: { name:'status', confidence:~0.95 }
  → commandPlanner.plan({ intents:[{name:'status'}], entities:{} })
    → CommandSchemas['status'] = { skillName:'core', isControl:true, ... }
    → Returns plan { type:'control', operations:[{intentName:'status', isControl:true}], ambiguities:[], missing:[] }
  → plan.ambiguities: [] → no prompt needed
  → ⚠ plan.missing not checked (Finding F03 — but 'status' has no missing params, so no effect here)
  → permissions.checkPermission(username, 'guest') → passes
  → executeControlOperation(request, op) with intentName='status'

executeControlOperation() switch:
  case 'status':
    → bot.health, bot.food, bot.entity.position
    → taskManager.getQueueSnapshot()
    → Returns CommandResponse.success("Status: Health 20/20, Food 20/20, ...")

  → messageRouter.respondToCommand(request, response)
    → bot.chat("Status: Health 20/20...")
```

**Result:** OBSERVED IN SOURCE — `status` should work if player is recognized as online and prefix policy is not blocking.
**Limitation (F10):** If `bot.players[username]` doesn't contain the player for format reasons (e.g., network delay or unusual server implementation), `MinecraftChatAdapter` silently drops the message.

---

## Trace 2: `follow me`

**Input:** Player types `follow me` in chat

```
MinecraftChatAdapter → commandGateway.execute({ message:'follow me' })

UnifiedCommandGateway.execute():
  → nlp.parse('follow me')
    → Intent: { name:'follow' }, entity: { player:'me' }
  → commandPlanner.plan(parseResult, { senderId: username })
    → CommandSchemas['follow'] = { skillName:'navigation', isControl:false, locks:['movement'] }
    → _buildOperation('follow', entities, ctx, 0):
      → params.mode = 'follow'
      → entities.player === 'me' → params.player = requestContext.senderId (= username)
    → Returns plan { type:'single', operations:[{intentName:'follow', skillName:'navigation', params:{mode:'follow', player:username}}] }
  → plan.missing: [] → (no check anyway, F03)
  → permissions.checkPermission(username, 'trusted') → [?] depends on user's tier
  → taskManager.enqueue({ skillName:'navigation', params:{mode:'follow', player:username}, locks:['movement'], ... })

TaskManager.enqueue():
  → Acquires lock 'movement'
  → Pushes to queue
  → AIBrain next tick calls runNext()

TaskManager.runNext():
  → SkillRegistry.loadSkill('navigation', ctx) → new NavigationSkill(ctx) ✓ (registered)
  → skill.run({ mode:'follow', player:username })

NavigationSkill.run({ mode:'follow', player:'Username' }):
  → mode === 'follow' → _executeFollow('Username', 3)
  → bot.players['Username']? [?] must exist
  → playerObj.entity? [?] if nil, waits 10s
  → ctx.nav.followEntity(targetEntity, { distance:3 }) → Mineflayer pathfinder goal
  → Loop: checks this.aborted, ctx.nav.isFollowing, bot.players[playerName]
```

**Result:** OBSERVED IN SOURCE — code path is complete and skill is registered. Actual following depends on pathfinder being initialized and player being in render range (UNKNOWN / NOT TESTED in live gameplay).

---

## Trace 3: `mine 64 diamonds`

**Input:** Player types `mine 64 diamonds` in chat

```
MinecraftChatAdapter → commandGateway.execute({ message:'mine 64 diamonds' })

UnifiedCommandGateway.execute():
  → nlp.parse('mine 64 diamonds')
    → Intent: { name:'mine' }, entities: { item:'diamond', quantity:{ value:64 } }
  → commandPlanner.plan(parseResult):
    → CommandSchemas['mine'] = { skillName:'mine', locks:['movement','inventory','tool:pickaxe'] }
    → goalPlanner.decompose(op, ctx.inv) [?] if mining diamonds, may try to decompose into pickaxe crafting chain
    → Returns plan with ops including mine op (or decomposed sequence)
    → plan.missing: [] if no unresolved locations
  → ⚠ plan.missing NOT checked before dispatch (F03) — but mine has no mandatory location param
  → permissions.checkPermission(username, 'admin') → [?] requires admin tier
  → taskManager.enqueue({ skillName:'mine', params:{ targetOre:'diamond', quantity:64 }, locks:[...] })

TaskManager.runNext():
  → SkillRegistry.loadSkill('mine', ctx) → new MineSkill(ctx) ✓
  → skill.run({ targetOre:'diamond', quantity:64 })

MineSkill.run():
  1. ctx.inv.organizeHotbar() [try/catch — errors suppressed]
  2. ctx.inv.hasItem('water_bucket')? → ⚠ Finding F08: hasItem checks possession, not slot 6 specifically
     → If false and targetY < 0 → throws SkillAbort
  3. ctx.tools.getBestTool('pickaxe') → if none, ctx.tools.equipBest('pickaxe', true) → if still none → SkillAbort
  4. Loop (while mined < 64 and not aborted):
     a. safetyCheckLoop() — checks health, hunger
     b. safety.shouldRetreat()? → nav.returnHome() then SkillAbort
     c. target.findNearestBlock(searchBlocks, 32)
     d. nav.goTo(ore.position, {allowBreak:true, range:2})
     e. tools.equipBest('pickaxe', true)
     f. bot.dig(freshBlock) → mined++
     g. inv.isFull(0.9)? → locations.findNearestChest → inv.depositAll
  5. Return { mined, targetOre:'diamond' }
```

**Result:** OBSERVED IN SOURCE — code path is complete and skill registered. Live success depends on pathfinder, item availability, and correct env config. F08 means slot-6 hotbar invariant is weaker than stated.

---

## Trace 4: `craft iron pickaxe`

**Input:** Player types `craft iron pickaxe`

```
nlp.parse('craft iron pickaxe')
  → Intent: { name:'craft' }, entities: { item:'iron_pickaxe', quantity:1 }

commandPlanner.plan():
  → CommandSchemas['craft'] = { skillName:'craft', isControl:false, locks:['inventory'] }
  → goalPlanner.decompose may check if iron ingots are available
  → Returns plan { type:'single', operations:[{ skillName:'craft', params:{item:'iron_pickaxe', quantity:1} }] }

TaskManager.runNext():
  → SkillRegistry.loadSkill('craft', ctx) → new CraftSkill(ctx) ✓

CraftSkill.run({ item:'iron_pickaxe', quantity:1 }):
  → crafting.service.js: recipe lookup
  → Locates crafting table if needed
  → bot.craft(recipe, quantity, craftingTable) [Mineflayer API]
```

**Result:** OBSERVED IN SOURCE — craft is registered and path appears complete. Live success depends on recipe availability and materials in inventory (UNKNOWN / NOT TESTED in live gameplay).

---

## Trace 5: `go home`

**Input:** Player types `go home`

```
nlp.parse('go home') → Intent: { name:'go_home' }

commandPlanner._buildOperation('go_home', ...):
  → params.targetLocation = 'primary_base'
  → intentName === 'go_home' but no call to _resolveNamedLocation here
  → missing[] remains empty

⚠ Finding F03: If primary_base is not registered, plan.missing is not checked before dispatch.

TaskManager.runNext():
  → SkillRegistry.loadSkill('navigation', ctx) → NavigationSkill ✓
  → skill.run({ targetLocation:'primary_base' })

NavigationSkill.run({ targetLocation:'primary_base' }):
  → mode defaults to 'go_home' (no player, no position, no location resolved to coords)
  → _executeReturnHome():
    → ctx.nav.returnHome()
    → NavigationService.returnHome() → looks up primary base in LocationRegistry
    → If no base registered → [?] likely throws or returns { success:false }
```

**Result:** OBSERVED IN SOURCE — if no primary base is registered, `go home` will fail inside `NavigationService.returnHome()`. The plan-level `missing` check is absent (F03), so the error surfaces late inside the skill rather than being caught early with helpful feedback.

---

## Trace 6: `sort_inventory` (queued but unregistered skill)

**Input:** Player types `sort inventory`

```
nlp.parse('sort inventory') → Intent: { name:'sort_inventory' }

commandPlanner._buildOperation('sort_inventory', ...):
  → CommandSchemas['sort_inventory'] = { skillName:'inventory', isControl:false, locks:['inventory'] }
  → Returns op: { skillName:'inventory', isControl:false, ... }

plan.type = 'single' (not control)

UnifiedCommandGateway.execute():
  → plan is NOT control type → goes to taskManager.enqueue branch
  → taskManager.enqueue({ skillName:'inventory', ... })

TaskManager.runNext():
  → SkillRegistry.loadSkill('inventory', ctx)
  → ⚠ 'inventory' IS NOT in registry
  → THROWS: Error("[SkillRegistry] Skill 'inventory' is not registered. Available skills: [mine, farm, chop_tree, combat, craft, build, logistics, navigation]")
  → TaskManager catches error → task transitions to FAILED
  → messageRouter.send(3, "⚠️ Task [inventory] failed: [SkillRegistry] Skill 'inventory' is not registered...")
  → Player sees error message in chat
```

**Result:** OBSERVED IN SOURCE — `sort_inventory` and all other `skillName:'inventory'` commands will fail at dispatch with an explicit SkillRegistry error. Same pattern for `skillName:'locations'` commands that are not marked `isControl:true`. (Finding F01)

---

## Trace 7: `queue` (control intent with no handler)

**Input:** Player types `queue` (to view task queue)

```
nlp.parse('queue') → Intent: { name:'queue' }

CommandSchemas['queue'] = { skillName:'control', isControl:true }

commandPlanner → plan { type:'control', operations:[{intentName:'queue', isControl:true}] }

executeControlOperation(request, { intentName:'queue' }):
  → switch(op.intentName):
    case 'help': ... (not 'queue')
    case 'status': ... (not 'queue')
    ... [no case 'queue']
    default: break;
  → Returns CommandResponse.success("Control operation 'queue' executed.")
  ⚠ No actual queue was shown. Player receives false success. (Finding F02)
```

**Result:** OBSERVED IN SOURCE — `queue` and similar unhandled control intents (`cancel`, `list_bases`, `list_farms`, `list_mines`, `list_waypoints`, `who_has_access`, `security_log`, `quiet_mode_on`, `quiet_mode_off`, `dnd`, `dnd_off`, `show_macro`) all receive a spurious success message.

---

## Trace 8: `retrace_steps` (navigation mode mismatch)

**Input:** Player types `retrace steps` or `retrace`

```
nlp.parse('retrace steps') → Intent: { name:'retrace_steps' }

commandPlanner._buildOperation('retrace_steps', ...):
  → CommandSchemas['retrace_steps'] = { skillName:'navigation', isControl:false }
  → params built: no mode set for retrace_steps in _buildOperation
    (only 'follow', 'stop_following', 'go_home' get explicit mode params)
  → op.params = {} (or minimal params, no params.mode = 'retrace_steps')

TaskManager → SkillRegistry.loadSkill('navigation') → NavigationSkill

NavigationSkill.run(params = {}):
  → mode = params.mode || (params.player ? 'follow' : (params.position || params.location) ? 'go_to' : 'go_home')
  → params.mode is undefined, no player, no position → mode = 'go_home'
  ⚠ Falls back to go_home instead of retrace. (Finding F05)
```

**Result:** OBSERVED IN SOURCE — `retrace_steps` silently navigates home instead of retracing.

---

## Dashboard / REST Trace

**REST:** `POST /api/commands/execute { message:"status" }`
```
RestCommandAdapter → commandGateway.execute({ source:'rest', senderId:'dashboard', message:'status' })
→ Same pipeline as chat trace above
```

**WebSocket:** Dashboard sends command via WebSocket
```
DashboardCommandAdapter → commandGateway.execute({ source:'dashboard', ... })
→ Same pipeline
```

Both adapters feed the identical `UnifiedCommandGateway.execute()`. All findings apply equally.
