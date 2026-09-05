# Argus Operations & Deployment Guide

Argus is designed for local hosting, self-hosted Linux servers, Docker containers, and cloud PaaS deployments like Render.com.

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `OWNER_USERNAME` | Minecraft username of the immutable Tier 4 Owner | `ShadowPace` |
| `MC_HOST` | Minecraft server hostname / IP address | `localhost` |
| `MC_PORT` | Minecraft server port | `25565` |
| `MC_VERSION` | Target Minecraft version | `1.19.4` |
| `API_PORT` / `PORT` | HTTP REST and WebSocket telemetry port | `3000` |
| `MONGODB_URI` | Optional MongoDB connection string for storage registry | None (Local JSON fallback) |
| `DASHBOARD_PASSWORD` | Password for web dashboard authentication | `admin` |
| `DASHBOARD_SESSION_SECRET`| Secret key for signing dashboard session tokens | Development key |
| `RENDER` | Set to `true` when deployed on Render.com | `false` |

## Local Execution

```bash
# Start bot
npm start

# Access Web Dashboard
open http://localhost:3000
```

## Docker Deployment

```bash
# Build image
docker build -t argus-bot:1.0.0 .

# Run container with persistent data volume
docker run -d \
  --name argus-bot \
  -p 3000:3000 \
  -e MC_HOST="mc.myserver.net" \
  -e MC_PORT=25565 \
  -e OWNER_USERNAME="ShadowPace" \
  -v argus_data:/data \
  argus-bot:1.0.0
```

## Render.com Cloud Deployment

Argus includes a production `render.yaml` blueprint. Attach a persistent disk mounted to `/data` to preserve state snapshots across container restarts.
