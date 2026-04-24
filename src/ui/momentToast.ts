export type ToastSeverity = 'info' | 'spawn' | 'land' | 'resolve';

interface Toast {
  text: string;
  severity: ToastSeverity;
  hold: number;
}

export interface MomentToastHandle {
  show(text: string, severity: ToastSeverity, hold?: number): void;
  dispose(): void;
}

// One-line in-screen notifications used during pause-on-event freezes.
// A queue ensures bursts don't overlap; each toast holds for `hold` ms then
// fades. The default hold matches the freeze duration in main.ts.
export function mountMomentToast(host: HTMLElement): MomentToastHandle {
  const wrap = document.createElement('div');
  wrap.className = 'moment-toast-wrap';
  host.appendChild(wrap);

  const queue: Toast[] = [];
  let active = false;

  function next() {
    if (active) return;
    const t = queue.shift();
    if (!t) return;
    active = true;
    const el = document.createElement('div');
    el.className = `moment-toast moment-toast--${t.severity}`;
    el.textContent = t.text;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    setTimeout(() => {
      el.classList.remove('is-in');
      el.classList.add('is-out');
      setTimeout(() => {
        el.remove();
        active = false;
        next();
      }, 220);
    }, t.hold);
  }

  return {
    show(text, severity, hold = 700) {
      queue.push({ text, severity, hold });
      next();
    },
    dispose() {
      wrap.remove();
    },
  };
}
