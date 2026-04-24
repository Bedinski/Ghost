import { CHOICES_BY_ID } from '../game/choices';
import type { Choice, GameState } from '../types';
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
      <h2>choose your next move</h2>
      <span class="choice-hint">press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> or tap a card</span>
    </div>
    <div class="choice-cards"></div>
  `;
  host.appendChild(overlay);
  const cards = overlay.querySelector<HTMLElement>('.choice-cards')!;

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
        cards.innerHTML = '';
        const ids = state.offeredChoices;
        ids.forEach((id, idx) => {
          const c = CHOICES_BY_ID.get(id);
          if (!c) return;
          const canAfford = state.budget >= c.cost;
          const el = renderCard(c, idx, canAfford);
          el.addEventListener('click', () => {
            if (!canAfford) {
              el.classList.add('cc--deny');
              setTimeout(() => el.classList.remove('cc--deny'), 400);
              return;
            }
            pick(id, el);
          });
          attachTilt(el);
          cards.appendChild(el);
        });
        overlay.classList.add('is-open');

        keyHandler = (e: KeyboardEvent) => {
          const idx = parseInt(e.key, 10) - 1;
          if (Number.isNaN(idx) || idx < 0 || idx >= ids.length) return;
          const id = ids[idx];
          const c = CHOICES_BY_ID.get(id);
          if (!c || state.budget < c.cost) return;
          const el = cards.children.item(idx) as HTMLElement | null;
          if (el) pick(id, el);
        };
        window.addEventListener('keydown', keyHandler);
      });
    },
    close,
  };
}

function renderCard(c: Choice, idx: number, canAfford: boolean): HTMLElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `cc cc--tier-${c.tier}${canAfford ? '' : ' cc--unafford'}`;
  el.innerHTML = `
    <span class="cc-shimmer" aria-hidden="true"></span>
    <span class="cc-key">${idx + 1}</span>
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
