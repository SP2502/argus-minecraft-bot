/**
 * InventoryGrid Component
 * Renders player inventory as an interactive 9x4 slot matrix with hotbar separation,
 * durability bars for damaged tools, and real item stack counts.
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
    let html = '<div class="inv-row" style="margin-bottom: 6px;">';
    // Main inventory slots 0-26 (slots 9-35 in Minecraft indexing)
    for (let i = 0; i < 27; i++) {
      if (i > 0 && i % 9 === 0) {
        html += '</div><div class="inv-row" style="margin-bottom: 6px;">';
      }
      html += this.renderSlotHtml(i, this.slots[i]);
    }
    html += '</div>';

    // Hotbar divider
    html += `<div class="hotbar-divider"></div>`;

    // Hotbar slots 27-35 (slots 36-44 in Minecraft indexing)
    html += '<div class="inv-row">';
    for (let i = 27; i < 36; i++) {
      html += this.renderSlotHtml(i, this.slots[i], true);
    }
    html += '</div>';

    return html;
  }

  renderSlotHtml(index, item, isHotbar = false) {
    const hotbarNum = isHotbar ? `<span style="position: absolute; top: 2px; left: 3px; font-size: 8px; color: var(--text-muted);">${index - 26}</span>` : '';

    if (!item) {
      return `
        <div class="inv-slot ${isHotbar ? 'hotbar-slot' : ''}" title="Empty Slot ${index + 1}">
          ${hotbarNum}
        </div>
      `;
    }

    const cleanName = item.name.replace(/_/g, ' ');
    const durability = typeof item.durability === 'number' ? item.durability : null;
    const durClass = durability !== null ? (durability <= 5 ? 'crit' : durability <= 20 ? 'warn' : '') : '';
    const durBar = durability !== null ? `<div class="inv-durability-bar ${durClass}" style="width: ${durability}%;"></div>` : '';

    const title = `${cleanName} (Count: ${item.count || 1})${durability !== null ? ` • ${durability}% Durability` : ''}`;

    return `
      <div class="inv-slot ${isHotbar ? 'hotbar-slot' : ''}" title="${title}">
        ${hotbarNum}
        <span class="inv-slot-name">${cleanName}</span>
        ${item.count > 1 ? `<span class="inv-slot-count">${item.count}</span>` : ''}
        ${durBar}
      </div>
    `;
  }

  updateInventory(items) {
    this.slots = new Array(36).fill(null);

    if (Array.isArray(items)) {
      items.forEach((item, idx) => {
        if (!item) return;
        // Map slot index appropriately
        const slotIdx = item.slot !== undefined ? item.slot : idx;
        if (slotIdx >= 0 && slotIdx < 36) {
          this.slots[slotIdx] = item;
        } else if (idx < 36) {
          this.slots[idx] = item;
        }
      });
    }

    this.render();
  }
}
