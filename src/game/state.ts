import type { GameState, MetaState, Server, ServerRole } from '../types';
import { mulberry32 } from './store';
import { CHOICES, CHOICES_BY_ID } from './choices';
import { THREATS } from './events';

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

export function drawChoices(state: GameState): string[] {
  const rng = mulberry32((state.rngSeed ^ (state.day * 0x9e3779b1)) >>> 0);
  const pool = availableChoices(state);
  const slots = state.meta.perks.includes('perk-reveal') ? 4 : 3;
  const copy = [...pool];

  // When threats are active, ensure at least one offered slot is a counter
  // for the highest-severity threat the player can still afford. This keeps
  // the loop *agentful* — the player should never feel like the choices are
  // unrelated to the screen.
  const draws: string[] = [];
  const activeNonLegit = state.threats.filter((t) => !t.legit);
  if (activeNonLegit.length > 0) {
    const lead =
      activeNonLegit.find((t) => t.severity === 'crit') ??
      activeNonLegit.find((t) => t.severity === 'high') ??
      activeNonLegit[0];
    const counterIds = THREATS[lead.kind].counters;
    const affordableCounter = counterIds
      .filter((id) => copy.includes(id))
      .filter((id) => (CHOICES_BY_ID.get(id)?.cost ?? 0) <= state.budget);
    if (affordableCounter.length > 0) {
      const pick = affordableCounter[Math.floor(rng() * affordableCounter.length)];
      draws.push(pick);
      copy.splice(copy.indexOf(pick), 1);
    }
  }

  for (let i = draws.length; i < Math.min(slots, draws.length + copy.length); i++) {
    const idx = Math.floor(rng() * copy.length);
    draws.push(copy.splice(idx, 1)[0]);
  }

  // Safety net: if the player can't afford any draw OR is critically broke,
  // swap one slot for the always-free 'breather' choice.
  const cheapest = Math.min(...draws.map((id) => CHOICES_BY_ID.get(id)?.cost ?? Infinity));
  if (draws.length === 0 || state.budget < cheapest || state.budget < 60) {
    if (draws.length === 0) draws.push('breather');
    else if (!draws.includes('breather')) draws[draws.length - 1] = 'breather';
  }
  return draws;
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
