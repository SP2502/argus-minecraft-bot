/**
 * AppShell - Main application layout orchestrator.
 * Handles the fixed header, responsive collapsible sidebar, persistent current-task strip,
 * and page view routing.
 */
class AppShell {
  constructor(containerId, onNavigate) {
    this.container = document.getElementById(containerId);
    this.onNavigate = onNavigate;
    this.isSidebarCollapsed = false;

    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="app-container">
        
        <!-- Fixed Header Bar -->
        <header class="app-header">
          <div class="header-left">
            <a href="#" class="brand-badge" id="brandLink">
              <div class="brand-icon-wrap">
                ${SvgIcons.get('logo', { size: 20 })}
              </div>
              <span id="botNameLabel">Argus Console</span>
            </a>

            <!-- Minecraft Connection Status Pill -->
            <div class="connection-status-pill offline" id="headerMcStatusPill" title="Minecraft Server Connection Status">
              <span class="connection-dot offline" id="headerMcStatusDot"></span>
              <span id="headerMcStatusText">OFFLINE</span>
            </div>

            <!-- Target Minecraft Server Selector -->
            <button type="button" class="server-pill-btn" id="headerServerBtn" title="Click to view or change Minecraft Server">
              ${SvgIcons.get('server', { size: 14 })}
              <span id="headerServerAddress">localhost:25565</span>
              ${SvgIcons.get('chevron-down', { size: 12 })}
            </button>

            <!-- Configured Owner Badge -->
            <button type="button" class="owner-pill-btn" id="headerOwnerBtn" title="Configured Bot Owner - Click to edit">
              ${SvgIcons.get('user', { size: 14 })}
              <span>Owner:</span>
              <strong id="headerOwnerName">Kamlesh</strong>
            </button>
          </div>

          <div class="header-center">
            <div class="server-context-pill">
              <span class="dimension-tag" id="headerDimension">Overworld</span>
              <span style="color: var(--border-medium);">|</span>
              <span id="headerCoords">X: 0.0 Y: 64.0 Z: 0.0</span>
            </div>

            <div class="telemetry-freshness" id="telemetryFreshness">
              <span class="freshness-dot"></span>
              <span id="freshnessText">Telemetry: Live</span>
            </div>
          </div>

          <div class="header-right">
            <span class="badge badge-idle" id="headerConnectionBadge">
              <span class="badge-dot"></span>
              <span id="headerConnectionText">Connecting</span>
            </span>

            <button type="button" class="btn btn-outline btn-sm" id="globalSearchBtn" title="Search commands, tasks, and telemetry (Ctrl+K)">
              ${SvgIcons.get('search', { size: 14 })}
              <span style="font-size: 11px; opacity: 0.7;">⌘K</span>
            </button>

            <button type="button" class="btn btn-outline btn-sm" id="sessionLockBtn" title="Session authentication and lock controls">
              ${SvgIcons.get('lock', { size: 14 })}
              <span id="sessionLockText">Lock</span>
            </button>
          </div>
        </header>

        <!-- Collapsible Sidebar -->
        <aside class="app-sidebar" id="appSidebar">
          <div class="sidebar-nav">
            
            <div class="nav-section-title">Operations</div>
            
            <a class="nav-item active" data-view="command-deck" href="#/command-deck">
              ${SvgIcons.get('terminal', { size: 18 })}
              <span class="nav-item-text">Command Deck</span>
            </a>

            <a class="nav-item" data-view="tasks" href="#/tasks">
              ${SvgIcons.get('tasks', { size: 18 })}
              <span class="nav-item-text">Task Center</span>
              <span class="nav-item-badge" id="sidebarTaskCount">0</span>
            </a>

            <a class="nav-item" data-view="radar" href="#/radar">
              ${SvgIcons.get('compass', { size: 18 })}
              <span class="nav-item-text">World Radar</span>
            </a>

            <div class="nav-section-title">Telemetry & Domains</div>

            <a class="nav-item" data-view="domains" href="#/domains">
              ${SvgIcons.get('layers', { size: 18 })}
              <span class="nav-item-text">Domain Hub</span>
            </a>

            <a class="nav-item" data-view="inventory" href="#/inventory">
              ${SvgIcons.get('inventory', { size: 18 })}
              <span class="nav-item-text">Storage & Loadout</span>
            </a>

            <a class="nav-item" data-view="observability" href="#/observability">
              ${SvgIcons.get('observability', { size: 18 })}
              <span class="nav-item-text">Observability</span>
            </a>

            <div class="nav-section-title">Governance</div>

            <a class="nav-item" data-view="security" href="#/security">
              ${SvgIcons.get('security', { size: 18 })}
              <span class="nav-item-text">Security & Audit</span>
            </a>

            <a class="nav-item" data-view="settings" href="#/settings">
              ${SvgIcons.get('settings', { size: 18 })}
              <span class="nav-item-text">Console Settings</span>
            </a>

          </div>

          <!-- Sidebar Profile Footer matching Copilot Labs -->
          <div class="sidebar-user-footer" id="sidebarUserFooter">
            <div class="user-avatar" id="sidebarOwnerAvatar">K</div>
            <div class="user-details">
              <span class="user-name" id="sidebarOwnerLabel">Kamlesh</span>
              <span class="user-status-text">
                <span class="connection-dot offline" id="sidebarStatusDot" style="width: 6px; height: 6px;"></span>
                <span id="sidebarStatusServer">localhost:25565</span>
              </span>
            </div>
            <button type="button" class="btn-user-action" id="sidebarChangeServerBtn" title="Configure Minecraft Server and Owner">
              Server
            </button>
          </div>

          <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn" title="Toggle sidebar collapse">
            ${SvgIcons.get('chevron-right', { size: 16 })}
          </button>
        </aside>

        <!-- Main Viewport -->
        <main class="app-main" id="appMain">
          
          <!-- Persistent Active-Task Strip -->
          <div class="persistent-task-strip" id="persistentTaskStrip">
            <div class="task-strip-info">
              <span class="task-strip-label">Mission:</span>
              <span class="task-strip-name" id="stripTaskName">Idle (No active directive)</span>
            </div>

            <div class="task-strip-actions">
              <div class="task-strip-progress-bar" title="Task completion estimate">
                <div class="task-strip-progress-fill" id="stripProgressFill" style="width: 0%;"></div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="stripPauseBtn" title="Pause current execution">
                ${SvgIcons.get('pause', { size: 13 })}
                <span>Pause</span>
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="stripStopBtn" title="Cancel current directive">
                ${SvgIcons.get('stop', { size: 13 })}
                <span>Cancel</span>
              </button>
            </div>
          </div>

          <!-- Breadcrumbs and View Title Header -->
          <div class="view-header">
            <div>
              <div class="breadcrumb-strip" id="breadcrumbStrip">
                <span>Argus</span>
                <span>/</span>
                <span class="active" id="breadcrumbPageName">Command Deck</span>
              </div>
              <h1 class="view-title" id="viewTitleText">
                ${SvgIcons.get('terminal', { size: 24 })}
                <span>Autonomous Command Deck</span>
              </h1>
            </div>

            <div class="view-actions" id="viewActionsContainer">
              <!-- Dynamically populated by active page -->
            </div>
          </div>

          <!-- Dynamic Page Content Container -->
          <div class="view-content" id="viewContentContainer">
            <!-- Active Page Renders Here -->
          </div>

        </main>

      </div>
    `;
  }

  attachEventListeners() {
    // Sidebar Navigation Click
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewKey = item.getAttribute('data-view');
        this.setActiveView(viewKey);
      });
    });

    // Sidebar Collapse Toggle
    const toggleBtn = this.container.querySelector('#sidebarToggleBtn');
    const sidebar = this.container.querySelector('#appSidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.isSidebarCollapsed);
        toggleBtn.innerHTML = SvgIcons.get(this.isSidebarCollapsed ? 'chevron-right' : 'chevron-down', { size: 16 });
      });
    }

    // Persistent Stop Action
    const stopBtn = this.container.querySelector('#stripStopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Abort Active Mission',
          message: 'Are you sure you want to cancel the currently running bot directive? Active routines will be terminated immediately.',
          onConfirm: () => {
            if (window.dashboardController) {
              window.dashboardController.sendCommand('stop');
            }
          }
        });
      });
    }

    // Session Lock Button
    const lockBtn = this.container.querySelector('#sessionLockBtn');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => {
        if (window.dashboardController) {
          window.dashboardController.handleLockClick();
        }
      });
    }

    // Server & Owner Configuration Modal Triggers
    const openServerModal = () => {
      ModalDialog.showServerConfigModal({
        onSave: (res) => {
          console.log('[AppShell] Server config updated:', res);
        }
      });
    };

    const srvBtn = this.container.querySelector('#headerServerBtn');
    if (srvBtn) srvBtn.addEventListener('click', openServerModal);

    const ownerBtn = this.container.querySelector('#headerOwnerBtn');
    if (ownerBtn) ownerBtn.addEventListener('click', openServerModal);

    const sideSrvBtn = this.container.querySelector('#sidebarChangeServerBtn');
    if (sideSrvBtn) sideSrvBtn.addEventListener('click', openServerModal);

    // Keyboard Shortcut Ctrl+K
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.setActiveView('command-deck');
        const input = document.getElementById('cmdInputDeck');
        if (input) input.focus();
      }
    });
  }

  setActiveView(viewKey) {
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewKey);
    });

    const titles = {
      'command-deck': { title: 'Autonomous Command Deck', icon: 'terminal', breadcrumb: 'Command Deck' },
      'tasks': { title: 'Task Lifecycle & Queue Center', icon: 'tasks', breadcrumb: 'Task Center' },
      'domains': { title: 'Multi-Domain Operational Telemetry', icon: 'layers', breadcrumb: 'Domain Hub' },
      'inventory': { title: 'Inventory Matrix & Storage Depot', icon: 'inventory', breadcrumb: 'Storage' },
      'radar': { title: 'SVG World Radar & Proximity Scanner', icon: 'compass', breadcrumb: 'World Radar' },
      'observability': { title: 'Observability, Health & Event Audit', icon: 'observability', breadcrumb: 'Observability' },
      'security': { title: 'Security Matrix & RBAC Audit', icon: 'security', breadcrumb: 'Security & Audit' },
      'settings': { title: 'Console Configuration & Preferences', icon: 'settings', breadcrumb: 'Settings' }
    };

    const info = titles[viewKey] || titles['command-deck'];
    const titleEl = document.getElementById('viewTitleText');
    const breadcrumbEl = document.getElementById('breadcrumbPageName');

    if (titleEl) {
      titleEl.innerHTML = `${SvgIcons.get(info.icon, { size: 24 })} <span>${info.title}</span>`;
    }
    if (breadcrumbEl) {
      breadcrumbEl.textContent = info.breadcrumb;
    }

    if (typeof this.onNavigate === 'function') {
      this.onNavigate(viewKey);
    }
  }

  subscribeToState() {
    window.dashboardState.subscribe('connection', (conn) => {
      const badge = document.getElementById('headerConnectionBadge');
      const text = document.getElementById('headerConnectionText');
      const freshnessText = document.getElementById('freshnessText');
      const freshnessWrap = document.getElementById('telemetryFreshness');

      if (badge && text) {
        if (conn.status === 'online') {
          badge.className = 'badge badge-active';
          text.textContent = conn.latencyMs ? `Online (${conn.latencyMs}ms)` : 'Online';
        } else if (conn.status === 'reconnecting') {
          badge.className = 'badge badge-warning';
          text.textContent = `Reconnecting (${conn.reconnectAttempts})`;
        } else {
          badge.className = 'badge badge-idle';
          text.textContent = 'Offline';
        }
      }

      if (freshnessText && freshnessWrap) {
        if (conn.isStale) {
          freshnessWrap.classList.add('stale');
          freshnessText.textContent = 'Telemetry: Stale';
        } else {
          freshnessWrap.classList.remove('stale');
          freshnessText.textContent = 'Telemetry: Live';
        }
      }
    });

    window.dashboardState.subscribe('bot', (bot) => {
      const nameEl = document.getElementById('botNameLabel');
      const dimEl = document.getElementById('headerDimension');
      const coordsEl = document.getElementById('headerCoords');

      if (nameEl && bot.username) nameEl.textContent = bot.username;
      if (dimEl && bot.dimension) dimEl.textContent = bot.dimension.toUpperCase();
      if (coordsEl && bot.position) {
        coordsEl.textContent = `X: ${Formatters.formatCoord(bot.position.x)} Y: ${Formatters.formatCoord(bot.position.y)} Z: ${Formatters.formatCoord(bot.position.z)}`;
      }
    });

    window.dashboardState.subscribe('tasks', (tasks) => {
      const taskCountBadge = document.getElementById('sidebarTaskCount');
      const taskNameEl = document.getElementById('stripTaskName');
      const fillEl = document.getElementById('stripProgressFill');

      if (taskCountBadge) {
        taskCountBadge.textContent = String(tasks.queuedTasks ? tasks.queuedTasks.length : 0);
      }

      if (taskNameEl) {
        if (tasks.activeTask) {
          taskNameEl.textContent = tasks.activeTask.name || tasks.activeTask.skill || 'Executing Directive';
          if (fillEl) fillEl.style.width = `${tasks.activeTask.progress || 35}%`;
        } else {
          taskNameEl.textContent = 'Idle (No active directive)';
          if (fillEl) fillEl.style.width = '0%';
        }
      }
    });

    window.dashboardState.subscribe('serverConfig', (cfg) => {
      const pill = document.getElementById('headerMcStatusPill');
      const dot = document.getElementById('headerMcStatusDot');
      const text = document.getElementById('headerMcStatusText');
      const srvBtn = document.getElementById('headerServerAddress');
      const ownerEl = document.getElementById('headerOwnerName');
      const avatarEl = document.getElementById('sidebarOwnerAvatar');
      const sideOwnerEl = document.getElementById('sidebarOwnerLabel');
      const sideDot = document.getElementById('sidebarStatusDot');
      const sideServer = document.getElementById('sidebarStatusServer');

      const isOnline = Boolean(cfg.online);
      const host = (cfg.server && cfg.server.host) || 'localhost';
      const port = (cfg.server && cfg.server.port) || 25565;
      const owner = cfg.owner || 'Kamlesh';

      if (pill && dot && text) {
        pill.className = `connection-status-pill ${isOnline ? 'online' : (cfg.connectionState === 'connecting' ? 'connecting' : 'offline')}`;
        dot.className = `connection-dot ${isOnline ? 'online' : (cfg.connectionState === 'connecting' ? 'connecting' : 'offline')}`;
        text.textContent = isOnline ? 'ONLINE' : (cfg.connectionState === 'connecting' ? 'CONNECTING' : 'OFFLINE');
      }

      if (srvBtn) srvBtn.textContent = `${host}:${port}`;
      if (ownerEl) ownerEl.textContent = owner;
      if (avatarEl) avatarEl.textContent = (owner.charAt(0) || 'K').toUpperCase();
      if (sideOwnerEl) sideOwnerEl.textContent = owner;
      if (sideDot) sideDot.className = `connection-dot ${isOnline ? 'online' : 'offline'}`;
      if (sideServer) sideServer.textContent = `${isOnline ? 'Connected' : 'Offline'} · ${host}:${port}`;
    });
  }
}

window.AppShell = AppShell;
