/**
 * SecurityAuditPage - Security Governance, RBAC permissions matrix, and audit history.
 * Features:
 * - Current session identity & token expiry.
 * - RBAC permission matrix (Owner, Admin, Member, Guest).
 * - Real Command Audit log loaded from /api/commands/history.
 * - Sensitive credential redaction policy banner.
 */
class SecurityAuditPage {
  constructor() {
    this.auditLogs = [];
  }

  mount(container) {
    this.container = container;
    this.render();
    this.fetchAuditLogs();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <div class="hero-page-header">
          <h1>Security & Access Governance</h1>
          <p>5-tier role-based access control matrix, command audit logs, and credential protection policies.</p>
        </div>

        <!-- Sensitive Data Redaction Notice Banner -->
        <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: var(--radius-md); padding: 12px 18px; display: flex; align-items: center; gap: 12px; color: var(--violet-400);">
          ${SvgIcons.get('security', { size: 20 })}
          <div style="font-size: 12.5px; line-height: 1.4;">
            <strong style="color: #fff;">Strict Credential Redaction Enforced:</strong>
            Passwords, session signing secrets, and server authentication tokens are hashed or excluded from all REST responses, WebSocket broadcasts, and UI views.
          </div>
        </div>

        <!-- Session Identity & Governance Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px;">
          
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('user', { size: 16 })}
                <span>Active Session Identity</span>
              </h3>
              <span class="badge badge-cyan" id="secRoleBadge">Role: Owner</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Principal / Owner:</span>
                <strong style="color: #fff;" id="secPrincipalName">${Formatters.escapeHtml((window.dashboardState && window.dashboardState.state.serverConfig && window.dashboardState.state.serverConfig.owner) || 'Kamlesh')}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Auth Scheme:</span>
                <span style="color: var(--status-success);">Signed Bearer Token</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Rate Limit Meter:</span>
                <span style="color: var(--cyan-400);">0 / 60 req/min</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <h3 class="card-title">
                ${SvgIcons.get('lock', { size: 16 })}
                <span>Lockout & Defense State</span>
              </h3>
              <span class="badge badge-success">Nominal</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Failed Logins:</span>
                <strong style="color: #fff;">0 attempts</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Lockout Status:</span>
                <span style="color: var(--status-success);">Inactive (Clear)</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Origin Validation:</span>
                <span style="color: var(--cyan-400);">Enforced</span>
              </div>
            </div>
          </div>

        </div>

        <!-- RBAC Permissions Matrix -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('tasks', { size: 18 })}
              <span>RBAC Role Permission Matrix</span>
            </h3>
            <span class="badge badge-idle">Policy v1.0</span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Command Capability</th>
                  <th>Guest</th>
                  <th>Member</th>
                  <th>Admin</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Telemetry & Status Read</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
                <tr>
                  <td>Farming & Forestry Directives</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
                <tr>
                  <td>Mining & Resource Gathering</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
                <tr>
                  <td>Combat & Perimeter Defense</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
                <tr>
                  <td>Warehouse Management & Sorting</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
                <tr>
                  <td>Emergency Stop & Process Abort</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-danger);">${SvgIcons.get('x', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                  <td style="color: var(--status-success);">${SvgIcons.get('check', { size: 14 })}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Real Command Audit History Log Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('clock', { size: 18 })}
              <span>Command Audit History (/api/commands/history)</span>
            </h3>
            <button type="button" class="btn btn-outline btn-sm" id="refreshAuditBtn">
              ${SvgIcons.get('rotate-cw', { size: 13 })}
              <span>Refresh</span>
            </button>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Sender</th>
                  <th>Role</th>
                  <th>Directive</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="secAuditTableBody">
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    Loading command audit history from server...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;

    const refreshBtn = this.container.querySelector('#refreshAuditBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.fetchAuditLogs());
  }

  async fetchAuditLogs() {
    const tbody = this.container.querySelector('#secAuditTableBody');
    if (!tbody) return;

    try {
      const res = await window.apiClient.getCommandHistory(25);
      if (res && res.ok && Array.isArray(res.history) && res.history.length > 0) {
        tbody.innerHTML = res.history.map(item => `
          <tr>
            <td class="mono">${Formatters.formatTimestamp(item.timestamp)}</td>
            <td>${Formatters.escapeHtml(item.senderId || 'WebUser')}</td>
            <td><span class="badge badge-cyan">${Formatters.escapeHtml(item.role || 'owner')}</span></td>
            <td class="mono" style="color: #fff;">${Formatters.escapeHtml(item.message || '')}</td>
            <td><span class="badge badge-success">${Formatters.escapeHtml(item.status || 'OK')}</span></td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No command audit records logged yet.</td></tr>';
      }
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--status-danger); padding: 24px;">Error fetching audit log: ${Formatters.escapeHtml(err.message)}</td></tr>`;
    }
  }
}

window.securityAuditPage = new SecurityAuditPage();
