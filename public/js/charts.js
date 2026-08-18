// Lightweight dependency-free SVG chart helpers, shared globally as `Charts`.
(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function donutChart(data, colorMap) {
    const total = data.reduce((sum, d) => sum + d.count, 0);
    const size = 150;
    const radius = 54;
    const stroke = 22;
    const circumference = 2 * Math.PI * radius;

    if (total === 0) {
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="var(--border)" stroke-width="${stroke}" />
        <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" class="chart-center-text">0</text>
      </svg>`;
    }

    let offset = 0;
    const segments = data
      .filter((d) => d.count > 0)
      .map((d) => {
        const fraction = d.count / total;
        const dash = fraction * circumference;
        const seg = `<circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none"
          stroke="${colorMap[d.label] || '#999'}" stroke-width="${stroke}"
          stroke-dasharray="${dash} ${circumference - dash}"
          stroke-dashoffset="${-offset}" transform="rotate(-90 ${size / 2} ${size / 2})" />`;
        offset += dash;
        return seg;
      });

    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${segments.join('')}
      <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" class="chart-center-text">${total}</text>
    </svg>`;
  }

  function barChart(data, colorMap, height = 150) {
    const max = Math.max(1, ...data.map((d) => d.count));
    const barWidth = 44;
    const gap = 28;
    const width = data.length * (barWidth + gap) + gap;

    const bars = data.map((d, i) => {
      const barHeight = (d.count / max) * (height - 34);
      const x = gap + i * (barWidth + gap);
      const y = height - barHeight - 22;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="5" fill="${colorMap[d.label] || '#999'}" />
        <text x="${x + barWidth / 2}" y="${height - 4}" text-anchor="middle" class="chart-axis-label">${escapeHtml(d.label)}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" class="chart-value-label">${d.count}</text>
      `;
    });

    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet">${bars.join('')}</svg>`;
  }

  function lineChart(data, height = 150) {
    const max = Math.max(1, ...data.map((d) => d.count));
    const width = 520;
    const padding = 10;
    const stepX = (width - padding * 2) / Math.max(1, data.length - 1);

    const points = data.map((d, i) => {
      const x = padding + i * stepX;
      const y = height - 24 - (d.count / max) * (height - 44);
      return [x, y];
    });

    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
    const areaPath = `${path} L ${points[points.length - 1][0]},${height - 24} L ${points[0][0]},${height - 24} Z`;

    const labelEvery = Math.ceil(data.length / 7);
    const labels = data
      .map((d, i) => {
        if (i % labelEvery !== 0 && i !== data.length - 1) return '';
        const [x] = points[i];
        const label = d.day.slice(5);
        return `<text x="${x}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${label}</text>`;
      })
      .join('');

    const dots = points
      .map(([x, y], i) => (data[i].count > 0 ? `<circle cx="${x}" cy="${y}" r="3" fill="#2f6f4f" />` : ''))
      .join('');

    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="xMidYMid meet">
      <path d="${areaPath}" fill="rgba(47,111,79,0.14)" stroke="none" />
      <path d="${path}" fill="none" stroke="#2f6f4f" stroke-width="2.5" />
      ${dots}
      ${labels}
    </svg>`;
  }

  window.Charts = {
    donutChart,
    barChart,
    lineChart,
    STATUS_COLORS: { pending: '#b7791f', 'in-progress': '#2f6f4f', completed: '#6b7671' },
    PRIORITY_COLORS: { high: '#c0392b', medium: '#b7791f', low: '#2f6f4f' },
    STATUS_LABELS: { pending: 'Pending', 'in-progress': 'In progress', completed: 'Completed' },
  };
})();
