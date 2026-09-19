# Argus Dashboard: Telemetry & Data Contract Specification

## Overview
This document defines the interface contracts between the Argus Bot backend (Node.js runtime) and the Dashboard frontend operations console, covering all REST endpoints, WebSocket streams, schemas, fallback behaviors, and security redaction policies.

---

## 1. REST Endpoints

### 1.1 `GET /api/status`
- **Authentication**: Bearer Token required.
- **Payload Schema**:
  ```json
  {
    "username": "ArgusIntegrationBot",
    "health": 20,
    "food": 20,
    "position": { "x": 50.0, "y": 64.0, "z": -100.0 },
    "dimension": "overworld",
    "currentTask": "ChopTreeSkill"
  }
  ```
- **Fallback**: If unpopulated, returns `{ username: "Argus", health: 20, food: 20, position: { x: 0, y: 64, z: 0 } }`.

### 1.2 `GET /api/nav-status`
- **Payload**:
  ```json
  {
    "isFollowing": false,
    "isStuck": false,
    "currentGoal": { "x": 100, "y": 64, "z": -50 }
  }
  ```

### 1.3 `GET /api/inv-status`
- **Payload**:
  ```json
  {
    "usedSlots": 14,
    "totalSlots": 36,
    "isFull": false,
    "topValueItems": []
  }
  ```

### 1.4 `GET /api/tool-status`
- **Payload**:
  ```json
  {
    "bestPickaxe": "iron_pickaxe",
    "bestAxe": "diamond_axe",
    "bestSword": "iron_sword",
    "isAboutToBreak": false
  }
  ```

### 1.5 `GET /api/safety-status`
- **Payload**:
  ```json
  {
    "isCritical": false,
    "isLowHealth": false,
    "isLowHunger": false,
    "isNearLava": false,
    "shouldRetreat": false
  }
  ```

### 1.6 Operational Domain Statistics (`GET /api/stats/{domain}`)
Supports: `woodcutting`, `combat`, `crafting`, `building`, `logistics`, `ambient`.
- **Response Format**: `{ "ok": true, "stats": { ... } }`
- **Missing Data Policy**: If a domain has recorded 0 operations in the current session, the backend returns clean zero-initialized telemetry rather than null, and the UI displays an explicit ready empty state explaining that metrics will accumulate once directives are dispatched.

### 1.7 `GET /api/commands/history?limit=50`
- **Payload**:
  ```json
  {
    "ok": true,
    "history": [
      {
        "timestamp": "2026-09-17T14:30:00.000Z",
        "senderId": "DashboardOwner",
        "role": "owner",
        "message": "mine 16 iron_ore",
        "status": "OK"
      }
    ]
  }
  ```

---

## 2. WebSocket Streaming Events

Bi-directional WebSocket streaming over `ws://<host>/?token=<session_token>`.

### Broadcast Event Types
| Event Type | Direction | Payload Structure | UI Handler |
| :--- | :--- | :--- | :--- |
| `ping` / `pong` | Both | `{ "type": "ping" }` &rarr; `{ "type": "pong", "timestamp": number }` | Calculates stream latency (ms) |
| `init` | Server &rarr; Client | `{ "data": status, "platform": info, "auth": auth }` | Initializes session state |
| `bot.position.update` | Server &rarr; Client | `{ "data": { "x": number, "y": number, "z": number, "yaw": number } }` | Updates SVG radar & coordinates |
| `bot.health.change` | Server &rarr; Client | `{ "data": { "health": number, "food": number } }` | Updates vitals |
| `inventory.changed` | Server &rarr; Client | `{ "data": { "slots": Array<Item> } }` | Re-renders 36-slot inventory matrix |
| `task.started` / `task.completed` | Server &rarr; Client | `{ "data": { "name": string, "skill": string } }` | Updates Task Center & task strip |
| `log.entry` | Server &rarr; Client | `{ "data": { "severity": string, "category": string, "message": string } }` | Appends to Observability stream |
| `dashboard.command` | Client &rarr; Server | `{ "type": "dashboard.command", "message": string }` | Dispatches user directive |
| `dashboard.command.result` | Server &rarr; Client | `{ "data": { "ok": boolean, "status": string, "message": string } }` | Outputs result in Command Deck |

---

## 3. Strict Security & Redaction Policy

1. **Credential Elimination**:
   - `DASHBOARD_PASSWORD` is never transmitted to the client, never logged, and never included in error payloads.
   - `DASHBOARD_SESSION_SECRET` is never exposed in any route response or audit record.
   - Server in-game passwords registered via `/register` or `/login` are automatically filtered and masked as `[PROTECTED]` in all logs before transmission.
2. **Session Lifetimes**:
   - Tokens expire based on `DASHBOARD_SESSION_TTL_MS` (default: 1 hour).
   - The UI provides an explicit "Revoke Session" action which destroys tokens in memory, `sessionStorage`, and `localStorage`, immediately triggering the in-page lock screen.
