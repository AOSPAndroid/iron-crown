// =====================================================================
//  RENDERER CORE — WebGL2 context, shaders, camera, lights, ASCII post-process
// =====================================================================
let canvas = null, ctx = null;              // HUD overlay canvas (2D, device px)
let glc = null, gl = null, GLOK = false;    // WebGL2 canvas + context
let VW = 800, VH = 600, DPR = 1, GDPR = 1, PORTRAIT = false;
const MOBILE = (typeof navigator !== 'undefined') && ((navigator.maxTouchPoints || 0) > 0) && (typeof window !== 'undefined') && Math.min(window.innerWidth || 800, window.innerHeight || 600) < 820;
let RW = 1, RH = 1, SW = 1, SH = 1, CW = 1, CH = 1, CELLX = 6, CELLY = 8;
const CAM = { a: 0, c: 1, s: 0, x: 0, y: 0, eye: [0, 0, 0], fwd: [1, 0, 0], vp: new Float32Array(16), view: new Float32Array(16), proj: new Float32Array(16), ivp: new Float32Array(16), fovY: 1, gh: 0, sh: [0, 0] };
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
  // R = Ry * Rx * Rz
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

// ---------- shader helpers ----------
const GLSL_LIGHT = `
uniform vec3 uCamPos, uSunDir, uSunCol, uSkyAmb, uGndAmb, uFogCol;
uniform float uFogD, uFogH, uFogMul, uTime;
uniform vec4 uLP[8], uLC[8];
uniform int uNL;
vec3 shade(vec3 p, vec3 n, vec3 base) {
  vec3 amb = mix(uGndAmb, uSkyAmb, n.y * 0.5 + 0.5);
  float d = max(dot(n, uSunDir), 0.0);
  vec3 c = base * (amb + uSunCol * d);
  for (int i = 0; i < 8; i++) {
    if (i >= uNL) break;
    vec3 L = uLP[i].xyz - p; float dl = length(L) + 1e-4;
    float att = clamp(1.0 - dl / uLP[i].w, 0.0, 1.0); att *= att;
    c += base * uLC[i].rgb * att * (0.35 + 0.65 * max(dot(n, L / dl), 0.0));
  }
  return c;
}
float fogF(vec3 p) {
  float dd = length(p - uCamPos) * uFogMul;
  float f = 1.0 - exp(-pow(dd * uFogD, 1.7));
  f += uFogH * exp(-max(p.y + 0.6, 0.0) * 0.55) * smoothstep(4.0, 30.0, dd);
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
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
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

// ---------- programs ----------
let PR = {}, RT = {}, ATLAS = null, QUADVAO = null;
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
uniform float uTime, uWind;
uniform vec3 uPlayer, uCamPos;
out vec3 vPos, vNrm; out vec4 vCol; out vec2 vEx; out float vCut;
void main() {
  vec3 p = aPos, n = aNrm; vec4 col = aCol;
  vec4 wp; vCut = 0.0;
  if (uMode == 1) {
    float c = cos(aI0.w), s = sin(aI0.w), sc = aI1.x;
    vec3 q = p * sc;
    float sw = aExt.z * uWind * q.y * (sin(uTime * 1.6 + aI1.z) * 0.035 + sin(uTime * 2.9 + aI1.z * 1.7) * 0.015);
    q.x += sw; q.z += sw * 0.6;
    wp = vec4(aI0.x + q.x * c + q.z * s, aI0.y + q.y, aI0.z - q.x * s + q.z * c, 1.0);
    n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
    col.rgb *= aI1.y;
    vec2 ea = uCamPos.xz, eb = uPlayer.xz, ab = eb - ea; float tt = clamp(dot(aI0.xz - ea, ab) / max(dot(ab, ab), 1e-3), 0.0, 1.0);
    vCut = (tt > 0.03 && tt < 0.93 && length(aI0.xz - ea - ab * tt) < aI1.w * sc) ? 1.0 : 0.0;
  } else {
    if (uMode == 2) { mat4 B = uBones[int(aExt.x * 255.0 + 0.5)]; p = (B * vec4(p, 1.0)).xyz; n = mat3(B) * n; }
    wp = uModel * vec4(p, 1.0); n = mat3(uModel) * n;
  }
  vPos = wp.xyz; vNrm = n; vCol = col; vEx = aExt.yw;
  gl_Position = uVP * wp;
}`;
const FS_MESH = GLSL_LIGHT + `
in vec3 vPos, vNrm; in vec4 vCol; in vec2 vEx; in float vCut;
uniform int uMat;
uniform float uEmK, uTintA, uMaskMul;
uniform vec3 uTint;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  if (vCut > 0.5) { ivec2 q = ivec2(gl_FragCoord.xy) & 1; if (q.x + q.y != 0) discard; }
  vec3 n = normalize(vNrm);
  vec3 V = uCamPos - vPos;
  if (dot(n, V) < 0.0) n = -n;
  vec3 base = vCol.rgb;
  float mask = vCol.a;
  if (uMat == 1) { // terrain: painterly mottling
    float k = vn(vPos.xz * 1.7) * 0.6 + vn(vPos.xz * 5.3) * 0.4;
    base *= 0.78 + 0.42 * k;
  } else if (uMat == 2) { // water
    float w = vn(vPos.xz * 1.3 + vec2(uTime * 0.35, uTime * 0.2)) + vn(vPos.xz * 3.1 - vec2(uTime * 0.5, -uTime * 0.3)) * 0.5;
    n = normalize(vec3((w - 0.75) * 0.35, 1.0, (vn(vPos.zx * 2.2 + uTime * 0.4) - 0.5) * 0.35));
    vec3 R = reflect(-normalize(V), n);
    float sp = pow(max(dot(R, uSunDir), 0.0), 40.0);
    base = mix(base, base * 1.5, w * 0.3);
    vec3 c = shade(vPos, n, base) + uSunCol * sp * 1.4;
    for (int i = 0; i < 8; i++) { if (i >= uNL) break; vec3 L = normalize(uLP[i].xyz - vPos); float dl = length(uLP[i].xyz - vPos);
      c += uLC[i].rgb * pow(max(dot(R, L), 0.0), 24.0) * clamp(1.0 - dl / (uLP[i].w * 1.6), 0.0, 1.0) * 0.8; }
    float f = fogF(vPos);
    o = vec4(mix(c, uFogCol, f), mask * (1.0 - f * 0.6) * uMaskMul);
    return;
  }
  vec3 c = shade(vPos, n, base);
  c = c / (1.0 + max(c.r, max(c.g, c.b)) * 0.45) * 1.3;
  float em = vEx.x * uEmK;
  c = mix(c, base * 1.7 + vec3(0.06, 0.03, 0.0), em);
  c = mix(c, uTint, uTintA);
  float f = fogF(vPos);
  o = vec4(mix(c, uFogCol, f), mask * (1.0 - f * 0.55) * (1.0 - em) * uMaskMul);
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
out vec4 o;
float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main() {
  vec4 a = uIVP * vec4(vUV * 2.0 - 1.0, 1.0, 1.0);
  vec3 d = normalize(a.xyz / a.w - uCamPos);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.55, h));
  c = mix(uFogCol, c, smoothstep(-0.05, 0.12, h));
  if (uStars > 0.0 && d.y > 0.02) {
    vec3 q = floor(d * 220.0); float s = h31(q);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 40.0);
    c += vec3(0.8, 0.85, 1.0) * step(0.9965, s) * uStars * tw * smoothstep(0.02, 0.2, d.y);
  }
  float md = max(dot(d, uMoonDir), 0.0);
  c += uMoonCol * (pow(md, 900.0) * 2.5 + pow(md, 40.0) * 0.25 + pow(md, 6.0) * 0.08);
  float sd = max(dot(d, uSunDir2), 0.0);
  c += vec3(1.0, 0.8, 0.55) * (pow(sd, 400.0) * 1.2 + pow(sd, 12.0) * 0.18) * step(0.0, uSunDir2.y + 0.1);
  o = vec4(c, 0.55);
}`;
// ascii pass A: average each cell of the scene (colour + mask) and its depth / luminance
const FS_CELL = `
uniform sampler2D tScene, tDepth;
uniform vec2 uCellS;       // cell size in scene texels
uniform vec2 uSceneSz;
uniform float uNear, uFar;
layout(location=0) out vec4 o0;
layout(location=1) out vec4 o1;
float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
void main() {
  vec2 c0 = floor(gl_FragCoord.xy) * uCellS;
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) {
    vec2 p = c0 + uCellS * (vec2(i, j) + 0.5) * 0.5;
    acc += texture(tScene, p / uSceneSz);
  }
  acc *= 0.25;
  float dz = lin(texture(tDepth, (c0 + uCellS * 0.5) / uSceneSz).r);
  float ld = clamp(log2(dz) / 9.0, 0.0, 1.0);
  float lum = dot(acc.rgb, vec3(0.299, 0.587, 0.114));
  float e = ld * 255.0;
  o0 = acc;
  o1 = vec4(floor(e) / 255.0, fract(e), lum, 1.0);
}`;
// ascii pass B: choose a glyph per cell (luminance ramp + per-cell letter variation, edge glyphs on silhouettes)
const FS_GLYPH = `
uniform sampler2D tCell, tCellD;
uniform float uExpo, uEdge;
uniform vec2 uSeed;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
float dep(ivec2 c) { vec4 v = texelFetch(tCellD, c, 0); return v.r + v.g / 255.0; }
float lu(ivec2 c) { return texelFetch(tCellD, c, 0).b; }
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  vec4 cell = texelFetch(tCell, c, 0);
  float lum = texelFetch(tCellD, c, 0).b;
  float d00 = dep(c + ivec2(-1, -1)), d10 = dep(c + ivec2(0, -1)), d20 = dep(c + ivec2(1, -1));
  float d01 = dep(c + ivec2(-1, 0)), d21 = dep(c + ivec2(1, 0));
  float d02 = dep(c + ivec2(-1, 1)), d12 = dep(c + ivec2(0, 1)), d22 = dep(c + ivec2(1, 1));
  float gx = (d20 + 2.0 * d21 + d22) - (d00 + 2.0 * d01 + d02);
  float gy = (d02 + 2.0 * d12 + d22) - (d00 + 2.0 * d10 + d20);
  float g = length(vec2(gx, gy)) * 9.0;
  float l00 = lu(c + ivec2(-1, -1)), l20 = lu(c + ivec2(1, -1)), l02 = lu(c + ivec2(-1, 1)), l22 = lu(c + ivec2(1, 1));
  float lx = (l20 + l22) - (l00 + l02), ly = (l02 + l22) - (l00 + l20);
  float lg = length(vec2(lx, ly));
  float idx;
  float L = clamp(pow(lum * uExpo, 0.6), 0.0, 0.999);
  float level = floor(L * 10.0);
  float v = floor(h21(vec2(c) + uSeed) * 5.0);
  idx = level * 5.0 + v;
  vec3 gc = cell.rgb * 1.75 + 0.03;
  float near = 1.0 - smoothstep(0.62, 0.74, dep(c));
  if (cell.a > 0.62 && near > 0.5 && (g > uEdge || lg > 0.6)) {
    float ex = g > uEdge ? gx : lx, ey = g > uEdge ? gy : ly;
    float an = atan(ey, ex);
    float a = abs(an); a = a > 1.5708 ? 3.14159 - a : a;
    if (a < 0.39) idx = 50.0;                  // gradient horizontal -> vertical edge
    else if (a > 1.18) idx = 51.0 + step(0.5, h21(vec2(c) * 1.3)) * 3.0; // horizontal edge: - or _
    else idx = (ex * ey > 0.0) ? 53.0 : 52.0;  // diagonals
    gc = cell.rgb * 2.1 + 0.06;
  }
  o = vec4(min(gc, vec3(1.0)), idx / 255.0);
}`;
const FS_BLOOM = `
uniform sampler2D tCell;
uniform vec2 uCells;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uCells;
  vec3 acc = vec3(0.0); float w = 0.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    float k = exp(-float(i * i + j * j) * 0.35);
    vec3 c = texture(tCell, uv + vec2(i, j) * 1.5 / uCells).rgb;
    float l = max(c.r, max(c.g, c.b));
    float m = texture(tCell, uv + vec2(i, j) * 1.5 / uCells).a;
    acc += c * smoothstep(0.62, 0.98, l) * (1.0 - m * 0.85) * k; w += k;
  }
  o = vec4(acc / w, 1.0);
}`;
const FS_FINAL = `
in vec2 vUV;
uniform sampler2D tScene, tCell, tGlyph, tAtlas, tBloom;
uniform vec2 uCell, uRes, uCells;
uniform float uTime, uBloomK, uVig, uFlashA, uFadeA, uGrain, uSat;
uniform vec3 uFlashC;
out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 cf = fc / uCell;
  ivec2 ci = ivec2(floor(cf));
  vec2 f = fract(cf);
  vec4 cell = texelFetch(tCell, ci, 0);
  vec4 g = texelFetch(tGlyph, ci, 0);
  float idx = floor(g.a * 255.0 + 0.5);
  vec2 slot = vec2(mod(idx, 8.0), floor(idx / 8.0));
  vec2 auv = (slot + vec2(f.x, 1.0 - f.y)) / 8.0;
  float cov = textureGrad(tAtlas, auv, vec2(1.0 / (uCell.x * 8.0), 0.0), vec2(0.0, 1.0 / (uCell.y * 8.0))).a;
  vec3 bg = cell.rgb * 0.3;
  vec3 asc = mix(bg, g.rgb, cov);
  vec3 sc = texture(tScene, vUV).rgb;
  float m = smoothstep(0.3, 0.8, cell.a);
  vec3 col = mix(sc, asc, m);
  col += texture(tBloom, vUV).rgb * uBloomK;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(lum), col, uSat);
  col = clamp(col, 0.0, 1.0); col = col * col * (3.0 - 2.0 * col) * 0.55 + col * 0.45;
  vec2 q = vUV - 0.5;
  col *= 1.0 - uVig * dot(q, q) * 2.2;
  col += (h21(fc + fract(uTime * 7.13) * 91.7) - 0.5) * uGrain;
  col = mix(col, uFlashC, uFlashA);
  col *= 1.0 - uFadeA;
  o = vec4(col, 1.0);
}`;

// ---------- glyph atlas (8x8 slots, generated at runtime) ----------
const GLYPHS = [
  '  .  ', '.,`.\'', ':;-~:', '=+ric', 'vzxnu', 'eosac', 'wpqdb', '%kh&Q', '#BMWD', '@0N8@', '|-/\\_', '~*+o '
].join('');
function buildAtlas() {
  const SW0 = 48, SH0 = 64, cv = mkCanvas(SW0 * 8, SH0 * 8), x = cv.getContext('2d');
  x.clearRect(0, 0, cv.width, cv.height);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 52px ui-monospace,Menlo,Consolas,"DejaVu Sans Mono","Liberation Mono","Courier New",monospace';
  for (let i = 0; i < GLYPHS.length && i < 64; i++) {
    const ch = GLYPHS[i]; if (ch === ' ') continue;
    const cx = (i % 8) * SW0 + SW0 / 2, cy = Math.floor(i / 8) * SH0 + SH0 / 2 + 3;
    if (ch === '_') x.fillRect(cx - SW0 / 2 + 2, cy + 20, SW0 - 4, 6);
    else if (ch === '-') x.fillRect(cx - SW0 / 2 + 3, cy - 3, SW0 - 6, 6);
    else if (ch === '|') x.fillRect(cx - 3, cy - SH0 / 2 + 4, 6, SH0 - 8);
    else x.fillText(ch, cx, cy);
  }
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

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
    PR.cell = program(VS_FULL, FS_CELL);
    PR.glyph = program(VS_FULL, FS_GLYPH);
    PR.bloom = program(VS_FULL, FS_BLOOM);
    PR.final = program(VS_FULL, FS_FINAL);
    QUADVAO = gl.createVertexArray(); gl.bindVertexArray(QUADVAO);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    ATLAS = buildAtlas();
    initScene();
    GLOK = true;
    glc.addEventListener && glc.addEventListener('webglcontextlost', e => { e.preventDefault(); glFail('The graphics context was lost. Reload the page.'); });
  } catch (err) { console.error(err); glFail(err && err.message); }
}
function makeTargets() {
  for (const k in RT) { const v = RT[k]; if (!v) continue; if (v instanceof WebGLTexture) gl.deleteTexture(v); else if (v instanceof WebGLFramebuffer) gl.deleteFramebuffer(v); }
  RT = {};
  RT.sc = tex2D(SW, SH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  RT.sd = tex2D(SW, SH, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
  RT.sf = fbo([RT.sc], RT.sd);
  RT.c0 = tex2D(CW, CH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  RT.c1 = tex2D(CW, CH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
  RT.cf = fbo([RT.c0, RT.c1]);
  RT.g = tex2D(CW, CH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
  RT.gf = fbo([RT.g]);
  RT.b = tex2D(CW, CH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
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
    const cssCell = MOBILE || Math.min(VW, VH) < 560 ? 4.5 : 6;
    CELLX = Math.max(3, Math.round(cssCell * GDPR)); CELLY = Math.max(4, Math.round(cssCell * 1.36 * GDPR));
    CW = Math.ceil(RW / CELLX); CH = Math.ceil(RH / CELLY);
    const scale = MOBILE ? 0.5 : 0.62;
    SW = Math.max(16, Math.round(RW * scale)); SH = Math.max(16, Math.round(RH * scale));
    if (GLOK) makeTargets();
  }
  if (typeof layoutTouch === 'function') layoutTouch();
}

// ---------- camera ----------
let camGH = null;
function setupCamera(dt) {
  const asp = RW / RH;
  const hf = 0.92; // minimum horizontal fov (rad) on narrow screens
  let fy = 58 * Math.PI / 180;
  fy = Math.max(fy, 2 * Math.atan(Math.tan(hf / 2) / asp)); fy = Math.min(fy, 80 * Math.PI / 180);
  CAM.fovY = fy;
  const m = P.mounted && S.mode !== 'title';
  const dist = PORTRAIT ? 11.5 : 10.5, hgt = PORTRAIT ? 9.5 : 7.2, ahead = PORTRAIT ? 3.5 : 2.6;
  const k = m ? 1.15 : 1, tgtH = m ? 1.9 : 1.1;
  const fx = Math.cos(CAM.a), fz = Math.sin(CAM.a);
  const gh = groundH(CAM.x, CAM.y);
  camGH = camGH === null || dt === 0 ? gh : camGH + (gh - camGH) * Math.min(1, dt * 4);
  let sx = 0, sy = 0;
  if (S.shake > 0) { const a = S.shake * 0.35; sx = rr(-a, a); sy = rr(-a, a); }
  const e = CAM.eye;
  e[0] = CAM.x - fx * dist * k + sx; e[1] = camGH + hgt * k + sy; e[2] = CAM.y - fz * dist * k;
  const eh = groundH(e[0], e[2]) + 1.5; if (e[1] < eh) e[1] = eh;
  const t = [CAM.x + fx * ahead + sx * 0.5, camGH + tgtH, CAM.y + fz * ahead];
  m4look(CAM.view, e, t, [0, 1, 0]);
  m4persp(CAM.proj, fy, asp, 0.3, 420);
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
// frustum test of a sphere in world space
function inView(x, y, z, r) {
  const m = CAM.vp;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
  const rr2 = r * 1.6;
  if (cw < -r) return false;
  return cx > -cw - rr2 * 1.3 && cx < cw + rr2 * 1.3 && cy > -cw - rr2 * 1.3 && cy < cw + rr2 * 1.3;
}

// ---------- environment: sun/moon, fog, ambient by time + biome ----------
const ENV = { sun: [0, 1, 0], sunC: [1, 1, 1], sky: [0.3, 0.35, 0.4], gnd: [0.1, 0.1, 0.1], fog: [0.4, 0.45, 0.5], fogD: 0.02, fogH: 0.2, zen: [0, 0, 0], hor: [0, 0, 0], moon: [0, 1, 0], moonC: [0, 0, 0], sunVis: [0, -1, 0], stars: 0, emK: 0, wind: 1 };
const BIOME_FOG = [
  [0.3, 0.36, 0.42], [0.22, 0.29, 0.3], [0.4, 0.46, 0.56], [0.27, 0.32, 0.3], [0.34, 0.33, 0.38], [0.56, 0.48, 0.38]
];
let envBiome = [0.3, 0.36, 0.42], envFogK = 1;
function mix3(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function updateEnv(dt) {
  const b = S.curBiome >= 0 ? S.curBiome : biomeAt(CAM.x, CAM.y);
  const tb = BIOME_FOG[b] || BIOME_FOG[0], k = dt ? Math.min(1, dt * 0.8) : 1;
  envBiome = mix3(envBiome, tb, k);
  const fk = b === B_SWAMP ? 1.55 : b === B_SNOW ? 1.2 : b === B_FOREST ? 1.15 : b === B_DESERT ? 0.85 : 1;
  envFogK += (fk - envFogK) * k;
  const d = S.darkness, blood = S.bloodMoon;
  const ang = (S.time - 0.25) * TAU, sy = Math.sin(ang), sx = Math.cos(ang);
  const sun = [sx * 0.75, Math.max(0.12, sy), 0.42]; let l = Math.hypot(...sun); ENV.sunVis = [sx * 0.8, sy, 0.45].map(v => v / Math.hypot(sx * 0.8, sy, 0.45));
  const moonDir = [-sx * 0.6 + 0.2, Math.max(0.25, -sy * 0.9 + 0.2), -0.55]; const ml = Math.hypot(...moonDir); ENV.moon = moonDir.map(v => v / ml);
  const dusk = clamp(1 - Math.abs(d - 0.5) * 2.6, 0, 1);
  // directional light: sun by day, moon by night
  if (d < 0.5) { ENV.sun = sun.map(v => v / l); } else ENV.sun = ENV.moon.slice();
  const dayC = [1.04, 0.96, 0.84], duskC = [1.0, 0.55, 0.32], nightC = blood ? [0.6, 0.12, 0.08] : [0.42, 0.52, 0.8];
  let sc = mix3(dayC, nightC, d); sc = mix3(sc, duskC, dusk * 0.7);
  ENV.sunC = sc.map(v => v * (1 - d * 0.2));
  const skyDay = mix3([0.27, 0.31, 0.4], envBiome, 0.35), skyN = blood ? [0.22, 0.07, 0.08] : [0.19, 0.24, 0.36];
  ENV.sky = mix3(skyDay, skyN, d);
  ENV.gnd = mix3([0.12, 0.11, 0.1], blood ? [0.08, 0.03, 0.03] : [0.05, 0.06, 0.09], d);
  const fogDay = envBiome, fogN = blood ? [0.14, 0.04, 0.05] : mix3([0.06, 0.085, 0.14], envBiome, 0.15), fogDusk = [0.5, 0.36, 0.32];
  let fc = mix3(fogDay, fogN, d); fc = mix3(fc, fogDusk, dusk * 0.45);
  ENV.fog = fc;
  ENV.hor = mix3(fc, [1, 1, 1], 0.06 * (1 - d));
  ENV.zen = mix3(mix3([0.18, 0.24, 0.34], envBiome, 0.25), blood ? [0.05, 0.0, 0.01] : [0.01, 0.015, 0.04], d);
  ENV.moonC = blood ? [1.0, 0.25, 0.18] : [0.75, 0.82, 1.0];
  ENV.moonC = ENV.moonC.map(v => v * clamp(d * 1.3 - 0.2, 0, 1));
  ENV.stars = clamp(d * 1.4 - 0.4, 0, 1);
  ENV.fogD = 0.0158 * envFogK;
  ENV.fogH = (0.14 + d * 0.1) * envFogK;
  ENV.emK = clamp(d * 1.6 - 0.25, 0, 1);
  ENV.wind = b === B_SNOW || b === B_HEATH ? 1.6 : 1;
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
  if (torch) add(P.x + Math.cos(P.a) * 0.3, P.y + Math.sin(P.a) * 0.3, 11 * fl, [1.0, 0.62, 0.3], 1.25 * (0.35 + d * 0.9), P.mounted ? 2.6 : 1.7);
  else if (d > 0.3) add(P.x, P.y, 4.5, [0.35, 0.45, 0.7], 0.5 * d, 2);
  if (d > 0.08) {
    const pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
      const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c) continue;
      for (const o of c.statics) {
        if (o.light) add(o.x, o.y, 13 * fl, [1.0, 0.55, 0.22], 1.4 * d + 0.25, 1.0);
        else if (o.type === 'house') add(o.x + Math.cos(o.rot) * 2.4, o.y + Math.sin(o.rot) * 2.4, 6.5, [1.0, 0.68, 0.32], 0.65 * d, 1.4);
      }
    }
  } else {
    const pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (c) for (const o of c.statics) if (o.light) add(o.x, o.y, 8 * fl, [1.0, 0.55, 0.22], 0.35, 1.0); }
  }
  for (const e of S.ents) { if (e.dead) continue; if (e.burnT > 0) add(e.x, e.y, 5, [1, 0.5, 0.2], 1.1, 1.2); else if (e.state === 'cast') add(e.x, e.y, 5, [0.55, 1.0, 0.4], 1.0, 2.6); }
  for (const p of S.projs) if (p.kind === 'fire') add(p.x, p.y, 7, [1.0, 0.45, 0.15], 1.5, p.elev + 0.2);
  L.sort((a, b) => a[7] - b[7]);
  for (let i = 0; i < Math.min(8, L.length); i++) LIGHTS.push(L[i]);
}
const LPU = new Float32Array(32), LCU = new Float32Array(32);
function useLit(pr) {
  const U = pr.U; gl.useProgram(pr.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp);
  gl.uniform3fv(U.uCamPos, CAM.eye); gl.uniform3fv(U.uSunDir, ENV.sun); gl.uniform3fv(U.uSunCol, ENV.sunC);
  gl.uniform3fv(U.uSkyAmb, ENV.sky); gl.uniform3fv(U.uGndAmb, ENV.gnd); gl.uniform3fv(U.uFogCol, ENV.fog);
  gl.uniform1f(U.uFogD, ENV.fogD); gl.uniform1f(U.uFogH, ENV.fogH); gl.uniform1f(U.uFogMul, 1); gl.uniform1f(U.uTime, S.t);
  if (U.uPlayer) gl.uniform3f(U.uPlayer, P.x, 0, P.y);
  if (U.uLP) {
    LPU.fill(0); LCU.fill(0);
    LIGHTS.forEach((l, i) => { LPU.set([l[0], l[1], l[2], l[3]], i * 4); LCU.set([l[4], l[5], l[6], 1], i * 4); });
    gl.uniform4fv(U.uLP, LPU); gl.uniform4fv(U.uLC, LCU); gl.uniform1i(U.uNL, LIGHTS.length);
  }
  return U;
}
