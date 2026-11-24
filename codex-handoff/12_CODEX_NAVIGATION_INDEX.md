# 12 — Codex Navigation Index
**Commit:** `97f0ba6016b170eb48762b1651481f5051e1bbd1`

Quick lookup table: "To fix X, open these files."

---

## By Finding

| Finding | Files to Open | Key Symbols |
|---|---|---|
| **F01** — inventory/locations skill not registered | `src/modules/commands/CommandSchemas.js` (skillName field), `src/core/SkillRegistry.js` (registry object), `src/modules/commands/UnifiedCommandGateway.js` (executeControlOperation) | `registry`, `loadSkill()`, `executeControlOperation()` |
| **F02** — false success for unhandled control intents | `src/modules/commands/UnifiedCommandGateway.js` (executeControlOperation switch), `src/modules/commands/CommandSchemas.js` (isControl entries) | `executeControlOperation()`, `default: break` |
| **F03** — plan.missing not checked | `src/modules/commands/UnifiedCommandGateway.js` (execute method, after ambiguities check) | `plan.missing`, `execute()` |
| **F04** — combat scanner reads wrong field | `index.js` (setInterval 500ms block after bot spawn) | `botContext.taskManager.currentTask` → `botContext.taskManager.activeTask` |
| **F05** — retrace_steps no mode set | `src/modules/commands/CommandPlanner.js` (_buildOperation method), `src/modules/navigation/navigation.skill.js` (run method) | `_buildOperation()`, `params.mode`, `NavigationSkill.run()` |
| **F06** — cancelTask race | `src/core/TaskManager.js` (cancelTask method), `src/core/base.skill.js` (abort method) | `cancelTask()`, `skill.abort()`, `activeTask` |
| **F07** — queue persistence ordering | `src/core/TaskManager.js` (_transition, _persistQueue methods) | `_persistQueue()`, `_transition()` |
| **F08** — hotbar slot invariant weak | `src/modules/mining/mining.skill.js` (run method, invariant check), `src/modules/inventory/inventory.service.js` (organizeHotbar, hasItem) | `hasItem('water_bucket')`, `organizeHotbar()`, `bot.inventory.slots[42]` |
| **F09** — doc conflict | `docs/RELEASE_NOTES.md`, `docs/ARGUS_COMPLIANCE_MATRIX.md`, `docs/FEATURE_READINESS.md`, `docs/TESTING.md` | — |
| **F10** — command ingestion diagnostic | `index.js` (spawn handler, bot.on('chat')), `src/modules/commands/adapters/MinecraftChatAdapter.js` (_handlePlayerMessage), `src/modules/security/permission.service.js` (checkPermission), `.env.example` | `_handlePlayerMessage()`, `bot.players`, `OWNER_USERNAME` |

---

## By Feature Area

### Chat → Command Pipeline
1. `index.js` → `initBot()` → `bot.on('spawn')` → `new BotContext(bot)`, `chatAdapter.attach()`
2. `src/modules/commands/adapters/MinecraftChatAdapter.js` → `attach()`, `_handlePlayerMessage()`
3. `src/modules/commands/UnifiedCommandGateway.js` → `execute()`
4. `src/modules/nlp/IntentParser.js` → `parse()`
5. `src/modules/commands/CommandPlanner.js` → `plan()`
6. `src/core/TaskManager.js` → `enqueue()`, `runNext()`
7. `src/core/SkillRegistry.js` → `loadSkill()`

### Authorization
1. `src/modules/security/permission.service.js` → `PermissionManager.checkPermission()`
2. `src/modules/security/command-policies.js` → prefix policy, max length
3. `.env.example` → `OWNER_USERNAME`

### Navigation
1. `src/modules/navigation/navigation.skill.js` → `NavigationSkill.run()`
2. `src/modules/navigation/navigation.service.js` → `NavigationService.goTo()`, `followEntity()`, `returnHome()`, `retracePath()`
3. `src/modules/navigation/locations.repository.js` → `LocationRegistry.listByType()`, `registerLocation()`
4. `src/modules/commands/CommandPlanner.js` → `_buildOperation()` follow/go_to/go_home params

### Mining
1. `src/modules/mining/mining.skill.js` → `MineSkill.run()`
2. `src/modules/mining/mining.data.js` → ore Y-levels, block names
3. `src/modules/inventory/inventory.service.js` → `organizeHotbar()`, `hasItem()`, `isFull()`
4. `src/shared/services/tool.service.js` → `equipBest()`, `getBestTool()`
5. `src/shared/services/safety.service.js` → `shouldRetreat()`, `isCritical()`

### Inventory/Crafting
1. `src/modules/inventory/inventory.service.js` → `InventoryService`
2. `src/modules/inventory/crafting.service.js` → `CraftingService`
3. `src/modules/inventory/crafting.skill.js` → `CraftSkill`
4. `src/modules/inventory/chest-interaction.js` → `ChestInteraction`

### Combat
1. `src/modules/combat/combat.skill.js` → `CombatSkill`
2. `src/modules/combat/combat.service.js` → `CombatService.getImmediateThreat()`, `defendAgainst()`
3. `src/modules/combat/combat.policy.js` → whitelist, friendly fire
4. `src/modules/combat/mob-tactics.js` → per-mob tactics
5. `index.js` → 500ms combat scan setInterval (⚠ F04)

### Task Scheduling
1. `src/core/TaskManager.js` → `enqueue()`, `runNext()`, `cancelTask()`, `cancelAll()`
2. `src/core/LockManager.js` → `acquireLocks()`, `releaseLocks()`
3. `src/core/AIBrain.js` → `evaluateTick()` calls `taskManager.runNext()`

### Dashboard
1. `src/modules/dashboard/api/server.js` → `startServer()`
2. `src/modules/dashboard/api/websocket.js` → WebSocket broadcast
3. `src/modules/dashboard/api/routes/` → REST route handlers
4. `src/modules/dashboard/session-auth.js` → `verifySessionToken()`

### Persistence
1. `src/shared/persistence/persistence-manager.js` → `saveData()`, `loadData()`, `saveState()`
2. `src/shared/persistence/state-store.js` → MongoDB connect/disconnect

---

## Key Class/Function Symbol Index

| Symbol | File | Purpose |
|---|---|---|
| `bootstrap()` | `index.js` | App startup |
| `initBot()` | `index.js` | Mineflayer bot creation |
| `BotContext` | `src/core/BotContext.js` | DI container constructor |
| `BotContext.getStatus()` | `src/core/BotContext.js` | Health snapshot for dashboard |
| `AIBrain.start()` | `src/core/AIBrain.js` | Starts tick loop |
| `AIBrain.evaluateTick()` | `src/core/AIBrain.js` | Per-tick decision logic |
| `TaskManager.enqueue()` | `src/core/TaskManager.js` | Add task to queue |
| `TaskManager.runNext()` | `src/core/TaskManager.js` | Execute next queued task |
| `TaskManager.cancelTask()` | `src/core/TaskManager.js` | Cancel by task ID |
| `TaskManager.activeTask` | `src/core/TaskManager.js` | Authoritative running task |
| `SkillRegistry.loadSkill()` | `src/core/SkillRegistry.js` | Instantiate skill by name |
| `UnifiedCommandGateway.execute()` | `src/modules/commands/UnifiedCommandGateway.js` | Main command entry point |
| `UnifiedCommandGateway.executeControlOperation()` | `src/modules/commands/UnifiedCommandGateway.js` | Handles isControl:true intents |
| `CommandPlanner.plan()` | `src/modules/commands/CommandPlanner.js` | NLP → executable plan |
| `CommandPlanner._buildOperation()` | `src/modules/commands/CommandPlanner.js` | Per-intent params builder |
| `MinecraftChatAdapter.attach()` | `src/modules/commands/adapters/MinecraftChatAdapter.js` | Register chat listeners |
| `MinecraftChatAdapter._handlePlayerMessage()` | `src/modules/commands/adapters/MinecraftChatAdapter.js` | Message → gateway |
| `PermissionManager.checkPermission()` | `src/modules/security/permission.service.js` | RBAC check |
| `PermissionManager.checkRateLimit()` | `src/modules/security/permission.service.js` | Rate limit enforcement |
| `NavigationSkill.run()` | `src/modules/navigation/navigation.skill.js` | Navigation entry point |
| `MineSkill.run()` | `src/modules/mining/mining.skill.js` | Mining entry point |
| `BaseSkill.abort()` | `src/core/base.skill.js` | Signal skill to stop |
| `BaseSkill.safetyCheckLoop()` | `src/core/base.skill.js` | Health/hunger check in skills |
| `InventoryService.organizeHotbar()` | `src/modules/inventory/inventory.service.js` | Sort items into hotbar slots |
| `InventoryService.hasItem()` | `src/modules/inventory/inventory.service.js` | Check item in any slot |
| `SafetyService.isCritical()` | `src/shared/services/safety.service.js` | True if health < 6 |
| `SafetyService.shouldRetreat()` | `src/shared/services/safety.service.js` | Retreat decision |
| `LocationRegistry.listByType()` | `src/modules/navigation/locations.repository.js` | List locations by type |
| `MessageRouter.respondToCommand()` | `src/shared/communication/MessageRouter.js` | Send command response to chat |
| `persistenceManager.saveData()` | `src/shared/persistence/persistence-manager.js` | Write JSON file |

---

## Minimal Context Path for Codex

To understand the full command flow without reading everything:

```
1. index.js (lines ~bot.on('spawn')) — see BotContext construction and adapter attach
2. src/core/BotContext.js — all service references
3. src/modules/commands/adapters/MinecraftChatAdapter.js — _handlePlayerMessage
4. src/modules/commands/UnifiedCommandGateway.js — execute() and executeControlOperation()
5. src/modules/commands/CommandSchemas.js — full intent registry
6. src/modules/commands/CommandPlanner.js — _buildOperation()
7. src/core/TaskManager.js — enqueue() and runNext()
8. src/core/SkillRegistry.js — loadSkill()
9. [target skill file] — run()
```

This chain covers 90% of the repair work in Phases 1–3.
