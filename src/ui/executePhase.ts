import type { Choice, ChoiceEffect, ExecuteHint, GameState } from '../types';
import { CHOICES_BY_ID } from '../game/choices';
import { floatDelta } from './floatDelta';
import { prefersReducedMotion } from './mediaQuery';
import type { ServerRackHandle } from './serverRack';
import type { NetworkMapHandle } from './networkMap';
import type { TopStripHandle } from './topStrip';

// EXECUTE phase: between the choice resolving and the WATCH phase running,
// visualise what the just-taken choice does. ~1.5s of animation:
//   - card flies into the relevant panel (the panel pulses)
//   - immediate stat deltas float up from the matching top-strip stat
//   - persistent badges sync into the panel header (handled by the panels)
export interface ExecutePhaseHandle {
  play(choiceId: string, before: GameState): Promise<void>;
}

export interface ExecuteHosts {
  floatHost: HTMLElement;
  servers: ServerRackHandle;
  network: NetworkMapHandle;
  topstrip: TopStripHandle;
}

export function mountExecutePhase(_host: HTMLElement, hosts: ExecuteHosts): ExecutePhaseHandle {
  return {
    play(choiceId, before) {
      const c = CHOICES_BY_ID.get(choiceId);
      if (!c) return Promise.resolve();
      const reduced = prefersReducedMotion();

      // 1) Pulse the relevant panel(s).
      const hint = c.executeHint;
      if (hint) {
        switch (hint.panel) {
          case 'servers':
            hosts.servers.pulse(hint);
            break;
          case 'network':
            hosts.network.pulse(hint);
            break;
          case 'log':
            // log doesn't have its own pulse; just badge it via topstrip
            // and let the simulation log do the talking.
            break;
          case 'topstrip':
          case 'all':
            // emit a ripple on every panel
            hosts.servers.pulse(hint);
            hosts.network.pulse(hint);
            break;
        }
      }

      // 2) Floating immediate deltas (cost, security, reputation, debt).
      const deltas = collectDeltas(c, before);
      const promises: Promise<void>[] = [];
      for (const d of deltas) {
        const anchor = hosts.topstrip.anchorFor(d.key);
        promises.push(floatDelta(hosts.floatHost, anchor, d.text, d.tone));
      }

      const minHold = reduced ? 350 : 1100;
      promises.push(new Promise<void>((r) => setTimeout(r, minHold)));
      return Promise.all(promises).then(() => undefined);
    },
  };
}

function collectDeltas(
  c: Choice,
  before: GameState,
): { key: 'budget' | 'security' | 'reputation' | 'techDebt'; text: string; tone: 'good' | 'bad' | 'neutral' }[] {
  const out: { key: 'budget' | 'security' | 'reputation' | 'techDebt'; text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
  if (c.cost > 0) out.push({ key: 'budget', text: `−$${c.cost}`, tone: 'bad' });
  const imm: ChoiceEffect = c.immediate ?? {};
  if (imm.budget) out.push({ key: 'budget', text: signNum(imm.budget, '$'), tone: imm.budget >= 0 ? 'good' : 'bad' });
  if (imm.securityPosture) out.push({ key: 'security', text: signNum(imm.securityPosture), tone: imm.securityPosture >= 0 ? 'good' : 'bad' });
  if (imm.reputation) out.push({ key: 'reputation', text: signNum(imm.reputation), tone: imm.reputation >= 0 ? 'good' : 'bad' });
  if (imm.techDebt) out.push({ key: 'techDebt', text: signNum(imm.techDebt), tone: imm.techDebt < 0 ? 'good' : 'bad' });
  return out;
  // before is unused for now but kept on the signature so we can show
  // contextual deltas later (e.g., "+1 server (now 6)") without a refactor.
  void before;
}

function signNum(n: number, prefix = ''): string {
  if (n > 0) return `+${prefix}${n}`;
  return `−${prefix}${Math.abs(n)}`;
}

// Helper exported for tests / future use.
export function panelOfHint(hint: ExecuteHint | undefined): string {
  return hint?.panel ?? 'all';
}
