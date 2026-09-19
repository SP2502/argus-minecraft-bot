/**
 * TaskCenterPage - Dedicated task lifecycle management center.
 * Features:
 * - Active task card with duration, locks, progress, and pause/cancel controls.
 * - Queued tasks table with priority and source.
 * - Historical execution table (completed, failed, cancelled) with preemption reasons.
 * - Slide-out Task Detail Drawer showing raw execution metadata and checkpoints.
 */
class TaskCenterPage {
  constructor() {
    this.selectedTask = null;
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
      <div style="display: flex; flex-direction: column; gap: 20px; position: relative;">
        
        <div class="hero-page-header">
          <h1>Task Center</h1>
          <p>Supervise active autonomous missions, manage the priority execution queue, and inspect task history.</p>
        </div>

        <!-- Active Mission Hero Banner -->
        <div class="card" id="activeTaskHeroCard" style="border-left: 3px solid var(--cyan-400);">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('play', { size: 18 })}
              <span>Active Autonomous Directive</span>
            </h3>
            <span class="badge badge-active" id="activeTaskStatusBadge">Running</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 14px;">
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">DIRECTIVE NAME</div>
              <div style="font-size: 18px; font-weight: 700; color: #fff; margin-top: 2px;" id="activeTaskName">None</div>
            </div>
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">SOURCE</div>
              <div style="font-size: 15px; font-weight: 600; color: var(--text-secondary); margin-top: 4px;" id="activeTaskSource">Web Console</div>
            </div>
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">PRIORITY LEVEL</div>
              <div style="font-size: 15px; font-weight: 600; color: var(--cyan-400); margin-top: 4px;" id="activeTaskPriority">Normal (50)</div>
            </div>
            <div>
              <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">LOCKS HELD</div>
              <div style="font-size: 15px; font-weight: 600; color: var(--violet-400); margin-top: 4px;" id="activeTaskLocks">movement, inventory</div>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
            <div style="font-size: 12px; color: var(--text-muted);">
              Current Step: <strong style="color: #fff;" id="activeTaskStep">Executing pathfinder navigation</strong>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline btn-sm" id="pauseActiveTaskBtn">
                ${SvgIcons.get('pause', { size: 14 })}
                <span>Pause</span>
              </button>
              <button type="button" class="btn btn-danger btn-sm" id="cancelActiveTaskBtn">
                ${SvgIcons.get('stop', { size: 14 })}
                <span>Abort Task</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Queued Directives Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('tasks', { size: 18 })}
              <span>Execution Queue</span>
            </h3>
            <span class="badge badge-idle" id="taskQueueCountBadge">0 Queued</span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task Directive</th>
                  <th>Source</th>
                  <th>Estimated Wait</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="taskQueueTableBody">
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    Queue is empty. New directives will buffer here in priority order.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Task Execution History Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">
              ${SvgIcons.get('clock', { size: 18 })}
              <span>Recent Task Execution History</span>
            </h3>
            <span class="badge badge-idle">Last 10 Events</span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Directive</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Preemption / Failure Details</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody id="taskHistoryTableBody">
                <tr>
                  <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    No past task completions recorded in this session.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Slide-out Task Detail Drawer -->
        <div class="detail-drawer" id="taskDetailDrawer">
          <div class="drawer-header">
            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #fff;">Task Details</h3>
            <button type="button" class="btn btn-outline btn-sm btn-icon-only" id="closeTaskDrawerBtn">
              ${SvgIcons.get('x', { size: 16 })}
            </button>
          </div>
          <div class="drawer-body" id="taskDrawerContent">
            <!-- Populated on row click -->
          </div>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const pauseBtn = this.container.querySelector('#pauseActiveTaskBtn');
    const cancelBtn = this.container.querySelector('#cancelActiveTaskBtn');
    const closeDrawerBtn = this.container.querySelector('#closeTaskDrawerBtn');
    const drawer = this.container.querySelector('#taskDetailDrawer');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Abort Active Directive',
          message: 'Are you sure you want to terminate the active task execution immediately?',
          onConfirm: () => {
            window.dashboardController.sendCommand('stop');
          }
        });
      });
    }

    if (closeDrawerBtn && drawer) {
      closeDrawerBtn.addEventListener('click', () => {
        drawer.classList.remove('open');
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer.classList.contains('open')) {
          drawer.classList.remove('open');
        }
      });
    }
  }

  openDrawer(taskObj) {
    const drawer = this.container.querySelector('#taskDetailDrawer');
    const content = this.container.querySelector('#taskDrawerContent');
    if (!drawer || !content) return;

    content.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Task ID</div>
          <div style="font-size: 13px; font-family: var(--font-mono); color: #fff; margin-top: 2px;">${Formatters.escapeHtml(taskObj.id || 'tsk_' + Date.now())}</div>
        </div>

        <div style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px;">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Preemption & Lock State</div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">${Formatters.escapeHtml(taskObj.preemption || 'Normal execution; no preemption locks breached.')}</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Raw Metadata Payload</div>
          <pre style="background: #060910; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; font-size: 11.5px; color: var(--cyan-400); overflow-x: auto; max-height: 240px;">${Formatters.escapeHtml(JSON.stringify(taskObj, null, 2))}</pre>
        </div>
      </div>
    `;

    drawer.classList.add('open');
  }

  subscribeToState() {
    window.dashboardState.subscribe('tasks', (tasks) => {
      const heroCard = this.container.querySelector('#activeTaskHeroCard');
      const nameEl = this.container.querySelector('#activeTaskName');
      const badge = this.container.querySelector('#activeTaskStatusBadge');

      if (tasks.activeTask) {
        if (nameEl) nameEl.textContent = tasks.activeTask.name || tasks.activeTask.skill || 'Executing Directive';
        if (badge) {
          badge.className = 'badge badge-active';
          badge.textContent = 'Running';
        }
      } else {
        if (nameEl) nameEl.textContent = 'None (Idle)';
        if (badge) {
          badge.className = 'badge badge-idle';
          badge.textContent = 'Idle';
        }
      }
    });
  }
}

window.taskCenterPage = new TaskCenterPage();
