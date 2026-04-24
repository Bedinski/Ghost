export interface Carousel {
  setActive(index: number, animate?: boolean): void;
  getActive(): number;
  dispose(): void;
}

export function mountCarousel(host: HTMLElement, panels: HTMLElement[], labels: string[]): Carousel {
  const track = document.createElement('div');
  track.className = 'car-track';
  const dots = document.createElement('div');
  dots.className = 'car-dots';
  host.appendChild(track);
  host.appendChild(dots);

  panels.forEach((p, i) => {
    p.classList.add('car-slide');
    track.appendChild(p);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'car-dot';
    dot.setAttribute('aria-label', labels[i]);
    dot.addEventListener('click', () => set(i, true));
    dots.appendChild(dot);
  });

  let active = 0;

  // touch swipe
  let startX = 0;
  let dx = 0;
  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    startX = e.clientX;
    dx = 0;
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    track.style.transform = `translateX(calc(${-active * 100}% + ${dx}px))`;
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > 60) {
      const dir = dx < 0 ? 1 : -1;
      set(Math.max(0, Math.min(panels.length - 1, active + dir)), true);
    } else {
      set(active, true);
    }
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('pointerleave', endDrag);

  function set(i: number, animate: boolean) {
    active = i;
    track.style.transition = animate ? 'transform 320ms cubic-bezier(.3,.8,.25,1)' : 'none';
    track.style.transform = `translateX(${-active * 100}%)`;
    dots.querySelectorAll('.car-dot').forEach((el, idx) => {
      el.classList.toggle('is-active', idx === active);
    });
  }
  set(0, false);

  return {
    setActive: set,
    getActive: () => active,
    dispose() {
      host.innerHTML = '';
    },
  };
}
