import type { ThreatKind } from '../types';

export interface ThreatDef {
  kind: ThreatKind;
  name: string;
  severity: 'low' | 'med' | 'high' | 'crit';
  baseRate: number;
  ttl: number;
  legit: boolean;
  inboundMul: number;
  description: string;
  counters: string[];
}

export const THREATS: Record<ThreatKind, ThreatDef> = {
  'ddos-volumetric': {
    kind: 'ddos-volumetric',
    name: 'Volumetric DDoS',
    severity: 'high',
    baseRate: 0.018,
    ttl: 60,
    legit: false,
    inboundMul: 3.2,
    description: 'Wall of packets from a botnet. Saturates the edge.',
    counters: ['harden-firewall', 'rate-limit', 'cdn'],
  },
  'ddos-l7': {
    kind: 'ddos-l7',
    name: 'L7 Application DDoS',
    severity: 'high',
    baseRate: 0.02,
    ttl: 55,
    legit: false,
    inboundMul: 1.8,
    description: 'Crafted requests that burn CPU on the app tier.',
    counters: ['deploy-waf', 'rate-limit'],
  },
  credstuff: {
    kind: 'credstuff',
    name: 'Credential Stuffing',
    severity: 'med',
    baseRate: 0.012,
    ttl: 50,
    legit: false,
    inboundMul: 1.3,
    description: 'Breached password lists replayed at the login endpoint.',
    counters: ['deploy-waf', 'rate-limit', 'zero-trust'],
  },
  sqli: {
    kind: 'sqli',
    name: 'SQL Injection Attempt',
    severity: 'high',
    baseRate: 0.03,
    ttl: 40,
    legit: false,
    inboundMul: 1.0,
    description: 'Probing for unsanitised query params. One hit could be catastrophic.',
    counters: ['deploy-waf', 'patch'],
  },
  exfil: {
    kind: 'exfil',
    name: 'Data Exfiltration',
    severity: 'crit',
    baseRate: 0.015,
    ttl: 70,
    legit: false,
    inboundMul: 1.0,
    description: 'Slow, steady outbound drain. Usually follows a breach.',
    counters: ['zero-trust', 'siem', 'deploy-waf'],
  },
  ransomware: {
    kind: 'ransomware',
    name: 'Ransomware Foothold',
    severity: 'crit',
    baseRate: 0.01,
    ttl: 90,
    legit: false,
    inboundMul: 1.0,
    description: 'A worker node is quietly encrypting shares.',
    counters: ['backup', 'patch', 'zero-trust'],
  },
  zeroday: {
    kind: 'zeroday',
    name: 'Zero-Day Disclosed',
    severity: 'high',
    baseRate: 0.025,
    ttl: 45,
    legit: false,
    inboundMul: 1.1,
    description: 'A CVE just dropped. Unpatched servers start bleeding posture.',
    counters: ['patch'],
  },
  'viral-surge': {
    kind: 'viral-surge',
    name: 'Viral Marketing Surge',
    severity: 'med',
    baseRate: -0.01,
    ttl: 50,
    legit: true,
    inboundMul: 2.5,
    description: 'Legit traffic! Great — unless your firewall drops it.',
    counters: ['loadtest-scale', 'cdn', 'cache'],
  },
  insider: {
    kind: 'insider',
    name: 'Insider Threat',
    severity: 'high',
    baseRate: 0.018,
    ttl: 60,
    legit: false,
    inboundMul: 1.0,
    description: 'Someone with a badge is copying a little too much data.',
    counters: ['zero-trust', 'siem'],
  },
  'cert-expiry': {
    kind: 'cert-expiry',
    name: 'Cert Expiry',
    severity: 'med',
    baseRate: 0.008,
    ttl: 40,
    legit: false,
    inboundMul: 0.5,
    description: 'Your TLS cert expires in hours. Half your users get warnings.',
    counters: ['patch', 'incident-drill'],
  },
  'disk-full': {
    kind: 'disk-full',
    name: 'Disk Full',
    severity: 'low',
    baseRate: 0.01,
    ttl: 35,
    legit: false,
    inboundMul: 1.0,
    description: 'Logs ate the partition. Writes are failing.',
    counters: ['siem', 'incident-drill', 'tech-debt'],
  },
  cascade: {
    kind: 'cascade',
    name: 'Cascading Failure',
    severity: 'crit',
    baseRate: 0.022,
    ttl: 50,
    legit: false,
    inboundMul: 1.4,
    description: 'One server’s failure is taking its neighbours down.',
    counters: ['loadtest-scale', 'tech-debt', 'hire-sre'],
  },
};

// Threats are scheduled by day ramp; higher days introduce the nastier ones.
export function threatsForDay(day: number): ThreatKind[] {
  if (day <= 1) return ['ddos-volumetric', 'disk-full', 'cert-expiry'];
  if (day <= 3) return ['ddos-volumetric', 'ddos-l7', 'credstuff', 'disk-full', 'viral-surge', 'cert-expiry'];
  if (day <= 6)
    return [
      'ddos-volumetric',
      'ddos-l7',
      'credstuff',
      'sqli',
      'viral-surge',
      'zeroday',
      'insider',
      'cascade',
    ];
  return [
    'ddos-volumetric',
    'ddos-l7',
    'credstuff',
    'sqli',
    'viral-surge',
    'zeroday',
    'insider',
    'cascade',
    'exfil',
    'ransomware',
  ];
}
