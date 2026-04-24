import type { GameState, Server } from '../types';
import { icon } from './icons';

const ROLE_LABEL: Record<Server['role'], string> = {
  edge: 'EDGE',
  lb: 'LOAD BAL',
  app: 'APP',
  data: 'DATA',
  cache: 'CACHE',
};

const ROLE_ICON: Record<Server['role'], string> = {
  edge: 'edge',
  lb: 'globe',
  app: 'server',
  data: 'database',
  cache: 'cloud',
};

export function mountServerRack(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <header class="panel-head">
      <h3>server rack</h3>
      <span class="panel-sub">fleet health</span>
    </header>
    <div class="rack-list" role="list"></div>
  `;
  const list = host.querySelector<HTMLElement>('.rack-list')!;
  const cardMap = new Map<string, HTMLElement>();

  return (s: GameState) => {
    const ids = new Set(s.servers.map((sv) => sv.id));
    for (const [id, el] of cardMap) {
      if (!ids.has(id)) {
        el.classList.add('rack-card--leaving');
        setTimeout(() => el.remove(), 320);
        cardMap.delete(id);
      }
    }
    for (const sv of s.servers) {
      let el = cardMap.get(sv.id);
      if (!el) {
        el = makeCard(sv);
        cardMap.set(sv.id, el);
        list.appendChild(el);
      }
      updateCard(el, sv);
    }
  };
}

function makeCard(sv: Server): HTMLElement {
  const el = document.createElement('div');
  el.className = 'rack-card';
  el.setAttribute('role', 'listitem');
  el.innerHTML = `
    <div class="rc-head">
      <span class="rc-ico">${icon(ROLE_ICON[sv.role])}</span>
      <span class="rc-role">${ROLE_LABEL[sv.role]}</span>
      <span class="rc-id">${sv.id}</span>
      <span class="rc-status"></span>
    </div>
    <div class="rc-leds">${'<i></i>'.repeat(8)}</div>
    <svg class="rc-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="rc-ring-bg"/><circle cx="18" cy="18" r="15" class="rc-ring-fill"/></svg>
    <span class="rc-health">100</span>
    <div class="rc-patch"></div>
  `;
  return el;
}

function updateCard(el: HTMLElement, sv: Server) {
  el.classList.toggle('rc--healthy', sv.status === 'healthy');
  el.classList.toggle('rc--degraded', sv.status === 'degraded');
  el.classList.toggle('rc--offline', sv.status === 'offline');
  const segs = el.querySelectorAll<HTMLElement>('.rc-leds i');
  const pct = sv.status === 'offline' ? 0 : Math.min(1, sv.load / Math.max(1, sv.capacity));
  const litCount = Math.round(pct * 8);
  segs.forEach((seg, i) => {
    seg.classList.toggle('lit', i < litCount && sv.status !== 'offline');
    seg.classList.toggle('hot', i >= 6 && i < litCount);
  });
  const ring = el.querySelector<SVGCircleElement>('.rc-ring-fill')!;
  const circ = 2 * Math.PI * 15;
  ring.style.strokeDasharray = `${circ}`;
  ring.style.strokeDashoffset = `${circ * (1 - sv.health / 100)}`;
  const health = el.querySelector<HTMLElement>('.rc-health')!;
  health.textContent = Math.round(sv.health).toString();
  const status = el.querySelector<HTMLElement>('.rc-status')!;
  status.textContent = sv.status;
  const patch = el.querySelector<HTMLElement>('.rc-patch')!;
  patch.classList.toggle('is-unpatched', !sv.patched);
  patch.title = sv.patched ? 'patched' : 'UNPATCHED — zero-day exposure';
}
