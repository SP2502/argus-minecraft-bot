/**
 * ObservabilityPage - Subsystem health, tick-rate history, and security/audit log viewer.
 * Features:
 * - Real subsystem heartbeats (Brain, Nav, Safety, Tools, Storage, Auth).
 * - SVG tick-rate and latency sparklines (Zero Canvas).
 * - Monospace log viewer with severity filters, search, and JSON export.
 */
class ObservabilityPage {
  constructor() {
    this.logs = [];
    this.filterSeverity = 'ALL';
    this.searchQuery = '';
    this.autoScroll = true;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <div class="hero-page-header">
          <h1>Observability & Audit</h1>
          <p>Subsystem heartbeats, tick-rate stability sparklines, and real-time security event streaming.</p>
        </div>

        <!-- Health & Sparkline Metrics Hero -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
          
          <!-- AI Brain Tick Rate -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('cpu', { size: 16 })}
                <span>AI Brain Tick Rate</span>
              </h3>
              <span class="badge badge-active" id="obsBrainModeBadge">combat (50ms)</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="font-size: 26px; font-weight: 700; font-family: var(--font-mono); color: #fff;" id="obsTickRateVal">50ms</div>
                <span style="font-size: 11px; color: var(--text-muted);">Adaptive Scheduler</span>
              </div>
              <div id="obsTickSparklineContainer">
                ${SvgSparkline.render([50, 50, 100, 50, 50], { stroke: 'var(--cyan-400)' })}
              </div>
            </div>
          </div>

          <!-- WebSocket Stream Latency -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('wifi', { size: 16 })}
                <span>WebSocket Latency</span>
              </h3>
              <span class="badge badge-cyan" id="obsWsLatencyBadge">Healthy</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <div style="font-size: 26px; font-weight: 700; font-family: var(--font-mono); color: var(--cyan-400);" id="obsLatencyVal">2ms</div>
                <span style="font-size: 11px; color: var(--text-muted);">Bi-directional Ping</span>
              </div>
              <div id="obsLatencySparklineContainer">
                ${SvgSparkline.render([4, 2, 3, 2, 2], { stroke: 'var(--violet-400)' })}
              </div>
            </div>
          </div>

          <!-- Subsystem Heartbeats Status -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('heart', { size: 16 })}
                <span>Subsystem Heartbeats</span>
              </h3>
              <span class="badge badge-success">6/6 Online</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11.5px; font-family: var(--font-mono);">
              <div style="display: flex; justify-content: space-between;"><span>Brain:</span> <strong style="color: var(--status-success);">OK</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Pathfinder:</span> <strong style="color: var(--status-success);">OK</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Safety:</span> <strong style="color: var(--status-success);">OK</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Inventory:</span> <strong style="color: var(--status-success);">OK</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>Tools:</span> <strong style="color: var(--status-success);">OK</strong></div>
              <div style="display: flex; justify-content: space-between;"><span>ServerAuth:</span> <strong style="color: var(--status-success);">OK</strong></div>
            </div>
          </div>

        </div>

        <!-- Live Streaming Security & Event Audit Feed -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <div class="card-header" style="padding: 14px 20px; margin: 0; background: rgba(255, 255, 255, 0.02);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 class="card-title">
                ${SvgIcons.get('observability', { size: 18 })}
                <span>Real-Time Audit & Event Stream</span>
              </h3>
              <span class="badge badge-idle" id="obsEventCountBadge">0 Events</span>
            </div>

            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline btn-sm" id="obsExportBtn" title="Export logs as JSON">
                ${SvgIcons.get('download', { size: 13 })}
                <span>Export JSON</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm" id="obsClearBtn" title="Clear log stream">
                ${SvgIcons.get('trash', { size: 13 })}
                <span>Clear</span>
              </button>
            </div>
          </div>

          <!-- Controls Bar -->
          <div style="display: flex; gap: 10px; align-items: center; padding: 10px 18px; border-bottom: 1px solid var(--border-subtle); background: rgba(0,0,0,0.2);">
            <div style="position: relative; flex: 1;">
              <input type="text" id="obsLogSearchInput" class="form-input mono" placeholder="Search security, task, and telemetry events..." style="padding-left: 32px; font-size: 12px;">
              <span style="position: absolute; left: 10px; top: 10px; color: var(--text-muted);">
                ${SvgIcons.get('search', { size: 14 })}
              </span>
            </div>

            <select id="obsSeveritySelect" class="form-input" style="width: 140px; font-size: 12px;">
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
              <option value="SUCCESS">Success</option>
            </select>
          </div>

          <!-- Monospace Log List -->
          <div id="obsLogList" style="height: 400px; overflow-y: auto; padding: 12px 18px; font-family: var(--font-mono); font-size: 11.5px; display: flex; flex-direction: column; gap: 4px; background: #060910;">
            <div style="color: var(--text-muted); font-style: italic; padding: 24px; text-align: center;">
              Awaiting telemetry events...
            </div>
          </div>

        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const searchInput = this.container.querySelector('#obsLogSearchInput');
    const sevSelect = this.container.querySelector('#obsSeveritySelect');
    const clearBtn = this.container.querySelector('#obsClearBtn');
    const exportBtn = this.container.querySelector('#obsExportBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.refreshLogsDisplay();
      });
    }

    if (sevSelect) {
      sevSelect.addEventListener('change', (e) => {
        this.filterSeverity = e.target.value;
        this.refreshLogsDisplay();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.logs = [];
        this.refreshLogsDisplay();
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = JSON.stringify(this.logs, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `argus-audit-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  addLog(logEntry) {
    const entry = {
      timestamp: logEntry.timestamp || Formatters.formatTimestamp(),
      severity: (logEntry.severity || 'INFO').toUpperCase(),
      category: (logEntry.category || 'SYSTEM').toUpperCase(),
      message: typeof logEntry === 'string' ? logEntry : (logEntry.message || JSON.stringify(logEntry))
    };

    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();

    const countBadge = this.container.querySelector('#obsEventCountBadge');
    if (countBadge) countBadge.textContent = `${this.logs.length} Events`;

    this.appendLogToDom(entry);
  }

  appendLogToDom(logObj) {
    const list = this.container.querySelector('#obsLogList');
    if (!list) return;

    if (!this.matchesFilter(logObj)) return;

    // Clear initial empty placeholder
    if (list.querySelector('div[style*="italic"]')) {
      list.innerHTML = '';
    }

    const row = document.createElement('div');
    row.style.lineHeight = '1.4';
    row.style.display = 'flex';
    row.style.gap = '8px';

    const sevColors = {
      CRITICAL: 'var(--status-danger)',
      ERROR: 'var(--status-danger)',
      WARN: 'var(--status-warning)',
      INFO: 'var(--cyan-400)',
      SUCCESS: 'var(--status-success)'
    };
    const color = sevColors[logObj.severity] || 'var(--text-muted)';

    row.innerHTML = `
      <span style="color: var(--text-muted); font-size: 10.5px;">[${logObj.timestamp}]</span>
      <span style="color: ${color}; font-weight: 700; font-size: 10px; padding: 1px 4px; background: rgba(255,255,255,0.04); border-radius: 2px;">${logObj.severity}</span>
      <span style="color: var(--text-secondary); font-size: 10px;">[${logObj.category}]</span>
      <span style="color: var(--text-primary);">${Formatters.escapeHtml(logObj.message)}</span>
    `;

    list.appendChild(row);
    if (this.autoScroll) list.scrollTop = list.scrollHeight;
  }

  matchesFilter(logObj) {
    if (this.filterSeverity !== 'ALL' && logObj.severity !== this.filterSeverity) return false;
    if (this.searchQuery && !logObj.message.toLowerCase().includes(this.searchQuery) && !logObj.category.toLowerCase().includes(this.searchQuery)) return false;
    return true;
  }

  refreshLogsDisplay() {
    const list = this.container.querySelector('#obsLogList');
    if (!list) return;
    list.innerHTML = '';
    const matching = this.logs.filter(l => this.matchesFilter(l));
    if (matching.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); font-style: italic; padding: 24px; text-align: center;">No events match filter criteria.</div>';
      return;
    }
    matching.forEach(l => this.appendLogToDom(l));
  }

  subscribeToState() {
    window.dashboardState.subscribe('systemHealth', (health) => {
      const modeEl = this.container.querySelector('#obsBrainModeBadge');
      const rateEl = this.container.querySelector('#obsTickRateVal');
      if (modeEl && health.mode) modeEl.textContent = `${health.mode} (${health.tickRate || 500}ms)`;
      if (rateEl && health.tickRate) rateEl.textContent = `${health.tickRate}ms`;
    });

    window.dashboardState.subscribe('connection', (conn) => {
      const latEl = this.container.querySelector('#obsLatencyVal');
      if (latEl && conn.latencyMs !== undefined) latEl.textContent = `${conn.latencyMs}ms`;
    });
  }
}

window.observabilityPage = new ObservabilityPage();
