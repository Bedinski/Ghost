export function mountBezel(host: HTMLElement, screen: HTMLElement): void {
  const frame = document.createElement('div');
  frame.className = 'bezel-frame';
  frame.innerHTML = `
    <div class="bezel-outer">
      <div class="bezel-edge bezel-edge--top"></div>
      <div class="bezel-edge bezel-edge--bottom">
        <span class="bezel-brand">GH<em>O</em>ST</span>
        <span class="bezel-led" aria-hidden="true"></span>
      </div>
      <div class="bezel-inner">
        <div class="bezel-glass"></div>
        <div class="bezel-screen"></div>
        <div class="bezel-reflection"></div>
        <div class="bezel-scanlines"></div>
      </div>
    </div>
  `;
  const screenHost = frame.querySelector('.bezel-screen')!;
  screenHost.appendChild(screen);
  host.appendChild(frame);
}
