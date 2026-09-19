/**
 * WorldRadarPage - Dedicated pure SVG world radar and proximity scanner view.
 * Features:
 * - Interactive SVG radar with zoom/pan and heading arrow.
 * - Dimension switcher.
 * - Entity detection filter (Hostile vs Passive).
 * - Navigation waypoints & return home trigger.
 */
class WorldRadarPage {
  constructor() {}

  mount(container) {
    this.container = container;
    this.render();
    this.radar = new SvgRadar('worldRadarSvgContainer');
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="radar-station-container">
        
        <div class="hero-page-header" style="grid-column: 1 / -1;">
          <h1>World Radar</h1>
          <p>Pure vector spatial proximity scanner, player orientation compass, and 3D coordinate telemetry.</p>
        </div>

        <!-- Left: Pure SVG Radar Canvas Viewport -->
        <div class="radar-viewport-card">
          <div id="worldRadarSvgContainer" style="width: 100%; display: flex; justify-content: center;"></div>
        </div>

        <!-- Right: Radar Navigation & Proximity Controls -->
        <div class="radar-controls-card">
          
          <!-- Dimension & Spatial Status -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('compass', { size: 16 })}
                <span>Spatial Coordinates</span>
              </h3>
              <span class="badge badge-cyan" id="radarDimensionBadge">Overworld</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">X</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;" id="radarCoordX">0.0</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">Y</div>
                <div style="font-size: 16px; font-weight: 700; color: var(--cyan-400);" id="radarCoordY">64.0</div>
              </div>
              <div style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">Z</div>
                <div style="font-size: 16px; font-weight: 700; color: #fff;" id="radarCoordZ">0.0</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted);">
              <span>Orientation:</span>
              <strong style="color: var(--cyan-400);" id="radarHeadingVal">N (0°)</strong>
            </div>
          </div>

          <!-- Entity Proximity Scanner Filters -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('alert-triangle', { size: 16 })}
                <span>Entity Proximity Filters</span>
              </h3>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="filterHostileCheck" checked>
                <span style="color: var(--status-danger); font-weight: 600;">Plot Hostile Threats (Red)</span>
              </label>

              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" id="filterPassiveCheck" checked>
                <span style="color: var(--status-success); font-weight: 600;">Plot Passive Entities (Green)</span>
              </label>
            </div>
          </div>

          <!-- Navigation Directives -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('navigation', { size: 16 })}
                <span>Navigation Directives</span>
              </h3>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('return home')">
                <span>Return to Home Waypoint</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('follow player')">
                <span>Follow Nearest Player</span>
              </button>
              <button type="button" class="btn btn-danger btn-sm" onclick="window.commandDeckPage.fillAndSend('stop')">
                <span>Halt Movement</span>
              </button>
            </div>
          </div>

        </div>

        <!-- Full Width: Nearby Entity Coordinates & Scanner Inspector -->
        <div class="card" style="grid-column: 1 / -1; margin-top: 4px;">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 class="card-title">
                ${SvgIcons.get('compass', { size: 16 })}
                <span>Nearby Entity Coordinates & Proximity Directory</span>
              </h3>
              <span class="badge badge-cyan" id="radarEntityTotalBadge">0 Entities Detected</span>
            </div>
            <div style="display: flex; gap: 8px; font-size: 11px;">
              <span class="badge badge-danger" id="radarHostileCountBadge">0 Hostile</span>
              <span class="badge badge-success" id="radarPassiveCountBadge">0 Passive</span>
            </div>
          </div>

          <div style="overflow-x: auto; max-height: 280px; overflow-y: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: rgba(255, 255, 255, 0.02); text-align: left; border-bottom: 1px solid var(--border-subtle);">
                  <th style="padding: 10px 14px;">Entity Name</th>
                  <th style="padding: 10px 14px;">Classification</th>
                  <th style="padding: 10px 14px;">Distance</th>
                  <th style="padding: 10px 14px;">World Coordinates (X, Y, Z)</th>
                  <th style="padding: 10px 14px;">Relative Offset (ΔX, ΔZ)</th>
                  <th style="padding: 10px 14px; text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="radarEntityTableBody">
                <tr>
                  <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted); font-style: italic;">
                    Scanning surroundings... No entities detected within 64m radius.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const hostileCheck = this.container.querySelector('#filterHostileCheck');
    const passiveCheck = this.container.querySelector('#filterPassiveCheck');

    if (hostileCheck && this.radar) {
      hostileCheck.addEventListener('change', (e) => {
        this.radar.filterHostile = e.target.checked;
        this.radar.updateEntities(this.radar.entities);
      });
    }

    if (passiveCheck && this.radar) {
      passiveCheck.addEventListener('change', (e) => {
        this.radar.filterPassive = e.target.checked;
        this.radar.updateEntities(this.radar.entities);
      });
    }
  }

  updateEntities(entitiesList) {
    const entities = entitiesList || [];
    if (this.radar) {
      this.radar.updateEntities(entities);
    }

    const tbody = this.container.querySelector('#radarEntityTableBody');
    const totalBadge = this.container.querySelector('#radarEntityTotalBadge');
    const hostileBadge = this.container.querySelector('#radarHostileCountBadge');
    const passiveBadge = this.container.querySelector('#radarPassiveCountBadge');

    let hostiles = 0;
    let passives = 0;
    entities.forEach((ent) => {
      if (ent.isHostile || ent.type === 'hostile') hostiles++;
      else passives++;
    });

    if (totalBadge) totalBadge.textContent = `${entities.length} Detected`;
    if (hostileBadge) hostileBadge.textContent = `${hostiles} Hostile`;
    if (passiveBadge) passiveBadge.textContent = `${passives} Passive`;

    if (!tbody) return;

    if (entities.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted); font-style: italic;">
            Scanning surroundings... No entities detected within 64m radius.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = entities.map((ent, idx) => {
      const isPlayer = ent.type === 'player';
      const isHostile = ent.type === 'hostile' || ent.isHostile;
      const typeBadge = isPlayer
        ? `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4);">PLAYER</span>`
        : (isHostile ? `<span class="badge badge-danger">HOSTILE</span>` : `<span class="badge badge-success">PASSIVE</span>`);

      const x = Formatters.formatCoord(ent.x);
      const y = Formatters.formatCoord(ent.y);
      const z = Formatters.formatCoord(ent.z);
      const dx = `${ent.relX > 0 ? '+' : ''}${Formatters.formatCoord(ent.relX)}`;
      const dz = `${ent.relZ > 0 ? '+' : ''}${Formatters.formatCoord(ent.relZ)}`;
      const dist = `${Formatters.formatCoord(ent.distance)}m`;

      return `
        <tr style="border-bottom: 1px solid var(--border-subtle); cursor: pointer;" id="entityRow_${idx}" onclick="window.worldRadarPage.selectEntity(${idx})">
          <td style="padding: 10px 14px; font-weight: 600; color: #fff;">
            ${Formatters.escapeHtml(ent.name || 'Unknown Entity')}
          </td>
          <td style="padding: 10px 14px;">${typeBadge}</td>
          <td style="padding: 10px 14px; font-family: var(--font-mono); color: var(--cyan-400); font-weight: 600;">${dist}</td>
          <td style="padding: 10px 14px; font-family: var(--font-mono); color: #fff;">
            X: <strong style="color: var(--cyan-400);">${x}</strong>, Y: <strong style="color: #fff;">${y}</strong>, Z: <strong style="color: var(--cyan-400);">${z}</strong>
          </td>
          <td style="padding: 10px 14px; font-family: var(--font-mono); color: var(--text-muted);">
            ΔX: <strong style="color: #fff;">${dx}</strong>, ΔZ: <strong style="color: #fff;">${dz}</strong>
          </td>
          <td style="padding: 10px 14px; text-align: right;">
            <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation(); window.commandDeckPage.fillAndSend('status')">
              Track
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  selectEntity(idx) {
    if (this.radar && this.radar.entities && this.radar.entities[idx]) {
      const ent = this.radar.entities[idx];
      this.radar.selectedEntity = ent;
      const hoverEl = this.container.querySelector('#radarEntityHoverInfo');
      if (hoverEl) {
        hoverEl.innerHTML = `<strong style="color: #fff;">[Selected]</strong> <span style="color: ${ent.type === 'player' ? '#a855f7' : (ent.isHostile ? '#ef4444' : '#10b981')}; font-weight: 700;">${Formatters.escapeHtml(ent.name || 'Entity')}</span>: X: <strong style="color: #fff;">${Formatters.formatCoord(ent.x)}</strong> Y: <strong style="color: #fff;">${Formatters.formatCoord(ent.y)}</strong> Z: <strong style="color: #fff;">${Formatters.formatCoord(ent.z)}</strong> · Dist: <strong style="color: var(--cyan-400);">${Formatters.formatCoord(ent.distance)}m</strong>`;
      }
    }
  }

  highlightEntity(ent) {
    // Highlight table row if clicked on SVG radar
    const rows = this.container.querySelectorAll('#radarEntityTableBody tr');
    rows.forEach(r => r.style.background = 'transparent');
    if (this.radar && this.radar.entities) {
      const idx = this.radar.entities.findIndex(e => e.id === ent.id || (e.name === ent.name && e.x === ent.x));
      if (idx !== -1) {
        const row = this.container.querySelector(`#entityRow_${idx}`);
        if (row) {
          row.style.background = 'rgba(0, 229, 255, 0.08)';
          row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  subscribeToState() {
    window.dashboardState.subscribe('bot', (bot) => {
      const dimBadge = this.container.querySelector('#radarDimensionBadge');
      const xEl = this.container.querySelector('#radarCoordX');
      const yEl = this.container.querySelector('#radarCoordY');
      const zEl = this.container.querySelector('#radarCoordZ');
      const headingEl = this.container.querySelector('#radarHeadingVal');

      if (dimBadge && bot.dimension) dimBadge.textContent = bot.dimension.toUpperCase();
      if (xEl && bot.position) xEl.textContent = Formatters.formatCoord(bot.position.x);
      if (yEl && bot.position) yEl.textContent = Formatters.formatCoord(bot.position.y);
      if (zEl && bot.position) zEl.textContent = Formatters.formatCoord(bot.position.z);
      if (headingEl && bot.yaw !== undefined) {
        const heading = Formatters.calcHeading(bot.yaw);
        headingEl.textContent = `${heading.cardinal} (${heading.degrees}°)`;
      }
    });

    window.dashboardState.subscribe('radarEntities', (entities) => {
      this.updateEntities(entities);
    });
  }
}

window.worldRadarPage = new WorldRadarPage();

