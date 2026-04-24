import { prefersReducedMotion } from './mediaQuery';

export type DeltaTone = 'good' | 'bad' | 'neutral';

// Spawns a `+6 security` style label that drifts up from the given anchor
// rect and fades. Returns a Promise that resolves once the animation is
// done (so callers can await sequences of deltas). Reduced-motion users
// see the label briefly without movement.
export function floatDelta(
  host: HTMLElement,
  anchor: DOMRect | null,
  text: string,
  tone: DeltaTone = 'neutral',
): Promise<void> {
  if (!anchor) return Promise.resolve();
  const reduced = prefersReducedMotion();
  return new Promise((resolve) => {
    const hostRect = host.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = `float-delta float-delta--${tone}`;
    el.textContent = text;
    el.style.left = `${anchor.left + anchor.width / 2 - hostRect.left}px`;
    el.style.top = `${anchor.top - hostRect.top}px`;
    host.appendChild(el);
    if (reduced) {
      setTimeout(() => {
        el.remove();
        resolve();
      }, 700);
      return;
    }
    requestAnimationFrame(() => el.classList.add('is-floating'));
    setTimeout(() => {
      el.remove();
      resolve();
    }, 1100);
  });
}

export interface DeltaAnchor {
  for(key: string): DOMRect | null;
}
