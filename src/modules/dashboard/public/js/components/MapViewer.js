/**
 * MapViewer Component
 * Real-time 2D Canvas Radar rendering bot position, direction heading,
 * concentric range rings, and surrounding entity coordinates.
 */
class MapViewer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.botPos = { x: 0, y: 64, z: 0, yaw: 0 };
    this.entities = [];
    this.lastRenderTime = 0;
    this.render();
  }

  updatePosition(pos, yaw = 0) {
    if (pos) {
      this.botPos = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: yaw !== undefined ? yaw : (this.botPos ? this.botPos.yaw : 0)
      };
    }
    this.render();
  }

  updateEntities(entities = []) {
    this.entities = entities;
    this.render();
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear background
    this.ctx.fillStyle = '#07090e';
    this.ctx.fillRect(0, 0, width, height);

    // Draw concentric range rings (16m, 32m, 48m scale)
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    this.ctx.lineWidth = 1;

    [30, 60, 90].forEach((radius) => {
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    });

    // Crosshair axis
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, 15);
    this.ctx.lineTo(centerX, height - 15);
    this.ctx.moveTo(15, centerY);
    this.ctx.lineTo(width - 15, centerY);
    this.ctx.stroke();

    // Cardinal Labels
    this.ctx.font = '10px "JetBrains Mono", monospace';
    this.ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('N', centerX, 12);
    this.ctx.fillText('S', centerX, height - 4);
    this.ctx.fillText('W', 10, centerY + 3);
    this.ctx.fillText('E', width - 10, centerY + 3);

    // Draw Nearby Entities
    if (Array.isArray(this.entities)) {
      for (const ent of this.entities) {
        if (!ent || !ent.position) continue;
        const dx = (ent.position.x - this.botPos.x) * 2;
        const dz = (ent.position.z - this.botPos.z) * 2;
        const ex = centerX + dx;
        const ey = centerY + dz;

        if (ex >= 0 && ex <= width && ey >= 0 && ey <= height) {
          this.ctx.fillStyle = ent.isPlayer ? '#38bdf8' : '#f43f5e';
          this.ctx.beginPath();
          this.ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    // Draw Bot Avatar & Direction Needle
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    // Convert yaw to canvas rotation (In Minecraft, 0 is south, pi/2 is west, etc.)
    const angle = this.botPos.yaw ? -this.botPos.yaw : 0;
    this.ctx.rotate(angle);

    // Direction needle
    this.ctx.fillStyle = '#38bdf8';
    this.ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -12);
    this.ctx.lineTo(6, 6);
    this.ctx.lineTo(0, 3);
    this.ctx.lineTo(-6, 6);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.restore();

    // Coordinate Label in corner
    this.ctx.font = '10px "JetBrains Mono", monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`X:${Math.round(this.botPos.x)} Z:${Math.round(this.botPos.z)}`, 10, height - 10);
  }
}
