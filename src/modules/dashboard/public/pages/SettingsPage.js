/**
 * SettingsPage - Console preferences, Minecraft server parameters, and session management.
 * Production Restrained Dark Operations Theme
 * 
 * Features:
 * - Separate Host and Port fields with clear explanation of persistence and restart effects.
 * - Explicit distinction between Offline mode (cracked/LAN/localhost) and Microsoft OAuth sign-in.
 * - Bot in-game name and superadmin owner username configuration.
 * - Telemetry sync rates and audio hazard chime toggles.
 * - Active session token revocation and locking.
 */
class SettingsPage {
  constructor() {}

  mount(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
    this.populateCurrentSettings();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 18px; max-width: 720px;">
        
        <!-- Minecraft Server & Connection Parameters -->
        <div class="card" style="padding: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('server', { size: 16 })}
              <span>Minecraft Server Connectivity</span>
            </h3>
            <span class="badge badge-cyan" id="settingsServerStatusBadge">Live Config</span>
          </div>

          <form id="settingsServerForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 14px;">
            
            <!-- Host and Port (Separate Fields) -->
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="settingsHostInput" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Minecraft Host / IP</label>
                <input type="text" id="settingsHostInput" class="form-input mono" placeholder="localhost or mc.server.net">
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="settingsPortInput" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Server Port</label>
                <input type="number" id="settingsPortInput" class="form-input mono" placeholder="25565">
              </div>
            </div>

            <!-- Bot Name and Owner -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="settingsBotUsername" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Bot In-Game Username</label>
                <input type="text" id="settingsBotUsername" class="form-input" placeholder="Argus">
              </div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <label for="settingsOwnerUsername" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Superadmin Owner</label>
                <input type="text" id="settingsOwnerUsername" class="form-input" placeholder="Kamlesh">
              </div>
            </div>

            <!-- Authentication Mode Selection with Explanations -->
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <label for="settingsAuthMode" style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim);">Authentication Method</label>
              <select id="settingsAuthMode" class="form-input" style="cursor: pointer;">
                <option value="offline">Offline Mode (Cracked / LAN / Localhost)</option>
                <option value="microsoft">Microsoft Account (Mojang / Xbox OAuth)</option>
              </select>
              
              <div id="authModeHelpText" style="font-size: 11.5px; color: var(--text-muted); line-height: 1.4; padding: 6px 10px; background: rgba(0,0,0,0.25); border-radius: var(--radius-xs); border: 1px solid var(--border-subtle); margin-top: 4px;">
                <strong>Offline Mode:</strong> Connects using standard unauthenticated client protocol. No Microsoft credentials required. Recommended for localhost, development, and cracked servers.
              </div>
            </div>

            <!-- Explanation of Change Scope -->
            <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">
              <strong style="color: var(--accent);">Where changes take effect:</strong> Saving updates will atomically modify <code>.env</code> and <code>.env.local</code> on disk. ARGUS will issue an immediate bot reconnect directive to detach from the current world and connect to the new target server.
            </div>

            <div id="settingsFeedback" style="font-size: 12px; min-height: 16px;"></div>

            <div style="display: flex; justify-content: flex-end;">
              <button type="submit" class="btn btn-primary" id="settingsSaveServerBtn">
                ${SvgIcons.get('check', { size: 14 })}
                <span>Save & Connect</span>
              </button>
            </div>

          </form>
        </div>

        <!-- Telemetry Synchronization Frequency -->
        <div class="card" style="padding: 20px;">
          <div class="card-header" style="margin-bottom: 10px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('wifi', { size: 16 })}
              <span>Telemetry Synchronization Rate</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Configure background synchronization frequency for REST telemetry and status polling.
            </p>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline btn-sm rate-btn active" data-rate="2000">Fast (2s)</button>
              <button type="button" class="btn btn-outline btn-sm rate-btn" data-rate="4000">Standard (4s)</button>
              <button type="button" class="btn btn-outline btn-sm rate-btn" data-rate="10000">Conserve (10s)</button>
            </div>
          </div>
        </div>

        <!-- Audio & Notification Preferences -->
        <div class="card" style="padding: 20px;">
          <div class="card-header" style="margin-bottom: 10px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('bell', { size: 16 })}
              <span>Notifications & Audio Feedback</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="alertSoundCheck">
              <span>Play audio chime on critical hazard detection (lava, low health)</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="autoScrollCheck" checked>
              <span>Auto-scroll directive execution stream on incoming command results</span>
            </label>
          </div>
        </div>

        <!-- Session Management & Logout -->
        <div class="card" style="border-color: rgba(239, 68, 68, 0.3); padding: 20px;">
          <div class="card-header" style="margin-bottom: 10px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: var(--status-danger); display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('lock', { size: 16 })}
              <span>Active Session Revocation</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Terminate the current authenticated browser session and clear signed tokens from storage.
            </p>

            <div>
              <button type="button" class="btn btn-danger" id="settingsLogoutBtn">
                ${SvgIcons.get('unlock', { size: 15 })}
                <span>Revoke Session & Lock Console</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  populateCurrentSettings() {
    const state = (window.dashboardState && window.dashboardState.get('serverConfig')) || {};
    const server = state.server || { host: 'localhost', port: 25565 };
    const hostInput = this.container.querySelector('#settingsHostInput');
    const portInput = this.container.querySelector('#settingsPortInput');
    const botInput = this.container.querySelector('#settingsBotUsername');
    const ownerInput = this.container.querySelector('#settingsOwnerUsername');
    const authSelect = this.container.querySelector('#settingsAuthMode');

    if (hostInput) hostInput.value = server.host || 'localhost';
    if (portInput) portInput.value = server.port || 25565;
    if (botInput) botInput.value = state.botUsername || 'Argus';
    if (ownerInput) ownerInput.value = state.owner || 'Kamlesh';
    if (authSelect) authSelect.value = state.authMode || 'offline';
  }

  attachEventListeners() {
    const form = this.container.querySelector('#settingsServerForm');
    const authSelect = this.container.querySelector('#settingsAuthMode');
    const authHelp = this.container.querySelector('#authModeHelpText');
    const feedback = this.container.querySelector('#settingsFeedback');
    const logoutBtn = this.container.querySelector('#settingsLogoutBtn');

    // Toggle explanatory text based on auth mode
    if (authSelect && authHelp) {
      authSelect.addEventListener('change', () => {
        if (authSelect.value === 'microsoft') {
          authHelp.innerHTML = '<strong>Microsoft Mode:</strong> Connects using official Microsoft Xbox Live OAuth authentication. Required for online-mode=true authenticated servers.';
        } else {
          authHelp.innerHTML = '<strong>Offline Mode:</strong> Connects using standard unauthenticated client protocol. No Microsoft credentials required. Recommended for localhost, development, and cracked servers.';
        }
      });
    }

    // Save Server Configuration
    if (form) {
      form.addEventListener('submit', async () => {
        const host = this.container.querySelector('#settingsHostInput').value.trim() || 'localhost';
        const port = parseInt(this.container.querySelector('#settingsPortInput').value.trim(), 10) || 25565;
        const botUsername = this.container.querySelector('#settingsBotUsername').value.trim() || 'Argus';
        const owner = this.container.querySelector('#settingsOwnerUsername').value.trim() || 'Kamlesh';
        const authMode = authSelect ? authSelect.value : 'offline';

        const saveBtn = this.container.querySelector('#settingsSaveServerBtn');
        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<span>Saving...</span>';
        }

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
            if (feedback) {
              feedback.style.color = 'var(--status-success)';
              feedback.textContent = res.reconnecting || 'Settings saved successfully. Reconnect directive dispatched.';
            }
          } else {
            if (feedback) {
              feedback.style.color = 'var(--status-danger)';
              feedback.textContent = (res && res.message) || 'Failed to update server configuration.';
            }
          }
        } catch (err) {
          if (feedback) {
            feedback.style.color = 'var(--status-danger)';
            feedback.textContent = `Error: ${err.message}`;
          }
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `${SvgIcons.get('check', { size: 14 })} <span>Save & Connect</span>`;
          }
        }
      });
    }

    // Polling rate buttons
    const rateBtns = this.container.querySelectorAll('.rate-btn');
    rateBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        rateBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const rate = parseInt(btn.getAttribute('data-rate'), 10);
        if (window.dashboardController && typeof window.dashboardController.setPollingRate === 'function') {
          window.dashboardController.setPollingRate(rate);
        }
      });
    });

    // Logout Button
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.dashboardController) {
          window.dashboardController.logout();
        }
      });
    }
  }
}

window.settingsPage = new SettingsPage();
