import type { Listener } from '../types';

export interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (s: T) => T): void;
  subscribe(fn: Listener<T>): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();
  return {
    get: () => state,
    set(next) {
      const prev = state;
      state = next;
      for (const fn of listeners) fn(state, prev);
    },
    update(fn) {
      this.set(fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

// Mulberry32 deterministic RNG, seeded per run.
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
