/**
 * MapViewer Component
 * Canvas-based 2D top-down minimap rendering bot position and orientation.
 */
class MapViewer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.botPos = { x: 0, y: 64, z: 0, yaw: 0 };
    this.lastRenderTime = 0;
    this.render();
  }

  updatePosition(pos, yaw = 0) {
    if (pos) {
      this.botPos = {
        x: pos.x,
        y: pos.y,
        z: pos.z,
        yaw: yaw || 0
      };
    }

    // Throttle rendering to ~1 FPS to conserve CPU
    const now = Date.now();
    if (now - this.lastRenderTime >= 1000) {
      this.render();
      this.lastRenderTime = now;
    }
  }

  render() {
    if (!this.ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear background
    this.ctx.fillStyle = '#12141a';
    this.ctx.fillRect(0, 0, width, height);

    // Draw coordinate grid lines
    this.ctx.strokeStyle = '#222736';
    this.ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 32) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    for (let y = 0; y < height; y += 32) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Draw radar range circles
    this.ctx.strokeStyle = '#2d3748';
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 40, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
    this.ctx.stroke();

    // Draw Bot indicator (Triangle / Arrow in Center)
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(this.botPos.yaw);

    // Bot Arrow marker
    this.ctx.fillStyle = '#3742fa';
    this.ctx.beginPath();
    this.ctx.moveTo(0, -10);
    this.ctx.lineTo(7, 8);
    this.ctx.lineTo(0, 4);
    this.ctx.lineTo(-7, 8);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();

    // Overlay text coordinates
    this.ctx.fillStyle = '#70a1ff';
    this.ctx.font = '10px monospace';
    this.ctx.fillText(`Pos: (${Math.round(this.botPos.x)}, ${Math.round(this.botPos.y)}, ${Math.round(this.botPos.z)})`, 8, height - 10);
  }
}

window.MapViewer = MapViewer;
