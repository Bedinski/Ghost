const ICONS: Record<string, string> = {
  scale:
    '<path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  radar:
    '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M12 12 L20 7" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  shield:
    '<path d="M12 3 4 6v6c0 4.5 3.3 7.5 8 9 4.7-1.5 8-4.5 8-9V6z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>',
  gauge:
    '<path d="M4 16a8 8 0 0116 0" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M12 16l4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="16" r="1.3" fill="currentColor"/>',
  chip:
    '<rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="9" y="9" width="6" height="6" stroke="currentColor" stroke-width="1.2" fill="none"/><path d="M4 9h2M4 12h2M4 15h2M18 9h2M18 12h2M18 15h2M9 4v2M12 4v2M15 4v2M9 18v2M12 18v2M15 18v2" stroke="currentColor" stroke-width="1.2"/>',
  user:
    '<circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  wrench:
    '<path d="M14 4a5 5 0 00-4 8l-6 6 2 2 6-6a5 5 0 008-4 5 5 0 00-1-2l-2 2-2-2 2-2a5 5 0 00-3-2z" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>',
  cloud:
    '<path d="M7 16a4 4 0 010-8 5 5 0 019-2 4 4 0 012 8z" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  scroll:
    '<path d="M6 4h10v14H8a2 2 0 01-2-2z" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M9 8h6M9 11h6M9 14h4" stroke="currentColor" stroke-width="1.2"/>',
  flame:
    '<path d="M12 3c2 4-3 5-3 9a4 4 0 008 0c0-2-1-3-2-5 0 2-1 3-2 3 1-3-1-5-1-7z" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  bug:
    '<path d="M9 8h6M8 12h8M9 16h6M6 10l-2-1M6 14l-2 1M18 10l2-1M18 14l2 1" stroke="currentColor" stroke-width="1.4"/><rect x="8" y="7" width="8" height="12" rx="4" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  archive:
    '<rect x="4" y="5" width="16" height="4" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="5" y="9" width="14" height="10" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M10 13h4" stroke="currentColor" stroke-width="1.4"/>',
  database:
    '<ellipse cx="12" cy="6" rx="7" ry="2.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M5 6v12c0 1.5 3 2.5 7 2.5s7-1 7-2.5V6" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M5 12c0 1.5 3 2.5 7 2.5s7-1 7-2.5" stroke="currentColor" stroke-width="1.4" fill="none"/>',
  globe:
    '<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M4 12h16M12 4c3 3 3 13 0 16M12 4c-3 3-3 13 0 16" stroke="currentColor" stroke-width="1.2" fill="none"/>',
  lock:
    '<rect x="6" y="11" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4" fill="none"/><path d="M9 11V8a3 3 0 016 0v3" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="12" cy="15.5" r="1" fill="currentColor"/>',
  server:
    '<rect x="4" y="5" width="16" height="5" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><rect x="4" y="14" width="16" height="5" rx="1" stroke="currentColor" stroke-width="1.4" fill="none"/><circle cx="7" cy="7.5" r="0.8" fill="currentColor"/><circle cx="7" cy="16.5" r="0.8" fill="currentColor"/>',
  edge: '<path d="M4 12 L20 12" stroke="currentColor" stroke-width="1.4"/><circle cx="4" cy="12" r="2" fill="currentColor"/><circle cx="20" cy="12" r="2" stroke="currentColor" stroke-width="1.4" fill="none"/>',
};

export function icon(name: string, extraClass = ''): string {
  const body = ICONS[name] ?? ICONS.chip;
  return `<svg class="ico ${extraClass}" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">${body}</svg>`;
}
