/**
 * SvgRadar - Pure SVG 2D Radar & Proximity Scanner (Zero Canvas).
 * Renders concentric range circles, cardinal markers, bot heading needle,
 * entity proximity blips, and waypoints via scalable vector graphics.
 */
class SvgRadar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.zoomLevel = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.filterHostile = true;
    this.filterPassive = true;
    this.entities = [];
    this.waypoints = [];

    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; width: 100%; position: relative;">
        
        <!-- Radar Filter & Zoom HUD Controls -->
        <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 10;">
          <button type="button" class="btn btn-outline btn-sm" id="radarZoomInBtn" title="Zoom In">
            ${SvgIcons.get('chevron-up', { size: 14 })}
          </button>
          <button type="button" class="btn btn-outline btn-sm" id="radarZoomOutBtn" title="Zoom Out">
            ${SvgIcons.get('chevron-down', { size: 14 })}
          </button>
          <button type="button" class="btn btn-outline btn-sm" id="radarResetBtn" title="Center on Bot">
            ${SvgIcons.get('crosshair', { size: 14 })}
          </button>
        </div>

        <!-- Pure SVG Radar Element -->
        <svg id="svgRadarElement" viewBox="-120 -120 240 240" class="radar-svg-container" style="max-width: 440px; aspect-ratio: 1/1;">
          <defs>
            <radialGradient id="radarScanGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="rgba(0, 229, 255, 0.15)" />
              <stop offset="70%" stop-color="rgba(0, 229, 255, 0.03)" />
              <stop offset="100%" stop-color="rgba(0, 229, 255, 0.0)" />
            </radialGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Background Disk -->
          <circle cx="0" cy="0" r="115" fill="#04070d" stroke="rgba(255, 255, 255, 0.08)" stroke-width="1" />
          <circle cx="0" cy="0" r="115" fill="url(#radarScanGradient)" />

          <!-- Concentric Range Rings (16m, 32m, 48m, 64m) -->
          <circle cx="0" cy="0" r="30" fill="none" stroke="rgba(0, 229, 255, 0.2)" stroke-width="0.75" stroke-dasharray="2 3" />
          <circle cx="0" cy="0" r="60" fill="none" stroke="rgba(0, 229, 255, 0.2)" stroke-width="0.75" stroke-dasharray="3 4" />
          <circle cx="0" cy="0" r="90" fill="none" stroke="rgba(0, 229, 255, 0.25)" stroke-width="0.75" stroke-dasharray="3 4" />
          <circle cx="0" cy="0" r="115" fill="none" stroke="rgba(0, 229, 255, 0.4)" stroke-width="1" />

          <!-- Cardinal Axes -->
          <line x1="0" y1="-115" x2="0" y2="115" stroke="rgba(255, 255, 255, 0.08)" stroke-width="0.75" />
          <line x1="-115" y1="0" x2="115" y2="0" stroke="rgba(255, 255, 255, 0.08)" stroke-width="0.75" />

          <!-- Cardinal Direction Labels -->
          <text x="0" y="-104" text-anchor="middle" font-size="7" fill="#00e5ff" font-weight="700" font-family="monospace">N</text>
          <text x="106" y="2.5" text-anchor="middle" font-size="7" fill="rgba(255, 255, 255, 0.6)" font-family="monospace">E</text>
          <text x="0" y="108" text-anchor="middle" font-size="7" fill="rgba(255, 255, 255, 0.6)" font-family="monospace">S</text>
          <text x="-106" y="2.5" text-anchor="middle" font-size="7" fill="rgba(255, 255, 255, 0.6)" font-family="monospace">W</text>

          <!-- Range Distance Labels -->
          <text x="32" y="-3" font-size="5" fill="rgba(0, 229, 255, 0.5)" font-family="monospace">16m</text>
          <text x="62" y="-3" font-size="5" fill="rgba(0, 229, 255, 0.5)" font-family="monospace">32m</text>
          <text x="92" y="-3" font-size="5" fill="rgba(0, 229, 255, 0.5)" font-family="monospace">48m</text>

          <!-- Dynamic Entities Group -->
          <g id="svgRadarEntitiesGroup"></g>

          <!-- Dynamic Waypoints Group -->
          <g id="svgRadarWaypointsGroup"></g>

          <!-- Bot Marker & Directional Heading Needle -->
          <g id="svgRadarBotMarker" transform="rotate(0)">
            <circle cx="0" cy="0" r="4" fill="#00e5ff" filter="url(#glowEffect)" />
            <polygon points="0,-12 -3,-4 3,-4" fill="#00e5ff" />
          </g>
        </svg>

        <!-- Coordinate & Heading Bar -->
        <div style="display: flex; gap: 16px; margin-top: 10px; font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); flex-wrap: wrap; justify-content: center;">
          <span>Coords: <strong style="color: #fff;" id="radarCoordText">0.0, 64.0, 0.0</strong></span>
          <span>Heading: <strong style="color: var(--cyan-400);" id="radarHeadingText">N (0°)</strong></span>
          <span>Entities: <strong style="color: #fff;" id="radarEntityCount">0</strong></span>
        </div>

        <!-- Entity Coordinate Inspector Hover Strip -->
        <div id="radarEntityHoverInfo" style="margin-top: 8px; font-family: var(--font-mono); font-size: 11px; padding: 6px 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); width: 100%; max-width: 440px; text-align: center; min-height: 28px; display: flex; align-items: center; justify-content: center;">
          <span style="color: var(--text-muted); font-style: italic;">Hover or click an entity blip to inspect its world coordinates.</span>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const zoomIn = this.container.querySelector('#radarZoomInBtn');
    const zoomOut = this.container.querySelector('#radarZoomOutBtn');
    const reset = this.container.querySelector('#radarResetBtn');

    if (zoomIn) zoomIn.addEventListener('click', () => { this.zoomLevel = Math.min(2.5, this.zoomLevel + 0.25); this.updateSvgView(); });
    if (zoomOut) zoomOut.addEventListener('click', () => { this.zoomLevel = Math.max(0.5, this.zoomLevel - 0.25); this.updateSvgView(); });
    if (reset) reset.addEventListener('click', () => { this.zoomLevel = 1.0; this.panOffset = { x: 0, y: 0 }; this.updateSvgView(); });
  }

  updateSvgView() {
    const svg = this.container.querySelector('#svgRadarElement');
    if (!svg) return;
    const base = 120 / this.zoomLevel;
    svg.setAttribute('viewBox', `${-base + this.panOffset.x} ${-base + this.panOffset.y} ${base * 2} ${base * 2}`);
  }

  subscribeToState() {
    window.dashboardState.subscribe('bot', (bot) => {
      const marker = this.container.querySelector('#svgRadarBotMarker');
      const coordText = this.container.querySelector('#radarCoordText');
      const headingText = this.container.querySelector('#radarHeadingText');

      if (bot.yaw !== undefined && marker) {
        const heading = Formatters.calcHeading(bot.yaw);
        marker.setAttribute('transform', `rotate(${heading.degrees})`);
        if (headingText) headingText.textContent = `${heading.cardinal} (${heading.degrees}°)`;
      }

      if (bot.position && coordText) {
        coordText.textContent = `${Formatters.formatCoord(bot.position.x)}, ${Formatters.formatCoord(bot.position.y)}, ${Formatters.formatCoord(bot.position.z)}`;
      }
    });
  }

  updateEntities(entitiesList) {
    this.entities = entitiesList || [];
    const group = this.container.querySelector('#svgRadarEntitiesGroup');
    const countEl = this.container.querySelector('#radarEntityCount');
    const hoverEl = this.container.querySelector('#radarEntityHoverInfo');
    if (!group) return;

    if (countEl) countEl.textContent = String(this.entities.length);

    let html = '';
    this.entities.forEach((ent, idx) => {
      const isPlayer = ent.type === 'player';
      const isHostile = ent.type === 'hostile' || ent.isHostile;
      if (isHostile && !this.filterHostile) return;
      if (!isHostile && !isPlayer && !this.filterPassive) return;

      const color = isPlayer ? '#a855f7' : (isHostile ? '#ef4444' : '#10b981');
      const r = isPlayer ? 4.0 : (isHostile ? 3.5 : 2.5);

      // Scale Minecraft meters to SVG radar coordinates (approx 1.8 units per meter)
      const cx = (ent.relX || 0) * 1.8;
      const cy = (ent.relZ || 0) * 1.8;

      const coordLabel = `${ent.name || 'Entity'} [${(ent.type || 'unknown').toUpperCase()}] | Dist: ${Formatters.formatCoord(ent.distance || 0)}m | Coords: X: ${Formatters.formatCoord(ent.x)}, Y: ${Formatters.formatCoord(ent.y)}, Z: ${Formatters.formatCoord(ent.z)} (Rel: ΔX: ${ent.relX > 0 ? '+' : ''}${Formatters.formatCoord(ent.relX)}, ΔZ: ${ent.relZ > 0 ? '+' : ''}${Formatters.formatCoord(ent.relZ)})`;

      html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="#000" stroke-width="0.75" class="radar-entity-blip" data-idx="${idx}" style="cursor: pointer; transition: transform 0.15s ease;" title="${Formatters.escapeHtml(coordLabel)}">
        <title>${Formatters.escapeHtml(coordLabel)}</title>
      </circle>`;
    });
    group.innerHTML = html;

    // Attach hover/click events to blips for instant coordinate inspection
    const blips = group.querySelectorAll('.radar-entity-blip');
    blips.forEach((blip) => {
      blip.addEventListener('mouseenter', () => {
        const ent = this.entities[parseInt(blip.getAttribute('data-idx'), 10)];
        if (ent && hoverEl) {
          hoverEl.innerHTML = `<span style="color: ${ent.type === 'player' ? '#a855f7' : (ent.isHostile ? '#ef4444' : '#10b981')}; font-weight: 700;">${Formatters.escapeHtml(ent.name || 'Entity')}</span>: X: <strong style="color: #fff;">${Formatters.formatCoord(ent.x)}</strong> Y: <strong style="color: #fff;">${Formatters.formatCoord(ent.y)}</strong> Z: <strong style="color: #fff;">${Formatters.formatCoord(ent.z)}</strong> (<span style="color: var(--cyan-400);">${Formatters.formatCoord(ent.distance)}m away</span>)`;
        }
      });
      blip.addEventListener('mouseleave', () => {
        if (hoverEl && !this.selectedEntity) {
          hoverEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">Hover or click an entity blip to inspect its world coordinates.</span>`;
        }
      });
      blip.addEventListener('click', () => {
        const ent = this.entities[parseInt(blip.getAttribute('data-idx'), 10)];
        if (ent) {
          this.selectedEntity = ent;
          if (hoverEl) {
            hoverEl.innerHTML = `<strong style="color: #fff;">[Selected]</strong> <span style="color: ${ent.type === 'player' ? '#a855f7' : (ent.isHostile ? '#ef4444' : '#10b981')}; font-weight: 700;">${Formatters.escapeHtml(ent.name || 'Entity')}</span>: X: <strong style="color: #fff;">${Formatters.formatCoord(ent.x)}</strong> Y: <strong style="color: #fff;">${Formatters.formatCoord(ent.y)}</strong> Z: <strong style="color: #fff;">${Formatters.formatCoord(ent.z)}</strong> · Dist: <strong style="color: var(--cyan-400);">${Formatters.formatCoord(ent.distance)}m</strong> · Offset: ΔX ${ent.relX > 0 ? '+' : ''}${Formatters.formatCoord(ent.relX)}, ΔZ ${ent.relZ > 0 ? '+' : ''}${Formatters.formatCoord(ent.relZ)}`;
          }
          if (window.worldRadarPage && typeof window.worldRadarPage.highlightEntity === 'function') {
            window.worldRadarPage.highlightEntity(ent);
          }
        }
      });
    });
  }
}

window.SvgRadar = SvgRadar;
