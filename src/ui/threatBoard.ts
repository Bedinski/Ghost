import type { GameState, Threat } from '../types';
import { THREATS } from '../game/events';

export function mountThreatBoard(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <header class="panel-head">
      <h3>threat board</h3>
      <span class="panel-sub">active incidents</span>
    </header>
    <div class="tb-list"></div>
    <div class="tb-empty">no active threats · systems nominal</div>
  `;
  const list = host.querySelector<HTMLElement>('.tb-list')!;
  const empty = host.querySelector<HTMLElement>('.tb-empty')!;
  const cards = new Map<string, HTMLElement>();

  return (s: GameState) => {
    const ids = new Set(s.threats.map((t) => t.id));
    for (const [id, el] of cards) {
      if (!ids.has(id)) {
        el.classList.add('tb-card--leaving');
        setTimeout(() => el.remove(), 250);
        cards.delete(id);
      }
    }
    for (const t of s.threats) {
      let el = cards.get(t.id);
      if (!el) {
        el = makeCard(t);
        cards.set(t.id, el);
        list.appendChild(el);
      }
      updateCard(el, t);
    }
    empty.style.display = s.threats.length ? 'none' : 'block';
  };
}

function makeCard(t: Threat): HTMLElement {
  const el = document.createElement('div');
  el.className = `tb-card tb-card--${t.severity}${t.legit ? ' tb-card--legit' : ''}`;
  const def = THREATS[t.kind];
  el.innerHTML = `
    <div class="tb-head">
      <span class="tb-sev">${t.severity.toUpperCase()}</span>
      <span class="tb-name">${t.name}</span>
    </div>
    <div class="tb-desc">${def.description}</div>
    <div class="tb-counters">counters: ${def.counters.map((c) => `<span>${c}</span>`).join('')}</div>
    <div class="tb-bar"><div class="tb-bar-fill"></div></div>
  `;
  return el;
}

function updateCard(el: HTMLElement, t: Threat) {
  const fill = el.querySelector<HTMLElement>('.tb-bar-fill')!;
  fill.style.width = `${t.progress}%`;
  if (t.progress > 70) el.classList.add('is-hot');
  else el.classList.remove('is-hot');
}
