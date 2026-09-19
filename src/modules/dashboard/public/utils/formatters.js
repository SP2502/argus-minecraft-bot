/**
 * Argus Formatting Utilities
 * Standardized date, coordinate, duration, and string formatting.
 */

const Formatters = {
  formatCoord(val) {
    if (val === undefined || val === null) return '0.0';
    return Number(val).toFixed(1);
  },

  formatDuration(ms) {
    if (!ms || ms < 0) return '0s';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSec = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remSec}s`;
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return `${hours}h ${remMin}m`;
  },

  formatTimestamp(dateOrTs) {
    const d = dateOrTs ? new Date(dateOrTs) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  },

  calcHeading(yaw) {
    if (yaw === undefined || yaw === null) return { cardinal: 'N', degrees: 0 };
    // Minecraft yaw (radians): 0 is South (+Z), PI/2 is West (-X), PI is North (-Z), -PI/2 is East (+X).
    // Standard compass (North=0°, East=90°, South=180°, West=270°):
    let deg = Math.round((yaw * 180 / Math.PI + 180) % 360);
    if (deg < 0) deg += 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(deg / 45) % 8;
    return { cardinal: directions[index], degrees: deg };
  },

  escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatPercent(val) {
    return `${Math.round(val || 0)}%`;
  },

  durabilityClass(percent) {
    if (percent === null || percent === undefined) return '';
    if (percent <= 5) return 'danger';
    if (percent <= 20) return 'warning';
    return 'success';
  }
};

window.Formatters = Formatters;
