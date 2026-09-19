# Argus Autonomous Bot — Complete Bot Commands Manual

This document provides the complete, authoritative manual of **every single command and natural-language intent** supported by the **Argus Autonomous Minecraft Bot**.

---

## 1. Command Execution Modalities

Argus commands can be issued seamlessly across three distinct interfaces. Every interface routes through the central [UnifiedCommandGateway.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/src/modules/commands/UnifiedCommandGateway.js) for unified role-based authorization, rate limiting, and execution:

1. **In-Game Minecraft Chat**:
   Simply type natural-language sentences or direct keywords in public or private chat (e.g., `mine 32 iron then return home`).
2. **Web Dashboard Interactive Console**:
   Type commands directly into the terminal console at `http://localhost:3000`.
3. **HTTP REST API Endpoint**:
   Send an authenticated HTTP POST request to `/api/command`:
   ```bash
   curl -X POST http://localhost:3000/api/command \
     -H "Content-Type: application/json" \
     -d '{"message": "status", "sender": "ShadowPace"}'
   ```

---

## 2. Security Roles & Authorization Tiers

Every command enforces a minimum permission tier evaluated by [permission.service.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/src/modules/security/permission.service.js):

| Tier | Role | Description |
| :---: | :--- | :--- |
| **4** | **Owner** | Permanent bypass for `ShadowPace` (or `OWNER_USERNAME`). Cannot be demoted or blocked. Unrestricted access to macros, security grants, and emergency overrides. |
| **3** | **Admin** | High-level operations: dangerous commands, mining, building, combat hunting, base/mine registration, and user revocation. |
| **2** | **Trusted** | Work routines: navigation, guarding, crafting, inventory transfers, warehouse restocking, and sleep cycles. |
| **1** | **Guest** | Unregistered users by default: status queries, help, coordinates, inventory viewing, base listing. |
| **0** | **Blocked** | Banned/locked users: all commands strictly rejected. |

> [!NOTE]
> Non-owners are subject to a sliding rate limit of **10 commands per 60 seconds**.
> 3 failed authorization attempts within 5 minutes triggers an automatic **10-minute temporary lockout**.

---

## 3. Advanced Command Features

### 3.1 Compound / Chained Commands
Argus supports sequential workflows using the conjunctions `then`, `and`, or `,`:
```text
mine 32 diamonds then store all then go home
cut 64 oak wood then craft 16 chests and sort warehouse
```

### 3.2 Conversational Memory & Pronoun Disambiguation
Argus tracks conversational context up to 10 minutes. Pronouns like `them`, `it`, and `there` automatically resolve to previously mentioned items or locations:
```text
Player: Where is the iron ore?
Bot: Found 12 iron_ore at (120, -16, 45).
Player: Mine it
Bot: Queued task [mine]: {"targetOre":"iron_ore","quantity":12}
```

### 3.3 Two-Phase Confirmation for Dangerous Actions
Commands marked as destructive require an explicit sender-bound `yes` confirmation within 60 seconds:
```text
Player: drop all
Bot: ⚠️ WARNING: Dangerous operation requested [drop_all]. Reply 'yes' to proceed or 'no' to cancel within 60s.
Player: yes
Bot: Action confirmed. Executing drop_all.
```

---

## 4. Complete Command Reference by Category

### 4.1 Core & Telemetry Queries

Commands for querying bot state, health, and operational diagnostics.

| Intent | Min Role | Typical Phrasing / Triggers | Parameters |
| :--- | :---: | :--- | :--- |
| `help` | Guest | `help`, `commands`, `what can you do`, `show commands` | None |
| `status` | Guest | `status`, `how are you`, `what are you doing`, `info` | None |
| `where_are_you` | Guest | `where are you`, `coords`, `coordinates`, `current position` | None |
| `health_status` | Guest | `health`, `vitals`, `check safety`, `are you safe` | None |
| `uptime` | Guest | `uptime`, `how long have you been running`, `version` | None |

#### Examples:
```text
coords
how are you
what can you do
```

---

### 4.2 Mining & Resource Extraction (`mine`)

Autonomous ore prospecting, branch-mining, and vein excavation.
- **Resource Locks**: `movement`, `inventory`, `tool:pickaxe`
- **Safety Invariant**: Automatically equips a **water bucket in hotbar slot 6** before descending below $Y < 0$. Digging straight down or straight up is prohibited.

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `mine` | Admin | `mine {quantity?} {item?}`, `dig {item}`, `extract {item}`, `gather {item}` | `targetOre` (default: `diamond`), `quantity` (default: `64`), `yLevel` (default: optimal from ore data), `opportunistic` (default: `true`) |

#### Examples:
```text
mine 64 diamonds
dig 32 iron ore at y -16
extract gold
gather coal
```

---

### 4.3 Woodcutting & Forestry (`chop_tree`)

Autonomous log harvesting, tree species identification, and environmental replanting.
- **Resource Locks**: `movement`, `inventory`, `tool:axe`
- **Protection Guard**: [TreeAnalyzer.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/woodcutting/TreeAnalyzer.js) prevents chopping player-placed wood structures.

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `chop_tree` | Admin | `cut {quantity?} {treeType?} wood`, `chop {quantity?} trees`, `harvest logs`, `cut wood` | `treeType` (default: `any`), `quantity` (default: `64`), `replant` (default: `true`), `searchRadius` (default: `48`) |
| `set_forestry_replant` | Trusted | `enable replanting`, `disable replanting`, `plant saplings after cutting` | `replant` (`true`/`false`) |

#### Examples:
```text
cut 32 oak wood
chop 10 birch trees
harvest dark oak logs
cut wood near me
enable replanting
```

---

### 4.4 Farming & Agriculture (`farm`)

Autonomous cultivation, crop maturity scanning, harvesting, and replanting.
- **Resource Locks**: `movement`, `inventory`, `tool:hoe`
- **Safety Invariant**: Enforces the **16-seed reservation** rule to avoid exhausting seed stocks.

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `farm` | Admin | `farm {crop?}`, `harvest {crop?}`, `cultivate {crop?}`, `grow crops`, `reap {crop?}` | `targetCrop` (default: `wheat`), `useBoneMeal` (default: `true`) |

#### Supported Crops:
`wheat`, `carrot`, `potato`, `beetroot`, `melon`, `pumpkin`, `sugarcane`, `nether_wart`.

#### Examples:
```text
farm wheat
harvest carrots
cultivate potatoes
grow crops
```

---

### 4.5 Combat & Tactical Defense

Hostile mob hunting, ally protection, and perimeter patrolling.
- **Resource Locks**: `movement`, `combat`, `inventory`, `tool:weapon`
- **Tactical AI**: Automatically kites and strafes Creepers; blocks Skeleton arrows with off-hand shield. Friendly players, villagers, iron golems, and passive animals are strictly protected.

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `combat` | Admin | `kill {quantity?} {mobType?}`, `hunt {mobType}`, `slay {mobType}`, `clear hostiles`, `clear monsters` | `mode`: `hunt`, `targetMob` (default: `any`), `quantity` (default: `10`), `searchRadius` (default: `32`) |
| `guard` | Trusted | `protect {player?}`, `protect me`, `guard me`, `defend base`, `guard {player}` | `mode`: `guard`, `player` or `location` |
| `patrol` | Admin | `patrol {location?}`, `patrol base`, `patrol perimeter`, `patrol outpost` | `mode`: `patrol`, `location` |

#### Examples:
```text
kill 5 zombies
hunt skeletons
clear hostiles
protect me
guard ShadowPace
patrol base
```

---

### 4.6 Building & Construction (`build`)

Autonomous procedural construction of architectural blueprints.
- **Resource Locks**: `movement`, `inventory`, `building`, `tool:shovel`, `tool:pickaxe`
- **Safety Invariant**: Emits a `building.checkpoint` every 50 blocks. Automatically erects and dismantles temporary scaffolding.

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `build` | Admin | `build {structure} with {material}`, `construct {dimensions} {structure}`, `erect {structure}` | `structure` (`wall`, `floor`, `box`, `shelter`, `stairs`), `material` (default: `cobblestone`), `dimensions` (`length`, `width`, `height`) |

#### Examples:
```text
build emergency shelter
build 10x4 wall with cobblestone
build 5x5 floor with oak_planks
construct stairs with stone_bricks
```

---

### 4.7 Crafting & Smelting (`craft`, `smelt`)

Recipe tree resolution and furnace fuel management.
- **Resource Locks**: `inventory`, `movement`
- Solves recursive prerequisite graphs (e.g., crafting a chest will automatically craft oak planks from logs if needed).

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `craft` | Trusted | `craft {quantity?} {item}`, `make {quantity?} {item}`, `forge {item}` | `item`, `quantity` (default: `1`) |
| `smelt` | Trusted | `smelt {quantity?} {item} with {fuel?}`, `cook {quantity?} {item}` | `item`, `quantity` (default: `1`), `fuel` (default: optimal fuel) |

#### Examples:
```text
craft 4 iron_pickaxes
make 16 torches
craft crafting_table
smelt 32 iron_ore with coal
cook 16 beef
```

---

### 4.8 Logistics & Warehouse Management

Warehouse chest spatial indexing, automated inventory sorting, and kit restocking.
- **Resource Locks**: `movement`, `inventory`, `warehouse`

| Intent | Min Role | Phrasing / Triggers | Parameters & Defaults |
| :--- | :---: | :--- | :--- |
| `sort_warehouse` | Trusted | `sort warehouse`, `sort chests`, `organize base`, `deposit to warehouse` | `mode`: `sort` |
| `restock` | Trusted | `restock {kit?}`, `resupply {kit?}`, `get supplies`, `restock kit {kit}` | `kit` (`miner`, `warrior`, `farmer`, `woodcutter`, `default`) |
| `index_chests` | Admin | `index chests`, `scan warehouse`, `audit storage`, `catalog warehouse` | `radius` (default: `24`) |
| `find_item` | Guest | `find item {item}`, `where is {item}`, `locate {item}`, `search for {item}` | `item` |

#### Examples:
```text
sort warehouse
restock miner
index chests
find diamond_sword
where is iron_ingot
```

---

### 4.9 Inventory Management

Managing the bot's direct 36-slot inventory, hotbar organization, chest deposits, and item drops.
- **Resource Locks**: `inventory`, `movement`

| Intent | Min Role | Phrasing / Triggers | Destructive? | Parameters |
| :--- | :---: | :--- | :---: | :--- |
| `show_inventory` | Guest | `inventory`, `inv`, `show inventory`, `what are you carrying` | No | None |
| `sort_inventory` | Trusted | `sort inventory`, `compact inventory`, `tidy inventory` | No | None |
| `store_all` | Trusted | `store all`, `deposit all`, `dump inventory`, `stash all` | No | `category` (default: `all`) |
| `store_item` | Trusted | `store {quantity?} {item}`, `deposit {item}`, `stash {item}` | No | `item`, `quantity` |
| `retrieve_item` | Trusted | `retrieve {quantity?} {item}`, `withdraw {item}`, `take {item} from chest` | No | `item`, `quantity` (default: `1`) |
| `drop_item` | Trusted | `drop {quantity?} {item}`, `discard {item}`, `throw out {item}` | Conditional | `item`, `quantity` (default: `1`) |
| `drop_all` | Admin | `drop all`, `drop everything`, `dump inventory on ground` | **YES** | Requires `yes` confirmation |

#### Examples:
```text
inv
sort inventory
store all
store 32 coal
retrieve 16 bread
drop 64 cobblestone
drop all
```

---

### 4.10 Navigation & Movement

Spatial waypoint navigation, player tracking, and return-home routines.
- **Resource Locks**: `movement`
- Controlled exclusively by [navigation.service.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/src/modules/navigation/navigation.service.js) with dynamic hazard avoidance.

| Intent | Min Role | Phrasing / Triggers | Parameters |
| :--- | :---: | :--- | :--- |
| `go_to` | Trusted | `go to {location}`, `travel to {location}`, `head to {x y z}` | `location` (named waypoint, player name, or `x y z`) |
| `go_home` | Trusted | `go home`, `return home`, `head home`, `return to base` | `targetLocation`: `primary_base` |
| `follow` | Trusted | `follow {player?}`, `follow me`, `come with me`, `come here` | `player` (defaults to command issuer) |
| `stop_following` | Trusted | `stop following`, `stay here`, `stay`, `unfollow` | None |
| `retrace_steps` | Trusted | `retrace steps`, `go back`, `retrace` | None |

#### Examples:
```text
go to base
go to 150 64 -220
follow me
stay here
return home
retrace steps
```

---

### 4.11 Task Scheduler & Concurrency Control

Direct control over [TaskManager.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/src/core/TaskManager.js) and active background skills.

| Intent | Min Role | Phrasing / Triggers | Description |
| :--- | :---: | :--- | :--- |
| `stop` | Trusted | `stop`, `halt`, `pause`, `wait`, `hold on` | Pauses the scheduler and current task |
| `resume` | Trusted | `resume`, `continue`, `unpause`, `keep going` | Resumes a suspended or paused task |
| `cancel` | Trusted | `cancel`, `cancel current`, `abort task` | Aborts current active task and releases locks |
| `stop_all` | Admin | `stop all`, `cancel all`, `clear queue`, `emergency stop` | **Emergency stop**: Purges queue and stops all actions |
| `queue` | Guest | `queue`, `show queue`, `tasks`, `list tasks` | Displays all pending and running tasks |

#### Examples:
```text
pause
resume
cancel
queue
stop all
```

---

### 4.12 Spatial Registry & Waypoints

Creating and managing named spatial coordinates for bases, farms, mines, and navigation points.

| Intent | Min Role | Phrasing / Triggers | Destructive? | Parameters |
| :--- | :---: | :--- | :---: | :--- |
| `register_base` | Admin | `register base {name?}`, `set base {name}`, `save base` | No | `name`, `coordinates` (defaults to bot pos) |
| `list_bases` | Guest | `list bases`, `show bases`, `bases` | No | None |
| `register_farm` | Admin | `register farm {name?}`, `set farm {name}` | No | `name`, `crop`, `coordinates` |
| `list_farms` | Guest | `list farms`, `show farms`, `farms` | No | None |
| `register_mine` | Admin | `register mine {name?}`, `set mine {name}` | No | `name`, `coordinates` |
| `list_mines` | Guest | `list mines`, `show mines`, `mines` | No | None |
| `set_waypoint` | Trusted | `set waypoint {name}`, `waypoint {name}` | No | `name`, `coordinates` |
| `list_waypoints`| Guest | `list waypoints`, `show waypoints`, `waypoints` | No | None |
| `remove_waypoint` | Admin | `remove waypoint {name}`, `delete waypoint {name}` | **YES** | `name` (Requires confirmation) |

#### Examples:
```text
register base main_outpost
set waypoint village_portal
list bases
list waypoints
remove waypoint old_tunnel
```

---

### 4.13 Security & RBAC Administration

Managing user roles, permissions, audit history, and security lockouts.

| Intent | Min Role | Phrasing / Triggers | Destructive? | Parameters |
| :--- | :---: | :--- | :---: | :--- |
| `grant_permission` | Owner | `grant {player} {role}`, `give {player} {role} for {duration}` | No | `player`, `role` (`admin`, `trusted`, `guest`), `duration` |
| `revoke_permission`| Admin | `revoke {player}`, `demote {player}`, `block {player}`, `ban {player}` | **YES** | `player` (Demotes to blocked) |
| `who_has_access` | Admin | `who has access`, `list permissions`, `users`, `show roles` | No | None |
| `security_log` | Admin | `security log`, `audit log`, `show audit`, `recent attempts` | No | None |

#### Examples:
```text
grant Alex trusted
grant Bob admin for 2 hours
revoke Steve
who has access
security log
```

---

### 4.14 Communication & Chat Quiet Modes

Toggling bot chat chattiness, whispers, and Do-Not-Disturb modes.

| Intent | Min Role | Phrasing / Triggers | Description |
| :--- | :---: | :--- | :--- |
| `quiet_mode_on` | Trusted | `quiet mode on`, `quiet on`, `be quiet`, `silence`, `shh` | Suppresses non-essential chat announcements |
| `quiet_mode_off` | Trusted | `quiet mode off`, `quiet off`, `speak`, `unmute` | Restores normal public chat responses |
| `dnd` | Trusted | `dnd for {duration}`, `do not disturb`, `dnd` | Ignores low-priority alerts for a time window |
| `dnd_off` | Trusted | `dnd off`, `disable dnd`, `cancel dnd` | Disables Do-Not-Disturb mode |

#### Examples:
```text
be quiet
unmute
dnd for 30 minutes
dnd off
```

---

### 4.15 Macros & Automation Scripting

Creating, inspecting, and running reusable multi-step automation routines.

| Intent | Min Role | Phrasing / Triggers | Destructive? | Parameters |
| :--- | :---: | :--- | :---: | :--- |
| `create_macro` | Owner | `create macro {name}: {steps}`, `macro {name}: {steps}` | No | `name`, `steps` (semicolon/then separated) |
| `run_macro` | Trusted | `run macro {name}`, `execute {name}`, `run {name}` | No | `name`, optional params |
| `list_macros` | Guest | `list macros`, `show macros`, `macros` | No | None |
| `show_macro` | Guest | `show macro {name}`, `view macro {name}` | No | `name` |
| `delete_macro` | Owner | `delete macro {name}`, `remove macro {name}` | **YES** | `name` (Requires confirmation) |

#### Examples:
```text
create macro morning_routine: wake; farm wheat; store all; restock miner
run macro morning_routine
list macros
show macro morning_routine
delete macro morning_routine
```

---

### 4.16 Ambient & Sleep Cycles

Toggling autonomous idle routines, bed sleeping at night, and waking up.

| Intent | Min Role | Phrasing / Triggers | Description |
| :--- | :---: | :--- | :--- |
| `ambient_mode` | Trusted | `enable ambient`, `disable ambient`, `toggle ambient` | Toggles autonomous chores while idle |
| `sleep` | Trusted | `sleep`, `go to bed`, `take a nap`, `sleep in bed` | Finds nearest registered or discovered bed and sleeps |
| `wake` | Guest | `wake up`, `wake`, `get up`, `leave bed` | Immediately exits bed |

#### Examples:
```text
sleep
wake up
enable ambient
toggle ambient
```

---

## 5. Command Quick Reference Cheat Sheet

| Category | Command Phrasing Example | Role Tier | Destination Skill |
| :--- | :--- | :---: | :--- |
| **Status** | `status`, `coords`, `health`, `uptime` | Guest | Core Subsystem |
| **Help** | `help`, `commands` | Guest | Core Subsystem |
| **Mining** | `mine 64 iron`, `dig diamonds at y -59` | Admin | [MineSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/mining/MineSkill.js) |
| **Woodcutting**| `cut 32 oak wood`, `chop 10 trees` | Admin | [ChopTreeSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/woodcutting/ChopTreeSkill.js) |
| **Farming** | `farm wheat`, `harvest potatoes` | Admin | [FarmSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/farming/FarmSkill.js) |
| **Combat** | `kill 5 zombies`, `hunt spiders` | Admin | [CombatSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/combat/CombatSkill.js) |
| **Defense** | `protect me`, `guard base`, `patrol` | Trusted | [CombatSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/combat/CombatSkill.js) |
| **Building** | `build emergency shelter`, `build 10x3 wall`| Admin | [BuildSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/building/BuildSkill.js) |
| **Crafting** | `craft 4 pickaxes`, `smelt 32 iron with coal` | Trusted | [CraftSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/crafting/CraftSkill.js) |
| **Logistics** | `sort warehouse`, `restock miner`, `find diamond` | Trusted | [LogisticsSkill.js](file:///c:/Users/kkpcs/Downloads/ArgusMain/skills/logistics/LogisticsSkill.js) |
| **Inventory** | `inv`, `store all`, `drop 64 cobblestone` | Trusted | Inventory Service |
| **Navigation** | `go to base`, `follow me`, `return home` | Trusted | Navigation Service |
| **Tasks** | `pause`, `resume`, `cancel`, `queue`, `stop all` | Trusted/Admin | Task Manager |
| **Locations** | `register base outpost`, `set waypoint portal` | Trusted/Admin | Location Registry |
| **Security** | `grant Alex trusted`, `revoke Bob`, `who has access`| Admin/Owner | Permission Manager |
| **Macros** | `create macro ...`, `run macro morning_routine`| Trusted/Owner | Macro Engine |
| **Ambient** | `sleep`, `wake up`, `enable ambient` | Trusted/Guest | Ambient Service |
