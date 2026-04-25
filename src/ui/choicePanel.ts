import { CHOICES_BY_ID } from '../game/choices';
import type { Choice, GameState, OfferedSlot } from '../types';
import { icon } from './icons';

export interface ChoicePanelHandle {
  open(state: GameState): Promise<string>;
  close(): void;
}

export function mountChoicePanel(host: HTMLElement): ChoicePanelHandle {
  host.innerHTML = '';
  const overlay = document.createElement('div');
  overlay.className = 'choice-overlay';
  overlay.innerHTML = `
    <div class="choice-title">
      <span class="choice-pulse"></span>
      <span class="choice-day"></span>
      <h2 class="choice-h2">ship one improvement</h2>
      <p class="choice-sub">you can only pick ONE. read the orange line — every choice has a downside.</p>
      <span class="choice-hint">press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or tap a card</span>
    </div>
    <div class="choice-cards"></div>
  `;
  host.appendChild(overlay);
  const cards = overlay.querySelector<HTMLElement>('.choice-cards')!;
  const dayEl = overlay.querySelector<HTMLElement>('.choice-day')!;
  const subEl = overlay.querySelector<HTMLElement>('.choice-sub')!;

  let resolveFn: ((id: string) => void) | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function pick(id: string, el: HTMLElement) {
    if (!resolveFn) return;
    el.classList.add('cc--picked');
    vibrate(30);
    setTimeout(() => {
      const r = resolveFn;
      resolveFn = null;
      close();
      r?.(id);
    }, 260);
  }

  function close() {
    overlay.classList.remove('is-open');
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
  }

  return {
    open(state) {
      return new Promise<string>((resolve) => {
        resolveFn = resolve;
        // Day-aware framing so players know what they're being asked
        dayEl.textContent = `DAY ${state.day}`;
        if (state.day <= 1) {
          subEl.textContent = 'this is your first call. pick the move you think is right — every choice has a downside.';
        } else {
          subEl.textContent = `you have $${Math.round(state.budget)} to spend. you can only ship ONE thing today.`;
        }
        cards.innerHTML = '';
        // Prefer the strategic-slot offering if present (every modern run
        // has it); fall back to the legacy id-only list to stay robust.
        const slots: OfferedSlot[] =
          state.offeredSlots && state.offeredSlots.length
            ? state.offeredSlots
            : state.offeredChoices.map<OfferedSlot>((id) => ({ id, kind: 'random' }));
        slots.forEach((slot, idx) => {
          const c = CHOICES_BY_ID.get(slot.id);
          if (!c) return;
          const canAfford = state.budget >= c.cost;
          const el = renderCard(c, slot, idx, canAfford);
          el.addEventListener('click', () => {
            if (!canAfford) {
              el.classList.add('cc--deny');
              setTimeout(() => el.classList.remove('cc--deny'), 400);
              return;
            }
            pick(slot.id, el);
          });
          attachTilt(el);
          cards.appendChild(el);
        });
        overlay.classList.add('is-open');

        keyHandler = (e: KeyboardEvent) => {
          const idx = parseInt(e.key, 10) - 1;
          if (Number.isNaN(idx) || idx < 0 || idx >= slots.length) return;
          const slot = slots[idx];
          const c = CHOICES_BY_ID.get(slot.id);
          if (!c || state.budget < c.cost) return;
          const el = cards.children.item(idx) as HTMLElement | null;
          if (el) pick(slot.id, el);
        };
        window.addEventListener('keydown', keyHandler);
      });
    },
    close,
  };
}

function slotChip(slot: OfferedSlot): string {
  if (!slot.tag || slot.kind === 'random') return '';
  const cls = `cc-slot cc-slot--${slot.kind}`;
  let prefix = '';
  if (slot.kind === 'react') prefix = '▶ ';
  else if (slot.kind === 'prepare-counter') prefix = '→ ';
  else if (slot.kind === 'prepare-unlock') prefix = '→ ';
  else if (slot.kind === 'build') prefix = '✦ ';
  else if (slot.kind === 'breather') prefix = '◯ ';
  return `<span class="${cls}">${prefix}${slot.tag}</span>`;
}

function renderCard(c: Choice, slot: OfferedSlot, idx: number, canAfford: boolean): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cc cc--tier-${c.tier} cc--slot-${slot.kind}${canAfford ? '' : ' cc--unafford'}`;
  el.innerHTML = `
    <span class="cc-shimmer" aria-hidden="true"></span>
    <span class="cc-key">${idx + 1}</span>
    ${slotChip(slot)}
    <span class="cc-ico">${icon(c.icon, 'cc-ico-svg')}</span>
    <span class="cc-name">${c.name}</span>
    <span class="cc-cost">$${c.cost}</span>
    <p class="cc-desc">${c.desc}</p>
    <ul class="cc-up">${c.upside.map((u) => `<li>▲ ${u}</li>`).join('')}</ul>
    <ul class="cc-down">${c.downside.map((d) => `<li>▼ ${d}</li>`).join('')}</ul>
    ${canAfford ? '' : '<span class="cc-denial">insufficient budget</span>'}
  `;
  return el;
}

function attachTilt(el: HTMLElement) {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const rx = (0.5 - y) * 8;
    const ry = (x - 0.5) * 10;
    el.style.setProperty('--rx', rx.toFixed(2) + 'deg');
    el.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    el.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  el.addEventListener('pointerleave', () => {
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  });
}

function vibrate(ms: number) {
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  nav.vibrate?.(ms);
}
