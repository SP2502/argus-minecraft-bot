FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create persistent data directory and assign ownership
RUN mkdir -p /data && chown -R node:node /app /data

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose API and WebSocket telemetry port
EXPOSE 3000

# Mount persistent data directory
VOLUME ["/data"]

# Start bot process directly for signal forwarding (SIGINT/SIGTERM)
CMD ["node", "index.js"]
