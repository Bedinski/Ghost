export type Phase = 'boot' | 'intro' | 'choice' | 'sim' | 'death';

export type ServerRole = 'edge' | 'lb' | 'app' | 'data' | 'cache';

export interface Server {
  id: string;
  role: ServerRole;
  capacity: number;
  load: number;
  health: number;
  status: 'healthy' | 'degraded' | 'offline';
  patched: boolean;
}

export type ThreatKind =
  | 'ddos-volumetric'
  | 'ddos-l7'
  | 'credstuff'
  | 'sqli'
  | 'exfil'
  | 'ransomware'
  | 'zeroday'
  | 'viral-surge'
  | 'insider'
  | 'cert-expiry'
  | 'disk-full'
  | 'cascade';

export interface Threat {
  id: string;
  kind: ThreatKind;
  name: string;
  severity: 'low' | 'med' | 'high' | 'crit';
  progress: number;
  rate: number;
  legit: boolean;
  ttl: number;
  signature: number[];
}

export interface Modifier {
  id: string;
  source: string;
  remaining: number;
  capacityMul?: number;
  inboundMul?: number;
  firewallBlockPct?: number;
  wafBlockPct?: number;
  rateLimitPct?: number;
  cacheHitPct?: number;
  monitoringBonus?: number;
  logSpeed?: number;
  incidentSpeed?: number;
  falsePositivePct?: number;
  upkeep?: number;
  techDebtPerDay?: number;
  reputationPerDay?: number;
}

export interface ChoiceEffect {
  budget?: number;
  reputation?: number;
  securityPosture?: number;
  techDebt?: number;
  capacity?: number;
  addServer?: ServerRole;
  patchAll?: boolean;
  clearThreat?: ThreatKind | 'any';
  revealHidden?: boolean;
}

export interface Choice {
  id: string;
  name: string;
  desc: string;
  icon: string;
  cost: number;
  tier: number;
  prereqs?: { choices?: string[]; minSecurity?: number; minDay?: number };
  immediate?: ChoiceEffect;
  ongoing?: Omit<Modifier, 'id' | 'source' | 'remaining'> & { duration?: number };
  upside: string[];
  downside: string[];
}

export interface LogEntry {
  id: number;
  day: number;
  text: string;
  severity: 'info' | 'ok' | 'warn' | 'alert' | 'crit';
  ts: number;
}

export interface Packet {
  id: number;
  pathIdx: number;
  t: number;
  speed: number;
  kind: 'legit' | 'attack' | 'out' | 'exfil';
}

export interface MetaState {
  totalRuns: number;
  bestDay: number;
  totalXp: number;
  unlocked: string[];
  perks: string[];
  tutorialSeen?: boolean;
  lastSeenVersion?: number;
}

export interface GameState {
  phase: Phase;
  tick: number;
  day: number;
  budget: number;
  reputation: number;
  securityPosture: number;
  techDebt: number;
  servers: Server[];
  threats: Threat[];
  modifiers: Modifier[];
  history: { inbound: number[]; outbound: number[] };
  log: LogEntry[];
  logSeq: number;
  offeredChoices: string[];
  takenChoices: string[];
  pendingThreats: ThreatKind[];
  inbound: number;
  outbound: number;
  dropped: number;
  rngSeed: number;
  company: { name: string; glyph: string };
  packets: Packet[];
  packetSeq: number;
  allServersOfflineTicks: number;
  breachArmed: boolean;
  deathReason?: string;
  xpEarned: number;
  newlyUnlocked: string[];
  meta: MetaState;
  activePanel: 'servers' | 'network' | 'threats';
}

export type Listener<T> = (state: T, prev: T) => void;
