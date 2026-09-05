/**
 * InventoryGrid Component
 * Renders player inventory as a 9x4 interactive slot grid with tooltips and counts.
 */
class InventoryGrid {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.slots = new Array(36).fill(null);
    this.render();
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="inventory-grid-container" id="inventorySlotsContainer">
        ${this.generateSlotsHtml()}
      </div>
    `;
  }

  generateSlotsHtml() {
    let html = '';
    // Main inventory slots 0-26 (slots 9-35 in Minecraft indexing)
    for (let i = 0; i < 27; i++) {
      const item = this.slots[i];
      html += this.renderSlotHtml(i, item);
    }
    // Hotbar divider
    html += `<div class="hotbar-divider"></div>`;
    // Hotbar slots 27-35 (slots 36-44 in Minecraft indexing)
    for (let i = 27; i < 36; i++) {
      const item = this.slots[i];
      html += this.renderSlotHtml(i, item, true);
    }
    return html;
  }

  renderSlotHtml(index, item, isHotbar = false) {
    if (!item) {
      return `<div class="inv-slot ${isHotbar ? 'hotbar-slot' : ''}" title="Empty Slot ${index + 1}"></div>`;
    }

    const cleanName = item.name.replace(/_/g, ' ');
    const title = `${cleanName} (x${item.count})${item.durability ? ` - ${item.durability}% Durability` : ''}`;

    return `
      <div class="inv-slot ${isHotbar ? 'hotbar-slot' : ''}" title="${title}">
        <span class="inv-slot-name">${cleanName}</span>
        <span class="inv-slot-count">${item.count > 1 ? item.count : ''}</span>
      </div>
    `;
  }

  updateInventory(items) {
    this.slots = new Array(36).fill(null);

    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        // Map slot index appropriately
        const slotIdx = item.slot !== undefined ? item.slot : idx;
        if (slotIdx >= 0 && slotIdx < 36) {
          this.slots[slotIdx] = item;
        } else if (idx < 36) {
          this.slots[idx] = item;
        }
      });
    }

    const gridContainer = document.getElementById('inventorySlotsContainer');
    if (gridContainer) {
      gridContainer.innerHTML = this.generateSlotsHtml();
    }
  }
}

window.InventoryGrid = InventoryGrid;
