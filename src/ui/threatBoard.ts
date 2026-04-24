import type { GameState, Threat } from '../types';
import { THREATS } from '../game/events';
import { CHOICES_BY_ID } from '../game/choices';

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
    const taken = new Set(s.takenChoices);
    const offered = new Set(s.offeredChoices);
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
        el = makeCard(t, taken, offered);
        cards.set(t.id, el);
        list.appendChild(el);
      }
      updateCard(el, t, taken, offered);
    }
    empty.style.display = s.threats.length ? 'none' : 'block';
  };
}

function counterChip(id: string, taken: Set<string>, offered: Set<string>): string {
  const c = CHOICES_BY_ID.get(id);
  const name = c?.name ?? id;
  let cls = 'tb-chip';
  let prefix = '';
  if (taken.has(id)) {
    cls += ' tb-chip--owned';
    prefix = '✓ ';
  } else if (offered.has(id)) {
    cls += ' tb-chip--available';
    prefix = '▶ ';
  }
  return `<span class="${cls}">${prefix}${name}</span>`;
}

function makeCard(t: Threat, taken: Set<string>, offered: Set<string>): HTMLElement {
  const el = document.createElement('div');
  el.className = `tb-card tb-card--${t.severity}${t.legit ? ' tb-card--legit' : ''}`;
  const def = THREATS[t.kind];
  el.innerHTML = `
    <div class="tb-head">
      <span class="tb-sev">${t.severity.toUpperCase()}</span>
      <span class="tb-name">${t.name}</span>
    </div>
    <div class="tb-desc">${def.description}</div>
    <div class="tb-counter-row">
      <span class="tb-counter-label">counter:</span>
      <div class="tb-counter-list">${def.counters.map((c) => counterChip(c, taken, offered)).join('')}</div>
    </div>
    <div class="tb-bar"><div class="tb-bar-fill"></div></div>
  `;
  return el;
}

function updateCard(el: HTMLElement, t: Threat, taken: Set<string>, offered: Set<string>) {
  const fill = el.querySelector<HTMLElement>('.tb-bar-fill')!;
  fill.style.width = `${t.progress}%`;
  el.classList.toggle('is-hot', t.progress > 70);
  // Re-render counter chips: ownership/offered status can change between
  // ticks (player just took the choice).
  const list = el.querySelector<HTMLElement>('.tb-counter-list');
  if (list) {
    const def = THREATS[t.kind];
    list.innerHTML = def.counters.map((c) => counterChip(c, taken, offered)).join('');
  }
  // Mark the card as "covered" when the player already has at least one
  // counter — calms the visual treatment so unprotected threats stand out.
  const def = THREATS[t.kind];
  const covered = def.counters.some((c) => taken.has(c));
  el.classList.toggle('tb-card--covered', covered);
}
