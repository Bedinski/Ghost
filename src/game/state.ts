import type { GameState, MetaState, OfferedSlot, Server, ServerRole, ThreatKind } from '../types';
import { mulberry32 } from './store';
import { CHOICES, CHOICES_BY_ID } from './choices';
import { THREATS } from './events';
import { forecastNextDay } from './forecast';

const GLYPHS = ['◇', '◆', '◉', '◈', '◎', '◐', '◑', '◒', '◓', '▣', '▤', '▥', '▦', '▨'];
const COMPANIES = [
  'NULLHAVEN',
  'AXONITE',
  'HEXWARE',
  'KERNELCO',
  'MERIDIAN',
  'OBSIDIAN.IO',
  'PARALLAX',
  'QUANTACORE',
  'RUNTIME&CO',
  'SIGIL SYS',
  'VOIDBYTE',
];

let serverSeq = 1;

export function makeServer(role: ServerRole, capacity: number): Server {
  return {
    id: `${role}-${serverSeq++}`,
    role,
    capacity,
    load: 0,
    health: 100,
    status: 'healthy',
    patched: true,
  };
}

export function initialState(meta: MetaState): GameState {
  const seed = (Math.random() * 2 ** 32) >>> 0;
  const rng = mulberry32(seed);
  const extraServer = meta.perks.includes('perk-server');
  const extraBudget = meta.perks.includes('perk-budget') ? 150 : 0;

  const servers: Server[] = [
    makeServer('edge', 160),
    makeServer('lb', 140),
    makeServer('app', 100),
    makeServer('app', 100),
    makeServer('data', 120),
  ];
  if (extraServer) servers.push(makeServer('app', 100));

  const company = {
    name: COMPANIES[Math.floor(rng() * COMPANIES.length)],
    glyph: GLYPHS[Math.floor(rng() * GLYPHS.length)],
  };

  return {
    phase: 'boot',
    tick: 0,
    day: 0,
    budget: 500 + extraBudget,
    reputation: 80,
    securityPosture: 45,
    techDebt: 20,
    servers,
    threats: [],
    modifiers: [],
    history: { inbound: new Array(120).fill(40), outbound: new Array(120).fill(28) },
    log: [],
    logSeq: 0,
    offeredChoices: [],
    offeredSlots: [],
    takenChoices: [],
    pendingThreats: [],
    inbound: 40,
    outbound: 28,
    dropped: 0,
    rngSeed: seed,
    company,
    packets: [],
    packetSeq: 0,
    allServersOfflineTicks: 0,
    breachArmed: false,
    xpEarned: 0,
    newlyUnlocked: [],
    meta,
    activePanel: 'network',
  };
}

export function availableChoices(state: GameState): string[] {
  const unlocked = new Set(state.meta.unlocked);
  return CHOICES.filter((c) => {
    if (c.id === 'breather') return false; // safety net only — never random-drawn
    if (state.takenChoices.includes(c.id)) return false;
    if (c.tier >= 1 && c.id === 'zero-trust' && !unlocked.has('zero-trust')) return false;
    if (c.id === 'deploy-waf' && !unlocked.has('deploy-waf') && c.tier >= 1) return false;
    if (c.id === 'siem' && !unlocked.has('siem') && c.tier >= 1) return false;
    if (c.id === 'cdn' && !unlocked.has('cdn') && c.tier >= 1) return false;
    if (c.id === 'db-replica' && !unlocked.has('db-replica') && c.tier >= 1) return false;
    if (c.id === 'hire-sre' && !unlocked.has('hire-sre') && c.tier >= 1) return false;
    const p = c.prereqs;
    if (p) {
      if (p.choices && !p.choices.every((id) => state.takenChoices.includes(id))) return false;
      if (p.minSecurity !== undefined && state.securityPosture < p.minSecurity) return false;
      if (p.minDay !== undefined && state.day < p.minDay) return false;
    }
    return true;
  }).map((c) => c.id);
}

// drawChoices fills three intent-driven slots so every round offers
// genuinely different decisions:
//   REACT  — counter for the highest-severity active non-legit threat.
//   PREPARE — counter for a forecast threat OR an unlocker for a future tier.
//   BUILD  — synergises with already-shipped choices.
// If a slot can't be filled (e.g., no active threat to react to), it
// collapses and another BUILD/random takes its place. The 'breather'
// safety net replaces a slot only when nothing in the offer is affordable.
export function drawChoices(state: GameState): OfferedSlot[] {
  const rng = mulberry32((state.rngSeed ^ (state.day * 0x9e3779b1)) >>> 0);
  const pool = new Set(availableChoices(state));
  const slotsTarget = state.meta.perks.includes('perk-reveal') ? 4 : 3;
  const slots: OfferedSlot[] = [];

  function take(id: string, slot: Omit<OfferedSlot, 'id'>): void {
    if (slots.some((s) => s.id === id)) return;
    slots.push({ id, ...slot });
    pool.delete(id);
  }

  // REACT — counter for the lead active non-legit threat.
  const activeNonLegit = state.threats.filter((t) => !t.legit);
  if (activeNonLegit.length > 0) {
    const lead =
      activeNonLegit.find((t) => t.severity === 'crit') ??
      activeNonLegit.find((t) => t.severity === 'high') ??
      activeNonLegit[0];
    const counterIds = THREATS[lead.kind].counters
      .filter((id) => pool.has(id))
      .filter((id) => (CHOICES_BY_ID.get(id)?.cost ?? 0) <= state.budget);
    if (counterIds.length > 0) {
      const pick = counterIds[Math.floor(rng() * counterIds.length)];
      take(pick, { kind: 'react', tag: `COUNTERS ${lead.name}`, partner: lead.name });
    }
  }

  // PREPARE — forecast counter, otherwise an unlocker for a future tier.
  if (slots.length < slotsTarget) {
    const forecast = forecastNextDay(state).map((f) => f.kind);
    let prepared = false;
    for (const kind of forecast) {
      const counters = THREATS[kind].counters.filter((id) => pool.has(id));
      const affordable = counters.filter((id) => (CHOICES_BY_ID.get(id)?.cost ?? 0) <= state.budget);
      const list = affordable.length ? affordable : counters; // even if pricey, surface it as a hint
      if (list.length > 0) {
        const pick = list[Math.floor(rng() * list.length)];
        take(pick, {
          kind: 'prepare-counter',
          tag: `PREPARES ${THREATS[kind].name}`,
          partner: THREATS[kind].name,
        });
        prepared = true;
        break;
      }
    }
    if (!prepared) {
      // Try an unlocker — a choice the player can take that gates an as-yet
      // unowned advanced choice in the catalog.
      const unlocker = pickUnlocker(state, pool, rng);
      if (unlocker) take(unlocker.id, { kind: 'prepare-unlock', tag: `UNLOCKS ${unlocker.unlocks}`, partner: unlocker.unlocks });
    }
  }

  // BUILD — synergy-driven pick, otherwise random from pool.
  while (slots.length < slotsTarget && pool.size > 0) {
    const synergyPick = pickSynergy(state, pool, rng);
    if (synergyPick) {
      take(synergyPick.id, {
        kind: 'build',
        tag: synergyPick.partnerName ? `SYNERGY · pairs with ${synergyPick.partnerName}` : 'SYNERGY',
        partner: synergyPick.partnerName ?? undefined,
      });
      continue;
    }
    // Fallback: random from pool, tagged 'random' so the panel shows no chip.
    const remaining = [...pool];
    const pick = remaining[Math.floor(rng() * remaining.length)];
    take(pick, { kind: 'build', tag: undefined });
  }

  // Safety net: if NONE of the slots are affordable and budget is critically
  // low, swap the last slot for the always-free 'breather'.
  const anyAffordable = slots.some((s) => {
    const c = CHOICES_BY_ID.get(s.id);
    return c ? c.cost <= state.budget : false;
  });
  if (!anyAffordable || state.budget < 40) {
    if (slots.length === 0) slots.push({ id: 'breather', kind: 'breather', tag: 'CATCH YOUR BREATH' });
    else slots[slots.length - 1] = { id: 'breather', kind: 'breather', tag: 'CATCH YOUR BREATH' };
  }
  return slots;
}

function pickUnlocker(state: GameState, pool: Set<string>, rng: () => number):
  | { id: string; unlocks: string }
  | null {
  // Find pool choices that, if taken, would satisfy a prereq.choices entry
  // for some advanced choice the player doesn't yet own.
  const taken = new Set(state.takenChoices);
  const candidates: { id: string; unlocks: string }[] = [];
  for (const adv of CHOICES) {
    if (taken.has(adv.id)) continue;
    const need = adv.prereqs?.choices ?? [];
    for (const req of need) {
      if (taken.has(req)) continue;
      if (pool.has(req)) candidates.push({ id: req, unlocks: adv.name });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

function pickSynergy(
  state: GameState,
  pool: Set<string>,
  rng: () => number,
): { id: string; partnerName: string | null } | null {
  const taken = new Set(state.takenChoices);
  const matches: { id: string; partnerName: string }[] = [];
  for (const id of pool) {
    const c = CHOICES_BY_ID.get(id);
    if (!c?.synergyWith) continue;
    for (const partnerId of c.synergyWith) {
      if (taken.has(partnerId)) {
        const partner = CHOICES_BY_ID.get(partnerId)?.name ?? partnerId;
        matches.push({ id, partnerName: partner });
      }
    }
  }
  if (matches.length > 0) return matches[Math.floor(rng() * matches.length)];
  return null;
}

// Legacy export kept only for the meta lookup of "what is on offer". Returns
// just the IDs from the slots; consumers reading offeredChoices keep working.
export function slotIds(slots: OfferedSlot[]): string[] {
  return slots.map((s) => s.id);
}

// Look at what threats this choice's id resolves and return their threat IDs.
export function threatsResolvedBy(state: GameState, choiceId: string): string[] {
  const out: string[] = [];
  for (const t of state.threats) {
    if (THREATS[t.kind].counters.includes(choiceId)) out.push(t.id);
  }
  return out;
}

export function applyChoice(state: GameState, id: string): GameState {
  const c = CHOICES_BY_ID.get(id);
  if (!c) return state;
  if (state.budget < c.cost) return state;

  const s: GameState = {
    ...state,
    budget: state.budget - c.cost,
    // 'breather' is a repeatable safety net — don't burn it from the pool.
    takenChoices: id === 'breather' ? state.takenChoices : [...state.takenChoices, id],
  };

  const imm = c.immediate;
  if (imm) {
    if (imm.budget) s.budget += imm.budget;
    if (imm.reputation) s.reputation = clamp(s.reputation + imm.reputation, 0, 100);
    if (imm.securityPosture) s.securityPosture = clamp(s.securityPosture + imm.securityPosture, 0, 100);
    if (imm.techDebt) s.techDebt = Math.max(0, s.techDebt + imm.techDebt);
    if (imm.capacity) {
      s.servers = s.servers.map((sv) => ({ ...sv, capacity: sv.capacity + imm.capacity! / s.servers.length }));
    }
    if (imm.addServer) {
      const cap = imm.addServer === 'data' ? 120 : imm.addServer === 'cache' ? 180 : 100;
      s.servers = [...s.servers, makeServer(imm.addServer, cap)];
    }
    if (imm.patchAll) s.servers = s.servers.map((sv) => ({ ...sv, patched: true, health: Math.min(100, sv.health + 6) }));
    if (imm.clearThreat) {
      s.threats = s.threats.filter((t) => imm.clearThreat === 'any' ? false : t.kind !== imm.clearThreat);
    }
    if (imm.revealHidden) {
      // surface pending threats right away
      s.pendingThreats = [];
    }
  }

  if (c.ongoing) {
    s.modifiers = [
      ...s.modifiers,
      {
        id: `${c.id}-${s.tick}`,
        source: c.id,
        remaining: c.ongoing.duration ?? 9999,
        capacityMul: c.ongoing.capacityMul,
        inboundMul: c.ongoing.inboundMul,
        firewallBlockPct: c.ongoing.firewallBlockPct,
        wafBlockPct: c.ongoing.wafBlockPct,
        rateLimitPct: c.ongoing.rateLimitPct,
        cacheHitPct: c.ongoing.cacheHitPct,
        monitoringBonus: c.ongoing.monitoringBonus,
        logSpeed: c.ongoing.logSpeed,
        incidentSpeed: c.ongoing.incidentSpeed,
        falsePositivePct: c.ongoing.falsePositivePct,
        upkeep: c.ongoing.upkeep,
        techDebtPerDay: c.ongoing.techDebtPerDay,
        reputationPerDay: c.ongoing.reputationPerDay,
      },
    ];
  }

  // The big fix: any active threat whose `counters` list includes the
  // choice we just took is resolved immediately. The simulation's threat
  // loop will see them gone next tick; we also write a green log line now
  // so the EXECUTE phase already shows attribution.
  const resolvedKinds: ThreatKind[] = [];
  s.threats = s.threats.filter((t) => {
    if (THREATS[t.kind].counters.includes(id)) {
      resolvedKinds.push(t.kind);
      return false;
    }
    return true;
  });
  if (resolvedKinds.length > 0) {
    const newLog = [...s.log];
    for (const kind of resolvedKinds) {
      newLog.push({
        id: ++s.logSeq,
        day: s.day,
        text: `✓ ${THREATS[kind].name} NEUTRALISED by ${c.name}`,
        severity: 'ok',
        ts: performance.now(),
      });
    }
    s.log = newLog;
  }

  return s;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function checkFail(state: GameState): string | null {
  if (state.reputation <= 0) return 'Reputation collapsed. The customers are gone.';
  if (state.budget < -400) return 'The books closed. Bankrupt.';
  if (state.allServersOfflineTicks > 5) return 'Full outage. Every server is dark.';
  if (state.breachArmed && state.securityPosture <= 0)
    return 'Breach confirmed. Attackers walked out with the crown jewels.';
  return null;
}
