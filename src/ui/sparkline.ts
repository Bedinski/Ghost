export interface Sparkline {
  render(inbound: number[], outbound: number[], capacity?: number): void;
  dispose(): void;
}

// Throughput chart. Inbound (cyan) and outbound (magenta) sparklines with a
// dashed capacity ceiling line; whenever inbound crosses it, the area above
// is washed in red so distress reads visually without a label.
export function mountSparkline(host: HTMLElement): Sparkline {
  const canvas = document.createElement('canvas');
  canvas.className = 'spark-canvas';
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function drawSeries(series: number[], color: string, fillColor: string, max: number) {
    if (!series.length) return;
    const n = series.length;
    const step = w / (n - 1);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = h - (series[i] / max) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = h - (series[i] / max) * (h - 6) - 3;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const lastX = w;
    const lastY = h - (series[n - 1] / max) * (h - 6) - 3;
    ctx.beginPath();
    ctx.arc(lastX - 1, lastY, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(60, 120, 150, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCapacityCeiling(series: number[], capacity: number, max: number) {
    const yCeiling = h - (capacity / max) * (h - 6) - 3;
    if (yCeiling < 2) return;
    // dashed cyan-amber threshold line
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yCeiling);
    ctx.lineTo(w, yCeiling);
    ctx.stroke();
    ctx.restore();

    // Wash the area where inbound exceeded the ceiling in red.
    const n = series.length;
    if (n < 2) return;
    const step = w / (n - 1);
    ctx.save();
    ctx.beginPath();
    let inOver = false;
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const y = h - (series[i] / max) * (h - 6) - 3;
      if (series[i] > capacity) {
        if (!inOver) {
          ctx.moveTo(x, yCeiling);
          inOver = true;
        }
        ctx.lineTo(x, y);
      } else if (inOver) {
        ctx.lineTo(x, yCeiling);
        ctx.closePath();
        inOver = false;
      }
    }
    if (inOver) {
      ctx.lineTo(w, yCeiling);
      ctx.closePath();
    }
    ctx.fillStyle = 'rgba(255, 51, 85, 0.25)';
    ctx.fill();
    ctx.restore();

    // Tiny label "capacity" near the right end of the line.
    ctx.save();
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(255, 179, 71, 0.7)';
    ctx.textAlign = 'right';
    ctx.fillText('capacity', w - 4, Math.max(10, yCeiling - 3));
    ctx.restore();
  }

  return {
    render(inbound, outbound, capacity) {
      ctx.clearRect(0, 0, w, h);
      drawGrid();
      const peak = Math.max(40, ...inbound, ...outbound, capacity ?? 0) * 1.2;
      drawSeries(outbound, '#ff3df0', 'rgba(255, 61, 240, 0.22)', peak);
      drawSeries(inbound, '#35f3ff', 'rgba(53, 243, 255, 0.25)', peak);
      if (capacity && capacity > 0) drawCapacityCeiling(inbound, capacity, peak);
    },
    dispose() {
      ro.disconnect();
      canvas.remove();
    },
  };
}
