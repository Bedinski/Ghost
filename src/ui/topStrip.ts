import type { GameState } from '../types';

export interface TopStripHandle {
  render(s: GameState): void;
  anchorFor(key: 'budget' | 'security' | 'reputation' | 'techDebt' | 'day'): DOMRect | null;
}

export function mountTopStripWithAnchors(host: HTMLElement): TopStripHandle {
  const render = mountTopStrip(host);
  return {
    render,
    anchorFor(key) {
      const sel: Record<string, string> = {
        budget: '.ts-budget-num',
        security: '.arc-num',
        reputation: '.ts-rep-num',
        techDebt: '.ts-debt-num',
        day: '.ts-day-num',
      };
      const el = host.querySelector<HTMLElement>(sel[key] ?? '');
      return el ? el.getBoundingClientRect() : null;
    },
  };
}

export function mountTopStrip(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <div class="top-strip">
      <div class="ts-brand">
        <span class="ts-glyph"></span>
        <div class="ts-name">
          <div class="ts-company"></div>
          <div class="ts-role">network operations • ghostOS</div>
        </div>
      </div>
      <div class="ts-stat ts-day"><label>day</label><span class="ts-day-num">0</span></div>
      <div class="ts-stat ts-budget"><label>budget</label><span class="ts-budget-num">0</span></div>
      <div class="ts-stat ts-sec">
        <label>security</label>
        <div class="arc"><svg viewBox="0 0 64 36"><path class="arc-track" d="M6 32 A26 26 0 0 1 58 32" stroke-width="5" fill="none"/><path class="arc-fill" d="M6 32 A26 26 0 0 1 58 32" stroke-width="5" fill="none"/></svg><span class="arc-num">0</span></div>
      </div>
      <div class="ts-stat ts-rep"><label>reputation</label><div class="ts-rep-bar"><div class="ts-rep-fill"></div></div><span class="ts-rep-num">0</span></div>
      <div class="ts-stat ts-debt"><label>tech debt</label><span class="ts-debt-num">0</span></div>
    </div>
  `;

  const glyph = host.querySelector<HTMLElement>('.ts-glyph')!;
  const company = host.querySelector<HTMLElement>('.ts-company')!;
  const dayNum = host.querySelector<HTMLElement>('.ts-day-num')!;
  const budgetNum = host.querySelector<HTMLElement>('.ts-budget-num')!;
  const arcFill = host.querySelector<SVGPathElement>('.arc-fill')!;
  const arcNum = host.querySelector<HTMLElement>('.arc-num')!;
  const repFill = host.querySelector<HTMLElement>('.ts-rep-fill')!;
  const repNum = host.querySelector<HTMLElement>('.ts-rep-num')!;
  const debtNum = host.querySelector<HTMLElement>('.ts-debt-num')!;

  const ARC_LEN = 81.68; // approx length of the arc path
  arcFill.style.strokeDasharray = `${ARC_LEN}`;
  arcFill.style.strokeDashoffset = `${ARC_LEN}`;

  let lastBudget = -1;
  let lastDay = -1;

  return (s: GameState) => {
    if (s.company.name && company.textContent !== s.company.name) {
      company.textContent = s.company.name;
      glyph.textContent = s.company.glyph;
    }
    if (s.day !== lastDay) {
      dayNum.classList.remove('ts-day-num--flip');
      void dayNum.offsetWidth;
      dayNum.classList.add('ts-day-num--flip');
      dayNum.textContent = String(s.day);
      lastDay = s.day;
    }
    if (Math.round(s.budget) !== lastBudget) {
      budgetNum.textContent = `$${Math.round(s.budget)}`;
      budgetNum.classList.toggle('is-negative', s.budget < 0);
      lastBudget = Math.round(s.budget);
    }
    const sec = Math.max(0, Math.min(100, s.securityPosture));
    arcFill.style.strokeDashoffset = `${ARC_LEN * (1 - sec / 100)}`;
    arcNum.textContent = String(Math.round(sec));
    arcFill.classList.toggle('arc-fill--low', sec < 30);
    arcFill.classList.toggle('arc-fill--mid', sec >= 30 && sec < 65);
    arcFill.classList.toggle('arc-fill--high', sec >= 65);

    const rep = Math.max(0, Math.min(100, s.reputation));
    repFill.style.width = rep + '%';
    repFill.classList.toggle('is-low', rep < 30);
    repNum.textContent = String(Math.round(rep));

    debtNum.textContent = String(Math.round(s.techDebt));
    debtNum.classList.toggle('is-bad', s.techDebt > 60);
  };
}
