/**
 * LogViewer Component
 * Live streaming log viewer with severity filtering and search capabilities.
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
      <div class="log-viewer-container">
        <div class="log-filters">
          <input type="text" id="logSearchInput" class="log-search-input" placeholder="Search log messages...">
          <select id="logFilterSelect" class="log-filter-select">
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="ERROR">Error</option>
            <option value="WARN">Warning</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="DEBUG">Debug</option>
          </select>
        </div>
        <div class="log-list" id="logListContainer"></div>
      </div>
    `;
  }

  attachEventListeners() {
    const searchInput = document.getElementById('logSearchInput');
    const select = document.getElementById('logFilterSelect');
    const list = document.getElementById('logListContainer');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterSearch = e.target.value.toLowerCase();
        this.refreshDisplay();
      });
    }

    if (select) {
      select.addEventListener('change', (e) => {
        this.filterSeverity = e.target.value;
        this.refreshDisplay();
      });
    }

    if (list) {
      list.addEventListener('scroll', () => {
        const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 30;
        this.autoScroll = isNearBottom;
      });
    }
  }

  addLog(entry) {
    const logObj = {
      timestamp: entry.timestamp || new Date().toLocaleTimeString(),
      severity: (entry.severity || 'INFO').toUpperCase(),
      category: entry.category || 'SYSTEM',
      message: typeof entry === 'string' ? entry : (entry.message || JSON.stringify(entry))
    };

    this.logs.push(logObj);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }

    this.appendSingleLog(logObj);
  }

  appendSingleLog(logObj) {
    if (!this.matchesFilter(logObj)) return;

    const list = document.getElementById('logListContainer');
    if (!list) return;

    const div = document.createElement('div');
    div.className = `log-item ${logObj.severity}`;
    div.textContent = `[${logObj.timestamp}] [${logObj.severity}] [${logObj.category}] ${logObj.message}`;
    list.appendChild(div);

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }
  }

  matchesFilter(logObj) {
    if (this.filterSeverity !== 'ALL' && logObj.severity !== this.filterSeverity) {
      return false;
    }
    if (this.filterSearch && !logObj.message.toLowerCase().includes(this.filterSearch)) {
      return false;
    }
    return true;
  }

  refreshDisplay() {
    const list = document.getElementById('logListContainer');
    if (!list) return;
    list.innerHTML = '';

    const matching = this.logs.filter((l) => this.matchesFilter(l));
    matching.forEach((logObj) => {
      const div = document.createElement('div');
      div.className = `log-item ${logObj.severity}`;
      div.textContent = `[${logObj.timestamp}] [${logObj.severity}] [${logObj.category}] ${logObj.message}`;
      list.appendChild(div);
    });

    if (this.autoScroll) {
      list.scrollTop = list.scrollHeight;
    }
  }
}

window.LogViewer = LogViewer;
