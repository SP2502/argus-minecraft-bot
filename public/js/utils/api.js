/**
 * Argus Dashboard REST API Client
 */
class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
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
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.warn(`[API] POST ${endpoint} error:`, err.message);
      return null;
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
}

window.apiClient = new ApiClient();
