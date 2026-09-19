/**
 * LogViewer Component (Redesigned)
 * Obsidian Glassmorphism live streaming audit and telemetry log viewer
 * with severity filtering, search filtering, auto-scroll toggle, and clear log actions.
 */
class LogViewer {
  constructor(containerId, maxEntries = 500) {
    this.container = document.getElementById(containerId);
    this.maxEntries = maxEntries;
    this.logs = [];
    this.filterSeverity = 'ALL';
    this.filterSearch = '';
    this.autoScroll = true;

    this.render();
    this.attachEventListeners();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="log-viewer-container" style="display: flex; flex-direction: column; gap: 10px;">

        <!-- Filter and Control Bar -->
        <div class="log-filters" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="position: relative; flex: 1; min-width: 200px;">
            <input type="text" id="logSearchInput" class="log-search-input" placeholder="Search security, task & telemetry logs..." autocomplete="off">
          </div>

          <select id="logFilterSelect" class="log-filter-select" style="min-width: 140px;">
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARN">Warning</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="DEBUG">Debug</option>
          </select>

          <button type="button" id="logAutoScrollBtn" class="btn btn-sm" style="background: rgba(99, 102, 241, 0.2); color: var(--accent-indigo); border: 1px solid rgba(99, 102, 241, 0.4);" title="Toggle Auto-Scroll">
            <span>⬇ Auto-Scroll: ON</span>
          </button>

          <button type="button" id="logClearBtn" class="btn btn-sm" style="background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border-subtle);" title="Clear Console Log View">
            <span>Clear</span>
          </button>
        </div>

        <!-- Log List Stream Container -->
        <div class="log-list" id="logListContainer" style="height: 480px; max-height: 520px; overflow-y: auto; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; font-family: var(--font-mono); font-size: 11.5px; display: flex; flex-direction: column; gap: 4px;">
          <div style="color: var(--text-muted); font-style: italic; padding: 12px; text-align: center;">
            Argus live event stream ready. Awaiting telemetry...
          </div>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const searchInput = document.getElementById('logSearchInput');
    const select = document.getElementById('logFilterSelect');
    const list = document.getElementById('logListContainer');
    const autoScrollBtn = document.getElementById('logAutoScrollBtn');
    const clearBtn = document.getElementById('logClearBtn');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSearch = e.target.value.toLowerCase().trim();
        this.refreshDisplay();
      });
    }

    if (select) {
      select.addEventListener('change', (e) => {
        this.filterSeverity = e.target.value;
        this.refreshDisplay();
      });
    }

    if (autoScrollBtn) {
      autoScrollBtn.addEventListener('click', () => {
        this.autoScroll = !this.autoScroll;
        autoScrollBtn.textContent = this.autoScroll ? '⬇ Auto-Scroll: ON' : '⏸ Auto-Scroll: OFF';
        autoScrollBtn.style.color = this.autoScroll ? 'var(--accent-indigo)' : 'var(--text-muted)';
        if (this.autoScroll && list) {
          list.scrollTop = list.scrollHeight;
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.logs = [];
        this.refreshDisplay();
      });
    }

    if (list) {
      list.addEventListener('scroll', () => {
        const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 35;
        if (this.autoScroll !== isNearBottom) {
          this.autoScroll = isNearBottom;
          if (autoScrollBtn) {
            autoScrollBtn.textContent = this.autoScroll ? '⬇ Auto-Scroll: ON' : '⏸ Auto-Scroll: OFF';
            autoScrollBtn.style.color = this.autoScroll ? 'var(--accent-indigo)' : 'var(--text-muted)';
          }
        }
      });
    }
  }

  addLog(entry) {
    if (!entry) return;

    const logObj = {
      timestamp: entry.timestamp || new Date().toLocaleTimeString(),
      severity: (entry.severity || 'INFO').toUpperCase(),
      category: (entry.category || 'SYSTEM').toUpperCase(),
      message: typeof entry === 'string' ? entry : (entry.message || JSON.stringify(entry))
    };

    this.logs.push(logObj);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }

    this.updateCountBadge();

    // If first log, clear placeholder
    const list = document.getElementById('logListContainer');
    if (list && this.logs.length === 1) {
      list.innerHTML = '';
    }

    this.appendSingleLog(logObj);
  }

  updateCountBadge() {
    const badge = document.getElementById('logCountBadge');
    if (badge) {
      badge.textContent = `${this.logs.length} Events`;
    }
  }

  appendSingleLog(logObj) {
    if (!this.matchesFilter(logObj)) return;

    const list = document.getElementById('logListContainer');
    if (!list) return;

    const div = document.createElement('div');
    div.className = `log-item ${logObj.severity}`;
    div.innerHTML = this.formatLogHtml(logObj);
    list.appendChild(div);

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }
  }

  formatLogHtml(logObj) {
    const sevColor = {
      CRITICAL: 'var(--accent-rose)',
      ERROR: 'var(--accent-rose)',
      WARN: 'var(--accent-amber)',
      INFO: 'var(--accent-cyan)',
      SUCCESS: 'var(--accent-emerald)',
      DEBUG: 'var(--text-muted)'
    }[logObj.severity] || 'var(--text-muted)';

    return `
      <span style="color: var(--text-muted); font-size: 10px;">${this.escapeHtml(logObj.timestamp)}</span>
      <span style="color: ${sevColor}; font-weight: 700; font-size: 10px; padding: 1px 4px; background: rgba(255,255,255,0.05); border-radius: 3px;">${this.escapeHtml(logObj.severity)}</span>
      <span style="color: var(--text-secondary); font-size: 10px; background: rgba(255,255,255,0.03); padding: 1px 4px; border-radius: 3px;">[${this.escapeHtml(logObj.category)}]</span>
      <span style="color: var(--text-main); line-height: 1.4;">${this.escapeHtml(logObj.message)}</span>
    `;
  }

  matchesFilter(logObj) {
    if (this.filterSeverity !== 'ALL' && logObj.severity !== this.filterSeverity) {
      return false;
    }
    if (this.filterSearch && !logObj.message.toLowerCase().includes(this.filterSearch) && !logObj.category.toLowerCase().includes(this.filterSearch)) {
      return false;
    }
    return true;
  }

  refreshDisplay() {
    const list = document.getElementById('logListContainer');
    if (!list) return;

    list.innerHTML = '';
    const matching = this.logs.filter((l) => this.matchesFilter(l));

    if (matching.length === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); font-style: italic; padding: 12px; text-align: center;">No log events match the current filter criteria.</div>`;
      return;
    }

    matching.forEach((logObj) => {
      const div = document.createElement('div');
      div.className = `log-item ${logObj.severity}`;
      div.innerHTML = this.formatLogHtml(logObj);
      list.appendChild(div);
    });

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.LogViewer = LogViewer;
