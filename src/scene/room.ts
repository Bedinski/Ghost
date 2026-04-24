export function mountRoom(host: HTMLElement): void {
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', '0 0 1200 700');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.classList.add('room-svg');

  svg.innerHTML = `
    <defs>
      <linearGradient id="floorGrad" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#060912" stop-opacity="1"/>
        <stop offset="1" stop-color="#060912" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="rackGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0d1325"/>
        <stop offset="1" stop-color="#05070d"/>
      </linearGradient>
      <filter id="rackGlow"><feGaussianBlur stdDeviation="1.4"/></filter>
    </defs>
    <rect x="0" y="520" width="1200" height="200" fill="url(#floorGrad)"/>
    <g opacity="0.55">
      <path d="M0 90 L1200 90 L1200 110 L0 110 Z" fill="#0b1220"/>
      <g stroke="#16223a" stroke-width="1" opacity="0.8">
        ${Array.from({ length: 18 }, (_, i) => `<line x1="${i * 70}" y1="0" x2="${i * 70}" y2="90"/>`).join('')}
      </g>
    </g>
    <g class="racks">
      ${Array.from({ length: 6 }, (_, i) => rack(120 + i * 160, 160, 120, 330, i)).join('')}
    </g>
    <g class="rack-row-2" opacity="0.7">
      ${Array.from({ length: 4 }, (_, i) => rack(60 + i * 280, 120, 100, 240, i + 20)).join('')}
    </g>
    <rect x="0" y="580" width="1200" height="140" fill="#030509"/>
  `;
  host.appendChild(svg);

  // animate LEDs with staggered keyframes
  const leds = svg.querySelectorAll<SVGRectElement>('.rack-led');
  leds.forEach((el, i) => {
    el.style.animationDelay = `${(i * 137) % 4800}ms`;
  });
}

function rack(x: number, y: number, w: number, h: number, seed: number): string {
  const rows = 16;
  const ledGap = h / (rows + 1);
  let leds = '';
  for (let r = 0; r < rows; r++) {
    const on = (seed * 7 + r * 3) % 5 !== 0;
    leds += `<rect class="rack-led" x="${x + 10}" y="${y + 12 + r * ledGap}" width="10" height="4" rx="1" fill="${on ? '#35f3ff' : '#0a1a22'}"/>`;
    leds += `<rect class="rack-led" x="${x + w - 20}" y="${y + 12 + r * ledGap}" width="10" height="4" rx="1" fill="${(seed + r) % 3 === 0 ? '#ff3df0' : '#1a0a22'}"/>`;
  }
  return `
    <g class="rack">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#rackGrad)" stroke="#1b2642" stroke-width="1"/>
      <rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" fill="none" stroke="#101828" stroke-width="1"/>
      ${leds}
      <rect x="${x + w / 2 - 20}" y="${y - 6}" width="40" height="4" fill="#162238"/>
    </g>
  `;
}
