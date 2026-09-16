/**
 * SystemHealthPanel Component
 * Renders module heartbeat status dots, AI decision loop tick rate, and latency metrics.
 */
class SystemHealthPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tickRateMs = 500;
    this.mode = 'idle';
    this.modules = {
      NavigationService: { healthy: true, latencyMs: 0 },
      InventoryService: { healthy: true, latencyMs: 0 },
      SafetyService: { healthy: true, latencyMs: 0 },
      ToolService: { healthy: true, latencyMs: 0 },
      LocationRegistry: { healthy: true, latencyMs: 0 }
    };
    this.render();
  }

  render() {
    if (!this.container) return;

    let moduleHtml = '';
    for (const [name, state] of Object.entries(this.modules)) {
      const isHealthy = state.healthy !== false;
      moduleHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; background: #12141a; border-radius: 4px; border: 1px solid #2a2f3d; font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${isHealthy ? '#2ed573' : '#ff4757'}; box-shadow: 0 0 6px ${isHealthy ? '#2ed573' : '#ff4757'};"></span>
            <span style="font-weight: 500;">${name}</span>
          </div>
          <span style="color: #9aa5b8; font-family: monospace; font-size: 11px;">${state.latencyMs || 0}ms</span>
        </div>
      `;
    }

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #12141a; border-radius: 6px; border: 1px solid #2a2f3d;">
          <span style="font-size: 13px; font-weight: 600;">🧠 AI Decision Loop</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge" style="background: rgba(55, 66, 250, 0.15); color: #70a1ff; border: 1px solid rgba(55, 66, 250, 0.3); font-size: 11px; text-transform: uppercase;">
              ${this.mode} (${this.tickRateMs}ms)
            </span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;" id="modulesHealthGrid">
          ${moduleHtml}
        </div>
      </div>
    `;
  }

  updateHeartbeat(data) {
    if (data.tickRateMs) this.tickRateMs = data.tickRateMs;
    if (data.mode) this.mode = data.mode;
    if (data.modules) {
      this.modules = { ...this.modules, ...data.modules };
    }
    this.render();
  }

  updateTickRate(mode, rateMs) {
    this.mode = mode;
    this.tickRateMs = rateMs;
    this.render();
  }
}

window.SystemHealthPanel = SystemHealthPanel;
