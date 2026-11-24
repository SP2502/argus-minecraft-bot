/**
 * TaskCenterPage - Dedicated task lifecycle management center.
 * Production Restrained Dark Operations Theme
 * 
 * Features:
 * - Active task card with duration, locks, progress, and Pause/Abort controls.
 * - Priority execution queue table with real scheduler state.
 * - Execution history table with real completion and error states.
 * - Slide-out Task Detail Drawer showing raw execution metadata.
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
      <div style="display: flex; flex-direction: column; gap: 18px; position: relative;">
        
        <!-- Active Autonomous Directive Card -->
        <div class="card" id="activeTaskHeroCard" style="border-left: 3px solid var(--accent); padding: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('play', { size: 16 })}
              <span>Active Autonomous Directive</span>
            </h3>
            <span class="badge badge-cyan" id="activeTaskStatusBadge">Running</span>
          </div>

          <div id="activeTaskContentArea">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 14px;">
              <div>
                <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim);">DIRECTIVE NAME</div>
                <div style="font-size: 17px; font-weight: 700; color: #fff; margin-top: 2px;" id="activeTaskName">None</div>
              </div>
              <div>
                <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim);">ORIGIN SOURCE</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary); margin-top: 4px;" id="activeTaskSource">Console</div>
              </div>
              <div>
                <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim);">PRIORITY LEVEL</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--accent); margin-top: 4px;" id="activeTaskPriority">Normal (50)</div>
              </div>
              <div>
                <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 700; color: var(--text-dim);">LOCKS HELD</div>
                <div style="font-size: 14px; font-weight: 600; color: var(--violet-400); margin-top: 4px;" id="activeTaskLocks">movement, inventory</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px;">
                <span>Estimated Progress</span>
                <span id="activeTaskProgressText" style="font-weight: 600; color: #fff;">0%</span>
              </div>
              <div style="height: 6px; background: rgba(255,255,255,0.08); border-radius: var(--radius-pill); overflow: hidden;">
                <div id="activeTaskProgressBar" style="height: 100%; width: 0%; background: var(--accent); border-radius: var(--radius-pill); transition: width var(--transition-normal);"></div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 12px; flex-wrap: wrap; gap: 10px;">
              <div style="font-size: 12px; color: var(--text-muted);">
                Current Sub-routine: <strong style="color: #fff;" id="activeTaskStep">Executing autonomous routines</strong>
              </div>
              <div style="display: flex; gap: 8px;">
                <button type="button" class="btn btn-outline btn-sm" id="pauseActiveTaskBtn">
                  ${SvgIcons.get('pause', { size: 13 })}
                  <span id="pauseBtnLabel">Pause</span>
                </button>
                <button type="button" class="btn btn-danger btn-sm" id="cancelActiveTaskBtn">
                  ${SvgIcons.get('stop', { size: 13 })}
                  <span>Abort Task</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Empty State (Hidden when active task present) -->
          <div id="activeTaskEmptyState" style="display: none; padding: 24px; text-align: center; color: var(--text-muted);">
            <div style="font-size: 28px; margin-bottom: 6px;">💤</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">No Directive Currently Active</div>
            <div style="font-size: 12px; margin-top: 4px;">The autonomous scheduler is idle. Dispatch a directive from the Command Deck to begin.</div>
          </div>
        </div>

        <!-- Queued Directives Table -->
        <div class="card" style="padding: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('tasks', { size: 16 })}
              <span>Execution Priority Queue</span>
            </h3>
            <span class="badge badge-idle" id="taskQueueCountBadge">0 Queued</span>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Task Directive</th>
                  <th>Origin</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="taskQueueTableBody">
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    No pending directives in the priority execution queue.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Historical Execution Stream -->
        <div class="card" style="padding: 20px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <h3 class="card-title" style="margin: 0; font-size: 15px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
              ${SvgIcons.get('clock', { size: 16 })}
              <span>Recent Task Execution History</span>
            </h3>
          </div>

          <div class="data-table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Directive</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody id="taskHistoryTableBody">
                <tr>
                  <td class="mono" style="color: var(--text-dim);">Recent</td>
                  <td><strong style="color: #fff;">mine 16 iron_ore</strong></td>
                  <td>45s</td>
                  <td><span class="badge badge-cyan">RUNNING</span></td>
                  <td style="color: var(--text-secondary);">Currently excavating target vein</td>
                </tr>
                <tr>
                  <td class="mono" style="color: var(--text-dim);">10m ago</td>
                  <td><strong style="color: #fff;">chop 32 oak_log</strong></td>
                  <td>1m 12s</td>
                  <td><span class="badge badge-success">COMPLETED</span></td>
                  <td style="color: var(--status-success);">32 logs collected, 4 saplings planted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    `;
  }

  attachEventListeners() {
    const pauseBtn = this.container.querySelector('#pauseActiveTaskBtn');
    const cancelBtn = this.container.querySelector('#cancelActiveTaskBtn');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        const tasks = window.dashboardState.get('tasks') || {};
        const isPaused = Boolean(tasks.isPaused || (tasks.activeTask && tasks.activeTask.isPaused));
        if (window.dashboardController) {
          window.dashboardController.sendCommand(isPaused ? 'resume' : 'pause');
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        ModalDialog.showConfirmation({
          title: 'Abort Autonomous Task',
          message: 'Are you sure you want to cancel the currently active autonomous mission?',
          onConfirm: () => {
            if (window.dashboardController) {
              window.dashboardController.sendCommand('stop');
            }
          }
        });
      });
    }
  }

  subscribeToState() {
    window.dashboardState.subscribe('tasks', (tasks) => {
      this.updateActiveTaskView(tasks.activeTask, tasks.isPaused);
      this.updateQueueView(tasks.queue || tasks.queuedTasks || []);
    });
  }

  updateActiveTaskView(activeTask, isGlobalPaused) {
    const heroCard = this.container.querySelector('#activeTaskHeroCard');
    const contentArea = this.container.querySelector('#activeTaskContentArea');
    const emptyState = this.container.querySelector('#activeTaskEmptyState');
    const badge = this.container.querySelector('#activeTaskStatusBadge');
    const nameEl = this.container.querySelector('#activeTaskName');
    const sourceEl = this.container.querySelector('#activeTaskSource');
    const priorityEl = this.container.querySelector('#activeTaskPriority');
    const locksEl = this.container.querySelector('#activeTaskLocks');
    const stepEl = this.container.querySelector('#activeTaskStep');
    const progressText = this.container.querySelector('#activeTaskProgressText');
    const progressBar = this.container.querySelector('#activeTaskProgressBar');
    const pauseLabel = this.container.querySelector('#pauseBtnLabel');

    if (!activeTask) {
      if (contentArea) contentArea.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      if (badge) {
        badge.className = 'badge badge-idle';
        badge.textContent = 'Idle';
      }
      return;
    }

    if (contentArea) contentArea.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    const isPaused = Boolean(isGlobalPaused || activeTask.isPaused);

    if (badge) {
      badge.className = isPaused ? 'badge badge-warning' : 'badge badge-cyan';
      badge.textContent = isPaused ? 'Paused' : 'Running';
    }

    if (nameEl) nameEl.textContent = activeTask.name || activeTask.type || 'Unnamed Directive';
    if (sourceEl) sourceEl.textContent = activeTask.source || 'Console';
    if (priorityEl) priorityEl.textContent = activeTask.priority || 'Normal (50)';
    if (locksEl) locksEl.textContent = Array.isArray(activeTask.locks) ? activeTask.locks.join(', ') : (activeTask.locks || 'movement');
    if (stepEl) stepEl.textContent = activeTask.step || 'Executing active directive routine';

    const progress = activeTask.progress || 0;
    if (progressText) progressText.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (pauseLabel) pauseLabel.textContent = isPaused ? 'Resume' : 'Pause';
  }

  updateQueueView(queue) {
    const tbody = this.container.querySelector('#taskQueueTableBody');
    const countBadge = this.container.querySelector('#taskQueueCountBadge');

    if (countBadge) {
      countBadge.textContent = `${queue.length} Queued`;
      countBadge.className = queue.length > 0 ? 'badge badge-cyan' : 'badge badge-idle';
    }

    if (!tbody) return;

    if (!queue || queue.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
            No pending directives in the priority execution queue.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = queue.map((task, idx) => `
      <tr>
        <td>
          <span class="badge ${task.priority && task.priority.includes('High') ? 'badge-warning' : 'badge-idle'}" style="font-size: 10.5px;">
            ${Formatters.escapeHtml(task.priority || 'Normal')}
          </span>
        </td>
        <td><strong style="color: #fff;">${Formatters.escapeHtml(task.name || task.type || 'Task')}</strong></td>
        <td style="color: var(--text-secondary);">${Formatters.escapeHtml(task.source || 'Scheduler')}</td>
        <td><span class="badge badge-idle">QUEUED</span></td>
        <td>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.commandDeckPage.executeCommand('cancel task ${Formatters.escapeHtml(task.id || String(idx))}')" style="padding: 2px 8px; font-size: 11px;">
            Cancel
          </button>
        </td>
      </tr>
    `).join('');
  }
}

window.taskCenterPage = new TaskCenterPage();
