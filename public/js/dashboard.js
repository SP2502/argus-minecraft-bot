/**
 * Argus Dashboard Controller
 * Manages WebSocket lifecycle, telemetry event dispatch, and UI component synchronization.
 */

class DashboardController {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 10000;
    this.components = {};
    this.init();
  }

  async init() {
    console.log('[Dashboard] Initializing components...');

    // Instantiate UI Components
    this.components.vitals = new VitalsPanel('vitalsPanelContainer');
    this.components.systemHealth = new SystemHealthPanel('systemHealthContainer');
    this.components.stats = new StatsPanel('statsPanelContainer');
    this.components.inventory = new InventoryGrid('inventoryGridContainer');
    this.components.map = new MapViewer('mapCanvas');
    this.components.logs = new LogViewer('logViewerContainer');
    this.components.command = new CommandInput('commandInputContainer', (cmd) => this.sendCommand(cmd));

    if (!(await this.authenticate())) return;

    // Connect WebSocket
    this.connectWebSocket();

    // Initial REST sync
    await this.syncInitialState();
  }

  async authenticate() {
    let token = sessionStorage.getItem('argus_session_token');
    if (!token) {
      const password = window.prompt('Enter the Argus dashboard password:');
      if (!password) return false;
      const result = await window.apiClient.post('/api/auth/login', { password });
      if (!result || !result.ok || !result.token) {
        window.alert('Dashboard authentication failed.');
        return false;
      }
      token = result.token;
      sessionStorage.setItem('argus_session_token', token);
    }
    this.sessionToken = token;
    window.apiClient.setToken(token);
    return true;
  }

  async syncInitialState() {
    try {
      const status = await window.apiClient.getStatus();
      if (status) {
        this.updateOnlineStatus(true);
        if (status.health !== undefined && status.food !== undefined) {
          this.components.vitals.updateHealth(status.health, status.food);
        }
        if (status.position) {
          this.components.vitals.updatePosition(status.position);
          this.components.map.updatePosition(status.position);
        }
        const usernameEl = document.getElementById('botUsername');
        if (usernameEl && status.username) {
          usernameEl.textContent = status.username;
        }
        const taskEl = document.getElementById('currentTaskLabel');
        if (taskEl && status.currentTask) {
          taskEl.textContent = status.currentTask;
        }
      }
    } catch (e) {
      console.warn('[Dashboard] Initial REST sync failed:', e.message);
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/?token=${encodeURIComponent(this.sessionToken)}`;

    console.log(`[Dashboard] Connecting to WebSocket stream at ${wsUrl}...`);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Dashboard] WebSocket connected.');
      this.reconnectAttempts = 0;
      this.updateOnlineStatus(true);
      this.components.logs.addLog({
        severity: 'SUCCESS',
        category: 'WS',
        message: 'Connected to Argus real-time telemetry stream.'
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        this.handleEvent(payload);
      } catch (err) {
        console.warn('[Dashboard] Non-JSON WS message received:', event.data);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Dashboard] WebSocket disconnected. Attempting auto-reconnect...');
      this.updateOnlineStatus(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Dashboard] WebSocket error:', err);
    };
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  handleEvent(payload) {
    const { type, data, event, status, timestamp } = payload;
    const eventName = type || event;

    switch (eventName) {
      case 'init':
      case 'heartbeat':
        if (data || status) {
          const st = data || status;
          if (st.health !== undefined && st.food !== undefined) {
            this.components.vitals.updateHealth(st.health, st.food);
          }
          if (st.position) {
            this.components.vitals.updatePosition(st.position);
            this.components.map.updatePosition(st.position);
          }
          if (st.username) {
            const usernameEl = document.getElementById('botUsername');
            if (usernameEl) usernameEl.textContent = st.username;
          }
          if (st.currentTask) {
            const taskEl = document.getElementById('currentTaskLabel');
            if (taskEl) taskEl.textContent = st.currentTask;
          }
        }
        break;

      case 'bot.position.update':
        if (data) {
          this.components.vitals.updatePosition(data, data.dimension);
          this.components.map.updatePosition(data, data.yaw);
        }
        break;

      case 'bot.health.change':
        if (data) {
          this.components.vitals.updateHealth(data.health, data.food);
        }
        break;

      case 'inventory.changed':
        if (data && data.slots) {
          this.components.inventory.updateInventory(data.slots);
        }
        break;

      case 'log.entry':
        if (data) {
          this.components.logs.addLog(data);
        }
        break;

      case 'task.queued':
        this.components.logs.addLog({
          severity: 'INFO',
          category: 'TASK',
          message: `Task queued: [${data.skillName}] by ${data.requestedBy} (P:${data.priority})`
        });
        break;

      case 'task.started':
        {
          const taskEl = document.getElementById('currentTaskLabel');
          if (taskEl) taskEl.textContent = data.skillName || data.skill || 'Active';
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'TASK',
            message: `Task running: ${data.skillName || data.skill || JSON.stringify(data)}`
          });
          if (data.targetCrop) {
            this.components.vitals.updateFarmingStats(undefined, undefined, data.targetCrop);
          }
        }
        break;

      case 'task.completed':
        {
          const taskEl = document.getElementById('currentTaskLabel');
          if (taskEl) taskEl.textContent = 'Idle';
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'TASK',
            message: `Task finished: ${data.skillName || data.skill || JSON.stringify(data)}`
          });
        }
        break;

      case 'farming.crop_harvested':
        if (data) {
          this.components.vitals.updateFarmingStats(data.harvestedCount, data.replantedCount, data.crop);
        }
        break;

      case 'forestry.started':
        if (data && this.components.stats) {
          this.components.stats.updateForestryStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'FORESTRY',
            message: `Woodcutting started: Target [${data.treeFamily}], Goal: ${data.targetQuantity || '∞'} logs`
          });
        }
        break;

      case 'forestry.log_cut':
        if (data && this.components.stats) {
          this.components.stats.updateLogCut(data);
        }
        break;

      case 'forestry.tree_completed':
        if (data && this.components.stats) {
          this.components.stats.updateTreeCompleted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'FORESTRY',
            message: `Tree felled (${data.family}). Trees cut: ${data.treesCut}, Logs: ${data.logsCollected}`
          });
        }
        break;

      case 'forestry.replanted':
        if (data && this.components.stats) {
          this.components.stats.updateReplanted(data);
        }
        break;

      case 'forestry.skipped':
        if (data && this.components.stats) {
          this.components.stats.updateSkipped(data);
          this.components.logs.addLog({
            severity: 'WARN',
            category: 'FORESTRY',
            message: `Skipped tree at (${data.position.x}, ${data.position.y}, ${data.position.z}): ${data.reason}`
          });
        }
        break;

      case 'forestry.completed':
        if (data && this.components.stats) {
          this.components.stats.updateForestryCompleted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'FORESTRY',
            message: `Woodcutting finished: ${data.logsCollected} logs, ${data.treesCut} trees cut, ${data.saplingsPlanted} saplings replanted.`
          });
        }
        break;

      case 'combat.started':
        if (data && this.components.stats) {
          this.components.stats.updateCombatStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'COMBAT',
            message: `Combat [${(data.mode || 'hunt').toUpperCase()}] started: targeting ${data.targetMob} (Goal: ${data.targetQuantity || '∞'})`
          });
        }
        break;

      case 'combat.engaged':
        if (data && this.components.stats) {
          this.components.stats.updateCombatEngaged(data);
          this.components.logs.addLog({
            severity: 'WARN',
            category: 'COMBAT',
            message: `Engaged hostile ${data.mobType} at (${Math.round(data.position.x)}, ${Math.round(data.position.y)}, ${Math.round(data.position.z)})`
          });
        }
        break;

      case 'combat.hit':
        if (data && this.components.stats) {
          this.components.stats.updateCombatHit(data);
        }
        break;

      case 'combat.mob_killed':
        if (data && this.components.stats) {
          this.components.stats.updateCombatMobKilled(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'COMBAT',
            message: `Hostile ${data.mobType} eliminated! (${data.mobsDefeated}/${data.targetQuantity || '∞'})`
          });
        }
        break;

      case 'combat.retreat':
        if (data && this.components.stats) {
          this.components.stats.updateCombatRetreat(data);
          this.components.logs.addLog({
            severity: 'ERROR',
            category: 'COMBAT',
            message: `Health critical (${data.health} HP)! Tactical retreat initiated.`
          });
        }
        break;

      case 'combat.completed':
        if (data && this.components.stats) {
          this.components.stats.updateCombatCompleted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'COMBAT',
            message: `Combat operation finished: ${data.mobsDefeated} hostiles eliminated in ${Math.round(data.durationMs / 1000)}s.`
          });
        }
        break;

      case 'crafting.started':
        if (data && this.components.stats) {
          this.components.stats.updateCraftingStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'CRAFT',
            message: `Crafting started: ${data.quantity || 1}x ${data.item}`
          });
        }
        break;

      case 'crafting.item_crafted':
        if (data && this.components.stats) {
          this.components.stats.updateItemCrafted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'CRAFT',
            message: `Crafted ${data.count || 1}x ${data.item}`
          });
        }
        break;

      case 'smelting.started':
        if (data && this.components.stats) {
          this.components.stats.updateSmeltingStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'SMELT',
            message: `Smelting started: ${data.quantity || 1}x ${data.item}`
          });
        }
        break;

      case 'smelting.item_smelted':
        if (data && this.components.stats) {
          this.components.stats.updateItemSmelted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'SMELT',
            message: `Smelted ${data.count || 1}x ${data.item}`
          });
        }
        break;

      case 'crafting.completed':
        if (data && this.components.stats) {
          this.components.stats.updateCraftingCompleted(data);
          this.components.logs.addLog({
            severity: data.success ? 'SUCCESS' : 'WARN',
            category: 'CRAFT',
            message: `Crafting/smelting task finished: ${data.item} (${data.success ? 'Success' : 'Incomplete'})`
          });
        }
        break;

      case 'building.started':
        if (data && this.components.stats) {
          this.components.stats.updateBuildingStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'BUILD',
            message: `Construction started: ${data.structure} (${data.totalBlocks} blocks of ${data.material})`
          });
        }
        break;

      case 'building.block_placed':
        if (data && this.components.stats) {
          this.components.stats.updateBlockPlaced(data);
        }
        break;

      case 'building.completed':
        if (data && this.components.stats) {
          this.components.stats.updateBuildingCompleted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'BUILD',
            message: `Construction finished: ${data.structure} complete! (${data.blocksPlaced}/${data.totalBlocks} blocks placed)`
          });
        }
        break;

      case 'logistics.started':
        if (data && this.components.stats) {
          this.components.stats.updateLogisticsStarted(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'LOGISTICS',
            message: `Logistics operation started: [${(data.mode || 'sort').toUpperCase()}]`
          });
        }
        break;

      case 'logistics.chest_indexed':
        if (data && this.components.stats) {
          this.components.stats.updateChestIndexed(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'LOGISTICS',
            message: `Indexed chest [${data.label || 'Storage'}] with ${data.itemCount || 0} items at (${Math.round(data.position?.x || 0)}, ${Math.round(data.position?.y || 0)}, ${Math.round(data.position?.z || 0)})`
          });
        }
        break;

      case 'logistics.item_transferred':
        if (data && this.components.stats) {
          this.components.stats.updateItemTransferred(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'LOGISTICS',
            message: data.action === 'deposit'
              ? `Deposited ${data.count}x ${data.item} into [${data.category}] storage`
              : `Retrieved ${data.count}x ${data.item} from storage`
          });
        }
        break;

      case 'logistics.completed':
        if (data && this.components.stats) {
          this.components.stats.updateLogisticsCompleted(data);
          this.components.logs.addLog({
            severity: 'SUCCESS',
            category: 'LOGISTICS',
            message: `Logistics task finished: [${(data.mode || '').toUpperCase()}]`
          });
        }
        break;

      case 'ambient.sleep':
        if (data && this.components.stats) {
          this.components.stats.updateAmbientSleep(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'AMBIENT',
            message: `Resting in bed at (${Math.round(data.bedPosition?.x || 0)}, ${Math.round(data.bedPosition?.y || 0)}, ${Math.round(data.bedPosition?.z || 0)})`
          });
        }
        break;

      case 'ambient.wake':
        if (data && this.components.stats) {
          this.components.stats.updateAmbientWake(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'AMBIENT',
            message: `Woke up from bed (${data.reason || 'morning'}).`
          });
        }
        break;

      case 'ambient.ate':
        if (data && this.components.stats) {
          this.components.stats.updateAmbientAte(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'SURVIVAL',
            message: `Consumed ${data.food}. Hunger replenished to ${data.currentFood}/20.`
          });
        }
        break;

      case 'ambient.toggled':
        if (data && this.components.stats) {
          this.components.stats.updateAmbientToggled(data);
          this.components.logs.addLog({
            severity: 'INFO',
            category: 'AMBIENT',
            message: `Autonomous ambient behaviors ${data.enabled ? 'ENABLED' : 'DISABLED'}.`
          });
        }
        break;

      case 'ai.heartbeat':
        if (data && this.components.systemHealth) {
          this.components.systemHealth.updateHeartbeat(data);
        }
        break;

      case 'ai.tick_rate_changed':
        if (data && this.components.systemHealth) {
          this.components.systemHealth.updateTickRate(data.mode, data.tickRateMs);
        }
        break;

      case 'module.unhealthy':
        if (data) {
          this.components.logs.addLog({
            severity: 'CRITICAL',
            category: 'HEALTH',
            message: `Module unhealthy: ${data.module} (${data.error})`
          });
        }
        break;

      case 'dashboard.command.result':
        if (data) {
          if (data.status === 'clarification' && data.data && data.data.options) {
            this.components.command.showClarification(data.message, data.data.options);
          } else if (data.status === 'confirmation_required') {
            this.components.command.showConfirmation(data.message);
          }

          this.components.logs.addLog({
            severity: data.ok ? 'SUCCESS' : data.status === 'denied' ? 'WARN' : 'INFO',
            category: 'GATEWAY',
            message: `[Gateway ${data.status.toUpperCase()}] ${data.message}`
          });
        }
        break;

      case 'platform.info':
        if (data) {
          this.updatePlatformInfo(data);
        }
        break;

      case 'auth.status':
        if (data) {
          this.updateAuthInfo(data);
        }
        break;

      default:
        break;
    }
  }

  sendCommand(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.components.logs.addLog({
        severity: 'ERROR',
        category: 'CMD',
        message: 'Cannot dispatch command: WebSocket is disconnected.'
      });
      return;
    }

    const payload = {
      type: 'chat.command',
      message: message,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(payload));
    this.components.logs.addLog({
      severity: 'INFO',
      category: 'CMD',
      message: `Dispatched: "${message}"`
    });
  }

  updateOnlineStatus(isOnline) {
    const badge = document.getElementById('botStatusBadge');
    if (badge) {
      badge.className = `badge ${isOnline ? 'badge-online' : 'badge-offline'}`;
      badge.textContent = isOnline ? '● Online' : '● Offline';
    }
  }

  updatePlatformInfo(info) {
    const platformEl = document.getElementById('platformInfoText');
    const dataDirEl = document.getElementById('dataDirText');
    if (platformEl && info.platform) platformEl.textContent = `Running on: ${info.platform}`;
    if (dataDirEl && info.dataDir) dataDirEl.textContent = `Storage: ${info.dataDir}`;
  }

  updateAuthInfo(auth) {
    const authEl = document.getElementById('authModeBadge');
    if (authEl && auth.authMode) {
      authEl.textContent = `Auth: ${auth.authMode.toUpperCase()}`;
    }
  }

  quickFillCommand(commandText) {
    const input = document.getElementById('commandInputField');
    if (input) {
      input.value = commandText;
      input.focus();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new DashboardController();
});
