/**
 * DashboardState - Central reactive store for Argus real-time operations console.
 * Holds all bot telemetry, domain operational metrics, command plans, and connection state.
 */
class DashboardState {
  constructor() {
    this.listeners = new Map();

    this.state = {
      // Connection & Freshness (Gateway & WebSocket)
      connection: {
        status: 'connecting', // 'online' | 'reconnecting' | 'offline'
        latencyMs: 0,
        lastHeartbeat: Date.now(),
        isStale: false,
        reconnectAttempts: 0
      },

      // Minecraft Server Connection & Owner Configuration
      serverConfig: {
        online: false,
        connectionState: 'disconnected', // 'connected' | 'connecting' | 'disconnected'
        server: { host: 'localhost', port: 25565 },
        owner: 'Kamlesh',
        botUsername: 'Argus',
        authMode: 'offline'
      },

      // Bot Vitals & Spatial Context
      bot: {
        username: 'Argus',
        health: 20,
        maxHealth: 20,
        food: 20,
        position: { x: 0, y: 64, z: 0 },
        yaw: 0,
        pitch: 0,
        dimension: 'overworld',
        headingCardinal: 'N'
      },

      // Nearby Radar Entities & Coordinates
      radarEntities: [],

      // Navigation & Pathfinding
      navigation: {
        isFollowing: false,
        isStuck: false,
        currentGoal: null,
        waypoints: []
      },

      // Safety & Hazard Assessment
      safety: {
        isCritical: false,
        isLowHealth: false,
        isLowHunger: false,
        isNearLava: false,
        shouldRetreat: false,
        status: 'Normal'
      },

      // Equipment & Handheld Tools
      tools: {
        bestPickaxe: null,
        bestAxe: null,
        bestSword: null,
        isAboutToBreak: false
      },

      // Inventory & Storage
      inventory: {
        usedSlots: 0,
        totalSlots: 36,
        slots: new Array(36).fill(null),
        chestsIndexed: 0,
        itemsSorted: 0,
        kitsRestocked: 0
      },

      // Subsystems & AI Brain Heartbeat
      systemHealth: {
        tickRate: 500,
        mode: 'idle',
        subsystems: {
          brain: { healthy: true, lastHeartbeat: Date.now() },
          navigation: { healthy: true, lastHeartbeat: Date.now() },
          safety: { healthy: true, lastHeartbeat: Date.now() },
          inventory: { healthy: true, lastHeartbeat: Date.now() },
          tools: { healthy: true, lastHeartbeat: Date.now() },
          auth: { healthy: true, lastHeartbeat: Date.now() }
        },
        tickHistory: [500, 500, 500, 500, 500],
        latencyHistory: [0, 0, 0, 0, 0]
      },

      // Operational Domains (11 Domains)
      domains: {
        navigation: { status: 'Idle', operation: 'Idle', routeCount: 0 },
        combat: { status: 'Idle', mobsKilled: 0, damageDealt: 0, damageTaken: 0, deaths: 0, target: 'None' },
        mining: { status: 'Idle', blocksMined: 0, targetBlock: 'None' },
        building: { status: 'Idle', structuresBuilt: 0, blocksPlaced: 0, structure: 'None' },
        farming: { status: 'Idle', cropsHarvested: 0, replantedCount: 0 },
        forestry: { status: 'Idle', logsCollected: 0, treesCut: 0, saplingsPlanted: 0, target: 'None' },
        logistics: { status: 'Idle', chestsIndexed: 0, itemsSorted: 0, lastKit: 'None' },
        crafting: { status: 'Idle', itemsCrafted: 0, itemsSmelted: 0, currentItem: 'None' },
        behavior: { status: 'Active', timesSlept: 0, itemsEaten: 0, currentActivity: 'Active' },
        serverAuth: { status: 'Registered', plugin: 'AuthMe', actionRequired: 'None' },
        security: { role: 'owner', permissions: ['all'], failedAttempts: 0 }
      },

      // Global Task Lifecycle
      tasks: {
        activeTask: null,
        queuedTasks: [],
        completedTasks: [],
        failedTasks: []
      },

      // Command Terminal History & Plan Previews
      commands: {
        history: [],
        activePlan: null,
        executionTimeline: []
      },

      // Monospace Security & Event Logs
      logs: [],

      // Active UI Navigation Tab
      activeView: 'command-deck' // 'command-deck' | 'tasks' | 'domains' | 'inventory' | 'radar' | 'observability' | 'security' | 'settings'
    };
  }

  /**
   * Subscribe to state slice changes.
   * @param {string} key - Top-level state key or '*' for all
   * @param {Function} callback - Change handler
   */
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  /**
   * Updates state slice and notifies subscribers.
   */
  setState(key, partial) {
    if (this.state[key] !== undefined) {
      if (typeof this.state[key] === 'object' && this.state[key] !== null && !Array.isArray(this.state[key])) {
        this.state[key] = { ...this.state[key], ...partial };
      } else {
        this.state[key] = partial;
      }
      this.notify(key);
      this.notify('*');
    }
  }

  notify(key) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach((cb) => {
        try { cb(this.state[key], this.state); } catch (e) { console.error('[State Error]', e); }
      });
    }
  }

  get(key) {
    return this.state[key];
  }

  markFresh() {
    this.state.connection.lastUpdate = Date.now();
    this.state.connection.isStale = false;
    this.notify('connection');
  }

  checkFreshness() {
    const elapsed = Date.now() - this.state.connection.lastUpdate;
    const isStaleNow = elapsed > 10000;
    if (this.state.connection.isStale !== isStaleNow) {
      this.state.connection.isStale = isStaleNow;
      this.notify('connection');
    }
  }
}

window.dashboardState = new DashboardState();
