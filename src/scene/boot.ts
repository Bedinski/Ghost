import { prefersReducedMotion } from '../ui/mediaQuery';

export function runBootSequence(screen: HTMLElement, company: string): Promise<void> {
  const reduced = prefersReducedMotion();
  const boot = document.createElement('div');
  boot.className = 'boot';
  boot.innerHTML = `
    <div class="boot-bloom"></div>
    <pre class="boot-text"></pre>
  `;
  screen.appendChild(boot);

  const lines = [
    '[ghostOS v1.4.8-alpha — cold boot]',
    `> probing ${company} perimeter ...`,
    '  routing: edge → lb → app[2] → data',
    '  telemetry: OK    siem: offline    waf: offline',
    '  fleet: 5 nodes online · patch level: mixed',
    '> mounting live monitor',
    '> engineer_detected()',
    '  >> welcome back.',
  ];

  const pre = boot.querySelector<HTMLElement>('.boot-text')!;
  if (reduced) {
    pre.textContent = lines.join('\n');
    return new Promise((r) => setTimeout(() => {
      boot.classList.add('boot--out');
      setTimeout(() => { boot.remove(); r(); }, 300);
    }, 600));
  }

  return new Promise<void>((resolve) => {
    let i = 0;
    let j = 0;
    let out = '';
    function step() {
      if (i >= lines.length) {
        setTimeout(() => {
          boot.classList.add('boot--out');
          setTimeout(() => {
            boot.remove();
            resolve();
          }, 450);
        }, 400);
        return;
      }
      const line = lines[i];
      if (j < line.length) {
        out += line[j++];
        pre.textContent = out;
        setTimeout(step, 12 + Math.random() * 18);
      } else {
        out += '\n';
        i++;
        j = 0;
        setTimeout(step, 120);
      }
    }
    setTimeout(step, 250);
  });
}
