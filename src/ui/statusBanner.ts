import type { GameState } from '../types';
import { THREATS } from '../game/events';
import { CHOICES_BY_ID } from '../game/choices';

type Tier = 'stable' | 'alert' | 'critical';

interface Headline {
  tier: Tier;
  label: string;
  message: string;
  pointer?: 'servers' | 'network' | 'threats';
}

export function mountStatusBanner(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <div class="status-banner status-banner--stable" role="status" aria-live="polite">
      <span class="sb-pulse"></span>
      <span class="sb-tier">STABLE</span>
      <span class="sb-msg">monitoring · no incidents</span>
      <span class="sb-pointer"></span>
    </div>
  `;
  const banner = host.querySelector<HTMLElement>('.status-banner')!;
  const tierEl = banner.querySelector<HTMLElement>('.sb-tier')!;
  const msgEl = banner.querySelector<HTMLElement>('.sb-msg')!;
  const pointerEl = banner.querySelector<HTMLElement>('.sb-pointer')!;

  let lastKey = '';

  return (state: GameState) => {
    const h = computeHeadline(state);
    const key = `${h.tier}|${h.label}|${h.message}|${h.pointer ?? ''}`;
    if (key === lastKey) return;
    lastKey = key;

    banner.classList.remove('status-banner--stable', 'status-banner--alert', 'status-banner--critical');
    banner.classList.add(`status-banner--${h.tier}`);
    tierEl.textContent = h.label;
    msgEl.textContent = h.message;
    pointerEl.textContent = h.pointer ? `▶ ${h.pointer}` : '';
    banner.classList.remove('status-banner--pulse');
    void banner.offsetWidth;
    banner.classList.add('status-banner--pulse');
  };
}

function computeHeadline(s: GameState): Headline {
  // Server / outage problems
  const offline = s.servers.filter((sv) => sv.status === 'offline').length;
  const degraded = s.servers.filter((sv) => sv.status === 'degraded').length;

  if (offline >= 2) {
    return {
      tier: 'critical',
      label: 'CRITICAL',
      message: `${offline} servers offline — fleet near collapse`,
      pointer: 'servers',
    };
  }

  // Threats
  const nonLegit = s.threats.filter((t) => !t.legit);
  const crit = nonLegit.find((t) => t.severity === 'crit');
  const high = nonLegit.find((t) => t.severity === 'high');
  const lead = crit ?? high ?? nonLegit[0];

  if (lead) {
    const def = THREATS[lead.kind];
    const youHave = def.counters.find((c) => s.takenChoices.includes(c));
    const action = youHave
      ? `holding with ${labelFor(youHave)}`
      : `counter: ${def.counters.slice(0, 2).map(labelFor).join(' / ')}`;
    return {
      tier: nonLegit.length > 1 || lead.severity === 'crit' ? 'critical' : 'alert',
      label: nonLegit.length > 1 ? `${nonLegit.length} INCIDENTS` : 'ALERT',
      message: `${def.name} · ${action}`,
      pointer: 'threats',
    };
  }

  const legitSurge = s.threats.find((t) => t.legit);
  if (legitSurge) {
    return {
      tier: 'alert',
      label: 'TRAFFIC SURGE',
      message: 'legit users — keep firewall light, watch capacity',
      pointer: 'network',
    };
  }

  if (offline === 1) {
    return {
      tier: 'alert',
      label: 'DEGRADED',
      message: '1 server offline — load may pile up',
      pointer: 'servers',
    };
  }

  if (degraded >= 2) {
    return {
      tier: 'alert',
      label: 'STRESSED',
      message: `${degraded} servers degraded — capacity tight`,
      pointer: 'servers',
    };
  }

  // Money / posture warnings during the calm
  if (s.budget < 60 && s.phase !== 'sim') {
    return {
      tier: 'alert',
      label: 'BROKE',
      message: 'next round will offer Catch Your Breath as a free option',
    };
  }

  if (s.reputation < 25) {
    return {
      tier: 'alert',
      label: 'TRUST LOW',
      message: 'reputation falling — daily revenue is shrinking',
    };
  }

  if (s.securityPosture < 25 && s.day > 2) {
    return {
      tier: 'alert',
      label: 'EXPOSED',
      message: 'security posture critical — a breach now ends the run',
    };
  }

  // All clear
  return {
    tier: 'stable',
    label: 'STABLE',
    message: s.day === 0 ? 'awaiting first call' : 'monitoring · no incidents',
  };
}

function labelFor(id: string): string {
  return CHOICES_BY_ID.get(id)?.name ?? id;
}
