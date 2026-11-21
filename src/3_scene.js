// =====================================================================
//  SCENE — terrain chunks, instanced scenery, actors, grass, particles, frame
// =====================================================================
let frameNo = 0, lastRenderMs = 0;
const WATER_Y = -0.55;
// ---------- terrain height (visual only; gameplay stays 2D) ----------
const LAKE_THR = [0.73, 0.74, 0.7, 0.57, 0.76, 0.8];
function heightBase(x, y) {
  return (fbm(x * 0.016 + 7.3, y * 0.016 + 1.1) - 0.5) * 8.0 + (vnoise(x * 0.12 + 3.1, y * 0.12 + 0.7) - 0.5) * 0.6;
}
function heightRaw(x, y) {
  let h = heightBase(x, y);
  const b = biomeAt(x, y), lake = fbm(x * 0.011 + 300, y * 0.011 + 300), thr = LAKE_THR[b];
  const w = smooth(clamp((lake - thr + 0.085) / 0.085, 0, 1));
  if (w > 0) h = lerp(h, b === B_SNOW ? -0.45 : -1.15, w);
  const v = nearVillage(x, y, 26);
  if (v) {
    if (v.gh === undefined) v.gh = Math.max(0.2, heightBase(v.x, v.y));
    const d = Math.hypot(x - v.x, y - v.y), k = smooth(clamp((26 - d) / 11, 0, 1));
    h = lerp(h, v.gh, k);
  }
  return h;
}
function chunkOf(x, y) { return CHUNKS.get(Math.floor(x / CS) + ',' + Math.floor(y / CS)); }
function groundH(x, y) {
  const c = chunkOf(x, y), g = c && c.hg;
  if (!g) return heightRaw(x, y);
  const u = x - c.cx * CS, v = y - c.cy * CS, i = Math.min(31, Math.floor(u)), j = Math.min(31, Math.floor(v)), fx = u - i, fy = v - j, o = j * 33 + i;
  return (g[o] * (1 - fx) + g[o + 1] * fx) * (1 - fy) + (g[o + 33] * (1 - fx) + g[o + 34] * fx) * fy;
}
function tileNoGen(x, y) {
  const c = chunkOf(x, y); if (!c) return T_GRASS;
  return c.tiles[(Math.floor(y) - c.cy * CS) * CS + (Math.floor(x) - c.cx * CS)];
}
const tileAtWorld = tileNoGen;
// ground colours per tile: [colour, ascii mask]
const TCOL = [];
(() => {
  const T = (t, h, m) => { TCOL[t] = [hexC(h), m]; };
  T(T_GRASS, '#3a5a2e', 0.36); T(T_TALL, '#36542a', 0.34); T(T_WATER, '#2a3632', 0.9); T(T_DIRT, '#5a4c3a', 0.95); T(T_WHEAT, '#7e6a30', 0.34);
  T(T_SNOW, '#8a92a2', 0.52); T(T_DRIFT, '#959dac', 0.52); T(T_ICE, '#7898b0', 0.8); T(T_SAND, '#a08a62', 0.66); T(T_DUNE, '#ac946a', 0.62);
  T(T_MUD, '#463c2c', 0.85); T(T_MARSH, '#46502e', 0.42); T(T_BOG, '#242c26', 0.9); T(T_HEATHER, '#4e4252', 0.6); T(T_ROCKY, '#5a564e', 0.95); T(T_FLOOR, '#2a3a22', 0.45);
})();
// grass per tile: [r,g,b, density, tall]
const GRASSDEF = [];
(() => {
  const G = (t, h, d, tall) => { GRASSDEF[t] = hexC(h).concat([d, tall]); };
  for (let t = 0; t < NT; t++) G(t, '#3a5a2e', 0, 0);
  G(T_GRASS, '#3a5a30', 1, 0); G(T_TALL, '#425c32', 1, 1); G(T_FLOOR, '#2e4a26', 0.45, 0); G(T_WHEAT, '#a88a3c', 1, 1);
  G(T_MARSH, '#5e6c34', 0.85, 1); G(T_MUD, '#4e5030', 0.15, 0); G(T_HEATHER, '#6a4e6c', 0.75, 0); G(T_ROCKY, '#56603c', 0.22, 0); G(T_DIRT, '#4a5a30', 0.04, 0); G(T_DUNE, '#9a8a54', 0.05, 0);
})();

// ---------- GPU resources ----------
const GCH = new Map(); // chunk key -> { vao, vbo, water, inst: [{vao, ibo, n, mesh}], chests: [], fires: [], houses: [], cx, cy, hmid }
const SMESH = {}, CHM = new Map();
let TIDX = null, MOUNT = null, GRASS = null, PARTS = null, SHAD = null, UNITM = null;
function staticMesh(k) { let m = SMESH[k]; if (!m) { m = SMESH[k] = gpuMesh(STATIC_BUILD[k]()); } return m; }
function farMesh(k) { const b = STATIC_FAR[k]; if (!b) return null; let m = SMESH[k + '~']; if (!m) m = SMESH[k + '~'] = gpuMesh(b()); return m; }
function namedMesh(k, fn) { let m = CHM.get(k); if (!m) { m = gpuMesh(fn()); CHM.set(k, m); } return m; }
function initScene() {
  // shared terrain index buffer (32x32 quads over 33x33 vertices)
  const idx = new Uint16Array(32 * 32 * 6); let k = 0;
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const a = j * 33 + i, b = a + 1, c = a + 33, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  TIDX = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TIDX); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  MOUNT = gpuMesh(mkMountainsM());
  PR.grass = program(VS_GRASS, FS_GRASS);
  PR.pts = program(VS_PTS, FS_PTS);
  PR.shad = program(VS_SHAD, FS_SHAD);
  PR.mist = program(VS_MIST, FS_MIST);
  initGrass(); initParts(); initShadows(); initMist();
  UNITM = m4();
  const pr = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); PTMAX = pr && pr[1] ? Math.min(512, pr[1]) : 64;
}
function freeChunkGPU(g) {
  gl.deleteBuffer(g.vbo); gl.deleteVertexArray(g.vao);
  if (g.water) { gl.deleteBuffer(g.water.vbo); gl.deleteVertexArray(g.water.vao); }
  for (const s of g.inst) { gl.deleteBuffer(s.ibo); gl.deleteVertexArray(s.vao); if (s.far) gl.deleteVertexArray(s.far); }
}
function staticKey(o) {
  switch (o.type) {
    case 'rock': return o.snow ? 'rocksnow' : o.sand ? 'rocksand' : 'rock';
    case 'house': return o.v === 'snow' ? 'housesnow' : o.v === 'sand' ? 'housesand' : 'house';
    case 'chest': return null;
    default: return STATIC_BUILD[o.type] ? o.type : null;
  }
}
const OCCR = { pine: 1.7, snowpine: 1.7, oak: 2.3, palm: 1.4, deadtree: 1.2, house: 3.6, housesnow: 3.6, housesand: 3.6, ruin: 4.8, menhir: 1.0 };
const SSCALE = { pine: [0.8, 1.25], snowpine: [0.8, 1.25], oak: [0.8, 1.15], deadtree: [0.8, 1.2], palm: [0.85, 1.15], bush: [0.8, 1.2], rock: [1.0, 1.8], rocksnow: [1.0, 1.8], rocksand: [1.0, 1.8], pebble: [0.22, 0.48], menhir: [0.9, 1.15] };
function buildChunkGPU(c) {
  const ox = c.cx * CS, oy = c.cy * CS;
  // heights on a 35x35 grid (1 unit border for normals)
  const H = new Float32Array(35 * 35);
  for (let j = 0; j < 35; j++) for (let i = 0; i < 35; i++) H[j * 35 + i] = heightRaw(ox + i - 1, oy + j - 1);
  const hg = new Float32Array(33 * 33);
  for (let j = 0; j < 33; j++) for (let i = 0; i < 33; i++) hg[j * 33 + i] = H[(j + 1) * 35 + i + 1];
  const tileAtL = (x, y) => { if (x >= 0 && y >= 0 && x < CS && y < CS) return c.tiles[y * CS + x]; const wx = ox + x + 0.5, wy = oy + y + 0.5; return chunkOf(wx, wy) ? tileNoGen(wx, wy) : tileBase(wx, wy); };
  const buf = new ArrayBuffer(33 * 33 * VSTRIDE), f = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf);
  let hmin = 1e9, hmax = -1e9;
  for (let j = 0; j < 33; j++) for (let i = 0; i < 33; i++) {
    const v = j * 33 + i, o = v * VSTRIDE, h = hg[v];
    hmin = Math.min(hmin, h); hmax = Math.max(hmax, h);
    const hl = H[(j + 1) * 35 + i], hr = H[(j + 1) * 35 + i + 2], hd = H[j * 35 + i + 1], hu = H[(j + 2) * 35 + i + 1];
    let nx = hl - hr, ny = 2, nz = hd - hu; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    f[o / 4] = ox + i; f[o / 4 + 1] = h; f[o / 4 + 2] = oy + j;
    i8[o + 12] = nx * 127; i8[o + 13] = ny * 127; i8[o + 14] = nz * 127;
    let r = 0, g = 0, b = 0, m = 0;
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const t = tileAtL(i + di, j + dj), tc = TCOL[t] || TCOL[0]; r += tc[0][0]; g += tc[0][1]; b += tc[0][2]; m += tc[1]; }
    const jt = 0.9 + hash2(ox + i, oy + j) * 0.2, slope = 1 - ny;
    const rock = clamp(slope * 4 - 0.4, 0, 0.6);
    u8[o + 16] = clamp(lerp(r / 4 * jt, 0.36, rock) * 255, 0, 255); u8[o + 17] = clamp(lerp(g / 4 * jt, 0.35, rock) * 255, 0, 255); u8[o + 18] = clamp(lerp(b / 4 * jt, 0.32, rock) * 255, 0, 255);
    u8[o + 19] = clamp(lerp(m / 4, 1, rock), 0, 1) * 255;
  }
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); meshAttribs(vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TIDX); gl.bindVertexArray(null);
  // water surface quads over wet tiles
  let water = null;
  { const mb = new MB(1); mb.jit = 0; mb.mask = 0.7; let any = false;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const t = c.tiles[j * CS + i]; if (t !== T_WATER && t !== T_BOG) continue; any = true;
      const x0 = ox + i - 0.7, x1 = ox + i + 1.7, z0 = oy + j - 0.7, z1 = oy + j + 1.7, col = t === T_BOG ? '#1e2a22' : '#1c3240';
      mb.quad([x0, WATER_Y, z0], [x1, WATER_Y, z0], [x1, WATER_Y, z1], [x0, WATER_Y, z1], col);
    }
    if (any) water = gpuMesh(mb);
  }
  // scenery instances grouped by mesh
  const groups = {}, chests = [], fires = [], houses = [];
  c.hg = hg;
  for (const o of c.statics) {
    if (o.type === 'chest') { chests.push(o); continue; }
    if (o.type === 'fire') fires.push(o); if (o.type === 'house') houses.push(o);
    const k = staticKey(o); if (!k) continue;
    const h = hash2(Math.round(o.x * 7), Math.round(o.y * 7)), sr = SSCALE[k] || [1, 1];
    const rot = o.rot !== undefined ? yawOf(o.rot) : h * TAU;
    (groups[k] = groups[k] || []).push(o.x, groundH(o.x, o.y) - (k === 'house' || k === 'housesnow' || k === 'housesand' || k === 'ruin' ? 0.15 : 0.05), o.y, rot, lerp(sr[0], sr[1], hash2(Math.round(o.y * 13), Math.round(o.x * 5))), 0.86 + h * 0.24, h * 40, OCCR[k] || 0);
  }
  { const R = mulberry((c.cx * 7919) ^ (c.cy * 104729)), pk = [];
    for (let n = 0; n < 70; n++) {
      const x = ox + R() * CS, y = oy + R() * CS, t = c.tiles[(Math.floor(y - oy)) * CS + Math.floor(x - ox)];
      const p = t === T_ROCKY ? 0.9 : t === T_HEATHER || t === T_DIRT || t === T_FLOOR || t === T_SNOW || t === T_SAND ? 0.25 : t === T_MUD ? 0.3 : 0.06;
      if (R() > p) continue;
      pk.push(x, groundH(x, y) - 0.06, y, R() * TAU, 0.22 + R() * 0.3, 0.8 + R() * 0.3, 0, 0);
    }
    if (pk.length) groups[c.biome === B_SNOW ? 'pebblesnow' : c.biome === B_DESERT ? 'pebblesand' : 'pebble'] = pk; }
  const inst = [];
  const instVAO = (mesh, ibo) => {
    const v = gl.createVertexArray(); gl.bindVertexArray(v); meshAttribs(mesh.vbo);
    gl.bindBuffer(gl.ARRAY_BUFFER, ibo);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(4, 1);
    gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(5, 1);
    gl.bindVertexArray(null); return v;
  };
  for (const k in groups) {
    const mesh = staticMesh(k), data = new Float32Array(groups[k]);
    const ibo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ibo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const fm = farMesh(k);
    inst.push({ vao: instVAO(mesh, ibo), far: fm ? instVAO(fm, ibo) : null, fmesh: fm, ibo, n: data.length / 8, mesh, small: k.startsWith('pebble') ? 38 : k === 'bush' || k.startsWith('rock') ? 80 : 999 });
  }
  const g = { vao, vbo, water, inst, chests, fires, houses, cx: c.cx, cy: c.cy, hmid: (hmin + hmax) / 2, hr: (hmax - hmin) / 2, c };
  GCH.set(c.key, g);
  return g;
}
// build missing chunk meshes, nearest first, within a time budget; drop meshes of unloaded chunks
function syncChunks(budgetMs) {
  for (const [k, g] of GCH) if (CHUNKS.get(k) !== g.c) { freeChunkGPU(g); GCH.delete(k); if (g.c) g.c.hg = null; }
  const t0 = now(), pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS), list = [];
  for (const [k, c] of CHUNKS) if (!GCH.has(k)) list.push([Math.max(Math.abs(c.cx - pcx), Math.abs(c.cy - pcy)) + Math.hypot(c.cx - pcx, c.cy - pcy) * 0.01, c]);
  list.sort((a, b) => a[0] - b[0]);
  let made = 0;
  for (const [, c] of list) { if (made && now() - t0 > budgetMs) break; buildChunkGPU(c); made++; }
  if (made && GM.n) GM.cx = 1e9;
  return list.length - made;
}

// ---------- grass: one static buffer of blades, positioned around the camera in the vertex shader ----------
const VS_GRASS = `
layout(location=0) in vec4 aA;
layout(location=1) in vec4 aB;
uniform mat4 uVP;
uniform vec2 uC, uMap0;
uniform float uR, uRad, uMapN, uTime, uWind;
uniform sampler2D tH, tI;
out vec3 vPos, vCol; out float vT;
float hAt(vec2 p) {
  vec2 u = clamp(p - uMap0, vec2(0.0), vec2(uMapN - 2.0)); ivec2 i = ivec2(floor(u)); vec2 f = fract(u);
  float a = texelFetch(tH, i, 0).r, b = texelFetch(tH, i + ivec2(1, 0), 0).r, c = texelFetch(tH, i + ivec2(0, 1), 0).r, d = texelFetch(tH, i + ivec2(1, 1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void main() {
  vec2 w = uC + mod(aA.xy - uC + uR * 0.5, uR) - uR * 0.5;
  vec4 inf = texture(tI, (w - uMap0 + 0.5) / uMapN);
  float tall = step(0.5, inf.a), dens = tall > 0.5 ? (inf.a - 0.5) * 2.0 : inf.a * 2.0;
  float dist = length(w - uC);
  float alive = step(aA.z, dens) * smoothstep(uRad, uRad * 0.62, dist);
  float h = (0.2 + aA.w * 0.32) * (1.0 + tall * 0.8) * alive;
  float yaw = aB.y * 6.2832;
  vec2 side = vec2(cos(yaw), sin(yaw)) * (0.035 + tall * 0.015) * alive;
  vec3 p = vec3(w.x, hAt(w), w.y);
  float corner = aB.x;
  if (corner < 0.5) p.xz -= side; else if (corner < 1.5) p.xz += side;
  else {
    float ph = dot(w, vec2(0.21, 0.17));
    vec2 wd = vec2(sin(uTime * 1.3 + ph * 3.0) + 0.6, cos(uTime * 1.05 + ph * 2.2)) * 0.18 * uWind + (aB.zw - 0.5) * 0.5;
    p += vec3(wd.x * h, h, wd.y * h);
  }
  vT = corner > 1.5 ? 1.0 : 0.0;
  vCol = inf.rgb * (0.8 + aB.z * 0.4);
  vPos = p;
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_GRASS = GLSL_LIGHT + `
in vec3 vPos, vCol; in float vT;
out vec4 o;
void main() {
  vec3 base = vCol * (0.4 + 0.85 * vT);
  vec3 c = shade(vPos, vec3(0.0, 1.0, 0.0), base) + uSunCol * base * vT * 0.35;
  c = c / (1.0 + max(c.r, max(c.g, c.b)) * 0.45) * 1.3;
  float f = fogF(vPos);
  o = vec4(mix(c, uFogCol, f), 0.26 * (1.0 - f));
}`;
const GM = { n: 0, vao: null, tH: null, tI: null, N: 0, x0: 0, z0: 0, cx: 1e9, cz: 1e9, R: 50, rad: 24, hbuf: null, ibuf: null };
function initGrass() {
  const N = MOBILE ? 22000 : 64000, rad = MOBILE ? 19 : 26, R = rad * 2 + 2;
  GM.n = N; GM.rad = rad; GM.R = R; GM.N = Math.ceil(R + 24);
  const data = new Float32Array(N * 3 * 8), rnd = mulberry(1234);
  for (let b = 0; b < N; b++) {
    const ox = rnd() * R, oz = rnd() * R, r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd(), r5 = rnd();
    for (let k = 0; k < 3; k++) data.set([ox, oz, r1, r2, k, r3, r4, r5], (b * 3 + k) * 8);
  }
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  GM.vao = gl.createVertexArray(); gl.bindVertexArray(GM.vao);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindVertexArray(null);
  GM.tH = tex2D(GM.N, GM.N, gl.R32F, gl.RED, gl.FLOAT, gl.NEAREST);
  GM.tI = tex2D(GM.N, GM.N, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  GM.hbuf = new Float32Array(GM.N * GM.N); GM.ibuf = new Uint8Array(GM.N * GM.N * 4);
}
function updateGrassMap(force) {
  const fx = CAM.x + Math.cos(CAM.a) * 4, fz = CAM.y + Math.sin(CAM.a) * 4;
  if (!force && Math.abs(fx - GM.cx) < 9 && Math.abs(fz - GM.cz) < 9) return;
  GM.cx = Math.round(fx); GM.cz = Math.round(fz);
  const N = GM.N; GM.x0 = GM.cx - Math.floor(N / 2); GM.z0 = GM.cz - Math.floor(N / 2);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = GM.x0 + i, z = GM.z0 + j, o = j * N + i;
    GM.hbuf[o] = groundH(x, z);
    const t = tileNoGen(x, z), g = GRASSDEF[t] || GRASSDEF[0], d = chunkOf(x, z) ? g[3] * (0.75 + 0.25 * hash2(x * 3, z * 5)) : 0;
    GM.ibuf[o * 4] = g[0] * 255; GM.ibuf[o * 4 + 1] = g[1] * 255; GM.ibuf[o * 4 + 2] = g[2] * 255;
    GM.ibuf[o * 4 + 3] = (g[4] ? 0.5 + d * 0.5 : d * 0.5) * 255;
  }
  gl.bindTexture(gl.TEXTURE_2D, GM.tH); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.FLOAT, GM.hbuf);
  gl.bindTexture(gl.TEXTURE_2D, GM.tI); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RGBA, gl.UNSIGNED_BYTE, GM.ibuf);
}
function drawGrass() {
  const U = useLit(PR.grass);
  gl.uniform2f(U.uC, CAM.x + Math.cos(CAM.a) * 4, CAM.y + Math.sin(CAM.a) * 4); gl.uniform2f(U.uMap0, GM.x0, GM.z0);
  gl.uniform1f(U.uR, GM.R); gl.uniform1f(U.uRad, GM.rad); gl.uniform1f(U.uMapN, GM.N); gl.uniform1f(U.uWind, ENV.wind);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GM.tH); gl.uniform1i(U.tH, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, GM.tI); gl.uniform1i(U.tI, 1);
  gl.bindVertexArray(GM.vao); gl.drawArrays(gl.TRIANGLES, 0, GM.n * 3);
}

// ---------- point sprites: game particles + ambient (snow, fireflies, sparkles, embers, smoke, mist) ----------
const VS_PTS = `
layout(location=0) in vec4 aP;
layout(location=1) in vec4 aC;
layout(location=2) in float aK;
uniform mat4 uVP; uniform vec3 uCamPos; uniform float uPS, uFogD, uMaxPt;
out vec4 vC; out float vK;
void main() {
  vec4 cp = uVP * vec4(aP.xyz, 1.0);
  gl_Position = cp;
  gl_PointSize = clamp(aP.w * uPS / max(cp.w, 0.1), 1.0, uMaxPt);
  float dd = length(aP.xyz - uCamPos);
  vC = aC; vC.a *= exp(-pow(dd * uFogD * 0.8, 2.0));
  vK = aK;
}`;
const FS_PTS = `
in vec4 vC; in float vK;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q), a;
  if (vK < 0.5) a = smoothstep(1.0, 0.15, r);
  else if (vK < 1.5) { float cr = max(1.0 - abs(q.x) * 5.0 - abs(q.y) * 0.9, 1.0 - abs(q.y) * 5.0 - abs(q.x) * 0.9); a = clamp(cr, 0.0, 1.0) + smoothstep(0.45, 0.0, r) * 0.7; }
  else if (vK < 2.5) a = smoothstep(1.0, 0.0, r) * smoothstep(1.0, 0.4, r);
  else a = smoothstep(1.0, 0.7, r);
  a *= vC.a;
  if (a < 0.004) discard;
  o = vec4(vC.rgb, a);
}`;
const PMAX = 6000;
const PS = { add: new Float32Array(PMAX * 9), nAdd: 0, alp: new Float32Array(PMAX * 9), nAlp: 0, vboA: null, vboB: null, vaoA: null, vaoB: null };
const AMB = { snow: [], fly: [], spark: [], ember: [], smoke: [], mist: [], trail: [] };
function initParts() {
  const mk = () => { const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, PMAX * 36, gl.DYNAMIC_DRAW);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 16);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 36, 32);
    gl.bindVertexArray(null); return [vbo, vao]; };
  [PS.vboA, PS.vaoA] = mk(); [PS.vboB, PS.vaoB] = mk();
}
function pAdd(x, y, z, s, r, g, b, a, k) { if (PS.nAdd >= PMAX) return; PS.add.set([x, y, z, s, r, g, b, a, k], PS.nAdd++ * 9); }
function pAlp(x, y, z, s, r, g, b, a, k) { if (PS.nAlp >= PMAX) return; PS.alp.set([x, y, z, s, r, g, b, a, k], PS.nAlp++ * 9); }
const MOTE = (arr, n, mk) => { while (arr.length < n) arr.push(mk()); if (arr.length > n) arr.length = n; };
function stepAmbient(dt) {
  const d = S.darkness, b = S.curBiome, fx = CAM.x + Math.cos(CAM.a) * 8, fz = CAM.y + Math.sin(CAM.a) * 8;
  const run = S.mode !== 'paused' && S.mode !== 'inv' && S.mode !== 'shop';
  const dd = run ? dt : 0;
  // snowfall
  const ns = b === B_SNOW ? (MOBILE ? 380 : 900) : 0;
  MOTE(AMB.snow, ns, () => ({ x: fx + rr(-26, 26), y: rr(0, 16), z: fz + rr(-26, 26), v: rr(1.2, 2.6), s: rr(0.05, 0.12), p: rr(0, TAU) }));
  for (const f of AMB.snow) {
    f.y -= f.v * dd; f.x += (Math.sin(S.t * 0.9 + f.p) * 0.6 - 0.8) * dd; f.z += Math.cos(S.t * 0.7 + f.p) * 0.4 * dd;
    const gy = camGH - 3; if (f.y < gy) { f.y = gy + 17; f.x = fx + rr(-26, 26); f.z = fz + rr(-26, 26); }
    if (f.x < fx - 27) f.x += 54; if (f.x > fx + 27) f.x -= 54; if (f.z < fz - 27) f.z += 54; if (f.z > fz + 27) f.z -= 54;
    pAlp(f.x, f.y, f.z, f.s, 0.92, 0.95, 1, 0.85, 3);
  }
  // fireflies at night over grass
  const nf = d > 0.5 && b !== B_SNOW && b !== B_DESERT ? (MOBILE ? 150 : 220) : 0;
  MOTE(AMB.fly, nf, () => { const c = AMB.fly.length % 5 ? AMB.fly[AMB.fly.length - 1] : null; return c ? { x: c.x + rr(-0.9, 0.9), z: c.z + rr(-0.9, 0.9), h: rr(0.1, 0.7), p: rr(0, TAU), q: rr(0.5, 1.5) } : { x: P.x + rr(-20, 20), z: P.y + rr(-20, 20), h: rr(0.1, 0.8), p: rr(0, TAU), q: rr(0.5, 1.5) }; });
  for (const f of AMB.fly) {
    f.x += Math.sin(S.t * 0.7 * f.q + f.p) * 0.5 * dd; f.z += Math.cos(S.t * 0.6 * f.q + f.p * 1.3) * 0.5 * dd;
    if (Math.hypot(f.x - P.x, f.z - P.y) > 22) { f.x = P.x + rr(-18, 18); f.z = P.y + rr(-18, 18); }
    const t = tileNoGen(f.x, f.z), g = GRASSDEF[t]; if (!g || g[3] < 0.3) continue;
    const bl = Math.max(0, Math.sin(S.t * 1.7 * f.q + f.p * 3)), a = (0.25 + 0.75 * bl) * clamp(d * 2 - 1, 0, 1);
    const fy = groundH(f.x, f.z) + f.h + Math.sin(S.t * 2 + f.p) * 0.1;
    pAdd(f.x, fy, f.z, 0.085, 0.6, 0.85, 1.0, Math.min(1, a * 1.5), 0); pAdd(f.x, fy, f.z, 0.42, 0.25, 0.45, 1.0, a * 0.4, 0);
  }
  // sparkles: water glints, drifting motes
  const nsp = MOBILE ? 60 : 120;
  MOTE(AMB.spark, nsp, () => ({ x: fx + rr(-18, 18), z: fz + rr(-18, 18), h: rr(0, 3.5), t: rr(0, 2), l: rr(0.6, 2.0) }));
  for (const s of AMB.spark) {
    s.t += dd; if (s.t > s.l) { s.t = 0; s.x = fx + rr(-18, 18); s.z = fz + rr(-18, 18); s.h = rr(0, 3.5); }
    const t = tileNoGen(s.x, s.z), wet = t === T_WATER || t === T_ICE || t === T_SNOW || t === T_DRIFT;
    const k = Math.sin(s.t / s.l * Math.PI);
    if (wet) pAdd(s.x, (t === T_WATER ? WATER_Y + 0.05 : groundH(s.x, s.z) + 0.1) + s.h * 0.05, s.z, 0.32, 1, 1, 1, k * 0.95, 1);
    else if (s.h > 1.6 || d > 0.5) pAdd(s.x, groundH(s.x, s.z) + 0.3 + s.h * 0.8, s.z, 0.2 + s.h * 0.03, 0.92, 0.95, 1, k * (0.25 + d * 0.6), 1);
  }
  // campfire embers + chimney smoke + village mist
  for (const g of GCH.values()) {
    if (Math.abs(g.cx * CS + 16 - CAM.x) > 60 || Math.abs(g.cy * CS + 16 - CAM.y) > 60) continue;
    for (const o of g.fires) if (run && Math.random() < dt * 14) AMB.ember.push({ x: o.x + rr(-0.3, 0.3), y: groundH(o.x, o.y) + 0.6, z: o.y + rr(-0.3, 0.3), vx: rr(-0.3, 0.3), vy: rr(1.2, 2.6), vz: rr(-0.3, 0.3), t: rr(0.8, 1.6) });
    for (const o of g.houses) if (run && o.v !== 'sand' && Math.random() < dt * 2.2) {
      const yw = yawOf(o.rot), cx = 1.35, cz = -0.45, wx = o.x + cx * Math.cos(yw) + cz * Math.sin(yw), wz = o.y - cx * Math.sin(yw) + cz * Math.cos(yw);
      AMB.smoke.push({ x: wx, y: groundH(o.x, o.y) + 4.9, z: wz, vx: rr(0.1, 0.4), vy: rr(0.6, 1.0), vz: rr(-0.2, 0.2), t: 0, l: rr(3, 5), s: rr(0.6, 0.9) });
    }
  }
  if (hasTorch() && S.mode !== 'title' && run && Math.random() < dt * 18 && TORCH_TIP) AMB.ember.push({ x: TORCH_TIP[0] + rr(-0.05, 0.05), y: TORCH_TIP[1] + 0.15, z: TORCH_TIP[2] + rr(-0.05, 0.05), vx: rr(-0.2, 0.2), vy: rr(0.8, 1.8), vz: rr(-0.2, 0.2), t: rr(0.4, 0.9) });
  for (let i = AMB.ember.length - 1; i >= 0; i--) { const e = AMB.ember[i]; e.t -= dd; if (e.t <= 0) { AMB.ember.splice(i, 1); continue; } e.x += e.vx * dd; e.y += e.vy * dd; e.z += e.vz * dd; e.vx += Math.sin(S.t * 5 + i) * dd;
    pAdd(e.x, e.y, e.z, 0.06, 1, 0.55 + e.t * 0.3, 0.2, Math.min(1, e.t * 1.6), 0); }
  if (AMB.ember.length > 400) AMB.ember.splice(0, AMB.ember.length - 400);
  for (let i = AMB.smoke.length - 1; i >= 0; i--) { const s = AMB.smoke[i]; s.t += dd; if (s.t >= s.l) { AMB.smoke.splice(i, 1); continue; } s.x += s.vx * dd; s.y += s.vy * dd; s.z += s.vz * dd;
    const k = s.t / s.l, c = 0.45 + (1 - d) * 0.25; pAlp(s.x, s.y, s.z, s.s * (1 + k * 2.5), c, c, c * 1.05, 0.3 * (1 - k) * Math.min(1, s.t * 3), 2); }
  if (AMB.smoke.length > 300) AMB.smoke.splice(0, AMB.smoke.length - 300);
  // mist banks over water, bog and low ground
  const nm = (b === B_SWAMP ? 56 : 28) * (MOBILE ? 0.6 : 1) | 0;
  MOTE(AMB.mist, nm, () => ({ x: fx + rr(-34, 34), z: fz + rr(-30, 38), t: rr(0, 12), l: rr(9, 16), s: rr(4, 9), v: rr(-0.3, 0.3) }));
  const fc = ENV.fog;
  for (const m of AMB.mist) {
    m.t += dd; m.x += (0.35 + m.v) * dd;
    if (m.t > m.l || Math.abs(m.x - fx) > 40 || Math.abs(m.z - fz) > 42) { m.t = 0; m.x = fx + rr(-34, 34); m.z = fz + rr(-30, 38); m.l = rr(9, 16); }
    const t = tileNoGen(m.x, m.z), gh = groundH(m.x, m.z), wet = t === T_WATER || t === T_BOG || t === T_MARSH || t === T_MUD || b === B_SWAMP;
    if (!wet && gh > 0.6 + d * 1.5) continue;
    const k = Math.sin(m.t / m.l * Math.PI), a = (wet ? 0.5 : 0.32) * k * (b === B_SWAMP ? 1.15 : 1), mc = mix3(fc, [0.68, 0.74, 0.84], 0.75 - d * 0.2);
    const y0 = Math.max(gh, WATER_Y);
    mistAt(m.x, y0 + 0.35, m.z, m.s, mc, a * 0.8); mistAt(m.x + 1.2, y0 + 1.1, m.z - 0.8, m.s * 0.8, mc, a * 0.6);
  }
}
function pushGameParticles() {
  for (const p of S.parts) {
    const em = p.em || p.col.charCodeAt(0) === 33, c = hexC(p.col), ch = p.ch, y = groundH(p.x, p.y) + p.elev;
    const k = Math.min(1, p.t * 3);
    if (ch === '*' || ch === '+') { if (em) pAdd(p.x, y, p.y, 0.3, c[0], c[1], c[2], k, 1); else pAlp(p.x, y, p.y, 0.14, c[0], c[1], c[2], k, 0); }
    else if (ch === '^' || ch === '&' || ch === "'") pAdd(p.x, y, p.y, 0.22, c[0], c[1], c[2], k, 0);
    else if (ch === '~' || ch === '-' || ch === '=') pAlp(p.x, y, p.y, 0.5, c[0], c[1], c[2], k * 0.5, 2);
    else if (em) pAdd(p.x, y, p.y, 0.16, c[0], c[1], c[2], k, 0);
    else pAlp(p.x, y, p.y, ch === 'o' || ch === 'O' || ch === '@' ? 0.16 : 0.1, c[0], c[1], c[2], k, 3);
  }
  for (const p of S.projs) {
    if (p.kind === 'fire') { const y = groundH(p.x, p.y) + p.elev; if (Math.random() < 0.7) AMB.ember.push({ x: p.x, y, z: p.y, vx: rr(-0.4, 0.4), vy: rr(0, 0.6), vz: rr(-0.4, 0.4), t: rr(0.2, 0.5) }); pAdd(p.x, y, p.y, 1.4, 1, 0.45, 0.12, 0.45, 0); }
    if (p.kind === 'pball') pAdd(p.x, groundH(p.x, p.y) + p.elev, p.y, 0.35, 1, 0.9, 0.5, 0.8, 0);
  }
  for (const d of S.drops) if (d.kind !== 'gold' && ((S.t * 2 + d.x) % 2) < 0.6) pAdd(d.x + 0.1, groundH(d.x, d.y) + 0.7, d.y, 0.35, 1, 0.95, 0.7, 0.9, 1);
  for (const e of S.ents) if (!e.dead && e.k.unholy && Math.random() < 0.3) { const y = groundH(e.x, e.y) + e.elev; if (e.kind === 'witch') pAdd(e.x + rr(-0.4, 0.4), y + rr(0.2, 1.8), e.y + rr(-0.4, 0.4), 0.12, 0.5, 1, 0.35, 0.8, 0); }
}
function drawParticles() {
  const U = PR.pts.U; gl.useProgram(PR.pts.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform3fv(U.uCamPos, CAM.eye); gl.uniform1f(U.uFogD, ENV.fogD);
  gl.uniform1f(U.uPS, SH / (2 * Math.tan(CAM.fovY / 2))); gl.uniform1f(U.uMaxPt, PTMAX);
  gl.enable(gl.BLEND); gl.depthMask(false);
  if (PS.nAlp) {
    gl.blendColor(0, 0, 0, 0.3); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, PS.vboB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PS.alp, 0, PS.nAlp * 9);
    gl.bindVertexArray(PS.vaoB); gl.drawArrays(gl.POINTS, 0, PS.nAlp);
  }
  if (PS.nAdd) {
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, PS.vboA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PS.add, 0, PS.nAdd * 9);
    gl.bindVertexArray(PS.vaoA); gl.drawArrays(gl.POINTS, 0, PS.nAdd);
  }
  gl.disable(gl.BLEND); gl.depthMask(true);
}
let PTMAX = 256;

// ---------- blob shadows ----------
const VS_SHAD = `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aS;
layout(location=2) in vec3 aN;
uniform mat4 uVP;
out vec2 vQ;
void main() {
  vec3 n = normalize(aN);
  vec3 t = normalize(cross(n, vec3(0.0, 0.0, 1.0))), b = cross(t, n);
  vec3 p = aS.xyz + (t * aQ.x + b * aQ.y) * aS.w + n * 0.06;
  vQ = aQ; gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_SHAD = `
in vec2 vQ; uniform float uK; out vec4 o;
void main() { float r = length(vQ); float a = smoothstep(1.0, 0.25, r) * uK; if (a < 0.01) discard; o = vec4(0.0, 0.0, 0.0, a); }`;
const SHD = { buf: new Float32Array(1024 * 7), n: 0, vbo: null, vao: null };
const VS_MIST = `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aS;
layout(location=2) in vec4 aC;
uniform mat4 uVP; uniform vec3 uCamPos; uniform float uFogD;
out vec2 vQ; out vec4 vC; out vec2 vW;
void main() {
  vec3 p = aS.xyz + vec3(aQ.x, 0.0, aQ.y) * aS.w;
  vQ = aQ; vC = aC; vW = p.xz;
  float dd = length(p - uCamPos); vC.a *= exp(-pow(dd * uFogD * 0.7, 2.0));
  gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_MIST = `
in vec2 vQ, vW; in vec4 vC; uniform float uTime; out vec4 o;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float r = length(vQ);
  float n = vn(vW * 0.35 + vec2(uTime * 0.12, 0.0)) * 0.6 + vn(vW * 0.9 - vec2(0.0, uTime * 0.2)) * 0.4;
  float a = smoothstep(1.0, 0.1, r) * (0.35 + 0.9 * n) * vC.a;
  if (a < 0.004) discard;
  o = vec4(vC.rgb, a);
}`;
const MST = { buf: new Float32Array(256 * 8), n: 0, vbo: null, vao: null };
function initMist() {
  MST.vao = gl.createVertexArray(); gl.bindVertexArray(MST.vao);
  const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  MST.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, MST.vbo); gl.bufferData(gl.ARRAY_BUFFER, MST.buf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
}
function mistAt(x, y, z, r, c, a) { if (MST.n >= 256) return; MST.buf.set([x, y, z, r, c[0], c[1], c[2], a], MST.n++ * 8); }
function drawMist() {
  if (!MST.n) return;
  const U = PR.mist.U; gl.useProgram(PR.mist.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform3fv(U.uCamPos, CAM.eye); gl.uniform1f(U.uFogD, ENV.fogD); gl.uniform1f(U.uTime, S.t);
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendColor(0, 0, 0, 0.3); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindBuffer(gl.ARRAY_BUFFER, MST.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, MST.buf, 0, MST.n * 8);
  gl.bindVertexArray(MST.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, MST.n);
  gl.disable(gl.BLEND); gl.depthMask(true);
}
function initShadows() {
  SHD.vao = gl.createVertexArray(); gl.bindVertexArray(SHD.vao);
  const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  SHD.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SHD.vbo); gl.bufferData(gl.ARRAY_BUFFER, SHD.buf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 0); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 16); gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
}
function shadowAt(x, z, r) {
  if (SHD.n >= 1024) return;
  const h = groundH(x, z), hx = groundH(x + 0.5, z) - groundH(x - 0.5, z), hz = groundH(x, z + 0.5) - groundH(x, z - 0.5);
  SHD.buf.set([x, h, z, r, -hx, 1, -hz], SHD.n++ * 7);
}
function drawShadows() {
  if (!SHD.n) return;
  const U = PR.shad.U; gl.useProgram(PR.shad.p); gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform1f(U.uK, 0.5 - S.darkness * 0.25);
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
  gl.bindBuffer(gl.ARRAY_BUFFER, SHD.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, SHD.buf, 0, SHD.n * 7);
  gl.bindVertexArray(SHD.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, SHD.n);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND); gl.depthMask(true);
}

// ---------- actors: appearance -> rigged mesh, state -> pose -> bone matrices ----------
const BONES = new Float32Array(18 * 16), BW = [], TMPM = m4(), TMPM2 = m4(), MODELM = m4(), RIDERM = m4();
for (let i = 0; i < 18; i++) BW.push(m4());
function boneLocal(o, piv, k, yaw, pitch, roll, ox, oy, oz) {
  m4trs(o, 0, 0, 0, yaw || 0, pitch || 0, roll || 0, 1);
  const px = piv[0] * k, py = piv[1] * k, pz = piv[2] * k;
  o[12] = px + (ox || 0) - (o[0] * px + o[4] * py + o[8] * pz);
  o[13] = py + (oy || 0) - (o[1] * px + o[5] * py + o[9] * pz);
  o[14] = pz + (oz || 0) - (o[2] * px + o[6] * py + o[10] * pz);
  return o;
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
// arm pose name -> [pitch, yaw(signed by side), roll(outward)]
function armPose(name, u, side, ph, spd) {
  switch (name) {
    case 'atk': { const e = ease(clamp(u, 0, 1)); return [lerp(-2.7, -0.45, e), side * lerp(-0.75, 0.85, e), 0.05]; }
    case 'punch': { const e = Math.sin(clamp(u, 0, 1) * Math.PI); return [-0.25 - 1.3 * e, side * 0.25 * e, -0.05]; }
    case 'block': return [-1.2, -side * 1.3, 0.0];
    case 'aim': return [-1.5, -side * 0.12, 0];
    case 'draw': return side > 0 ? [-1.52, -0.12, 0] : [-1.4, -0.62, 0];
    case 'claw': return [-1.25 - Math.sin(u * Math.PI) * 0.4, side * 0.1, 0.4];
    case 'up': return [-2.75, 0, 0.35];
    case 'torch': return [-0.72 + Math.sin(ph) * 0.05 * spd, 0, 0.12];
    case 'pike': return [-1.3 - Math.sin(clamp(u, 0, 1) * Math.PI) * 0.15, side * 0.05, 0.05];
    case 'raise': return [lerp(-0.6, -3.0, ease(clamp(u, 0, 1))), side * 0.1, 0.2];
    case 'ride': return [-0.5, side * 0.1, 0.12];
    default: return [Math.sin(ph) * 0.55 * spd * -side * 0.9 - 0.05, 0, 0.08 + (1 - spd) * 0.04];
  }
}
// o: { k(scale), ph, spd, L, R, uL, uR, flinch, ride, sit, lean, cape, breath }
function computeHumanBones(o) {
  const k = o.k || 1, ph = o.ph || 0, spd = o.spd || 0;
  for (const m of BW) m.set(UNITM);
  const bob = Math.abs(Math.sin(ph)) * 0.05 * spd * k + (o.breath || 0);
  boneLocal(BW[BN.hips], PIV[BN.hips], k, Math.sin(ph) * 0.08 * spd, 0, 0, 0, bob, 0);
  const tw = (o.uR >= 0 && o.R === 'atk' ? lerp(-0.35, 0.45, ease(o.uR)) : 0) - (o.L === 'draw' ? 0.25 : 0);
  boneLocal(TMPM, PIV[BN.torso], k, tw, (o.lean || 0) + spd * 0.1 - (o.flinch || 0) * 0.35, 0); m4mul(BW[BN.torso], BW[BN.hips], TMPM);
  boneLocal(TMPM, PIV[BN.head], k, -tw * 0.5, -(o.flinch || 0) * 0.25 + (o.nod || 0), 0); m4mul(BW[BN.head], BW[BN.torso], TMPM);
  for (const side of [1, -1]) {
    const nm = side > 0 ? o.L : o.R, u = side > 0 ? o.uL : o.uR, a = armPose(nm, u, side, ph, spd);
    boneLocal(TMPM, PIV[side > 0 ? BN.armL : BN.armR], k, a[1], a[0], side * a[2]); m4mul(BW[side > 0 ? BN.armL : BN.armR], BW[BN.torso], TMPM);
    let lp = Math.sin(ph) * 0.62 * spd * side, lr = 0;
    if (o.ride) { lp = -0.95; lr = side * 0.42; } else if (o.sit) { lp = -1.35; lr = side * 0.12; }
    boneLocal(TMPM, PIV[side > 0 ? BN.legL : BN.legR], k, 0, lp, lr); m4mul(BW[side > 0 ? BN.legL : BN.legR], BW[BN.hips], TMPM);
  }
  boneLocal(TMPM, PIV[BN.cape], k, 0, 0.12 + (o.cape || 0) + Math.sin(S.t * 3.1 + ph) * 0.05 * (0.4 + spd), 0); m4mul(BW[BN.cape], BW[BN.torso], TMPM);
  for (let i = 0; i < 18; i++) BONES.set(BW[i], i * 16);
}
function computeHorseBones(ps, spd) {
  for (const m of BW) m.set(UNITM);
  const g = spd;
  boneLocal(BW[BN.hbody], PIV[BN.hbody], 1, 0, Math.sin(ps * 2) * 0.05 * g, 0, 0, Math.abs(Math.sin(ps)) * 0.12 * g, 0);
  const legs = [[BN.hFL, 0], [BN.hFR, 0.7], [BN.hBL, Math.PI], [BN.hBR, Math.PI + 0.7]];
  for (const [b, o] of legs) { boneLocal(TMPM, PIV[b], 1, 0, Math.sin(ps + o) * 0.75 * g, 0); m4mul(BW[b], BW[BN.hbody], TMPM); }
  boneLocal(TMPM, PIV[BN.hneck], 1, 0, -Math.sin(ps * 2) * 0.12 * g + Math.sin(S.t * 0.8) * 0.04 * (1 - g), 0); m4mul(BW[BN.hneck], BW[BN.hbody], TMPM);
  boneLocal(TMPM, PIV[BN.htail], 1, Math.sin(S.t * 1.3) * 0.2, 0.25 + g * 0.6, 0); m4mul(BW[BN.htail], BW[BN.hbody], TMPM);
  for (let i = 0; i < 18; i++) BONES.set(BW[i], i * 16);
}
let MESHU = null;
function drawRig(mesh, model, tint, tintA) {
  const U = MESHU;
  gl.uniformMatrix4fv(U.uModel, false, model); gl.uniformMatrix4fv(U.uBones, false, BONES);
  if (tintA) { gl.uniform3fv(U.uTint, tint); gl.uniform1f(U.uTintA, tintA); }
  gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  if (tintA) gl.uniform1f(U.uTintA, 0);
}
function humanMesh(key, spec) { return namedMesh('H|' + key, () => buildHuman(spec)); }
function horseMesh(key, o) { return namedMesh('Hs|' + key, () => buildHorse(o)); }
const PLAYER_CAPE = { cape: '#7a1814', capeIn: '#4a0c0c' };
function playerSpec() {
  const look = ARMOR_LOOK[P.armor] || ARMOR_LOOK.tunic;
  const two = twoHanded() ? ITEMS[P.hands[1]] : null;
  let L = null, R = null;
  if (two) { if (two.type === 'bow') L = itemSpec(two.id); else R = itemSpec(two.id); }
  else { L = itemSpec(P.hands[0]); R = itemSpec(P.hands[1]); }
  return Object.assign({ skin: '#d8a882', hair: '#4a2e18' }, look, PLAYER_CAPE, { L, R });
}
function handPose(id, s, anim, blocking, drawing) {
  const it = id && ITEMS[id];
  if (anim > 0) { if (!it) return ['punch', 1 - anim / 0.18]; if (it.type === 'gun') return ['aim', 0]; return ['atk', 1 - anim / (it.type === 'sword2' ? 0.3 : 0.22)]; }
  if (it && it.type === 'shield' && blocking) return ['block', 0];
  if (it && it.type === 'torch') return ['torch', 0];
  return ['idle', 0];
}
let TORCH_TIP = null;
const TIPV = [0, 0, 0];
function handPoint(boneM, model, side, lx, ly, lz) {
  const b = boneM, x = side * 0.25 + lx, y = 0.8 + ly, z = 0.03 + lz;
  const bx = b[0] * x + b[4] * y + b[8] * z + b[12], by = b[1] * x + b[5] * y + b[9] * z + b[13], bz = b[2] * x + b[6] * y + b[10] * z + b[14];
  return [model[0] * bx + model[4] * by + model[8] * bz + model[12], model[1] * bx + model[5] * by + model[9] * bz + model[13], model[2] * bx + model[6] * by + model[10] * bz + model[14]];
}
function drawPlayer() {
  const spec = playerSpec(), m = P.mounted, dying = S.mode === 'dying' || S.mode === 'over';
  const key = 'P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-');
  const mesh = humanMesh(key, spec), gh = groundH(P.x, P.y), yaw = yawOf(P.a);
  const two = twoHanded() ? ITEMS[P.hands[1]] : null;
  let L = 'idle', R = 'idle', uL = 0, uR = 0;
  if (two) { if (two.type === 'bow') { if (P.drawing) L = R = 'draw'; } else if (P.anim[0] > 0 || P.anim[1] > 0) { R = 'atk'; uR = 1 - Math.max(P.anim[0], P.anim[1]) / 0.3; } }
  else { [L, uL] = handPose(P.hands[0], 1, P.anim[0], P.blocking, P.drawing); [R, uR] = handPose(P.hands[1], -1, P.anim[1], P.blocking, P.drawing); }
  const spd = clamp(Math.abs(P.v) / 4.9, 0, 1), ph = P.step * 2.3;
  const flinch = P.hurtT > 0 ? P.hurtT / 0.3 : 0;
  const tint = P.hurtT > 0 && ((S.t * 20) | 0) % 2 ? [1, 0.3, 0.2] : null;
  if (m) {
    const hs = clamp(Math.abs(P.v) / 10.5, 0, 1), ps = P.step * 1.05;
    computeHorseBones(ps, hs);
    m4trs(MODELM, P.x, gh, P.y, yaw, 0, 0, 1);
    drawRig(horseMesh('player', { coat: '#7a4e2c', dark: '#1e140c', saddle: true, cloth: '#2a4ea0', blaze: true }), MODELM);
    const body = BW[BN.hbody];
    m4mul(TMPM2, MODELM, body); m4trs(TMPM, 0, 0.7, -0.02, 0, 0, 0, 1); m4mul(RIDERM, TMPM2, TMPM);
    computeHumanBones({ ph: 0, spd: 0, L: L === 'idle' ? 'ride' : L, R: R === 'idle' ? 'ride' : R, uL, uR, ride: true, flinch, cape: 0.25 + hs * 0.9, lean: hs * 0.15 });
    drawRig(mesh, RIDERM, tint || [0, 0, 0], tint ? 0.6 : 0);
    TORCH_TIP = hasTorch() ? handPoint(BW[P.hands[0] === 'torch' ? BN.armL : BN.armR], RIDERM, P.hands[0] === 'torch' ? 1 : -1, 0, -0.06, 0.8) : null;
    shadowAt(P.x, P.y, 1.25);
    return;
  }
  computeHumanBones({ ph, spd, L, R, uL, uR, flinch, cape: spd * 0.7, breath: Math.sin(S.t * 2) * 0.006 });
  m4trs(MODELM, P.x, gh + (dying ? 0.15 : 0), P.y, yaw, dying ? -Math.PI / 2 : 0, 0, 1);
  drawRig(mesh, MODELM, tint || [0, 0, 0], tint ? 0.6 : 0);
  TORCH_TIP = hasTorch() && !dying ? handPoint(BW[P.hands[0] === 'torch' ? BN.armL : BN.armR], MODELM, P.hands[0] === 'torch' ? 1 : -1, 0, -0.06, 0.8) : null;
  shadowAt(P.x, P.y, 0.62);
}
function entSpec(kind) {
  if (GIANTS[kind]) return Object.assign({ giant: true, scale: 3.0, hat: null }, GIANTS[kind]);
  return HUMANS[kind] || HUMANS.soldier;
}
function drawEnt(e) {
  const kind = e.kind, gh = groundH(e.x, e.y), yaw = yawOf(e.a);
  const tint = e.hurtT > 0 ? [1, 1, 1] : e.burnT > 0 && ((S.t * 12) | 0) % 2 ? [1, 0.5, 0.15] : null, ta = e.hurtT > 0 ? 0.75 : 0.45;
  e._ph = (e._ph || e.seed || 0) + (e.moving ? 1 : 0) * (kind === 'vampire' ? 13 : kind === 'dragoon' ? 9 : GIANTS[kind] ? 3.2 : 8.5) * (RDT || 0.016);
  const spd = e.moving && kind !== 'witch' ? 1 : 0;
  if (kind === 'dragoon') {
    m4trs(MODELM, e.x, gh, e.y, yaw, 0, 0, 1);
    computeHorseBones(e._ph, spd);
    drawRig(horseMesh('dragoon', { coat: '#3a281c', dark: '#140c08', saddle: true, cloth: '#8a2420', stockings: true }), MODELM, tint, tint ? ta : 0);
    m4mul(TMPM2, MODELM, BW[BN.hbody]); m4trs(TMPM, 0, 0.7, -0.02, 0, 0, 0, 1); m4mul(RIDERM, TMPM2, TMPM);
    const atk = e.state === 'wind' || e.passT > 0.8;
    computeHumanBones({ ride: true, L: 'ride', R: atk ? 'atk' : 'ride', uR: atk ? (S.t * 3 % 1) : 0, cape: 0.3 });
    drawRig(humanMesh('dragoonR', Object.assign({}, HUMANS.soldier, { tallBoots: true, gaiters: null })), RIDERM, tint, tint ? ta : 0);
    shadowAt(e.x, e.y, 1.3);
    return;
  }
  const spec = entSpec(kind), k = GIANTS[kind] ? 3.0 : 1;
  const mesh = humanMesh(kind, spec);
  let L = 'idle', R = 'idle', uL = 0, uR = 0;
  const st = e.state, w = e.k.wind || 1, u = clamp(1 - (e.wt || 0) / w, 0, 1);
  if (kind === 'pikeman') R = 'pike';
  if (kind === 'archer') L = 'idle';
  if (st === 'wind') { if (kind === 'vampire') { L = R = 'claw'; uL = uR = u; } else if (kind === 'pikeman') { R = 'pike'; uR = u; } else { R = 'atk'; uR = u; } }
  else if (st === 'aim') { if (kind === 'archer') L = R = 'draw'; else R = 'aim'; }
  else if (st === 'cast') { L = R = 'up'; }
  else if (st === 'slam') { L = R = 'raise'; uL = uR = u; }
  else if (st === 'throw') { R = 'raise'; uR = u; }
  else if (kind === 'guard' && e.post && !e.moving) { L = 'block'; }
  const down = e.downT > 0;
  computeHumanBones({ k, ph: e._ph, spd: down ? 0 : spd, L, R, uL, uR, flinch: e.hurtT > 0 ? 1 : 0, sit: kind === 'witch', cape: spd * 0.6, breath: Math.sin(S.t * 2 + e.seed) * 0.006 * k });
  const lift = kind === 'witch' ? e.elev + Math.sin(S.t * 2 + e.seed) * 0.12 - 0.2 : e.elev;
  m4trs(MODELM, e.x, gh + lift + (down ? 0.15 : 0), e.y, yaw, down ? -Math.PI / 2 : 0, 0, 1);
  drawRig(mesh, MODELM, tint, tint ? ta : 0);
  if (st === 'throw' && GIANTS[kind]) {
    const hp = handPoint(BW[BN.armR], MODELM, -1, 0, -0.1, 0.0);
    m4trs(TMPM, hp[0], hp[1], hp[2], S.t, 0.3, 0, 1); drawPlain(namedMesh(e.k.frost ? 'boulderF' : 'boulder', () => mkBoulderM(e.k.frost)), TMPM);
  }
  shadowAt(e.x, e.y, (e.r + 0.2) * (kind === 'witch' ? 0.7 : 1));
}
function drawPlain(mesh, model, tint, ta) {
  const U = MESHU; gl.uniform1i(U.uMode, 0);
  gl.uniformMatrix4fv(U.uModel, false, model);
  if (ta) { gl.uniform3fv(U.uTint, tint); gl.uniform1f(U.uTintA, ta); }
  gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  if (ta) gl.uniform1f(U.uTintA, 0);
  gl.uniform1i(U.uMode, 2);
}
const CORPSE_KIND = { R: 'soldier', B: 'ally', N: 'bandit', H: 'dragoon', G: 'giant', F: 'frostgiant' };
function drawCorpse(c) {
  const kind = CORPSE_KIND[c.c] || 'soldier', gh = groundH(c.x, c.y), yaw = hash2(Math.round(c.x * 9), Math.round(c.y * 9)) * TAU;
  if (kind === 'dragoon') { computeHorseBones(0, 0); m4trs(MODELM, c.x, gh + 0.25, c.y, yaw, 0, Math.PI / 2, 1); drawRig(horseMesh('dragoon', { coat: '#3a281c', dark: '#140c08', saddle: true, cloth: '#8a2420', stockings: true }), MODELM, [0.1, 0.08, 0.06], 0.25); return; }
  const k = GIANTS[kind] ? 3 : 1;
  computeHumanBones({ k, L: 'idle', R: 'idle' });
  m4trs(MODELM, c.x, gh + 0.14 * k, c.y, yaw, -Math.PI / 2, 0, 1);
  drawRig(humanMesh(kind, entSpec(kind)), MODELM, [0.1, 0.08, 0.06], 0.25);
}
function drawHorseFree() {
  const h = S.horse, mv = h.state === 'coming' || h.state === 'flee';
  h._ph = (h._ph || 0) + (mv ? 9 : 0) * (RDT || 0.016);
  computeHorseBones(h._ph, mv ? 1 : 0);
  m4trs(MODELM, h.x, groundH(h.x, h.y), h.y, yawOf(h.a), 0, 0, 1);
  drawRig(horseMesh('player', { coat: '#7a4e2c', dark: '#1e140c', saddle: true, cloth: '#2a4ea0', blaze: true }), MODELM);
  shadowAt(h.x, h.y, 1.25);
}

// ---------- frame ----------
let RDT = 0.016;
function drawStaticsAndTerrain(U) {
  // terrain
  gl.uniform1i(U.uMode, 0); gl.uniform1i(U.uMat, 1); gl.uniformMatrix4fv(U.uModel, false, UNITM);
  const vis = [];
  for (const g of GCH.values()) {
    const cx = g.cx * CS + 16, cz = g.cy * CS + 16;
    if ((cx - CAM.x) ** 2 + (cz - CAM.y) ** 2 > 140 * 140) continue;
    if (!inView(cx, g.hmid + 2, cz, 25 + g.hr)) continue;
    g.dist = Math.hypot(cx - CAM.eye[0], cz - CAM.eye[2]);
    vis.push(g);
    gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, 32 * 32 * 6, gl.UNSIGNED_SHORT, 0);
  }
  gl.uniform1i(U.uMat, 2);
  for (const g of vis) if (g.water) { gl.bindVertexArray(g.water.vao); gl.drawArrays(gl.TRIANGLES, 0, g.water.n); }
  gl.uniform1i(U.uMat, 0);
  // instanced scenery
  gl.uniform1i(U.uMode, 1);
  const lod = MOBILE ? 34 : 46;
  for (const g of vis) for (const s of g.inst) {
    if (g.dist - 23 > s.small) continue;
    if (s.far && g.dist > lod) { gl.bindVertexArray(s.far); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.fmesh.n, s.n); }
    else { gl.bindVertexArray(s.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.mesh.n, s.n); }
  }
  gl.uniform1i(U.uMode, 0);
  for (const g of vis) for (const o of g.chests) { m4trs(TMPM, o.x, groundH(o.x, o.y), o.y, hash2(o.x | 0, o.y | 0) * TAU, 0, 0, 1); const mesh = staticMesh(S.looted.has(o.id) ? 'chestopen' : 'chest'); gl.uniformMatrix4fv(U.uModel, false, TMPM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n); }
  // tree / rock blob shadows near the camera
  for (const g of vis) {
    if (Math.abs(g.cx * CS + 16 - CAM.x) > 48 || Math.abs(g.cy * CS + 16 - CAM.y) > 48) continue;
    for (const o of g.c.statics) { if ((o.x - CAM.x) ** 2 + (o.y - CAM.y) ** 2 > 1600) continue; if (o.type === 'pine' || o.type === 'snowpine' || o.type === 'oak') shadowAt(o.x, o.y, o.type === 'oak' ? 2.2 : 1.6); else if (o.type === 'bush' || o.type === 'rock') shadowAt(o.x, o.y, 0.8); }
  }
  return vis;
}
function drawActors(U) {
  gl.uniform1i(U.uMode, 2);
  for (const e of S.ents) { if (e.dead) continue; const gh = groundH(e.x, e.y); if (!inView(e.x, gh + 1, e.y, GIANTS[e.kind] ? 4 : 1.8)) continue; drawEnt(e); }
  for (const c of S.corpses) if (inView(c.x, groundH(c.x, c.y), c.y, 3)) drawCorpse(c);
  if (!P.mounted && S.mode !== 'title' && inView(S.horse.x, groundH(S.horse.x, S.horse.y) + 1, S.horse.y, 2)) drawHorseFree();
  if (S.mode !== 'title') drawPlayer(); else TORCH_TIP = null;
  gl.uniform1i(U.uMode, 0);
  for (const d of S.drops) {
    const gh = groundH(d.x, d.y); if (!inView(d.x, gh, d.y, 1)) continue;
    const bob = 0.12 + Math.sin(S.t * 3 + d.x) * 0.06;
    m4trs(TMPM, d.x, gh + bob, d.y, S.t * 1.4 + d.x, 0, 0, 1);
    gl.uniformMatrix4fv(U.uModel, false, TMPM);
    const mesh = d.kind === 'gold' ? namedMesh('coins', mkCoinsM) : namedMesh('loot|' + d.id, () => mkLootM(d.id));
    gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    shadowAt(d.x, d.y, 0.4);
  }
  for (const p of S.projs) {
    const gh = groundH(p.x, p.y), y = gh + p.elev, a = Math.atan2(p.vy, p.vx);
    let mesh;
    if (p.kind === 'arrow') { mesh = namedMesh('arrow', mkArrowM); m4trs(TMPM, p.x, y, p.y, yawOf(a), -(p.vz || 0) * 0.04, 0, 1); }
    else if (p.kind === 'boulder') { mesh = namedMesh(p.frost ? 'boulderF' : 'boulder', () => mkBoulderM(p.frost)); m4trs(TMPM, p.x, y, p.y, S.t * 3, S.t * 5, 0, 1); shadowAt(p.x, p.y, 0.9); }
    else if (p.kind === 'fire') { mesh = namedMesh('fireball', mkFireballM); m4trs(TMPM, p.x, y, p.y, S.t * 6, S.t * 4, 0, 1 + Math.sin(S.t * 30) * 0.1); }
    else { mesh = namedMesh('ball' + p.kind, () => mkBallM(p.kind)); m4trs(TMPM, p.x, y, p.y, 0, 0, 0, 1); }
    gl.uniformMatrix4fv(U.uModel, false, TMPM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }
}
const SKYU = { done: false };
function drawSky() {
  const U = PR.sky.U; gl.useProgram(PR.sky.p);
  gl.uniformMatrix4fv(U.uIVP, false, CAM.ivp); gl.uniform3fv(U.uCamPos, CAM.eye);
  gl.uniform3fv(U.uZen, ENV.zen); gl.uniform3fv(U.uHor, ENV.hor); gl.uniform3fv(U.uFogCol, ENV.fog);
  gl.uniform3fv(U.uMoonDir, ENV.moon); gl.uniform3fv(U.uMoonCol, ENV.moonC); gl.uniform3fv(U.uSunDir2, ENV.sunVis);
  gl.uniform1f(U.uStars, ENV.stars); gl.uniform1f(U.uTime, S.t);
  gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
  gl.bindVertexArray(QUADVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
}
function post() {
  // A: cell averages
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.cf); gl.viewport(0, 0, CW, CH); gl.disable(gl.DEPTH_TEST);
  let U = PR.cell.U; gl.useProgram(PR.cell.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.sc); gl.uniform1i(U.tScene, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.sd); gl.uniform1i(U.tDepth, 1);
  gl.uniform2f(U.uCellS, CELLX * SW / RW, CELLY * SH / RH); gl.uniform2f(U.uSceneSz, SW, SH); gl.uniform1f(U.uNear, 0.3); gl.uniform1f(U.uFar, 420);
  gl.bindVertexArray(QUADVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
  // B: glyph choice
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.gf);
  U = PR.glyph.U; gl.useProgram(PR.glyph.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.c0); gl.uniform1i(U.tCell, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.c1); gl.uniform1i(U.tCellD, 1);
  gl.uniform1f(U.uExpo, POSTK.expo); gl.uniform1f(U.uEdge, POSTK.edge); gl.uniform2f(U.uSeed, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // C: bloom
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.bf);
  U = PR.bloom.U; gl.useProgram(PR.bloom.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.c0); gl.uniform1i(U.tCell, 0); gl.uniform2f(U.uCells, CW, CH);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // D: compose to screen
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, RW, RH);
  U = PR.final.U; gl.useProgram(PR.final.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.sc); gl.uniform1i(U.tScene, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.c0); gl.uniform1i(U.tCell, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RT.g); gl.uniform1i(U.tGlyph, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, ATLAS); gl.uniform1i(U.tAtlas, 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, RT.b); gl.uniform1i(U.tBloom, 4);
  gl.uniform2f(U.uCell, CELLX, CELLY); gl.uniform2f(U.uRes, RW, RH); gl.uniform2f(U.uCells, CW, CH);
  gl.uniform1f(U.uTime, S.t); gl.uniform1f(U.uBloomK, POSTK.bloom); gl.uniform1f(U.uVig, POSTK.vig); gl.uniform1f(U.uGrain, POSTK.grain); gl.uniform1f(U.uSat, POSTK.sat);
  gl.uniform3f(U.uFlashC, 0.75, 0.08, 0.04); gl.uniform1f(U.uFlashA, S.flash > 0 ? S.flash * 0.45 : 0); gl.uniform1f(U.uFadeA, S.fade > 0 ? clamp(S.fade, 0, 1) : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST);
}
const POSTK = { expo: 0.95, edge: 0.45, bloom: 0.75, vig: 0.55, grain: 0.04, sat: 0.78 };
function render(dt) {
  dt = dt || 0.016; RDT = dt; frameNo++;
  const t0 = now();
  if (ctx && canvas) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  const hud = S.mode !== 'title' && S.mode !== 'loading';
  if (!GLOK) { if (hud && ctx) drawHUD(); lastRenderMs = now() - t0; return; }
  updateEnv(dt); setupCamera(dt);
  syncChunks(S.mode === 'loading' ? 30 : 4);
  collectLights(); updateGrassMap(false);
  PS.nAdd = PS.nAlp = 0; SHD.n = 0; MST.n = 0;
  // scene
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.sf); gl.viewport(0, 0, SW, SH);
  gl.clearColor(ENV.fog[0], ENV.fog[1], ENV.fog[2], 0.5); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  drawSky();
  const U = MESHU = useLit(PR.mesh);
  gl.uniform1f(U.uEmK, ENV.emK); gl.uniform1f(U.uTintA, 0); gl.uniform1f(U.uWind, ENV.wind); gl.uniform1f(U.uMaskMul, 1);
  // distant mountains, lightly fogged
  m4trs(TMPM, CAM.eye[0], -2, CAM.eye[2], 0, 0, 0, 1);
  gl.uniform1i(U.uMode, 0); gl.uniform1i(U.uMat, 0); gl.uniform1f(U.uFogMul, 0.3); gl.uniformMatrix4fv(U.uModel, false, TMPM);
  gl.bindVertexArray(MOUNT.vao); gl.drawArrays(gl.TRIANGLES, 0, MOUNT.n);
  gl.uniform1f(U.uFogMul, 1);
  drawStaticsAndTerrain(U);
  drawActors(U);
  drawShadows();
  drawGrass();
  stepAmbient(dt); pushGameParticles();
  drawMist();
  drawParticles();
  post();
  // HUD overlay
  if (ctx && hud) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawWorldOverlays(); drawHUD(); }
  lastRenderMs = now() - t0;
}
// pre-build meshes around the player while the loading screen shows; returns work left
function prewarmScene(n) {
  if (!GLOK) return 0;
  setupCamera(0);
  const left = syncChunks(40);
  for (const k of ['soldier', 'bandit', 'ally', 'guard', 'merchant', 'archer', 'musketeer', 'pikeman']) humanMesh(k, entSpec(k));
  humanMesh('P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-'), playerSpec());
  updateGrassMap(true);
  return left;
}
const prewarmStacks = prewarmScene;

// ---------- world-space overlays on the HUD canvas ----------
const OV = [0, 0, 0];
function drawWorldOverlays() {
  const blink = ((S.t * 8) | 0) % 2;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const e of S.ents) {
    if (e.dead) continue;
    const top = (GIANTS[e.kind] ? 6.0 : e.kind === 'dragoon' ? 2.9 : 2.15) + (e.elev || 0);
    const q = project(e.x, groundH(e.x, e.y) + top, e.y, OV); if (!q) continue;
    const sc = clamp(14 / q[2], 0.6, 1.4);
    let y = q[1];
    if (e.downT > 0) { ctx.fillStyle = '#ffd84a'; for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * 2.1; ctx.fillRect(q[0] + Math.cos(a) * 10 - 1.5, y + 10 + Math.sin(a) * 3, 3, 3); } continue; }
    if (e.state === 'wind' || e.state === 'aim' || e.state === 'cast' || e.state === 'slam' || e.state === 'throw') {
      ctx.font = 'bold ' + Math.round(15 * sc) + 'px ui-monospace,Menlo,Consolas,monospace';
      ctx.fillStyle = '#000'; ctx.fillText(e.k.boss ? '!!' : '!', q[0] + 1, y - 9 * sc + 1); ctx.fillStyle = blink ? '#ffd84a' : '#ff5a3a'; ctx.fillText(e.k.boss ? '!!' : '!', q[0], y - 9 * sc); y -= 16 * sc;
    }
    if (e.team === 1 && !e.k.boss && e.hp < e.maxHp) { const w = Math.round(30 * sc), f = clamp(e.hp / e.maxHp, 0, 1), x0 = Math.round(q[0] - w / 2); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x0 - 1, y - 1, w + 2, 5); ctx.fillStyle = '#4a1a1a'; ctx.fillRect(x0, y, w, 3); ctx.fillStyle = '#e8443a'; ctx.fillRect(x0, y, Math.round(w * f), 3); y -= 8; }
    if (e.team === 2) { ctx.font = 'bold 13px ui-monospace,Menlo,Consolas,monospace'; ctx.fillStyle = '#000'; ctx.fillText('$', q[0] + 1, y - 6); ctx.fillStyle = '#ffd84a'; ctx.fillText('$', q[0], y - 7); y -= 14; }
    if (e === S.aim) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(q[0] - 6, y - 10); ctx.lineTo(q[0] + 6, y - 10); ctx.lineTo(q[0], y - 3); ctx.closePath(); ctx.fill(); }
  }
  if (P.drawing && twoHanded() && S.mode !== 'title') {
    const it = ITEMS[P.hands[1]], ch = clamp(P.draw / it.draw, 0, 1), q = project(P.x, groundH(P.x, P.y) + (P.mounted ? 3.2 : 2.3), P.y, OV);
    if (q) { ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(q[0] - 21, q[1] - 1, 42, 6); ctx.fillStyle = '#3a2a14'; ctx.fillRect(q[0] - 20, q[1], 40, 4); ctx.fillStyle = ch >= 0.98 ? '#ffd84a' : '#e8e0c8'; ctx.fillRect(q[0] - 20, q[1], Math.round(40 * ch), 4); }
  }
  for (const m of S.marks) {
    if (((S.t * 8) | 0) % 2) continue;
    const pts = [[-1, -1], [1, 1], [-1, 1], [1, -1]].map(([a, b]) => project(m.x + a * 1.4, groundH(m.x, m.y) + 0.1, m.y + b * 1.4, [0, 0, 0]));
    if (pts.some(p => !p)) continue;
    ctx.strokeStyle = '#ff3a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.moveTo(pts[2][0], pts[2][1]); ctx.lineTo(pts[3][0], pts[3][1]); ctx.stroke();
  }
  for (const t of S.texts) {
    const q = project(t.x, groundH(t.x, t.y) + t.elev + 1.2, t.y, OV); if (!q) continue;
    ctx.globalAlpha = clamp(t.t * 2, 0, 1);
    ctx.font = 'bold ' + Math.round(clamp(16 * 12 / q[2], 11, 20)) + 'px ui-monospace,Menlo,Consolas,monospace';
    const col = t.col.charCodeAt(0) === 33 ? t.col.slice(1) : t.col;
    ctx.fillStyle = '#000'; ctx.fillText(t.s, q[0] + 1, q[1] + 1); ctx.fillStyle = col; ctx.fillText(t.s, q[0], q[1]);
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
}
