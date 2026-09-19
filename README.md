# Argus (Beta)

### An autonomous Minecraft Java Edition bot built around modular automation, persistent state, and self-directed behavior.

Argus is an independent side project built with **Mineflayer**. I started it after finding existing open-source Minecraft bots too limited for the level of automation I wanted to experiment with.

Instead of implementing a collection of isolated commands, I built Argus as a modular system where navigation, resource gathering, construction, combat, inventory management, task execution, persistence, and autonomous behavior work together.

> **Status:** 🟢 Released — independent side project
> **Edition:** Minecraft Java Edition
> **Framework:** Mineflayer
> **Author:** [Shreyansh Parganiha](https://github.com/SP2502)

---

## 🧠 What Makes Argus Different?

Argus is designed around a simple idea:

> **The bot should be able to maintain its state, understand its situation, execute tasks, recover from problems, and decide what to do next.**

The system combines:

* Modular subsystems
* Persistent state
* Task queues
* Natural-language commands
* Autonomous needs assessment
* Recovery mechanisms
* Context-aware combat
* Resource and inventory management
* Remote monitoring and control

The result is a bot that can move beyond individual commands and perform longer-running sequences of actions.

---

# ✨ Core Capabilities

## 🧭 Navigation

Argus uses Mineflayer's pathfinding ecosystem with an additional navigation layer.

**Capabilities include:**

* A* pathfinding
* Following players/entities
* Coordinate-based navigation
* Exploration
* Return-to-home behavior
* Stuck detection
* Automatic unstuck strategies
* Manual bridging
* Scaffold-based climbing
* Lava, fire, and magma avoidance
* Runtime movement configuration

The navigation system continuously checks whether the bot is actually progressing and can attempt recovery when movement becomes stuck.

---

## ⛏️ Mining

Mining is implemented as a dedicated subsystem rather than a single command.

### Ore intelligence

Argus maintains information about ores and their preferred mining depths, allowing the system to select appropriate Y-levels for targeted resources.

### Mining modes

* Vein mining
* Strip mining
* Cave mining
* Tunnel mining
* Targeted resource gathering

### Safety

Before digging, the system checks for hazards including:

* Lava
* Falling gravel/sand
* Unsafe blocks below the bot
* Insufficient lighting

It can automatically place torches when lighting falls below the configured threshold.

The mining system also monitors inventory capacity and can stop operations when the inventory becomes full.

---

# 🌾 Farming & Food

Argus contains a structured crop and animal system.

### Crops

The system models crop-specific information such as:

* Growth stages
* Maturity
* Light requirements
* Water requirements
* Bonemeal eligibility
* Harvest tools

It supports crops including wheat, carrots, potatoes, beetroot, pumpkin, melon, sugar cane, cactus, bamboo, sweet berries, and Nether wart.

### Automation

* Automatic harvesting
* Automatic replanting
* Bonemeal-assisted growth
* Tall-crop handling
* Animal breeding
* Sheep shearing
* Cow milking
* Food selection
* Automatic eating
* Furnace-based cooking

---

# 🏗️ Building & Repair

Argus can construct predefined structures and maintain existing structures.

### Building

The structure system supports templates for things such as:

* Houses
* Walls
* Bridges
* Farms
* Towers
* Shelters

Before construction, Argus can check:

* Ground stability
* Lava/water proximity
* Whether the build area is clear
* Available building materials

If the preferred material is unavailable, substitute-block logic can be used.

### Automated repair

Argus can scan its environment for structural damage, including:

* Crater-like damage
* Wall holes
* Missing doors
* Broken windows
* Roof damage

Detected damage can then trigger an automated repair routine.

---

# ⚔️ Combat

Combat is one of Argus's most detailed subsystems.

Rather than treating every hostile entity identically, the bot maintains mob-specific behavior and equipment information.

### Equipment intelligence

Argus evaluates weapons and armor using properties such as:

* Damage
* Attack speed
* DPS
* Durability
* Defense
* Toughness
* Knockback resistance

It can automatically equip the best available equipment.

### Mob-specific behavior

Different entities can trigger different tactics.

Examples include:

* Skeleton → ranged kiting
* Enderman → avoid eye contact
* Blaze → ranged/flying combat
* Ravager → kiting
* Evoker → close-distance attack
* Vex → flying combat
* Warden → immediate retreat

The combat system also includes:

* Strafe movement
* Critical-hit timing
* Shield usage
* Combat recovery
* Low-health retreat
* Combat statistics
* Stuck-in-combat recovery

---

## 🟢 Creeper Handling

Creepers receive their own dedicated combat behavior.

Argus can:

* Maintain a preferred safe distance
* Detect the creeper's hissing state
* Trigger emergency retreat
* Force additional retreat when extremely close
* Prefer ranged attacks when available
* Track successful creeper evasions

This is implemented separately from generic mob combat rather than being treated as another ordinary hostile entity.

---

# 🧠 Task Manager

Argus has a task-management layer between commands and the underlying systems.

Tasks can move through states such as:

```text
PENDING
   ↓
RUNNING
   ↓
COMPLETED

RUNNING → PAUSED
RUNNING → FAILED
```

The task system supports:

* Priorities
* Task queues
* Duration-based tasks
* Pause/resume
* Cancellation
* Emergency stopping
* Composite tasks
* Persistent task history

### Composite routines

Higher-level routines can combine multiple subsystems.

For example:

```text
Prepare for night
        ↓
Check shelter
        ↓
Cook food
        ↓
Craft equipment
        ↓
Craft torches
        ↓
Equip armor
```

This allows a single objective to orchestrate multiple independent systems.

---

# 💬 Natural-Language Commands

Argus includes a natural-language command layer based on pattern recognition and aliases.

Examples:

```text
mine 64 diamonds
repair base
follow me
return home
prepare for night
setup base
defend me
sort inventory
craft tools
```

The parser supports aliases, duration expressions, default quantities, and multiple command categories.

The integration layer expands this with **500+ regex patterns**, synonym handling, and contextual references.

---

# 🤖 Autonomous Mode

Autonomous mode is where the individual systems start behaving like one larger system.

Argus continuously evaluates its current state using a **Needs Assessment** layer.

It considers factors such as:

* ❤️ Health
* 🍖 Hunger
* ⛏️ Tool availability
* 📦 Resource stockpile
* 🏠 Shelter
* 🛡️ Defensive readiness

It then selects activities based on which needs require attention.

For example:

```text
                 World State
                      ↓
               Needs Assessment
                      ↓
              Priority Evaluation
                      ↓
       ┌──────────────┼──────────────┐
       ↓              ↓              ↓
   Critical         High           Normal
       ↓              ↓              ↓
   Recover        Gather/Craft    Explore/Fish
       │              │              │
       └──────────────┴──────────────┘
                      ↓
                 Execute Task
                      ↓
                Update State
                      ↓
                 Re-evaluate
```

Critical conditions can interrupt the currently selected activity.

The autonomous system can also initiate actions such as:

* Gathering resources
* Crafting essential tools
* Improving defense
* Building shelter
* Fishing
* Farming
* Exploring

User-issued tasks take precedence over autonomous behavior.

---

# 💾 Persistence & Memory

Argus maintains state across different parts of its operation.

Persistent/stateful information includes:

* Server-specific authentication profiles
* Configuration
* Death locations
* Task history
* Current operating mode
* Command history
* Combat history
* Player attack records
* Home position
* Explored positions
* Runtime logs
* Fishing statistics

For example, after a death, Argus can remember the location and attempt to navigate back toward the dropped items.

The project also maintains bounded runtime log history and writes logs asynchronously to disk.

---

# 🌐 Web Dashboard

Argus includes a web-based monitoring and control layer.

The dashboard can expose:

* Bot vitals
* Inventory
* Tasks
* Logs
* Nearby entities
* Performance information
* Server information
* Runtime state

A WebSocket connection provides real-time state and log updates.

The REST API also exposes controls for:

* Task management
* Autonomous mode
* Standby mode
* Mining
* Farming
* Fishing
* Waypoints
* Chat
* Movement
* Looking
* Jumping
* Server switching
* Emergency stopping

There is also a dedicated emergency/panic action capable of stopping active tasks and autonomous systems.

---

# 🛡️ Resilience

Argus is designed with long-running operation in mind.

It includes recovery mechanisms across multiple layers:

```text
Connection
   └── Auto-Reconnect

Navigation
   └── Stuck Detection → Recovery

Mining
   └── Hazard Detection → Abort / Recover

Combat
   └── Low Health → Retreat

Tasks
   └── Failure → Controlled Task State

Death
   └── Remember Location → Recovery Attempt

Process
   └── Shutdown → Save State + Flush Logs
```

The system also has global exception/rejection handling and graceful shutdown behavior.

---

# 🏛️ Architecture

Argus is divided into specialized modules.

```text
                         ARGUS
                           │
                 ┌─────────┴─────────┐
                 │ Global State / API │
                 └─────────┬─────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ↓                  ↓                  ↓
   Navigation           Mining            Farming
        │                  │                  │
        └──────────────┬───┴──────────────────┘
                       ↓
                  Building
                       │
                       ↓
                   Combat
                       │
                       ↓
               Inventory Manager
                       │
                       ↓
                 Task Manager
                       │
                       ↓
                Autonomous AI
                       │
                       ↓
             Dashboard / Web API
```

The architecture separates individual responsibilities while allowing the systems to share state and coordinate through the integration layer.

---

# 🧩 Technology

* **JavaScript**
* **Node.js**
* **Mineflayer**
* **mineflayer-pathfinder**
* **Express**
* **WebSocket**
* Minecraft Java Edition

---

# 📊 Project Scope

The current codebase contains **176 documented, code-backed features** spanning:

* Connection & lifecycle
* Authentication
* Persistence
* Navigation
* Mining
* Farming
* Building
* Combat
* Inventory
* Task management
* Natural-language interaction
* Autonomous behavior
* Chat
* Web dashboard
* Standby survival

The feature count is based on an exhaustive codebase analysis rather than a marketing estimate.

---

# 🎯 Why I Built It

Argus began as a side project.

I found existing open-source Minecraft bots relatively simple and wanted to see how much further I could take the idea by combining many independent automation systems into one coherent architecture.

The project became an experiment in:

* Modular software architecture
* Autonomous task execution
* State management
* Pathfinding
* Resource planning
* Recovery systems
* Long-running automation
* System integration

It is **not intended to represent academic research**. It is an engineering project built to explore these ideas in practice.

---

# 🚧 Project Status

Argus has been released publicly and is currently an independent side project.

Because the public release is recent, external usage and community feedback are still developing.

Future work will focus on testing, refinement, reliability, and improving the architecture based on real-world use.

---

# 👤 Author

## Shreyansh Parganiha

**Student · Researcher + Builder**

Interested in:

* Artificial Intelligence / Machine Learning
* Systems Engineering
* Autonomous Systems
* Software Architecture

[GitHub](https://github.com/SP2502)

---

## License

See [`LICENSE`](LICENSE) for licensing information.
