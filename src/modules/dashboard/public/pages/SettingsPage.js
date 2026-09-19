/**
 * SettingsPage - Console preferences, telemetry sync rates, and session revocation.
 */
class SettingsPage {
  constructor() {}

  mount(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; max-width: 680px;">
        
        <div class="hero-page-header">
          <h1>Console Settings</h1>
          <p>Configure server connectivity, bot identity, owner permissions, and telemetry preferences.</p>
        </div>

        <!-- Minecraft Server & Agent Configuration Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('server', { size: 16 })}
              <span>Minecraft Server & Owner Configuration</span>
            </h3>
            <span class="badge badge-cyan" id="settingsServerStatusBadge">Target Config</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
            <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Change target Minecraft server IP, port, bot in-game username, and owner identity.
            </p>
            <div>
              <button type="button" class="btn btn-primary" id="settingsOpenServerModalBtn">
                ${SvgIcons.get('settings', { size: 14 })}
                <span>Configure Server & Owner</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Telemetry Synchronization -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('wifi', { size: 16 })}
              <span>Telemetry Polling Rate</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Select background synchronization frequency for REST telemetry and statistics.
            </p>
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-outline btn-sm active" data-rate="2000">Fast (2s)</button>
              <button type="button" class="btn btn-primary btn-sm" data-rate="4000">Standard (4s)</button>
              <button type="button" class="btn btn-outline btn-sm" data-rate="10000">Conserve (10s)</button>
            </div>
          </div>
        </div>

        <!-- Audio & Notification Preferences -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('bell', { size: 16 })}
              <span>Alert Notifications</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="alertSoundCheck">
              <span>Play audio chime on critical hazard detection (lava, low health)</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="checkbox" id="autoScrollCheck" checked>
              <span>Auto-scroll directive stream on incoming command results</span>
            </label>
          </div>
        </div>

        <!-- Session Management & Logout -->
        <div class="card" style="border-color: rgba(239, 68, 68, 0.3);">
          <div class="card-header">
            <h3 class="card-title" style="color: var(--status-danger);">
              ${SvgIcons.get('lock', { size: 16 })}
              <span>Active Session Revocation</span>
            </h3>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <p style="color: var(--text-secondary); margin: 0; line-height: 1.4;">
              Terminate the current authenticated browser session and clear stored tokens from local storage.
            </p>

            <div>
              <button type="button" class="btn btn-danger" id="settingsLogoutBtn">
                ${SvgIcons.get('unlock', { size: 16 })}
                <span>Revoke Session & Lock Console</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const openSrvBtn = this.container.querySelector('#settingsOpenServerModalBtn');
    if (openSrvBtn) {
      openSrvBtn.addEventListener('click', () => {
        ModalDialog.showServerConfigModal();
      });
    }

    const logoutBtn = this.container.querySelector('#settingsLogoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Revoke Active Session',
          message: 'Are you sure you want to revoke your authentication token and lock the operations console?',
          onConfirm: () => {
            if (window.dashboardController) {
              window.dashboardController.logout();
            }
          }
        });
      });
    }
  }
}

window.settingsPage = new SettingsPage();
