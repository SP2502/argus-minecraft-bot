/**
 * CommandInput Component (Redesigned)
 * Obsidian glassmorphic interactive terminal console supporting natural language,
 * command history, quick-action chips, inline interactive clarification buttons,
 * and dangerous operation confirmation modals.
 */
class CommandInput {
  constructor(containerId, onSendCommand) {
    this.container = document.getElementById(containerId);
    this.onSendCommand = onSendCommand;
    this.history = this.loadHistory();
    this.historyIndex = this.history.length;
    this.terminalOutputs = [];

    this.render();
    this.attachEventListeners();
  }

  loadHistory() {
    try {
      const stored = localStorage.getItem('argus_cmd_history');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  saveHistory() {
    try {
      localStorage.setItem('argus_cmd_history', JSON.stringify(this.history.slice(-50)));
    } catch (e) {
      // ignore
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">

        <!-- Quick Action Prompt Chips Strip -->
        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
          <span style="font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-family: var(--font-mono); margin-right: 4px;">Quick Directives:</span>
          <button type="button" class="btn btn-sm" style="background: rgba(255,255,255,0.05); color: var(--text-main); border: 1px solid var(--border-subtle);" onclick="window.dashboard.components.command.fillAndSubmit('status')">
            Status
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(46, 213, 115, 0.12); color: var(--accent-emerald); border: 1px solid rgba(46, 213, 115, 0.25);" onclick="window.dashboard.components.command.fillAndSubmit('chop 16 oak logs')">
            Chop Oak
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(112, 161, 255, 0.12); color: var(--accent-cyan); border: 1px solid rgba(112, 161, 255, 0.25);" onclick="window.dashboard.components.command.fillAndSubmit('mine 16 iron_ore')">
            Mine Iron
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(255, 71, 87, 0.12); color: var(--accent-rose); border: 1px solid rgba(255, 71, 87, 0.25);" onclick="window.dashboard.components.command.fillAndSubmit('patrol base')">
            Patrol Base
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(168, 85, 247, 0.12); color: var(--accent-purple); border: 1px solid rgba(168, 85, 247, 0.25);" onclick="window.dashboard.components.command.fillAndSubmit('sort warehouse')">
            Sort Storage
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(255, 165, 2, 0.12); color: var(--accent-amber); border: 1px solid rgba(255, 165, 2, 0.25);" onclick="window.dashboard.components.command.fillAndSubmit('sleep')">
            Sleep
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(255, 71, 87, 0.2); color: var(--accent-rose); border: 1px solid rgba(255, 71, 87, 0.4);" onclick="window.dashboard.components.command.fillAndSubmit('stop')">
            Stop All
          </button>
        </div>

        <!-- Terminal Output Stream -->
        <div id="terminalOutputArea" style="min-height: 180px; max-height: 280px; overflow-y: auto; background: rgba(0,0,0,0.5); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; font-family: var(--font-mono); font-size: 12px; display: flex; flex-direction: column; gap: 6px;">
          <div style="color: var(--text-muted); font-style: italic;">Argus Unified NLP Terminal Gateway initialized. Type a natural instruction or select a quick directive.</div>
        </div>

        <!-- Clarification / Confirmation Prompt Area -->
        <div id="commandPromptArea" style="display: none; padding: 14px; border-radius: var(--radius-sm); background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.4);"></div>

        <!-- Terminal Input Bar -->
        <form id="commandForm" class="command-form" onsubmit="return false;" style="margin-top: 2px;">
          <div style="position: relative; flex: 1; display: flex; align-items: center;">
            <span style="position: absolute; left: 16px; color: var(--accent-indigo); font-family: var(--font-mono); font-weight: bold; font-size: 14px;">></span>
            <input type="text" id="commandInputField" class="command-input" placeholder="Execute directive (e.g. mine 64 diamonds then return home, craft stone pickaxe, defend perimeter)..." autocomplete="off" style="padding-left: 36px;">
          </div>
          <button type="submit" id="commandSubmitBtn" class="btn btn-primary">
            <span>Execute</span>
            <span style="font-size: 11px; opacity: 0.7;">↵</span>
          </button>
        </form>

      </div>
    `;
  }

  attachEventListeners() {
    const form = document.getElementById('commandForm');
    const input = document.getElementById('commandInputField');

    if (form && input) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitCommand();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateHistory(1);
        }
      });
    }
  }

  fillAndSubmit(commandText) {
    const input = document.getElementById('commandInputField');
    if (input) {
      input.value = commandText;
    }
    this.submitCommand(commandText);
  }

  submitCommand(textOverride = null) {
    const input = document.getElementById('commandInputField');
    const command = textOverride !== null ? textOverride.trim() : (input ? input.value.trim() : '');
    if (!command) return;

    this.hidePromptArea();

    // Add to history
    this.history.push(command);
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length;
    this.saveHistory();

    // Append to terminal output area
    this.appendTerminalLog({
      type: 'input',
      time: new Date().toLocaleTimeString(),
      text: command
    });

    if (typeof this.onSendCommand === 'function') {
      this.onSendCommand(command);
    }

    if (input && textOverride === null) {
      input.value = '';
    }
  }

  navigateHistory(direction) {
    if (this.history.length === 0) return;
    const input = document.getElementById('commandInputField');
    if (!input) return;

    this.historyIndex += direction;
    if (this.historyIndex < 0) this.historyIndex = 0;
    if (this.historyIndex > this.history.length) this.historyIndex = this.history.length;

    if (this.historyIndex === this.history.length) {
      input.value = '';
    } else {
      input.value = this.history[this.historyIndex] || '';
    }
  }

  /**
   * Appends an entry to the visual terminal output area.
   */
  appendTerminalLog(entry) {
    const outputArea = document.getElementById('terminalOutputArea');
    if (!outputArea) return;

    const row = document.createElement('div');
    row.style.lineHeight = '1.4';

    if (entry.type === 'input') {
      row.innerHTML = `<span style="color: var(--text-muted); font-size: 10px;">[${entry.time}]</span> <span style="color: var(--accent-indigo); font-weight: bold;">></span> <span style="color: var(--text-main);">${this.escapeHtml(entry.text)}</span>`;
    } else if (entry.type === 'error') {
      row.innerHTML = `<span style="color: var(--text-muted); font-size: 10px;">[${entry.time}]</span> <span style="color: var(--accent-rose); font-weight: bold;">[ERR]</span> <span style="color: var(--accent-rose);">${this.escapeHtml(entry.text)}</span>`;
    } else {
      row.innerHTML = `<span style="color: var(--text-muted); font-size: 10px;">[${entry.time}]</span> <span style="color: var(--accent-emerald); font-weight: bold;">[OK]</span> <span style="color: var(--accent-emerald);">${this.escapeHtml(entry.text)}</span>`;
    }

    outputArea.appendChild(row);
    outputArea.scrollTop = outputArea.scrollHeight;
  }

  /**
   * Handles unified command gateway execution result from WebSocket or REST.
   */
  handleCommandResponse(res) {
    if (!res) return;

    const time = new Date().toLocaleTimeString();

    // Check for interactive clarification needed
    if (res.status === 'clarification' || res.clarificationNeeded || (res.clarification && res.clarification.prompt)) {
      const promptText = res.message || res.prompt || (res.clarification && res.clarification.prompt) || 'Please clarify your instruction:';
      const options = res.options || (res.clarification && res.clarification.options) || [];
      this.showClarification(promptText, options);
      return;
    }

    // Check for confirmation needed
    if (res.status === 'confirmation' || res.confirmationRequired || (res.confirmation && res.confirmation.prompt)) {
      const warningText = res.message || (res.confirmation && res.confirmation.prompt) || 'This action may be dangerous. Do you wish to proceed?';
      this.showConfirmation(warningText);
      return;
    }

    const isOk = res.ok !== false && res.status !== 'error';
    const message = res.message || (typeof res === 'string' ? res : JSON.stringify(res));

    this.appendTerminalLog({
      type: isOk ? 'success' : 'error',
      time,
      text: message
    });
  }

  /**
   * Shows an inline interactive clarification prompt with selectable choice buttons.
   */
  showClarification(promptMessage, options = []) {
    const promptArea = document.getElementById('commandPromptArea');
    if (!promptArea) return;

    let buttonsHtml = '';
    options.forEach((opt, idx) => {
      const label = typeof opt === 'string' ? opt : (opt.label || opt.name || `Option ${idx + 1}`);
      const choiceValue = typeof opt === 'string' ? opt : (opt.name || opt.index || String(idx + 1));
      buttonsHtml += `
        <button type="button" class="btn btn-sm" style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.5); color: #fff;" onclick="window.dashboard.components.command.submitCommand('${this.escapeHtml(choiceValue)}')">
          ${idx + 1}) ${this.escapeHtml(label)}
        </button>
      `;
    });

    promptArea.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <span style="font-weight: 600; color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
          <span>Clarification Requested:</span>
        </span>
        <span style="font-size: 13px; color: var(--text-main);">${this.escapeHtml(promptMessage)}</span>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px;">
          ${buttonsHtml}
        </div>
      </div>
    `;
    promptArea.style.display = 'block';
  }

  /**
   * Shows an explicit confirmation prompt with Confirm and Cancel buttons for dangerous operations.
   */
  showConfirmation(warningMessage) {
    const promptArea = document.getElementById('commandPromptArea');
    if (!promptArea) return;

    promptArea.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(255, 71, 87, 0.15); border: 1px solid rgba(255, 71, 87, 0.4); padding: 14px; border-radius: var(--radius-sm);">
        <span style="font-weight: 700; color: var(--accent-rose); display: flex; align-items: center; gap: 6px;">
          <span>Action Confirmation Required:</span>
        </span>
        <span style="font-size: 13px; color: var(--text-main);">${this.escapeHtml(warningMessage)}</span>
        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button type="button" class="btn btn-sm" style="background: var(--accent-rose); color: #fff; font-weight: bold;" onclick="window.dashboard.components.command.submitCommand('yes')">
            Yes, Confirm
          </button>
          <button type="button" class="btn btn-sm" style="background: rgba(255,255,255,0.1); color: var(--text-muted);" onclick="window.dashboard.components.command.submitCommand('no')">
            Cancel
          </button>
        </div>
      </div>
    `;
    promptArea.style.display = 'block';
  }

  hidePromptArea() {
    const promptArea = document.getElementById('commandPromptArea');
    if (promptArea) promptArea.style.display = 'none';
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.CommandInput = CommandInput;
