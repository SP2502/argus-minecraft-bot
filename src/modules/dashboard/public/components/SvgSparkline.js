/**
 * SvgSparkline - Lightweight, pure SVG line and sparkline chart (Zero Canvas).
 */
class SvgSparkline {
  /**
   * Generates inline SVG sparkline HTML.
   * @param {number[]} dataPoints - Array of numbers
   * @param {Object} options - Customizations (width, height, strokeColor, fillColor)
   * @returns {string} SVG HTML string
   */
  static render(dataPoints = [], options = {}) {
    if (!dataPoints || dataPoints.length === 0) {
      return `<svg width="${options.width || 120}" height="${options.height || 32}"></svg>`;
    }

    const width = options.width || 140;
    const height = options.height || 36;
    const stroke = options.stroke || 'var(--cyan-400)';
    const fill = options.fill || 'rgba(0, 229, 255, 0.12)';

    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const range = (max - min) || 1;

    const points = dataPoints.map((val, idx) => {
      const x = (idx / (dataPoints.length - 1 || 1)) * (width - 8) + 4;
      const y = height - 4 - ((val - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const polyline = points.join(' ');
    const polygon = `4,${height - 2} ${polyline} ${width - 4},${height - 2}`;

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
        <polygon points="${polygon}" fill="${fill}" />
        <polyline points="${polyline}" fill="none" stroke="${stroke}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;
  }
}

window.SvgSparkline = SvgSparkline;
