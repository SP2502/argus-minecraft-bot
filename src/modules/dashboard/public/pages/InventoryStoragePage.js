/**
 * InventoryStoragePage - Full loadout inspection and warehouse storage console.
 * Features:
 * - 36-slot Minecraft matrix with tool durability and category search.
 * - Warehouse indexed chests overview.
 * - Autonomous restock kit directives (Miner, Warrior, Lumberjack).
 */
class InventoryStoragePage {
  constructor() {}

  mount(container) {
    this.container = container;
    this.render();
    this.matrix = new InventoryMatrix('pageInventoryMatrixContainer');
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="inventory-page-container">
        
        <div class="hero-page-header" style="grid-column: 1 / -1;">
          <h1>Storage & Loadout</h1>
          <p>Real-time 36-slot Minecraft player inventory, durability analytics, and warehouse storage container index.</p>
        </div>

        <!-- Left Pane: 36-Slot Loadout Grid -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('inventory', { size: 18 })}
              <span>Bot Loadout Matrix</span>
            </h3>
            <span class="badge badge-cyan" id="invMatrixSlotCount">36 Slots</span>
          </div>

          <div id="pageInventoryMatrixContainer"></div>
        </div>

        <!-- Right Pane: Warehouse Storage & Kit Restocking -->
        <div style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- Warehouse Operations Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('logistics', { size: 18 })}
                <span>Warehouse Logistics Station</span>
              </h3>
              <span class="badge badge-idle" id="warehouseStateBadge">Ready</span>
            </div>

            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">
              Central storage depot management. Index adjacent chests, catalog contents, and deposit unreserved inventory.
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
              <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10.5px; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Indexed Chests</div>
                <div style="font-size: 22px; font-weight: 700; color: var(--violet-400); margin-top: 2px;" id="warehouseChestsVal">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10.5px; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono);">Cataloged Items</div>
                <div style="font-size: 22px; font-weight: 700; color: var(--status-success); margin-top: 2px;" id="warehouseItemsVal">0</div>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button type="button" class="btn btn-outline" onclick="window.commandDeckPage.fillAndSend('sort warehouse')" style="justify-content: center;">
                ${SvgIcons.get('logistics', { size: 16 })}
                <span>Sort Warehouse Chests</span>
              </button>
              <button type="button" class="btn btn-outline" onclick="window.commandDeckPage.fillAndSend('index chests')" style="justify-content: center;">
                ${SvgIcons.get('tasks', { size: 16 })}
                <span>Index All Nearby Chests</span>
              </button>
            </div>
          </div>

          <!-- Autonomous Kit Restock Directives -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('crafting', { size: 18 })}
                <span>Autonomous Kit Restocking</span>
              </h3>
              <span class="badge badge-idle">Presets</span>
            </div>

            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 12px;">
              Dispatch autonomous restock routines to retrieve tools, torches, and rations from depot chests.
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.commandDeckPage.fillAndSend('restock miner')">
                <span>Miner Kit</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.commandDeckPage.fillAndSend('restock warrior')">
                <span>Warrior Kit</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.commandDeckPage.fillAndSend('restock lumberjack')">
                <span>Lumberjack Kit</span>
              </button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('deposit all')">
                <span>Deposit Excess</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  subscribeToState() {
    window.dashboardState.subscribe('domains', (domains) => {
      if (domains.logistics) {
        const chestsEl = this.container.querySelector('#warehouseChestsVal');
        const itemsEl = this.container.querySelector('#warehouseItemsVal');
        if (chestsEl) chestsEl.textContent = String(domains.logistics.chestsIndexed || 0);
        if (itemsEl) itemsEl.textContent = String(domains.logistics.itemsSorted || 0);
      }
    });
  }
}

window.inventoryStoragePage = new InventoryStoragePage();
