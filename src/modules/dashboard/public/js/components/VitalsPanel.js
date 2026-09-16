/**
 * VitalsPanel Component
 * Displays bot health, hunger, position coordinates, dimension state, and active operational stats.
 */
class VitalsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.health = 20;
    this.food = 20;
    this.position = { x: 0, y: 0, z: 0 };
    this.dimension = 'overworld';
    this.harvestedCount = 0;
    this.replantedCount = 0;
    this.activeCrop = 'None';
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="vitals-container">
        <div class="vital-row">
          <div class="vital-label-wrap">
            <span>Health</span>
            <span id="healthValue">${this.health} / 20</span>
          </div>
          <div class="vital-bar-track">
            <div id="healthBarFill" class="vital-bar-fill health-fill" style="width: ${(this.health / 20) * 100}%"></div>
          </div>
        </div>

        <div class="vital-row">
          <div class="vital-label-wrap">
            <span>Hunger</span>
            <span id="hungerValue">${this.food} / 20</span>
          </div>
          <div class="vital-bar-track">
            <div id="hungerBarFill" class="vital-bar-fill hunger-fill" style="width: ${(this.food / 20) * 100}%"></div>
          </div>
        </div>

        <div class="coords-grid">
          <div class="coord-box">
            <div class="coord-label">X</div>
            <div id="coordX" class="coord-value">${this.position.x}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Y</div>
            <div id="coordY" class="coord-value">${this.position.y}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Z</div>
            <div id="coordZ" class="coord-value">${this.position.z}</div>
          </div>
        </div>

        <div class="coords-grid" style="margin-top: 4px;">
          <div class="coord-box">
            <div class="coord-label">Harvested</div>
            <div id="statHarvested" class="coord-value" style="color: #2ed573;">${this.harvestedCount}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Replanted</div>
            <div id="statReplanted" class="coord-value" style="color: #ffa502;">${this.replantedCount}</div>
          </div>
          <div class="coord-box">
            <div class="coord-label">Current Crop</div>
            <div id="statCrop" class="coord-value" style="font-size: 13px; color: #70a1ff;">${this.activeCrop}</div>
          </div>
        </div>
      </div>
    `;
  }

  updateHealth(health, food) {
    if (health !== undefined) this.health = Math.round(health * 10) / 10;
    if (food !== undefined) this.food = Math.round(food * 10) / 10;

    const healthVal = document.getElementById('healthValue');
    const healthBar = document.getElementById('healthBarFill');
    const hungerVal = document.getElementById('hungerValue');
    const hungerBar = document.getElementById('hungerBarFill');

    if (healthVal) healthVal.textContent = `${this.health} / 20`;
    if (healthBar) healthBar.style.width = `${Math.min(100, (this.health / 20) * 100)}%`;
    if (hungerVal) hungerVal.textContent = `${this.food} / 20`;
    if (hungerBar) hungerBar.style.width = `${Math.min(100, (this.food / 20) * 100)}%`;
  }

  updatePosition(pos, dim) {
    if (pos) {
      this.position = {
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10
      };
    }
    if (dim) this.dimension = dim;

    const cx = document.getElementById('coordX');
    const cy = document.getElementById('coordY');
    const cz = document.getElementById('coordZ');

    if (cx) cx.textContent = this.position.x;
    if (cy) cy.textContent = this.position.y;
    if (cz) cz.textContent = this.position.z;
  }

  updateFarmingStats(harvested, replanted, cropName) {
    if (harvested !== undefined) this.harvestedCount = harvested;
    if (replanted !== undefined) this.replantedCount = replanted;
    if (cropName) this.activeCrop = cropName;

    const hEl = document.getElementById('statHarvested');
    const rEl = document.getElementById('statReplanted');
    const cEl = document.getElementById('statCrop');

    if (hEl) hEl.textContent = this.harvestedCount;
    if (rEl) rEl.textContent = this.replantedCount;
    if (cEl) cEl.textContent = this.activeCrop;
  }
}

window.VitalsPanel = VitalsPanel;
