# Mermaid Diagrams — Source-Based Architecture Diagrams

This folder contains architecture diagrams in Mermaid format, all grounded in the actual source code at commit `97f0ba6016b170eb48762b1651481f5051e1bbd1`.

---

## Available Diagrams

### In [`01_SYSTEM_ARCHITECTURE.md`](../01_SYSTEM_ARCHITECTURE.md)

**Diagram 1: High-Level Component Map** (flowchart TD)
Shows the full flow from Minecraft Server → MinecraftChatAdapter → UnifiedCommandGateway → TaskManager → SkillRegistry → Skills → Mineflayer APIs.

**Diagram 2: BotContext DI Container** (described in table form)
All service references and their types.

### In [`07_REPAIR_ORDER_FOR_CODEX.md`](../07_REPAIR_ORDER_FOR_CODEX.md)

**Diagram 3: Phase Dependency Graph** (flowchart TD)
Shows which repair phases must complete before others can begin.

---

## To Render These Diagrams

Paste any `mermaid` code block into:
- [https://mermaid.live](https://mermaid.live)
- VS Code with Mermaid Preview extension
- Any Markdown renderer supporting Mermaid

---

## Task State Machine (Additional Diagram)

```mermaid
stateDiagram-v2
    [*] --> PENDING : enqueue()
    PENDING --> QUEUED : dependency met, lock acquired
    PENDING --> BLOCKED : dependency not complete
    BLOCKED --> QUEUED : dependency resolves
    QUEUED --> STARTING : runNext() dequeues
    STARTING --> RUNNING : skill.run() begins
    RUNNING --> SUCCESS : run() returns
    RUNNING --> FAILED : unhandled error (after retries)
    RUNNING --> SUSPENDED : SkillSuspended thrown
    RUNNING --> CANCELLED : cancelTask() called
    FAILED --> PENDING : retry (retryCount <= maxRetries)
    SUSPENDED --> QUEUED : re-enqueued with checkpoint
    SUCCESS --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
```

## Command Pipeline Sequence

```mermaid
sequenceDiagram
    participant MC as Minecraft Chat
    participant CA as ChatAdapter
    participant GW as CommandGateway
    participant NLP as IntentParser
    participant CP as CommandPlanner
    participant PM as PermissionManager
    participant TM as TaskManager
    participant SR as SkillRegistry
    participant SK as Skill

    MC->>CA: chat event (username, message)
    CA->>CA: online player check
    CA->>GW: execute(request)
    GW->>GW: normalize, length check
    GW->>PM: checkRateLimit(senderId)
    GW->>NLP: parse(normalized)
    NLP-->>GW: { intents, entities }
    GW->>CP: plan(parseResult)
    CP-->>GW: { operations, ambiguities, missing }
    GW->>GW: check ambiguities
    Note over GW: ⚠ plan.missing NOT checked (F03)
    GW->>PM: checkPermission(senderId, requiredPermission)
    alt isControl
        GW->>GW: executeControlOperation()
        Note over GW: ⚠ default returns false success (F02)
    else skill task
        GW->>TM: enqueue(taskDef)
        TM->>SR: loadSkill(skillName)
        Note over SR: ⚠ 'inventory','locations' throw (F01)
        SR-->>TM: skill instance
        TM->>SK: skill.run(params)
        SK-->>TM: result
    end
    GW-->>CA: CommandResponse
    CA-->>MC: bot.chat(response)
```
