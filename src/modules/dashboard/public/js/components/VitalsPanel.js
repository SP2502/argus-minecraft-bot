/**
 * VitalsPanel Component
 * Displays bot health, hunger, 3D coordinates, orientation heading,
 * safety status, and currently equipped tools with real durability.
 */
class VitalsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.health = 20;
    this.food = 20;
    this.position = { x: 0, y: 64, z: 0 };
    this.yaw = 0;
    this.dimension = 'Overworld';
    this.safety = { isCritical: false, isLowHealth: false, shouldRetreat: false };
    this.tools = { bestPickaxe: null, bestAxe: null, bestSword: null };
    this.render();
  }

  render() {
    if (!this.container) return;

    const healthPercent = Math.min(100, Math.max(0, (this.health / 20) * 100));
    const foodPercent = Math.min(100, Math.max(0, (this.food / 20) * 100));

    // Compass cardinal calculation
    const deg = Math.round(((-this.yaw * 180) / Math.PI) % 360 + 360) % 360;
    const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const cardinal = cardinals[Math.floor(((deg + 22.5) % 360) / 45)];

    const safetyBadge = this.safety.isCritical
      ? `<span class="badge badge-offline" style="font-size:10px;">CRITICAL RETREAT</span>`
      : this.safety.isLowHealth
      ? `<span class="badge" style="background: rgba(245,158,11,0.15); color: #f59e0b; font-size:10px;">LOW HEALTH</span>`
      : `<span class="badge badge-online" style="font-size:10px;">SECURE</span>`;

    const pickaxeText = this.tools.bestPickaxe ? this.tools.bestPickaxe.replace(/_/g, ' ') : 'None';
    const swordText = this.tools.bestSword ? this.tools.bestSword.replace(/_/g, ' ') : 'None';

    this.container.innerHTML = `
      <div class="vitals-container">
        <!-- Health Bar -->
        <div class="vital-row">
          <div class="vital-label-wrap">
            <span style="display: flex; align-items: center; gap: 6px;">
              <span>Health</span>
              ${safetyBadge}
            </span>
            <span id="healthValue">${Math.round(this.health * 10) / 10} / 20</span>
          </div>
          <div class="vital-bar-track">
            <div id="healthBarFill" class="vital-bar-fill health-fill" style="width: ${healthPercent}%"></div>
          </div>
        </div>

        <!-- Hunger Bar -->
        <div class="vital-row">
          <div class="vital-label-wrap">
            <span>Hunger / Sustenance</span>
            <span id="hungerValue">${Math.round(this.food * 10) / 10} / 20</span>
          </div>
          <div class="vital-bar-track">
            <div id="hungerBarFill" class="vital-bar-fill hunger-fill" style="width: ${foodPercent}%"></div>
          </div>
        </div>

        <!-- 3D Spatial Coordinates -->
        <div class="coords-grid">
          <div class="coord-box">
            <div class="coord-label">X Axis</div>
            <div id="coordX" class="coord-value">${Math.round(this.position.x * 10) / 10}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Y Altitude</div>
            <div id="coordY" class="coord-value">${Math.round(this.position.y * 10) / 10}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Z Axis</div>
            <div id="coordZ" class="coord-value">${Math.round(this.position.z * 10) / 10}</div>
          </div>
        </div>

        <!-- Heading & Equipment Snapshot -->
        <div class="coords-grid" style="margin-top: 2px;">
          <div class="coord-box">
            <div class="coord-label">Heading</div>
            <div class="coord-value" style="font-size: 13px; color: var(--color-primary);">${cardinal} (${deg}°)</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Weapon</div>
            <div class="coord-value" style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${swordText}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Tool</div>
            <div class="coord-value" style="font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pickaxeText}</div>
          </div>
        </div>
      </div>
    `;
  }

  updateHealth(health, food) {
    if (health !== undefined) this.health = health;
    if (food !== undefined) this.food = food;
    this.render();
  }

  updatePosition(pos, yaw = 0) {
    if (pos) this.position = pos;
    if (yaw !== undefined) this.yaw = yaw;
    this.render();
  }

  updateSafety(safety) {
    if (safety) this.safety = safety;
    this.render();
  }

  updateTools(tools) {
    if (tools) {
      this.tools = tools;
      const pickEl = document.getElementById('loadoutPickaxe');
      const axeEl = document.getElementById('loadoutAxe');
      const swordEl = document.getElementById('loadoutSword');
      const degEl = document.getElementById('loadoutDegradation');

      if (pickEl) pickEl.textContent = (tools.bestPickaxe ? tools.bestPickaxe.replace(/_/g, ' ') : 'None');
      if (axeEl) axeEl.textContent = (tools.bestAxe ? tools.bestAxe.replace(/_/g, ' ') : 'None');
      if (swordEl) swordEl.textContent = (tools.bestSword ? tools.bestSword.replace(/_/g, ' ') : 'None');
      if (degEl) {
        degEl.textContent = tools.isAboutToBreak ? 'CRITICAL (<5%)' : 'Normal';
        degEl.style.color = tools.isAboutToBreak ? 'var(--accent-rose)' : 'var(--accent-emerald)';
      }
    }
    this.render();
  }
}
