# Argus REST & WebSocket API Specification

Argus exposes a full RESTful interface and WebSocket event streaming server on port `3000` (or `process.env.API_PORT`).

## Authentication

### Dashboard Login
- **Endpoint**: `POST /api/auth/login`
- **Body**: `{ "username": "Admin", "password": "your_password" }`
- **Response**: `{ "ok": true, "token": "<HMAC_TOKEN>", "role": "owner" }`

### REST Command Execution
Pass your API token or key via headers:
- `Authorization: Bearer <HMAC_TOKEN>` OR
- `x-api-key: <CONFIGURED_API_KEY>`

---

## Endpoints

### 1. System Telemetry & Health
- `GET /api/status`
  - Returns bot vitals, health, hunger, coordinates, active task, and tick rate.
- `GET /api/health`
  - Returns subsystem ping statuses and heartbeat metrics.
- `GET /api/queue`
  - Returns task queue snapshot, active task, and held resource locks.
- `GET /api/inventory`
  - Returns 36-slot inventory layout, fullness ratio, and highest value items.
- `GET /api/logs`
  - Returns the latest 100 structured log entries.

### 2. Command Dispatching
- `POST /api/commands`
  - **Body**: `{ "message": "mine 64 diamonds", "source": "api" }`
  - **Response**:
    ```json
    {
      "ok": true,
      "status": "queued",
      "taskId": "task_1680000000_abcde",
      "command": "mine",
      "params": { "targetOre": "diamond", "quantity": 64 }
    }
    ```

### 3. Task Management
- `POST /api/tasks/pause`
- `POST /api/tasks/resume`
- `DELETE /api/tasks/:taskId`
- `DELETE /api/tasks` (Emergency Stop)

---

## WebSocket Telemetry Streaming

Connect via `ws://localhost:3000/ws`.

Streams JSON messages in real time:
- `{ "type": "vitals", "data": { "health": 20, "food": 20, "position": { "x": 0, "y": 64, "z": 0 } } }`
- `{ "type": "log", "data": { "severity": "INFO", "category": "TASK", "message": "..." } }`
- `{ "type": "task", "data": { "status": "running", "skill": "mining" } }`
