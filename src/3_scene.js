// =====================================================================
//  SCENE — terrain chunks, instanced scenery, chibi actors, combat FX, frame
// =====================================================================
let frameNo = 0, lastRenderMs = 0;
const WATER_Y = -0.55;
// ---------- terrain height (visual only; gameplay stays 2D) ----------
const LAKE_THR = [0.73, 0.74, 0.7, 0.57, 0.76, 0.8];
function heightBase(x, y) {
  return (fbm(x * 0.016 + 7.3, y * 0.016 + 1.1) - 0.5) * 7.0 + (vnoise(x * 0.12 + 3.1, y * 0.12 + 0.7) - 0.5) * 0.35;
}
function heightRaw(x, y) {
  let h = heightBase(x, y);
  const b = biomeAt(x, y), lake = fbm(x * 0.011 + 300, y * 0.011 + 300), thr = LAKE_THR[b];
  const w = smooth(clamp((lake - thr + 0.085) / 0.085, 0, 1));
  if (w > 0) h = lerp(h, b === B_SNOW ? -0.45 : -1.15, w);
  const v = nearVillage(x, y, 40);
  if (v) {
    if (v.gh === undefined) v.gh = Math.max(0.2, heightBase(v.x, v.y));
    const d = Math.hypot(x - v.x, y - v.y), k = smooth(clamp((40 - d) / 12, 0, 1));
    h = lerp(h, v.gh, k);
  }
  const cs = castleGround(x, y);
  if (cs) {
    const l = w2l(cs, x, y), d = Math.max(Math.abs(l[0]), Math.abs(l[1]) - (l[1] > 0 && Math.abs(l[0]) < 6 ? 8 : 0));
    h = lerp(h, cs.gh, smooth(clamp((74 - d) / 28, 0, 1)));
  }
  const mn = manorGround(x, y);
  if (mn) {
    const l = w2l(mn, x, y), d = Math.max(Math.abs(l[0]), Math.abs(l[1]));
    h = lerp(h, mn.gh, smooth(clamp((MAN_G + 17 - d) / 14, 0, 1)));
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
// muted, earthy ground colours per tile (soft zones; vertices average 4 tiles)
const TCOL = [];
(() => {
  const T = (t, h) => { TCOL[t] = hexC(h); };
  T(T_GRASS, '#6f8f4a'); T(T_TALL, '#5f8242'); T(T_WATER, '#4a7a78'); T(T_DIRT, '#9c8260'); T(T_WHEAT, '#bfa35a');
  T(T_SNOW, '#dfe4ea'); T(T_DRIFT, '#d2d9e2'); T(T_ICE, '#9cbccc'); T(T_SAND, '#cdb487'); T(T_DUNE, '#c4aa7c');
  T(T_MUD, '#7e6a4e'); T(T_MARSH, '#6c7e4c'); T(T_BOG, '#4a5e48'); T(T_HEATHER, '#8e7690'); T(T_ROCKY, '#8e8a82'); T(T_FLOOR, '#4e7238');
})();
const GRASSY = new Set([T_GRASS, T_TALL, T_FLOOR, T_MARSH, T_HEATHER, T_WHEAT]);

// ---------- GPU resources ----------
const GCH = new Map();
const SMESH = {}, CHM = new Map();
let TIDX = null, UNITM = null;
function staticMesh(k) { let m = SMESH[k]; if (!m) { m = SMESH[k] = gpuMesh(STATIC_BUILD[k]()); } return m; }
function farMesh(k) { const b = STATIC_FAR[k]; if (!b) return null; let m = SMESH[k + '~']; if (!m) m = SMESH[k + '~'] = gpuMesh(b()); return m; }
function namedMesh(k, fn) { let m = CHM.get(k); if (!m) { m = gpuMesh(fn()); CHM.set(k, m); } return m; }
function initScene() {
  const idx = new Uint16Array(32 * 32 * 6); let k = 0;
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) { const a = j * 33 + i, b = a + 1, c = a + 33, d = c + 1; idx[k++] = a; idx[k++] = c; idx[k++] = b; idx[k++] = b; idx[k++] = c; idx[k++] = d; }
  TIDX = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TIDX); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  PR.pts = program(VS_PTS, FS_PTS);
  PR.shad = program(VS_SHAD, FS_SHAD);
  PR.mist = program(VS_MIST, FS_MIST);
  PR.fx = program(VS_FX, FS_FX);
  initParts(); initShadows(); initMist(); initFX();
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
    case 'bigrock': return o.snow ? 'bigrocksnow' : 'bigrock';
    case 'chest': case 'col': case 'ore': return null;
    case 'bld': return o.mesh;
    default: return STATIC_BUILD[o.type] ? o.type : null;
  }
}
const OCCR = { pine: 1.7, snowpine: 1.7, oak: 2.3, palm: 1.4, deadtree: 1.2, ruin: 4.8, menhir: 1.0, birch: 1.3, willow: 2.2, gstatue: 0.8 };
const SSCALE = { pine: [0.85, 1.2], snowpine: [0.85, 1.2], oak: [0.85, 1.15], deadtree: [0.8, 1.2], palm: [0.85, 1.15], bush: [0.85, 1.2], rock: [1.0, 1.6], rocksnow: [1.0, 1.6], rocksand: [1.0, 1.6], pebble: [0.22, 0.48], menhir: [0.9, 1.15],
  birch: [0.85, 1.2], willow: [0.9, 1.2], log: [0.8, 1.15], logsnow: [0.8, 1.15], stump: [0.8, 1.25], bigrock: [0.85, 1.35], bigrocksnow: [0.85, 1.35], grave: [0.9, 1.1], grave2: [0.9, 1.1], tomb: [0.95, 1.05], gstatue: [1, 1], fountain: [1, 1] };
// outline weight per scenery mesh (decor and pebbles get none: keeps the ground clean)
const OWK = { pine: 0.9, snowpine: 0.9, oak: 0.9, palm: 0.9, deadtree: 0.9, bush: 0.7, rock: 0.85, rocksnow: 0.85, rocksand: 0.85, ruin: 1, menhir: 1, well: 1, fire: 0.8,
  birch: 0.9, willow: 0.9, log: 0.8, logsnow: 0.8, stump: 0.8, bigrock: 0.85, bigrocksnow: 0.85, grave: 0.8, grave2: 0.8, tomb: 0.9, gstatue: 1, fountain: 1 };
const SHADOW_R = { pine: 1.8, snowpine: 1.8, oak: 2.6, birch: 1.4, willow: 2.4, palm: 1.3, deadtree: 0.9, bush: 0.95, rock: 0.95, bigrock: 1.7, log: 1.2, stump: 0.7, tomb: 1.2, gstatue: 0.9, menhir: 0.9, grave: 0.5, grave2: 0.45, fountain: 2.0 };
// decor per ground tile: [key, chance, scale min, scale max]
const DECOR = {
  [T_GRASS]: [['tuft', 0.15, 1.0, 1.5], ['grassclump', 0.06, 0.8, 1.3], ['flower', 0.05, 1.3, 1.8], ['flower2', 0.03, 1.3, 1.8], ['stones', 0.012, 0.7, 1.2], ['mushroom', 0.008, 0.9, 1.4]],
  [T_TALL]: [['tuft', 0.26, 1.1, 1.6], ['grassclump', 0.14, 0.9, 1.4], ['flower', 0.04, 1.3, 1.8], ['fern', 0.03, 0.8, 1.2]],
  [T_FLOOR]: [['fern', 0.14, 0.8, 1.4], ['leaves', 0.1, 0.9, 1.6], ['mushroom', 0.05, 0.9, 1.5], ['tuft', 0.08, 1.0, 1.4], ['twigs', 0.05, 0.8, 1.3], ['grassclump', 0.04, 0.8, 1.2], ['stones', 0.02, 0.7, 1.2]],
  [T_MARSH]: [['reed', 0.28, 1.2, 1.8], ['cattail', 0.1, 0.8, 1.3], ['tuft', 0.1, 1.0, 1.4], ['puddle', 0.025, 0.7, 1.3]],
  [T_MUD]: [['puddle', 0.06, 0.6, 1.4], ['twigs', 0.04, 0.8, 1.3], ['deadbush', 0.03, 0.8, 1.3], ['reed', 0.05, 1.0, 1.5]],
  [T_HEATHER]: [['heathbush', 0.18, 0.8, 1.5], ['flower2', 0.1, 1.2, 1.7], ['tuft', 0.1, 1.0, 1.4], ['stones', 0.04, 0.7, 1.3], ['deadbush', 0.03, 0.8, 1.3]],
  [T_ROCKY]: [['stones', 0.12, 0.8, 1.5], ['deadbush', 0.05, 0.8, 1.3], ['tuft', 0.05, 0.9, 1.3], ['heathbush', 0.03, 0.7, 1.1]],
  [T_SNOW]: [['snowtuft', 0.05, 0.8, 1.4], ['stones', 0.02, 0.7, 1.2]], [T_DRIFT]: [['snowtuft', 0.03, 0.8, 1.3]],
  [T_SAND]: [['tuft', 0.02, 0.8, 1.2], ['deadbush', 0.02, 0.8, 1.2], ['stones', 0.03, 0.7, 1.2]], [T_DUNE]: [['deadbush', 0.015, 0.8, 1.2]],
  [T_DIRT]: [['stones', 0.03, 0.6, 1.1], ['puddle', 0.012, 0.5, 0.9], ['tuft', 0.025, 0.8, 1.2]]
};
function buildChunkGPU(c) {
  const ox = c.cx * CS, oy = c.cy * CS;
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
    let r = 0, g = 0, b = 0;
    for (const [di, dj] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) { const t = tileAtL(i + di, j + dj), tc = TCOL[t] || TCOL[0]; r += tc[0]; g += tc[1]; b += tc[2]; }
    const jt = 0.97 + hash2(ox + i, oy + j) * 0.06, slope = 1 - ny;
    const rock = clamp(slope * 4 - 0.5, 0, 0.55);
    u8[o + 16] = clamp(lerp(r / 4 * jt, 0.66, rock) * 255, 0, 255); u8[o + 17] = clamp(lerp(g / 4 * jt, 0.63, rock) * 255, 0, 255); u8[o + 18] = clamp(lerp(b / 4 * jt, 0.56, rock) * 255, 0, 255);
    u8[o + 19] = 255;
  }
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); meshAttribs(vbo); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, TIDX); gl.bindVertexArray(null);
  // water surface quads over wet tiles
  let water = null;
  { const mb = new MB(1); mb.smooth = false; let any = false;
    for (let j = 0; j < CS; j++) for (let i = 0; i < CS; i++) {
      const t = c.tiles[j * CS + i]; if (t !== T_WATER && t !== T_BOG) continue; any = true;
      const x0 = ox + i - 0.7, x1 = ox + i + 1.7, z0 = oy + j - 0.7, z1 = oy + j + 1.7, col = t === T_BOG ? '#4e8a62' : '#3aa8ec';
      mb.quad([x0, WATER_Y, z0], [x1, WATER_Y, z0], [x1, WATER_Y, z1], [x0, WATER_Y, z1], col);
    }
    if (any) water = gpuMesh(mb);
  }
  // scenery instances grouped by mesh
  const groups = {}, chests = [], fires = [], houses = [], ores = [];
  c.hg = hg;
  for (const o of c.statics) {
    if (o.type === 'chest') { chests.push(o); continue; }
    if (o.type === 'ore') { ores.push(o); continue; }
    if (o.type === 'fire') fires.push(o); if (o.chim) houses.push(o);
    const k = staticKey(o); if (!k) continue;
    const h = hash2(Math.round(o.x * 7), Math.round(o.y * 7)), sr = SSCALE[k] || [1, 1];
    const rot = o.rot !== undefined ? yawOf(o.rot) : h * TAU;
    const yo = o.yo !== undefined ? o.yo : k === 'ruin' ? -0.15 : -0.05, bld = o.type === 'bld';
    if (bld) o.struct.gy = groundH(o.x, o.y) + yo;
    (groups[k] = groups[k] || []).push(o.x, groundH(o.x, o.y) + yo, o.y, rot, o.sc || lerp(sr[0], sr[1], hash2(Math.round(o.y * 13), Math.round(o.x * 5))), bld ? 0.97 + h * 0.06 : 0.92 + h * 0.16, h * 40, o.occ !== undefined ? o.occ : OCCR[k] || 0);
  }
  // pebbles + sparse decor (tufts, flowers, reeds): soft detail, no noisy grass blades
  { const R = mulberry(((c.cx * 7919) ^ (c.cy * 104729)) + 17), pk = [], dec = { tuft: [], flower: [], flower2: [], reed: [] };
    const ND = MOBILE ? 330 : 520;
    for (let n = 0; n < ND; n++) {
      const x = ox + R() * CS, y = oy + R() * CS, t = c.tiles[(Math.floor(y - oy)) * CS + Math.floor(x - ox)], r = R(), r2 = R(), r3 = R();
      if (n < 60) {
        const p = t === T_ROCKY ? 0.8 : t === T_DIRT || t === T_SNOW || t === T_SAND || t === T_MUD ? 0.18 : 0.03;
        if (r < p && !c.structs.some(s => s.roof && structContains(s, x, y)) && !blockedAt(x, y, 0.2)) pk.push(x, groundH(x, y) - 0.06, y, r2 * TAU, 0.22 + r3 * 0.3, 0.9 + R() * 0.2, 0, 0);
        continue;
      }
      const tab = DECOR[t]; if (!tab) continue;
      let k = null, sc = 1, acc = 0;
      for (const d of tab) { acc += d[1]; if (r < acc) { k = d[0]; sc = lerp(d[2], d[3], r2); break; } }
      if (!k) continue;
      if (nearVillage(x, y, 9) || c.structs.some(s => structContains(s, x, y))) continue;
      if ((k === 'puddle' || k === 'leaves' || k === 'stones') && blockedAt(x, y, 0.3)) continue;
      (dec[k] = dec[k] || []).push(x, groundH(x, y) - (k === 'puddle' ? 0.0 : 0.03), y, r3 * TAU, sc, 0.88 + R() * 0.24, R() * 40, 0);
    }
    if (pk.length) groups[c.biome === B_SNOW ? 'pebblesnow' : c.biome === B_DESERT ? 'pebblesand' : 'pebble'] = pk;
    for (const k in dec) if (dec[k].length) groups[k] = dec[k];
  }
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
    const fm = farMesh(k), deco = k.startsWith('pebble') || k === 'tuft' || k.startsWith('flower') || k === 'reed' || !!DECOR_BUILD[k];
    inst.push({ vao: instVAO(mesh, ibo), far: fm ? instVAO(fm, ibo) : null, fmesh: fm, ibo, n: data.length / 8, mesh, small: deco ? 34 : k === 'bush' || k.startsWith('rock') ? 80 : 999, ow: OWK[k] || 0 });
  }
  const g = { vao, vbo, water, inst, chests, fires, houses, ores, cx: c.cx, cy: c.cy, hmid: (hmin + hmax) / 2, hr: (hmax - hmin) / 2, c };
  GCH.set(c.key, g);
  return g;
}
function syncChunks(budgetMs) {
  for (const [k, g] of GCH) if (CHUNKS.get(k) !== g.c) { freeChunkGPU(g); GCH.delete(k); if (g.c) g.c.hg = null; }
  const t0 = now(), pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS), list = [];
  for (const [k, c] of CHUNKS) if (!GCH.has(k)) list.push([Math.max(Math.abs(c.cx - pcx), Math.abs(c.cy - pcy)) + Math.hypot(c.cx - pcx, c.cy - pcy) * 0.01, c]);
  list.sort((a, b) => a[0] - b[0]);
  let made = 0;
  for (const [, c] of list) { if (made && now() - t0 > budgetMs) break; buildChunkGPU(c); made++; }
  return list.length - made;
}

// ---------- point sprites: game particles + ambient (snow, fireflies, sparkles, embers, smoke) ----------
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
  float dd = max(length(aP.xyz - uCamPos) - 18.0, 0.0);
  vC = aC; vC.a *= exp(-pow(dd * uFogD * 0.8, 2.0));
  vK = aK;
}`;
const FS_PTS = `
in vec4 vC; in float vK;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q), a;
  if (vK < 0.5) a = smoothstep(1.0, 0.15, r);
  else if (vK < 1.5) { float cr = max(1.0 - abs(q.x) * 4.0 - abs(q.y) * 0.85, 1.0 - abs(q.y) * 4.0 - abs(q.x) * 0.85); a = step(0.05, cr) + smoothstep(0.42, 0.0, r) * 0.7; }
  else if (vK < 2.5) a = smoothstep(1.0, 0.75, r) * 0.9;
  else a = step(r, 0.9);
  a *= vC.a;
  if (a < 0.004) discard;
  o = vec4(vC.rgb, min(a, 1.0));
}`;
const PMAX = 6000;
const PS = { add: new Float32Array(PMAX * 9), nAdd: 0, alp: new Float32Array(PMAX * 9), nAlp: 0, vboA: null, vboB: null, vaoA: null, vaoB: null };
const AMB = { snow: [], fly: [], spark: [], ember: [], smoke: [], mist: [], dust: [], leaf: [] };
let NEAR_MANOR = null;
function initParts() {
  const mk = () => { const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, PMAX * 36, gl.DYNAMIC_DRAW);
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 36, 16);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 36, 32);
    gl.bindVertexArray(null); return [vbo, vao]; };
  [PS.vboA, PS.vaoA] = mk(); [PS.vboB, PS.vaoB] = mk();
}
function pAdd(x, y, z, s, r, g, b, a, k) { if (PS.nAdd >= PMAX) return; const o = PS.nAdd++ * 9, A = PS.add; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = s; A[o + 4] = r; A[o + 5] = g; A[o + 6] = b; A[o + 7] = a; A[o + 8] = k; }
function pAlp(x, y, z, s, r, g, b, a, k) { if (PS.nAlp >= PMAX) return; const o = PS.nAlp++ * 9, A = PS.alp; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = s; A[o + 4] = r; A[o + 5] = g; A[o + 6] = b; A[o + 7] = a; A[o + 8] = k; }
const MOTE = (arr, n, mk) => { while (arr.length < n) arr.push(mk()); if (arr.length > n) arr.length = n; };
function stepAmbient(dt) {
  const d = S.darkness, b = S.curBiome >= 0 ? S.curBiome : biomeAt(CAM.x, CAM.y), fx = CAM.x, fz = CAM.y;
  const run = S.mode !== 'paused' && S.mode !== 'inv' && S.mode !== 'shop';
  const dd = run ? dt : 0;
  // snowfall (not inside the building you stand in)
  const ns = b === B_SNOW ? (MOBILE ? 320 : 700) : 0, inRoof = S.cut && S.cut.s && S.cut.s.roof ? S.cut.s : null;
  MOTE(AMB.snow, ns, () => ({ x: fx + rr(-22, 22), y: rr(0, 14), z: fz + rr(-22, 22), v: rr(1.2, 2.4), s: rr(0.07, 0.13), p: rr(0, TAU) }));
  for (const f of AMB.snow) {
    f.y -= f.v * dd; f.x += (Math.sin(S.t * 0.9 + f.p) * 0.6 - 0.8) * dd; f.z += Math.cos(S.t * 0.7 + f.p) * 0.4 * dd;
    const gy = camGH - 2; if (f.y < gy) { f.y = gy + 15; f.x = fx + rr(-22, 22); f.z = fz + rr(-22, 22); }
    if (f.x < fx - 23) f.x += 46; if (f.x > fx + 23) f.x -= 46; if (f.z < fz - 23) f.z += 46; if (f.z > fz + 23) f.z -= 46;
    if (inRoof && (Math.abs(f.x - P.x) < 15 && Math.abs(f.z - P.y) < 15 || structContains(inRoof, f.x, f.z))) continue;
    pAlp(f.x, f.y, f.z, f.s, 1, 1, 1, 0.95, 3);
  }
  // fireflies at night over grass
  const nf = d > 0.5 && b !== B_SNOW && b !== B_DESERT ? (MOBILE ? 110 : 180) : 0;
  MOTE(AMB.fly, nf, () => ({ x: P.x + rr(-18, 18), z: P.y + rr(-18, 18), h: rr(0.2, 1.0), p: rr(0, TAU), q: rr(0.5, 1.5) }));
  for (const f of AMB.fly) {
    f.x += Math.sin(S.t * 0.7 * f.q + f.p) * 0.5 * dd; f.z += Math.cos(S.t * 0.6 * f.q + f.p * 1.3) * 0.5 * dd;
    if (Math.hypot(f.x - P.x, f.z - P.y) > 20) { f.x = P.x + rr(-16, 16); f.z = P.y + rr(-16, 16); }
    if (!GRASSY.has(tileNoGen(f.x, f.z))) continue;
    const bl = Math.max(0, Math.sin(S.t * 1.7 * f.q + f.p * 3)), a = (0.25 + 0.75 * bl) * clamp(d * 2 - 1, 0, 1);
    const fy = groundH(f.x, f.z) + f.h + Math.sin(S.t * 2 + f.p) * 0.1;
    pAdd(f.x, fy, f.z, 0.1, 0.85, 1.0, 0.5, Math.min(1, a * 1.5), 0); pAdd(f.x, fy, f.z, 0.45, 0.5, 0.9, 0.3, a * 0.35, 0);
  }
  // sparkles: water / snow glints
  const nsp = MOBILE ? 50 : 90;
  MOTE(AMB.spark, nsp, () => ({ x: fx + rr(-16, 16), z: fz + rr(-16, 16), t: rr(0, 2), l: rr(0.5, 1.4) }));
  for (const s of AMB.spark) {
    s.t += dd; if (s.t > s.l) { s.t = 0; s.x = fx + rr(-16, 16); s.z = fz + rr(-16, 16); }
    const t = tileNoGen(s.x, s.z); if (t !== T_WATER && t !== T_ICE && t !== T_SNOW && t !== T_DRIFT) continue;
    if (inRoof && structContains(inRoof, s.x, s.z)) continue;
    const k = Math.sin(s.t / s.l * Math.PI) * (1 - d * 0.6);
    pAdd(s.x, (t === T_WATER ? WATER_Y + 0.05 : groundH(s.x, s.z) + 0.08), s.z, 0.32, 1, 1, 1, k, 1);
  }
  // campfire embers + chimney smoke
  for (const g of GCH.values()) {
    if (Math.abs(g.cx * CS + 16 - CAM.x) > 50 || Math.abs(g.cy * CS + 16 - CAM.y) > 50) continue;
    for (const o of g.fires) if (run && Math.random() < dt * 14) AMB.ember.push({ x: o.x + rr(-0.3, 0.3), y: groundH(o.x, o.y) + 0.6, z: o.y + rr(-0.3, 0.3), vx: rr(-0.3, 0.3), vy: rr(1.2, 2.6), vz: rr(-0.3, 0.3), t: rr(0.8, 1.6) });
    for (const o of g.houses) if (run && Math.random() < dt * 1.6) {
      const ch = o.chim;
      AMB.smoke.push({ x: ch[0], y: groundH(o.x, o.y) + ch[2], z: ch[1], vx: rr(0.1, 0.4), vy: rr(0.6, 1.0), vz: rr(-0.2, 0.2), t: 0, l: rr(3, 5), s: rr(0.6, 0.9) });
    }
  }
  if (hasTorch() && S.mode !== 'title' && run && Math.random() < dt * 18 && TORCH_TIP) AMB.ember.push({ x: TORCH_TIP[0] + rr(-0.05, 0.05), y: TORCH_TIP[1] + 0.15, z: TORCH_TIP[2] + rr(-0.05, 0.05), vx: rr(-0.2, 0.2), vy: rr(0.8, 1.8), vz: rr(-0.2, 0.2), t: rr(0.4, 0.9) });
  for (let i = AMB.ember.length - 1; i >= 0; i--) { const e = AMB.ember[i]; e.t -= dd; if (e.t <= 0) { AMB.ember.splice(i, 1); continue; } e.x += e.vx * dd; e.y += e.vy * dd; e.z += e.vz * dd; e.vx += Math.sin(S.t * 5 + i) * dd;
    pAdd(e.x, e.y, e.z, 0.07, 1, 0.6 + e.t * 0.3, 0.2, Math.min(1, e.t * 1.6), 0); }
  if (AMB.ember.length > 400) AMB.ember.splice(0, AMB.ember.length - 400);
  for (let i = AMB.smoke.length - 1; i >= 0; i--) { const s = AMB.smoke[i]; s.t += dd; if (s.t >= s.l) { AMB.smoke.splice(i, 1); continue; } s.x += s.vx * dd; s.y += s.vy * dd; s.z += s.vz * dd;
    const k = s.t / s.l, c = 0.75 + (1 - d) * 0.2; pAlp(s.x, s.y, s.z, s.s * (1 + k * 2.5), c, c, c * 1.04, 0.45 * (1 - k) * Math.min(1, s.t * 3), 2); }
  if (AMB.smoke.length > 300) AMB.smoke.splice(0, AMB.smoke.length - 300);
  // layered ground fog: thick over swamp water, rolling banks in the woods at dawn / dusk / night, heavy around haunted manors
  if (frameNo % 30 === 0) NEAR_MANOR = (() => { const m = nearestManor(CAM.x, CAM.y, 110); return m && Math.hypot(m.x - CAM.x, m.y - CAM.y) < 75 ? m : null; })();
  const dusk = clamp(1 - Math.abs(d - 0.5) * 2.2, 0, 1), woods = b === B_FOREST || b === B_SWAMP || b === B_HEATH;
  const nm = Math.min(120, (b === B_SWAMP ? 40 : 0) + (d > 0.4 ? 16 : 0) + (woods ? 10 + dusk * 16 : 4 + dusk * 10) + (NEAR_MANOR ? 46 : 0)) * (MOBILE ? 0.6 : 1) | 0;
  MOTE(AMB.mist, nm, () => ({ x: fx + rr(-26, 26), z: fz + rr(-24, 28), t: rr(0, 12), l: rr(9, 16), s: rr(3, 7), v: rr(-0.3, 0.3), h: rr(0, 1) }));
  const mc = mix3(ENV.fog, d > 0.5 ? [0.55, 0.65, 0.85] : [0.8, 0.84, 0.88], 0.55);
  for (const m of AMB.mist) {
    m.t += dd; m.x += (0.35 + m.v) * dd;
    if (m.t > m.l || Math.abs(m.x - fx) > 30 || Math.abs(m.z - fz) > 32) { m.t = 0; m.x = fx + rr(-26, 26); m.z = fz + rr(-24, 28); m.l = rr(9, 16); m.h = rr(0, 1); }
    const t = tileNoGen(m.x, m.z), wet = t === T_WATER || t === T_BOG || t === T_MARSH || t === T_MUD;
    const man = NEAR_MANOR && manorGround(m.x, m.z, 10) === NEAR_MANOR;
    if (inRoof && structContains(inRoof, m.x, m.z)) continue;
    let a = 0;
    if (wet) a = 0.32; else if (man) a = 0.26 + d * 0.14; else if (m.h < (woods ? 0.55 : 0.35)) a = (0.1 + dusk * 0.16 + d * 0.06) * (woods ? 1 : 0.7); else continue;
    const k = Math.sin(m.t / m.l * Math.PI);
    mistAt(m.x, Math.max(groundH(m.x, m.z), WATER_Y) + 0.25 + m.h * 0.6, m.z, m.s * (man ? 1.3 : 1), mc, a * k);
  }
  // dust motes drifting in the light (by day, and indoors)
  const nd = (d < 0.6 ? (MOBILE ? 40 : 70) : inRoof ? 30 : 0) | 0;
  MOTE(AMB.dust, nd, () => ({ x: P.x + rr(-9, 9), z: P.y + rr(-9, 9), h: rr(0.3, 3.2), p: rr(0, TAU), q: rr(0.4, 1.2) }));
  for (const m of AMB.dust) {
    m.x += Math.sin(S.t * 0.3 * m.q + m.p) * 0.15 * dd; m.z += Math.cos(S.t * 0.25 * m.q + m.p) * 0.15 * dd; m.h += Math.sin(S.t * 0.5 + m.p) * 0.05 * dd;
    if (Math.abs(m.x - P.x) > 10 || Math.abs(m.z - P.y) > 10) { m.x = P.x + rr(-9, 9); m.z = P.y + rr(-9, 9); }
    const tw = 0.5 + 0.5 * Math.sin(S.t * 1.3 * m.q + m.p * 5), lit = inRoof ? 0.55 : 1 - d;
    pAdd(m.x, groundH(m.x, m.z) + m.h, m.z, 0.05, 1, 0.95, 0.82, 0.35 * tw * lit, 0);
  }
  // falling leaves under the trees of the vales, woods and fens
  const nl = !inRoof && (b === B_FOREST || b === B_PLAINS || b === B_SWAMP || NEAR_MANOR) ? (MOBILE ? 24 : 46) : 0;
  MOTE(AMB.leaf, nl, () => ({ x: fx + rr(-18, 18), z: fz + rr(-18, 18), y: rr(0, 9), v: rr(0.5, 1.0), p: rr(0, TAU), c: (Math.random() * 4) | 0 }));
  const LC = [[0.62, 0.38, 0.16], [0.72, 0.5, 0.2], [0.42, 0.5, 0.22], [0.5, 0.3, 0.14]];
  for (const f of AMB.leaf) {
    f.y -= f.v * dd; f.x += (Math.sin(S.t * 1.6 + f.p) * 0.9 + 0.4) * dd; f.z += Math.cos(S.t * 1.2 + f.p) * 0.5 * dd;
    const gy = groundH(f.x, f.z);
    if (f.y < 0.05 || Math.abs(f.x - fx) > 20 || Math.abs(f.z - fz) > 20) { f.x = fx + rr(-18, 18); f.z = fz + rr(-18, 18); f.y = rr(5, 9); }
    const c = LC[f.c], lk = 1 - d * 0.7;
    pAlp(f.x, gy + f.y, f.z, 0.1, c[0] * lk, c[1] * lk, c[2] * lk, 0.9, 3);
  }
}
function pushGameParticles() {
  for (const p of S.parts) {
    const em = p.em || p.col.charCodeAt(0) === 33, c = hexC(p.col), ch = p.ch, y = groundH(p.x, p.y) + p.elev;
    const k = Math.min(1, p.t * 3.5);
    if (p.sz) { pAdd(p.x, y, p.y, p.sz * (0.5 + 0.5 * k), c[0], c[1], c[2], k, 1); continue; }
    if (ch === '*' || ch === '+') { if (em) pAdd(p.x, y, p.y, 0.3, c[0], c[1], c[2], k, 1); else pAlp(p.x, y, p.y, 0.16, c[0], c[1], c[2], k, 3); }
    else if (ch === '^' || ch === '&' || ch === "'") pAdd(p.x, y, p.y, 0.22, c[0], c[1], c[2], k, 0);
    else if (ch === '~' || ch === '-' || ch === '=') pAlp(p.x, y, p.y, 0.55 + (1 - k) * 0.35, c[0], c[1], c[2], k * 0.75, 2);
    else if (em) pAdd(p.x, y, p.y, 0.16, c[0], c[1], c[2], k, 0);
    else pAlp(p.x, y, p.y, ch === 'o' || ch === 'O' || ch === '@' ? 0.17 : 0.11, c[0], c[1], c[2], k, 3);
  }
  for (const p of S.projs) {
    const y = groundH(p.x, p.y) + p.elev;
    if (p.kind === 'fire' && p.hex) { pAdd(p.x, y, p.y, 1.1, 0.45, 1, 0.35, 0.5, 0); if (Math.random() < 0.5) pAdd(p.x + rr(-0.2, 0.2), y + rr(-0.2, 0.2), p.y + rr(-0.2, 0.2), 0.12, 0.6, 1, 0.4, 0.8, 0); }
    else if (p.kind === 'fire') { if (Math.random() < 0.7) AMB.ember.push({ x: p.x, y, z: p.y, vx: rr(-0.4, 0.4), vy: rr(0, 0.6), vz: rr(-0.4, 0.4), t: rr(0.2, 0.5) }); pAdd(p.x, y, p.y, 1.5, 1, 0.5, 0.12, 0.5, 0); if (p.team === 1) pAdd(p.x, y, p.y, 1.1, 1, 0.9, 0.25, 0.35 + 0.2 * Math.sin(S.t * 20), 0); }
    else if (p.kind === 'bomb') { AMB.ember.push({ x: p.x, y: y + 0.25, z: p.y, vx: rr(-0.5, 0.5), vy: rr(0.5, 1.5), vz: rr(-0.5, 0.5), t: rr(0.2, 0.4) }); pAdd(p.x, y + 0.25, p.y, 0.5, 1, 0.7, 0.2, 0.7 + 0.3 * Math.sin(S.t * 40), 1); }
    else if (p.kind === 'pball') pAdd(p.x, y, p.y, 0.4, 1, 0.9, 0.5, 0.9, 0);
    else if (p.kind === 'ball') { pAdd(p.x, y, p.y, 0.5, 1, 0.35, 0.25, 0.7, 0); for (let i = 1; i < 4; i++) pAlp(p.x - p.vx * 0.012 * i, y, p.y - p.vy * 0.012 * i, 0.16, 0.95, 0.95, 0.95, 0.5 - i * 0.12, 0); }
    else if (p.kind === 'arrow' && (p.team === 0 ? p.crit : true)) pAdd(p.x, y, p.y, 0.35, p.team === 0 ? 0.6 : 1, p.team === 0 ? 0.95 : 0.9, p.team === 0 ? 1 : 0.3, 0.6, 0);
  }
  for (const d of S.drops) if (d.kind !== 'gold' && ((S.t * 2 + d.x) % 2) < 0.6) pAdd(d.x + 0.1, groundH(d.x, d.y) + 0.7, d.y, 0.38, 1, 0.95, 0.7, 0.9, 1);
  for (const e of S.ents) if (!e.dead && e.kind === 'witch' && Math.random() < 0.35) { const y = groundH(e.x, e.y) + e.elev; pAdd(e.x + rr(-0.4, 0.4), y + rr(0.2, 1.8), e.y + rr(-0.4, 0.4), 0.13, 0.6, 1, 0.4, 0.8, 0); }
  // charge glow / combo glint at the weapon
  if (S.mode === 'play' && WEAPON_TIP) {
    const a = P.act;
    if (a && a.k === 'charge') { const it = mainItem(), full = CHARGE_FULL[weaponKey(it)] || 0.7, k = clamp(a.t / full, 0, 1), sweet = a.t >= full && a.t <= full + 0.16;
      pAdd(WEAPON_TIP[0], WEAPON_TIP[1], WEAPON_TIP[2], 0.3 + k * 0.6 + (sweet ? 0.5 : 0), 1, sweet ? 0.85 : 0.95, sweet ? 0.3 : 0.8, 0.5 + 0.5 * k, sweet ? 1 : 0);
      if (Math.random() < 0.5) { const an = rr(0, TAU), r = 1.2 * (1 - k) + 0.3; AMB.ember.push({ x: WEAPON_TIP[0] + Math.cos(an) * r, y: WEAPON_TIP[1] + rr(-0.3, 0.3), z: WEAPON_TIP[2] + Math.sin(an) * r, vx: -Math.cos(an) * 2, vy: 0, vz: -Math.sin(an) * 2, t: 0.25 }); } }
    if (S.cueT > 0) { const k = S.cueT / 0.22; pAdd(WEAPON_TIP[0], WEAPON_TIP[1] + 0.1, WEAPON_TIP[2], 0.5 + (1 - k) * 0.9, 1, 1, 1, k, 1); }
  }
}
function drawParticles() {
  const U = PR.pts.U; gl.useProgram(PR.pts.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform3fv(U.uCamPos, CAM.eye); gl.uniform1f(U.uFogD, ENV.fogD);
  gl.uniform1f(U.uPS, SH / (2 * Math.tan(CAM.fovY / 2))); gl.uniform1f(U.uMaxPt, PTMAX);
  gl.enable(gl.BLEND); gl.depthMask(false);
  if (PS.nAlp) {
    gl.blendColor(0, 0, 0, 0.0); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    gl.bindBuffer(gl.ARRAY_BUFFER, PS.vboB); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PS.alp, 0, PS.nAlp * 9);
    gl.bindVertexArray(PS.vaoB); gl.drawArrays(gl.POINTS, 0, PS.nAlp);
  }
  if (PS.nAdd) {
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE);
    gl.bindBuffer(gl.ARRAY_BUFFER, PS.vboA); gl.bufferSubData(gl.ARRAY_BUFFER, 0, PS.add, 0, PS.nAdd * 9);
    gl.bindVertexArray(PS.vaoA); gl.drawArrays(gl.POINTS, 0, PS.nAdd);
  }
  gl.disable(gl.BLEND); gl.depthMask(true);
}
let PTMAX = 256;

// ---------- blob shadows (crisp toon discs) + swamp mist ----------
// soft contact shadows: a dark core under the object fading into a wide penumbra, pushed away from the sun
const VS_SHAD = `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aS;
layout(location=2) in vec3 aN;
uniform mat4 uVP; uniform vec2 uSunXZ;
out vec2 vQ;
void main() {
  vec3 n = normalize(aN);
  vec3 t = normalize(cross(n, vec3(0.0, 0.0, 1.0))), b = cross(t, n);
  vec2 q = aQ * 1.25;
  vec2 sd = uSunXZ; float sl = length(sd);
  vec2 off = sl > 0.001 ? sd * aS.w * 0.42 : vec2(0.0);
  vec2 dir = sl > 0.001 ? sd / sl : vec2(1.0, 0.0);
  vec2 qq = q + dir * dot(q, dir) * sl * 0.45;
  vec3 p = aS.xyz + (t * qq.x + b * qq.y) * aS.w + vec3(off.x, 0.0, off.y) * 0.6 + n * 0.06;
  vQ = q; gl_Position = uVP * vec4(p, 1.0);
}`;
const FS_SHAD = `
in vec2 vQ; uniform float uK; out vec4 o;
void main() { float r = length(vQ) / 1.25; float a = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6) * uK * 1.35 + (1.0 - smoothstep(0.25, 0.6, r)) * uK * 0.35; if (a < 0.008) discard; o = vec4(0.0, 0.0, 0.0, min(a, 0.85)); }`;
const SHD = { buf: new Float32Array(1024 * 7), n: 0, vbo: null, vao: null };
const VS_MIST = `
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aS;
layout(location=2) in vec4 aC;
uniform mat4 uVP;
out vec2 vQ; out vec4 vC; out vec2 vW;
void main() {
  vec3 p = aS.xyz + vec3(aQ.x, 0.0, aQ.y) * aS.w;
  vQ = aQ; vC = aC; vW = p.xz;
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
function quadVAO() {
  const q = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, q); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
function initMist() {
  MST.vao = gl.createVertexArray(); gl.bindVertexArray(MST.vao); quadVAO();
  MST.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, MST.vbo); gl.bufferData(gl.ARRAY_BUFFER, MST.buf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
}
function mistAt(x, y, z, r, c, a) { if (MST.n >= 256) return; MST.buf.set([x, y, z, r, c[0], c[1], c[2], a], MST.n++ * 8); }
function drawMist() {
  if (!MST.n) return;
  const U = PR.mist.U; gl.useProgram(PR.mist.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform1f(U.uTime, S.t);
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  gl.bindBuffer(gl.ARRAY_BUFFER, MST.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, MST.buf, 0, MST.n * 8);
  gl.bindVertexArray(MST.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, MST.n);
  gl.disable(gl.BLEND); gl.depthMask(true);
}
function initShadows() {
  SHD.vao = gl.createVertexArray(); gl.bindVertexArray(SHD.vao); quadVAO();
  SHD.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SHD.vbo); gl.bufferData(gl.ARRAY_BUFFER, SHD.buf.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 0); gl.vertexAttribDivisor(1, 1);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 16); gl.vertexAttribDivisor(2, 1);
  gl.bindVertexArray(null);
}
function shadowAt(x, z, r) {
  if (SHD.n >= 1024) return;
  const h = groundH(x, z), hx = groundH(x + 0.5, z) - groundH(x - 0.5, z), hz = groundH(x, z + 0.5) - groundH(x, z - 0.5);
  SHD.buf.set([x, Math.max(h, isWet(tileNoGen(x, z)) ? WATER_Y : -99), z, r, -hx, 1, -hz], SHD.n++ * 7);
}
function drawShadows() {
  if (!SHD.n) return;
  const U = PR.shad.U; gl.useProgram(PR.shad.p); gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform1f(U.uK, 0.34 - S.darkness * 0.14);
  { const sx = -ENV.sun[0], sz = -ENV.sun[2], l = Math.hypot(sx, sz) || 1, k = clamp(1 - ENV.sun[1], 0.15, 0.7) * (1 - S.darkness * 0.6); gl.uniform2f(U.uSunXZ, sx / l * k, sz / l * k); }
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
  gl.bindBuffer(gl.ARRAY_BUFFER, SHD.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, SHD.buf, 0, SHD.n * 7);
  gl.bindVertexArray(SHD.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, SHD.n);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND); gl.depthMask(true);
}

// ---------- combat FX: ground telegraph decals, slash ribbons, rings ----------
const VS_FX = `
layout(location=0) in vec3 aP;
layout(location=1) in vec4 aC;
layout(location=2) in vec4 aU;
uniform mat4 uVP;
out vec4 vC; out vec4 vU;
void main() { vC = aC; vU = aU; gl_Position = uVP * vec4(aP, 1.0); }`;
const FS_FX = `
in vec4 vC; in vec4 vU;
uniform float uTime;
layout(location=0) out vec4 o;
void main() {
  float a; vec3 c = vC.rgb; float st = vU.w;
  if (st < 0.5) { // telegraph: x = side metric, y = radial/along metric, z = wind-up progress
    float x = vU.x, y = vU.y, p = vU.z;
    float edge = max(smoothstep(0.86, 0.95, x), smoothstep(0.93, 0.985, y));
    float fill = y < p ? 0.42 : 0.12;
    float front = (1.0 - smoothstep(0.0, 0.04, abs(y - p))) * 0.55 * step(0.03, p);
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) * 0.05 - uTime * 1.5)) * 0.07;
    a = max(edge * 0.95, fill + front + stripe);
    c = mix(c, vec3(1.0), front * 0.7 + edge * 0.12);
  } else if (st < 1.5) { // ring band: y 0 inner .. 1 outer
    float y = vU.y; a = smoothstep(0.0, 0.35, y) * (1.0 - smoothstep(0.85, 1.0, y));
    c = mix(c, vec3(1.0), smoothstep(0.35, 0.7, y) * 0.5);
  } else if (st < 2.5) { // slash ribbon: x tail->head, y inner->outer
    float x = vU.x, y = vU.y;
    a = smoothstep(0.0, 0.3, x) * smoothstep(0.0, 0.18, y);
    a = a > 0.45 ? 1.0 : a * 2.0;
    c = mix(c, vec3(1.0), smoothstep(0.5, 0.92, y) * smoothstep(0.3, 1.0, x));
  } else if (st < 3.5) { // aim line: x side, y along, z = locked
    float x = vU.x, y = vU.y;
    a = (1.0 - smoothstep(0.35, 1.0, x)) * (0.3 + 0.7 * vU.z) * (1.0 - y * 0.7);
    a *= 0.55 + 0.45 * step(0.5, fract(y * 22.0 - uTime * 5.0));
  } else { // light shaft: x across, y from the window (0) to the floor (1); slow drifting dust
    float x = vU.x, y = vU.y;
    a = smoothstep(0.0, 0.22, x) * (1.0 - smoothstep(0.78, 1.0, x)) * (1.0 - y * 0.6);
    a *= 0.8 + 0.2 * sin(uTime * 0.9 + gl_FragCoord.x * 0.03 + gl_FragCoord.y * 0.02);
  }
  a *= vC.a;
  if (a < 0.01) discard;
  o = vec4(c, min(a, 1.0));
}`;
const FXF = 11;
function mkFXB(max) { return { max, buf: new Float32Array(max * FXF), n: 0, vbo: null, vao: null }; }
const FXG = mkFXB(24000), FXA = mkFXB(12000);
function initFX() {
  for (const B of [FXG, FXA]) {
    B.vao = gl.createVertexArray(); gl.bindVertexArray(B.vao);
    B.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferData(gl.ARRAY_BUFFER, B.buf.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FXF * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, FXF * 4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, FXF * 4, 28);
    gl.bindVertexArray(null);
  }
}
// v = [x, y, z, u0, u1]
function fxv(B, v, col, z, w) {
  if (B.n >= B.max) return; const o = B.n++ * FXF, A = B.buf;
  A[o] = v[0]; A[o + 1] = v[1]; A[o + 2] = v[2]; A[o + 3] = col[0]; A[o + 4] = col[1]; A[o + 5] = col[2]; A[o + 6] = col[3]; A[o + 7] = v[3]; A[o + 8] = v[4]; A[o + 9] = z; A[o + 10] = w;
}
function fxq(B, a, b, c, d, col, z, w) { fxv(B, a, col, z, w); fxv(B, b, col, z, w); fxv(B, c, col, z, w); fxv(B, a, col, z, w); fxv(B, c, col, z, w); fxv(B, d, col, z, w); }
const decalY = (x, z) => Math.max(groundH(x, z), isWet(tileNoGen(x, z)) ? WATER_Y : -99) + 0.07;
// polar decal: full circle (arc = PI, full = true) or sector of half-angle arc
function decalPolar(B, cx, cz, dir, arc, R, col, prog, style, full) {
  if (!inView(cx, groundH(cx, cz), cz, R + 1)) return;
  const N = full ? 36 : Math.max(6, Math.ceil(arc * 2 / 0.14)), K = clamp(Math.ceil(R / 1.1), 2, 6);
  const G = [];
  for (let k = 0; k <= K; k++) {
    const row = [], r = R * k / K;
    for (let i = 0; i <= N; i++) {
      const th = full ? i / N * TAU : dir - arc + 2 * arc * i / N, x = cx + Math.cos(th) * r, z = cz + Math.sin(th) * r;
      row.push([x, decalY(x, z), z, full ? 0 : Math.abs(th - dir) / arc, r / R]);
    }
    G.push(row);
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) fxq(B, G[k][i], G[k + 1][i], G[k + 1][i + 1], G[k][i + 1], col, prog, style);
}
function decalLine(B, x0, z0, dir, len, w, col, prog, style) {
  const c = Math.cos(dir), s = Math.sin(dir), nx = -s * w / 2, nz = c * w / 2, L = Math.max(1, Math.ceil(len / 0.8));
  if (!inView(x0 + c * len / 2, groundH(x0, z0), z0 + s * len / 2, len / 2 + 1)) return;
  const G = [];
  for (let i = 0; i <= L; i++) {
    const t = i / L, px = x0 + c * len * t, pz = z0 + s * len * t, row = [];
    for (const q of [-1, 0, 1]) { const x = px + nx * q, z = pz + nz * q; row.push([x, decalY(x, z), z, Math.abs(q), t]); }
    G.push(row);
  }
  for (let i = 0; i < L; i++) for (let j = 0; j < 2; j++) fxq(B, G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1], col, prog, style);
}
// horizontal ring band (expanding flash); follows the ground when low
function fxRing(B, cx, cz, h, r, col) {
  const N = 40, gh = groundH(cx, cz), low = h < 0.5, r0 = r * 0.62;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const th = i / N * TAU, c = Math.cos(th), s = Math.sin(th);
    const ax = cx + c * r0, az = cz + s * r0, bx = cx + c * r, bz = cz + s * r;
    const a = [ax, low ? decalY(ax, az) + h : gh + h, az, 0, 0], b = [bx, low ? decalY(bx, bz) + h : gh + h, bz, 0, 1];
    if (prev) fxq(B, prev[0], a, b, prev[1], col, 0, 1);
    prev = [a, b];
  }
}
const easeOut = t => 1 - (1 - t) * (1 - t);
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// crescent slash ribbon; side picks the sweep direction (+1 / -1)
function fxSlash(B, f) {
  const p = f.t / f.dur, head = easeOut(clamp(p * 1.55, 0, 1)), tail = clamp(p * 1.55 - 0.42, 0, 1) * 0.98;
  if (head - tail < 0.02) return;
  const alpha = (f.col[3] || 1) * 0.42 * (1 - smoothstep(0.5, 1.0, p)), col = [f.col[0] * 0.92, f.col[1] * 0.94, f.col[2], alpha];
  const gh = groundH(f.x, f.y), N = 18, th = f.heavy ? 0.62 : 0.42;
  const start = f.dir - f.side * f.arc * 1.05, end = f.dir + f.side * f.arc * 1.05;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const q = i / N, s = tail + (head - tail) * q, ang = start + (end - start) * s, c = Math.cos(ang), sn = Math.sin(ang);
    const wid = f.r * th * Math.pow(q, 0.55) + 0.03, ro = f.r, ri = Math.max(0.1, f.r - wid);
    let a, b;
    if (f.heavy) { // vertical overhead arc in the attack plane
      const dc = Math.cos(f.dir), ds = Math.sin(f.dir), phi = lerp(1.9, -0.35, s);
      a = [f.x + dc * Math.cos(phi) * ri, gh + f.h + 0.35 + Math.sin(phi) * ri, f.y + ds * Math.cos(phi) * ri, q, 0];
      b = [f.x + dc * Math.cos(phi) * ro, gh + f.h + 0.35 + Math.sin(phi) * ro, f.y + ds * Math.cos(phi) * ro, q, 1];
    } else {
      const y = gh + f.h + (s - 0.5) * 0.45 * f.side;
      a = [f.x + c * ri, y, f.y + sn * ri, q, 0]; b = [f.x + c * ro, y + 0.05, f.y + sn * ro, q, 1];
    }
    if (prev) fxq(B, prev[0], a, b, prev[1], col, 0, 2);
    prev = [a, b];
  }
}
function fxThrust(B, x, z, h, dir, len, p, colIn) {
  const alpha = (colIn[3] || 1) * (1 - smoothstep(0.5, 1, p)), col = [colIn[0], colIn[1], colIn[2], alpha];
  const head = easeOut(clamp(p * 2, 0, 1)), tail = clamp(p * 2 - 0.5, 0, 1);
  if (head - tail < 0.02) return;
  const c = Math.cos(dir), s = Math.sin(dir), gy = groundH(x, z) + h, N = 6;
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const q = i / N, d = 0.3 + lerp(tail, head, q) * len, w = 0.05 + 0.18 * Math.sin(Math.min(1, q * 1.15) * Math.PI * 0.85);
    const cx = x + c * d, cz = z + s * d;
    const L = [cx - s * w, gy, cz + c * w, q, 0], M = [cx, gy + 0.02, cz, q, 1], R = [cx + s * w, gy, cz - c * w, q, 0];
    if (prev) { fxq(B, prev[0], L, M, prev[1], col, 0, 2); fxq(B, prev[1], M, R, prev[2], col, 0, 2); }
    prev = [L, M, R];
  }
}
const TEL_Y = [1.0, 0.84, 0.16, 0.9], TEL_R = [1.0, 0.2, 0.14, 0.9];
function buildTelegraphs() {
  const B = FXG;
  for (const e of S.ents) {
    if (e.dead || e.team !== 1) continue;
    if (Math.abs(e.x - CAM.x) > 40 || Math.abs(e.y - CAM.y) > 40) continue;
    const a = e.atk;
    if (e.state === 'wind' && a) {
      const hit = a.k === 'combo' ? a.hits[e.hitIdx] : a, W = foeWind(a, e.hitIdx), p = e.wt < 0 ? 0 : clamp(e.wt / W, 0, 1);
      const col = hit.col === 'r' ? TEL_R : TEL_Y;
      switch (a.k) {
        case 'melee': case 'grab': case 'sweep': case 'combo': decalPolar(B, e.x, e.y, e.wdir, hit.arc, hit.rng + 0.25, col, p, 0, false); break;
        case 'line': decalLine(B, e.x, e.y, e.wdir, a.len + (a.lunge || 0), a.w, col, p, 0); break;
        case 'lunge': decalLine(B, e.x, e.y, e.wdir, a.len + 1.2, a.w, col, p, 0); break;
        case 'charge': decalLine(B, e.x, e.y, e.wdir, a.len, a.w, col, p, 0); break;
        case 'slam': case 'nova': case 'screech': decalPolar(B, e.x, e.y, 0, Math.PI, a.rad, col, p, 0, true); break;
        case 'aoe': case 'throw': case 'bomb': if (e.aoe) decalPolar(B, e.aoe.x, e.aoe.y, 0, Math.PI, a.rad, col, p, 0, true); break;
        case 'snatch': decalPolar(B, e.x, e.y, e.wdir, a.arc, a.rng + 0.25, col, p, 0, false); break;
        case 'chant': decalPolar(B, e.x, e.y, 0, Math.PI, 1.3, col, p, 0, true); fxRing(B, e.x, e.y, 0.05, lerp(0.6, a.rad || 9, p), [0.5, 1, 0.4, 0.35 * (1 - p)]); break;
      }
    } else if (e.state === 'aim' && a) {
      decalLine(B, e.x + Math.cos(e.wdir) * 0.6, e.y + Math.sin(e.wdir) * 0.6, e.wdir, 24, e.locked ? 0.3 : 0.18, a.col === 'r' ? TEL_R : TEL_Y, e.locked ? 1 : 0.15 + 0.3 * e.wt / a.aim, 3);
    } else if (e.state === 'gallop' && a) {
      decalLine(B, e.x, e.y, e.wdir, Math.max(0.5, e.gT * a.spd), a.w, TEL_R, 1, 0);
    }
  }
  for (const m of S.marks) decalPolar(B, m.x, m.y, 0, Math.PI, m.rad || 2.5, TEL_R, clamp(1 - m.t / (m.T0 || 1), 0, 1), 0, true);
  if (S.mode !== 'play') return;
  // lock-on ground ring
  if (P.lock && !P.lock.dead) { const e = P.lock, pul = 0.5 + 0.5 * Math.sin(S.t * 8); fxRing(B, e.x, e.y, 0.03, e.r + 0.45 + pul * 0.08, [1, 0.42, 0.25, 0.85]); }
  // heavy charge / bow draw timing rings (shrink onto the sweet spot)
  const a = P.act;
  if (a && (a.k === 'charge' || a.k === 'bow')) {
    const two = twoHanded() ? ITEMS[P.hands[1]] : null;
    const full = a.k === 'bow' ? (two ? two.draw : 0.6) : (CHARGE_FULL[weaponKey(mainItem())] || 0.7), win = a.k === 'bow' ? 0.14 : 0.16;
    const k = clamp(a.t / full, 0, 1), sweet = a.t >= full && a.t <= full + win, late = a.t > full + win;
    fxRing(B, P.x, P.y, 0.04, 0.95, [1, 1, 1, 0.35]);
    fxRing(B, P.x, P.y, 0.05, lerp(2.6, 0.95, k), sweet ? [1, 0.82, 0.2, 1] : late ? [0.6, 0.6, 0.7, 0.5] : [0.75, 0.95, 1, 0.8]);
  }
}
function buildAirFX() {
  const B = FXA;
  for (const f of S.fx) {
    if (!inView(f.x, groundH(f.x, f.y) + 1, f.y, (f.r || f.r1 || f.len || 3) + 1)) continue;
    if (f.k === 'slash') { if (f.thrust) fxThrust(B, f.x, f.y, f.h, f.dir, f.r, f.t / f.dur, f.col); else fxSlash(B, f); }
    else if (f.k === 'thrust') fxThrust(B, f.x, f.y, 1.0, f.dir, f.len, f.t / f.dur, f.col);
    else if (f.k === 'ring') { const p = f.t / f.dur; fxRing(B, f.x, f.y, f.h, lerp(f.r0, f.r1, easeOut(p)), [f.col[0], f.col[1], f.col[2], f.col[3] * (1 - p * p)]); }
  }
}
function drawFX(B, ground) {
  if (!B.n) return;
  const U = PR.fx.U; gl.useProgram(PR.fx.p);
  gl.uniformMatrix4fv(U.uVP, false, CAM.vp); gl.uniform1f(U.uTime, S.t);
  gl.enable(gl.BLEND); gl.depthMask(false);
  gl.blendColor(0, 0, 0, ground ? 0.12 : 0.55); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE);
  if (ground) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -6); }
  gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, B.buf, 0, B.n * FXF);
  gl.bindVertexArray(B.vao); gl.drawArrays(gl.TRIANGLES, 0, B.n);
  gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND); gl.depthMask(true);
}

// ---------- actors: appearance -> rigged mesh, state -> pose -> bone matrices ----------
const BONES = new Float32Array(18 * 16), PBONES = new Float32Array(18 * 16), BW = [], TMPM = m4(), TMPM2 = m4(), MODELM = m4(), RIDERM = m4();
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
const lerpA = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
// arm angles are [pitch, yaw, roll]: pitch < 0 lifts the arm forward, yaw > 0 swings it to the model's left (+X), roll is outward
const runK = spd => clamp((spd - 0.55) / 0.45, 0, 1);
// arms swing against the legs; running pumps them harder and carries them bent forward
const walkA = (side, ph, spd) => { const r = runK(spd); return [Math.sin(ph) * (0.42 + 0.36 * r) * spd * -side - 0.05 - 0.22 * r * spd, 0, 0.08 + (1 - spd) * 0.04 + 0.06 * r]; };
const guardA = side => [-1.05, -side * 0.45, -0.15];
function swingA(side, sw, u) {
  const sd = sw * -side;
  if (u < 0.3) { const k = ease(u / 0.3); return [lerp(-0.6, -1.85, k), lerp(0.2, 1.45, k) * sd, 0.1]; }
  if (u < 0.85) { const k = 1 - Math.pow(1 - (u - 0.3) / 0.55, 2.2); return [lerp(-1.85, -1.3, k), lerp(1.45, -1.3, k) * sd, 0.1]; }
  const k = (u - 0.85) / 0.15; return [lerp(-1.3, -0.8, k), lerp(-1.3, -0.95, k) * sd, 0.1];
}
function thrustA(side, u) {
  if (u < 0.3) { const k = ease(u / 0.3); return [lerp(-0.7, -1.0, k), side * 0.45 * k, 0.05]; }
  if (u < 0.85) { const k = easeOut((u - 0.3) / 0.55); return [lerp(-1.0, -1.62, k), lerp(side * 0.45, -side * 0.08, k), 0]; }
  return [lerp(-1.62, -1.1, (u - 0.85) / 0.15), -side * 0.08, 0];
}
function overheadA(side, u) {
  if (u < 0.3) return [-2.9, -side * 0.12, 0.05];
  if (u < 0.85) { const k = easeOut((u - 0.3) / 0.55); return [lerp(-2.9, -0.55, k), -side * 0.12, 0.05]; }
  return [lerp(-0.55, -0.8, (u - 0.85) / 0.15), -side * 0.12, 0.05];
}
function punchA(side, u, hook) {
  if (hook) { if (u < 0.3) return lerpA(guardA(side), [-1.35, side * 0.95, 0.35], ease(u / 0.3)); if (u < 0.85) return lerpA([-1.35, side * 0.95, 0.35], [-1.42, -side * 0.6, 0.1], easeOut((u - 0.3) / 0.55)); return lerpA([-1.42, -side * 0.6, 0.1], guardA(side), (u - 0.85) / 0.15); }
  const e = Math.sin(clamp((u - 0.15) / 0.85, 0, 1) * Math.PI);
  return lerpA(guardA(side), [-1.62, -side * 0.22, 0], Math.pow(e, 0.6));
}
// fraction of a swing: 0..0.3 wind-up, 0.3..0.85 active, 0.85..1 recovery
function swingU(a) {
  const mv = a.mv, t = a.t;
  if (t < mv.w) return 0.3 * t / mv.w;
  if (t < mv.w + mv.a) return 0.3 + 0.55 * (t - mv.w) / mv.a;
  return Math.min(1, 0.85 + 0.15 * (t - mv.w - mv.a) / mv.r);
}
// o: { k, ph, spd, aL, aR, tw, lean, flinch, legs, cape, breath, nod, hipY }
function computeHumanBones(o) {
  const k = o.k || 1, ph = o.ph || 0, spd = o.spd || 0, run = runK(spd), sn = Math.sin(ph), cs = Math.cos(ph), walking = !o.legs;
  for (const m of BW) m.set(UNITM);
  const bob = walking ? ((0.5 + 0.5 * Math.cos(2 * ph)) * (0.03 + 0.05 * run) - 0.025 * run) * spd * k : 0;
  const hipRoll = walking ? cs * 0.05 * spd : 0;
  boneLocal(BW[BN.hips], PIV[BN.hips], k, (walking ? sn * 0.14 * spd : 0) + (o.tw || 0) * 0.3, 0, hipRoll, 0, bob + (o.breath || 0) + (o.hipY || 0) * k, 0);
  const tw = (o.tw || 0) * 0.7 - (walking ? sn * 0.24 * spd : 0);
  boneLocal(TMPM, PIV[BN.torso], k, tw, (o.lean || 0) + spd * (0.05 + 0.17 * run) - (o.flinch || 0) * 0.35, -hipRoll * 0.7); m4mul(BW[BN.torso], BW[BN.hips], TMPM);
  boneLocal(TMPM, PIV[BN.head], k, -tw * 0.6, -(o.flinch || 0) * 0.25 + (o.nod || 0) - (o.lean || 0) * 0.4 - spd * 0.1 * run, hipRoll * 0.5); m4mul(BW[BN.head], BW[BN.torso], TMPM);
  for (const side of [1, -1]) {
    const a = (side > 0 ? o.aL : o.aR) || walkA(side, ph, spd);
    boneLocal(TMPM, PIV[side > 0 ? BN.armL : BN.armR], k, a[1], a[0], side * a[2]); m4mul(BW[side > 0 ? BN.armL : BN.armR], BW[BN.torso], TMPM);
    // thigh: negative pitch = forward. Knee flexes while the leg swings forward, a little in stance.
    let lp = sn * (0.46 + 0.3 * run) * spd * side, lr = side * 0.02, kn = Math.max(0.04, (Math.max(0, -cs * side) * (0.6 + 0.95 * run) + 0.06 + 0.14 * run) * spd);
    switch (o.legs) {
      case 'ride': lp = -0.95; lr = side * 0.42; kn = 1.05; break;
      case 'sit': lp = -1.35; lr = side * 0.12; kn = 1.4; break;
      case 'dash': lp = side > 0 ? -0.8 : 0.65; lr = side * 0.05; kn = side > 0 ? 0.75 : 0.45; break;
      case 'lunge': lp = side > 0 ? -0.55 : 0.45; lr = side * 0.08; kn = side > 0 ? 0.45 : 0.15; break;
      case 'brace': lp = side > 0 ? -0.25 : 0.2; lr = side * 0.22; kn = 0.3; break;
    }
    const lb = side > 0 ? BN.legL : BN.legR, sb = side > 0 ? BN.shinL : BN.shinR;
    boneLocal(TMPM, PIV[lb], k, 0, lp, lr); m4mul(BW[lb], BW[BN.hips], TMPM);
    boneLocal(TMPM, PIV[sb], k, 0, kn, 0); m4mul(BW[sb], BW[lb], TMPM);
  }
  boneLocal(TMPM, PIV[BN.cape], k, 0, 0.12 + (o.cape || 0) + Math.sin(S.t * 3.1 + ph) * 0.05 * (0.4 + spd), 0); m4mul(BW[BN.cape], BW[BN.torso], TMPM);
  for (let i = 0; i < 18; i++) BONES.set(BW[i], i * 16);
}
// horse gaits, blended by speed: 4-beat walk, diagonal trot, transverse gallop.
// off = phase of FL, FR, BL, BR in the stride; duty = share of the stride the hoof is on the ground
const GAITS = [
  { off: [0.25, 0.75, 0.0, 0.5], duty: 0.66, A: 0.3, F: 0.8, bob: 0.025, pitch: 0.012, nod: 0.05, beat: 2 },
  { off: [0.0, 0.5, 0.5, 0.0], duty: 0.5, A: 0.42, F: 1.05, bob: 0.07, pitch: 0.02, nod: 0.04, beat: 2 },
  { off: [0.58, 0.7, 0.0, 0.12], duty: 0.38, A: 0.66, F: 1.3, bob: 0.13, pitch: 0.1, nod: 0.16, beat: 1 }
];
const HLEGS = [[BN.hFL, 1, 0], [BN.hFR, 2, 1], [BN.hBL, 3, 2], [BN.hBR, 4, 3]];
function gaitAt(g) {
  let a, b, w;
  if (g < 0.4) { a = GAITS[0]; b = GAITS[1]; w = smooth(clamp((g - 0.22) / 0.14, 0, 1)); }
  else { a = GAITS[1]; b = GAITS[2]; w = smooth(clamp((g - 0.55) / 0.15, 0, 1)); }
  const L = (x, y) => x + (y - x) * w;
  return { off: a.off.map((v, i) => L(v, b.off[i])), duty: L(a.duty, b.duty), A: L(a.A, b.A), F: L(a.F, b.F), bob: L(a.bob, b.bob), pitch: L(a.pitch, b.pitch), nod: L(a.nod, b.nod), beat: w > 0.5 ? b.beat : a.beat };
}
// stride length (world units per full cycle) so hooves don't skate: short walk steps, long gallop bounds
const strideOf = g => lerp(1.7, 6.0, smooth(clamp((g - 0.15) / 0.6, 0, 1)));
function computeHorseBones(ps, spd, rear) {
  for (const m of BW) m.set(UNITM);
  const mv = clamp(spd / 0.12, 0, 1), G = gaitAt(spd), ph = ps / TAU;
  const bob = G.bob * (0.5 + 0.5 * Math.cos(TAU * ph * G.beat)) * mv + (1 - mv) * Math.sin(S.t * 1.6) * 0.008;
  const pitch = G.pitch * Math.sin(TAU * ph) * mv - (rear || 0);
  boneLocal(BW[BN.hbody], PIV[BN.hbody], 1, 0, pitch, 0, 0, bob, 0);
  for (const [ub, lb, i] of HLEGS) {
    const u = ((ph + G.off[i]) % 1 + 1) % 1, front = i < 2;
    let ang, fold;
    if (u < G.duty) { ang = lerp(-G.A, G.A, u / G.duty); fold = 0.04; }
    else { const t = (u - G.duty) / (1 - G.duty); ang = lerp(G.A, -G.A, smooth(t)); fold = Math.sin(Math.PI * t) * G.F; }
    ang *= mv; fold *= mv;
    boneLocal(TMPM, PIV[ub], 1, 0, ang - (front ? 0 : pitch * 0.5), 0); m4mul(BW[ub], BW[BN.hbody], TMPM);
    boneLocal(TMPM, HPIVL[lb], 1, 0, front ? fold : -fold * 0.65, 0); m4mul(BW[lb], BW[ub], TMPM);
  }
  const nod = -pitch * 1.2 + G.nod * Math.sin(TAU * ph + 0.8) * mv + (1 - mv) * Math.sin(S.t * 0.8) * 0.04;
  boneLocal(TMPM, PIV[BN.hneck], 1, 0, nod, 0); m4mul(BW[BN.hneck], BW[BN.hbody], TMPM);
  boneLocal(TMPM, PIV[BN.htail], 1, Math.sin(S.t * 1.3) * 0.2 * (1 - mv * 0.5), 0.25 + spd * 0.55 + bob * 2, 0); m4mul(BW[BN.htail], BW[BN.hbody], TMPM);
  for (let i = 0; i < 18; i++) BONES.set(BW[i], i * 16);
}
let MESHU = null, idSeq = 1;
function setId(ow) { gl.uniform1f(MESHU.uId, idSeq); idSeq = idSeq % 95 + 1; gl.uniform1f(MESHU.uOW, ow); }
let AOG_OVR = null;
function drawRig(mesh, model, tint, tintA) {
  const U = MESHU;
  gl.uniformMatrix4fv(U.uModel, false, model); gl.uniformMatrix4fv(U.uBones, false, BONES);
  if (U.uAoG) gl.uniform1f(U.uAoG, AOG_OVR !== null ? AOG_OVR : model[13]);
  if (tintA) { gl.uniform3fv(U.uTint, tint); gl.uniform1f(U.uTintA, tintA); }
  gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  if (tintA) gl.uniform1f(U.uTintA, 0);
}
function drawPlain(mesh, model, tint, ta) {
  const U = MESHU; gl.uniform1i(U.uMode, 0);
  gl.uniformMatrix4fv(U.uModel, false, model);
  if (ta) { gl.uniform3fv(U.uTint, tint); gl.uniform1f(U.uTintA, ta); }
  gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  if (ta) gl.uniform1f(U.uTintA, 0);
  gl.uniform1i(U.uMode, 2);
}
function humanMesh(key, spec) { return namedMesh('H|' + key, () => buildHuman(spec)); }
function horseMesh(key, o) { return namedMesh('Hs|' + key, () => buildHorse(o)); }
const PLAYER_HORSE = { coat: '#b0703c', dark: '#3a2414', saddle: true, cloth: '#3a7ae8', blaze: true };
const DRAGOON_HORSE = { coat: '#4a3424', dark: '#1a100a', saddle: true, cloth: '#d83a30', stockings: true };
const PLAYER_CAPE = { cape: '#c8282a', capeIn: '#8a1418' };
const playerSheathed = () => S.mode === 'title' || (P.sheathT || 0) > 2.2;
function playerKey() { return 'P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-') + '|' + (playerSheathed() ? 's' : 'd'); }
function playerSpec() {
  const look = ARMOR_LOOK[P.armor] || ARMOR_LOOK.tunic, sheathed = playerSheathed();
  const two = twoHanded() ? ITEMS[P.hands[1]] : null;
  let L = null, R = null; const sheath = [];
  if (two) {
    const sp = itemSpec(two.id);
    if (two.type === 'bow') { if (sheathed) sheath.push({ slot: 'bowback', it: sp }); else L = sp; sheath.push({ slot: 'quiver' }); }
    else { if (sheathed) sheath.push({ slot: 'back2', it: sp, full: true }); else { R = sp; sheath.push({ slot: 'back2', it: sp }); } }
  } else {
    for (const h of [0, 1]) {
      const id = P.hands[h], it = id && ITEMS[id], sp = itemSpec(id), side = h === 0 ? 1 : -1;
      let inHand = !!sp;
      if (it && it.type === 'sword') { sheath.push({ slot: 'hip', side: -side, it: sp, full: sheathed }); inHand = !sheathed; }
      else if (it && it.type === 'shield' && sheathed) { sheath.push({ slot: 'shback', it: sp }); inHand = false; }
      else if (it && it.type === 'gun') { sheath.push({ slot: 'holster', side, it: sp, full: sheathed }); inHand = !sheathed; }
      if (inHand) { if (h === 0) L = sp; else R = sp; }
    }
  }
  return Object.assign({ skin: '#f8cca4', hair: '#6a3e1e' }, look, PLAYER_CAPE, { L, R, sheath });
}
let TORCH_TIP = null, WEAPON_TIP = null, NEAR_FOE = false;
function handPoint(boneM, model, side, lx, ly, lz) {
  const b = boneM, x = side * HANDM.x + lx, y = HANDM.y + ly, z = HANDM.z + lz;
  const bx = b[0] * x + b[4] * y + b[8] * z + b[12], by = b[1] * x + b[5] * y + b[9] * z + b[13], bz = b[2] * x + b[6] * y + b[10] * z + b[14];
  return [model[0] * bx + model[4] * by + model[8] * bz + model[12], model[1] * bx + model[5] * by + model[9] * bz + model[13], model[2] * bx + model[6] * by + model[10] * bz + model[14]];
}
function playerPose() {
  const a = P.act, m = P.mounted, two = twoHanded() ? ITEMS[P.hands[1]] : null;
  const spd = m ? 0 : clamp(Math.hypot(P.vx, P.vy) / 4.9, 0, 1), ph = P.step * 2.3;
  const mh = mainHand(), it = mainItem(), combat = NEAR_FOE || !!P.lock;
  const o = { ph, spd, cape: m ? 0.2 + clamp(Math.abs(P.v) / 10, 0, 1) * 0.45 : spd * 0.35, breath: Math.sin(S.t * 2) * 0.006, legs: m ? 'ride' : undefined, aL: null, aR: null, tw: 0, lean: m ? clamp(Math.abs(P.v) / 10, 0, 1) * 0.15 : 0 };
  const set = (side, v) => { if (side > 0) o.aL = v; else o.aR = v; };
  for (const side of [1, -1]) {
    const id = P.hands[side > 0 ? 0 : 1], item = id && ITEMS[id];
    if (m) set(side, [-0.5, side * 0.1, 0.12]);
    else set(side, walkA(side, ph, spd));
    if (item && item.type === 'torch') set(side, [-0.72 + Math.sin(ph) * 0.05 * spd, 0, 0.12]);
    if (item && item.type === 'shield' && combat) set(side, [-0.85, -side * 0.55, 0.05]);
  }
  if (!it && !two && combat && !m) { set(1, guardA(1)); set(-1, guardA(-1)); o.legs = 'brace'; o.lean = 0.08; }
  if (P.blocking) { const sh = P.hands[0] && ITEMS[P.hands[0]].type === 'shield' ? 1 : -1; set(sh, [-1.2, -sh * 1.3, 0]); }
  if (P.parryT > 0 && offKind() === 'shield') { const sh = P.hands[0] && ITEMS[P.hands[0]].type === 'shield' ? 1 : -1; set(sh, [-1.4, -sh * 1.2, 0]); }
  const wS = mh === 0 ? 1 : -1;
  if (a) switch (a.k) {
    case 'atk': {
      const mv = a.mv, u = swingU(a), side = a.wk === 'fists' ? (mv.sw > 0 ? 1 : -1) : (a.hand === 0 ? 1 : -1);
      if (a.wk === 'ride') {
        const d = angDiff(P.a, a.dir), rs = d > 0 ? -1 : 1, k = u < 0.3 ? 0 : easeOut(clamp((u - 0.3) / 0.55, 0, 1));
        set(side, [-1.45, lerp(rs * 0.2, rs * 2.1, k), 0.1]); o.tw = rs * 0.3 * k;
      } else if (a.wk === 'fists' && !mv.heavy) {
        set(side, punchA(side, u, mv.n === 'hook')); set(-side, guardA(-side));
        o.tw = mv.n === 'hook' ? lerp(side * 0.6, -side * 0.5, clamp((u - 0.3) / 0.55, 0, 1)) : -side * 0.4 * Math.sin(clamp(u, 0, 1) * Math.PI);
        o.legs = 'lunge'; o.lean = 0.12;
      } else if (mv.heavy) {
        if (a.wk === 'fists') { const e = u < 0.3 ? 0 : Math.sin(clamp((u - 0.3) / 0.7, 0, 1) * Math.PI); set(side, lerpA([0.5, side * 0.2, 0.2], [-1.65, -side * 0.2, 0], e)); set(-side, guardA(-side)); o.tw = -side * 0.6 * e; }
        else { set(side, overheadA(side, u)); if (two || a.wk === 'sword2') set(-side, overheadA(-side, u)); }
        o.lean = u > 0.3 ? 0.35 : -0.1; o.legs = 'lunge';
      } else if (mv.sw === 0) {
        set(side, thrustA(side, u)); o.lean = u > 0.3 && u < 0.9 ? 0.3 : 0; o.legs = 'lunge'; o.tw = -side * 0.25;
      } else {
        const v = swingA(side, mv.sw, u); set(side, v);
        if (two || a.wk === 'sword2') set(-side, [v[0], v[1], 0.1]);
        o.tw = v[1] * 0.35; if (u > 0.3 && u < 0.9 && !m) o.legs = 'lunge';
      }
      break;
    }
    case 'charge': {
      const wk = weaponKey(it), tr = Math.sin(S.t * 60) * 0.03;
      if (wk === 'fists') { set(-1, [0.55 + tr, -0.2, 0.25]); set(1, guardA(1)); o.tw = 0.5; o.lean = -0.1; }
      else { const s = mh === 0 ? 1 : -1; set(s, [-2.8 + tr, -s * 0.12, 0.05]); if (two || wk === 'sword2') set(-s, [-2.8 + tr, s * 0.12, 0.05]); o.lean = -0.12; }
      if (!m) o.legs = 'brace';
      break;
    }
    case 'dash': set(1, [-1.35, 0.35, 0.25]); set(-1, [-1.35, -0.35, 0.25]); o.lean = 0.65; o.nod = 0.45; o.legs = 'sit'; o.cape = 0.3; break;
    case 'bow': set(1, [-1.52, -0.12, 0]); set(-1, [-1.4, -0.62, 0]); o.tw = -0.25; break;
    case 'shoot': { const s = a.hand === 0 ? 1 : -1; set(s, [-1.55, -s * 0.05, 0]); break; }
    case 'parry': { const kind = offKind(); if (kind === 'parryW') set(wS, [-1.85, -wS * 0.95, 0.3]); else { set(1, [-1.45, 0.35, 0.3]); set(-1, [-1.45, -0.35, 0.3]); } o.lean = 0.05; break; }
    case 'grab': {
      const k = clamp((a.t - 0.22) / 0.2, 0, 1);
      if (a.t < 0.22) { set(1, [-1.55, -0.25, 0]); set(-1, [-1.55, 0.25, 0]); }
      else { set(1, [-2.6, 0, 0.1]); set(-1, [-2.6, 0, 0.1]); o.tw = -2.2 * k; o.lean = 0.3 * k; }
      break;
    }
    case 'stun': o.flinch = 1 - a.t / a.dur; set(1, [0.25, 0.1, 0.35]); set(-1, [0.25, -0.1, 0.35]); break;
  }
  if (P.hurtT > 0) o.flinch = Math.max(o.flinch || 0, P.hurtT / 0.3);
  return o;
}
function drawPlayer() {
  const spec = playerSpec(), m = P.mounted, dying = S.mode === 'dying' || S.mode === 'over';
  const key = playerKey();
  const mesh = humanMesh(key, spec), gh = groundH(P.x, P.y), yaw = yawOf(P.a);
  const o = playerPose();
  const charge = P.act && P.act.k === 'charge', full = charge ? (CHARGE_FULL[weaponKey(mainItem())] || 0.7) : 0;
  const sweet = charge && P.act.t >= full && P.act.t <= full + 0.16;
  let tint = null, ta = 0;
  if (P.hurtT > 0 && ((S.t * 20) | 0) % 2) { tint = [1, 0.3, 0.2]; ta = 0.6; }
  else if (sweet) { tint = [1, 0.85, 0.3]; ta = 0.35; }
  else if (P.counterT > 0 || P.riposteT > 0) { tint = [1, 0.7, 0.3]; ta = 0.15 + 0.15 * Math.sin(S.t * 18); }
  else if (P.iframes > 0) { tint = [0.7, 0.95, 1]; ta = 0.3; }
  setId(1);
  const wS = mainHand() === 0 ? 1 : -1, armB = wS > 0 ? BN.armL : BN.armR, it = mainItem();
  if (m) {
    const hs = clamp(Math.abs(P.v) / 10.5, 0, 1);
    P._hph = (P._hph || 0) + (P.step - (P._hst === undefined ? P.step : P._hst)) / strideOf(hs); P._hst = P.step;
    computeHorseBones(P._hph * TAU, hs, P.burstT > 0 ? 0.08 : 0);
    m4trs(MODELM, P.x, gh, P.y, yaw, 0, 0, 1);
    drawRig(horseMesh('player', PLAYER_HORSE), MODELM, tint, ta * 0.5);
    m4mul(TMPM2, MODELM, BW[BN.hbody]); m4trs(TMPM, 0, 1.06 - LIFT, -0.06, 0, 0, 0, 1); m4mul(RIDERM, TMPM2, TMPM);
    computeHumanBones(o);
    AOG_OVR = gh; drawRig(mesh, RIDERM, tint, ta); AOG_OVR = null;
    PBONES.set(BONES);
    TORCH_TIP = hasTorch() ? handPoint(BW[P.hands[0] === 'torch' ? BN.armL : BN.armR], RIDERM, P.hands[0] === 'torch' ? 1 : -1, 0, 0, 0.78) : null;
    WEAPON_TIP = handPoint(BW[armB], RIDERM, wS, 0, it ? -0.38 : 0, it ? 0.4 : 0.05);
    shadowAt(P.x, P.y, 1.25);
    return;
  }
  computeHumanBones(o);
  const rolling = P.act && P.act.k === 'dash' && !dying;
  if (rolling) {
    const u = clamp(P.act.t / P.act.dur, 0, 1), spin = TAU * (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u)), c = 0.5;
    m4trs(TMPM2, P.x, gh + c, P.y, yaw, spin, 0, 1); m4trs(TMPM, 0, -c, 0, 0, 0, 0, 1); m4mul(MODELM, TMPM2, TMPM);
  } else m4trs(MODELM, P.x, gh + (dying ? 0.15 : 0), P.y, yaw, dying ? -Math.PI / 2 : 0, 0, 1);
  drawRig(mesh, MODELM, tint, ta);
  PBONES.set(BONES);
  TORCH_TIP = hasTorch() && !dying ? handPoint(BW[P.hands[0] === 'torch' ? BN.armL : BN.armR], MODELM, P.hands[0] === 'torch' ? 1 : -1, 0, 0, 0.78) : null;
  WEAPON_TIP = handPoint(BW[armB], MODELM, wS, 0, it ? -0.38 : 0, it ? 0.4 : 0.05);
  shadowAt(P.x, P.y, 0.62);
}
// dash afterimages: the player's mesh in the current pose, translucent cyan
function drawGhosts() {
  if (!S.ghosts.length || S.mode === 'title' || P.mounted) return;
  const U = MESHU; gl.useProgram(PR.mesh.p);
  const mesh = humanMesh(playerKey(), playerSpec());
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendColor(0, 0, 0, 0.25); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE);
  gl.uniform1i(U.uMode, 2); gl.uniform3fv(U.uTint, [0.45, 0.85, 1.0]); gl.uniformMatrix4fv(U.uBones, false, PBONES);
  for (const g of S.ghosts) {
    gl.uniform1f(U.uGhost, clamp(g.t / 0.22, 0, 1) * 0.6);
    m4trs(MODELM, g.x, groundH(g.x, g.y), g.y, yawOf(g.a), 0, 0, 1);
    gl.uniformMatrix4fv(U.uModel, false, MODELM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }
  gl.uniform1f(U.uGhost, 0);
  gl.disable(gl.BLEND); gl.depthMask(true);
}
// spirits: translucent, cold, flickering; drawn after the opaque pass so walls don't hide them completely
function drawSpirits() {
  let any = false; for (const e of S.ents) if (!e.dead && e.k.phase) { any = true; break; }
  if (!any) return;
  const U = MESHU; gl.useProgram(PR.mesh.p);
  gl.enable(gl.BLEND); gl.depthMask(false); gl.blendColor(0, 0, 0, 0.45); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE);
  gl.uniform1i(U.uMode, 2);
  for (const e of S.ents) {
    if (e.dead || !e.k.phase) continue;
    const gh = groundH(e.x, e.y); if (!inView(e.x, gh + 1, e.y, 2)) continue;
    e._ph = (e._ph || e.seed || 0) + (e.moving ? 5 : 0) * (RDT || 0.016);
    const o = entPose(e, 0); o.lean = (o.lean || 0) + (e.moving ? 0.25 : 0.05); o.cape = 0.4; computeHumanBones(o);
    const [tint, ta] = entTint(e), fl = 0.5 + 0.18 * Math.sin(S.t * 3.1 + e.seed) + 0.08 * Math.sin(S.t * 11 + e.seed * 2);
    const col = tint && ta > 0.1 ? mix3([0.62, 0.85, 1.0], tint, Math.min(1, ta * 1.6)) : e.hurtT > 0 ? [1, 1, 1] : [0.62, 0.85, 1.0];
    gl.uniform3fv(U.uTint, col); gl.uniform1f(U.uGhost, clamp(fl * (e.hurtT > 0 ? 1.4 : 1), 0, 1));
    m4trs(MODELM, e.x, gh + e.elev + Math.sin(S.t * 1.7 + e.seed) * 0.15, e.y, yawOf(e.a), 0, 0, 1);
    drawRig(humanMesh('ghost', entSpec('ghost')), MODELM);
  }
  gl.uniform1f(U.uGhost, 0);
  gl.disable(gl.BLEND); gl.depthMask(true);
}
function mkBombM() { const mb = new MB(57); mb.sph(0, 0, 0, 0.14, 0.14, 0.14, '#2a2a30'); mb.tube([0, 0.12, 0], [0.03, 0.22, 0.02], 0.02, 0.015, 4, '#c8a060'); return mb; }
function mkHexM() { const mb = new MB(58); mb.em = 1; mb.ico(0, 0, 0, 0.3, 0.3, 0.3, '#6aff4a', 0.2, 0, 3); mb.sph(0, 0, 0, 0.17, 0.17, 0.17, '#e8ffd0', 0); return mb; }
function entSpec(kind) {
  if (GIANTS[kind]) return Object.assign({ giant: true, scale: 3.0, hat: null }, GIANTS[kind]);
  const h = HUMANS[kind] || HUMANS.soldier;
  return KINDS[kind] && KINDS[kind].scale && !h.scale ? Object.assign({ scale: KINDS[kind].scale }, h) : h;
}
const entScale = kind => KINDS[kind].scale || (GIANTS[kind] ? 3.0 : 1);
function entPose(e, spd) {
  const kind = e.kind, st = e.state, a = e.atk, k = entScale(kind);
  const o = { k, ph: e._ph, spd, aL: null, aR: null, tw: 0, lean: 0, cape: spd * 0.6, breath: Math.sin(S.t * 2 + e.seed) * 0.006 * k, legs: kind === 'witch' ? 'sit' : undefined };
  const set = (side, v) => { if (side > 0) o.aL = v; else o.aR = v; };
  const sinceSw = S.t - (e.swingAt === undefined ? -9 : e.swingAt), swK = sinceSw < 0.3 ? sinceSw / 0.3 : -1;
  if (kind === 'pikeman') set(-1, [-1.3, 0.05, 0.05]);
  if (kind === 'musketeer') set(-1, [-0.35, 0, 0.1]);
  if (kind === 'guard' && e.post && !e.moving) set(1, [-0.85, -0.55, 0.05]);
  if (st === 'wind' && a) {
    const W = foeWind(a, e.hitIdx), u = e.wt < 0 ? 0 : clamp(e.wt / W, 0, 1), eu = ease(u);
    switch (a.k) {
      case 'melee': case 'combo':
        if (kind === 'bandit') { set(-1, [lerp(-1.0, 0.55, eu), 0.2, 0.25]); set(1, guardA(1)); o.tw = 0.5 * eu; }
        else if (kind === 'vampire') { set(-1, [lerp(-1, 0.4, eu), 0.3, 0.6]); set(1, [-1.2, -0.3, 0.3]); o.lean = 0.2; }
        else { set(-1, [lerp(-0.6, -2.6, eu), -0.5 * eu, 0.2]); o.tw = -0.35 * eu; o.lean = -0.1 * eu; }
        o.legs = 'brace'; break;
      case 'line': set(-1, [-1.15, 0.2, 0.05]); o.lean = -0.25 * eu; o.legs = 'brace'; break;
      case 'lunge': set(1, [0.5, 0, 0.5]); set(-1, [0.5, 0, 0.5]); o.lean = 0.35 * eu; o.legs = 'brace'; o.hipY = -0.06 * eu; break;
      case 'grab': case 'snatch': set(1, [-1.5, 1.1 * eu, 0.4]); set(-1, [-1.5, -1.1 * eu, 0.4]); o.lean = 0.1; break;
      case 'screech': set(1, [-2.4, 0.6, 0.5]); set(-1, [-2.4, -0.6, 0.5]); o.nod = -0.5 * eu; o.lean = -0.2; o.legs = 'brace'; break;
      case 'bomb': set(1, [lerp(-0.6, -2.7, eu), 0.3, 0.2]); o.lean = -0.15 * eu; o.tw = 0.4 * eu; break;
      case 'chant': { const sh = Math.sin(S.t * 18) * 0.08; set(1, [-2.6 + sh, 0.2, 0.3]); set(-1, [-2.6 - sh, -0.2, 0.3]); o.nod = -0.3; break; }
      case 'nova': set(1, [lerp(-0.4, -1.6, eu), 1.2 * eu, 0.6]); set(-1, [lerp(-0.4, -1.6, eu), -1.2 * eu, 0.6]); o.lean = -0.2 * eu; o.legs = 'brace'; break;
      case 'cast': set(1, [-2.75, 0, 0.35]); set(-1, [-2.75, 0, 0.35]); break;
      case 'aoe': { const sh = Math.sin(S.t * 30) * 0.06; set(1, [-2.9 + sh, 0.3, 0.4]); set(-1, [-2.9 - sh, -0.3, 0.4]); break; }
      case 'slam': set(1, [lerp(-0.6, -3.0, eu), 0.15, 0.2]); set(-1, [lerp(-0.6, -3.0, eu), -0.15, 0.2]); o.lean = -0.15 * eu; o.legs = 'brace'; break;
      case 'sweep': set(-1, [-1.5, lerp(0, -1.4, eu), 0.2]); o.tw = -0.6 * eu; o.legs = 'brace'; break;
      case 'throw': set(-1, [lerp(-0.6, -2.8, eu), -0.3, 0.2]); o.lean = -0.1; break;
      case 'charge': set(-1, [lerp(-0.6, -2.6, eu), -0.3, 0.2]); break;
    }
  } else if (st === 'aim') {
    if (kind === 'archer') { set(1, [-1.52, -0.12, 0]); set(-1, [-1.4, -0.62, 0]); o.tw = -0.25; }
    else { set(-1, [-1.5, 0.05, 0]); set(1, [-1.45, -0.55, 0]); }
  } else if (st === 'gallop') { set(-1, [-1.6, 0.1, 0]); }
  else if (st === 'stagger') { set(1, [0.25, 0.1, 0.45]); set(-1, [0.25, -0.1, 0.45]); o.flinch = 0.8; o.lean = -0.2; o.nod = Math.sin(S.t * 9) * 0.15; }
  if (swK >= 0 && (st === 'rec' || st === 'move' || st === 'wind')) {
    const kk = easeOut(swK), lk = e.lastK;
    if (lk === 'melee' || lk === 'combo') {
      if (kind === 'bandit') set(-1, [lerp(0.55, -1.6, Math.min(1, kk * 2)), -0.2, 0]);
      else if (kind === 'vampire') { set(-1, [-1.6, lerp(0.4, -0.5, kk), 0.3]); o.lean = 0.25; }
      else set(-1, [lerp(-2.6, -0.6, kk), lerp(-0.5, 0.6, kk), 0.1]);
      o.legs = 'lunge';
    } else if (lk === 'line') { set(-1, [-1.5, 0, 0]); o.lean = 0.35; o.legs = 'lunge'; }
    else if (lk === 'lunge' || lk === 'grab') { set(1, [-1.65, -0.3, 0.2]); set(-1, [-1.65, 0.3, 0.2]); o.lean = 0.3; o.legs = 'lunge'; }
    else if (lk === 'slam') { set(1, [lerp(-3, -0.9, kk), 0.15, 0.2]); set(-1, [lerp(-3, -0.9, kk), -0.15, 0.2]); o.lean = 0.35; o.legs = 'lunge'; }
    else if (lk === 'sweep') { set(-1, [-1.5, lerp(-1.4, 1.3, kk), 0.2]); o.tw = lerp(-0.6, 0.6, kk); }
    else if (lk === 'throw' || lk === 'cast') { set(-1, [-1.6, 0, 0.1]); }
  }
  if (e.hurtT > 0) o.flinch = Math.max(o.flinch || 0, 1);
  if (e.k.gremlin) { o.lean = (o.lean || 0) + 0.32; o.nod = (o.nod || 0) - 0.28; if (!o.legs && !spd) o.legs = 'brace'; }
  if (e.thief) { o.aL = [-2.2 + Math.sin(S.t * 14) * 0.2, 0.3, 0.3]; }
  return o;
}
function entTint(e) {
  if (e.hurtT > 0) return [[1, 1, 1], 0.75];
  const a = e.atk;
  if ((e.state === 'wind' || e.state === 'aim') && a) {
    const hit = a.k === 'combo' ? a.hits[e.hitIdx] : a, W = e.state === 'aim' ? a.aim : foeWind(a, e.hitIdx), u = clamp(e.wt / W, 0, 1);
    const c = hit.col === 'r' ? [1, 0.2, 0.12] : [1, 0.85, 0.15];
    return [c, u > 0.68 ? 0.3 + 0.32 * (((S.t * 22) | 0) % 2) : 0.12 + 0.2 * u];
  }
  if (e.state === 'stagger') return [[1, 0.8, 0.4], 0.12 + 0.1 * Math.sin(S.t * 14)];
  if (e.burnT > 0 && ((S.t * 12) | 0) % 2) return [[1, 0.5, 0.15], 0.45];
  return [null, 0];
}
function drawEnt(e) {
  const kind = e.kind, gh = groundH(e.x, e.y), yaw = yawOf(e.a);
  const [tint, ta] = entTint(e);
  e._ph = (e._ph || e.seed || 0) + (e.moving ? 1 : 0) * (kind === 'vampire' ? 13 : kind === 'dragoon' ? 9 : GIANTS[kind] ? 3.2 : e.k.gremlin ? (e.k.boss ? 7 : 15) : 8.5) * (RDT || 0.016);
  const spd = e.moving && kind !== 'witch' ? 1 : 0;
  setId(1);
  if (kind === 'dragoon') {
    m4trs(MODELM, e.x, gh, e.y, yaw, 0, 0, 1);
    computeHorseBones(e._ph, e.state === 'gallop' ? 1.3 : spd, e.state === 'wind' ? 0.12 * clamp(e.wt / 0.6, 0, 1) : 0);
    drawRig(horseMesh('dragoon', DRAGOON_HORSE), MODELM, tint, ta * 0.6);
    m4mul(TMPM2, MODELM, BW[BN.hbody]); m4trs(TMPM, 0, 1.06 - LIFT, -0.06, 0, 0, 0, 1); m4mul(RIDERM, TMPM2, TMPM);
    const o = entPose(e, 0); o.legs = 'ride'; if (!o.aL) o.aL = [-0.5, 0.1, 0.12]; if (!o.aR) o.aR = [-0.5, -0.1, 0.12];
    computeHumanBones(o);
    AOG_OVR = gh; drawRig(humanMesh('dragoonR', Object.assign({}, HUMANS.soldier, { hat: 'tricorn' })), RIDERM, tint, ta); AOG_OVR = null;
    shadowAt(e.x, e.y, 1.3);
    return;
  }
  const spec = entSpec(kind), mesh = humanMesh(kind, spec), down = e.downT > 0;
  const o = entPose(e, down ? 0 : spd);
  computeHumanBones(o);
  const lift = kind === 'witch' ? e.elev + Math.sin(S.t * 2 + e.seed) * 0.12 - 0.2 : e.elev;
  m4trs(MODELM, e.x, gh + lift + (down ? 0.15 * o.k : 0), e.y, yaw, down ? -Math.PI / 2 : 0, 0, 1);
  if (e.buffT > 0 && !tint) { drawRig(mesh, MODELM, [0.5, 1, 0.35], 0.18 + 0.1 * Math.sin(S.t * 9)); }
  else if (e.elite && !tint) drawRig(mesh, MODELM, [1, 0.75, 0.3], 0.06 + 0.04 * Math.sin(S.t * 4));
  else drawRig(mesh, MODELM, tint, ta);
  if (GIANTS[kind] && e.state === 'wind' && e.atk && e.atk.k === 'throw') {
    const hp = handPoint(BW[BN.armR], MODELM, -1, 0, -0.1 * 3, 0.0);
    m4trs(TMPM, hp[0], hp[1], hp[2], S.t, 0.3, 0, 1); drawPlain(namedMesh(e.k.frost ? 'boulderF' : 'boulder', () => mkBoulderM(e.k.frost)), TMPM);
  }
  shadowAt(e.x, e.y, (e.r + 0.2) * (kind === 'witch' ? 0.7 : 1));
}
const CORPSE_KIND = { R: 'soldier', B: 'ally', N: 'bandit', H: 'dragoon', G: 'giant', F: 'frostgiant', g: 'gremlin', b: 'gremlin_bomber', s: 'gremlin_shaman', u: 'gremlin_brute', L: 'lord' };
function drawCorpse(c) {
  const kind = CORPSE_KIND[c.c] || 'soldier', gh = groundH(c.x, c.y), yaw = hash2(Math.round(c.x * 9), Math.round(c.y * 9)) * TAU;
  const fade = clamp(c.t / 3, 0, 1);
  setId(0.6);
  if (kind === 'dragoon') { computeHorseBones(0, 0); m4trs(MODELM, c.x, gh + 0.25, c.y, yaw, 0, Math.PI / 2, 1); drawRig(horseMesh('dragoon', DRAGOON_HORSE), MODELM, [0.2, 0.18, 0.2], 0.35); return; }
  const k = entScale(kind);
  computeHumanBones({ k });
  m4trs(MODELM, c.x, gh + 0.14 * k - (1 - fade) * 0.6 * k, c.y, yaw, -Math.PI / 2, 0, 1);
  drawRig(humanMesh(kind, entSpec(kind)), MODELM, [0.2, 0.18, 0.2], 0.35);
}
function drawHorseFree() {
  const h = S.horse, mv = h.state === 'coming' || h.state === 'flee';
  h._ph = (h._ph || 0) + (mv ? 9 : 0) * (RDT || 0.016);
  computeHorseBones(h._ph, mv ? 1 : 0);
  setId(1);
  m4trs(MODELM, h.x, groundH(h.x, h.y), h.y, yawOf(h.a), 0, 0, 1);
  drawRig(horseMesh('player', PLAYER_HORSE), MODELM);
  shadowAt(h.x, h.y, 1.25);
}

// ---------- frame ----------
let RDT = 0.016;
// cutaway for the building / castle the player is in: roof and upper walls dither away, camera-side walls drop to a stub
function setCutUniforms(U) {
  const C = S.cut, s = C && C.s;
  if (!s || C.k <= 0 || S.mode === 'title') { gl.uniform4f(U.uCutB, 0, 0, 0, 0); return; }
  if (s.gy === undefined) s.gy = groundH(s.x, s.y);
  const tx = -Math.cos(CAMK.yaw), ty = -Math.sin(CAMK.yaw), lx = tx * s.s - ty * s.c, lz = tx * s.c + ty * s.s, ll = Math.hypot(lx, lz) || 1;
  gl.uniform4f(U.uCutA, s.x, s.y, s.s, s.c);
  gl.uniform4f(U.uCutB, s.hx, s.hz, s.gy, smooth(C.k));
  gl.uniform4f(U.uCutC, lx / ll, lz / ll, s.stub, s.wallH);
  gl.uniform4f(U.uCutD, s.band, s.margin, s.skipOcc ? 1 : 0, s.roof ? (s.kind === 'manor' ? lerp(0.5, 0.66, S.darkness) : lerp(0.22, 0.5, S.darkness)) : 0);
}
function drawStaticsAndTerrain(U) {
  gl.uniform1i(U.uMode, 0); gl.uniform1i(U.uMat, 1); gl.uniformMatrix4fv(U.uModel, false, UNITM);
  gl.uniform1f(U.uId, 0); gl.uniform1f(U.uOW, 0);
  const vis = [];
  for (const g of GCH.values()) {
    const cx = g.cx * CS + 16, cz = g.cy * CS + 16;
    if ((cx - CAM.x) ** 2 + (cz - CAM.y) ** 2 > 110 * 110) continue;
    if (!inView(cx, g.hmid + 2, cz, 25 + g.hr)) continue;
    g.dist = Math.hypot(cx - CAM.x, cz - CAM.y);
    vis.push(g);
    gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, 32 * 32 * 6, gl.UNSIGNED_SHORT, 0);
  }
  gl.uniform1i(U.uMat, 2);
  for (const g of vis) if (g.water) { gl.bindVertexArray(g.water.vao); gl.drawArrays(gl.TRIANGLES, 0, g.water.n); }
  gl.uniform1i(U.uMat, 0);
  gl.uniform1i(U.uMode, 1);
  gl.uniform1f(U.uCutOn, 1);
  const lod = MOBILE ? 34 : 46;
  let curOW = -1;
  for (const g of vis) for (const s of g.inst) {
    if (g.dist - 23 > s.small) continue;
    if (s.ow !== curOW) { curOW = s.ow; gl.uniform1f(U.uOW, s.ow); }
    if (s.far && g.dist > lod) { gl.bindVertexArray(s.far); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.fmesh.n, s.n); }
    else { gl.bindVertexArray(s.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, s.mesh.n, s.n); }
  }
  gl.uniform1i(U.uMode, 0);
  drawCastles(U);
  drawManors(U);
  gl.uniform1f(U.uCutOn, 0);
  for (const g of vis) for (const o of g.chests) {
    setId(0.9);
    m4trs(TMPM, o.x, groundH(o.x, o.y), o.y, hash2(o.x | 0, o.y | 0) * TAU, 0, 0, 1); const mesh = staticMesh(S.looted.has(o.id) ? 'chestopen' : 'chest');
    gl.uniformMatrix4fv(U.uModel, false, TMPM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }
  for (const g of vis) for (const o of g.ores || []) {
    setId(0.9);
    const dep = oreDepleted(o), k = dep ? 'ore_dep' : o.silver ? 'ore_silver' : 'ore_iron';
    m4trs(TMPM, o.x, groundH(o.x, o.y) - 0.05, o.y, hash2(o.x * 3 | 0, o.y * 3 | 0) * TAU, 0, 0, 1); const mesh = namedMesh(k + (o.snow ? 's' : ''), () => mkOreM(k, o.snow));
    gl.uniformMatrix4fv(U.uModel, false, TMPM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    shadowAt(o.x, o.y, 1.1);
  }
  for (const g of vis) {
    if (Math.abs(g.cx * CS + 16 - CAM.x) > 40 || Math.abs(g.cy * CS + 16 - CAM.y) > 40) continue;
    for (const o of g.c.statics) { if ((o.x - CAM.x) ** 2 + (o.y - CAM.y) ** 2 > 1000) continue; const r = SHADOW_R[o.type]; if (r) shadowAt(o.x, o.y, r * (o.type === 'rock' || o.type === 'bigrock' ? 1 : 1)); }
  }
  return vis;
}
function drawActors(U) {
  gl.uniform1i(U.uMode, 2);
  NEAR_FOE = false;
  for (const e of S.ents) if (e.team === 1 && !e.dead && Math.abs(e.x - P.x) < 8 && Math.abs(e.y - P.y) < 8) { NEAR_FOE = true; break; }
  for (const e of S.ents) { if (e.dead) continue; const gh = groundH(e.x, e.y); if (!inView(e.x, gh + 1, e.y, GIANTS[e.kind] || e.k.boss ? 4 : 1.8)) continue; if (e.k.phase) { shadowAt(e.x, e.y, 0.5); continue; } drawEnt(e); }
  for (const c of S.corpses) if (inView(c.x, groundH(c.x, c.y), c.y, 3)) drawCorpse(c);
  if (!P.mounted && S.mode !== 'title' && inView(S.horse.x, groundH(S.horse.x, S.horse.y) + 1, S.horse.y, 2)) drawHorseFree();
  if (S.mode !== 'title') drawPlayer(); else { TORCH_TIP = null; WEAPON_TIP = null; }
  gl.uniform1i(U.uMode, 0);
  for (const d of S.drops) {
    const gh = groundH(d.x, d.y); if (!inView(d.x, gh, d.y, 1)) continue;
    setId(0.8);
    const bob = 0.15 + Math.sin(S.t * 3 + d.x) * 0.07;
    m4trs(TMPM, d.x, gh + bob, d.y, S.t * 1.4 + d.x, 0, 0, 1.15);
    gl.uniformMatrix4fv(U.uModel, false, TMPM);
    const mesh = d.kind === 'gold' ? namedMesh('coins', mkCoinsM) : namedMesh('loot|' + d.id, () => mkLootM(d.id));
    gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
    shadowAt(d.x, d.y, 0.4);
  }
  for (const p of S.projs) {
    const gh = groundH(p.x, p.y), y = gh + p.elev, a = Math.atan2(p.vy, p.vx);
    let mesh;
    setId(0.8);
    if (p.kind === 'arrow') { mesh = namedMesh('arrow', mkArrowM); m4trs(TMPM, p.x, y, p.y, yawOf(a), -(p.vz || 0) * 0.04, 0, 1.3); }
    else if (p.kind === 'boulder') { mesh = namedMesh(p.frost ? 'boulderF' : 'boulder', () => mkBoulderM(p.frost)); m4trs(TMPM, p.x, y, p.y, S.t * 3, S.t * 5, 0, 1.2); shadowAt(p.x, p.y, 0.9); }
    else if (p.kind === 'fire') { mesh = p.hex ? namedMesh('hexball', mkHexM) : namedMesh('fireball', mkFireballM); m4trs(TMPM, p.x, y, p.y, S.t * 6, S.t * 4, 0, (p.hex ? 0.7 : 1) + Math.sin(S.t * 30) * 0.1); }
    else if (p.kind === 'bomb') { mesh = namedMesh('bomb', mkBombM); m4trs(TMPM, p.x, y, p.y, S.t * 7, S.t * 9, 0, 1.6); shadowAt(p.x, p.y, 0.4); }
    else { mesh = namedMesh('ball' + p.kind, () => mkBallM(p.kind)); m4trs(TMPM, p.x, y, p.y, 0, 0, 0, 1.4); }
    gl.uniformMatrix4fv(U.uModel, false, TMPM); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }
}
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
const CLR0 = new Float32Array(4), CLRF = new Float32Array(4);
function post() {
  gl.disable(gl.DEPTH_TEST);
  // bloom from emissive alpha (quarter res)
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.bf); gl.viewport(0, 0, BW2, BH2);
  let U = PR.bloom.U; gl.useProgram(PR.bloom.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.c); gl.uniform1i(U.tC, 0);
  gl.uniform2f(U.uPx, 0.7 / BW2, 0.7 / BH2);
  gl.bindVertexArray(QUADVAO); gl.drawArrays(gl.TRIANGLES, 0, 3);
  // composite: outlines + bloom + grade
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, RW, RH);
  U = PR.comp.U; gl.useProgram(PR.comp.p);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.c); gl.uniform1i(U.tC, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.a); gl.uniform1i(U.tA, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RT.d); gl.uniform1i(U.tD, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, RT.b); gl.uniform1i(U.tB, 3);
  gl.uniform2f(U.uPx, 1 / SW, 1 / SH); gl.uniform1f(U.uNear, 0.5); gl.uniform1f(U.uFar, 300);
  gl.uniform1f(U.uLineW, Math.max(1, Math.round(SH / 900))); gl.uniform1f(U.uLineK, 0.4);
  const slow = S.slowT > 0 ? clamp(S.slowT / 0.15, 0, 1) : 0;
  gl.uniform1f(U.uBloomK, ENV.bloom); gl.uniform1f(U.uVig, 0.32 + slow * 0.5);
  gl.uniform1f(U.uSat, ENV.sat * (1 - slow * 0.45)); gl.uniform1f(U.uBright, ENV.bright);
  const g = ENV.grade; gl.uniform3f(U.uGrade, g[0] * (1 - slow * 0.08), g[1], g[2] * (1 + slow * 0.12));
  let fa = 0, fc = [0.8, 0.1, 0.05];
  if (S.pflash > 0) { fa = S.pflash * 0.9; fc = [0.75, 0.95, 1]; }
  else if (S.flash > 0) fa = S.flash * 0.4;
  gl.uniform3f(U.uFlashC, fc[0], fc[1], fc[2]); gl.uniform1f(U.uFlashA, fa); gl.uniform1f(U.uFadeA, S.fade > 0 ? clamp(S.fade, 0, 1) : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.enable(gl.DEPTH_TEST);
}
function render(dt) {
  dt = dt || 0.016; RDT = dt; frameNo++;
  const t0 = now();
  if (ctx && canvas) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  const hud = S.mode !== 'title' && S.mode !== 'loading';
  if (!GLOK) { if (hud && ctx) drawHUD(); lastRenderMs = now() - t0; return; }
  updateEnv(dt); setupCamera(dt);
  syncChunks(S.mode === 'loading' ? 30 : 4);
  collectLights();
  PS.nAdd = PS.nAlp = 0; SHD.n = 0; MST.n = 0; FXG.n = 0; FXA.n = 0; idSeq = 1;
  gl.bindFramebuffer(gl.FRAMEBUFFER, RT.f); gl.viewport(0, 0, SW, SH); mrtBoth();
  CLRF[0] = ENV.fog[0]; CLRF[1] = ENV.fog[1]; CLRF[2] = ENV.fog[2]; CLRF[3] = 0;
  gl.clearBufferfv(gl.COLOR, 0, CLRF); gl.clearBufferfv(gl.COLOR, 1, CLR0); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
  drawSky();
  const U = MESHU = useLit(PR.mesh);
  gl.uniform1f(U.uEmK, 0.35 + ENV.emK * 0.65); gl.uniform1f(U.uTintA, 0); gl.uniform1f(U.uWind, ENV.wind); gl.uniform1f(U.uGhost, 0); gl.uniform1f(U.uOW, 0); gl.uniform1f(U.uId, 0);
  setCutUniforms(U); gl.uniform1f(U.uCutOn, 0); gl.uniform4f(U.uOcc, 0, 0, 0, 0);
  drawStaticsAndTerrain(U);
  drawActors(U);
  mrtColor();
  drawShadows();
  buildTelegraphs(); drawFX(FXG, true);
  drawGhosts();
  drawSpirits();
  stepAmbient(dt); pushGameParticles();
  drawMist();
  drawParticles();
  buildAirFX(); buildShafts(); drawFX(FXA, false);
  mrtBoth();
  post();
  if (ctx && hud) { ctx.setTransform(DPR, 0, 0, DPR, 0, 0); drawWorldOverlays(); drawHUD(); }
  lastRenderMs = now() - t0;
}
// pre-build meshes around the player while the loading screen shows; returns work left
function prewarmScene(n) {
  if (!GLOK) return 0;
  setupCamera(0);
  const left = syncChunks(40);
  for (const k of ['soldier', 'bandit', 'ally', 'guard', 'merchant', 'archer', 'musketeer', 'pikeman', 'innkeeper', 'smith', 'villager', 'priest', 'quartermaster', 'stranger', 'gremlin', 'gremlin_bomber', 'ghost']) humanMesh(k, entSpec(k));
  humanMesh('P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-'), playerSpec());
  // castles close by: build every part now rather than one per frame
  castleBuildBudget = 99;
  for (const cs of castlesNear(P.x, P.y, 130)) { const G = castleGPU(cs, true); while (!G.ready && castleBuildBudget > 0) castleGPU(cs, true); }
  manorBuildBudget = 99;
  for (const m of manorsNear(P.x, P.y, 130)) { const G = manorGPU(m, true); while (!G.ready && manorBuildBudget > 0) manorGPU(m, true); }
  return left;
}
const prewarmStacks = prewarmScene;

// ---------- world-space overlays on the HUD canvas ----------
const OV = [0, 0, 0];
function olText(s, x, y, col, px, lw) {
  ctx.font = 'bold ' + px + 'px "Trebuchet MS",Verdana,ui-sans-serif,sans-serif';
  ctx.lineJoin = 'round'; ctx.lineWidth = lw || Math.max(3, px * 0.22); ctx.strokeStyle = 'rgba(16,10,24,0.95)'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function star4(x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, rr2 = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fill(); }
function drawWorldOverlays() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const here = structAt(P.x, P.y);
  const doorMk = new Map();
  for (const e of S.ents) {
    if (e.dead) continue;
    const qm = e.team === 2 && Math.abs(e.x - P.x) < 45 && Math.abs(e.y - P.y) < 45 ? questMark(e) : null;
    if (e.team === 2 && e.struct && e.struct !== here) { // the trader or quest giver is indoors: mark the door
      if (!e.role || !e.struct.doors.length) continue;
      const prev = doorMk.get(e.struct) || {}; doorMk.set(e.struct, { qm: prev.qm === '?' ? '?' : qm || prev.qm, tag: e.role === 'inn' ? 'INN' : e.role === 'trade' || e.role === 'smith' || e.role === 'qm' ? '$' : prev.tag });
      continue;
    }
    const top = (GIANTS[e.kind] ? 5.6 : e.kind === 'dragoon' ? 3.0 : Math.max(1.4, e.k.h + 0.2)) + (e.elev || 0);
    const q = project(e.x, groundH(e.x, e.y) + top, e.y, OV); if (!q) continue;
    const sc = clamp(22 / q[2], 0.7, 1.3);
    let y = q[1];
    if (e.downT > 0 || e.state === 'stagger') { for (let i = 0; i < 3; i++) { const a = S.t * 6 + i * 2.1; star4(q[0] + Math.cos(a) * 12 * sc, y + 8 + Math.sin(a) * 4, 4.5 * sc, '#ffe04a'); } y -= 10; }
    const a = e.atk;
    if ((e.state === 'wind' || e.state === 'aim') && a) {
      const hit = a.k === 'combo' ? a.hits[e.hitIdx] : a, red = hit.col === 'r', pulse = 1 + 0.15 * Math.sin(S.t * 30);
      olText(red ? '!!' : '!', q[0], y - 10 * sc, red ? '#ff4a3a' : '#ffd84a', Math.round(20 * sc * pulse));
      y -= 22 * sc;
    }
    if (e.thief) { olText('$', q[0], y - 4, '#ffe040', Math.round(17 * sc)); y -= 16; }
    if (e.team === 1 && !e.k.boss && !e.elite && e.hp < e.maxHp) {
      const w = Math.round(32 * sc), f = clamp(e.hp / e.maxHp, 0, 1), x0 = Math.round(q[0] - w / 2);
      ctx.fillStyle = 'rgba(16,10,24,0.85)'; ctx.fillRect(x0 - 2, y - 2, w + 4, 7); ctx.fillStyle = '#5a1e22'; ctx.fillRect(x0, y, w, 3); ctx.fillStyle = '#ff5a48'; ctx.fillRect(x0, y, Math.round(w * f), 3);
      const pf = clamp(e.poise / e.poiseMax, 0, 1); ctx.fillStyle = '#ffd84a'; ctx.fillRect(x0, y + 3, Math.round(w * pf), 1);
      y -= 9;
    }
    if (qm) { const pul = 1 + 0.08 * Math.sin(S.t * 5); olText(qm, q[0], y - 10, qm === '?' ? '#ffe070' : '#ffc030', Math.round(24 * pul)); y -= 26; }
    else if (e.team === 2 && e.role && e.role !== 'quest') { olText(e.role === 'inn' ? 'INN' : '$', q[0], y - 6, e.role === 'inn' ? '#9ae0a0' : '#ffd84a', e.role === 'inn' ? 12 : 15); y -= 14; }
    if (e === S.aim && e !== P.lock) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.moveTo(q[0] - 7, y - 11); ctx.lineTo(q[0] + 7, y - 11); ctx.lineTo(q[0], y - 3); ctx.closePath(); ctx.fill(); }
  }
  for (const [st, m] of doorMk) {
    const d = st.doors[0], q = project(d.ox, groundH(d.ox, d.oy) + 3.4, d.oy, OV); if (!q) continue;
    if (m.qm) { olText(m.qm, q[0], q[1] - (m.tag ? 16 : 0), m.qm === '?' ? '#ffe070' : '#ffc030', 22); }
    if (m.tag) olText(m.tag, q[0], q[1], m.tag === 'INN' ? '#9ae0a0' : '#ffd84a', m.tag === 'INN' ? 12 : 15);
  }
  // tracked objective: a marker over the spot, or an arrow at the screen edge pointing to it
  const tg = S.mode === 'play' && S.Q ? questTarget() : null;
  if (tg) {
    const dd = Math.hypot(tg.x - P.x, tg.y - P.y);
    if (dd > 4) {
      const gy = groundH(tg.x, tg.y), q = project(tg.x, gy + 3.2, tg.y, OV), pul = 0.85 + 0.15 * Math.sin(S.t * 4);
      const dia = (x, y, r, col) => { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.75, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.75, y); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,10,24,0.9)'; ctx.stroke(); ctx.fillStyle = col; ctx.fill(); };
      if (q && q[0] > 30 && q[0] < VW - 30 && q[1] > 60 && q[1] < VH - 30) { dia(q[0], q[1], 9 * pul, '#ffd04a'); olText(Math.round(dd) + 'm', q[0], q[1] + 18, '#ffe6a0', 12); }
      else {
        const pq = project(P.x, groundH(P.x, P.y) + 1, P.y, [0, 0, 0]) || [VW / 2, VH / 2], tq = project(tg.x, gy, tg.y, [0, 0, 0]);
        let ax, ay;
        if (tq) { ax = tq[0] - pq[0]; ay = tq[1] - pq[1]; } else { const dx = tg.x - P.x, dy = tg.y - P.y, f = [Math.cos(CAMK.yaw), Math.sin(CAMK.yaw)], r = [-Math.sin(CAMK.yaw), Math.cos(CAMK.yaw)]; ax = dx * r[0] + dy * r[1]; ay = -(dx * f[0] + dy * f[1]); }
        // keep the arrow inside a safe frame: below the HUD panels, above the touch buttons
        const top = 158, bot = VH - (IS_TOUCH ? 300 : 44), cxm = VW / 2, cym = (top + bot) / 2;
        const L = Math.hypot(ax, ay) || 1, ux = ax / L, uy = ay / L, mx = VW / 2 - 34, my = Math.max(20, (bot - top) / 2), k = Math.min(Math.abs(ux) > 1e-4 ? mx / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-4 ? my / Math.abs(uy) : 1e9);
        const X = cxm + ux * k, Y = cym + uy * k, an = Math.atan2(uy, ux);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(an); ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -10); ctx.lineTo(-2, 0); ctx.lineTo(-6, 10); ctx.closePath(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,10,24,0.9)'; ctx.stroke(); ctx.fillStyle = '#ffd04a'; ctx.fill(); ctx.restore();
        olText(Math.round(dd) + 'm', X - ux * 24, Y - uy * 24, '#ffe6a0', 12);
      }
    }
  }
  // lock-on reticle
  if (P.lock && !P.lock.dead && S.mode === 'play') {
    const e = P.lock, q = project(e.x, groundH(e.x, e.y) + (GIANTS[e.kind] ? 2.6 : 0.95) + (e.elev || 0), e.y, OV);
    if (q) {
      const r = (GIANTS[e.kind] ? 46 : 24) * clamp(22 / q[2], 0.7, 1.3) * (1 + 0.06 * Math.sin(S.t * 8)), rot = S.t * 1.6;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(16,10,24,0.9)';
      for (let pass = 0; pass < 2; pass++) {
        if (pass) { ctx.lineWidth = 2; ctx.strokeStyle = '#ff7a4a'; }
        for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; ctx.beginPath(); ctx.arc(q[0], q[1], r, a - 0.35, a + 0.35); ctx.stroke(); }
      }
      star4(q[0], q[1], 4, '#ff7a4a');
    }
  }
  // bow draw meter with the perfect window
  if (P.drawing && twoHanded() && S.mode === 'play') {
    const it = ITEMS[P.hands[1]], ch = clamp(P.draw / (it.draw + 0.3), 0, 1), q = project(P.x, groundH(P.x, P.y) + (P.mounted ? 3.3 : 2.2), P.y, OV);
    if (q) { const w = 46, x0 = q[0] - w / 2, pw0 = it.draw / (it.draw + 0.3), pw1 = (it.draw + 0.14) / (it.draw + 0.3);
      ctx.fillStyle = 'rgba(16,10,24,0.85)'; ctx.fillRect(x0 - 2, q[1] - 2, w + 4, 8); ctx.fillStyle = '#3a2a40'; ctx.fillRect(x0, q[1], w, 4);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(x0 + w * pw0, q[1] - 1, w * (pw1 - pw0), 6);
      ctx.fillStyle = '#f4f0ff'; ctx.fillRect(x0, q[1] + 1, Math.round(w * ch), 2); }
  }
  // combo window glint near the player
  if (S.cueT > 0 && WEAPON_TIP && S.mode === 'play') { const q = project(WEAPON_TIP[0], WEAPON_TIP[1], WEAPON_TIP[2], OV); if (q) { const k = S.cueT / 0.22; star4(q[0], q[1], 6 + (1 - k) * 12, 'rgba(255,255,255,' + k.toFixed(2) + ')'); } }
  for (const t of S.texts) {
    const q = project(t.x, groundH(t.x, t.y) + t.elev + 1.0, t.y, OV); if (!q) continue;
    const age = 1 - t.t, pop = t.big ? 1 + Math.max(0, 0.4 - age) * 1.2 : 1;
    ctx.globalAlpha = clamp(t.t * 2.5, 0, 1);
    const col = t.col.charCodeAt(0) === 33 ? t.col.slice(1) : t.col;
    olText(t.s, q[0], q[1], col, Math.round((t.big ? 19 : 15) * pop * clamp(22 / q[2], 0.8, 1.25)));
    ctx.globalAlpha = 1;
  }
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
}
