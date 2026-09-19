/**
 * StatsPanel Component (Redesigned)
 * Displays real-time operational telemetry for Forestry, Combat & Base Defense,
 * Crafting & Smelting, Building & Construction, Warehouse & Logistics, and Ambient Homestead.
 * Renders real persisted and live streamed data with Obsidian Glassmorphism styling.
 */
class StatsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.forestry = {
      logsCollected: 0,
      treesCut: 0,
      saplingsPlanted: 0,
      applesCollected: 0,
      skippedTrees: 0,
      currentTarget: 'None',
      targetQuantity: null,
      lastSkipReason: 'None',
      status: 'Idle'
    };

    this.combat = {
      mobsDefeated: 0,
      damageDealt: 0,
      damageTaken: 0,
      deaths: 0,
      currentTarget: 'None',
      targetQuantity: null,
      mode: 'Idle',
      status: 'Idle',
      hitsDealt: 0,
      lastAlert: 'All clear'
    };

    this.crafting = {
      itemsCrafted: 0,
      itemsSmelted: 0,
      recipesResolved: 0,
      currentItem: 'None',
      targetQuantity: null,
      action: 'Idle',
      status: 'Idle',
      lastResult: 'Ready'
    };

    this.building = {
      structuresBuilt: 0,
      blocksPlaced: 0,
      scaffoldingUsed: 0,
      currentStructure: 'None',
      targetBlocks: null,
      material: 'cobblestone',
      status: 'Idle',
      progressPercent: 0,
      lastStatus: 'Ready'
    };

    this.logistics = {
      chestsIndexed: 0,
      itemsSorted: 0,
      itemsCataloged: 0,
      kitsRestocked: 0,
      lastKit: 'None',
      status: 'Idle',
      lastStatus: 'Ready'
    };

    this.ambient = {
      enabled: true,
      status: 'Active',
      timesSlept: 0,
      itemsEaten: 0,
      lastActivity: 'Idle'
    };

    this.render();
  }

  render() {
    if (!this.container) return;

    const forestryProgress = this.forestry.targetQuantity
      ? `${this.forestry.logsCollected} / ${this.forestry.targetQuantity} logs`
      : `${this.forestry.logsCollected} logs collected`;

    const combatProgress = this.combat.targetQuantity
      ? `${this.combat.mobsDefeated} / ${this.combat.targetQuantity} targets`
      : `${this.combat.mobsDefeated} mobs eliminated`;

    const craftingProgress = this.crafting.targetQuantity
      ? `${(this.crafting.action === 'Smelt' ? this.crafting.itemsSmelted : this.crafting.itemsCrafted)} / ${this.crafting.targetQuantity} ${this.crafting.currentItem}`
      : `${this.crafting.itemsCrafted} crafted • ${this.crafting.itemsSmelted} smelted`;

    const buildingProgress = this.building.targetBlocks
      ? `${this.building.blocksPlaced} / ${this.building.targetBlocks} blocks (${this.building.progressPercent}%)`
      : `${this.building.blocksPlaced} blocks placed`;

    const logisticsProgress = `${this.logistics.itemsSorted} items sorted • ${this.logistics.chestsIndexed} chests indexed`;

    this.container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">

        <!-- Forestry Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-emerald);">Forestry Telemetry</h3>
            <span class="badge ${this.forestry.status === 'Active' ? 'badge-online' : 'badge-offline'}">
              <span class="badge-dot"></span>
              <span>${this.forestry.status}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">LOGS COLLECTED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-emerald); margin-top: 2px;">${this.forestry.logsCollected}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">TREES CUT</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-cyan); margin-top: 2px;">${this.forestry.treesCut}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">SAPLINGS PLANTED</div>
              <div style="font-size: 18px; font-weight: 600; color: var(--accent-amber); margin-top: 2px;">${this.forestry.saplingsPlanted}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">TARGET SPECIES</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.forestry.currentTarget}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Progress:</span>
              <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${forestryProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Last Status:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.forestry.lastSkipReason}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.15); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.3);" onclick="window.dashboard.quickFillCommand('chop trees')">
              Chop Trees
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.3);" onclick="window.dashboard.quickFillCommand('cut 64 oak logs')">
              64 Oak Logs
            </button>
          </div>
        </div>

        <!-- Combat & Defense Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-rose);">Combat & Defense</h3>
            <span class="badge ${this.combat.status === 'Engaged' ? 'badge-auth' : (this.combat.status === 'Guarding' ? 'badge' : 'badge-offline')}" style="${this.combat.status === 'Engaged' ? 'background: rgba(255, 71, 87, 0.2); color: var(--accent-rose); border-color: rgba(255, 71, 87, 0.4);' : ''}">
              <span class="badge-dot" style="${this.combat.status === 'Engaged' ? 'background: var(--accent-rose);' : ''}"></span>
              <span>${this.combat.status}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">MOBS ELIMINATED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-rose); margin-top: 2px;">${this.combat.mobsDefeated}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">DAMAGE DEALT</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-cyan); margin-top: 2px;">${this.combat.damageDealt || this.combat.hitsDealt}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">COMBAT MODE</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-amber); margin-top: 4px;">${this.combat.mode}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">CURRENT THREAT</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-rose); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.combat.currentTarget}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Progress:</span>
              <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${combatProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Latest Alert:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.combat.lastAlert}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(255, 71, 87, 0.15); color: var(--accent-rose); border: 1px solid rgba(255, 71, 87, 0.3);" onclick="window.dashboard.quickFillCommand('clear hostiles')">
              Clear Hostiles
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(255, 165, 2, 0.15); color: var(--accent-amber); border: 1px solid rgba(255, 165, 2, 0.3);" onclick="window.dashboard.quickFillCommand('protect me')">
              Protect Me
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.3);" onclick="window.dashboard.quickFillCommand('patrol base')">
              Patrol Base
            </button>
          </div>
        </div>

        <!-- Crafting & Smelting Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-amber);">Crafting & Smelting</h3>
            <span class="badge ${this.crafting.status === 'Active' ? 'badge-online' : 'badge-offline'}">
              <span class="badge-dot"></span>
              <span>${this.crafting.status}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">ITEMS CRAFTED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-emerald); margin-top: 2px;">${this.crafting.itemsCrafted}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">ITEMS SMELTED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-amber); margin-top: 2px;">${this.crafting.itemsSmelted}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">ACTION</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-cyan); margin-top: 4px;">${this.crafting.action}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">RECIPES RESOLVED</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-top: 4px;">${this.crafting.recipesResolved || 0}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Overview:</span>
              <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${craftingProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Latest Result:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.crafting.lastResult}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.15); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.3);" onclick="window.dashboard.quickFillCommand('craft stone pickaxe')">
              Stone Pickaxe
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(255, 165, 2, 0.15); color: var(--accent-amber); border: 1px solid rgba(255, 165, 2, 0.3);" onclick="window.dashboard.quickFillCommand('craft 16 torches')">
              16 Torches
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.3);" onclick="window.dashboard.quickFillCommand('smelt 8 raw iron')">
              Smelt Iron
            </button>
          </div>
        </div>

        <!-- Building & Construction Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-indigo);">Architecture & Construction</h3>
            <span class="badge ${this.building.status === 'Active' ? 'badge-online' : 'badge-offline'}">
              <span class="badge-dot"></span>
              <span>${this.building.status}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">BLOCKS PLACED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-emerald); margin-top: 2px;">${this.building.blocksPlaced}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">STRUCTURES BUILT</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-indigo); margin-top: 2px;">${this.building.structuresBuilt}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">STRUCTURE TYPE</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-amber); margin-top: 4px;">${this.building.currentStructure}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">MATERIAL</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-cyan); margin-top: 4px;">${this.building.material}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Progress:</span>
              <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${buildingProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Status:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.building.lastStatus}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.15); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.3);" onclick="window.dashboard.quickFillCommand('build shelter')">
              Build Shelter
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(99, 102, 241, 0.15); color: var(--accent-indigo); border: 1px solid rgba(99, 102, 241, 0.3);" onclick="window.dashboard.quickFillCommand('build wall 10x3 with cobblestone')">
              10x3 Wall
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.3);" onclick="window.dashboard.quickFillCommand('build floor 5x5 with oak_planks')">
              5x5 Floor
            </button>
          </div>
        </div>

        <!-- Warehouse & Logistics Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-purple);">Warehouse & Storage</h3>
            <span class="badge ${this.logistics.status === 'Active' ? 'badge-online' : 'badge-offline'}">
              <span class="badge-dot"></span>
              <span>${this.logistics.status}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">CHESTS INDEXED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-purple); margin-top: 2px;">${this.logistics.chestsIndexed}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">ITEMS SORTED</div>
              <div style="font-size: 20px; font-weight: 700; color: var(--accent-emerald); margin-top: 2px;">${this.logistics.itemsSorted}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">KITS RESTOCKED</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-cyan); margin-top: 4px;">${this.logistics.kitsRestocked || 0}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-family: var(--font-mono);">LAST KIT</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-amber); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.logistics.lastKit}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Overview:</span>
              <span style="font-weight: 600; color: var(--text-main); font-family: var(--font-mono);">${logisticsProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Status:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.logistics.lastStatus}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(168, 85, 247, 0.15); color: var(--accent-purple); border: 1px solid rgba(168, 85, 247, 0.3);" onclick="window.dashboard.quickFillCommand('sort warehouse')">
              Sort Warehouse
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.15); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.3);" onclick="window.dashboard.quickFillCommand('index chests')">
              Index Chests
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(255, 165, 2, 0.15); color: var(--accent-amber); border: 1px solid rgba(255, 165, 2, 0.3);" onclick="window.dashboard.quickFillCommand('restock miner')">
              Restock Miner
            </button>
          </div>
        </div>

        <!-- Ambient Homestead Telemetry Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--accent-cyan);">Ambient Homestead</h3>
            <span class="badge ${this.ambient.enabled ? 'badge-online' : 'badge-offline'}">
              <span class="badge-dot"></span>
              <span>${this.ambient.enabled ? (this.ambient.status || 'Active') : 'Disabled'}</span>
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px; text-align: center;">
            <div style="background: rgba(0,0,0,0.25); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; font-family: var(--font-mono);">TIMES SLEPT</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--accent-purple); margin-top: 2px;">${this.ambient.timesSlept}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; font-family: var(--font-mono);">ITEMS EATEN</div>
              <div style="font-size: 18px; font-weight: 700; color: var(--accent-amber); margin-top: 2px;">${this.ambient.itemsEaten}</div>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 10px 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; font-family: var(--font-mono);">MODE</div>
              <div style="font-size: 14px; font-weight: 600; color: var(--accent-cyan); margin-top: 4px;">${this.ambient.enabled ? 'Auto' : 'Off'}</div>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; border: 1px solid var(--border-subtle); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--text-muted);">Current Activity:</span>
              <span style="color: var(--accent-emerald); font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.ambient.lastActivity}</span>
            </div>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: rgba(168, 85, 247, 0.15); color: var(--accent-purple); border: 1px solid rgba(168, 85, 247, 0.3);" onclick="window.dashboard.quickFillCommand('sleep')">
              Sleep in Bed
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.15); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.3);" onclick="window.dashboard.quickFillCommand('wake up')">
              Wake Up
            </button>
            <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.15); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.3);" onclick="window.dashboard.quickFillCommand('enable ambient')">
              Enable Routine
            </button>
          </div>
        </div>

      </div>
    `;
  }

  // --- Batch Updates from REST Telemetry Sync ---
  updateForestry(stats) {
    if (!stats) return;
    this.forestry.logsCollected = stats.logsCollected ?? this.forestry.logsCollected;
    this.forestry.treesCut = stats.treesCut ?? this.forestry.treesCut;
    this.forestry.saplingsPlanted = stats.saplingsPlanted ?? this.forestry.saplingsPlanted;
    this.forestry.applesCollected = stats.applesCollected ?? this.forestry.applesCollected;
    this.forestry.skippedTrees = stats.skippedTrees ?? this.forestry.skippedTrees;
    this.render();
  }

  updateCombat(stats) {
    if (!stats) return;
    this.combat.mobsDefeated = stats.mobsKilled ?? stats.mobsDefeated ?? this.combat.mobsDefeated;
    this.combat.damageDealt = stats.damageDealt ?? this.combat.damageDealt;
    this.combat.damageTaken = stats.damageTaken ?? this.combat.damageTaken;
    this.combat.deaths = stats.deaths ?? this.combat.deaths;
    this.render();
  }

  updateCrafting(stats) {
    if (!stats) return;
    this.crafting.itemsCrafted = stats.itemsCrafted ?? this.crafting.itemsCrafted;
    this.crafting.itemsSmelted = stats.itemsSmelted ?? this.crafting.itemsSmelted;
    this.crafting.recipesResolved = stats.recipesResolved ?? this.crafting.recipesResolved;
    this.render();
  }

  updateBuilding(stats) {
    if (!stats) return;
    this.building.structuresBuilt = stats.structuresBuilt ?? this.building.structuresBuilt;
    this.building.blocksPlaced = stats.blocksPlaced ?? this.building.blocksPlaced;
    this.building.scaffoldingUsed = stats.scaffoldingUsed ?? this.building.scaffoldingUsed;
    this.render();
  }

  updateLogistics(stats) {
    if (!stats) return;
    this.logistics.chestsIndexed = stats.chestsIndexed ?? this.logistics.chestsIndexed;
    this.logistics.itemsSorted = stats.itemsSorted ?? this.logistics.itemsSorted;
    this.logistics.kitsRestocked = stats.kitsRestocked ?? this.logistics.kitsRestocked;
    this.render();
  }

  updateAmbient(ambient) {
    if (!ambient) return;
    if (ambient.enabled !== undefined) this.ambient.enabled = Boolean(ambient.enabled);
    if (ambient.status) this.ambient.status = ambient.status;
    if (ambient.timesSlept !== undefined) this.ambient.timesSlept = ambient.timesSlept;
    if (ambient.itemsEaten !== undefined) this.ambient.itemsEaten = ambient.itemsEaten;
    if (ambient.lastActivity) this.ambient.lastActivity = ambient.lastActivity;
    this.render();
  }

  // --- Real-Time Stream Event Handlers ---
  updateForestryStarted(data) {
    this.forestry.status = 'Active';
    this.forestry.currentTarget = data.treeFamily || 'any';
    this.forestry.targetQuantity = data.targetQuantity || null;
    this.render();
  }

  updateLogCut(data) {
    this.forestry.logsCollected = data.logsCollected !== undefined ? data.logsCollected : (this.forestry.logsCollected + 1);
    this.forestry.currentTarget = data.family || this.forestry.currentTarget;
    this.render();
  }

  updateTreeCompleted(data) {
    this.forestry.treesCut = data.treesCut !== undefined ? data.treesCut : (this.forestry.treesCut + 1);
    if (data.logsCollected !== undefined) this.forestry.logsCollected = data.logsCollected;
    this.render();
  }

  updateReplanted(data) {
    this.forestry.saplingsPlanted += (data.count || 1);
    this.render();
  }

  updateSkipped(data) {
    this.forestry.lastSkipReason = data.reason || 'Protected / Unsafe';
    this.render();
  }

  updateForestryCompleted(data) {
    this.forestry.status = 'Idle';
    if (data.logsCollected !== undefined) this.forestry.logsCollected = data.logsCollected;
    if (data.treesCut !== undefined) this.forestry.treesCut = data.treesCut;
    if (data.saplingsPlanted !== undefined) this.forestry.saplingsPlanted = data.saplingsPlanted;
    this.render();
  }

  // --- Combat Updates ---
  updateCombatStarted(data) {
    this.combat.status = data.mode === 'guard' ? 'Guarding' : 'Engaged';
    this.combat.mode = (data.mode || 'hunt').toUpperCase();
    this.combat.currentTarget = data.targetMob || 'any';
    this.combat.targetQuantity = data.targetQuantity || null;
    this.combat.lastAlert = `Targeting ${this.combat.currentTarget}`;
    this.render();
  }

  updateCombatEngaged(data) {
    this.combat.status = 'Engaged';
    this.combat.currentTarget = data.mobType || 'Hostile';
    this.combat.lastAlert = `Engaged with ${data.mobType}`;
    this.render();
  }

  updateCombatHit(data) {
    this.combat.hitsDealt++;
    if (data.damage) this.combat.damageDealt += data.damage;
    this.render();
  }

  updateCombatMobKilled(data) {
    this.combat.mobsDefeated = data.mobsDefeated !== undefined ? data.mobsDefeated : (this.combat.mobsDefeated + 1);
    this.combat.lastAlert = `Eliminated ${data.mobType || 'target'}`;
    this.render();
  }

  updateCombatRetreat(data) {
    this.combat.status = 'Retreating';
    this.combat.lastAlert = 'Tactical retreat triggered';
    this.render();
  }

  updateCombatCompleted(data) {
    this.combat.status = 'Idle';
    this.combat.mode = 'Idle';
    if (data.mobsDefeated !== undefined) this.combat.mobsDefeated = data.mobsDefeated;
    this.combat.currentTarget = 'None';
    this.combat.lastAlert = 'Operation finished';
    this.render();
  }

  // --- Crafting & Smelting Updates ---
  updateCraftingStarted(data) {
    this.crafting.status = 'Active';
    this.crafting.action = 'Craft';
    this.crafting.currentItem = data.item || 'unknown';
    this.crafting.targetQuantity = data.quantity || 1;
    this.crafting.lastResult = `Crafting ${data.quantity || 1} ${data.item}`;
    this.render();
  }

  updateItemCrafted(data) {
    this.crafting.itemsCrafted += (data.count || 1);
    this.crafting.lastResult = `Crafted ${data.item || 'item'}`;
    this.render();
  }

  updateSmeltingStarted(data) {
    this.crafting.status = 'Smelting';
    this.crafting.action = 'Smelt';
    this.crafting.currentItem = data.item || 'unknown';
    this.crafting.targetQuantity = data.quantity || 1;
    this.crafting.lastResult = `Smelting ${data.quantity || 1} ${data.item}`;
    this.render();
  }

  updateItemSmelted(data) {
    this.crafting.itemsSmelted += (data.count || 1);
    this.crafting.lastResult = `Smelted ${data.item || 'item'}`;
    this.render();
  }

  updateCraftingCompleted(data) {
    this.crafting.status = 'Idle';
    this.crafting.action = 'Idle';
    this.crafting.lastResult = data.success ? 'Completed successfully' : 'Crafting stopped';
    this.render();
  }

  // --- Building Updates ---
  updateBuildingStarted(data) {
    this.building.status = 'Active';
    this.building.currentStructure = data.structure || 'shelter';
    this.building.material = data.material || 'cobblestone';
    this.building.targetBlocks = data.totalBlocks || null;
    this.building.blocksPlaced = 0;
    this.building.progressPercent = 0;
    this.building.lastStatus = `Building ${data.structure} (${data.totalBlocks || 0} blocks)`;
    this.render();
  }

  updateBlockPlaced(data) {
    this.building.blocksPlaced++;
    if (data.percent !== undefined) {
      this.building.progressPercent = data.percent;
    }
    this.building.lastStatus = `Placed ${data.blockType || 'block'} (${data.progress || ''})`;
    this.render();
  }

  updateBuildingCompleted(data) {
    this.building.status = 'Idle';
    this.building.structuresBuilt++;
    if (data.blocksPlaced !== undefined) this.building.blocksPlaced = data.blocksPlaced;
    this.building.progressPercent = 100;
    this.building.lastStatus = `Finished ${data.structure || 'structure'}`;
    this.render();
  }

  // --- Logistics Updates ---
  updateLogisticsStarted(data) {
    this.logistics.status = 'Active';
    this.logistics.lastStatus = `Executing logistics [${(data.mode || 'sort').toUpperCase()}]`;
    this.render();
  }

  updateChestIndexed(data) {
    this.logistics.chestsIndexed++;
    this.logistics.itemsCataloged += (data.itemCount || 0);
    this.logistics.lastStatus = `Indexed ${data.label || 'chest'} (${data.itemCount || 0} items)`;
    this.render();
  }

  updateItemTransferred(data) {
    if (data.action === 'deposit') {
      this.logistics.itemsSorted += (data.count || 0);
      this.logistics.lastStatus = `Sorted ${data.count || 0} items into ${data.category || 'storage'}`;
    } else {
      this.logistics.lastStatus = `Retrieved ${data.count || 0}x ${data.item || 'item'}`;
    }
    this.render();
  }

  updateLogisticsCompleted(data) {
    this.logistics.status = 'Idle';
    if (data.mode === 'restock' && data.result) {
      this.logistics.lastKit = data.result.kitName || 'default';
      this.logistics.kitsRestocked++;
    }
    this.logistics.lastStatus = `Logistics task finished [${(data.mode || '').toUpperCase()}]`;
    this.render();
  }

  // --- Ambient & Homestead Updates ---
  updateAmbientSleep(data) {
    this.ambient.status = 'Sleeping';
    this.ambient.timesSlept = (data && data.timesSlept) || this.ambient.timesSlept + 1;
    this.ambient.lastActivity = 'Sleeping in Bed';
    this.render();
  }

  updateAmbientWake(data) {
    this.ambient.status = 'Active';
    this.ambient.lastActivity = 'Awake and Active';
    this.render();
  }

  updateAmbientAte(data) {
    this.ambient.itemsEaten = (data && data.totalEaten) || this.ambient.itemsEaten + 1;
    this.ambient.lastActivity = `Ate ${data && data.food ? data.food : 'food'}`;
    this.render();
  }

  updateAmbientToggled(data) {
    this.ambient.enabled = Boolean(data && data.enabled);
    this.ambient.status = this.ambient.enabled ? 'Active' : 'Disabled';
    this.ambient.lastActivity = this.ambient.enabled ? 'Ambient Enabled' : 'Ambient Disabled';
    this.render();
  }
}

window.StatsPanel = StatsPanel;
