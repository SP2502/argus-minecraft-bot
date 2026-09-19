/**
 * DomainsPage - Comprehensive operational telemetry hub for all 11 Argus subsystems.
 * Subsystems: Navigation, Combat, Mining, Building, Farming, Forestry, Logistics,
 * Crafting, Behavior, ServerAuth, and Security.
 */
class DomainsPage {
  constructor() {
    this.activeSubdomain = 'ALL';
  }

  mount(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
    this.subscribeToState();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <div class="hero-page-header">
          <h1>Domain Hub</h1>
          <p>Real-time operational telemetry across all 11 autonomous Argus subsystems.</p>
        </div>

        <!-- Filter Tabs Strip -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;" id="domainFilterTabs">
          <button type="button" class="btn btn-outline btn-sm active" data-sub="ALL">All Domains</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="combat">Combat</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="forestry">Forestry</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="mining">Mining</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="crafting">Crafting</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="building">Building</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="logistics">Logistics</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="behavior">Behavior</button>
          <button type="button" class="btn btn-outline btn-sm" data-sub="serverAuth">Server Auth</button>
        </div>

        <!-- Domains Cards Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px;" id="domainsCardsGrid">
          
          <!-- 1. Combat & Perimeter Defense -->
          <div class="card domain-card" data-domain="combat">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('combat', { size: 18 })}
                <span>Combat & Defense</span>
              </h3>
              <span class="badge badge-idle" id="combatStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Mobs Eliminated</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-danger);" id="combatMobsDefeated">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Damage Dealt</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--cyan-400);" id="combatDamageDealt">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Current Target: <strong style="color: #fff;" id="combatTargetThreat">None (All clear)</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('clear hostiles')">Clear Hostiles</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('patrol base')">Patrol Base</button>
            </div>
          </div>

          <!-- 2. Forestry & Timber Operations -->
          <div class="card domain-card" data-domain="forestry">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('forestry', { size: 18 })}
                <span>Forestry & Timber</span>
              </h3>
              <span class="badge badge-idle" id="forestryStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Logs Collected</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-success);" id="forestryLogsCollected">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Trees Cut</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--cyan-400);" id="forestryTreesCut">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Replanted Saplings: <strong style="color: var(--status-warning);" id="forestrySaplingsPlanted">0</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('chop trees')">Chop Trees</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('cut 32 oak logs')">32 Oak Logs</button>
            </div>
          </div>

          <!-- 3. Mining & Subsurface Quarrying -->
          <div class="card domain-card" data-domain="mining">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('mining', { size: 18 })}
                <span>Mining & Quarrying</span>
              </h3>
              <span class="badge badge-idle" id="miningStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Blocks Mined</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--cyan-400);" id="miningBlocksMined">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Target Ore</div>
                <div style="font-size: 16px; font-weight: 600; color: #fff; margin-top: 3px;" id="miningTargetBlock">None</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Tunnel Mode: <strong style="color: #fff;">Strip Mine (Y=11)</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('mine 16 iron_ore')">Mine Iron</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('mine 8 diamond_ore')">Mine Diamonds</button>
            </div>
          </div>

          <!-- 4. Crafting & Smelting Factory -->
          <div class="card domain-card" data-domain="crafting">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('crafting', { size: 18 })}
                <span>Crafting & Smelting</span>
              </h3>
              <span class="badge badge-idle" id="craftingStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Items Crafted</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-success);" id="craftingItemsCrafted">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Items Smelted</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-warning);" id="craftingItemsSmelted">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Current Factory Job: <strong style="color: #fff;" id="craftingCurrentJob">Ready</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('craft stone pickaxe')">Craft Pickaxe</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('craft 16 torches')">16 Torches</button>
            </div>
          </div>

          <!-- 5. Warehouse & Logistics -->
          <div class="card domain-card" data-domain="logistics">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('logistics', { size: 18 })}
                <span>Warehouse Logistics</span>
              </h3>
              <span class="badge badge-idle" id="logisticsStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Chests Indexed</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--violet-400);" id="logisticsChestsIndexed">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Items Sorted</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-success);" id="logisticsItemsSorted">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Active Restock Kit: <strong style="color: #fff;" id="logisticsLastKit">None</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('sort warehouse')">Sort Warehouse</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('index chests')">Index Chests</button>
            </div>
          </div>

          <!-- 6. Architecture & Construction -->
          <div class="card domain-card" data-domain="building">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('building', { size: 18 })}
                <span>Building & Construction</span>
              </h3>
              <span class="badge badge-idle" id="buildingStatusBadge">Idle</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Blocks Placed</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--cyan-400);" id="buildingBlocksPlaced">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Structures Built</div>
                <div style="font-size: 20px; font-weight: 700; color: #fff;" id="buildingStructuresBuilt">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Structure: <strong style="color: #fff;" id="buildingStructureName">None</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('build shelter')">Build Shelter</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('build wall 10x3 with cobblestone')">Build Wall</button>
            </div>
          </div>

          <!-- 7. Ambient Homestead Routines -->
          <div class="card domain-card" data-domain="behavior">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('behavior', { size: 18 })}
                <span>Ambient Homestead</span>
              </h3>
              <span class="badge badge-active" id="behaviorStatusBadge">Active</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Times Slept</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--violet-400);" id="behaviorTimesSlept">0</div>
              </div>
              <div style="background: rgba(0,0,0,0.25); padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                <div style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Food Eaten</div>
                <div style="font-size: 20px; font-weight: 700; color: var(--status-warning);" id="behaviorItemsEaten">0</div>
              </div>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">
              Stewardship Mode: <strong style="color: var(--status-success);" id="behaviorActivity">Auto-Stewardship</strong>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('sleep')">Sleep in Bed</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('wake up')">Wake Up</button>
            </div>
          </div>

          <!-- 8. Server In-Game Authentication -->
          <div class="card domain-card" data-domain="serverAuth">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('server-auth', { size: 18 })}
                <span>In-Game Server Auth</span>
              </h3>
              <span class="badge badge-success" id="serverAuthBadge">Protected</span>
            </div>
            <div style="background: rgba(0,0,0,0.25); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Detected Plugin:</span>
                <strong style="color: #fff;" id="serverAuthPlugin">AuthMe / LoginSecurity</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Database State:</span>
                <span style="color: var(--status-success);">Credentials Retained</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Database Reset Protection:</span>
                <span style="color: var(--cyan-400);">Auto-Reregister Active</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('auth status')">Check Server Auth</button>
            </div>
          </div>

        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const tabs = this.container.querySelectorAll('#domainFilterTabs button');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active', 'btn-primary'));
        tab.classList.add('active', 'btn-primary');
        const sub = tab.getAttribute('data-sub');
        this.filterDomains(sub);
      });
    });
  }

  filterDomains(sub) {
    const cards = this.container.querySelectorAll('.domain-card');
    cards.forEach(card => {
      if (sub === 'ALL' || card.getAttribute('data-domain') === sub) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }

  subscribeToState() {
    window.dashboardState.subscribe('domains', (domains) => {
      // Forestry
      if (domains.forestry) {
        const logsEl = this.container.querySelector('#forestryLogsCollected');
        const treesEl = this.container.querySelector('#forestryTreesCut');
        const saplingsEl = this.container.querySelector('#forestrySaplingsPlanted');
        if (logsEl) logsEl.textContent = String(domains.forestry.logsCollected || 0);
        if (treesEl) treesEl.textContent = String(domains.forestry.treesCut || 0);
        if (saplingsEl) saplingsEl.textContent = String(domains.forestry.saplingsPlanted || 0);
      }

      // Combat
      if (domains.combat) {
        const mobsEl = this.container.querySelector('#combatMobsDefeated');
        const dmgEl = this.container.querySelector('#combatDamageDealt');
        if (mobsEl) mobsEl.textContent = String(domains.combat.mobsKilled || 0);
        if (dmgEl) dmgEl.textContent = String(domains.combat.damageDealt || 0);
      }

      // Mining
      if (domains.mining) {
        const blocksEl = this.container.querySelector('#miningBlocksMined');
        const targetEl = this.container.querySelector('#miningTargetBlock');
        if (blocksEl) blocksEl.textContent = String(domains.mining.blocksMined || 0);
        if (targetEl) targetEl.textContent = domains.mining.targetBlock || 'None';
      }

      // Crafting
      if (domains.crafting) {
        const craftEl = this.container.querySelector('#craftingItemsCrafted');
        const smeltEl = this.container.querySelector('#craftingItemsSmelted');
        if (craftEl) craftEl.textContent = String(domains.crafting.itemsCrafted || 0);
        if (smeltEl) smeltEl.textContent = String(domains.crafting.itemsSmelted || 0);
      }

      // Logistics
      if (domains.logistics) {
        const chestsEl = this.container.querySelector('#logisticsChestsIndexed');
        const sortedEl = this.container.querySelector('#logisticsItemsSorted');
        if (chestsEl) chestsEl.textContent = String(domains.logistics.chestsIndexed || 0);
        if (sortedEl) sortedEl.textContent = String(domains.logistics.itemsSorted || 0);
      }

      // Behavior
      if (domains.behavior) {
        const sleptEl = this.container.querySelector('#behaviorTimesSlept');
        const eatenEl = this.container.querySelector('#behaviorItemsEaten');
        if (sleptEl) sleptEl.textContent = String(domains.behavior.timesSlept || 0);
        if (eatenEl) eatenEl.textContent = String(domains.behavior.itemsEaten || 0);
      }
    });
  }
}

window.domainsPage = new DomainsPage();
