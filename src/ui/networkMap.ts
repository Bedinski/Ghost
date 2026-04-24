import type { GameState, Packet } from '../types';

// Three lanes routing through: internet → edge → lb → app → data
// The lanes converge/diverge for visual richness.
const NODES = {
  net: { x: 50, y: 120 },
  edge: { x: 150, y: 120 },
  lb: { x: 250, y: 120 },
  app1: { x: 360, y: 70 },
  app2: { x: 360, y: 120 },
  app3: { x: 360, y: 170 },
  data: { x: 470, y: 120 },
};

const PATHS: [keyof typeof NODES, keyof typeof NODES][][] = [
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app1'], ['app1', 'data']],
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app2'], ['app2', 'data']],
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app3'], ['app3', 'data']],
];

export function mountNetworkMap(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <header class="panel-head">
      <h3>network topology</h3>
      <span class="panel-sub">inbound → outbound</span>
    </header>
    <div class="netmap">
      <svg class="netmap-svg" viewBox="0 0 520 240" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="pktGlow"><feGaussianBlur stdDeviation="1.1"/></filter>
          <radialGradient id="nodeHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#35f3ff" stop-opacity="0.35"/><stop offset="1" stop-color="#35f3ff" stop-opacity="0"/></radialGradient>
        </defs>
        <g class="nm-links">
          ${renderLinks()}
        </g>
        <g class="nm-nodes">
          ${renderNodes()}
        </g>
        <g class="nm-packets"></g>
      </svg>
      <div class="netmap-legend">
        <span class="leg leg-legit">▬ legit</span>
        <span class="leg leg-attack">▬ attack</span>
        <span class="leg leg-out">▬ outbound</span>
        <span class="leg leg-exfil">▬ exfil</span>
      </div>
    </div>
  `;

  const packetLayer = host.querySelector<SVGGElement>('.nm-packets')!;
  const linkEls = host.querySelectorAll<SVGElement>('.nm-link');
  const nodeEls = host.querySelectorAll<SVGElement>('.nm-node');

  return (s: GameState) => {
    // illuminate links based on traffic amount
    const activity = Math.min(1, s.inbound / 220);
    linkEls.forEach((el) => {
      el.style.setProperty('--link-intensity', String(0.3 + activity * 0.7));
    });
    nodeEls.forEach((el) => {
      el.classList.toggle('nm-node--alert', s.threats.length > 0);
    });

    // render packets
    const existing = new Map<number, SVGGElement>();
    packetLayer.querySelectorAll<SVGGElement>('g[data-id]').forEach((g) => existing.set(Number(g.dataset.id), g));
    const live = new Set<number>();
    for (const p of s.packets) {
      live.add(p.id);
      let g = existing.get(p.id);
      if (!g) {
        g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-id', String(p.id));
        g.setAttribute('class', `nm-pkt nm-pkt--${p.kind}`);
        g.innerHTML = `<circle r="2.2" filter="url(#pktGlow)"/><circle r="1" class="core"/>`;
        packetLayer.appendChild(g);
      }
      const pos = computePacketPos(p);
      g.setAttribute('transform', `translate(${pos.x} ${pos.y})`);
    }
    for (const [id, g] of existing) {
      if (!live.has(id)) g.remove();
    }
  };
}

function renderLinks(): string {
  const links = new Set<string>();
  for (const path of PATHS) for (const [a, b] of path) links.add(`${a}-${b}`);
  return Array.from(links)
    .map((key) => {
      const [a, b] = key.split('-') as [keyof typeof NODES, keyof typeof NODES];
      const n1 = NODES[a];
      const n2 = NODES[b];
      return `<line class="nm-link" x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}"/>`;
    })
    .join('');
}

function renderNodes(): string {
  const labels: Record<keyof typeof NODES, string> = {
    net: 'net',
    edge: 'edge',
    lb: 'lb',
    app1: 'app1',
    app2: 'app2',
    app3: 'app3',
    data: 'data',
  };
  return (Object.keys(NODES) as (keyof typeof NODES)[])
    .map((k) => {
      const n = NODES[k];
      return `<g class="nm-node" transform="translate(${n.x} ${n.y})">
        <circle r="18" fill="url(#nodeHalo)"/>
        <circle r="11" class="nm-node-body"/>
        <circle r="4" class="nm-node-core"/>
        <text y="28" text-anchor="middle">${labels[k]}</text>
      </g>`;
    })
    .join('');
}

function computePacketPos(p: Packet): { x: number; y: number } {
  const path = PATHS[p.pathIdx % PATHS.length];
  const totalSegs = path.length;
  // outbound packets play the path in reverse
  const forward = p.kind !== 'out' && p.kind !== 'exfil';
  const t = Math.min(0.999, Math.max(0, p.t));
  const idx = Math.floor(t * totalSegs);
  const local = t * totalSegs - idx;
  const seg = forward ? path[idx] : path[totalSegs - 1 - idx];
  const a = NODES[seg[forward ? 0 : 1]];
  const b = NODES[seg[forward ? 1 : 0]];
  return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
}
