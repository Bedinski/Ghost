import type { GameState } from '../types';
import { mountTopStripWithAnchors, type TopStripHandle } from './topStrip';
import { mountStatusBanner } from './statusBanner';
import { mountServerRack, type ServerRackHandle } from './serverRack';
import { mountNetworkMap, type NetworkMapHandle } from './networkMap';
import { mountThreatBoard, type ThreatBoardHandle } from './threatBoard';
import { mountEventLog } from './eventLog';
import { mountSparkline } from './sparkline';
import { mountSpeedControl } from './speedControl';
import { mountMomentToast, type MomentToastHandle } from './momentToast';
import { mountCarousel, type Carousel } from './carousel';
import { isCompact, onBreakpointChange } from './mediaQuery';

export interface Monitor {
  render(state: GameState): void;
  showChoiceOverlay(el: HTMLElement): void;
  choiceOverlayHost(): HTMLElement;
  showThreatsPanel(): void;
  showSummary(el: HTMLElement): void;
  topStrip(): TopStripHandle;
  servers(): ServerRackHandle;
  network(): NetworkMapHandle;
  threatBoard(): ThreatBoardHandle;
  floatHost(): HTMLElement;
  momentToast(): MomentToastHandle;
  dispose(): void;
}

export function mountMonitor(host: HTMLElement): Monitor {
  host.innerHTML = `
    <div class="monitor">
      <div class="m-strip" data-region="strip"></div>
      <div class="m-status" data-region="status"></div>
      <div class="m-body">
        <div class="m-panels"></div>
        <div class="m-chart">
          <div class="chart-label"><span class="leg leg-in">inbound</span><span class="leg leg-out">outbound</span></div>
          <div class="chart-host"></div>
        </div>
        <div class="m-log" data-region="log"></div>
      </div>
      <div class="m-float-host"></div>
      <div class="m-toast-host"></div>
      <div class="m-choice-host"></div>
      <div class="m-summary-host"></div>
    </div>
  `;

  const strip = host.querySelector<HTMLElement>('[data-region="strip"]')!;
  const statusHost = host.querySelector<HTMLElement>('[data-region="status"]')!;
  const panelsHost = host.querySelector<HTMLElement>('.m-panels')!;
  const chartHost = host.querySelector<HTMLElement>('.chart-host')!;
  const logHost = host.querySelector<HTMLElement>('[data-region="log"]')!;
  const floatHost = host.querySelector<HTMLElement>('.m-float-host')!;
  const toastHost = host.querySelector<HTMLElement>('.m-toast-host')!;
  const choiceHost = host.querySelector<HTMLElement>('.m-choice-host')!;
  const summaryHost = host.querySelector<HTMLElement>('.m-summary-host')!;

  const topStripHandle = mountTopStripWithAnchors(strip);

  // Status banner row also hosts the speed control on the right.
  statusHost.classList.add('m-status-row');
  const statusInner = document.createElement('div');
  statusInner.className = 'm-status-inner';
  const speedHost = document.createElement('div');
  speedHost.className = 'm-speed-host';
  statusHost.appendChild(statusInner);
  statusHost.appendChild(speedHost);
  const renderStatus = mountStatusBanner(statusInner);
  mountSpeedControl(speedHost);

  const sparkline = mountSparkline(chartHost);
  const renderLog = mountEventLog(logHost);

  // Build the three panels once
  const rackPanel = document.createElement('section');
  rackPanel.className = 'panel panel-rack';
  const netPanel = document.createElement('section');
  netPanel.className = 'panel panel-net';
  const threatPanel = document.createElement('section');
  threatPanel.className = 'panel panel-threats';

  const rackHandle = mountServerRack(rackPanel);
  const netHandle = mountNetworkMap(netPanel);
  const threatHandle = mountThreatBoard(threatPanel);

  const toast = mountMomentToast(toastHost);

  let carousel: Carousel | null = null;
  let currentLayout: 'grid' | 'carousel' = 'grid';

  function applyLayout() {
    panelsHost.innerHTML = '';
    if (isCompact()) {
      panelsHost.classList.add('panels--carousel');
      panelsHost.classList.remove('panels--grid');
      carousel = mountCarousel(panelsHost, [rackPanel, netPanel, threatPanel], ['servers', 'network', 'threats']);
      // default view: network map
      carousel.setActive(1, false);
      currentLayout = 'carousel';
    } else {
      panelsHost.classList.add('panels--grid');
      panelsHost.classList.remove('panels--carousel');
      panelsHost.appendChild(rackPanel);
      panelsHost.appendChild(netPanel);
      panelsHost.appendChild(threatPanel);
      carousel = null;
      currentLayout = 'grid';
    }
  }
  applyLayout();
  const offBp = onBreakpointChange(() => applyLayout());

  return {
    render(state) {
      topStripHandle.render(state);
      renderStatus(state);
      rackHandle.render(state);
      netHandle.render(state);
      threatHandle.render(state);
      renderLog(state);
      const cap = state.servers.reduce(
        (a, sv) => a + (sv.status === 'offline' ? 0 : sv.capacity * (sv.status === 'degraded' ? 0.55 : 1)),
        0,
      );
      sparkline.render(state.history.inbound, state.history.outbound, cap);
    },
    showChoiceOverlay(el) {
      choiceHost.innerHTML = '';
      choiceHost.appendChild(el);
    },
    choiceOverlayHost() {
      return choiceHost;
    },
    showThreatsPanel() {
      if (currentLayout === 'carousel' && carousel) carousel.setActive(2, true);
    },
    showSummary(el) {
      summaryHost.innerHTML = '';
      summaryHost.appendChild(el);
    },
    topStrip: () => topStripHandle,
    servers: () => rackHandle,
    network: () => netHandle,
    threatBoard: () => threatHandle,
    floatHost: () => floatHost,
    momentToast: () => toast,
    dispose() {
      offBp();
      sparkline.dispose();
      toast.dispose();
    },
  };
}
