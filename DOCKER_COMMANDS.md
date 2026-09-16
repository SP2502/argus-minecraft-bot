# Argus Autonomous Bot — Complete Docker Commands & Operations Manual

This document provides a complete, exhaustive reference of **every Docker command** required to build, configure, deploy, manage, monitor, debug, and backup the **Argus Autonomous Minecraft Bot** using the project's [Dockerfile](file:///c:/Users/kkpcs/Downloads/ArgusMain/Dockerfile).

---

## 1. Dockerfile Architectural Summary

The Argus [Dockerfile](file:///c:/Users/kkpcs/Downloads/ArgusMain/Dockerfile) implements modern containerization best practices:

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN mkdir -p /data && chown -R node:node /app /data
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "index.js"]
```

### Key Properties:
- **Base Image**: `node:20-alpine` — Minimal, hardened, lightweight footprint (~180MB final image).
- **Persistent Volume**: `/data` — Preserves `state_snapshot.json`, `.bak` backups, and `bot.log` across container recreation.
- **Security / Non-Root User**: Runs under the unprivileged `node` user (UID/GID 1000).
- **Signal Forwarding**: Uses `CMD ["node", "index.js"]` (exec form) ensuring `SIGINT`/`SIGTERM` signals directly reach Node.js to trigger graceful shutdowns and save state snapshots.
- **Telemetry Port**: Port `3000` exposed for the WebGL 3D Dashboard, WebSockets, and REST API.

---

## 2. Environment Preparation

Before launching containers, create your local configuration file from the template:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS (Bash)
cp .env.example .env
```

Edit `.env` to match your Minecraft server settings:
```ini
OWNER_USERNAME=ShadowPace
MC_HOST=mc.yourserver.net
MC_PORT=25565
MC_VERSION=1.19.4
API_PORT=3000
MONGODB_URI=
DASHBOARD_PASSWORD=admin
DASHBOARD_SESSION_SECRET=your_super_secret_session_key_here
```

---

## 3. Image Build Commands

### 3.1 Standard Image Build
Builds the image with the tag `argus-bot:1.0.0` and points to the current directory:
```bash
docker build -t argus-bot:1.0.0 .
```

### 3.2 Build with Multiple Tags (Version + Latest)
```bash
docker build -t argus-bot:1.0.0 -t argus-bot:latest .
```

### 3.3 Force Clean Build (Ignore Build Cache)
Recommended after dependency updates or major code refactoring:
```bash
docker build --no-cache -t argus-bot:1.0.0 .
```

### 3.4 Build with Docker BuildKit (Faster Parallel Builds)
```bash
# Linux / macOS
DOCKER_BUILDKIT=1 docker build -t argus-bot:1.0.0 .

# Windows PowerShell
$env:DOCKER_BUILDKIT=1; docker build -t argus-bot:1.0.0 .
```

### 3.5 Build with Progress Plain Output (Detailed Debugging)
```bash
docker build --progress=plain -t argus-bot:1.0.0 .
```

---

## 4. Volume & Persistence Management Commands

Argus stores its state, checkpoints, and logs in `/data`. Managing this volume ensures state survives upgrades.

### 4.1 Create Dedicated Named Volume
```bash
docker volume create argus_data
```

### 4.2 Inspect Named Volume Details & Storage Path
```bash
docker volume inspect argus_data
```

### 4.3 List All Docker Volumes
```bash
docker volume ls
```

### 4.4 Backup Persistent Data from Volume to Host
Exports all bot state files from the container's `/data` volume into a host `backup.tar.gz`:
```bash
docker run --rm \
  -v argus_data:/data \
  -v $(pwd):/backup \
  alpine tar -czvf /backup/argus_data_backup.tar.gz -C /data .
```

### 4.5 Restore Persistent Data from Host Backup to Volume
```bash
docker run --rm \
  -v argus_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar -xzvf /backup/argus_data_backup.tar.gz"
```

### 4.6 Remove Persistent Volume (Caution: Deletes Bot State)
```bash
docker volume rm argus_data
```

---

## 5. Container Run Commands

### 5.1 Run in Background (Detached) with Named Volume & Port Forwarding
Standard production command:
```bash
docker run -d \
  --name argus-bot \
  -p 3000:3000 \
  -v argus_data:/data \
  --env-file .env \
  --restart unless-stopped \
  argus-bot:1.0.0
```

### 5.2 Run with Explicit Inline Environment Variables
Pass variables directly on the command line without an `.env` file:
```bash
docker run -d \
  --name argus-bot \
  -p 3000:3000 \
  -v argus_data:/data \
  -e MC_HOST="mc.hypixel.net" \
  -e MC_PORT=25565 \
  -e MC_VERSION="1.19.4" \
  -e OWNER_USERNAME="ShadowPace" \
  -e DASHBOARD_PASSWORD="MySecurePassword123" \
  -e DASHBOARD_SESSION_SECRET="supersecretkey987" \
  --restart unless-stopped \
  argus-bot:1.0.0
```

### 5.3 Run in Foreground / Interactive Mode (View Live Console)
Great for testing initial connection to Minecraft:
```bash
docker run -it --rm \
  --name argus-bot \
  -p 3000:3000 \
  -v argus_data:/data \
  --env-file .env \
  argus-bot:1.0.0
```
*(Press `Ctrl + C` to initiate graceful shutdown and exit).*

### 5.4 Run with Local Host Directory Bind Mount
Mount a folder on your host machine directly into `/data`:

```bash
# Linux / macOS
mkdir -p ./data
docker run -d \
  --name argus-bot \
  -p 3000:3000 \
  -v $(pwd)/data:/data \
  --env-file .env \
  argus-bot:1.0.0

# Windows PowerShell
New-Item -ItemType Directory -Force -Path .\data
docker run -d `
  --name argus-bot `
  -p 3000:3000 `
  -v ${PWD}/data:/data `
  --env-file .env `
  argus-bot:1.0.0
```

### 5.5 Run with Resource Limits (CPU & Memory Capping)
Prevents the bot container from overwhelming host resources:
```bash
docker run -d \
  --name argus-bot \
  -p 3000:3000 \
  -v argus_data:/data \
  --cpus="1.5" \
  --memory="1024m" \
  --memory-swap="1536m" \
  --env-file .env \
  argus-bot:1.0.0
```

---

## 6. Container Lifecycle & Management Commands

### 6.1 View Running Containers
```bash
docker ps
```

### 6.2 View All Containers (Including Stopped)
```bash
docker ps -a
```

### 6.3 Stop Container (Graceful Shutdown)
Argus catches `SIGTERM` and saves state snapshots. Provide a 30-second grace period:
```bash
docker stop --time 30 argus-bot
```

### 6.4 Start Stopped Container
```bash
docker start argus-bot
```

### 6.5 Restart Container
```bash
docker restart --time 30 argus-bot
```

### 6.6 Pause / Unpause Container Processes
```bash
# Suspend execution
docker pause argus-bot

# Resume execution
docker unpause argus-bot
```

### 6.7 Remove Container
```bash
# Stop and remove
docker stop argus-bot
docker rm argus-bot

# Force remove running container immediately
docker rm -f argus-bot
```

---

## 7. Logs & Live Telemetry Monitoring

### 7.1 Follow Live Real-Time Logs
```bash
docker logs -f argus-bot
```

### 7.2 View the Last 100 Log Lines with Timestamps
```bash
docker logs --tail 100 -t argus-bot
```

### 7.3 View Logs Since a Specific Time
```bash
docker logs --since 15m argus-bot
```

### 7.4 Live Resource Utilization Monitor (CPU, RAM, Network I/O)
```bash
docker stats argus-bot
```

### 7.5 Inspect Running Processes Inside Container
```bash
docker top argus-bot
```

### 7.6 Detailed Container Metadata & Network Inspection
```bash
docker inspect argus-bot
```

---

## 8. Interactive Shell & In-Container Debugging

Because the image is Alpine Linux, use `sh` instead of `bash`.

### 8.1 Open Interactive Shell Inside Running Container
```bash
docker exec -it argus-bot sh
```

### 8.2 Verify User Identity (Confirm Non-Root Execution)
```bash
docker exec -it argus-bot id
# Expected output: uid=1000(node) gid=1000(node) groups=1000(node)
```

### 8.3 Inspect Persistent Storage Files in `/data`
```bash
docker exec -it argus-bot ls -la /data
```

### 8.4 Read Bot Log from Persistent Directory
```bash
docker exec -it argus-bot tail -n 50 /data/bot.log
```

### 8.5 View State Snapshot JSON
```bash
docker exec -it argus-bot cat /data/state_snapshot.json
```

### 8.6 Test Minecraft Server Network Reachability from Inside Container
```bash
# Test TCP connection to server port
docker exec -it argus-bot nc -zv mc.yourserver.net 25565
```

---

## 9. Interacting with the Bot Container via REST & Web

Once the container is running with `-p 3000:3000`:

### 9.1 Access WebGL 3D Dashboard
Open in your web browser:
```text
http://localhost:3000
```

### 9.2 Check Health & Bot Status via HTTP REST
```bash
# cURL
curl http://localhost:3000/api/status

# PowerShell
Invoke-RestMethod -Uri "http://localhost:3000/api/status"
```

### 9.3 Authenticate to Dashboard via API
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "admin", "username": "ShadowPace"}'
```

### 9.4 Dispatch a Bot Command via REST API
```bash
curl -X POST http://localhost:3000/api/command \
  -H "Content-Type: application/json" \
  -d '{
    "message": "mine 32 iron_ore then return home",
    "sender": "ShadowPace"
  }'
```

### 9.5 Connect to WebSocket Telemetry Stream (using `wscat`)
```bash
# Install wscat globally if needed: npm i -g wscat
wscat -c ws://localhost:3000
```

---

## 10. Docker Compose Orchestration

For multi-container setups (e.g. running Argus alongside a dedicated MongoDB instance), use `docker-compose.yml`:

```yaml
version: '3.8'

services:
  argus-bot:
    build:
      context: .
      dockerfile: Dockerfile
    image: argus-bot:1.0.0
    container_name: argus-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - MONGODB_URI=mongodb://mongo:27017/argus
    volumes:
      - argus_data:/data
    depends_on:
      - mongo

  mongo:
    image: mongo:6.0
    container_name: argus-mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db

volumes:
  argus_data:
  mongo_data:
```

### Docker Compose Commands:
```bash
# Build and start services in background
docker compose up -d --build

# View aggregated logs
docker compose logs -f argus-bot

# Check service status
docker compose ps

# Graceful stop
docker compose stop

# Stop and remove containers, networks, and volumes
docker compose down

# Stop and purge volumes (Caution: Erases all data)
docker compose down -v
```

---

## 11. Maintenance & Image Cleanup

### 11.1 List Argus Images
```bash
docker images | grep argus-bot
```

### 11.2 Remove Specific Argus Image Tag
```bash
docker rmi argus-bot:1.0.0
```

### 11.3 Clean Dangling Images & Build Cache
```bash
# Remove unused build cache
docker builder prune -f

# Remove all stopped containers, unused networks, and dangling images
docker system prune -f
```

---

## 12. Quick Reference Cheat Sheet

| Operation | Command |
| :--- | :--- |
| **Build Image** | `docker build -t argus-bot:1.0.0 .` |
| **Start Bot (Detached)** | `docker run -d --name argus-bot -p 3000:3000 -v argus_data:/data --env-file .env --restart unless-stopped argus-bot:1.0.0` |
| **View Live Logs** | `docker logs -f argus-bot` |
| **Stop Gracefully** | `docker stop --time 30 argus-bot` |
| **Restart** | `docker restart --time 30 argus-bot` |
| **Open Shell** | `docker exec -it argus-bot sh` |
| **Monitor Stats** | `docker stats argus-bot` |
| **Inspect /data** | `docker exec -it argus-bot ls -la /data` |
| **Check REST Status**| `curl http://localhost:3000/api/status` |
| **Export Backup** | `docker run --rm -v argus_data:/data -v $(pwd):/backup alpine tar -czvf /backup/backup.tar.gz -C /data .` |
