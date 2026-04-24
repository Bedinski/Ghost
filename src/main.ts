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
import { mountSituationReport } from './ui/situationReport';
import { mountExecutePhase } from './ui/executePhase';
import { getSpeed } from './ui/speedControl';

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
const situationReport = mountSituationReport(screen);
const executePhase = mountExecutePhase(screen, {
  floatHost: monitor.floatHost(),
  servers: monitor.servers(),
  network: monitor.network(),
  topstrip: monitor.topStrip(),
});
const fx = mountFx(monitorLayer);

if (!window.matchMedia('(pointer: coarse)').matches) {
  window.addEventListener('pointermove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    bgLayer.style.transform = `translate3d(${x * -6}px, ${y * -6}px, 0)`;
  });
}

let store = createStore<GameState>(initialState(loadMeta()));
let lastPickedChoice: string | null = null;

function attachStoreSubs() {
  store.subscribe((s, prev) => {
    monitor.render(s);
    if (s.threats.length > prev.threats.length) {
      fx.flashAlert();
      fx.shake(1.2);
      fx.glitch();
      monitor.showThreatsPanel();
    }
    const newLogs = s.log.slice(prev.log.length);
    if (newLogs.some((e) => e.text.startsWith('✗ '))) {
      fx.flashAlert();
      fx.shake(1.6);
      fx.glitch();
      monitor.showThreatsPanel();
    }
  });
}
attachStoreSubs();
monitor.render(store.get());

// Pull observe-familiarity from meta to scale the situation report duration.
function observeHoldMs(): number {
  const fam = store.get().meta.observeFamiliarity ?? 0;
  if (fam < 3) return 3500;
  if (fam < 8) return 2500;
  return 1800;
}

async function runGame() {
  await runBootSequence(screen, store.get().company.name);
  store.update((s) => ({ ...s, phase: 'intro' }));

  if (!store.get().meta.tutorialSeen) {
    await briefing.open();
    const meta = markTutorialSeen();
    store.update((s) => ({ ...s, meta }));
  }

  await loopDays();
}

async function loopDays() {
  while (true) {
    // Day starts (advance + draw choices). The monitor is already rendering
    // the new state behind whatever overlay we open next.
    await nextDay();

    // OBSERVE — give the player time to read the new state before deciding.
    await situationReport.open(store.get(), observeHoldMs());
    bumpFamiliarity();

    // DECIDE — choice cards.
    const beforeChoice = store.get();
    const picked = await choicePanel.open(beforeChoice);
    lastPickedChoice = picked;

    // Apply the choice into state (immediate effects + ongoing modifier).
    store.update((s) => ({ ...applyChoice(s, picked), phase: 'sim' }));
    fx.flashOk();

    // EXECUTE — visualise the choice's immediate effects.
    await executePhase.play(picked, beforeChoice);

    // WATCH — the day plays out.
    const before = snapshot(store.get());
    const logSeq = store.get().logSeq;
    const fail = await watchPhase();
    if (fail) {
      await handleDeath(fail);
      return;
    }
    const after = store.get();
    const fresh = after.log.filter((e) => e.id > logSeq);
    const resolved = fresh
      .filter((e) => e.text.startsWith('✓ '))
      .map((e) => e.text.replace(/^✓\s*/, '').replace(/\s*neutralised.*$/i, '').trim());
    const landed = fresh
      .filter((e) => e.text.startsWith('✗ '))
      .map((e) => e.text.replace(/^✗\s*/, '').replace(/\s*landed.*$/i, '').trim());

    // REVIEW — recap.
    await dayEnd.open(before, after, resolved, landed);
  }
}

function bumpFamiliarity() {
  const meta = store.get().meta;
  const next = { ...meta, observeFamiliarity: Math.min(10, (meta.observeFamiliarity ?? 0) + 1) };
  saveMeta(next);
  store.update((s) => ({ ...s, meta: next }));
}

async function nextDay() {
  store.update((s) => {
    const next = advanceDay(s);
    next.offeredChoices = drawChoices(next);
    return next;
  });
}

// WATCH phase: ticks at the player's chosen speed; pauses for ~700ms in
// real time when a noteworthy event fires so the moment toast can read.
function watchPhase(): Promise<string | null> {
  return new Promise((resolve) => {
    let t = 0;
    let freezeUntil = 0;
    let lastSeenLogId = store.get().logSeq;

    function step() {
      const now = performance.now();
      if (now < freezeUntil) {
        scheduleNext();
        return;
      }
      store.update((s) => tick(s));
      t += 1;

      // Surface noteworthy log entries from this tick as moment toasts and
      // pause the sim briefly so the player can read.
      const s = store.get();
      const fresh = s.log.filter((e) => e.id > lastSeenLogId);
      lastSeenLogId = s.logSeq;
      for (const e of fresh) {
        if (e.text.startsWith('⚠ ')) {
          monitor.momentToast().show(`▶ ${e.text.slice(2)}`, 'spawn');
          freezeUntil = now + 700;
        } else if (e.text.startsWith('✗ ')) {
          monitor.momentToast().show(e.text, 'land', 900);
          freezeUntil = now + 900;
        } else if (e.text.startsWith('✓ ')) {
          monitor.momentToast().show(e.text, 'resolve');
          freezeUntil = now + 700;
        }
      }

      const fail = checkFail(s);
      if (fail) {
        const tail = Math.max(0, freezeUntil - performance.now());
        setTimeout(() => resolve(fail), tail);
        return;
      }
      if (t >= TICKS_PER_DAY) {
        // If the last tick triggered a moment toast, let it breathe before
        // the day-end recap takes the screen.
        const tail = Math.max(0, freezeUntil - performance.now());
        setTimeout(() => resolve(null), tail);
        return;
      }
      scheduleNext();
    }

    function scheduleNext() {
      const speed = getSpeed();
      const ms = TICK_MS / speed;
      setTimeout(step, Math.max(8, ms));
    }
    scheduleNext();
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

// Suppress unused: kept for diagnostic use during dev.
void lastPickedChoice;
