/**
 * CommandDeckPage - Primary operational command center.
 * Features:
 * - Split layout: execution history stream on left, NLP preview and task plan on right.
 * - Command lifecycle timeline (Received -> Parsed -> Authorized -> Planned -> Queued -> Running).
 * - Autocomplete dropdown with quick directives.
 * - Emergency stop button with modal confirmation.
 */
class CommandDeckPage {
  constructor() {
    this.history = [];
    this.historyIndex = 0;
    this.autocompleteSuggestions = [
      'status',
      'mine 16 iron_ore',
      'chop 32 oak_log',
      'craft stone_pickaxe',
      'patrol base',
      'sort warehouse',
      'index chests',
      'protect me',
      'clear hostiles',
      'build shelter',
      'sleep',
      'wake up',
      'stop'
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
        
        <div class="hero-page-header">
          <h1>Command Deck</h1>
          <p>Supervise autonomous mission execution, preview NLP intents, and dispatch operational directives.</p>
        </div>

        <!-- Real-Time Vitals & Telemetry HUD Strip -->
        <div class="homepage-vitals-grid">
          
          <!-- Health Points Card -->
          <div class="vital-card health-card">
            <div class="vital-card-header">
              <div class="vital-card-title">
                <span class="vital-icon">❤️</span>
                <span>Health Points</span>
              </div>
              <span class="vital-badge" id="vitalsHealthStatus" style="color: var(--status-success);">Optimal</span>
            </div>
            <div class="vital-value-wrap">
              <div class="vital-large-val" id="vitalsHealthNum">20.0</div>
              <span class="vital-max-val">/ 20.0 HP</span>
            </div>
            <div class="vital-bar-track">
              <div class="vital-bar-fill health-fill" id="vitalsHealthBar" style="width: 100%;"></div>
            </div>
          </div>

          <!-- Food & Saturation Card -->
          <div class="vital-card food-card">
            <div class="vital-card-header">
              <div class="vital-card-title">
                <span class="vital-icon">🍗</span>
                <span>Food & Saturation</span>
              </div>
              <span class="vital-badge" id="vitalsFoodStatus" style="color: #f59e0b;">Well Fed</span>
            </div>
            <div class="vital-value-wrap">
              <div class="vital-large-val" id="vitalsFoodNum">20</div>
              <span class="vital-max-val">/ 20 Food</span>
            </div>
            <div class="vital-bar-track">
              <div class="vital-bar-fill food-fill" id="vitalsFoodBar" style="width: 100%;"></div>
            </div>
          </div>

          <!-- Spatial Position & Orientation Card -->
          <div class="vital-card spatial-card">
            <div class="vital-card-header">
              <div class="vital-card-title">
                <span class="vital-icon">🧭</span>
                <span>Spatial Location</span>
              </div>
              <span class="vital-badge" id="vitalsDimensionBadge" style="color: var(--cyan-400);">OVERWORLD</span>
            </div>
            <div class="vital-coords-val" id="vitalsCoordsText">X: 0.0 Y: 64.0 Z: 0.0</div>
            <div class="vital-meta-row">
              <span>Heading: <strong id="vitalsHeadingText" style="color: var(--cyan-400);">N (0°)</strong></span>
              <span>Status: <strong id="vitalsMovementStatus" style="color: #fff;">Stationary</strong></span>
            </div>
          </div>

          <!-- Operational Mode & Safety Card -->
          <div class="vital-card status-card">
            <div class="vital-card-header">
              <div class="vital-card-title">
                <span class="vital-icon">🛡️</span>
                <span>Safety & Equipment</span>
              </div>
              <span class="badge badge-success" id="vitalsSafetyBadge">NORMAL</span>
            </div>
            <div class="vital-operation-name" id="vitalsTaskName">Autonomous Idle</div>
            <div class="vital-meta-row">
              <span>Hand: <strong id="vitalsEquippedTool" style="color: #fff;">Main Weapon</strong></span>
              <span>Durability: <strong id="vitalsDurability" style="color: var(--cyan-400);">100%</strong></span>
            </div>
          </div>

        </div>

        <!-- Command Lifecycle Stepper -->
        <div id="deckTimelineContainer"></div>

        <!-- Split Terminal & NLP Preview Pane -->
        <div class="command-split-pane">
          
          <!-- Left: Monospace Execution History Stream -->
          <div class="terminal-history-pane">
            <div class="terminal-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${SvgIcons.get('terminal', { size: 14 })}
                <span>Directive Execution Stream</span>
              </div>
              <button type="button" class="btn btn-outline btn-sm btn-icon-only" id="clearDeckTerminalBtn" title="Clear Terminal Log">
                ${SvgIcons.get('trash', { size: 13 })}
              </button>
            </div>

            <div class="terminal-body" id="deckTerminalBody">
              <div class="empty-state" style="padding: 24px; border: none;">
                <div class="empty-state-icon">${SvgIcons.get('terminal', { size: 24 })}</div>
                <div class="empty-state-title">Argus Terminal Ready</div>
                <div class="empty-state-desc">Enter an operational directive below or select a quick action to begin execution.</div>
              </div>
            </div>
          </div>

          <!-- Right: Parsed Intent & Plan Preview -->
          <div class="command-preview-pane" id="deckPreviewPane">
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                ${SvgIcons.get('code', { size: 16 })}
                <span>Intent & Plan Inspector</span>
              </h3>
              <span class="badge badge-cyan" id="deckConfidenceBadge">Confidence: 100%</span>
            </div>

            <!-- Parsed Intent Summary -->
            <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 12px; display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Detected Intent:</span>
                <strong style="color: var(--cyan-400);" id="deckIntentName">Awaiting Input</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Target Entities:</span>
                <span style="color: #fff; font-family: var(--font-mono);" id="deckTargetEntities">None</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px;">
                <span style="color: var(--text-muted);">Required Permission:</span>
                <span class="badge badge-idle" id="deckPermBadge">owner</span>
              </div>
            </div>

            <!-- Planned Execution Steps -->
            <div>
              <div class="preview-section-title">Task Action Plan</div>
              <div id="deckActionPlanList" style="display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: var(--text-secondary);">
                <div style="color: var(--text-muted); font-style: italic;">No active plan queued. Directives produce multi-step plans automatically.</div>
              </div>
            </div>

            <!-- Clarification or Confirmation Container -->
            <div id="deckPromptAlertArea" style="display: none; padding: 12px; border-radius: var(--radius-md);"></div>

            <!-- Emergency Stop Control -->
            <div style="margin-top: auto; padding-top: 12px; border-top: 1px solid var(--border-subtle);">
              <button type="button" class="btn btn-danger" id="deckEmergencyStopBtn" style="width: 100%;">
                ${SvgIcons.get('alert-triangle', { size: 16 })}
                <span>Emergency Stop All Operations</span>
              </button>
            </div>

          </div>

        </div>

        <!-- Bottom: Input Bar & Quick Directives -->
        <div class="command-input-bar">
          
          <div class="quick-directives-strip">
            <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono);">Quick Directives:</span>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('status')">Status</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('mine 16 iron_ore')">Mine Iron</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('chop 32 oak_log')">Chop Oak</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('patrol base')">Patrol Base</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('sort warehouse')">Sort Warehouse</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.fillAndSend('sleep')">Sleep</button>
          </div>

          <form id="deckCommandForm" onsubmit="return false;" style="display: flex; gap: 10px; align-items: center; position: relative;">
            <div style="position: relative; flex: 1; display: flex; align-items: center;">
              <span style="position: absolute; left: 14px; color: var(--cyan-400); display: flex; align-items: center; pointer-events: none;">
                ${SvgIcons.get('chevron-right', { size: 14 })}
              </span>
              <input type="text" id="cmdInputDeck" class="form-input mono" placeholder="Enter directive (e.g. mine 64 iron_ore then return home, craft stone_pickaxe, patrol base)..." autocomplete="off" style="padding-left: 36px;">
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

    // Append to local terminal history
    this.appendEntry({
      time: Formatters.formatTimestamp(),
      source: 'User',
      command: cmd,
      status: 'pending',
      result: 'Dispatched to Unified Command Gateway...'
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
      steps = ['1. Equip harvest tool (pickaxe)', '2. Scan local chunk for ore clusters', '3. Pathfind and mine target blocks', '4. Return to surface upon completion'];
    } else if (lower.includes('chop') || lower.includes('cut')) {
      intent = 'Forestry Harvest';
      entities = 'oak_log';
      steps = ['1. Analyze nearest tree family', '2. Chop base-to-canopy', '3. Collect dropped saplings and apples', '4. Replant sapling'];
    } else if (lower.includes('patrol') || lower.includes('combat') || lower.includes('kill')) {
      intent = 'Base Perimeter Defense';
      entities = 'Hostile Mobs';
      steps = ['1. Equip primary weapon and armor', '2. Scan 24m radar for hostiles', '3. Engage threats with critical strikes', '4. Fall back if health < 30%'];
    } else if (lower.includes('sort') || lower.includes('warehouse')) {
      intent = 'Logistics & Warehouse Sorting';
      entities = 'Storage Chests';
      steps = ['1. Index all adjacent chests', '2. Catalog item inventory', '3. Deposit matching items by category'];
    }

    if (intentEl) intentEl.textContent = intent;
    if (entitiesEl) entitiesEl.textContent = entities;
    if (planList) {
      planList.innerHTML = steps.map(s => `<div style="padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: var(--radius-xs);">${s}</div>`).join('');
    }

    if (this.timeline) {
      setTimeout(() => this.timeline.setStage('planned'), 150);
      setTimeout(() => this.timeline.setStage('running'), 350);
    }
  }

  handleCommandResponse(res) {
    const isOk = res && res.ok !== false && res.status !== 'error';
    const message = (res && res.message) || (typeof res === 'string' ? res : 'Directive completed.');

    if (this.timeline) {
      this.timeline.setStage(isOk ? 'completed' : 'failed');
    }

    this.appendEntry({
      time: Formatters.formatTimestamp(),
      source: 'Gateway',
      command: 'Response',
      status: isOk ? 'success' : 'error',
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
    row.innerHTML = `
      <div class="terminal-entry-header">
        <span class="terminal-entry-time">[${entry.time}]</span>
        <span class="terminal-entry-source">&lt;${entry.source}&gt;</span>
        <span class="terminal-entry-cmd">${Formatters.escapeHtml(entry.command)}</span>
      </div>
      <div class="terminal-entry-result ${entry.status}">
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
      if (taskEl) {
        taskEl.textContent = (tasks.activeTask && (tasks.activeTask.name || tasks.activeTask.skill)) || 'Autonomous Idle';
      }
    });

    // Sync Bot Vitals: Health, Food, Coordinates, Heading
    window.dashboardState.subscribe('bot', (bot) => {
      // 1. Health
      const hpNum = this.container.querySelector('#vitalsHealthNum');
      const hpBar = this.container.querySelector('#vitalsHealthBar');
      const hpStatus = this.container.querySelector('#vitalsHealthStatus');

      if (bot.health !== undefined) {
        const hp = Math.max(0, Math.min(20, Number(bot.health)));
        if (hpNum) hpNum.textContent = hp.toFixed(1);
        if (hpBar) {
          const hpPercent = (hp / 20) * 100;
          hpBar.style.width = `${hpPercent}%`;
          if (hp <= 6) {
            hpBar.style.background = '#ef4444';
            hpBar.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.6)';
            if (hpStatus) {
              hpStatus.textContent = 'Critical';
              hpStatus.style.color = 'var(--status-danger)';
            }
          } else if (hp <= 12) {
            hpBar.style.background = '#f59e0b';
            hpBar.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.5)';
            if (hpStatus) {
              hpStatus.textContent = 'Wounded';
              hpStatus.style.color = '#f59e0b';
            }
          } else {
            hpBar.style.background = 'linear-gradient(90deg, #10b981, #00e5ff)';
            hpBar.style.boxShadow = '0 0 8px rgba(16, 185, 129, 0.4)';
            if (hpStatus) {
              hpStatus.textContent = 'Optimal';
              hpStatus.style.color = 'var(--status-success)';
            }
          }
        }
      }

      // 2. Food & Saturation
      const foodNum = this.container.querySelector('#vitalsFoodNum');
      const foodBar = this.container.querySelector('#vitalsFoodBar');
      const foodStatus = this.container.querySelector('#vitalsFoodStatus');

      if (bot.food !== undefined) {
        const food = Math.max(0, Math.min(20, Number(bot.food)));
        if (foodNum) foodNum.textContent = String(Math.round(food));
        if (foodBar) {
          const foodPercent = (food / 20) * 100;
          foodBar.style.width = `${foodPercent}%`;
          if (food <= 6) {
            if (foodStatus) {
              foodStatus.textContent = 'Starving';
              foodStatus.style.color = 'var(--status-danger)';
            }
          } else if (food <= 14) {
            if (foodStatus) {
              foodStatus.textContent = 'Hungry';
              foodStatus.style.color = '#f59e0b';
            }
          } else {
            if (foodStatus) {
              foodStatus.textContent = 'Well Fed';
              foodStatus.style.color = '#10b981';
            }
          }
        }
      }

      // 3. Coordinates & Spatial Telemetry
      const coordsText = this.container.querySelector('#vitalsCoordsText');
      const dimBadge = this.container.querySelector('#vitalsDimensionBadge');
      const headingText = this.container.querySelector('#vitalsHeadingText');

      if (coordsText && bot.position) {
        coordsText.textContent = `X: ${Formatters.formatCoord(bot.position.x)} Y: ${Formatters.formatCoord(bot.position.y)} Z: ${Formatters.formatCoord(bot.position.z)}`;
      }
      if (dimBadge && bot.dimension) {
        dimBadge.textContent = bot.dimension.toUpperCase();
      }
      if (headingText && bot.yaw !== undefined) {
        const heading = Formatters.calcHeading(bot.yaw);
        headingText.textContent = `${heading.cardinal} (${heading.degrees}°)`;
      }
    });

    // Sync Safety & Hazard Alerts
    window.dashboardState.subscribe('safety', (safety) => {
      const badge = this.container.querySelector('#vitalsSafetyBadge');
      if (badge && safety) {
        if (safety.isCritical) {
          badge.className = 'badge badge-danger';
          badge.textContent = 'CRITICAL';
        } else if (safety.isNearLava) {
          badge.className = 'badge badge-warning';
          badge.textContent = 'LAVA HAZARD';
        } else if (safety.isLowHealth) {
          badge.className = 'badge badge-warning';
          badge.textContent = 'LOW HEALTH';
        } else {
          badge.className = 'badge badge-success';
          badge.textContent = 'NORMAL';
        }
      }
    });

    // Sync Equipped Tool & Hand Durability
    window.dashboardState.subscribe('tools', (tools) => {
      const toolEl = this.container.querySelector('#vitalsEquippedTool');
      const durEl = this.container.querySelector('#vitalsDurability');
      if (tools) {
        const best = tools.bestSword || tools.bestPickaxe || tools.bestAxe;
        if (toolEl) toolEl.textContent = best || 'Bare Hands';
        if (durEl) {
          durEl.textContent = tools.isAboutToBreak ? 'Fragile (<10%)' : 'Healthy';
          durEl.style.color = tools.isAboutToBreak ? 'var(--status-danger)' : 'var(--cyan-400)';
        }
      }
    });
  }
}

window.commandDeckPage = new CommandDeckPage();
