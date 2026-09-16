/**
 * StatsPanel Component
 * Displays real-time operational telemetry for Forestry, Combat & Base Defense,
 * Crafting & Smelting, Building & Construction, and Warehouse & Logistics.
 */
class StatsPanel {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.forestry = {
      logsCollected: 0,
      treesCut: 0,
      saplingsPlanted: 0,
      currentTarget: 'None',
      targetQuantity: null,
      lastSkipReason: 'None',
      status: 'Idle'
    };

    this.combat = {
      mobsDefeated: 0,
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
      currentItem: 'None',
      targetQuantity: null,
      action: 'Idle',
      status: 'Idle',
      lastResult: 'Ready'
    };

    this.building = {
      structuresBuilt: 0,
      blocksPlaced: 0,
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
      : `${this.forestry.logsCollected} logs`;

    const combatProgress = this.combat.targetQuantity
      ? `${this.combat.mobsDefeated} / ${this.combat.targetQuantity} targets`
      : `${this.combat.mobsDefeated} targets`;

    const craftingProgress = this.crafting.targetQuantity
      ? `${(this.crafting.action === 'Smelt' ? this.crafting.itemsSmelted : this.crafting.itemsCrafted)} / ${this.crafting.targetQuantity} ${this.crafting.currentItem}`
      : `${this.crafting.itemsCrafted} crafted / ${this.crafting.itemsSmelted} smelted`;

    const buildingProgress = this.building.targetBlocks
      ? `${this.building.blocksPlaced} / ${this.building.targetBlocks} blocks (${this.building.progressPercent}%)`
      : `${this.building.blocksPlaced} blocks placed`;

    const logisticsProgress = `${this.logistics.itemsSorted} items sorted • ${this.logistics.itemsCataloged} cataloged`;

    this.container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        <!-- Forestry Telemetry Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #70a1ff; display: flex; align-items: center; gap: 8px;">
              🌲 Forestry Telemetry
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.forestry.status === 'Active' ? '#2ed573' : '#747d8c'}; color: #fff;">
              ${this.forestry.status}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">LOGS COLLECTED</div>
              <div style="font-size: 16px; font-weight: bold; color: #2ed573;">${this.forestry.logsCollected}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">TREES CUT</div>
              <div style="font-size: 16px; font-weight: bold; color: #70a1ff;">${this.forestry.treesCut}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">SAPLINGS PLANTED</div>
              <div style="font-size: 16px; font-weight: bold; color: #ffa502;">${this.forestry.saplingsPlanted}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">TARGET SPECIES</div>
              <div style="font-size: 13px; font-weight: 600; color: #eccc68; margin-top: 2px;">${this.forestry.currentTarget}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #a4b0be;">Progress:</span>
              <span style="font-weight: 600; color: #fff;">${forestryProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Last Skip:</span>
              <span style="color: #ff6b81; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.forestry.lastSkipReason}">
                ${this.forestry.lastSkipReason}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #2ed573; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('chop trees')">
              Chop Trees
            </button>
            <button type="button" class="btn btn-sm" style="background: #3742fa; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('cut 64 oak logs')">
              64 Oak Logs
            </button>
          </div>
        </div>

        <!-- Combat & Defense Telemetry Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #ff4757; display: flex; align-items: center; gap: 8px;">
              ⚔️ Combat & Defense
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.combat.status === 'Engaged' ? '#ff4757' : (this.combat.status === 'Guarding' ? '#ffa502' : '#747d8c')}; color: #fff;">
              ${this.combat.status}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">MOBS ELIMINATED</div>
              <div style="font-size: 16px; font-weight: bold; color: #ff4757;">${this.combat.mobsDefeated}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">STRIKES LANDED</div>
              <div style="font-size: 16px; font-weight: bold; color: #70a1ff;">${this.combat.hitsDealt}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">COMBAT MODE</div>
              <div style="font-size: 13px; font-weight: 600; color: #eccc68; margin-top: 2px;">${this.combat.mode}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">CURRENT THREAT</div>
              <div style="font-size: 13px; font-weight: 600; color: #ff6b81; margin-top: 2px;">${this.combat.currentTarget}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #a4b0be;">Progress:</span>
              <span style="font-weight: 600; color: #fff;">${combatProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Latest Alert:</span>
              <span style="color: #2ed573; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.combat.lastAlert}">
                ${this.combat.lastAlert}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #ff4757; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('clear hostiles')">
              Clear Hostiles
            </button>
            <button type="button" class="btn btn-sm" style="background: #ffa502; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('protect me')">
              Protect Me
            </button>
            <button type="button" class="btn btn-sm" style="background: #5352ed; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('patrol base')">
              Patrol Base
            </button>
          </div>
        </div>

        <!-- Crafting & Smelting Telemetry Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #eccc68; display: flex; align-items: center; gap: 8px;">
              🔨 Crafting & Smelting
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.crafting.status === 'Active' ? '#2ed573' : (this.crafting.status === 'Smelting' ? '#ffa502' : '#747d8c')}; color: #fff;">
              ${this.crafting.status}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">ITEMS CRAFTED</div>
              <div style="font-size: 16px; font-weight: bold; color: #2ed573;">${this.crafting.itemsCrafted}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">ITEMS SMELTED</div>
              <div style="font-size: 16px; font-weight: bold; color: #ffa502;">${this.crafting.itemsSmelted}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">ACTION</div>
              <div style="font-size: 13px; font-weight: 600; color: #70a1ff; margin-top: 2px;">${this.crafting.action}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">CURRENT ITEM</div>
              <div style="font-size: 13px; font-weight: 600; color: #eccc68; margin-top: 2px;">${this.crafting.currentItem}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #a4b0be;">Progress:</span>
              <span style="font-weight: 600; color: #fff;">${craftingProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Latest Status:</span>
              <span style="color: #2ed573; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.crafting.lastResult}">
                ${this.crafting.lastResult}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #2ed573; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('craft stone pickaxe')">
              Stone Pickaxe
            </button>
            <button type="button" class="btn btn-sm" style="background: #ffa502; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('craft 16 torches')">
              16 Torches
            </button>
            <button type="button" class="btn btn-sm" style="background: #ff4757; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('smelt 8 raw iron')">
              Smelt Iron
            </button>
            <button type="button" class="btn btn-sm" style="background: #5352ed; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('craft crafting table')">
              Craft Table
            </button>
          </div>
        </div>

        <!-- Building & Construction Telemetry Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #1e90ff; display: flex; align-items: center; gap: 8px;">
              🏛️ Building & Architecture
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.building.status === 'Active' ? '#2ed573' : '#747d8c'}; color: #fff;">
              ${this.building.status}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">BLOCKS PLACED</div>
              <div style="font-size: 16px; font-weight: bold; color: #2ed573;">${this.building.blocksPlaced}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">STRUCTURES BUILT</div>
              <div style="font-size: 16px; font-weight: bold; color: #1e90ff;">${this.building.structuresBuilt}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">STRUCTURE TYPE</div>
              <div style="font-size: 13px; font-weight: 600; color: #eccc68; margin-top: 2px;">${this.building.currentStructure}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">MATERIAL</div>
              <div style="font-size: 13px; font-weight: 600; color: #70a1ff; margin-top: 2px;">${this.building.material}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #a4b0be;">Progress:</span>
              <span style="font-weight: 600; color: #fff;">${buildingProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Status:</span>
              <span style="color: #2ed573; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.building.lastStatus}">
                ${this.building.lastStatus}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #2ed573; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('build shelter')">
              Shelter
            </button>
            <button type="button" class="btn btn-sm" style="background: #1e90ff; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('build wall 10x3 with cobblestone')">
              10x3 Wall
            </button>
            <button type="button" class="btn btn-sm" style="background: #ffa502; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('build floor 5x5 with oak_planks')">
              5x5 Floor
            </button>
            <button type="button" class="btn btn-sm" style="background: #5352ed; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('build stairs 5')">
              Stairs
            </button>
          </div>
        </div>

        <!-- Warehouse & Logistics Telemetry Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #a55eea; display: flex; align-items: center; gap: 8px;">
              📦 Warehouse & Logistics
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.logistics.status === 'Active' ? '#2ed573' : '#747d8c'}; color: #fff;">
              ${this.logistics.status}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">CHESTS INDEXED</div>
              <div style="font-size: 16px; font-weight: bold; color: #a55eea;">${this.logistics.chestsIndexed}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">ITEMS CATALOGED</div>
              <div style="font-size: 16px; font-weight: bold; color: #2ed573;">${this.logistics.itemsCataloged}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">ITEMS SORTED</div>
              <div style="font-size: 16px; font-weight: bold; color: #70a1ff;">${this.logistics.itemsSorted}</div>
            </div>
            <div style="background: #242936; padding: 8px 10px; border-radius: 6px;">
              <div style="color: #a4b0be; font-size: 10px;">LAST KIT</div>
              <div style="font-size: 13px; font-weight: 600; color: #eccc68; margin-top: 2px;">${this.logistics.lastKit}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="color: #a4b0be;">Overview:</span>
              <span style="font-weight: 600; color: #fff;">${logisticsProgress}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Status:</span>
              <span style="color: #2ed573; font-style: italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.logistics.lastStatus}">
                ${this.logistics.lastStatus}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #a55eea; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('sort warehouse')">
              Sort Warehouse
            </button>
            <button type="button" class="btn btn-sm" style="background: #2ed573; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('index chests')">
              Index Chests
            </button>
            <button type="button" class="btn btn-sm" style="background: #ffa502; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('restock miner')">
              Restock Miner
            </button>
            <button type="button" class="btn btn-sm" style="background: #ff4757; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('restock warrior')">
              Restock Warrior
            </button>
          </div>
        </div>

        <!-- Ambient & Homestead Routine Card -->
        <div class="panel" style="background: #1a1e29; border-radius: 8px; padding: 16px; border: 1px solid #2f3640;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 style="margin: 0; font-size: 14px; color: #1dd1a1; display: flex; align-items: center; gap: 8px;">
              🏡 Ambient Homestead Telemetry
            </h3>
            <span style="font-size: 11px; padding: 2px 8px; border-radius: 4px; background: ${this.ambient.enabled ? (this.ambient.status === 'Sleeping' ? '#5f27cd' : '#1dd1a1') : '#747d8c'}; color: #fff;">
              ${this.ambient.enabled ? this.ambient.status : 'Disabled'}
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; text-align: center;">
            <div style="background: #242936; padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #a4b0be; text-transform: uppercase;">Times Slept</div>
              <div style="font-size: 16px; font-weight: bold; color: #5f27cd;">${this.ambient.timesSlept}</div>
            </div>
            <div style="background: #242936; padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #a4b0be; text-transform: uppercase;">Items Eaten</div>
              <div style="font-size: 16px; font-weight: bold; color: #ff9f43;">${this.ambient.itemsEaten}</div>
            </div>
            <div style="background: #242936; padding: 8px; border-radius: 6px;">
              <div style="font-size: 10px; color: #a4b0be; text-transform: uppercase;">Routine Mode</div>
              <div style="font-size: 13px; font-weight: 600; color: #1dd1a1; margin-top: 2px;">${this.ambient.enabled ? 'Auto' : 'Off'}</div>
            </div>
          </div>

          <div style="margin-top: 8px; font-size: 11px; background: #242936; padding: 6px 10px; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #a4b0be;">Current Activity:</span>
              <span style="color: #1dd1a1; font-style: italic; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.ambient.lastActivity}">
                ${this.ambient.lastActivity}
              </span>
            </div>
          </div>

          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn-sm" style="background: #1dd1a1; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('enable ambient')">
              Enable Ambient
            </button>
            <button type="button" class="btn btn-sm" style="background: #747d8c; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('disable ambient')">
              Disable Ambient
            </button>
            <button type="button" class="btn btn-sm" style="background: #5f27cd; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('sleep')">
              Sleep in Bed
            </button>
            <button type="button" class="btn btn-sm" style="background: #ff6b6b; color: #fff; font-size: 11px; padding: 3px 6px;" onclick="window.dashboard.quickFillCommand('wake up')">
              Wake Up
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // --- Forestry Updates ---
  updateForestryStarted(data) {
    this.forestry.status = 'Active';
    this.forestry.currentTarget = data.treeFamily || 'any';
    this.forestry.targetQuantity = data.targetQuantity || null;
    this.render();
  }

  updateLogCut(data) {
    this.forestry.logsCollected = data.logsCollected;
    this.forestry.currentTarget = data.family || this.forestry.currentTarget;
    this.render();
  }

  updateTreeCompleted(data) {
    this.forestry.treesCut = data.treesCut;
    this.forestry.logsCollected = data.logsCollected;
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
    this.forestry.logsCollected = data.logsCollected;
    this.forestry.treesCut = data.treesCut;
    this.forestry.saplingsPlanted = data.saplingsPlanted;
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
    this.render();
  }

  updateCombatMobKilled(data) {
    this.combat.mobsDefeated = data.mobsDefeated;
    this.combat.lastAlert = `Eliminated ${data.mobType}`;
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
    this.combat.mobsDefeated = data.mobsDefeated;
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
    this.crafting.lastResult = `Crafted ${data.item}`;
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
    this.crafting.lastResult = `Smelted ${data.item}`;
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
    this.building.lastStatus = `Building ${data.structure} (${data.totalBlocks} blocks)`;
    this.render();
  }

  updateBlockPlaced(data) {
    this.building.blocksPlaced++;
    if (data.percent !== undefined) {
      this.building.progressPercent = data.percent;
    }
    this.building.lastStatus = `Placed ${data.blockType} (${data.progress || ''})`;
    this.render();
  }

  updateBuildingCompleted(data) {
    this.building.status = 'Idle';
    this.building.structuresBuilt++;
    this.building.blocksPlaced = data.blocksPlaced || this.building.blocksPlaced;
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
    this.logistics.lastStatus = `Indexed ${data.label} (${data.itemCount} items)`;
    this.render();
  }

  updateItemTransferred(data) {
    if (data.action === 'deposit') {
      this.logistics.itemsSorted += (data.count || 0);
      this.logistics.lastStatus = `Sorted ${data.count} items into ${data.category}`;
    } else {
      this.logistics.lastStatus = `Retrieved ${data.count}x ${data.item}`;
    }
    this.render();
  }

  updateLogisticsCompleted(data) {
    this.logistics.status = 'Idle';
    if (data.mode === 'restock' && data.result) {
      this.logistics.lastKit = data.result.kitName || 'default';
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
