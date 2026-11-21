// =====================================================================
//  RENDERER CORE — WebGL2 context, toon shaders, outline composite, camera, lights
// =====================================================================
let canvas = null, ctx = null;              // HUD overlay canvas (2D, device px)
let glc = null, gl = null, GLOK = false;    // WebGL2 canvas + context
let VW = 800, VH = 600, DPR = 1, GDPR = 1, PORTRAIT = false;
const MOBILE = (typeof navigator !== 'undefined') && ((navigator.maxTouchPoints || 0) > 0) && (typeof window !== 'undefined') && Math.min(window.innerWidth || 800, window.innerHeight || 600) < 820;
let RW = 1, RH = 1, SW = 1, SH = 1, BW2 = 1, BH2 = 1;
const CAM = { a: -Math.PI / 2, c: 0, s: -1, x: 0, y: 0, eye: [0, 0, 0], fwd: [0, 0, -1], vp: new Float32Array(16), view: new Float32Array(16), proj: new Float32Array(16), ivp: new Float32Array(16), fovY: 1, gh: 0 };
// fixed-angle 3/4 camera (does not turn with the player); yaw can be nudged with Z / X
const CAMK = { yaw: -Math.PI / 2, yawT: -Math.PI / 2, pitch: 50 * Math.PI / 180, dist: 21, zoom: 1, fx: 0, fy: 0, init: false };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
const now = () => performance.now();

// ---------- small matrix kit (column-major) ----------
function m4() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; }
function m4mul(o, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
function m4persp(o, fy, asp, n, f) {
  const t = 1 / Math.tan(fy / 2); o.fill(0);
  o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
}
function m4look(o, e, t, up) {
  let fx = t[0] - e[0], fy = t[1] - e[1], fz = t[2] - e[2]; let l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = fy * up[2] - fz * up[1], sy = fz * up[0] - fx * up[2], sz = fx * up[1] - fy * up[0]; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
  o[0] = sx; o[4] = sy; o[8] = sz; o[1] = ux; o[5] = uy; o[9] = uz; o[2] = -fx; o[6] = -fy; o[10] = -fz;
  o[3] = o[7] = o[11] = 0; o[12] = -(sx * e[0] + sy * e[1] + sz * e[2]); o[13] = -(ux * e[0] + uy * e[1] + uz * e[2]); o[14] = fx * e[0] + fy * e[1] + fz * e[2]; o[15] = 1;
  return o;
}
function m4inv(o, m) {
  const a = m, b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5],
    b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12],
    b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
  let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return o; d = 1 / d;
  o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
  o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
  o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
  o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
  return o;
}
// rigid transform helpers: o = T(x,y,z) * Ry(yaw) * Rx(pitch) * Rz(roll) * S(s)
function m4trs(o, x, y, z, yaw, pitch, roll, s) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  s = s || 1;
  const r00 = cy * cr + sy * sp * sr, r01 = -cy * sr + sy * sp * cr, r02 = sy * cp;
  const r10 = cp * sr, r11 = cp * cr, r12 = -sp;
  const r20 = -sy * cr + cy * sp * sr, r21 = sy * sr + cy * sp * cr, r22 = cy * cp;
  o[0] = r00 * s; o[1] = r10 * s; o[2] = r20 * s; o[3] = 0;
  o[4] = r01 * s; o[5] = r11 * s; o[6] = r21 * s; o[7] = 0;
  o[8] = r02 * s; o[9] = r12 * s; o[10] = r22 * s; o[11] = 0;
  o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
  return o;
}
// world yaw for a game heading a: model +Z faces (cos a, sin a)
const yawOf = a => Math.PI / 2 - a;

// ---------- shaders ----------
const GLSL_LIGHT = `
uniform vec3 uCamPos, uSunDir, uSunCol, uSkyAmb, uGndAmb, uFogCol, uShadowTint;
uniform float uFogD, uFogH, uFogMul, uTime, uRim;
uniform vec4 uLP[8], uLC[8];
uniform int uNL;
float gDim = 1.0, gFill = 0.0; // per-fragment: indoor dimming of sun / moon, soft sky fill on shaded walls (architecture)
// soft, naturalistic lighting: wrapped diffuse with a gradual terminator, hemisphere ambient,
// faint specular, smooth point-light falloff and a subtle rim (name kept from the old cel shader)
vec3 toon(vec3 p, vec3 n, vec3 base, vec3 V) {
  float ndl = dot(n, uSunDir);
  float lit = clamp(ndl * 0.8 + 0.2, 0.0, 1.0);
  lit = lit * lit * (3.0 - 2.0 * lit) * 0.4 + lit * 0.6;
  vec3 amb = mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5);
  vec3 c = base * (amb * 0.85 + 0.05) * mix(mix(uShadowTint, vec3(1.0), 0.45), vec3(1.0), lit) + base * uSunCol * 0.82 * lit;
  c += base * (uSkyAmb + 0.08) * gFill * (1.0 - lit) * (1.0 - abs(n.y));
  vec3 H = normalize(uSunDir + V);
  c += uSunCol * pow(max(dot(n, H), 0.0), 28.0) * 0.07 * lit;
  c *= gDim;
  for (int i = 0; i < 8; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i].xyz - p; float dl = length(L) + 1e-4;
    float a = clamp(1.0 - dl / uLP[i].w, 0.0, 1.0); a = a * a * (1.4 - 0.4 * a);
    float dd = clamp(dot(n, L / dl) * 0.6 + 0.4, 0.0, 1.0);
    c += base * uLC[i].rgb * a * dd;
  }
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
  c += (uSkyAmb + uSunCol * 0.3) * rim * uRim * 0.5 * (0.35 + 0.65 * lit);
  return c;
}
float fogF(vec3 p) {
  float dd = length(p - uCamPos) * uFogMul;
  float f = 1.0 - exp(-pow(max(dd - 18.0, 0.0) * uFogD, 1.6));
  f += uFogH * exp(-max(p.y + 0.6, 0.0) * 0.7) * smoothstep(10.0, 40.0, dd);
  return clamp(f, 0.0, 1.0);
}`;

function shader(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error('shader', log, src.split('\n').slice(0, 4).join(' | ')); throw new Error('shader compile failed: ' + log); }
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, shader(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\nprecision highp int;\n' + fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); console.error('link', log); throw new Error('program link failed: ' + log); }
  const U = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i), nm = info.name.replace(/\[0\]$/, ''); U[nm] = gl.getUniformLocation(p, info.name); }
  return { p, U };
}
function tex2D(w, h, ifmt, fmt, type, filter, data) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
function fbo(colors, depth) {
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  colors.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0));
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers(colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  return f;
}
// the scene target has 2 attachments: colour (+emissive in alpha) and aux (object id lo/hi, outline weight)
function mrtBoth() { gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); }
function mrtColor() { gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); }

let PR = {}, RT = {}, QUADVAO = null;
const VS_MESH = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aExt;
layout(location=4) in vec4 aI0;
layout(location=5) in vec4 aI1;
uniform mat4 uVP, uModel;
uniform mat4 uBones[18];
uniform int uMode;
uniform float uTime, uWind, uId;
uniform vec3 uPlayer, uCamPos;
out vec3 vPos, vNrm; out vec4 vCol; out vec2 vEx; out float vCut; flat out float vId;
void main() {
  vec3 p = aPos, n = aNrm; vec4 col = aCol;
  vec4 wp; vCut = 0.0; vId = uId;
  if (uMode == 1) {
    float c = cos(aI0.w), s = sin(aI0.w), sc = aI1.x;
    vec3 q = p * sc;
    float sw = aExt.z * uWind * q.y * (sin(uTime * 1.6 + aI1.z) * 0.03 + sin(uTime * 2.9 + aI1.z * 1.7) * 0.012);
    q.x += sw; q.z += sw * 0.6;
    wp = vec4(aI0.x + q.x * c + q.z * s, aI0.y + q.y, aI0.z - q.x * s + q.z * c, 1.0);
    n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    col.rgb *= aI1.y;
    vId = 100.0 + floor(fract(aI1.z * 0.6180339 + aI0.x * 0.013 + aI0.z * 0.007) * 60000.0);
    vec2 ea = uCamPos.xz, eb = uPlayer.xz, ab = eb - ea; float tt = clamp(dot(aI0.xz - ea, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    vCut = (aI1.w > 0.0 && tt > 0.05 && tt < 0.9 && length(aI0.xz - ea - ab * tt) < aI1.w * sc && wp.y > uPlayer.y + 0.4) ? 1.0 : 0.0;
  } else {
    if (uMode == 2) { mat4 B = uBones[int(aExt.x * 255.0 + 0.5)]; p = (B * vec4(p, 1.0)).xyz; n = mat3(B) * n; }
    wp = uModel * vec4(p, 1.0); n = mat3(uModel) * n;
  }
  vPos = wp.xyz; vNrm = n; vCol = col; vEx = aExt.yw;
  gl_Position = uVP * wp;
}`;
const FS_MESH = GLSL_LIGHT + `
in vec3 vPos, vNrm; in vec4 vCol; in vec2 vEx; in float vCut; flat in float vId;
uniform int uMat;
uniform float uEmK, uTintA, uOW, uGhost, uCutOn;
uniform vec3 uTint, uPlayer;
// building cutaway: A = (centre x, z, sin rot, cos rot), B = (half x, half z, floor y, fade),
// C = (toward-camera dir in the building frame, stub height, wall height), D = (wall band, outside margin, keep occluder off)
uniform vec4 uCutA, uCutB, uCutC, uCutD, uOcc;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o1;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
vec4 idOut(float w) { float id = vId; return vec4(mod(id, 256.0) / 255.0, floor(id / 256.0) / 255.0, w, 1.0); }
const float BAY[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
float bayer(vec2 fc) { ivec2 q = ivec2(fc) & 3; return (BAY[q.x + q.y * 4] + 0.5) / 16.0; }
void main() {
  bool calm = false;
  gFill = uCutOn * 0.55;
  if (uCutB.w > 0.0) {
    vec2 d = vPos.xz - uCutA.xy;
    vec2 l = vec2(d.x * uCutA.z - d.y * uCutA.w, d.x * uCutA.w + d.y * uCutA.z);
    vec2 e = uCutB.xy - abs(l);
    if (e.x > 0.0 && e.y > 0.0) gDim = 1.0 - uCutD.w * uCutB.w;
    if (uCutOn > 0.5 && e.x > -uCutD.y && e.y > -uCutD.y) {
      float de = min(e.x, e.y);
      vec2 nr = e.x < e.y ? vec2(sign(l.x), 0.0) : vec2(0.0, sign(l.y));
      bool band = de < uCutD.x;
      float lim = band && dot(nr, uCutC.xy) > 0.25 ? uCutC.z : uCutC.w;
      if (uCutD.z > 0.5 && de < -0.12) lim = min(lim, uCutC.z + 1.1); // towers / chimneys outside a roofed building drop low too
      calm = band || uCutD.z > 0.5;
      if (vPos.y - uCutB.z > lim + 0.01 && bayer(gl_FragCoord.xy) < uCutB.w) discard;
    }
  }
  if (!calm && vCut > 0.5) { ivec2 q = ivec2(gl_FragCoord.xy) & 1; if (q.x + q.y != 0) discard; }
  if (uOcc.w > 0.5) { // see-through around the line from the eye to the player (big castle parts, pillars)
    vec3 a = uCamPos, b = uPlayer + vec3(0.0, 1.1, 0.0), ab = b - a;
    float t = clamp(dot(vPos - a, ab) / dot(ab, ab), 0.0, 1.0);
    if (t > 0.04 && t < 0.93 && length(vPos - a - ab * t) < uOcc.z && vPos.y > uPlayer.y + 0.5) { ivec2 q = ivec2(gl_FragCoord.xy) & 1; if (q.x + q.y != 0) discard; }
  }
  vec3 n = normalize(vNrm);
  vec3 V = normalize(uCamPos - vPos);
  if (dot(n, V) < 0.0) n = -n;
  vec3 base = vCol.rgb;
  if (uGhost > 0.0) { o = vec4(uTint, uGhost * (0.4 + 0.6 * pow(1.0 - max(dot(n, V), 0.0), 1.5))); o1 = vec4(0.0); return; }
  if (uMat == 1) { // terrain: soft painted variation
    float k = vn(vPos.xz * 0.35) * 0.45 + vn(vPos.xz * 1.3) * 0.3 + vn(vPos.xz * 4.0) * 0.15 + vn(vPos.xz * 11.0) * 0.1;
    base *= 0.8 + 0.38 * k;
    base = mix(base, base * vec3(0.92, 0.88, 0.8), smoothstep(0.55, 0.8, vn(vPos.xz * 0.12 + 7.0)) * 0.5);
  } else if (uMat == 2) { // toon water
    float w = vn(vPos.xz * 0.9 + vec2(uTime * 0.25, uTime * 0.15)) * 0.6 + vn(vPos.xz * 2.3 - vec2(uTime * 0.4, -uTime * 0.2)) * 0.4;
    vec3 c = toon(vPos, vec3(0.0, 1.0, 0.0), base, V);
    c = mix(c, c * 1.25 + 0.04, smoothstep(0.55, 0.58, w));
    c = mix(c, vec3(0.92, 0.97, 1.0) * (0.35 + 0.65 * (1.0 - smoothstep(0.3, 0.9, 1.0 - uSunCol.r))), smoothstep(0.74, 0.76, w) * 0.85);
    vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
    c += uSunCol * step(0.985, max(dot(R, uSunDir), 0.0)) * 0.6;
    for (int i = 0; i < 8; i++) { if (i >= uNL) break; float dl = length(uLP[i].xyz - vPos);
      c += uLC[i].rgb * smoothstep(0.55, 0.62, clamp(1.0 - dl / (uLP[i].w * 1.5), 0.0, 1.0)) * 0.35; }
    float f = fogF(vPos);
    o = vec4(mix(c, uFogCol, f), 0.0); o1 = idOut(0.0);
    return;
  }
  vec3 c = toon(vPos, n, base, V);
  float em = vEx.x * uEmK;
  c = mix(c, base * 1.35 + vec3(0.08, 0.04, 0.0), em);
  c = mix(c, uTint, uTintA);
  float f = fogF(vPos);
  o = vec4(mix(c, uFogCol, f), em * (1.0 - f));
  o1 = idOut(uOW * (1.0 - f));
}`;
const VS_FULL = `
layout(location=0) in vec2 aP;
out vec2 vUV;
void main() { vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0.0, 1.0); }`;
const FS_SKY = `
in vec2 vUV;
uniform mat4 uIVP;
uniform vec3 uCamPos, uZen, uHor, uFogCol, uMoonDir, uMoonCol, uSunDir2;
uniform float uStars, uTime;
layout(location=0) out vec4 o;
layout(location=1) out vec4 o1;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec4 a = uIVP * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w - uCamPos);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.5, h));
  c = mix(uFogCol, c, smoothstep(-0.05, 0.1, h));
  if (uStars > 0.0 && d.y > 0.02) {
    vec3 q = floor(d * 200.0); float s = h31(q);
    c += vec3(0.85, 0.9, 1.0) * step(0.996, s) * uStars * (0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0));
  }
  float md = max(dot(d, uMoonDir), 0.0);
  c += uMoonCol * (step(0.9993, md) * 1.6 + pow(md, 60.0) * 0.25);
  float sd = max(dot(d, uSunDir2), 0.0);
  c += vec3(1.0, 0.92, 0.7) * (step(0.9985, sd) * 1.4 + pow(sd, 14.0) * 0.2) * step(0.0, uSunDir2.y + 0.1);
  o = vec4(c, 0.0); o1 = vec4(0.0);
}`;
// bloom: emissive pixels -> quarter-res blurred glow
const FS_BLOOM = `
in vec2 vUV;
uniform sampler2D tC;
uniform vec2 uPx;
out vec4 o;
void main() {
  vec3 acc = vec3(0.0); float w = 0.0;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    float k = exp(-float(i * i + j * j) * 0.22);
    vec4 c = texture(tC, vUV + vec2(i, j) * uPx * 2.5);
    acc += c.rgb * c.a * k; w += k;
  }
  o = vec4(acc / w, 1.0);
}`;
// composite: id/depth outlines + bloom + grade
const FS_COMP = `
in vec2 vUV;
uniform sampler2D tC, tA, tD, tB;
uniform vec2 uPx;
uniform float uNear, uFar, uBloomK, uVig, uFlashA, uFadeA, uSat, uLineW, uLineK, uBright;
uniform vec3 uFlashC, uGrade;
out vec4 o;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
float idOf(vec4 a) { return floor(a.r * 255.0 + 0.5) + floor(a.g * 255.0 + 0.5) * 256.0; }
void main() {
  vec4 c = texture(tC, vUV);
  vec2 sz = vec2(textureSize(tA, 0));
  ivec2 ip = ivec2(vUV * sz);
  vec4 a0 = texelFetch(tA, ip, 0);
  float d0 = lin(texelFetch(tD, ip, 0).r), id0 = idOf(a0), w0 = a0.b;
  float edge = 0.0;
  int L = int(uLineW + 0.5);
  ivec2 offs[8] = ivec2[](ivec2(L, 0), ivec2(-L, 0), ivec2(0, L), ivec2(0, -L), ivec2(L, L), ivec2(-L, -L), ivec2(L, -L), ivec2(-L, L));
  for (int i = 0; i < 8; i++) {
    ivec2 q = clamp(ip + offs[i], ivec2(0), ivec2(sz) - 1);
    vec4 an = texelFetch(tA, q, 0);
    float dn = lin(texelFetch(tD, q, 0).r), idn = idOf(an), wn = an.b;
    float k = i < 4 ? 1.0 : 0.6;
    if (abs(idn - id0) > 0.5) {
      if (d0 <= dn + 0.02 * d0) edge = max(edge, w0 * k);
      else edge = max(edge, wn * k * 0.0);
    }
    if (dn - d0 > max(0.28, d0 * 0.045)) edge = max(edge, w0 * k);
  }
  vec3 col = c.rgb;
  vec3 line = col * 0.55;
  col = mix(col, line, clamp(edge, 0.0, 1.0) * uLineK);
  col += texture(tB, vUV).rgb * uBloomK;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat) * uGrade * uBright;
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35); // a little extra contrast for a moodier look
  vec2 q = vUV - 0.5;
  col *= 1.0 - uVig * dot(q, q) * 1.8;
  col = mix(col, uFlashC, uFlashA);
  col *= 1.0 - uFadeA;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function glFail(why) {
  GLOK = false;
  if (typeof document === 'undefined' || !document.body || !document.body.appendChild) return;
  if (document.getElementById('nogl')) return;
  const d = document.createElement('div'); d.id = 'nogl'; d.className = 'ov';
  d.style.cssText = 'display:flex;z-index:60;text-align:center;line-height:1.6;background:#06070a';
  for (const id of ['title', 'touch']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
  d.innerHTML = '<div class="panel" style="max-width:520px"><h2 style="color:#e8c050;letter-spacing:.15em">IRON CROWN 1700</h2><p>This game draws its world with <b>WebGL2</b>, which this browser or device has turned off or does not support.</p><p style="opacity:.75">Try a current Chrome, Edge, Firefox or Safari, and check that hardware acceleration is on.</p><p style="opacity:.5;font-size:12px">' + String(why || '').slice(0, 120) + '</p></div>';
  document.body.appendChild(d);
}
function initGL() {
  try {
    glc = mkCanvas(4, 4); glc.id = 'glv';
    if (canvas && canvas.parentNode && canvas.parentNode.insertBefore) canvas.parentNode.insertBefore(glc, canvas);
    gl = glc.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl || typeof gl.createShader !== 'function' || typeof gl.texImage3D !== 'function' || !gl.getParameter(gl.VERSION)) { glFail('No WebGL2 context.'); return; }
    PR.mesh = program(VS_MESH, FS_MESH);
    PR.sky = program(VS_FULL, FS_SKY);
    PR.bloom = program(VS_FULL, FS_BLOOM);
    PR.comp = program(VS_FULL, FS_COMP);
    QUADVAO = gl.createVertexArray(); gl.bindVertexArray(QUADVAO);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    initScene();
    GLOK = true;
    glc.addEventListener && glc.addEventListener('webglcontextlost', e => { e.preventDefault(); glFail('The graphics context was lost. Reload the page.'); });
  } catch (err) { console.error(err); glFail(err && err.message); }
}
function makeTargets() {
  for (const k in RT) { const v = RT[k]; if (!v) continue; if (v instanceof WebGLTexture) gl.deleteTexture(v); else if (v instanceof WebGLFramebuffer) gl.deleteFramebuffer(v); }
  RT = {};
  RT.c = tex2D(SW, SH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  RT.a = tex2D(SW, SH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
  RT.d = tex2D(SW, SH, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
  RT.f = fbo([RT.c, RT.a], RT.d);
  BW2 = Math.max(8, Math.round(SW / 4)); BH2 = Math.max(8, Math.round(SH / 4));
  RT.b = tex2D(BW2, BH2, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  RT.bf = fbo([RT.b]);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function resize() {
  VW = window.innerWidth || 800; VH = window.innerHeight || 600; DPR = Math.min(3, window.devicePixelRatio || 1);
  PORTRAIT = VH > VW;
  if (canvas) { canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR); }
  if (ctx) ctx.imageSmoothingEnabled = false;
  GDPR = Math.min(DPR, MOBILE ? 2 : 1.5);
  if (!glc) initGL();
  if (glc) {
    RW = Math.max(1, Math.round(VW * GDPR)); RH = Math.max(1, Math.round(VH * GDPR));
    glc.width = RW; glc.height = RH;
    const scale = MOBILE ? 0.8 : 1.0;
    SW = Math.max(16, Math.round(RW * scale)); SH = Math.max(16, Math.round(RH * scale));
    if (GLOK) makeTargets();
  }
  if (typeof layoutTouch === 'function') layoutTouch();
}

// ---------- camera ----------
let camGH = null;
function camFocus() {
  // follow the player, look a little ahead in screen-up direction, lean toward a locked target
  let fx = P.x, fy = P.y;
  const tg = S.mode === 'play' && P.lock && !P.lock.dead ? P.lock : null;
  if (tg) { let dx = tg.x - P.x, dy = tg.y - P.y; const d = Math.hypot(dx, dy); if (d > 0.1) { const k = Math.min(d * 0.32, 5) / d; fx += dx * k; fy += dy * k; } }
  const ahead = PORTRAIT ? 2.4 : 1.4;
  return [fx + Math.cos(CAMK.yaw) * ahead, fy + Math.sin(CAMK.yaw) * ahead];
}
function updateCamera(dt, snap) {
  if (S.mode === 'title') CAMK.yawT += dt * 0.06;
  CAMK.yaw += angDiff(CAMK.yaw, CAMK.yawT) * Math.min(1, dt * 6);
  const near = S.mode === 'play' && (P.lock || S.ents.some(e => e.team === 1 && !e.dead && Math.abs(e.x - P.x) < 15 && Math.abs(e.y - P.y) < 15));
  const inB = S.cut && S.cut.s && S.cut.s.roof ? S.cut.k : 0;
  let cz = 0; { const cs = S.mode === 'play' && typeof castleGround === 'function' ? castleGround(P.x, P.y) : null; if (cs) { const l = w2l(cs, P.x, P.y), o = Math.max(Math.abs(l[0]), Math.abs(l[1])) - CAS_S; cz = clamp(1 - (o - 6) / 30, 0, 1); } }
  CAMK.cz = (CAMK.cz || 0) + (cz - (CAMK.cz || 0)) * Math.min(1, dt * 1.2);
  const zt = (P.mounted ? 1.16 : 1) * (near ? 1.1 : 1) * (S.mode === 'title' ? 1.12 : 1) * (1 - 0.13 * inB) * (1 + 0.2 * CAMK.cz * (1 - inB));
  CAMK.zoom += (zt - CAMK.zoom) * Math.min(1, dt * 1.6);
  if (CAMK.zoomLock) CAMK.zoom = CAMK.zoomLock; // test hook (screenshots)
  const f = camFocus();
  if (snap || !CAMK.init) { CAMK.fx = f[0]; CAMK.fy = f[1]; CAMK.init = true; CAMK.zoom = CAMK.zoomLock || zt; }
  const k = Math.min(1, dt * 7);
  CAMK.fx += (f[0] - CAMK.fx) * k; CAMK.fy += (f[1] - CAMK.fy) * k;
  CAM.a = CAMK.yaw; CAM.c = Math.cos(CAM.a); CAM.s = Math.sin(CAM.a);
  CAM.x = CAMK.fx; CAM.y = CAMK.fy;
}
function setupCamera(dt) {
  const asp = RW / RH;
  const wantW = PORTRAIT ? 10.5 : 15.5; // world units visible across at the focus point
  const D = CAMK.dist * CAMK.zoom;
  let fx = 2 * Math.atan((wantW / 2) / CAMK.dist);
  let fy = 2 * Math.atan(Math.tan(fx / 2) / asp);
  fy = clamp(fy, 26 * Math.PI / 180, 66 * Math.PI / 180);
  CAM.fovY = fy;
  const gh = groundH(CAM.x, CAM.y);
  camGH = camGH === null || dt === 0 ? gh : camGH + (gh - camGH) * Math.min(1, dt * 4);
  let sx = 0, sy = 0;
  if (S.shake > 0) { const a = S.shake * 0.28; sx = rr(-a, a); sy = rr(-a, a); }
  const cp = Math.cos(CAMK.pitch), sp = Math.sin(CAMK.pitch), cx = Math.cos(CAMK.yaw), cz = Math.sin(CAMK.yaw);
  const e = CAM.eye;
  e[0] = CAM.x - cx * D * cp + sx; e[1] = camGH + 0.9 + D * sp + sy; e[2] = CAM.y - cz * D * cp;
  const t = [CAM.x + sx * 0.5, camGH + 0.9, CAM.y];
  m4look(CAM.view, e, t, [0, 1, 0]);
  m4persp(CAM.proj, fy, asp, 0.5, 300);
  m4mul(CAM.vp, CAM.proj, CAM.view);
  m4inv(CAM.ivp, CAM.vp);
  const l = Math.hypot(t[0] - e[0], t[1] - e[1], t[2] - e[2]);
  CAM.fwd = [(t[0] - e[0]) / l, (t[1] - e[1]) / l, (t[2] - e[2]) / l];
}
// world -> HUD CSS pixels; returns null when behind the camera or off screen
function project(x, h, z, out) {
  const m = CAM.vp, cx = m[0] * x + m[4] * h + m[8] * z + m[12], cy = m[1] * x + m[5] * h + m[9] * z + m[13], cw = m[3] * x + m[7] * h + m[11] * z + m[15];
  if (cw < 0.2) return null;
  out = out || [0, 0, 0];
  out[0] = (cx / cw * 0.5 + 0.5) * VW; out[1] = (0.5 - cy / cw * 0.5) * VH; out[2] = cw;
  if (out[0] < -60 || out[0] > VW + 60 || out[1] < -60 || out[1] > VH + 60) return null;
  return out;
}
// screen CSS px -> world point on the plane y = h (for mouse aim)
function unproject(sx, sy, h) {
  const nx = sx / VW * 2 - 1, ny = 1 - sy / VH * 2, m = CAM.ivp;
  const p = (z) => { const x = m[0] * nx + m[4] * ny + m[8] * z + m[12], y = m[1] * nx + m[5] * ny + m[9] * z + m[13], zz = m[2] * nx + m[6] * ny + m[10] * z + m[14], w = m[3] * nx + m[7] * ny + m[11] * z + m[15]; return [x / w, y / w, zz / w]; };
  const a = p(-1), b = p(1), dy = b[1] - a[1]; if (Math.abs(dy) < 1e-6) return null;
  const t = (h - a[1]) / dy; return [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
}
// frustum test of a sphere in world space
function inView(x, y, z, r) {
  const m = CAM.vp;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  const rr2 = r * 1.6;
  if (cw < -r) return false;
  return cx > -cw - rr2 * 1.3 && cx < cw + rr2 * 1.3 && cy > -cw - rr2 * 1.3 && cy < cw + rr2 * 1.3;
}

// ---------- environment: sun/moon, fog, ambient by time + biome ----------
const ENV = { sun: [0, 1, 0], sunC: [1, 1, 1], sky: [0.3, 0.35, 0.4], gnd: [0.1, 0.1, 0.1], fog: [0.4, 0.45, 0.5], fogD: 0.02, fogH: 0.2, zen: [0, 0, 0], hor: [0, 0, 0], moon: [0, 1, 0], moonC: [0, 0, 0], sunVis: [0, -1, 0], stars: 0, emK: 0, wind: 1, shTint: [0.7, 0.74, 0.95], rim: 0.5, sat: 1.1, grade: [1, 1, 1], bloom: 0.5, bright: 1 };
const BIOME_FOG = [
  [0.56, 0.6, 0.62], [0.46, 0.52, 0.5], [0.7, 0.74, 0.8], [0.46, 0.5, 0.46], [0.58, 0.54, 0.58], [0.74, 0.66, 0.54]
];
let envBiome = [0.66, 0.8, 0.94], envFogK = 1;
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function updateEnv(dt) {
  const b = S.curBiome >= 0 ? S.curBiome : biomeAt(CAM.x, CAM.y);
  const tb = BIOME_FOG[b] || BIOME_FOG[0], k = dt ? Math.min(1, dt * 0.8) : 1;
  envBiome = mix3(envBiome, tb, k);
  const fk = b === B_SWAMP ? 1.7 : b === B_SNOW ? 1.25 : b === B_FOREST ? 1.1 : b === B_DESERT ? 0.9 : 1;
  envFogK += (fk - envFogK) * k;
  const d = S.darkness, blood = S.bloodMoon;
  const ang = (S.time - 0.25) * TAU, sy = Math.sin(ang), sx = Math.cos(ang);
  // keep the sun high and from the "south-east" so shadows read well from the fixed camera
  const sun = [sx * 0.5 + 0.25, Math.max(0.55, sy * 0.9 + 0.25), 0.55]; let l = Math.hypot(...sun);
  ENV.sunVis = [sx * 0.8, sy, 0.45].map(v => v / Math.hypot(sx * 0.8, sy, 0.45));
  const moonDir = [0.3, 0.75, 0.55]; const ml = Math.hypot(...moonDir); ENV.moon = moonDir.map(v => v / ml);
  const dusk = clamp(1 - Math.abs(d - 0.5) * 2.6, 0, 1);
  if (d < 0.5) ENV.sun = sun.map(v => v / l); else ENV.sun = ENV.moon.slice();
  const dayC = [0.9, 0.86, 0.76], duskC = [0.92, 0.56, 0.4], nightC = blood ? [0.55, 0.14, 0.12] : [0.3, 0.4, 0.78];
  let sc = mix3(dayC, nightC, d); sc = mix3(sc, duskC, dusk * 0.6);
  ENV.sunC = sc;
  const skyDay = [0.4, 0.42, 0.46], skyN = blood ? [0.2, 0.06, 0.08] : [0.1, 0.13, 0.32];
  ENV.sky = mix3(skyDay, skyN, d);
  ENV.gnd = mix3([0.26, 0.24, 0.22], blood ? [0.08, 0.03, 0.03] : [0.05, 0.06, 0.12], d);
  ENV.shTint = mix3([0.74, 0.78, 1.0], [0.7, 0.75, 1.0], d);
  ENV.rim = 0.25 - d * 0.1;
  const fogDay = envBiome, fogN = blood ? [0.14, 0.04, 0.06] : mix3([0.05, 0.07, 0.17], envBiome, 0.08), fogDusk = [0.82, 0.58, 0.5];
  let fc = mix3(fogDay, fogN, d); fc = mix3(fc, fogDusk, dusk * 0.5);
  ENV.fog = fc;
  ENV.hor = mix3(fc, [1, 1, 1], 0.04 * (1 - d));
  ENV.zen = mix3([0.34, 0.4, 0.5], blood ? [0.05, 0.0, 0.01] : [0.01, 0.02, 0.06], d);
  ENV.moonC = (blood ? [1.0, 0.25, 0.18] : [0.9, 0.95, 1.0]).map(v => v * clamp(d * 1.3 - 0.2, 0, 1));
  ENV.stars = clamp(d * 1.4 - 0.4, 0, 1);
  ENV.fogD = 0.008 * envFogK;
  ENV.fogH = (0.08 + d * 0.06) * envFogK * (b === B_SWAMP ? 1.6 : 1);
  ENV.emK = clamp(d * 1.6 - 0.25, 0, 1);
  ENV.wind = b === B_SNOW || b === B_HEATH ? 1.6 : 1;
  ENV.sat = lerp(0.7, 0.62, d);
  ENV.grade = blood ? mix3([1, 1, 1], [1.08, 0.86, 0.86], d) : mix3([0.98, 0.96, 0.9], [0.86, 0.92, 1.08], d);
  ENV.bloom = 0.35 + d * 0.6;
  ENV.bright = 0.9;
}

// ---------- point lights (torch, campfires, windows, fireballs, burning foes) ----------
const LIGHTS = [];
function collectLights() {
  LIGHTS.length = 0;
  const d = S.darkness;
  const fl = 1 + Math.sin(S.t * 13) * 0.05 + Math.sin(S.t * 31) * 0.04;
  const L = [];
  const add = (x, z, r, c, k, h) => L.push([x, groundH(x, z) + (h || 1.2), z, r, c[0] * k, c[1] * k, c[2] * k, (x - CAM.x) ** 2 + (z - CAM.y) ** 2]);
  const torch = S.mode !== 'title' && hasTorch();
  if (torch) add(P.x + Math.cos(P.a) * 0.3, P.y + Math.sin(P.a) * 0.3, 9 * fl, [1.0, 0.6, 0.3], 0.12 + d * 0.6, P.mounted ? 2.6 : 1.7);
  else if (d > 0.3) add(P.x, P.y, 4.5, [0.45, 0.55, 0.9], 0.3 * d, 2);
  const inS = S.cut && S.cut.s && S.cut.k > 0 ? S.cut.s : null;
  const lit = (l, gy) => {
    const inside = !!inS && l.s === inS;
    if (d < 0.08 && !inside) return;
    const k = inside ? l.k * 2.3 * Math.max(0.5, d) * (0.4 + 0.6 * S.cut.k) : l.k * d + (l.base || 0);
    L.push([l.x, (gy === undefined ? groundH(l.x, l.y) : gy) + l.h, l.y, l.r * (l.flick ? fl : 1), l.c[0] * k, l.c[1] * k, l.c[2] * k, (l.x - CAM.x) ** 2 + (l.y - CAM.y) ** 2 - (inside ? 400 : 0)]);
  };
  {
    const pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c || !c.lights) continue;
      for (const l of c.lights) if (Math.abs(l.x - CAM.x) < 40 && Math.abs(l.y - CAM.y) < 40) lit(l, l.gy);
    }
  }
  for (const e of S.ents) { if (e.dead) continue; if (e.burnT > 0) add(e.x, e.y, 5, [1, 0.5, 0.2], 0.6, 1.2); else if (e.kind === 'witch' && e.state === 'wind') add(e.x, e.y, 5, [0.55, 1.0, 0.4], 0.6, 2.6); }
  for (const p of S.projs) if (p.kind === 'fire') add(p.x, p.y, 6, [1.0, 0.45, 0.15], 0.8, p.elev + 0.2);
  if (S.fxLight > 0) add(P.x, P.y, 6, [1, 0.9, 0.6], S.fxLight, 1.5);
  L.sort((a, b) => a[7] - b[7]);
  for (let i = 0; i < Math.min(8, L.length); i++) LIGHTS.push(L[i]);
}
const LPU = new Float32Array(32), LCU = new Float32Array(32);
function useLit(pr) {
  const U = pr.U; gl.useProgram(pr.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp);
  gl.uniform3fv(U.uCamPos, CAM.eye); gl.uniform3fv(U.uSunDir, ENV.sun); gl.uniform3fv(U.uSunCol, ENV.sunC);
  gl.uniform3fv(U.uSkyAmb, ENV.sky); gl.uniform3fv(U.uGndAmb, ENV.gnd); gl.uniform3fv(U.uFogCol, ENV.fog);
  if (U.uShadowTint) gl.uniform3fv(U.uShadowTint, ENV.shTint);
  if (U.uRim) gl.uniform1f(U.uRim, ENV.rim);
  gl.uniform1f(U.uFogD, ENV.fogD); gl.uniform1f(U.uFogH, ENV.fogH); gl.uniform1f(U.uFogMul, 1); gl.uniform1f(U.uTime, S.t);
  if (U.uPlayer) gl.uniform3f(U.uPlayer, P.x, groundH(P.x, P.y), P.y);
  if (U.uLP) {
    LPU.fill(0); LCU.fill(0);
    LIGHTS.forEach((l, i) => { LPU.set([l[0], l[1], l[2], l[3]], i * 4); LCU.set([l[4], l[5], l[6], 1], i * 4); });
    gl.uniform4fv(U.uLP, LPU); gl.uniform4fv(U.uLC, LCU); gl.uniform1i(U.uNL, LIGHTS.length);
  }
  return U;
}
