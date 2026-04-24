import { prefersReducedMotion } from '../ui/mediaQuery';

export interface FxController {
  flashAlert(): void;
  flashOk(): void;
  glitch(): void;
  shake(intensity?: number): void;
  signalLoss(): Promise<void>;
  dispose(): void;
}

export function mountFx(host: HTMLElement): FxController {
  const reduced = prefersReducedMotion();
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.innerHTML = `
    <div class="fx-vignette"></div>
    <div class="fx-alert"></div>
    <div class="fx-ok"></div>
    <div class="fx-glitch"></div>
    <div class="fx-signalloss"></div>
    <div class="fx-aberration"></div>
  `;
  host.appendChild(layer);

  const alertEl = layer.querySelector<HTMLElement>('.fx-alert')!;
  const okEl = layer.querySelector<HTMLElement>('.fx-ok')!;
  const glitchEl = layer.querySelector<HTMLElement>('.fx-glitch')!;
  const signalEl = layer.querySelector<HTMLElement>('.fx-signalloss')!;

  function pulse(el: HTMLElement, cls: string, ms: number) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  return {
    flashAlert() {
      pulse(alertEl, 'fx-active', 650);
    },
    flashOk() {
      pulse(okEl, 'fx-active', 500);
    },
    glitch() {
      if (reduced) return;
      pulse(glitchEl, 'fx-active', 420);
      vibrate([15, 40, 15]);
    },
    shake(intensity = 1) {
      if (reduced) return;
      host.style.setProperty('--shake-intensity', String(intensity));
      host.classList.remove('is-shaking');
      void host.offsetWidth;
      host.classList.add('is-shaking');
      setTimeout(() => host.classList.remove('is-shaking'), 380);
    },
    signalLoss() {
      return new Promise<void>((resolve) => {
        signalEl.classList.add('fx-active');
        setTimeout(() => {
          signalEl.classList.remove('fx-active');
          resolve();
        }, 1800);
      });
    },
    dispose() {
      layer.remove();
    },
  };
}

function vibrate(pattern: number[] | number) {
  if (prefersReducedMotion()) return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (nav.vibrate) nav.vibrate(pattern);
}
