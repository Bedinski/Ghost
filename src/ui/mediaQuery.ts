export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isTouchOnly(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

export function isMobilePortrait(): boolean {
  return window.matchMedia('(max-width: 520px)').matches;
}

export function isCompact(): boolean {
  return window.matchMedia('(max-width: 900px)').matches;
}

interface ExtendedNavigator extends Navigator {
  deviceMemory?: number;
}

export function isLowEnd(): boolean {
  const nav = navigator as ExtendedNavigator;
  const mem = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  return mem < 4 || cores < 4;
}

export function onBreakpointChange(cb: () => void): () => void {
  const mq = window.matchMedia('(max-width: 900px)');
  const mq2 = window.matchMedia('(max-width: 520px)');
  const handler = () => cb();
  mq.addEventListener('change', handler);
  mq2.addEventListener('change', handler);
  return () => {
    mq.removeEventListener('change', handler);
    mq2.removeEventListener('change', handler);
  };
}
