export interface Sparkline {
  render(inbound: number[], outbound: number[]): void;
  dispose(): void;
}

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

  function drawSeries(series: number[], color: string, fillColor: string) {
    if (!series.length) return;
    const max = Math.max(40, ...series) * 1.2;
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
    // stroke the line on top
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
    // playhead dot
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

  return {
    render(inbound, outbound) {
      ctx.clearRect(0, 0, w, h);
      drawGrid();
      drawSeries(outbound, '#ff3df0', 'rgba(255, 61, 240, 0.22)');
      drawSeries(inbound, '#35f3ff', 'rgba(53, 243, 255, 0.25)');
    },
    dispose() {
      ro.disconnect();
      canvas.remove();
    },
  };
}
