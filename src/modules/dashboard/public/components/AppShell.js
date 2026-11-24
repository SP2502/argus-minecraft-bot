/**
 * AppShell - Main application layout orchestrator.
 * Production Restrained Dark Operations Theme
 * Manages fixed header with preview badge, responsive mobile off-canvas drawer,
 * persistent task strip with scheduler state, view routing, and scroll container resets.
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

    const isPreview = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    this.container.innerHTML = `
      <div class="app-container">
        
        <!-- Mobile Sidebar Backdrop -->
        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

        <!-- Fixed Header Bar -->
        <header class="app-header">
          <div class="header-left">
            <!-- Mobile Menu Toggle -->
            <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Toggle navigation menu">
              ${SvgIcons.get('menu', { size: 18 })}
            </button>

            <!-- Brand Badge -->
            <a href="#/command-deck" class="brand-badge" id="brandLink">
              <div class="brand-icon-wrap">
                ${SvgIcons.get('logo', { size: 18 })}
              </div>
              <span id="botNameLabel">ARGUS Console</span>
            </a>

            <!-- Explicit Preview Data Badge -->
            <div class="preview-mode-pill" id="previewModeBadge" title="Running in isolated local development preview with simulated data">
              <span class="badge-dot"></span>
              <span>Preview data</span>
            </div>

            <!-- Minecraft Connection Status Pill -->
            <div class="connection-status-pill offline" id="headerMcStatusPill" title="Minecraft Server Connection Status">
              <span class="connection-dot offline" id="headerMcStatusDot"></span>
              <span id="headerMcStatusText">Checking</span>
            </div>

            <!-- Target Minecraft Server Selector -->
            <button type="button" class="server-pill-btn" id="headerServerBtn" title="Click to view or change Minecraft Server">
              ${SvgIcons.get('server', { size: 13 })}
              <span id="headerServerAddress">localhost:25565</span>
              ${SvgIcons.get('chevron-down', { size: 11 })}
            </button>

            <!-- Configured Owner Badge -->
            <button type="button" class="owner-pill-btn" id="headerOwnerBtn" title="Configured Bot Owner - Click to edit">
              ${SvgIcons.get('user', { size: 13 })}
              <span>Owner:</span>
              <strong id="headerOwnerName">Kamlesh</strong>
            </button>
          </div>

          <div class="header-center">
            <div class="server-context-pill">
              <span class="dimension-tag" id="headerDimension">OVERWORLD</span>
              <span style="color: var(--border-medium);">|</span>
              <span id="headerCoords">X: 0.0 Y: 64.0 Z: 0.0</span>
            </div>

            <div class="telemetry-freshness" id="telemetryFreshness">
              <span class="freshness-dot"></span>
              <span id="freshnessText">Dashboard feed: Live</span>
            </div>
          </div>

          <div class="header-right">
            <span class="badge badge-idle" id="headerConnectionBadge">
              <span class="badge-dot"></span>
              <span id="headerConnectionText">Connecting</span>
            </span>

            <button type="button" class="btn btn-outline btn-sm" id="globalSearchBtn" title="Focus command input (Ctrl+K)">
              ${SvgIcons.get('search', { size: 13 })}
              <span style="font-size: 11px; opacity: 0.7;">⌘K</span>
            </button>

            <button type="button" class="btn btn-outline btn-sm" id="sessionLockBtn" title="Session authentication and lock controls">
              ${SvgIcons.get('lock', { size: 13 })}
              <span id="sessionLockText">Lock</span>
            </button>
          </div>
        </header>

        <!-- Collapsible / Mobile Drawer Sidebar -->
        <aside class="app-sidebar" id="appSidebar">
          <div class="sidebar-nav">
            
            <div class="nav-section-title">Operations</div>
            
            <a class="nav-item active" data-view="command-deck" href="#/command-deck">
              ${SvgIcons.get('terminal', { size: 17 })}
              <span class="nav-item-text">Command Deck</span>
            </a>

            <a class="nav-item" data-view="tasks" href="#/tasks">
              ${SvgIcons.get('tasks', { size: 17 })}
              <span class="nav-item-text">Task Center</span>
              <span class="nav-item-badge" id="sidebarTaskCount">0</span>
            </a>

            <a class="nav-item" data-view="radar" href="#/radar">
              ${SvgIcons.get('compass', { size: 17 })}
              <span class="nav-item-text">World Radar</span>
            </a>

            <div class="nav-section-title">Telemetry & Domains</div>

            <a class="nav-item" data-view="domains" href="#/domains">
              ${SvgIcons.get('layers', { size: 17 })}
              <span class="nav-item-text">Domain Hub</span>
            </a>

            <a class="nav-item" data-view="inventory" href="#/inventory">
              ${SvgIcons.get('inventory', { size: 17 })}
              <span class="nav-item-text">Storage & Loadout</span>
            </a>

            <a class="nav-item" data-view="observability" href="#/observability">
              ${SvgIcons.get('observability', { size: 17 })}
              <span class="nav-item-text">Observability</span>
            </a>

            <div class="nav-section-title">Governance</div>

            <a class="nav-item" data-view="security" href="#/security">
              ${SvgIcons.get('security', { size: 17 })}
              <span class="nav-item-text">Security & Audit</span>
            </a>

            <a class="nav-item" data-view="settings" href="#/settings">
              ${SvgIcons.get('settings', { size: 17 })}
              <span class="nav-item-text">Console Settings</span>
            </a>

          </div>

          <!-- Sidebar Profile Footer -->
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
              Config
            </button>
          </div>

          <button type="button" class="sidebar-toggle-btn" id="sidebarToggleBtn" title="Toggle sidebar collapse">
            ${SvgIcons.get('chevron-right', { size: 15 })}
          </button>
        </aside>

        <!-- Main Viewport -->
        <main class="app-main" id="appMain">
          
          <!-- Persistent Active-Task Strip -->
          <div class="persistent-task-strip" id="persistentTaskStrip">
            <div class="task-strip-info">
              <span class="task-strip-label">Mission:</span>
              <span class="task-strip-name" id="stripTaskName">Idle (Ready for directives)</span>
              <span class="task-strip-queue-count" id="stripQueueCount" style="display: none;">0 queued</span>
            </div>

            <div class="task-strip-actions">
              <div class="task-strip-progress-bar" id="stripProgressBar" title="Directive progress">
                <div class="task-strip-progress-fill" id="stripProgressFill" style="width: 0%;"></div>
              </div>
              <button type="button" class="btn btn-outline btn-sm" id="stripPauseBtn" title="Pause or resume execution" style="display: none;">
                ${SvgIcons.get('pause', { size: 12 })}
                <span id="stripPauseText">Pause</span>
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="stripStopBtn" title="Abort current mission" style="display: none;">
                ${SvgIcons.get('stop', { size: 12 })}
                <span>Abort</span>
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
                ${SvgIcons.get('terminal', { size: 22 })}
                <span>Autonomous Command Deck</span>
              </h1>
              <div class="view-subtitle" id="viewSubtitleText">
                Real-time autonomous mission execution and operational directives
              </div>
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
    const sidebar = this.container.querySelector('#appSidebar');
    const backdrop = this.container.querySelector('#sidebarBackdrop');
    const mobileMenuBtn = this.container.querySelector('#mobileMenuBtn');

    // Mobile Hamburger Toggle
    if (mobileMenuBtn && sidebar && backdrop) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = sidebar.classList.contains('mobile-open');
        sidebar.classList.toggle('mobile-open', !isOpen);
        backdrop.classList.toggle('active', !isOpen);
      });

      backdrop.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
      });
    }

    // Sidebar Navigation Click
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const viewKey = item.getAttribute('data-view');
        this.setActiveView(viewKey);
      });
    });

    // Sidebar Collapse Toggle (Desktop)
    const toggleBtn = this.container.querySelector('#sidebarToggleBtn');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        sidebar.classList.toggle('collapsed', this.isSidebarCollapsed);
        toggleBtn.innerHTML = SvgIcons.get(this.isSidebarCollapsed ? 'chevron-right' : 'chevron-down', { size: 15 });
      });
    }

    // Persistent Stop Action
    const stopBtn = this.container.querySelector('#stripStopBtn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Abort Active Directive',
          message: 'Are you sure you want to abort the running autonomous mission? The bot will halt movement and tool routines immediately.',
          onConfirm: () => {
            if (window.dashboardController) {
              window.dashboardController.sendCommand('stop');
            }
          }
        });
      });
    }

    // Persistent Pause Action
    const pauseBtn = this.container.querySelector('#stripPauseBtn');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const tasks = window.dashboardState.get('tasks') || {};
        const isPaused = Boolean(tasks.isPaused);
        if (window.dashboardController) {
          window.dashboardController.sendCommand(isPaused ? 'resume' : 'pause');
        }
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
      this.setActiveView('settings');
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
    // Close mobile drawer if open
    const sidebar = this.container.querySelector('#appSidebar');
    const backdrop = this.container.querySelector('#sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');

    // Reset scroll position to top
    const appMain = document.getElementById('appMain');
    if (appMain) {
      appMain.scrollTop = 0;
    }

    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.classList.toggle('active', item.getAttribute('data-view') === viewKey);
    });

    const titles = {
      'command-deck': { title: 'Command Deck', icon: 'terminal', breadcrumb: 'Command Deck', subtitle: 'Supervise autonomous mission execution, preview NLP intents, and dispatch operational directives.' },
      'tasks': { title: 'Task Center', icon: 'tasks', breadcrumb: 'Task Center', subtitle: 'Supervise active autonomous missions, manage the priority queue, and inspect execution history.' },
      'domains': { title: 'Domain Hub', icon: 'layers', breadcrumb: 'Domain Hub', subtitle: 'Detailed multi-domain operational metrics across navigation, combat, mining, and logistics.' },
      'inventory': { title: 'Storage & Loadout', icon: 'inventory', breadcrumb: 'Storage', subtitle: 'Real-time 36-slot player inventory matrix, item durability, and warehouse index.' },
      'radar': { title: 'World Radar', icon: 'compass', breadcrumb: 'World Radar', subtitle: 'Spatial proximity radar visualizing nearby players, hostiles, and passive entities.' },
      'observability': { title: 'Observability', icon: 'observability', breadcrumb: 'Observability', subtitle: 'System tick telemetry, latency histograms, and live subsystem heartbeats.' },
      'security': { title: 'Security & Audit', icon: 'security', breadcrumb: 'Security & Audit', subtitle: 'RBAC permissions, audit log history, and dangerous action authorizations.' },
      'settings': { title: 'Console Settings', icon: 'settings', breadcrumb: 'Settings', subtitle: 'Target Minecraft server connectivity, authentication mode, and console preferences.' }
    };

    const info = titles[viewKey] || titles['command-deck'];
    const titleEl = document.getElementById('viewTitleText');
    const breadcrumbEl = document.getElementById('breadcrumbPageName');
    const subtitleEl = document.getElementById('viewSubtitleText');

    if (titleEl) {
      titleEl.innerHTML = `${SvgIcons.get(info.icon, { size: 22 })} <span>${info.title}</span>`;
    }
    if (breadcrumbEl) {
      breadcrumbEl.textContent = info.breadcrumb;
    }
    if (subtitleEl) {
      subtitleEl.textContent = info.subtitle;
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
          badge.className = 'badge badge-success';
          text.textContent = conn.latencyMs ? `Online (${conn.latencyMs}ms)` : 'Online';
        } else if (conn.status === 'reconnecting') {
          badge.className = 'badge badge-warning';
          text.textContent = `Reconnecting (${conn.reconnectAttempts})`;
        } else {
          badge.className = 'badge badge-danger';
          text.textContent = 'Offline';
        }
      }

      if (freshnessText && freshnessWrap) {
        if (conn.isStale) {
          freshnessWrap.classList.add('stale');
          freshnessText.textContent = 'Dashboard feed: Stale';
        } else {
          freshnessWrap.classList.remove('stale');
          freshnessText.textContent = 'Dashboard feed: Live';
        }
      }
    });

    window.dashboardState.subscribe('bot', (bot) => {
      const nameEl = document.getElementById('botNameLabel');
      const dimEl = document.getElementById('headerDimension');
      const coordsEl = document.getElementById('headerCoords');

      if (nameEl && bot.username) nameEl.textContent = `${bot.username} Console`;
      if (dimEl && bot.dimension) dimEl.textContent = (bot.dimension || 'OVERWORLD').toUpperCase();
      if (coordsEl && bot.position) {
        const x = typeof bot.position.x === 'number' ? bot.position.x.toFixed(1) : '0.0';
        const y = typeof bot.position.y === 'number' ? bot.position.y.toFixed(1) : '64.0';
        const z = typeof bot.position.z === 'number' ? bot.position.z.toFixed(1) : '0.0';
        coordsEl.textContent = `X: ${x} Y: ${y} Z: ${z}`;
      }
    });

    window.dashboardState.subscribe('tasks', (tasks) => {
      const taskCountBadge = document.getElementById('sidebarTaskCount');
      const taskNameEl = document.getElementById('stripTaskName');
      const queueCountEl = document.getElementById('stripQueueCount');
      const fillEl = document.getElementById('stripProgressFill');
      const pauseBtn = document.getElementById('stripPauseBtn');
      const pauseText = document.getElementById('stripPauseText');
      const stopBtn = document.getElementById('stripStopBtn');

      const queueLen = (tasks.queue || tasks.queuedTasks || []).length;
      if (taskCountBadge) {
        taskCountBadge.textContent = String(queueLen);
      }

      if (queueCountEl) {
        if (queueLen > 0) {
          queueCountEl.style.display = 'inline-block';
          queueCountEl.textContent = `+${queueLen} in queue`;
        } else {
          queueCountEl.style.display = 'none';
        }
      }

      if (taskNameEl) {
        if (tasks.activeTask) {
          const isPaused = Boolean(tasks.isPaused || tasks.activeTask.isPaused);
          taskNameEl.textContent = `${tasks.activeTask.name || tasks.activeTask.type || 'Executing directive'}${isPaused ? ' (PAUSED)' : ''}`;
          if (fillEl) fillEl.style.width = `${tasks.activeTask.progress || 45}%`;
          if (pauseBtn) {
            pauseBtn.style.display = 'inline-flex';
            if (pauseText) pauseText.textContent = isPaused ? 'Resume' : 'Pause';
          }
          if (stopBtn) stopBtn.style.display = 'inline-flex';
        } else {
          taskNameEl.textContent = 'Idle (Ready for directives)';
          if (fillEl) fillEl.style.width = '0%';
          if (pauseBtn) pauseBtn.style.display = 'none';
          if (stopBtn) stopBtn.style.display = 'none';
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

      const indicator = window.dashboardState.getMinecraftIndicator(cfg);
      const host = (cfg.server && cfg.server.host) || 'localhost';
      const port = (cfg.server && cfg.server.port) || 25565;
      const owner = cfg.owner || 'Unknown';

      if (pill && dot && text) {
        pill.className = `connection-status-pill ${indicator.style}`;
        dot.className = `connection-dot ${indicator.style}`;
        text.textContent = indicator.label;
      }

      if (srvBtn) srvBtn.textContent = `${host}:${port}`;
      if (ownerEl) ownerEl.textContent = owner;
      if (avatarEl) avatarEl.textContent = (owner.charAt(0) || 'K').toUpperCase();
      if (sideOwnerEl) sideOwnerEl.textContent = owner;
      if (sideDot) sideDot.className = `connection-dot ${indicator.style}`;
      if (sideServer) sideServer.textContent = `${indicator.label} · ${host}:${port}`;
    });
  }
}

window.AppShell = AppShell;
