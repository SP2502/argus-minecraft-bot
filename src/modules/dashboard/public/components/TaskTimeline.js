/**
 * TaskTimeline - Visualizes command progression lifecycle and task execution steps.
 * Stages: Received -> Parsed -> Authorized -> Planned -> Queued -> Running -> Completed/Failed
 */
class TaskTimeline {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentStage = 'Idle'; // 'received' | 'parsed' | 'authorized' | 'planned' | 'queued' | 'running' | 'completed' | 'failed'
    this.render();
  }

  render() {
    if (!this.container) return;

    const stages = [
      { id: 'received', label: 'Received' },
      { id: 'parsed', label: 'Parsed' },
      { id: 'authorized', label: 'Authorized' },
      { id: 'planned', label: 'Planned' },
      { id: 'queued', label: 'Queued' },
      { id: 'running', label: 'Running' },
      { id: 'completed', label: 'Completed' }
    ];

    let nodesHtml = '';
    stages.forEach((st, idx) => {
      const isPast = this.isStagePast(st.id);
      const isActive = this.currentStage === st.id;
      const statusClass = isActive ? 'active' : (isPast ? 'completed' : '');

      nodesHtml += `
        <div class="step-node ${statusClass}" title="${st.label}">
          <div class="step-circle"></div>
          <span>${st.label}</span>
        </div>
      `;

      if (idx < stages.length - 1) {
        nodesHtml += `<div style="flex: 1; height: 2px; background: ${isPast ? 'var(--status-success)' : 'rgba(255, 255, 255, 0.08)'}; margin: 0 4px; margin-bottom: 14px;"></div>`;
      }
    });

    this.container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div class="preview-section-title">Command Execution Pipeline</div>
        <div class="lifecycle-stepper">
          ${nodesHtml}
        </div>
      </div>
    `;
  }

  setStage(stage) {
    this.currentStage = stage || 'Idle';
    this.render();
  }

  isStagePast(stageId) {
    const order = ['received', 'parsed', 'authorized', 'planned', 'queued', 'running', 'completed'];
    const curIdx = order.indexOf(this.currentStage);
    const targetIdx = order.indexOf(stageId);
    return curIdx > targetIdx;
  }
}

window.TaskTimeline = TaskTimeline;
