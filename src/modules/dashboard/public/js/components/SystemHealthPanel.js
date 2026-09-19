/**
 * SystemHealthPanel Component
 * Displays real-time heartbeat and operational status of all core subsystems,
 * AI brain tick rate, and lock coordinator telemetry.
 */
class SystemHealthPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.tickRateMs = 500;
    this.mode = 'idle';
    this.modules = {
      'Navigation Subsystem': { healthy: true, status: 'Pathfinder Ready' },
      'Inventory Controller': { healthy: true, status: '36 Slots Monitored' },
      'Safety Guardian': { healthy: true, status: '<6 HP Emergency Guard' },
      'Equipment & Tools': { healthy: true, status: 'Durability Guard Active' },
      'Task Scheduler': { healthy: true, status: 'Preemption Engine' },
      'Location Registry': { healthy: true, status: 'Base Waypoints Synced' }
    };
    this.render();
  }

  render() {
    if (!this.container) return;

    let moduleHtml = '';
    for (const [name, state] of Object.entries(this.modules)) {
      const isHealthy = state.healthy !== false;
      moduleHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 7px 10px; background: rgba(9, 12, 19, 0.85); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05); font-size: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ${isHealthy ? '#10b981' : '#f43f5e'}; box-shadow: 0 0 8px ${isHealthy ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)'};"></span>
            <span style="font-weight: 600; color: #fff;">${name}</span>
          </div>
          <span style="color: var(--text-muted); font-size: 11px;">${state.status || 'Active'}</span>
        </div>
      `;
    }

    const modeBadgeColor = this.mode === 'combat'
      ? 'background: rgba(244,63,94,0.15); color: #f43f5e; border: 1px solid rgba(244,63,94,0.3);'
      : this.mode === 'active'
      ? 'background: rgba(56,189,248,0.15); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3);'
      : 'background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3);';

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(9, 12, 19, 0.85); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: #fff;">AI Decision Loop Frequency</span>
          </div>
          <span class="badge" style="${modeBadgeColor} font-size: 11px; text-transform: uppercase;">
            ${this.mode.toUpperCase()} MODE (${this.tickRateMs}ms)
          </span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;" id="modulesHealthGrid">
          ${moduleHtml}
        </div>
      </div>
    `;
  }

  updateHeartbeat(data) {
    if (!data) return;
    if (data.tickRateMs) this.tickRateMs = data.tickRateMs;
    if (data.mode) this.mode = data.mode;
    if (data.modules) {
      this.modules = { ...this.modules, ...data.modules };
    }
    this.render();
  }
}
