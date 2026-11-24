/**
 * CommandDeckPage - Primary operational command center.
 * Production Restrained Dark Operations Theme
 * 
 * Features:
 * - Executive Overview Banner showing Gateway process health, Minecraft connection state,
 *   active mission, queue size, and disconnect reasons.
 * - Split terminal layout with directive history stream and NLP intent preview.
 * - Strict command lifecycle states (queued, running, completed, failed, denied, unsupported, confirmation-required).
 * - Inline dangerous action confirmation handler.
 * - Autocomplete suggestions and quick directives.
 * - Safe text rendering for chat, errors, and entity names.
 */
class CommandDeckPage {
  constructor() {
    this.history = [];
    this.historyIndex = 0;
    this.autocompleteSuggestions = [
      'status',
      'help',
      'mine 16 iron_ore',
      'chop 32 oak_log',
      'craft stone_pickaxe',
      'patrol base',
      'sort warehouse',
      'index chests',
      'protect me',
      'clear hostiles',
      'sleep',
      'stop',
      'drop all',
      'simulate disconnect',
      'simulate connect',
      'simulate lowhealth',
      'simulate heal'
    ];
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
      <div class="command-deck-container">
        
        <!-- Executive Overview Status Bar -->
        <div class="card overview-banner-card" id="overviewBannerCard" style="padding: 14px 18px;">
          <div class="overview-banner-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px;">
            
            <!-- Column 1: ARGUS Web Gateway Process -->
            <div class="overview-col" style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim); letter-spacing: 0.05em;">ARGUS Web Service</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="connection-dot connecting" id="overviewGatewayDot"></span>
                <strong style="font-size: 14px; color: #fff;" id="overviewGatewayText">Checking</strong>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);" id="overviewGatewayMeta">Dashboard connection</div>
            </div>

            <!-- Column 2: Minecraft Server Bot Connection -->
            <div class="overview-col" style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim); letter-spacing: 0.05em;">Minecraft Bot Connection</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="connection-dot offline" id="overviewMcDot"></span>
                <strong style="font-size: 14px; color: #fff;" id="overviewMcText" aria-live="polite">Checking</strong>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);" id="overviewMcMeta">Waiting for Minecraft status</div>
              <div id="overviewPlayerPresence" style="font-size: 11.5px; color: var(--text-muted);"></div>
              <div id="overviewDisconnectReason" style="display: none; font-size: 11px; color: var(--status-danger); margin-top: 2px;"></div>
            </div>

            <!-- Column 3: Active Mission & Queue -->
            <div class="overview-col" style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim); letter-spacing: 0.05em;">Mission & Scheduler</div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent); display: flex;">${SvgIcons.get('tasks', { size: 14 })}</span>
                <strong style="font-size: 14px; color: #fff;" id="overviewTaskText">Idle</strong>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);" id="overviewTaskMeta">Queue: 0 tasks</div>
            </div>

            <!-- Column 4: Quick Telemetry Summary -->
            <div class="overview-col" style="display: flex; flex-direction: column; gap: 4px;">
              <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim); letter-spacing: 0.05em;">Vitals & Freshness</div>
              <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 600;">
                <span id="overviewHpVal" style="color: var(--status-success);">❤️ —</span>
                <span id="overviewFoodVal" style="color: #f59e0b;">🍗 —</span>
                <span id="overviewCoordsVal" class="mono" style="font-size: 11.5px; color: var(--accent);">—</span>
              </div>
              <div style="font-size: 11.5px; color: var(--text-muted);" id="overviewLastUpdate">Waiting for Minecraft telemetry</div>
            </div>

          </div>
        </div>

        <!-- Real-Time Vitals HUD Cards -->
        <div class="homepage-vitals-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px;">
          
          <!-- Health Points Card -->
          <div class="card vital-card health-card" style="padding: 16px;">
            <div class="vital-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="vital-card-title" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                <span>❤️</span>
                <span>Health Points</span>
              </div>
              <span class="badge badge-success" id="vitalsHealthStatus">Optimal</span>
            </div>
            <div class="vital-value-wrap" style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;">
              <div class="vital-large-val" id="vitalsHealthNum" style="font-size: 24px; font-weight: 800; color: #fff;">20.0</div>
              <span class="vital-max-val" style="font-size: 11px; color: var(--text-muted);">/ 20.0 HP</span>
            </div>
            <div class="vital-bar-track" style="height: 5px; background: rgba(255,255,255,0.08); border-radius: var(--radius-pill); overflow: hidden;">
              <div class="vital-bar-fill health-fill" id="vitalsHealthBar" style="width: 100%; height: 100%; background: var(--status-success); border-radius: var(--radius-pill);"></div>
            </div>
          </div>

          <!-- Food & Saturation Card -->
          <div class="card vital-card food-card" style="padding: 16px;">
            <div class="vital-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="vital-card-title" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                <span>🍗</span>
                <span>Food & Saturation</span>
              </div>
              <span class="badge badge-warning" id="vitalsFoodStatus">Well Fed</span>
            </div>
            <div class="vital-value-wrap" style="display: flex; align-items: baseline; gap: 6px; margin-bottom: 8px;">
              <div class="vital-large-val" id="vitalsFoodNum" style="font-size: 24px; font-weight: 800; color: #fff;">20</div>
              <span class="vital-max-val" style="font-size: 11px; color: var(--text-muted);">/ 20 Food</span>
            </div>
            <div class="vital-bar-track" style="height: 5px; background: rgba(255,255,255,0.08); border-radius: var(--radius-pill); overflow: hidden;">
              <div class="vital-bar-fill food-fill" id="vitalsFoodBar" style="width: 100%; height: 100%; background: var(--status-warning); border-radius: var(--radius-pill);"></div>
            </div>
          </div>

          <!-- Spatial Position Card -->
          <div class="card vital-card spatial-card" style="padding: 16px;">
            <div class="vital-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="vital-card-title" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                <span>🧭</span>
                <span>Spatial Location</span>
              </div>
              <span class="badge badge-cyan" id="vitalsDimensionBadge">OVERWORLD</span>
            </div>
            <div class="vital-coords-val mono" id="vitalsCoordsText" style="font-size: 14px; font-weight: 700; color: var(--accent); margin-bottom: 8px;">
              X: 0.0 Y: 64.0 Z: 0.0
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 6px;">
              <span>Facing: <strong id="vitalsHeadingText" style="color: #fff;">E (90°)</strong></span>
              <span>State: <strong id="vitalsMovementStatus" style="color: var(--text-secondary);">Stationary</strong></span>
            </div>
          </div>

          <!-- Equipment & Safety Card -->
          <div class="card vital-card status-card" style="padding: 16px;">
            <div class="vital-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div class="vital-card-title" style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">
                <span>🛡️</span>
                <span>Safety & Equipment</span>
              </div>
              <span class="badge badge-success" id="vitalsSafetyBadge">NORMAL</span>
            </div>
            <div class="vital-operation-name" id="vitalsTaskName" style="font-size: 14px; font-weight: 700; color: #fff; margin-bottom: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              Autonomous Idle
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 6px;">
              <span>Tool: <strong id="vitalsEquippedTool" style="color: #fff;">Diamond Pickaxe</strong></span>
              <span>Durability: <strong id="vitalsDurability" style="color: var(--accent);">85%</strong></span>
            </div>
          </div>

        </div>

        <!-- Command Lifecycle Stepper -->
        <div id="deckTimelineContainer"></div>

        <!-- Split Terminal & NLP Preview Pane -->
        <div class="command-split-pane" style="display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); gap: 16px;">
          
          <!-- Left: Directive Execution History Stream -->
          <div class="terminal-history-pane card" style="padding: 0; display: flex; flex-direction: column; height: 460px; overflow: hidden;">
            <div class="terminal-header" style="padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2);">
              <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary);">
                ${SvgIcons.get('terminal', { size: 14 })}
                <span>Directive Execution Stream</span>
              </div>
              <button type="button" class="btn btn-outline btn-sm btn-icon-only" id="clearDeckTerminalBtn" title="Clear Terminal Log">
                ${SvgIcons.get('trash', { size: 13 })}
              </button>
            </div>

            <div class="terminal-body" id="deckTerminalBody" style="flex: 1; overflow-y: auto; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; font-family: var(--font-mono); font-size: 12px;">
              <div class="empty-state" style="padding: 32px 16px; border: none;">
                <div class="empty-state-icon">${SvgIcons.get('terminal', { size: 24 })}</div>
                <div class="empty-state-title">ARGUS Command Gateway Ready</div>
                <div class="empty-state-desc">Enter an operational directive below or select a quick action to begin execution.</div>
              </div>
            </div>
          </div>

          <!-- Right: Parsed Intent & Plan Preview -->
          <div class="command-preview-pane card" id="deckPreviewPane" style="padding: 16px; display: flex; flex-direction: column; gap: 14px; height: 460px; overflow-y: auto;">
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                ${SvgIcons.get('code', { size: 15 })}
                <span>Intent & Plan Inspector</span>
              </h3>
              <span class="badge badge-cyan" id="deckConfidenceBadge">Confidence: 100%</span>
            </div>

            <!-- Parsed Intent Summary -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 10px 12px; display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Detected Intent:</span>
                <strong style="color: var(--accent);" id="deckIntentName">Awaiting Input</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Target Entities:</span>
                <span style="color: #fff; font-family: var(--font-mono);" id="deckTargetEntities">None</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Required Role:</span>
                <span class="badge badge-idle" id="deckPermBadge">owner</span>
              </div>
            </div>

            <!-- Planned Execution Steps -->
            <div style="flex: 1;">
              <div class="preview-section-title" style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim); margin-bottom: 6px;">Task Action Plan</div>
              <div id="deckActionPlanList" style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-secondary);">
                <div style="color: var(--text-muted); font-style: italic;">No active plan queued. Directives produce multi-step plans automatically.</div>
              </div>
            </div>

            <!-- Interactive Confirmation Banner -->
            <div id="deckPromptAlertArea" style="display: none;"></div>

            <!-- Emergency Stop Control -->
            <div style="margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
              <button type="button" class="btn btn-danger" id="deckEmergencyStopBtn" style="width: 100%;">
                ${SvgIcons.get('alert-triangle', { size: 14 })}
                <span>Emergency Stop All Operations</span>
              </button>
            </div>

          </div>

        </div>

        <!-- Bottom: Input Bar & Quick Directives -->
        <div class="command-input-bar card" style="padding: 12px 16px;">
          
          <div class="quick-directives-strip" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
            <span style="font-size: 11px; color: var(--text-dim); text-transform: uppercase; font-weight: 700;">Directives:</span>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('status')">Status</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('help')">Help</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('mine 16 iron_ore')">Mine Iron</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('chop 32 oak_log')">Chop Oak</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('patrol base')">Patrol Base</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('sort warehouse')">Sort Depot</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('drop all')">Drop All (Confirm)</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('stop')">Stop</button>
          </div>

          <form id="deckCommandForm" onsubmit="return false;" style="display: flex; gap: 8px; align-items: center;">
            <div style="position: relative; flex: 1; display: flex; align-items: center;">
              <span style="position: absolute; left: 12px; color: var(--accent); display: flex; align-items: center; pointer-events: none;">
                ${SvgIcons.get('chevron-right', { size: 14 })}
              </span>
              <input type="text" id="cmdInputDeck" class="form-input mono" placeholder="Enter directive (e.g. mine 16 iron_ore, chop 32 oak_log, patrol base, drop all, stop)..." autocomplete="off" style="padding-left: 32px;">
            </div>
            
            <button type="submit" class="btn btn-primary" id="deckSubmitBtn">
              <span>Execute</span>
              ${SvgIcons.get('terminal', { size: 14 })}
            </button>
          </form>

        </div>

      </div>
    `;

    // Instantiate lifecycle timeline stepper
    this.timeline = new TaskTimeline('deckTimelineContainer');
  }

  attachEventListeners() {
    const form = this.container.querySelector('#deckCommandForm');
    const input = this.container.querySelector('#cmdInputDeck');
    const clearBtn = this.container.querySelector('#clearDeckTerminalBtn');
    const stopBtn = this.container.querySelector('#deckEmergencyStopBtn');

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const cmd = input.value.trim();
        if (cmd) {
          this.executeCommand(cmd);
          input.value = '';
        }
      });

      // History navigation with Arrow keys
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (this.history.length > 0) {
            this.historyIndex = Math.max(0, this.historyIndex - 1);
            input.value = this.history[this.historyIndex] || '';
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            input.value = this.history[this.historyIndex] || '';
          } else {
            this.historyIndex = this.history.length;
            input.value = '';
          }
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const body = this.container.querySelector('#deckTerminalBody');
        if (body) body.innerHTML = '<div style="color: var(--text-muted); font-style: italic;">Terminal output cleared.</div>';
      });
    }

    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Emergency Stop All Directives',
          message: 'This will immediately halt pathfinding, mining, combat defense, and abort active task routines.',
          requiredWord: 'STOP',
          onConfirm: () => {
            window.dashboardController.sendCommand('stop');
          }
        });
      });
    }
  }

  fillAndSend(cmd) {
    const input = this.container.querySelector('#cmdInputDeck');
    if (input) {
      input.value = cmd;
    }
    this.executeCommand(cmd);
  }

  executeCommand(cmd) {
    this.history.push(cmd);
    this.historyIndex = this.history.length;

    // Advance timeline to received
    if (this.timeline) this.timeline.setStage('received');

    // Update NLP preview with anticipated intent
    this.previewIntent(cmd);

    // Append to local terminal history as dispatched
    this.appendEntry({
      time: Formatters.formatTimestamp(),
      source: 'Operator',
      command: cmd,
      status: 'queued',
      result: 'Dispatched to Command Gateway...'
    });

    if (window.dashboardController) {
      window.dashboardController.sendCommand(cmd);
    }
  }

  previewIntent(cmd) {
    const lower = cmd.toLowerCase();
    const intentEl = this.container.querySelector('#deckIntentName');
    const entitiesEl = this.container.querySelector('#deckTargetEntities');
    const planList = this.container.querySelector('#deckActionPlanList');

    let intent = 'Custom Directive';
    let entities = 'None';
    let steps = ['1. Parse syntax and resolve entities', '2. Verify role permissions', '3. Execute skill routine'];

    if (lower.includes('mine')) {
      intent = 'Mining Operation';
      entities = lower.replace(/.*mine\s+([0-9]*\s*[a-z_]+).*/, '$1') || 'iron_ore';
      steps = ['1. Equip pickaxe', '2. Scan local chunk for ore clusters', '3. Pathfind and mine target blocks', '4. Return to surface upon completion'];
    } else if (lower.includes('chop') || lower.includes('cut')) {
      intent = 'Forestry Harvest';
      entities = 'oak_log';
      steps = ['1. Analyze nearest tree family', '2. Chop base-to-canopy', '3. Collect dropped saplings and apples', '4. Replant sapling'];
    } else if (lower.includes('patrol') || lower.includes('combat') || lower.includes('kill')) {
      intent = 'Perimeter Defense';
      entities = 'Hostile Mobs';
      steps = ['1. Equip primary weapon and armor', '2. Scan 24m radar for hostiles', '3. Engage threats with critical strikes', '4. Fall back if health < 30%'];
    } else if (lower.includes('sort') || lower.includes('warehouse') || lower.includes('index')) {
      intent = 'Logistics & Depot Sorting';
      entities = 'Depot Chests';
      steps = ['1. Index all adjacent chests', '2. Catalog item inventory', '3. Deposit matching items by category'];
    } else if (lower.includes('stop')) {
      intent = 'Halt Directive';
      entities = 'Active Task';
      steps = ['1. Cancel active task', '2. Clear pathfinder goals', '3. Transition bot to idle'];
    } else if (lower.includes('drop')) {
      intent = 'Inventory Ejection';
      entities = 'Inventory Items';
      steps = ['1. Check confirmation flag', '2. Drop unreserved items', '3. Acknowledge completed drop'];
    }

    if (intentEl) intentEl.textContent = intent;
    if (entitiesEl) entitiesEl.textContent = entities;
    if (planList) {
      planList.innerHTML = steps.map(s => `<div style="padding: 4px 8px; background: rgba(255,255,255,0.03); border-radius: var(--radius-xs);">${Formatters.escapeHtml(s)}</div>`).join('');
    }

    if (this.timeline) {
      setTimeout(() => this.timeline.setStage('planned'), 100);
    }
  }

  handleCommandResponse(res) {
    const status = (res && res.status) || (res && res.ok ? 'completed' : 'error');
    const message = (res && res.message) || (typeof res === 'string' ? res : 'Directive processed.');

    // Update timeline strictly according to real status
    if (this.timeline) {
      if (status === 'queued') {
        this.timeline.setStage('queued');
      } else if (status === 'running') {
        this.timeline.setStage('running');
      } else if (status === 'confirmation_required') {
        this.timeline.setStage('authorized');
      } else if (status === 'completed' || status === 'success') {
        this.timeline.setStage('completed');
      } else {
        this.timeline.setStage('failed');
      }
    }

    // Handle confirmation prompt UI
    const promptArea = this.container.querySelector('#deckPromptAlertArea');
    if (status === 'confirmation_required' || (res && res.requiresConfirmation)) {
      if (promptArea) {
        promptArea.style.display = 'flex';
        promptArea.style.flexDirection = 'column';
        promptArea.style.gap = '8px';
        promptArea.style.padding = '12px';
        promptArea.style.borderRadius = 'var(--radius-sm)';
        promptArea.style.background = 'var(--status-warning-bg)';
        promptArea.style.border = '1px solid var(--status-warning-border)';
        promptArea.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; color: var(--status-warning); font-weight: 700; font-size: 12.5px;">
            ${SvgIcons.get('alert-triangle', { size: 15 })}
            <span>Confirmation Required</span>
          </div>
          <div style="font-size: 12px; color: var(--text-primary); line-height: 1.4;">${Formatters.escapeHtml(message)}</div>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button type="button" class="btn btn-warning btn-sm" id="deckConfirmActionBtn" style="background: var(--status-warning); color: #000; font-weight: 700;">
              Confirm Directive
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="deckDismissActionBtn">
              Dismiss
            </button>
          </div>
        `;
        const confirmBtn = promptArea.querySelector('#deckConfirmActionBtn');
        const dismissBtn = promptArea.querySelector('#deckDismissActionBtn');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', () => {
            promptArea.style.display = 'none';
            const lastCmd = this.history[this.history.length - 1] || 'action';
            this.executeCommand(`confirm ${lastCmd}`);
          });
        }
        if (dismissBtn) {
          dismissBtn.addEventListener('click', () => {
            promptArea.style.display = 'none';
          });
        }
      }
    } else if (promptArea) {
      promptArea.style.display = 'none';
    }

    // Append to terminal history with distinct semantic status
    this.appendEntry({
      time: Formatters.formatTimestamp(),
      source: 'Gateway',
      command: 'Response',
      status: status, // 'queued' | 'running' | 'completed' | 'failed' | 'denied' | 'unsupported' | 'confirmation_required'
      result: message
    });
  }

  appendEntry(entry) {
    const body = this.container.querySelector('#deckTerminalBody');
    if (!body) return;

    // Remove initial empty state if present
    const emptyState = body.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const row = document.createElement('div');
    row.className = 'terminal-entry';

    let badgeClass = 'badge-idle';
    let badgeText = (entry.status || 'INFO').toUpperCase();

    switch (entry.status) {
      case 'completed':
      case 'success':
        badgeClass = 'badge-success';
        badgeText = 'COMPLETED';
        break;
      case 'running':
        badgeClass = 'badge-cyan';
        badgeText = 'RUNNING';
        break;
      case 'queued':
      case 'pending':
        badgeClass = 'badge-idle';
        badgeText = 'QUEUED';
        break;
      case 'confirmation_required':
        badgeClass = 'badge-warning';
        badgeText = 'CONFIRM REQ';
        break;
      case 'unsupported':
        badgeClass = 'badge-warning';
        badgeText = 'UNSUPPORTED';
        break;
      case 'denied':
        badgeClass = 'badge-danger';
        badgeText = 'DENIED';
        break;
      case 'error':
      case 'failed':
        badgeClass = 'badge-danger';
        badgeText = 'FAILED';
        break;
    }

    row.innerHTML = `
      <div class="terminal-entry-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="terminal-entry-time" style="color: var(--text-dim);">[${entry.time}]</span>
          <span class="terminal-entry-source" style="color: var(--accent);">&lt;${Formatters.escapeHtml(entry.source)}&gt;</span>
          <span class="terminal-entry-cmd" style="color: #fff; font-weight: 600;">${Formatters.escapeHtml(entry.command)}</span>
        </div>
        <span class="badge ${badgeClass}" style="font-size: 10px; padding: 1px 6px;">${badgeText}</span>
      </div>
      <div class="terminal-entry-result ${entry.status}" style="margin-top: 4px; padding: 6px 10px; border-radius: var(--radius-xs); background: rgba(0,0,0,0.25); border-left: 2px solid ${badgeClass === 'badge-success' ? 'var(--status-success)' : badgeClass === 'badge-cyan' ? 'var(--accent)' : badgeClass === 'badge-warning' ? 'var(--status-warning)' : badgeClass === 'badge-danger' ? 'var(--status-danger)' : 'var(--border-subtle)'}; line-height: 1.4; color: var(--text-secondary); white-space: pre-wrap;">
        ${Formatters.escapeHtml(entry.result)}
      </div>
    `;

    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  subscribeToState() {
    // Sync active tasks with command execution & vitals HUD
    window.dashboardState.subscribe('tasks', (tasks) => {
      if (tasks.activeTask && this.timeline) {
        this.timeline.setStage('running');
      }
      const taskEl = this.container.querySelector('#vitalsTaskName');
      const overviewTaskText = this.container.querySelector('#overviewTaskText');
      const overviewTaskMeta = this.container.querySelector('#overviewTaskMeta');

      const queueLen = (tasks.queue || tasks.queuedTasks || []).length;

      if (tasks.activeTask) {
        const isPaused = Boolean(tasks.isPaused || tasks.activeTask.isPaused);
        const name = tasks.activeTask.name || tasks.activeTask.type || 'Executing directive';
        if (taskEl) taskEl.textContent = `${name}${isPaused ? ' (PAUSED)' : ''}`;
        if (overviewTaskText) overviewTaskText.textContent = `${name}${isPaused ? ' (PAUSED)' : ''}`;
        if (overviewTaskMeta) overviewTaskMeta.textContent = `Progress: ${tasks.activeTask.progress || 0}% · Queue: ${queueLen} tasks`;
      } else {
        if (taskEl) taskEl.textContent = 'Autonomous Idle';
        if (overviewTaskText) overviewTaskText.textContent = 'Idle (No active directive)';
        if (overviewTaskMeta) overviewTaskMeta.textContent = `Queue: ${queueLen} tasks pending`;
      }
    });

    // Sync Bot Vitals: Health, Food, Coordinates, Heading
    window.dashboardState.subscribe('bot', (bot) => {
      // 1. Health
      const hpNum = this.container.querySelector('#vitalsHealthNum');
      const hpBar = this.container.querySelector('#vitalsHealthBar');
      const hpStatus = this.container.querySelector('#vitalsHealthStatus');
      const overviewHp = this.container.querySelector('#overviewHpVal');

      if (bot.health !== undefined) {
        const hp = Math.max(0, Math.min(20, Number(bot.health)));
        if (hpNum) hpNum.textContent = hp.toFixed(1);
        if (overviewHp && window.dashboardState.get('serverConfig').online) overviewHp.textContent = `❤️ ${hp.toFixed(1)}`;
        if (hpBar) {
          const hpPercent = (hp / 20) * 100;
          hpBar.style.width = `${hpPercent}%`;
          if (hp <= 6) {
            hpBar.style.background = 'var(--status-danger)';
            if (hpStatus) {
              hpStatus.textContent = 'Critical';
              hpStatus.className = 'badge badge-danger';
            }
            if (overviewHp) overviewHp.style.color = 'var(--status-danger)';
          } else if (hp <= 12) {
            hpBar.style.background = 'var(--status-warning)';
            if (hpStatus) {
              hpStatus.textContent = 'Wounded';
              hpStatus.className = 'badge badge-warning';
            }
            if (overviewHp) overviewHp.style.color = 'var(--status-warning)';
          } else {
            hpBar.style.background = 'var(--status-success)';
            if (hpStatus) {
              hpStatus.textContent = 'Optimal';
              hpStatus.className = 'badge badge-success';
            }
            if (overviewHp) overviewHp.style.color = 'var(--status-success)';
          }
        }
      }

      // 2. Food
      const foodNum = this.container.querySelector('#vitalsFoodNum');
      const foodBar = this.container.querySelector('#vitalsFoodBar');
      const foodStatus = this.container.querySelector('#vitalsFoodStatus');
      const overviewFood = this.container.querySelector('#overviewFoodVal');

      if (bot.food !== undefined) {
        const food = Math.max(0, Math.min(20, Number(bot.food)));
        if (foodNum) foodNum.textContent = food;
        if (overviewFood && window.dashboardState.get('serverConfig').online) overviewFood.textContent = `🍗 ${food}`;
        if (foodBar) {
          foodBar.style.width = `${(food / 20) * 100}%`;
          if (food <= 6) {
            foodBar.style.background = 'var(--status-danger)';
            if (foodStatus) {
              foodStatus.textContent = 'Starving';
              foodStatus.className = 'badge badge-danger';
            }
          } else if (food <= 14) {
            foodBar.style.background = 'var(--status-warning)';
            if (foodStatus) {
              foodStatus.textContent = 'Hungry';
              foodStatus.className = 'badge badge-warning';
            }
          } else {
            foodBar.style.background = 'var(--status-success)';
            if (foodStatus) {
              foodStatus.textContent = 'Well Fed';
              foodStatus.className = 'badge badge-success';
            }
          }
        }
      }

      // 3. Spatial
      const coordsText = this.container.querySelector('#vitalsCoordsText');
      const dimBadge = this.container.querySelector('#vitalsDimensionBadge');
      const headingText = this.container.querySelector('#vitalsHeadingText');
      const overviewCoords = this.container.querySelector('#overviewCoordsVal');

      if (bot.position) {
        const x = typeof bot.position.x === 'number' ? bot.position.x.toFixed(1) : '0.0';
        const y = typeof bot.position.y === 'number' ? bot.position.y.toFixed(1) : '64.0';
        const z = typeof bot.position.z === 'number' ? bot.position.z.toFixed(1) : '0.0';
        if (coordsText) coordsText.textContent = `X: ${x} Y: ${y} Z: ${z}`;
        if (overviewCoords && window.dashboardState.get('serverConfig').online) overviewCoords.textContent = `X: ${x} Y: ${y} Z: ${z}`;
      }
      if (dimBadge && bot.dimension) {
        dimBadge.textContent = bot.dimension.toUpperCase();
      }
      if (headingText && bot.headingCardinal) {
        headingText.textContent = `${bot.headingCardinal} (${Math.round((bot.yaw || 0) * (180 / Math.PI))}°)`;
      }
    });

    // Sync Server Connection & Disconnect Reason
    window.dashboardState.subscribe('serverConfig', (cfg) => {
      const mcDot = this.container.querySelector('#overviewMcDot');
      const mcText = this.container.querySelector('#overviewMcText');
      const mcMeta = this.container.querySelector('#overviewMcMeta');
      const disconnectEl = this.container.querySelector('#overviewDisconnectReason');

      const indicator = window.dashboardState.getMinecraftIndicator(cfg);
      const playerEl = this.container.querySelector('#overviewPlayerPresence');
      const freshness = this.container.querySelector('#overviewLastUpdate');
      const host = cfg.server?.host;
      const port = cfg.server?.port;
      const presence = cfg.presence;

      if (mcDot && mcText) {
        mcDot.className = `connection-dot ${indicator.style}`;
        mcText.textContent = indicator.label;
      }
      if (mcMeta) {
        mcMeta.textContent = host && port ? `${host}:${port} · ${cfg.botUsername}` : 'Waiting for Minecraft status';
      }
      if (freshness) {
        freshness.textContent = cfg.connectionState === 'stale' ? 'Minecraft telemetry is stale' :
          cfg.online ? (presence?.preview ? 'Preview telemetry' : 'Receiving world data') : 'Waiting for Minecraft telemetry';
      }
      if (playerEl) {
        playerEl.textContent = '';
        if (cfg.online && !presence?.preview && presence?.playerCount != null) {
          const count = presence.playerCount;
          const roster = `${count} ${count === 1 ? 'player' : 'players'} in ARGUS’s tab list`;
          let owner = '';
          if (presence.ownerListed === false) {
            owner = ` · ${cfg.owner} absent from tab list`;
          } else if (presence.ownerListed === true) {
            owner = presence.ownerDistance == null ? ` · ${cfg.owner} listed · distance unavailable` :
              ` · ${cfg.owner} ${presence.ownerDistance} blocks away`;
          }
          playerEl.textContent = `${roster}${owner}${presence.botListed === false ? ' · ARGUS absent from tab list' : ''}`;
        }
      }
      if (disconnectEl) {
        const reason = cfg.connectionState === 'stale' ?
          'No recent Minecraft signal. Last-known data may be out of date.' : cfg.disconnectReason;
        disconnectEl.style.display = !cfg.online && reason ? 'block' : 'none';
        disconnectEl.textContent = !cfg.online && reason ? reason : '';
      }
      if (!cfg.online) {
        for (const [id, value] of [['overviewHpVal', '❤️ —'], ['overviewFoodVal', '🍗 —'], ['overviewCoordsVal', '—']]) {
          const el = this.container.querySelector(`#${id}`);
          if (el) el.textContent = value;
        }
      }
    });

    // Sync Freshness
    window.dashboardState.subscribe('connection', (conn) => {
      const dot = this.container.querySelector('#overviewGatewayDot');
      const label = this.container.querySelector('#overviewGatewayText');
      const detail = this.container.querySelector('#overviewGatewayMeta');
      if (!dot || !label || !detail) return;
      const receiving = !conn.isStale;
      dot.className = `connection-dot ${receiving ? 'online' : 'connecting'}`;
      label.textContent = receiving ? 'Reachable' : 'Waiting for data';
      detail.textContent = conn.status === 'online' ? 'Dashboard stream connected' :
        (receiving ? 'Dashboard responding via HTTP' : 'Dashboard stream unavailable');
    });
  }
}

window.commandDeckPage = new CommandDeckPage();
