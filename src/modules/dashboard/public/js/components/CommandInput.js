/**
 * CommandInput Component
 * In-browser interactive console supporting natural language input, command history in localStorage,
 * inline clarification choice buttons, and dangerous operation confirmation prompts.
 */
class CommandInput {
  constructor(containerId, onSendCommand) {
    this.container = document.getElementById(containerId);
    this.onSendCommand = onSendCommand;
    this.history = this.loadHistory();
    this.historyIndex = this.history.length;
    this.userRole = 'owner';

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
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div id="commandPromptArea" style="display: none; padding: 10px; border-radius: 6px; background: #1f232e; border: 1px solid #3742fa;"></div>
        
        <form id="commandForm" class="command-form" onsubmit="return false;">
          <input type="text" id="commandInputField" class="command-input" placeholder="Enter command or natural request (e.g. mine 64 diamonds then go home, farm wheat)..." autocomplete="off">
          <button type="submit" id="commandSubmitBtn" class="btn btn-primary">Send</button>
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
   * Shows an inline interactive clarification prompt with selectable choice buttons.
   * @param {string} promptMessage
   * @param {Array<{ label: string, index: number, name?: string }>} options
   */
  showClarification(promptMessage, options = []) {
    const promptArea = document.getElementById('commandPromptArea');
    if (!promptArea) return;

    let buttonsHtml = '';
    options.forEach((opt, idx) => {
      const label = opt.label || opt.name || `Option ${idx + 1}`;
      const choiceValue = opt.name || opt.index || String(idx + 1);
      buttonsHtml += `
        <button type="button" class="btn" style="background: #242936; border: 1px solid #3742fa; color: #fff; padding: 6px 12px; font-size: 12px;" onclick="window.dashboard.components.command.submitCommand('${choiceValue}')">
          ${idx + 1}) ${label}
        </button>
      `;
    });

    promptArea.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <span style="font-weight: 600; color: #70a1ff;">❓ Clarification Needed:</span>
        <span style="font-size: 13px;">${promptMessage}</span>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
          ${buttonsHtml}
        </div>
      </div>
    `;
    promptArea.style.display = 'block';
  }

  /**
   * Shows an explicit confirmation prompt with Confirm and Cancel buttons for dangerous operations.
   * @param {string} warningMessage
   */
  showConfirmation(warningMessage) {
    const promptArea = document.getElementById('commandPromptArea');
    if (!promptArea) return;

    promptArea.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <span style="font-weight: 700; color: #ff4757;">⚠️ Dangerous Action Requires Confirmation:</span>
        <span style="font-size: 13px;">${warningMessage}</span>
        <div style="display: flex; gap: 10px; margin-top: 6px;">
          <button type="button" class="btn" style="background: #ff4757; color: #fff;" onclick="window.dashboard.components.command.submitCommand('yes')">
            ✓ Yes, Confirm
          </button>
          <button type="button" class="btn" style="background: #242936; color: #9aa5b8;" onclick="window.dashboard.components.command.submitCommand('no')">
            ✗ Cancel
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
}

window.CommandInput = CommandInput;
