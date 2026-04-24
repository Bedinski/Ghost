// Per-device speed preference: how fast the WATCH phase runs. The OBSERVE,
// DECIDE, EXECUTE, and REVIEW phases ignore this setting.
//
// Stored separately from the meta save (which lives under ghost.meta.v1) so
// resetting progression doesn't lose the player's pacing preference.

export type SimSpeed = 1 | 2 | 4;

const SPEED_KEY = 'ghost.speed.v1';
const DEFAULT_SPEED: SimSpeed = 1;

let current: SimSpeed = readSpeed();
const listeners = new Set<(s: SimSpeed) => void>();

function readSpeed(): SimSpeed {
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    const n = raw ? Number(raw) : NaN;
    if (n === 1 || n === 2 || n === 4) return n;
  } catch {
    // ignore
  }
  return DEFAULT_SPEED;
}

function writeSpeed(s: SimSpeed): void {
  try {
    localStorage.setItem(SPEED_KEY, String(s));
  } catch {
    // ignore
  }
}

export function getSpeed(): SimSpeed {
  return current;
}

export function setSpeed(s: SimSpeed): void {
  if (s === current) return;
  current = s;
  writeSpeed(s);
  for (const fn of listeners) fn(current);
}

export function onSpeedChange(fn: (s: SimSpeed) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn) as unknown as void;
}

const SPEEDS: SimSpeed[] = [1, 2, 4];

export function mountSpeedControl(host: HTMLElement): () => void {
  host.innerHTML = `
    <div class="speed-ctrl" role="group" aria-label="simulation speed">
      <span class="sc-label">SPEED</span>
      ${SPEEDS.map(
        (s) => `<button type="button" class="sc-btn" data-speed="${s}">${s}×</button>`,
      ).join('')}
    </div>
  `;
  const btns = host.querySelectorAll<HTMLButtonElement>('.sc-btn');
  function paint() {
    btns.forEach((b) => {
      const v = Number(b.dataset.speed) as SimSpeed;
      b.classList.toggle('is-active', v === current);
      b.setAttribute('aria-pressed', String(v === current));
    });
  }
  btns.forEach((b) =>
    b.addEventListener('click', () => {
      setSpeed(Number(b.dataset.speed) as SimSpeed);
    }),
  );
  paint();
  const off = onSpeedChange(paint);
  return () => {
    off();
    host.innerHTML = '';
  };
}
