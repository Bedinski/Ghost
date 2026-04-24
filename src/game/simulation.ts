import type { GameState, LogEntry, Modifier, Packet, Server, Threat, ThreatKind } from '../types';
import { mulberry32 } from './store';
import { clamp } from './state';
import { THREATS, threatsForDay } from './events';

export const TICKS_PER_DAY = 60;
export const TICK_MS = 110;

function aggregateMods(mods: Modifier[]): Required<Omit<Modifier, 'id' | 'source' | 'remaining'>> {
  const base = {
    capacityMul: 1,
    inboundMul: 1,
    firewallBlockPct: 0,
    wafBlockPct: 0,
    rateLimitPct: 0,
    cacheHitPct: 0,
    monitoringBonus: 0,
    logSpeed: 1,
    incidentSpeed: 1,
    falsePositivePct: 0,
    upkeep: 0,
    techDebtPerDay: 0,
    reputationPerDay: 0,
  };
  for (const m of mods) {
    base.capacityMul *= m.capacityMul ?? 1;
    base.inboundMul *= m.inboundMul ?? 1;
    base.firewallBlockPct = 1 - (1 - base.firewallBlockPct) * (1 - (m.firewallBlockPct ?? 0));
    base.wafBlockPct = 1 - (1 - base.wafBlockPct) * (1 - (m.wafBlockPct ?? 0));
    base.rateLimitPct = 1 - (1 - base.rateLimitPct) * (1 - (m.rateLimitPct ?? 0));
    base.cacheHitPct = Math.max(base.cacheHitPct, m.cacheHitPct ?? 0);
    base.monitoringBonus += m.monitoringBonus ?? 0;
    base.logSpeed = Math.max(base.logSpeed, m.logSpeed ?? 1);
    base.incidentSpeed *= m.incidentSpeed ?? 1;
    base.falsePositivePct += m.falsePositivePct ?? 0;
    base.upkeep += m.upkeep ?? 0;
    base.techDebtPerDay += m.techDebtPerDay ?? 0;
    base.reputationPerDay += m.reputationPerDay ?? 0;
  }
  return base;
}

function log(state: GameState, text: string, severity: LogEntry['severity']): void {
  const entry: LogEntry = {
    id: ++state.logSeq,
    day: state.day,
    text,
    severity,
    ts: performance.now(),
  };
  state.log.push(entry);
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

function scheduleThreat(state: GameState, rng: () => number): void {
  const pool = threatsForDay(state.day);
  if (!pool.length) return;
  const kind = pool[Math.floor(rng() * pool.length)];
  if (state.threats.some((t) => t.kind === kind)) return;
  spawnThreat(state, kind);
}

export function spawnThreat(state: GameState, kind: ThreatKind): void {
  const def = THREATS[kind];
  const threat: Threat = {
    id: `t-${state.tick}-${kind}`,
    kind,
    name: def.name,
    severity: def.severity,
    progress: 0,
    rate: def.baseRate,
    legit: def.legit,
    ttl: def.ttl,
    signature: new Array(24).fill(0).map((_, i) => Math.sin(i * 0.4) * 0.5 + 0.5),
  };
  state.threats.push(threat);
  log(
    state,
    def.legit ? `! ${def.name} — legit traffic spike` : `⚠ ${def.name} detected`,
    def.legit ? 'warn' : def.severity === 'crit' ? 'crit' : 'alert',
  );
}

function sumCapacity(servers: Server[], mul: number): number {
  return servers.reduce((a, s) => a + (s.status === 'offline' ? 0 : s.capacity * (s.status === 'degraded' ? 0.55 : 1)), 0) * mul;
}

function spawnPacket(state: GameState, kind: Packet['kind'], speed: number): void {
  state.packets.push({
    id: ++state.packetSeq,
    pathIdx: Math.floor(Math.random() * 3),
    t: 0,
    speed,
    kind,
  });
  if (state.packets.length > 120) state.packets.splice(0, state.packets.length - 120);
}

export function tick(prev: GameState): GameState {
  // Deep-ish copy: arrays we mutate in place below must not be shared with
  // the previous state (the subscribe handler needs a real delta).
  const state: GameState = {
    ...prev,
    tick: prev.tick + 1,
    threats: [...prev.threats],
    log: [...prev.log],
    packets: [...prev.packets],
    history: { inbound: [...prev.history.inbound], outbound: [...prev.history.outbound] },
  };
  const rng = mulberry32((state.rngSeed + state.tick * 0x85ebca77) >>> 0);

  // threat scheduling (pending reveals + random spawns during sim)
  if (state.pendingThreats.length && state.tick % 10 === 0) {
    const kind = state.pendingThreats.shift();
    if (kind) spawnThreat(state, kind);
  } else if (state.phase === 'sim' && state.tick % 14 === 0 && rng() < 0.55) {
    scheduleThreat(state, rng);
  }

  const mods = aggregateMods(state.modifiers);

  // traffic baseline grows with days
  const baseline = 35 + state.day * 5;
  let inbound = baseline * mods.inboundMul;
  let attackInbound = 0;
  for (const t of state.threats) {
    const contrib = baseline * (THREATS[t.kind].inboundMul - 1) * (0.4 + t.progress / 200);
    if (t.legit) inbound += Math.max(0, contrib);
    else attackInbound += Math.max(0, contrib);
  }
  const noise = (rng() - 0.5) * 8;
  inbound = Math.max(0, inbound + noise);

  // edge filters apply to BOTH attack and legit (firewall is indiscriminate)
  const edgeBlocked = (inbound + attackInbound) * mods.firewallBlockPct;
  const wafBlocked = (inbound + attackInbound - edgeBlocked) * mods.wafBlockPct * 0.6; // WAF is selective
  const rateBlocked = (inbound + attackInbound - edgeBlocked - wafBlocked) * mods.rateLimitPct * 0.5;
  const totalBlocked = edgeBlocked + wafBlocked + rateBlocked;

  // false positives: legit traffic that was dropped
  const fpLoss = inbound * mods.falsePositivePct;
  const effectiveLegit = Math.max(0, inbound - fpLoss - inbound * mods.firewallBlockPct * 0.5);
  const effectiveAttack = Math.max(0, attackInbound - (edgeBlocked + wafBlocked + rateBlocked) * 0.9);
  const totalReaching = effectiveLegit + effectiveAttack;

  // cache absorbs fraction of work
  const afterCache = totalReaching * (1 - mods.cacheHitPct * 0.6);

  // distribute load across healthy servers proportionally to capacity
  const totalCap = sumCapacity(state.servers, mods.capacityMul);
  const utilisation = totalCap > 0 ? afterCache / totalCap : 2;

  state.servers = state.servers.map((s) => {
    if (s.status === 'offline') {
      // chance to recover if utilisation is low
      if (utilisation < 0.6 && rng() < 0.02) {
        return { ...s, status: 'degraded', load: 0, health: 20 };
      }
      return { ...s, load: 0 };
    }
    const load = Math.min(s.capacity, s.capacity * utilisation * (1 + (rng() - 0.5) * 0.1));
    let health = s.health;
    let status: Server['status'] = s.status;
    if (utilisation > 1.15) health -= (utilisation - 1) * 2.5;
    else if (utilisation < 0.75 && health < 100) health += 0.5;
    if (!s.patched && state.threats.some((t) => t.kind === 'zeroday')) health -= 0.8;
    if (state.threats.some((t) => t.kind === 'cascade') && rng() < 0.02) health -= 3;
    health = clamp(health, 0, 100);
    if (health <= 0) status = 'offline';
    else if (health < 45) status = 'degraded';
    else status = 'healthy';
    return { ...s, load, health, status };
  });

  const offlineNow = state.servers.every((s) => s.status === 'offline');
  state.allServersOfflineTicks = offlineNow ? state.allServersOfflineTicks + 1 : 0;

  // outbound responds to served traffic
  const outboundBase = afterCache * 0.75;
  let outbound = Math.max(0, outboundBase * (totalCap > 0 ? Math.min(1, totalCap / Math.max(1, afterCache)) : 0));
  let exfilBoost = 0;
  for (const t of state.threats) {
    if (t.kind === 'exfil') exfilBoost += 6 + t.progress * 0.15;
  }
  outbound += exfilBoost;

  // drop / timeout accounting when overloaded
  const dropped = Math.max(0, afterCache - totalCap);
  state.dropped = dropped;

  // threat progression
  state.threats = state.threats
    .map((t) => {
      const def = THREATS[t.kind];
      const blockPct = 1 - (1 - mods.firewallBlockPct) * (1 - mods.wafBlockPct) * (1 - mods.rateLimitPct);
      const countered = def.counters.some((c) => state.takenChoices.includes(c));
      const resolveRate = (countered ? 0.018 : 0.0) * mods.incidentSpeed * (1 + mods.monitoringBonus);
      const ttlPenalty = t.legit ? 0 : 0.6;
      const progress = clamp(
        t.progress +
          (def.severity === 'crit' ? 0.6 : def.severity === 'high' ? 0.45 : 0.3) *
            (1 - blockPct * 0.5) -
          resolveRate * 100 * 0.3,
        0,
        100,
      );
      return { ...t, progress, ttl: t.ttl - ttlPenalty - (countered ? 1 : 0.3) };
    })
    .filter((t) => {
      if (t.progress <= 0 && state.tick > 5) {
        log(state, `✓ ${t.name} neutralised`, 'ok');
        return false;
      }
      if (t.ttl <= 0) {
        if (t.legit) {
          log(state, `• ${t.name} settled`, 'info');
          state.reputation = clamp(state.reputation + 2, 0, 100);
        } else {
          const impact = 0.35 + (t.severity === 'crit' ? 0.6 : t.severity === 'high' ? 0.35 : 0.2);
          const damage = impact * (1 - mods.firewallBlockPct * 0.3);
          state.reputation = clamp(state.reputation - damage * 8, 0, 100);
          state.securityPosture = clamp(state.securityPosture - damage * 6, 0, 100);
          if (t.kind === 'exfil' || t.kind === 'ransomware' || t.kind === 'sqli') state.breachArmed = true;
          log(state, `✗ ${t.name} landed (-${(damage * 8).toFixed(0)} rep)`, 'crit');
        }
        return false;
      }
      return true;
    });

  // reputation feedback from traffic quality
  if (utilisation > 1.3) state.reputation = clamp(state.reputation - 0.25, 0, 100);
  if (fpLoss > 3) state.reputation = clamp(state.reputation - 0.08 * fpLoss, 0, 100);
  if (dropped > 8) state.reputation = clamp(state.reputation - 0.15, 0, 100);
  if (utilisation < 0.9 && state.threats.length === 0 && rng() < 0.2)
    state.reputation = clamp(state.reputation + 0.05, 0, 100);

  // per-tick security drift
  if (state.techDebt > 40) state.securityPosture = clamp(state.securityPosture - 0.02, 0, 100);

  // packet spawn based on rates
  if (state.tick % 2 === 0) {
    const legitPackets = Math.min(6, Math.floor(effectiveLegit / 18));
    for (let i = 0; i < legitPackets; i++) spawnPacket(state, 'legit', 0.012 + rng() * 0.004);
    const attackPackets = Math.min(6, Math.floor(effectiveAttack / 10));
    for (let i = 0; i < attackPackets; i++) spawnPacket(state, 'attack', 0.018 + rng() * 0.006);
    const outPackets = Math.min(4, Math.floor(outbound / 14));
    for (let i = 0; i < outPackets; i++) spawnPacket(state, 'out', 0.011 + rng() * 0.003);
    if (exfilBoost > 2 && rng() < 0.5) spawnPacket(state, 'exfil', 0.01);
  }
  // advance packets
  state.packets = state.packets
    .map((p) => ({ ...p, t: p.t + p.speed }))
    .filter((p) => p.t < 1);

  // history buffers
  state.history.inbound.push(inbound + attackInbound - totalBlocked);
  state.history.outbound.push(outbound);
  if (state.history.inbound.length > 120) state.history.inbound.shift();
  if (state.history.outbound.length > 120) state.history.outbound.shift();
  state.inbound = inbound + attackInbound - totalBlocked;
  state.outbound = outbound;

  // log sampling
  if (state.tick % 6 === 0 && rng() < 0.4 * mods.logSpeed) {
    const samples = [
      `GET /api/v2/orders 200 ${(8 + rng() * 40) | 0}ms`,
      `POST /auth/login 401 ${(10 + rng() * 20) | 0}ms`,
      `heartbeat ok ${state.servers.filter((s) => s.status === 'healthy').length} nodes`,
      `cache hit ratio ${(Math.random() * 80 + 15).toFixed(1)}%`,
      `util ${(utilisation * 100).toFixed(0)}%`,
    ];
    log(state, samples[Math.floor(rng() * samples.length)], 'info');
  }

  return { ...state };
}

export function advanceDay(prev: GameState): GameState {
  const mods = aggregateMods(prev.modifiers);
  // Daily customer revenue scales with reputation. High trust = more
  // customers = more cash. Low trust = customers leaving = trickle.
  const revenue = Math.round(40 + prev.reputation * 0.9);
  const next: GameState = {
    ...prev,
    day: prev.day + 1,
    budget: prev.budget - mods.upkeep + revenue,
    techDebt: Math.max(0, prev.techDebt + mods.techDebtPerDay + 2),
    reputation: clamp(prev.reputation + mods.reputationPerDay, 0, 100),
    modifiers: prev.modifiers.map((m) => ({ ...m, remaining: m.remaining - 1 })).filter((m) => m.remaining > 0),
    log: [...prev.log],
    dropped: 0,
    allServersOfflineTicks: 0,
  };
  log(next, `— Day ${next.day} begins —`, 'info');
  log(next, `Revenue +$${revenue} · upkeep -$${mods.upkeep}`, 'info');
  return next;
}
