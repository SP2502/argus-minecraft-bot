/**
 * Argus Dashboard REST API Client
 * High-performance, authenticated wrapper around Argus Bot REST endpoints.
 */
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
    this.token = null;
  }

  setToken(token) {
    this.token = token;
  }

  get headers() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async get(endpoint) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, { headers: this.headers });
      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('argus:auth_required'));
        }
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] GET ${endpoint} error:`, err.message);
      return null;
    }
  }

  async post(endpoint, body = {}) {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.headers },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.dispatchEvent(new CustomEvent('argus:auth_required'));
        }
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      console.warn(`[API] POST ${endpoint} error:`, err.message);
      throw err;
    }
  }

  getStatus() {
    return this.get('/api/status');
  }

  getNavStatus() {
    return this.get('/api/nav-status');
  }

  getInvStatus() {
    return this.get('/api/inv-status');
  }

  getSafetyStatus() {
    return this.get('/api/safety-status');
  }

  getToolStatus() {
    return this.get('/api/tool-status');
  }

  getDomainStats(domain) {
    return this.get(`/api/stats/${domain}`);
  }

  getCommandHistory(limit = 50) {
    return this.get(`/api/commands/history?limit=${limit}`);
  }

  executeCommand(message) {
    return this.post('/api/commands/execute', { command: message });
  }

  async login(password) {
    return this.post('/api/auth/login', { password });
  }

  getServerConfig() {
    return this.get('/api/server-config');
  }

  updateServerConfig(config) {
    return this.post('/api/server-config', config);
  }

  getRadarEntities() {
    return this.get('/api/radar-entities');
  }
}

window.apiClient = new ApiClient();
