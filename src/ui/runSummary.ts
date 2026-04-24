import type { GameState } from '../types';
import { UNLOCK_TABLE } from '../game/progression';

export interface RunSummaryHandle {
  open(state: GameState): Promise<'restart'>;
  close(): void;
}

export function mountRunSummary(host: HTMLElement): RunSummaryHandle {
  const el = document.createElement('div');
  el.className = 'run-summary';
  el.innerHTML = `
    <div class="rs-inner">
      <h1>SIGNAL LOST</h1>
      <p class="rs-cause"></p>
      <dl class="rs-stats"></dl>
      <div class="rs-xp">
        <div class="rs-xp-bar"><div class="rs-xp-fill"></div></div>
        <div class="rs-xp-text"></div>
      </div>
      <div class="rs-unlocks"></div>
      <button type="button" class="rs-restart">▶ reboot</button>
    </div>
  `;
  host.appendChild(el);

  const causeEl = el.querySelector<HTMLElement>('.rs-cause')!;
  const statsEl = el.querySelector<HTMLElement>('.rs-stats')!;
  const xpFill = el.querySelector<HTMLElement>('.rs-xp-fill')!;
  const xpText = el.querySelector<HTMLElement>('.rs-xp-text')!;
  const unlocksEl = el.querySelector<HTMLElement>('.rs-unlocks')!;
  const btn = el.querySelector<HTMLButtonElement>('.rs-restart')!;

  return {
    open(state) {
      return new Promise<'restart'>((resolve) => {
        causeEl.textContent = state.deathReason ?? 'The feed went dark.';
        statsEl.innerHTML = `
          <div><dt>days survived</dt><dd>${state.day}</dd></div>
          <div><dt>threats weathered</dt><dd>${state.takenChoices.length}</dd></div>
          <div><dt>final reputation</dt><dd>${Math.round(state.reputation)}</dd></div>
          <div><dt>final posture</dt><dd>${Math.round(state.securityPosture)}</dd></div>
          <div><dt>best run so far</dt><dd>day ${state.meta.bestDay}</dd></div>
          <div><dt>total runs</dt><dd>${state.meta.totalRuns}</dd></div>
        `;
        const nextThreshold = UNLOCK_TABLE.find((u) => u.xp > state.meta.totalXp);
        const prevThreshold = [...UNLOCK_TABLE].reverse().find((u) => u.xp <= state.meta.totalXp);
        const prev = prevThreshold?.xp ?? 0;
        const next = nextThreshold?.xp ?? state.meta.totalXp;
        const pct = next === prev ? 100 : Math.min(100, ((state.meta.totalXp - prev) / (next - prev)) * 100);
        xpFill.style.width = pct + '%';
        xpText.textContent = `+${state.xpEarned} xp · total ${state.meta.totalXp}${nextThreshold ? ` · next: ${nextThreshold.label} @ ${nextThreshold.xp}xp` : ' · all unlocks earned'}`;

        if (state.newlyUnlocked.length) {
          unlocksEl.innerHTML =
            '<h3>unlocked</h3><ul>' +
            state.newlyUnlocked.map((u) => `<li>✦ ${u}</li>`).join('') +
            '</ul>';
        } else {
          unlocksEl.innerHTML = '';
        }

        el.classList.add('is-open');
        btn.focus();
        btn.onclick = () => {
          el.classList.remove('is-open');
          resolve('restart');
        };
      });
    },
    close() {
      el.classList.remove('is-open');
    },
  };
}
