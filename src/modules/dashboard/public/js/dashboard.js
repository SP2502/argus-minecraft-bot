/**
 * Argus Dashboard Controller - Main Entry Point
 * Coordinates WebSocket connection, REST polling, state management,
 * AppShell navigation, and operational page mounting.
 */
class DashboardController {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.sessionToken = sessionStorage.getItem('argus_session_token') || localStorage.getItem('argus_session_token') || null;
    this.pollTimer = null;
    this.freshnessTimer = null;
    this.activeView = 'command-deck';
    this.pages = {};

    this.init();
  }

  async init() {
    console.log('[Argus] Initializing Production Operations Console...');

    // Initialize App Shell
    this.shell = new AppShell('appRoot', (viewKey) => this.switchView(viewKey));

    // Register pages
    this.pages = {
      'command-deck': window.commandDeckPage,
      'tasks': window.taskCenterPage,
      'domains': window.domainsPage,
      'inventory': window.inventoryStoragePage,
      'radar': window.worldRadarPage,
      'observability': window.observabilityPage,
      'security': window.securityAuditPage,
      'settings': window.settingsPage
    };

    // Mount initial page
    this.switchView('command-deck');

    // Start freshness monitoring
    this.freshnessTimer = setInterval(() => {
      window.dashboardState.checkFreshness();
    }, 1000);

    // Authentication & Connection
    const isAuthenticated = await this.ensureAuthenticated();
    if (isAuthenticated) {
      this.connectWebSocket();
      await this.syncRealState();
      this.startPollingRealData();
    }
  }

  switchView(viewKey) {
    this.activeView = viewKey;
    const container = document.getElementById('viewContentContainer');
    if (!container) return;

    container.innerHTML = '';
    const page = this.pages[viewKey];
    if (page && typeof page.mount === 'function') {
      page.mount(container);
    }
  }

  async ensureAuthenticated() {
    if (this.sessionToken) {
      window.apiClient.setToken(this.sessionToken);
      try {
        const res = await window.apiClient.getStatus();
        if (res && (res.username || res.status)) {
          this.updateLockLabel(true);
          return true;
        }
      } catch (e) {
        // Token invalid or expired
      }
    }

    this.showAuthModal();
    return false;
  }

  showAuthModal() {
    ModalDialog.showAuthModal(async (password, callbacks) => {
      try {
        const res = await window.apiClient.login(password);
        if (res && res.ok && res.token) {
          this.sessionToken = res.token;
          sessionStorage.setItem('argus_session_token', res.token);
          localStorage.setItem('argus_session_token', res.token);
          window.apiClient.setToken(res.token);

          callbacks.close();
          this.updateLockLabel(true);

          this.connectWebSocket();
          await this.syncRealState();
          this.startPollingRealData();
        } else {
          callbacks.showError(res.message || 'Invalid password.');
        }
      } catch (err) {
        callbacks.showError(err.message || 'Authentication failed.');
      }
    });
  }

  handleLockClick() {
    if (this.sessionToken) {
      ModalDialog.showConfirmation({
        title: 'Lock Console Session',
        message: 'Are you sure you want to lock the operations console and terminate your active session?',
        onConfirm: () => this.logout()
      });
    } else {
      this.showAuthModal();
    }
  }

  logout() {
    this.sessionToken = null;
    sessionStorage.removeItem('argus_session_token');
    localStorage.removeItem('argus_session_token');
    window.apiClient.setToken(null);
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    this.updateLockLabel(false);
    window.dashboardState.setState('connection', { status: 'offline' });
    this.showAuthModal();
  }

  updateLockLabel(isLocked) {
    const lockText = document.getElementById('sessionLockText');
    if (lockText) {
      lockText.textContent = isLocked ? 'Lock' : 'Unlock';
    }
  }

  /**
   * Synchronizes live state across all REST endpoints.
   */
  async syncRealState() {
    if (!this.sessionToken) return;

    try {
      // 1. Status & Server Configuration
      const [status, serverConfig] = await Promise.all([
        window.apiClient.getStatus(),
        window.apiClient.getServerConfig()
      ]);
      if (status) {
        window.dashboardState.markFresh();
        window.dashboardState.setState('bot', {
          username: status.username || 'Argus',
          health: status.health !== undefined ? status.health : 20,
          food: status.food !== undefined ? status.food : 20,
          position: status.position || { x: 0, y: 64, z: 0 }
        });
        if (status.currentTask) {
          window.dashboardState.setState('tasks', {
            activeTask: { name: status.currentTask, progress: 50 }
          });
        }
      }
      if (serverConfig && serverConfig.ok) {
        window.dashboardState.setState('serverConfig', {
          online: serverConfig.online,
          connectionState: serverConfig.connectionState,
          server: serverConfig.server,
          owner: serverConfig.owner,
          botUsername: serverConfig.botUsername,
          authMode: serverConfig.authMode
        });
      } else if (status && status.server) {
        window.dashboardState.setState('serverConfig', {
          online: status.online,
          connectionState: status.connectionState,
          server: status.server,
          owner: status.owner,
          botUsername: status.username || 'Argus'
        });
      }

      // 2. Navigation
      const navStatus = await window.apiClient.getNavStatus();
      if (navStatus) {
        window.dashboardState.setState('navigation', navStatus);
      }

      // 3. Inventory
      const invStatus = await window.apiClient.getInvStatus();
      if (invStatus) {
        window.dashboardState.setState('inventory', {
          usedSlots: invStatus.usedSlots || 0,
          totalSlots: invStatus.totalSlots || 36
        });
      }

      // 4. Tools
      const toolStatus = await window.apiClient.getToolStatus();
      if (toolStatus) {
        window.dashboardState.setState('tools', toolStatus);
      }

      // 5. Safety
      const safetyStatus = await window.apiClient.getSafetyStatus();
      if (safetyStatus) {
        window.dashboardState.setState('safety', safetyStatus);
      }

      // 6. Domain Statistics
      const [wood, combat, crafting, building, logistics, ambient] = await Promise.all([
        window.apiClient.getDomainStats('woodcutting'),
        window.apiClient.getDomainStats('combat'),
        window.apiClient.getDomainStats('crafting'),
        window.apiClient.getDomainStats('building'),
        window.apiClient.getDomainStats('logistics'),
        window.apiClient.getDomainStats('ambient')
      ]);

      const domainsUpdate = {};
      if (wood && wood.stats) domainsUpdate.forestry = wood.stats;
      if (combat && combat.stats) domainsUpdate.combat = combat.stats;
      if (crafting && crafting.stats) domainsUpdate.crafting = crafting.stats;
      if (building && building.stats) domainsUpdate.building = building.stats;
      if (logistics && logistics.stats) domainsUpdate.logistics = logistics.stats;
      if (ambient && ambient.ambient) domainsUpdate.behavior = ambient.ambient;

      window.dashboardState.setState('domains', domainsUpdate);

      // 7. Nearby Radar Entities & Coordinates
      const radarData = await window.apiClient.getRadarEntities();
      if (radarData && Array.isArray(radarData.entities)) {
        window.dashboardState.setState('radarEntities', radarData.entities);
      }
    } catch (e) {
      console.warn('[Sync Error]', e.message);
    }
  }

  startPollingRealData() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      if (this.sessionToken) {
        this.syncRealState();
        this.sendPing();
      }
    }, 4000);
  }

  connectWebSocket() {
    if (!this.sessionToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${encodeURIComponent(this.sessionToken)}`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[WebSocket Error]', err);
      return;
    }

    this.ws.onopen = () => {
      console.log('[WebSocket] Live stream connected.');
      this.reconnectAttempts = 0;
      window.dashboardState.setState('connection', {
        status: 'online',
        reconnectAttempts: 0
      });
      window.dashboardState.markFresh();
      this.sendPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.handleEvent(payload);
      } catch (err) {
        console.warn('[WebSocket] Non-JSON payload received:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.warn('[WebSocket] Disconnected. Reconnecting...');
      window.dashboardState.setState('connection', { status: 'reconnecting' });
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
    };
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    window.dashboardState.setState('connection', {
      status: 'reconnecting',
      reconnectAttempts: this.reconnectAttempts
    });
    setTimeout(() => {
      if (this.sessionToken) {
        this.connectWebSocket();
      }
    }, delay);
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.pingStartTime = Date.now();
      this.ws.send(JSON.stringify({ type: 'ping' }));
    }
  }

  /**
   * Distributes incoming WebSocket messages to DashboardState and pages.
   */
  handleEvent(payload) {
    if (!payload || !payload.type) return;
    window.dashboardState.markFresh();

    const { type, data } = payload;

    switch (type) {
      case 'pong':
        if (this.pingStartTime) {
          const latency = Date.now() - this.pingStartTime;
          window.dashboardState.setState('connection', { latencyMs: latency });
        }
        break;

      case 'init':
        if (data) {
          window.dashboardState.setState('bot', {
            username: data.username || 'Argus',
            health: data.health !== undefined ? data.health : 20,
            food: data.food !== undefined ? data.food : 20,
            position: data.position || { x: 0, y: 64, z: 0 }
          });
        }
        break;

      case 'inventory.changed':
        if (data && data.slots) {
          window.dashboardState.setState('inventory', { slots: data.slots });
        }
        break;

      case 'bot.position.update':
      case 'bot:position':
      case 'bot:moved':
        if (data) {
          window.dashboardState.setState('bot', {
            position: data.position || { x: data.x, y: data.y, z: data.z },
            yaw: data.yaw !== undefined ? data.yaw : 0
          });
        }
        break;

      case 'bot.health.change':
      case 'bot:health':
        if (data) {
          window.dashboardState.setState('bot', {
            health: data.health !== undefined ? data.health : 20,
            food: data.food !== undefined ? data.food : 20
          });
        }
        break;

      case 'radar.entities':
      case 'bot.entities':
        if (data && Array.isArray(data.entities)) {
          window.dashboardState.setState('radarEntities', data.entities);
        }
        break;

      case 'task.started':
      case 'task.queued':
      case 'task.completed':
      case 'task.cancelled':
      case 'task.suspended':
      case 'task.failed':
        if (data) {
          const taskName = data.skill || data.skillName || data.name || (type === 'task.completed' ? null : 'Directive');
          window.dashboardState.setState('tasks', {
            activeTask: taskName ? { name: taskName, progress: type === 'task.completed' ? 100 : 50 } : null
          });
        }
        break;

      case 'dashboard.command.result':
      case 'command:response':
        if (window.commandDeckPage && typeof window.commandDeckPage.handleCommandResponse === 'function') {
          window.commandDeckPage.handleCommandResponse(data);
        }
        break;

      case 'log.entry':
      case 'log:entry':
        if (data && window.observabilityPage && typeof window.observabilityPage.addLog === 'function') {
          window.observabilityPage.addLog(data);
        }
        break;
    }
  }

  sendCommand(cmd) {
    if (!cmd || !cmd.trim()) return;
    const trimmed = cmd.trim();

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'dashboard.command',
        message: trimmed
      }));
    } else {
      window.apiClient.executeCommand(trimmed)
        .then((res) => {
          if (window.commandDeckPage) window.commandDeckPage.handleCommandResponse(res);
        })
        .catch((err) => {
          if (window.commandDeckPage) window.commandDeckPage.handleCommandResponse({ ok: false, message: err.message });
        });
    }
  }
}

// Global bootstrap
document.addEventListener('DOMContentLoaded', () => {
  window.dashboardController = new DashboardController();
});
