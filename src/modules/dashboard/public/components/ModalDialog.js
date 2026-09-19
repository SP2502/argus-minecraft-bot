/**
 * ModalDialog - Reusable in-page glassmorphic modals.
 * Supports:
 * 1. Gateway Authentication Modal (password visibility SVG toggle, error shake)
 * 2. Dangerous Operation Confirmation Modal (typed confirmation option, destructive semantics)
 */
class ModalDialog {
  /**
   * Shows the authentication modal.
   * @param {Function} onSubmit - Callback accepting entered password
   */
  static showAuthModal(onSubmit) {
    let modal = document.getElementById('authModalOverlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'authModalOverlay';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-dialog" id="authDialogBox">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--cyan-bg); color: var(--cyan-400); display: flex; align-items: center; justify-content: center;">
            ${SvgIcons.get('lock', { size: 20 })}
          </div>
          <div>
            <h3 style="margin: 0; font-family: var(--font-display); font-size: 17px; color: #fff;">Argus Secure Gateway</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Enter password to unlock telemetry and directives</span>
          </div>
        </div>

        <form id="authLoginForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 12px;">
          <div style="position: relative; display: flex; align-items: center;">
            <input type="password" id="authPasswordInput" class="form-input" placeholder="Enter dashboard password..." autocomplete="current-password" autofocus style="padding-right: 40px;">
            <button type="button" id="authToggleEyeBtn" class="btn btn-outline btn-sm btn-icon-only" style="position: absolute; right: 6px; border: none;" title="Toggle password visibility">
              ${SvgIcons.get('eye', { size: 16 })}
            </button>
          </div>

          <div id="authErrorMessage" style="font-size: 12px; color: var(--status-danger); min-height: 16px;"></div>

          <button type="submit" class="btn btn-primary" style="width: 100%;">
            <span>Unlock Console</span>
          </button>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    const form = modal.querySelector('#authLoginForm');
    const input = modal.querySelector('#authPasswordInput');
    const eyeBtn = modal.querySelector('#authToggleEyeBtn');
    const errorEl = modal.querySelector('#authErrorMessage');
    const box = modal.querySelector('#authDialogBox');

    eyeBtn.addEventListener('click', () => {
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';
      eyeBtn.innerHTML = SvgIcons.get(isPass ? 'eye-off' : 'eye', { size: 16 });
    });

    form.addEventListener('submit', () => {
      const val = input.value;
      if (!val) {
        errorEl.textContent = 'Password is required.';
        return;
      }
      if (typeof onSubmit === 'function') {
        onSubmit(val, {
          showError: (msg) => {
            errorEl.textContent = msg || 'Authentication failed.';
            box.classList.remove('shake');
            void box.offsetWidth;
            box.classList.add('shake');
          },
          close: () => {
            modal.style.display = 'none';
          }
        });
      }
    });

    setTimeout(() => input.focus(), 80);
  }

  /**
   * Shows a dangerous action confirmation modal.
   * @param {Object} options - Action warning and callbacks
   */
  static showConfirmation(options = {}) {
    let modal = document.getElementById('confirmModalOverlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'confirmModalOverlay';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const title = options.title || 'Dangerous Operation Requires Confirmation';
    const message = options.message || 'This action could disrupt active bot routines or consume precious resources.';
    const requiresTyped = Boolean(options.requiredWord);
    const requiredWord = options.requiredWord || 'CONFIRM';

    modal.innerHTML = `
      <div class="modal-dialog">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--status-danger-bg); color: var(--status-danger); display: flex; align-items: center; justify-content: center;">
            ${SvgIcons.get('alert-triangle', { size: 20 })}
          </div>
          <div>
            <h3 style="margin: 0; font-family: var(--font-display); font-size: 16px; color: var(--status-danger);">${Formatters.escapeHtml(title)}</h3>
            <span style="font-size: 12px; color: var(--text-muted);">Action safety guard</span>
          </div>
        </div>

        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0;">
          ${Formatters.escapeHtml(message)}
        </p>

        ${requiresTyped ? `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 12px; color: var(--text-muted);">Type <strong style="color: #fff;">${requiredWord}</strong> to proceed:</label>
            <input type="text" id="confirmTypedInput" class="form-input mono" placeholder="${requiredWord}">
          </div>
        ` : ''}

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
          <button type="button" class="btn btn-outline" id="confirmCancelBtn">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirmProceedBtn">Proceed</button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const cancelBtn = modal.querySelector('#confirmCancelBtn');
    const proceedBtn = modal.querySelector('#confirmProceedBtn');
    const typedInput = modal.querySelector('#confirmTypedInput');

    const cleanup = () => {
      modal.style.display = 'none';
      window.removeEventListener('keydown', handleKeydown);
      modal.removeEventListener('click', handleBackdropClick);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        if (typeof options.onCancel === 'function') options.onCancel();
      }
    };

    const handleBackdropClick = (e) => {
      if (e.target === modal) {
        cleanup();
        if (typeof options.onCancel === 'function') options.onCancel();
      }
    };

    window.addEventListener('keydown', handleKeydown);
    modal.addEventListener('click', handleBackdropClick);

    cancelBtn.addEventListener('click', () => {
      cleanup();
      if (typeof options.onCancel === 'function') options.onCancel();
    });

    proceedBtn.addEventListener('click', () => {
      if (requiresTyped && typedInput) {
        if (typedInput.value.trim() !== requiredWord) {
          typedInput.style.borderColor = 'var(--status-danger)';
          return;
        }
      }
      cleanup();
      if (typeof options.onConfirm === 'function') options.onConfirm();
    });
  }

  /**
   * Shows the Minecraft Server & Owner Configuration Modal.
   * @param {Object} options - Current config and onSave callback
   */
  static showServerConfigModal(options = {}) {
    let modal = document.getElementById('serverConfigModalOverlay');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'serverConfigModalOverlay';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const state = (window.dashboardState && window.dashboardState.state.serverConfig) || {};
    const curServer = options.server || state.server || { host: 'localhost', port: 25565 };
    const curOwner = options.owner || state.owner || 'Kamlesh';
    const curBotUsername = options.botUsername || state.botUsername || 'Argus';
    const curAuthMode = options.authMode || state.authMode || 'offline';
    const isOnline = Boolean(state.online);

    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 480px; padding: 28px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: var(--blue-bg); color: var(--blue-400); display: flex; align-items: center; justify-content: center;">
              ${SvgIcons.get('server', { size: 20 })}
            </div>
            <div>
              <h3 style="margin: 0; font-family: var(--font-display); font-size: 18px; font-weight: 700; color: #fff;">Minecraft Target & Owner</h3>
              <span style="font-size: 12px; color: var(--text-secondary);">Configure server connection and owner permissions</span>
            </div>
          </div>
          <button type="button" class="btn-icon-only btn btn-outline" id="cfgCloseModalBtn" style="border: none;" title="Close">
            ${SvgIcons.get('x', { size: 16 })}
          </button>
        </div>

        <!-- Connection Status Card -->
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); margin: 6px 0;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="connection-dot ${isOnline ? 'online' : 'offline'}"></span>
            <span style="font-size: 13px; font-weight: 600; color: #fff;">
              ${isOnline ? 'Connected to Minecraft' : 'Disconnected from Minecraft'}
            </span>
          </div>
          <span class="badge ${isOnline ? 'badge-success' : 'badge-idle'}" style="font-size: 10px;">
            ${isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <form id="serverConfigForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Server Host / IP</label>
              <input type="text" id="cfgServerHost" class="form-input mono" placeholder="localhost or play.domain.com" value="${Formatters.escapeHtml(curServer.host || 'localhost')}">
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Port</label>
              <input type="number" id="cfgServerPort" class="form-input mono" placeholder="25565" value="${curServer.port || 25565}">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Bot In-Game Name</label>
              <input type="text" id="cfgBotUsername" class="form-input" placeholder="Argus" value="${Formatters.escapeHtml(curBotUsername)}">
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Owner Username</label>
              <input type="text" id="cfgOwnerUsername" class="form-input" placeholder="Kamlesh" value="${Formatters.escapeHtml(curOwner)}">
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <label style="font-size: 11.5px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Authentication Mode</label>
            <select id="cfgAuthMode" class="form-input" style="cursor: pointer;">
              <option value="offline" ${curAuthMode === 'offline' ? 'selected' : ''}>Offline Mode (Cracked / LAN / Localhost)</option>
              <option value="microsoft" ${curAuthMode === 'microsoft' ? 'selected' : ''}>Microsoft Account (Mojang / Xbox Auth)</option>
            </select>
          </div>

          <div id="cfgFeedbackMsg" style="font-size: 12px; min-height: 16px;"></div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px;">
            <button type="button" class="btn btn-outline" id="cfgCancelBtn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="cfgSaveBtn">
              ${SvgIcons.get('check', { size: 14 })}
              <span>Save & Connect</span>
            </button>
          </div>
        </form>
      </div>
    `;

    modal.style.display = 'flex';

    const closeBtn = modal.querySelector('#cfgCloseModalBtn');
    const cancelBtn = modal.querySelector('#cfgCancelBtn');
    const saveBtn = modal.querySelector('#cfgSaveBtn');
    const form = modal.querySelector('#serverConfigForm');
    const hostInput = modal.querySelector('#cfgServerHost');
    const portInput = modal.querySelector('#cfgServerPort');
    const botInput = modal.querySelector('#cfgBotUsername');
    const ownerInput = modal.querySelector('#cfgOwnerUsername');
    const authSelect = modal.querySelector('#cfgAuthMode');
    const feedbackMsg = modal.querySelector('#cfgFeedbackMsg');

    const cleanup = () => {
      modal.style.display = 'none';
      window.removeEventListener('keydown', handleKeydown);
      modal.removeEventListener('click', handleBackdropClick);
    };

    const handleKeydown = (e) => {
      if (e.key === 'Escape') cleanup();
    };

    const handleBackdropClick = (e) => {
      if (e.target === modal) cleanup();
    };

    window.addEventListener('keydown', handleKeydown);
    modal.addEventListener('click', handleBackdropClick);
    if (closeBtn) closeBtn.addEventListener('click', cleanup);
    if (cancelBtn) cancelBtn.addEventListener('click', cleanup);

    const submitConfig = async () => {
      const host = hostInput.value.trim() || 'localhost';
      const port = parseInt(portInput.value.trim(), 10) || 25565;
      const botUsername = botInput.value.trim() || 'Argus';
      const owner = ownerInput.value.trim() || 'Kamlesh';
      const authMode = authSelect.value;

      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span>Saving...</span>`;

      try {
        const res = await window.apiClient.updateServerConfig({ host, port, botUsername, owner, authMode });
        if (res && res.ok) {
          window.dashboardState.setState('serverConfig', {
            online: res.online,
            connectionState: res.connectionState,
            server: res.server,
            owner: res.owner,
            botUsername: res.botUsername,
            authMode: res.authMode
          });
          feedbackMsg.style.color = 'var(--status-success)';
          feedbackMsg.textContent = res.reconnecting
            ? 'Environment updated! Disconnecting and rejoining server...'
            : 'Configuration applied successfully!';
          setTimeout(() => cleanup(), res.reconnecting ? 1200 : 500);
          if (typeof options.onSave === 'function') options.onSave(res);
        } else {
          feedbackMsg.style.color = 'var(--status-danger)';
          feedbackMsg.textContent = (res && res.message) || 'Failed to update server configuration.';
          saveBtn.disabled = false;
          saveBtn.innerHTML = `<span>Save & Connect</span>`;
        }
      } catch (err) {
        feedbackMsg.style.color = 'var(--status-danger)';
        feedbackMsg.textContent = err.message || 'Error updating configuration.';
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>Save & Connect</span>`;
      }
    };

    form.addEventListener('submit', submitConfig);
    setTimeout(() => hostInput.focus(), 60);
  }
}

window.ModalDialog = ModalDialog;
