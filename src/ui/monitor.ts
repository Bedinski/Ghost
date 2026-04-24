import type { GameState } from '../types';
import { mountTopStrip } from './topStrip';
import { mountServerRack } from './serverRack';
import { mountNetworkMap } from './networkMap';
import { mountThreatBoard } from './threatBoard';
import { mountEventLog } from './eventLog';
import { mountSparkline } from './sparkline';
import { mountCarousel, type Carousel } from './carousel';
import { isCompact, onBreakpointChange } from './mediaQuery';

export interface Monitor {
  render(state: GameState): void;
  showChoiceOverlay(el: HTMLElement): void;
  choiceOverlayHost(): HTMLElement;
  showThreatsPanel(): void;
  showSummary(el: HTMLElement): void;
  dispose(): void;
}

export function mountMonitor(host: HTMLElement): Monitor {
  host.innerHTML = `
    <div class="monitor">
      <div class="m-strip" data-region="strip"></div>
      <div class="m-body">
        <div class="m-panels"></div>
        <div class="m-chart">
          <div class="chart-label"><span class="leg leg-in">inbound</span><span class="leg leg-out">outbound</span></div>
          <div class="chart-host"></div>
        </div>
        <div class="m-log" data-region="log"></div>
      </div>
      <div class="m-choice-host"></div>
      <div class="m-summary-host"></div>
    </div>
  `;

  const strip = host.querySelector<HTMLElement>('[data-region="strip"]')!;
  const panelsHost = host.querySelector<HTMLElement>('.m-panels')!;
  const chartHost = host.querySelector<HTMLElement>('.chart-host')!;
  const logHost = host.querySelector<HTMLElement>('[data-region="log"]')!;
  const choiceHost = host.querySelector<HTMLElement>('.m-choice-host')!;
  const summaryHost = host.querySelector<HTMLElement>('.m-summary-host')!;

  const renderStrip = mountTopStrip(strip);
  const sparkline = mountSparkline(chartHost);
  const renderLog = mountEventLog(logHost);

  // Build the three panels once
  const rackPanel = document.createElement('section');
  rackPanel.className = 'panel panel-rack';
  const netPanel = document.createElement('section');
  netPanel.className = 'panel panel-net';
  const threatPanel = document.createElement('section');
  threatPanel.className = 'panel panel-threats';

  const renderRack = mountServerRack(rackPanel);
  const renderNet = mountNetworkMap(netPanel);
  const renderThreats = mountThreatBoard(threatPanel);

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
      renderStrip(state);
      renderRack(state);
      renderNet(state);
      renderThreats(state);
      renderLog(state);
      sparkline.render(state.history.inbound, state.history.outbound);
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
    dispose() {
      offBp();
      sparkline.dispose();
    },
  };
}
