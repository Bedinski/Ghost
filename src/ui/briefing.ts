import { icon } from './icons';

interface Slide {
  title: string;
  body: string;
  hint?: string;
}

const SLIDES: Slide[] = [
  {
    title: 'on-call // 03:14',
    body: `It's the middle of the night. The on-call rotation just landed on you.

You're the only engineer awake at the company. Pager's quiet — for now.
Your job is simple: keep the network alive.`,
    hint: 'press ▶ or SPACE to continue',
  },
  {
    title: 'one ship per day',
    body: `Each day, your team has bandwidth for ONE improvement. You'll be offered three options. Pick the one you think is right.

Every choice has a real trade-off. A tighter firewall blocks attackers AND legit users. More servers cost upkeep. Caching hides real load from your loadtests.

Read the orange line before you commit.`,
    hint: 'every choice has a downside',
  },
  {
    title: 'read the monitor',
    body: `The screen is your situational awareness:

• SERVERS — load, health, and patch status of each node
• NETWORK — packet flow; attacks travel in red, exfil in amber
• THREATS — active incidents and which choices counter them
• EVENT LOG — live stream of everything happening

Watch traffic spikes. Watch which threats are landing. Adapt.`,
    hint: 'on phones the panels swipe',
  },
  {
    title: "you'll lose. that's fine.",
    body: `You lose if reputation hits zero, the fleet goes fully dark, or attackers breach a critical system.

Each run earns XP. XP unlocks new choices and starting perks across runs. Some strategies only become possible after a few attempts.

Survive as long as you can. Learn the rhythm.`,
    hint: 'press ▶ to start your shift',
  },
];

export interface BriefingHandle {
  open(): Promise<void>;
}

export function mountBriefing(host: HTMLElement): BriefingHandle {
  const el = document.createElement('div');
  el.className = 'briefing';
  el.innerHTML = `
    <div class="brf-frame">
      <header class="brf-head">
        <span class="brf-stamp">${icon('radar', 'brf-stamp-ico')}<span>incoming // priority</span></span>
        <button type="button" class="brf-skip">skip ✕</button>
      </header>
      <div class="brf-stage"></div>
      <footer class="brf-foot">
        <div class="brf-dots"></div>
        <div class="brf-nav">
          <button type="button" class="brf-back" disabled>◀ back</button>
          <button type="button" class="brf-next">continue ▶</button>
        </div>
      </footer>
    </div>
  `;
  host.appendChild(el);
  const stage = el.querySelector<HTMLElement>('.brf-stage')!;
  const dotsEl = el.querySelector<HTMLElement>('.brf-dots')!;
  const back = el.querySelector<HTMLButtonElement>('.brf-back')!;
  const next = el.querySelector<HTMLButtonElement>('.brf-next')!;
  const skip = el.querySelector<HTMLButtonElement>('.brf-skip')!;

  // build dots
  SLIDES.forEach((_, i) => {
    const d = document.createElement('span');
    d.className = 'brf-dot';
    d.dataset.i = String(i);
    dotsEl.appendChild(d);
  });

  let idx = 0;
  let resolveFn: (() => void) | null = null;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function renderSlide() {
    const s = SLIDES[idx];
    const isLast = idx === SLIDES.length - 1;
    stage.innerHTML = `
      <div class="brf-slide">
        <h2 class="brf-title">${s.title}</h2>
        <p class="brf-body">${s.body.replace(/\n/g, '<br>')}</p>
        ${s.hint ? `<p class="brf-hint">${s.hint}</p>` : ''}
      </div>
    `;
    dotsEl.querySelectorAll<HTMLElement>('.brf-dot').forEach((d, i) => {
      d.classList.toggle('is-active', i === idx);
      d.classList.toggle('is-past', i < idx);
    });
    back.disabled = idx === 0;
    next.textContent = isLast ? 'begin shift ▶' : 'continue ▶';
  }

  function done() {
    el.classList.remove('is-open');
    if (keyHandler) {
      window.removeEventListener('keydown', keyHandler);
      keyHandler = null;
    }
    setTimeout(() => {
      resolveFn?.();
      resolveFn = null;
    }, 380);
  }

  next.addEventListener('click', () => {
    if (idx < SLIDES.length - 1) {
      idx++;
      renderSlide();
    } else {
      done();
    }
  });
  back.addEventListener('click', () => {
    if (idx > 0) {
      idx--;
      renderSlide();
    }
  });
  skip.addEventListener('click', done);

  return {
    open() {
      return new Promise<void>((resolve) => {
        resolveFn = resolve;
        idx = 0;
        renderSlide();
        el.classList.add('is-open');
        keyHandler = (e: KeyboardEvent) => {
          if (e.key === 'Escape') { e.preventDefault(); done(); return; }
          if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
            e.preventDefault();
            next.click();
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            back.click();
          }
        };
        window.addEventListener('keydown', keyHandler);
        // focus the next button so SPACE works without a click first
        setTimeout(() => next.focus(), 80);
      });
    },
  };
}
