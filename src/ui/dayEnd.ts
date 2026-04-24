import type { GameState } from '../types';

export interface DaySnapshot {
  day: number;
  reputation: number;
  security: number;
  budget: number;
  techDebt: number;
}

export function snapshot(state: GameState): DaySnapshot {
  return {
    day: state.day,
    reputation: state.reputation,
    security: state.securityPosture,
    budget: state.budget,
    techDebt: state.techDebt,
  };
}

export interface DayEndHandle {
  open(snap: DaySnapshot, after: GameState, resolvedNames: string[], landedNames: string[]): Promise<void>;
}

export function mountDayEnd(host: HTMLElement): DayEndHandle {
  const el = document.createElement('div');
  el.className = 'day-end';
  el.innerHTML = `
    <div class="de-card">
      <header class="de-head">
        <span class="de-tag">day complete</span>
        <h2 class="de-day"></h2>
      </header>
      <ul class="de-stats"></ul>
      <p class="de-flavor"></p>
      <div class="de-incidents"></div>
      <button type="button" class="de-next">next day ▶</button>
    </div>
  `;
  host.appendChild(el);

  const dayEl = el.querySelector<HTMLElement>('.de-day')!;
  const statsEl = el.querySelector<HTMLElement>('.de-stats')!;
  const flavorEl = el.querySelector<HTMLElement>('.de-flavor')!;
  const incidentsEl = el.querySelector<HTMLElement>('.de-incidents')!;
  const btn = el.querySelector<HTMLButtonElement>('.de-next')!;

  let resolveFn: (() => void) | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function close() {
    el.classList.remove('is-open');
    if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
    setTimeout(() => { resolveFn?.(); resolveFn = null; }, 320);
  }
  btn.addEventListener('click', close);

  return {
    open(snap, after, resolvedNames, landedNames) {
      return new Promise<void>((resolve) => {
        resolveFn = resolve;
        const dRep = Math.round(after.reputation - snap.reputation);
        const dSec = Math.round(after.securityPosture - snap.security);
        const dBudget = Math.round(after.budget - snap.budget);
        const dDebt = Math.round(after.techDebt - snap.techDebt);

        dayEl.textContent = `Day ${snap.day} resolved`;

        statsEl.innerHTML = [
          renderStat('reputation', after.reputation, dRep, true),
          renderStat('security', Math.round(after.securityPosture), dSec, true),
          renderStat('budget', after.budget, dBudget, true, '$'),
          renderStat('tech debt', after.techDebt, dDebt, false),
        ].join('');

        // Pick a flavor line based on what happened.
        flavorEl.textContent = pickFlavor(dRep, dSec, landedNames.length, resolvedNames.length);
        flavorEl.classList.toggle('is-bad', dRep <= -5 || landedNames.length > 0);
        flavorEl.classList.toggle('is-good', dRep >= 3 && landedNames.length === 0);

        const items: string[] = [];
        for (const n of resolvedNames) items.push(`<li class="de-ok">✓ neutralised: ${n}</li>`);
        for (const n of landedNames) items.push(`<li class="de-bad">✗ landed: ${n}</li>`);
        incidentsEl.innerHTML = items.length
          ? `<ul class="de-list">${items.join('')}</ul>`
          : '<p class="de-quiet">no incidents — quiet shift.</p>';

        el.classList.add('is-open');
        setTimeout(() => btn.focus(), 60);
        keyHandler = (e: KeyboardEvent) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            close();
          }
        };
        window.addEventListener('keydown', keyHandler);
      });
    },
  };
}

function renderStat(label: string, val: number, delta: number, lowerIsWorse: boolean, prefix = ''): string {
  const arrow = delta === 0 ? '·' : delta > 0 ? '▲' : '▼';
  const good = lowerIsWorse ? delta > 0 : delta < 0;
  const cls = delta === 0 ? 'de-stat--flat' : good ? 'de-stat--good' : 'de-stat--bad';
  const sign = delta > 0 ? '+' : '';
  return `
    <li class="de-stat ${cls}">
      <span class="de-label">${label}</span>
      <span class="de-val">${prefix}${Math.round(val)}</span>
      <span class="de-delta">${arrow} ${sign}${delta}</span>
    </li>
  `;
}

function pickFlavor(dRep: number, dSec: number, landed: number, resolved: number): string {
  if (landed >= 2) return 'Bad night. Two breaches got through.';
  if (landed === 1) return 'They got one past you. Patch it tomorrow.';
  if (resolved >= 2) return 'You held the line. Two threats neutralised.';
  if (resolved === 1) return 'Caught it in time. The fleet is steady.';
  if (dRep >= 3 && dSec >= 3) return 'Quiet shift. Posture and trust both up.';
  if (dRep <= -3) return 'Customers are noticing the rough edges.';
  if (dSec <= -3) return 'Security drift. Tech debt is catching up.';
  return 'A quiet day. You drink the rest of the coffee.';
}
