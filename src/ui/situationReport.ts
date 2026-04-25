import type { GameState } from '../types';
import { THREATS } from '../game/events';
import { CHOICES_BY_ID } from '../game/choices';
import { forecastNextDay } from '../game/forecast';

export interface SituationReportHandle {
  open(state: GameState, holdMs: number): Promise<void>;
}

// The OBSERVE phase. A semi-transparent overlay that names the day and
// summarises everything the player should read off the monitor before
// being asked to make a decision. The monitor is rendered behind the
// overlay so the report acts as a guided read of the live state.
export function mountSituationReport(host: HTMLElement): SituationReportHandle {
  const el = document.createElement('div');
  el.className = 'sit-report';
  el.innerHTML = `
    <div class="sr-card">
      <header class="sr-head">
        <span class="sr-tag">situation report</span>
        <h2 class="sr-day"></h2>
        <span class="sr-clock" aria-hidden="true"></span>
      </header>
      <ul class="sr-rows"></ul>
      <p class="sr-read"></p>
      <button type="button" class="sr-skip" aria-label="skip">skip ▶</button>
    </div>
  `;
  host.appendChild(el);

  const dayEl = el.querySelector<HTMLElement>('.sr-day')!;
  const rowsEl = el.querySelector<HTMLElement>('.sr-rows')!;
  const readEl = el.querySelector<HTMLElement>('.sr-read')!;
  const clockEl = el.querySelector<HTMLElement>('.sr-clock')!;
  const skipBtn = el.querySelector<HTMLButtonElement>('.sr-skip')!;

  let resolveFn: (() => void) | null = null;
  let timer: number | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function close() {
    el.classList.remove('is-open');
    if (timer != null) {
      window.clearTimeout(timer);
      timer = null;
    }
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    setTimeout(() => {
      resolveFn?.();
      resolveFn = null;
    }, 320);
  }

  el.addEventListener('click', (e) => {
    // click outside the card or on skip closes; click inside the card
    // (other than skip) does not, so users can hover the chips.
    if (e.target === el || (e.target as HTMLElement).closest('.sr-skip')) {
      close();
    }
  });

  return {
    open(state, holdMs) {
      return new Promise<void>((resolve) => {
        resolveFn = resolve;
        renderBody(dayEl, rowsEl, readEl, state);
        clockEl.style.setProperty('--hold-ms', `${holdMs}ms`);
        clockEl.classList.remove('is-running');
        // Force reflow so the animation restarts on each open.
        void clockEl.offsetWidth;
        clockEl.classList.add('is-running');

        el.classList.add('is-open');
        skipBtn.focus();
        timer = window.setTimeout(close, holdMs);
        keyHandler = (e) => {
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape' || e.key === 'ArrowRight') {
            e.preventDefault();
            close();
          }
        };
        window.addEventListener('keydown', keyHandler);
      });
    },
  };
}

function renderBody(
  dayEl: HTMLElement,
  rowsEl: HTMLElement,
  readEl: HTMLElement,
  state: GameState,
): void {
  dayEl.textContent = `Day ${state.day}`;

  const taken = new Set(state.takenChoices);
  const offered = new Set(state.offeredChoices);
  const nonLegit = state.threats.filter((t) => !t.legit);
  const legit = state.threats.filter((t) => t.legit);

  const rows: string[] = [];

  // Threats line
  if (nonLegit.length === 0 && legit.length === 0) {
    rows.push(rowLine('threats', 'none active', 'good'));
  } else {
    for (const t of nonLegit) {
      const def = THREATS[t.kind];
      const owned = def.counters.find((c) => taken.has(c));
      const available = def.counters.find((c) => offered.has(c));
      let counterChip = '';
      if (owned) {
        const c = CHOICES_BY_ID.get(owned);
        counterChip = `<span class="sr-chip sr-chip--owned">✓ ${c?.name ?? owned}</span>`;
      } else if (available) {
        const c = CHOICES_BY_ID.get(available);
        counterChip = `<span class="sr-chip sr-chip--available">▶ ${c?.name ?? available}</span>`;
      } else {
        counterChip = `<span class="sr-chip sr-chip--missing">no counter offered</span>`;
      }
      rows.push(
        rowLine(
          t.severity.toUpperCase(),
          `${t.name} · ${Math.max(0, Math.round(t.ttl))}s`,
          t.severity === 'crit' ? 'bad' : 'warn',
          counterChip,
        ),
      );
    }
    for (const t of legit) {
      rows.push(
        rowLine(
          'SURGE',
          `${t.name} · keep firewall light`,
          'info',
        ),
      );
    }
  }

  // Fleet line
  const healthy = state.servers.filter((s) => s.status === 'healthy').length;
  const degraded = state.servers.filter((s) => s.status === 'degraded').length;
  const offline = state.servers.filter((s) => s.status === 'offline').length;
  const fleetTone = offline >= 1 ? 'bad' : degraded >= 1 ? 'warn' : 'good';
  rows.push(
    rowLine(
      'fleet',
      `${healthy} healthy · ${degraded} degraded · ${offline} offline`,
      fleetTone,
    ),
  );

  // Money line
  const broke = state.budget < 60;
  rows.push(
    rowLine(
      'budget',
      `$${Math.round(state.budget)}${broke ? ' · low — Catch Your Breath available' : ''}`,
      broke ? 'warn' : 'info',
    ),
  );

  // Forecast — what's likely tomorrow. Helps the player justify PREPARE picks.
  const forecast = forecastNextDay(state);
  if (forecast.length > 0) {
    const names = forecast.map((f) => THREATS[f.kind].name).join(' · ');
    rows.push(rowLine('forecast', `tomorrow likely: ${names}`, 'info'));
  }

  rowsEl.innerHTML = rows.join('');

  // Situational read — one line of plain advice the player can act on.
  readEl.textContent = pickRead(state, nonLegit.length, legit.length, offline, degraded, broke);
}

function rowLine(label: string, value: string, tone: 'good' | 'warn' | 'bad' | 'info', extra = ''): string {
  return `
    <li class="sr-row sr-row--${tone}">
      <span class="sr-row-label">${label}</span>
      <span class="sr-row-value">${value}</span>
      ${extra ? `<span class="sr-row-extra">${extra}</span>` : ''}
    </li>
  `;
}

function pickRead(
  state: GameState,
  nonLegit: number,
  legit: number,
  offline: number,
  degraded: number,
  broke: boolean,
): string {
  if (offline >= 2) return 'fleet collapsing — bring servers back online or cap incoming load.';
  if (nonLegit >= 2) return 'multiple incidents in flight — prioritise the highest-severity counter.';
  if (nonLegit === 1) {
    const t = state.threats.find((x) => !x.legit)!;
    return `${t.name.toLowerCase()} active — counter it or harden defences before it lands.`;
  }
  if (legit >= 1) return 'legit traffic surge — protect capacity, soften aggressive blocks.';
  if (offline === 1) return '1 server offline — recovery or scaling now keeps the fleet steady.';
  if (degraded >= 2) return 'fleet stressed — patching or scaling will calm it.';
  if (broke) return 'cash is tight — Catch Your Breath today, ship something bigger when revenue catches up.';
  if (state.day <= 1) return "all clear. ship something proactive — tomorrow's threats arrive sooner than you think.";
  if (state.securityPosture < 35) return 'posture low — invest in defences before a breach lands.';
  return 'systems nominal. invest where you expect tomorrow to hurt.';
}
