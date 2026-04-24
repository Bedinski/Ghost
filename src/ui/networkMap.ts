import type { ExecuteHint, GameState, Packet } from '../types';
import { CHOICES_BY_ID } from '../game/choices';
import { icon } from './icons';
import { syncBadges } from './serverRack';

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

type NodeKey = keyof typeof NODES;

const PATHS: [NodeKey, NodeKey][][] = [
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app1'], ['app1', 'data']],
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app2'], ['app2', 'data']],
  [['net', 'edge'], ['edge', 'lb'], ['lb', 'app3'], ['app3', 'data']],
];

// Maps an executeHint.target to the actual node id(s) to highlight.
const TARGET_GROUP: Record<string, NodeKey[]> = {
  edge: ['edge'],
  lb: ['lb'],
  app: ['app1', 'app2', 'app3'],
  data: ['data'],
};

export interface NetworkMapHandle {
  render(s: GameState): void;
  pulse(hint: ExecuteHint): void;
  hostEl(): HTMLElement;
}

export function mountNetworkMap(host: HTMLElement): NetworkMapHandle {
  host.innerHTML = `
    <header class="panel-head">
      <h3>network topology</h3>
      <div class="panel-badges" data-region="badges"></div>
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
        <g class="nm-defenses"></g>
        <g class="nm-packets"></g>
      </svg>
      <div class="netmap-legend">
        <span class="leg leg-legit">▬ legit</span>
        <span class="leg leg-attack">▬ attack</span>
        <span class="leg leg-out">▬ outbound</span>
        <span class="leg leg-exfil">▬ exfil</span>
      </div>
      <div class="netmap-pulse" data-region="pulse"></div>
    </div>
  `;

  const packetLayer = host.querySelector<SVGGElement>('.nm-packets')!;
  const linkEls = host.querySelectorAll<SVGElement>('.nm-link');
  const nodeEls = host.querySelectorAll<SVGElement>('.nm-node');
  const defenseLayer = host.querySelector<SVGGElement>('.nm-defenses')!;
  const badges = host.querySelector<HTMLElement>('[data-region="badges"]')!;
  const pulseHost = host.querySelector<HTMLElement>('[data-region="pulse"]')!;
  const renderedBadges = new Set<string>();
  const renderedDefenses = new Set<string>();

  function render(s: GameState) {
    // illuminate links based on traffic amount
    const activity = Math.min(1, s.inbound / 220);
    linkEls.forEach((el) => {
      el.style.setProperty('--link-intensity', String(0.3 + activity * 0.7));
    });
    nodeEls.forEach((el) => {
      el.classList.toggle('nm-node--alert', s.threats.length > 0);
    });

    // packets
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

    // Persistent defense glyphs on the topology — small icons that hover
    // near the relevant tier so the player can see their stack at a glance.
    syncDefenses(defenseLayer, s, renderedDefenses);
    syncBadges(badges, s, renderedBadges, ['network']);
  }

  function pulse(hint: ExecuteHint) {
    const tone = hint.tone ?? 'cyan';
    let target: { x: number; y: number } = { x: 260, y: 120 };
    if (hint.target && TARGET_GROUP[hint.target]) {
      const ids = TARGET_GROUP[hint.target];
      const xs = ids.map((id) => NODES[id].x);
      const ys = ids.map((id) => NODES[id].y);
      target = {
        x: xs.reduce((a, b) => a + b, 0) / xs.length,
        y: ys.reduce((a, b) => a + b, 0) / ys.length,
      };
    }
    // Express target in viewBox-relative percentages so CSS can place
    // a DOM-layer ring without doing SVG math.
    const px = (target.x / 520) * 100;
    const py = (target.y / 240) * 100;
    pulseHost.style.setProperty('--px', `${px}%`);
    pulseHost.style.setProperty('--py', `${py}%`);
    pulseHost.innerHTML = `
      <div class="pp-burst pp-burst--${tone}">${icon(hint.glyph, 'pp-glyph')}</div>
      <div class="pp-badge pp-badge--${tone}">${hint.badge}</div>
    `;
    pulseHost.classList.remove('is-pulsing');
    void pulseHost.offsetWidth;
    pulseHost.classList.add('is-pulsing');
    setTimeout(() => {
      pulseHost.classList.remove('is-pulsing');
      pulseHost.innerHTML = '';
    }, 1400);
  }

  return { render, pulse, hostEl: () => host };
}

function syncDefenses(layer: SVGGElement, s: GameState, rendered: Set<string>): void {
  const desired = new Map<string, { node: NodeKey; emoji: string; tone: string }>();
  for (const id of s.takenChoices) {
    const c = CHOICES_BY_ID.get(id);
    const hint = c?.executeHint;
    if (!hint || hint.panel !== 'network') continue;
    const target: NodeKey | undefined = hint.target ? (TARGET_GROUP[hint.target]?.[0] as NodeKey) : 'edge';
    if (!target) continue;
    desired.set(id, {
      node: target,
      emoji: glyphFor(hint.glyph),
      tone: hint.tone ?? 'cyan',
    });
  }
  if (
    desired.size === rendered.size &&
    [...desired.keys()].every((k) => rendered.has(k))
  ) {
    return;
  }
  rendered.clear();
  layer.innerHTML = '';
  // Stack glyphs vertically above the targeted node.
  const stackByNode = new Map<NodeKey, number>();
  for (const [id, def] of desired) {
    const n = NODES[def.node];
    const idx = stackByNode.get(def.node) ?? 0;
    stackByNode.set(def.node, idx + 1);
    const offsetY = -22 - idx * 14;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${n.x} ${n.y + offsetY})`);
    g.setAttribute('class', `nm-defense nm-defense--${def.tone}`);
    g.innerHTML = `<text text-anchor="middle" font-size="11">${def.emoji}</text>`;
    layer.appendChild(g);
    rendered.add(id);
  }
}

function glyphFor(name: string): string {
  // Tiny emoji glyph map for the persistent defense indicators on the SVG.
  const m: Record<string, string> = {
    shield: '🛡',
    radar: '◉',
    gauge: '⌚',
    globe: '◍',
    lock: '⊠',
    scroll: '▤',
    cloud: '☁',
    archive: '▦',
    chip: '▣',
    server: '▪',
    database: '▥',
    user: '◯',
    wrench: '✦',
    bug: '✕',
    flame: '✷',
  };
  return m[name] ?? '◆';
}

function renderLinks(): string {
  const links = new Set<string>();
  for (const path of PATHS) for (const [a, b] of path) links.add(`${a}-${b}`);
  return Array.from(links)
    .map((key) => {
      const [a, b] = key.split('-') as [NodeKey, NodeKey];
      const n1 = NODES[a];
      const n2 = NODES[b];
      return `<line class="nm-link" x1="${n1.x}" y1="${n1.y}" x2="${n2.x}" y2="${n2.y}"/>`;
    })
    .join('');
}

function renderNodes(): string {
  const labels: Record<NodeKey, string> = {
    net: 'net',
    edge: 'edge',
    lb: 'lb',
    app1: 'app1',
    app2: 'app2',
    app3: 'app3',
    data: 'data',
  };
  return (Object.keys(NODES) as NodeKey[])
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
