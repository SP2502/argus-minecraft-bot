/**
 * InventoryMatrix - Interactive 36-slot Minecraft loadout grid.
 * Supports hotbar separation, tool durability indicators, item search, and category filtering.
 */
class InventoryMatrix {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.slots = new Array(36).fill(null);
    this.searchQuery = '';
    this.activeCategory = 'ALL';

    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- Filter & Search Bar -->
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="position: relative; flex: 1; min-width: 180px;">
            <input type="text" id="invSearchInput" class="form-input" placeholder="Search loadout & items..." style="padding-left: 32px;">
            <span style="position: absolute; left: 10px; top: 10px; color: var(--text-muted);">
              ${SvgIcons.get('search', { size: 14 })}
            </span>
          </div>

          <div style="display: flex; gap: 6px;" id="invCategoryFilterBtns">
            <button type="button" class="btn btn-outline btn-sm active" data-category="ALL">All</button>
            <button type="button" class="btn btn-outline btn-sm" data-category="EQUIPMENT">Tools</button>
            <button type="button" class="btn btn-outline btn-sm" data-category="RESOURCES">Ores</button>
            <button type="button" class="btn btn-outline btn-sm" data-category="FOOD">Food</button>
          </div>
        </div>

        <!-- 36-Slot Loadout Grid Container -->
        <div style="background: #040812; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 14px; display: flex; flex-direction: column; gap: 6px;">
          
          <!-- Main Inventory (Slots 0 - 26) -->
          <div class="inv-matrix-grid" id="mainInventoryGrid"></div>

          <!-- Hotbar Divider -->
          <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(0, 229, 255, 0.4), transparent); margin: 6px 0;"></div>

          <!-- Hotbar (Slots 27 - 35) -->
          <div class="inv-matrix-grid" id="hotbarInventoryGrid"></div>
        </div>

        <!-- Capacity & Loadout Summary Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">
          <span>Used Slots: <strong style="color: #fff;" id="invUsedSlotsText">0 / 36</strong></span>
          <span id="invDegradationStatus" style="color: var(--status-success);">Equipment Integrity: Normal</span>
        </div>

      </div>
    `;
    this.populateSlots();
  }

  attachEventListeners() {
    const searchInput = this.container.querySelector('#invSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.populateSlots();
      });
    }

    const catBtns = this.container.querySelectorAll('#invCategoryFilterBtns button');
    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
        btn.classList.add('active', 'btn-primary');
        this.activeCategory = btn.getAttribute('data-category');
        this.populateSlots();
      });
    });
  }

  subscribeToState() {
    window.dashboardState.subscribe('inventory', (inv) => {
      if (inv && Array.isArray(inv.slots)) {
        this.slots = inv.slots;
      }
      this.populateSlots();
    });

    window.dashboardState.subscribe('tools', (tools) => {
      const statusEl = this.container.querySelector('#invDegradationStatus');
      if (statusEl && tools) {
        if (tools.isAboutToBreak) {
          statusEl.textContent = 'Equipment Warning: Tool <5% Durability';
          statusEl.style.color = 'var(--status-danger)';
        } else {
          statusEl.textContent = 'Equipment Integrity: Normal';
          statusEl.style.color = 'var(--status-success)';
        }
      }
    });
  }

  populateSlots() {
    const mainGrid = this.container.querySelector('#mainInventoryGrid');
    const hotbarGrid = this.container.querySelector('#hotbarInventoryGrid');
    const usedText = this.container.querySelector('#invUsedSlotsText');
    if (!mainGrid || !hotbarGrid) return;

    let mainHtml = '';
    let hotbarHtml = '';
    let usedCount = 0;

    for (let i = 0; i < 36; i++) {
      const item = this.slots[i];
      const isHotbar = i >= 27;
      if (item && item.name) usedCount++;

      const isMatch = this.matchesFilter(item);
      const slotMarkup = this.renderSlot(i, isMatch ? item : null, isHotbar);

      if (isHotbar) {
        hotbarHtml += slotMarkup;
      } else {
        mainHtml += slotMarkup;
      }
    }

    mainGrid.innerHTML = mainHtml;
    hotbarGrid.innerHTML = hotbarHtml;

    if (usedText) {
      usedText.textContent = `${usedCount} / 36`;
    }
  }

  matchesFilter(item) {
    if (!item) return false;
    if (this.searchQuery && !item.name.toLowerCase().includes(this.searchQuery)) {
      return false;
    }
    if (this.activeCategory === 'ALL') return true;

    const name = item.name.toLowerCase();
    if (this.activeCategory === 'EQUIPMENT') {
      return name.includes('pickaxe') || name.includes('axe') || name.includes('sword') || name.includes('shovel') || name.includes('helmet') || name.includes('chestplate') || name.includes('shield');
    }
    if (this.activeCategory === 'RESOURCES') {
      return name.includes('ore') || name.includes('ingot') || name.includes('diamond') || name.includes('coal') || name.includes('raw_');
    }
    if (this.activeCategory === 'FOOD') {
      return name.includes('bread') || name.includes('apple') || name.includes('beef') || name.includes('pork') || name.includes('carrot') || name.includes('baked_potato');
    }
    return true;
  }

  renderSlot(index, item, isHotbar) {
    const slotNumber = isHotbar ? `<span class="slot-number">${index - 26}</span>` : '';
    if (!item) {
      return `<div class="inv-slot-box ${isHotbar ? 'hotbar' : ''}" title="Empty Slot ${index + 1}">${slotNumber}</div>`;
    }

    const cleanName = item.name.replace(/_/g, ' ');
    const durability = typeof item.durability === 'number' ? item.durability : null;
    let durBar = '';
    if (durability !== null) {
      const durColor = durability <= 5 ? 'var(--status-danger)' : (durability <= 20 ? 'var(--status-warning)' : 'var(--status-success)');
      durBar = `<div style="position: absolute; bottom: 1px; left: 3px; right: 3px; height: 2px; background: ${durColor}; border-radius: 1px;"></div>`;
    }

    const countLabel = item.count > 1 ? `<span class="item-count">${item.count}</span>` : '';

    return `
      <div class="inv-slot-box ${isHotbar ? 'hotbar' : ''}" title="${Formatters.escapeHtml(cleanName)} (${item.count || 1})">
        ${slotNumber}
        <span class="item-label">${Formatters.escapeHtml(cleanName)}</span>
        ${countLabel}
        ${durBar}
      </div>
    `;
  }
}

window.InventoryMatrix = InventoryMatrix;
