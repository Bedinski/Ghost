import './styles/fonts.css';
import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/fx.css';
import './styles/mobile.css';

import type { GameState, ThreatKind } from './types';
import { createStore } from './game/store';
import { applyChoice, checkFail, drawChoices, initialState } from './game/state';
import { advanceDay, spawnThreat, TICKS_PER_DAY, TICK_MS, tick } from './game/simulation';
import { applyRunResult, computeRunXp, loadMeta, markTutorialSeen, saveMeta } from './game/progression';

import { mountBackground } from './scene/background';
import { mountRoom } from './scene/room';
import { mountBezel } from './scene/bezel';
import { mountFx } from './scene/fx';
import { runBootSequence } from './scene/boot';

import { mountMonitor } from './ui/monitor';
import { mountChoicePanel } from './ui/choicePanel';
import { mountRunSummary } from './ui/runSummary';
import { mountBriefing } from './ui/briefing';
import { mountDayEnd, snapshot } from './ui/dayEnd';

const app = document.getElementById('app')!;
app.classList.add('stage');
app.innerHTML = `
  <div class="scene-bg" data-layer="bg"></div>
  <div class="scene-room" data-layer="room"></div>
  <div class="scene-monitor" data-layer="monitor"></div>
  <div class="scene-fx" data-layer="fx"></div>
`;

const bgLayer = app.querySelector<HTMLElement>('[data-layer="bg"]')!;
const roomLayer = app.querySelector<HTMLElement>('[data-layer="room"]')!;
const monitorLayer = app.querySelector<HTMLElement>('[data-layer="monitor"]')!;

mountBackground(bgLayer);
mountRoom(roomLayer);

const screen = document.createElement('div');
screen.style.width = '100%';
screen.style.height = '100%';
screen.style.position = 'relative';
mountBezel(monitorLayer, screen);

const monitor = mountMonitor(screen);
const choicePanel = mountChoicePanel(monitor.choiceOverlayHost());
const summary = mountRunSummary(screen);
const briefing = mountBriefing(screen);
const dayEnd = mountDayEnd(screen);
const fx = mountFx(monitorLayer);

if (!window.matchMedia('(pointer: coarse)').matches) {
  window.addEventListener('pointermove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    bgLayer.style.transform = `translate3d(${x * -6}px, ${y * -6}px, 0)`;
  });
}

let store = createStore<GameState>(initialState(loadMeta()));

function attachStoreSubs() {
  store.subscribe((s, prev) => {
    monitor.render(s);
    if (s.threats.length > prev.threats.length) {
      fx.flashAlert();
      fx.shake(1.2);
      fx.glitch();
      monitor.showThreatsPanel();
    }
  });
}
attachStoreSubs();
monitor.render(store.get());

async function runGame() {
  await runBootSequence(screen, store.get().company.name);
  store.update((s) => ({ ...s, phase: 'intro' }));

  // First-run only: explain the game before the first choice.
  if (!store.get().meta.tutorialSeen) {
    await briefing.open();
    const meta = markTutorialSeen();
    store.update((s) => ({ ...s, meta }));
  }

  await nextDay();
  loopDays();
}

async function loopDays() {
  while (true) {
    await choicePhase();
    const before = snapshot(store.get());
    const logSeq = store.get().logSeq;

    const fail = await simPhase();
    if (fail) {
      await handleDeath(fail);
      return;
    }

    // Collect the names of incidents that resolved or landed during this sim,
    // by inspecting the new log entries we accumulated.
    const after = store.get();
    const fresh = after.log.filter((e) => e.id > logSeq);
    const resolved = fresh
      .filter((e) => e.text.startsWith('✓ '))
      .map((e) => e.text.replace(/^✓\s*/, '').replace(/\s*neutralised\s*$/i, ''));
    const landed = fresh
      .filter((e) => e.text.startsWith('✗ '))
      .map((e) => e.text.replace(/^✗\s*/, '').replace(/\s*landed.*$/i, ''));

    await dayEnd.open(before, after, resolved, landed);
    await nextDay();
  }
}

async function nextDay() {
  store.update((s) => {
    const next = advanceDay(s);
    next.offeredChoices = drawChoices(next);
    return next;
  });
}

async function choicePhase() {
  store.update((s) => ({ ...s, phase: 'choice' }));
  const picked = await choicePanel.open(store.get());
  store.update((s) => {
    const after = applyChoice(s, picked);
    return { ...after, phase: 'sim' };
  });
  fx.flashOk();
}

function simPhase(): Promise<string | null> {
  return new Promise((resolve) => {
    let t = 0;
    const id = setInterval(() => {
      store.update((s) => tick(s));
      t += 1;
      const s = store.get();
      const fail = checkFail(s);
      if (fail) {
        clearInterval(id);
        resolve(fail);
        return;
      }
      if (t >= TICKS_PER_DAY) {
        clearInterval(id);
        resolve(null);
      }
    }, TICK_MS);
  });
}

async function handleDeath(reason: string) {
  store.update((s) => ({ ...s, phase: 'death', deathReason: reason }));
  await fx.signalLoss();
  const s = store.get();
  const resolved = s.takenChoices.length;
  const xp = computeRunXp(s.day, resolved, s.reputation);
  const { meta, newlyUnlocked } = applyRunResult(s.meta, xp, s.day);
  saveMeta(meta);
  store.update((ss) => ({ ...ss, xpEarned: xp, newlyUnlocked, meta }));

  const choice = await summary.open(store.get());
  if (choice === 'restart') restart();
}

function restart() {
  const fresh = initialState(loadMeta());
  store = createStore<GameState>(fresh);
  attachStoreSubs();
  monitor.render(fresh);
  runGame();
}

const DEV_KEYS: Record<string, ThreatKind> = {
  '1': 'ddos-volumetric',
  '2': 'ddos-l7',
  '3': 'credstuff',
  '4': 'sqli',
  '5': 'exfil',
  '6': 'ransomware',
  '7': 'zeroday',
  '8': 'viral-surge',
  '9': 'cascade',
};
window.addEventListener('keydown', (e) => {
  if (!e.shiftKey) return;
  const k = DEV_KEYS[e.key];
  if (!k) return;
  const s = store.get();
  if (s.phase !== 'sim') return;
  store.update((ss) => {
    const copy = { ...ss, threats: [...ss.threats], log: [...ss.log] };
    spawnThreat(copy, k);
    return copy;
  });
});

runGame();
