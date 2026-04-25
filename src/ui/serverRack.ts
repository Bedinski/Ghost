import type { ExecuteHint, GameState, Server } from '../types';
import { CHOICES_BY_ID } from '../game/choices';
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

export interface ServerRackHandle {
  render(s: GameState): void;
  pulse(hint: ExecuteHint): void;
  hostEl(): HTMLElement;
}

export function mountServerRack(host: HTMLElement): ServerRackHandle {
  host.innerHTML = `
    <header class="panel-head">
      <h3>server rack</h3>
      <div class="panel-badges" data-region="badges"></div>
      <span class="panel-sub">fleet health</span>
    </header>
    <div class="rack-list" role="list"></div>
    <div class="panel-pulse" data-region="pulse"></div>
  `;
  const list = host.querySelector<HTMLElement>('.rack-list')!;
  const badges = host.querySelector<HTMLElement>('[data-region="badges"]')!;
  const pulseHost = host.querySelector<HTMLElement>('[data-region="pulse"]')!;
  const cardMap = new Map<string, HTMLElement>();
  const renderedBadges = new Set<string>();

  function render(s: GameState) {
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
    // Persistent modifier badges from choices the player has shipped that
    // anchor to this panel.
    syncBadges(badges, s, renderedBadges, ['servers']);
  }

  function pulse(hint: ExecuteHint) {
    const tone = hint.tone ?? 'cyan';
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
    <div class="rc-loadbar"><div class="rc-loadbar-fill"></div><div class="rc-loadbar-mark"></div></div>
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

  // Load:capacity bar — colour shifts cyan→amber→red as we cross thresholds.
  const lbFill = el.querySelector<HTMLElement>('.rc-loadbar-fill')!;
  const ratio = sv.status === 'offline' ? 0 : Math.min(1.4, sv.load / Math.max(1, sv.capacity));
  lbFill.style.width = Math.min(100, ratio * 100) + '%';
  lbFill.classList.toggle('lb--ok', ratio < 0.75);
  lbFill.classList.toggle('lb--warn', ratio >= 0.75 && ratio < 0.95);
  lbFill.classList.toggle('lb--hot', ratio >= 0.95);
  // Whole-card stress border — escalates as the server is choked.
  el.classList.toggle('rc--stressed', ratio >= 0.85 && ratio < 1);
  el.classList.toggle('rc--saturated', ratio >= 1);
}

// Re-renders the small chip strip in the panel header to reflect every
// shipped choice whose executeHint anchors to this panel. The panels
// passed in say which `executeHint.panel` values count for this strip.
export function syncBadges(
  badgeHost: HTMLElement,
  s: GameState,
  rendered: Set<string>,
  panels: string[],
): void {
  // Build the desired badge set from takenChoices.
  const desired = new Map<string, { text: string; tone: string }>();
  for (const id of s.takenChoices) {
    const c = CHOICES_BY_ID.get(id);
    if (!c?.executeHint) continue;
    if (!panels.includes(c.executeHint.panel) && c.executeHint.panel !== 'all') continue;
    desired.set(id, { text: c.executeHint.badge, tone: c.executeHint.tone ?? 'cyan' });
  }
  // Diff against rendered set; rebuild for simplicity (small lists).
  if (
    desired.size === rendered.size &&
    [...desired.keys()].every((k) => rendered.has(k))
  ) {
    return;
  }
  rendered.clear();
  badgeHost.innerHTML = '';
  for (const [id, b] of desired) {
    const chip = document.createElement('span');
    chip.className = `panel-badge panel-badge--${b.tone}`;
    chip.textContent = b.text;
    chip.title = id;
    badgeHost.appendChild(chip);
    rendered.add(id);
  }
}
