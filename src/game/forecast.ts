import type { GameState, ThreatKind } from '../types';
import { mulberry32 } from './store';
import { THREATS, threatsForDay } from './events';

// Predict likely threats the player should prepare for. Reads the next-day
// pool, removes whatever's already active, and weights remaining kinds by
// the day's pressure profile + a deterministic per-day RNG so the forecast
// is stable across re-opens of the situation report.
export function forecastNextDay(state: GameState): { kind: ThreatKind; weight: number }[] {
  const pool = threatsForDay(state.day + 1);
  const active = new Set(state.threats.map((t) => t.kind));
  const candidates = pool.filter((k) => !active.has(k));
  if (candidates.length === 0) return [];

  const rng = mulberry32((state.rngSeed ^ ((state.day + 1) * 0x9e37_79b1)) >>> 0);
  const scored = candidates.map((k) => ({
    kind: k,
    // Weight crit > high > med > low; legit surges are flagged but lower priority.
    weight:
      severityWeight(THREATS[k].severity) * (THREATS[k].legit ? 0.5 : 1) +
      rng() * 0.3,
  }));
  scored.sort((a, b) => b.weight - a.weight);
  return scored.slice(0, 2);
}

function severityWeight(s: 'low' | 'med' | 'high' | 'crit'): number {
  return s === 'crit' ? 4 : s === 'high' ? 3 : s === 'med' ? 2 : 1;
}
