import type { MetaState } from '../types';

const META_KEY = 'ghost.meta.v1';

export const UNLOCK_TABLE: { xp: number; id: string; label: string; kind: 'choice' | 'perk' }[] = [
  { xp: 20, id: 'hire-sre', label: 'Choice: Hire an SRE', kind: 'choice' },
  { xp: 45, id: 'deploy-waf', label: 'Choice: Deploy WAF', kind: 'choice' },
  { xp: 70, id: 'siem', label: 'Choice: SIEM Logging', kind: 'choice' },
  { xp: 100, id: 'perk-budget', label: 'Perk: +$150 starting budget', kind: 'perk' },
  { xp: 140, id: 'cdn', label: 'Choice: CDN Rollout', kind: 'choice' },
  { xp: 180, id: 'db-replica', label: 'Choice: DB Replica', kind: 'choice' },
  { xp: 230, id: 'perk-server', label: 'Perk: +1 starting app server', kind: 'perk' },
  { xp: 300, id: 'zero-trust', label: 'Choice: Zero-Trust Migration', kind: 'choice' },
  { xp: 400, id: 'perk-reveal', label: 'Perk: Reveal 1 extra choice slot', kind: 'perk' },
];

const DEFAULT_META: MetaState = {
  totalRuns: 0,
  bestDay: 0,
  totalXp: 0,
  unlocked: [],
  perks: [],
  tutorialSeen: false,
  lastSeenVersion: 1,
};

export function markTutorialSeen(): MetaState {
  const meta = loadMeta();
  if (meta.tutorialSeen) return meta;
  const next = { ...meta, tutorialSeen: true };
  saveMeta(next);
  return next;
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return { ...DEFAULT_META };
    const parsed = JSON.parse(raw) as Partial<MetaState>;
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage errors (private mode, etc.)
  }
}

export function resetMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // ignore
  }
}

export function computeRunXp(daysSurvived: number, threatsResolved: number, reputation: number): number {
  return Math.max(0, Math.round(daysSurvived * 4 + threatsResolved * 3 + reputation * 0.15));
}

export function applyRunResult(
  meta: MetaState,
  xpEarned: number,
  daysSurvived: number,
): { meta: MetaState; newlyUnlocked: string[] } {
  const totalXp = meta.totalXp + xpEarned;
  const bestDay = Math.max(meta.bestDay, daysSurvived);
  const unlocked = new Set(meta.unlocked);
  const perks = new Set(meta.perks);
  const newlyUnlocked: string[] = [];
  for (const row of UNLOCK_TABLE) {
    if (totalXp >= row.xp) {
      const set = row.kind === 'choice' ? unlocked : perks;
      if (!set.has(row.id)) {
        set.add(row.id);
        newlyUnlocked.push(row.label);
      }
    }
  }
  return {
    meta: {
      ...meta,
      totalRuns: meta.totalRuns + 1,
      bestDay,
      totalXp,
      unlocked: [...unlocked],
      perks: [...perks],
    },
    newlyUnlocked,
  };
}
