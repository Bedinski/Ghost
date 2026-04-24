precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_parallax;
uniform float u_intensity;

// hash & noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++){
    v += a * noise(p);
    p *= 2.02;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = v_uv;
  vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0);
  p += u_parallax * 0.08;

  // deep space gradient
  float r = length(p);
  vec3 bg = mix(vec3(0.01, 0.015, 0.035), vec3(0.02, 0.01, 0.06), r);

  // drifting nebula-ish fbm field in magenta/cyan
  float t = u_time * 0.03;
  float n1 = fbm(p * 2.2 + vec2(t, -t * 0.6));
  float n2 = fbm(p * 3.0 - vec2(t * 0.8, t));
  vec3 cyan = vec3(0.12, 0.75, 0.95);
  vec3 magenta = vec3(0.85, 0.18, 0.75);
  vec3 neb = mix(cyan, magenta, n2);
  bg += neb * pow(n1, 2.5) * 0.55;

  // scan grid (large)
  vec2 g = uv * vec2(u_res.x / 48.0, u_res.y / 48.0);
  vec2 gf = fract(g) - 0.5;
  float grid = smoothstep(0.48, 0.5, max(abs(gf.x), abs(gf.y)));
  bg += vec3(0.08, 0.25, 0.35) * grid * 0.18;

  // falling data streaks
  float col = floor(uv.x * 80.0);
  float streak = fract(uv.y + hash(vec2(col, 0.0)) * 10.0 - u_time * (0.1 + hash(vec2(col,1.0)) * 0.3));
  float s = smoothstep(0.0, 0.02, streak) * (1.0 - smoothstep(0.02, 0.25, streak));
  bg += vec3(0.08, 0.95, 0.8) * s * 0.25;

  // vignette
  float vig = smoothstep(1.25, 0.25, r);
  bg *= vig;

  bg *= u_intensity;

  gl_FragColor = vec4(bg, 1.0);
}
