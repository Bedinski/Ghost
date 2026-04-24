import vertSrc from '../shaders/bg.vert?raw';
import fragSrc from '../shaders/bg.frag?raw';
import { isLowEnd, prefersReducedMotion } from '../ui/mediaQuery';

export interface BackgroundController {
  setIntensity(v: number): void;
  setParallax(x: number, y: number): void;
  dispose(): void;
}

export function mountBackground(host: HTMLElement): BackgroundController {
  const reduced = prefersReducedMotion();
  const lowEnd = isLowEnd();

  if (lowEnd || reduced) {
    const fallback = document.createElement('div');
    fallback.className = 'bg-fallback';
    host.appendChild(fallback);
    return {
      setIntensity: (v) => {
        fallback.style.opacity = String(0.6 + v * 0.4);
      },
      setParallax: () => {},
      dispose: () => fallback.remove(),
    };
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'bg-canvas';
  host.appendChild(canvas);
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });

  if (!gl) {
    const fallback = document.createElement('div');
    fallback.className = 'bg-fallback';
    canvas.replaceWith(fallback);
    return {
      setIntensity: () => {},
      setParallax: () => {},
      dispose: () => fallback.remove(),
    };
  }

  const prog = buildProgram(gl, vertSrc, fragSrc);
  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uPar = gl.getUniformLocation(prog, 'u_parallax');
  const uInt = gl.getUniformLocation(prog, 'u_intensity');

  let intensity = 1;
  const parallax = { x: 0, y: 0 };
  const targetParallax = { x: 0, y: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = host.clientWidth;
    const h = host.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const start = performance.now();
  let last = 0;
  let running = true;
  let hidden = false;
  const onVis = () => {
    hidden = document.visibilityState === 'hidden';
  };
  document.addEventListener('visibilitychange', onVis);

  function frame(now: number) {
    if (!running) return;
    // cap ~30fps
    if (!hidden && now - last > 33) {
      last = now;
      parallax.x += (targetParallax.x - parallax.x) * 0.05;
      parallax.y += (targetParallax.y - parallax.y) * 0.05;
      gl!.useProgram(prog);
      gl!.uniform1f(uTime, (now - start) / 1000);
      gl!.uniform2f(uRes, canvas.width, canvas.height);
      gl!.uniform2f(uPar, parallax.x, parallax.y);
      gl!.uniform1f(uInt, intensity);
      gl!.drawArrays(gl!.TRIANGLES, 0, 6);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    setIntensity(v) {
      intensity = v;
    },
    setParallax(x, y) {
      targetParallax.x = x;
      targetParallax.y = y;
    },
    dispose() {
      running = false;
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.remove();
    },
  };
}

function buildProgram(gl: WebGLRenderingContext, v: string, f: string): WebGLProgram {
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
    }
    return sh;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl.VERTEX_SHADER, v));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, f));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
  }
  return p;
}
