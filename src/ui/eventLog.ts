import type { GameState, LogEntry } from '../types';

export function mountEventLog(host: HTMLElement): (s: GameState) => void {
  host.innerHTML = `
    <header class="panel-head">
      <h3>event log</h3>
      <span class="panel-sub">live stream</span>
    </header>
    <ol class="log-list" aria-live="polite"></ol>
  `;
  const list = host.querySelector<HTMLElement>('.log-list')!;
  let lastId = 0;

  return (s: GameState) => {
    const fresh = s.log.filter((e) => e.id > lastId);
    for (const e of fresh) {
      appendLine(list, e);
    }
    if (fresh.length) lastId = s.log[s.log.length - 1].id;
    while (list.children.length > 40) list.removeChild(list.firstElementChild!);
  };
}

function appendLine(list: HTMLElement, e: LogEntry) {
  const li = document.createElement('li');
  li.className = `log-line log-${e.severity}`;
  const time = `d${String(e.day).padStart(2, '0')}`;
  li.innerHTML = `<span class="log-time">${time}</span><span class="log-text"></span>`;
  const text = li.querySelector<HTMLElement>('.log-text')!;
  list.appendChild(li);
  list.scrollTop = list.scrollHeight;
  // typewriter for high-severity entries
  if (e.severity === 'alert' || e.severity === 'crit' || e.severity === 'ok') {
    typeText(text, e.text);
  } else {
    text.textContent = e.text;
  }
}

function typeText(el: HTMLElement, text: string) {
  el.textContent = '';
  let i = 0;
  const step = () => {
    if (i < text.length) {
      el.textContent = text.slice(0, ++i);
      setTimeout(step, 8);
    }
  };
  step();
}
