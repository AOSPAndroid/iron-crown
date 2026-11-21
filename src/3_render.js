// =====================================================================
//  RENDERER — sprite-stacked pixel art
//  Every object is a voxel model cut into 1-voxel horizontal slices.
//  A stack is drawn slice 0 first; every slice is rotated by the same
//  angle (nearest neighbour), squashed by SQ and lifted 1 px per slice.
//  Finished stacks get a 1 px outline once and are cached per angle.
//  16 px per world unit; the internal canvas is ~1 CSS px per art pixel
//  on phones and ~2 CSS px on desktop.
// =====================================================================
const PPU = 16, SQ = 0.75, NB = 64, NBS = 32;
let shakeCss = '', hudDirty = true;
let canvas = null, ctx = null, low = null, lctx = null, lightC = null, lgt = null, scratch = null, scx = null, silC = null;
let VW = 800, VH = 600, DPR = 1, SC = 2, LW = 400, LH = 300, FCX = 200, FCY = 190, VIEWR = 40, PORTRAIT = false;
let frameNo = 0, compBudgetMs = 6, frameStart = 0;
const CAM = { x: 0, y: 0, a: 0, c: 1, s: 0 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function c2d(c) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; }

function resize() {
  VW = window.innerWidth || 800; VH = window.innerHeight || 600; DPR = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  ctx.imageSmoothingEnabled = false;
  PORTRAIT = VH > VW;
  // ~1 CSS px per art pixel on phones (short side ≈ 390), ~2 CSS px on desktop (short side ≈ 360)
  const shortDev = Math.min(canvas.width, canvas.height);
  SC = Math.max(1, Math.round(shortDev / (PORTRAIT ? 390 : 360)));
  LW = Math.ceil(canvas.width / SC); LH = Math.ceil(canvas.height / SC);
  if (!low) {
    low = mkCanvas(LW, LH); lightC = mkCanvas(LW, LH); scratch = mkCanvas(256, 256); silC = mkCanvas(256, 256);
    // the low-res canvas is shown directly and scaled by the compositor; #cv on top only carries the HUD
    low.id = 'gv'; if (canvas.parentNode && canvas.parentNode.insertBefore) canvas.parentNode.insertBefore(low, canvas);
  }
  low.width = LW; low.height = LH; lightC.width = LW; lightC.height = LH;
  low.style.width = (LW * SC / DPR) + 'px'; low.style.height = (LH * SC / DPR) + 'px'; low.style.transform = ''; shakeCss = '';
  hudDirty = true;
  lctx = c2d(low); lgt = c2d(lightC); scx = c2d(scratch);
  FCX = Math.floor(LW / 2); FCY = Math.floor(LH * (PORTRAIT ? 0.66 : 0.64));
  VIEWR = Math.ceil(Math.hypot(Math.max(FCX, LW - FCX) / PPU, Math.max(FCY, LH - FCY) / (PPU * SQ))) + 4;
  if (S) S.flakes = [];
  if (typeof layoutTouch === 'function') layoutTouch();
}
function w2s(x, y) { const dx = x - CAM.x, dy = y - CAM.y; return [FCX + PPU * (-dx * CAM.s + dy * CAM.c), FCY - PPU * SQ * (dx * CAM.c + dy * CAM.s)]; }
function s2w(sx, sy) { const r = (sx - FCX) / PPU, f = (FCY - sy) / (PPU * SQ); return [CAM.x + f * CAM.c - r * CAM.s, CAM.y + f * CAM.s + r * CAM.c]; }
function hx(col, f) { const c = rgbOf(col.charCodeAt(0) === 33 ? col.slice(1) : col); return '#' + [0, 1, 2].map(i => clamp(Math.round(c[i] * f), 0, 255).toString(16).padStart(2, '0')).join(''); }

// ---------- voxel models ----------
const VPAL = [[0, 0, 0]], VEM = [false], VPALI = new Map();
function ci(col, em) {
  if (col.charCodeAt(0) === 33) { em = true; col = col.slice(1); }
  const k = em ? col + '!' : col; let i = VPALI.get(k);
  if (i === undefined) { i = VPAL.length; if (i > 65535) return 1; VPAL.push(rgbOf(col)); VEM.push(!!em); VPALI.set(k, i); }
  return i;
}
const cs = (col, f) => ci(hx(col, f));
function VM(w, d, h) { return { w, d, h, v: new Uint16Array(w * d * h) }; }
function vs(m, x, y, z, c) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (x < 0 || y < 0 || z < 0 || x >= m.w || y >= m.d || z >= m.h) return; m.v[(z * m.d + y) * m.w + x] = c; }
function vg(m, x, y, z) { if (x < 0 || y < 0 || z < 0 || x >= m.w || y >= m.d || z >= m.h) return 0; return m.v[(z * m.d + y) * m.w + x]; }
function vbox(m, x0, y0, z0, x1, y1, z1, c) { for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) vs(m, x, y, z, c); }
function vline(m, x0, y0, z0, x1, y1, z1, c, w) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    vs(m, x, y, z, c);
    if (w === 1 || w === 3) vs(m, x + 1, y, z, c);
    if (w === 2 || w === 3) vs(m, x, y, z + 1, c);
    if (w === 3) vs(m, x + 1, y, z + 1, c);
  }
}
function vtube(m, x0, y0, z0, x1, y1, z1, r, c) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1) * 2, R = Math.ceil(r);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
    for (let dz = -R; dz <= R; dz++) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy + dz * dz <= r * r + 0.3) vs(m, x + dx, y + dy, z + dz, c);
  }
}
function vdisc(m, cx, cy, r, z, c, seed, amt) {
  for (let y = Math.floor(cy - r - 2); y <= Math.ceil(cy + r + 2); y++) for (let x = Math.floor(cx - r - 2); x <= Math.ceil(cx + r + 2); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr2 = seed !== undefined ? r + (hash2(x * 7 + seed, y * 13 + z * 3) - 0.5) * (amt || 1.6) : r;
    if (dx * dx + dy * dy <= rr2 * rr2) vs(m, x, y, z, c);
  }
}
function vcyl(m, cx, cy, r, z0, z1, c) { for (let z = z0; z <= z1; z++) vdisc(m, cx, cy, r, z, c); }
function vcone(m, cx, cy, r0, r1, z0, z1, c, seed, amt) { for (let z = z0; z <= z1; z++) vdisc(m, cx, cy, lerp(r0, r1, (z - z0) / Math.max(1, z1 - z0)), z, c, seed, amt); }
function vblob(m, cx, cy, cz, rx, ry, rz, c, seed, amt) {
  for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++) for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, nz = (z + 0.5 - cz) / rz;
    const n = amt ? (hash2(x * 7 + (seed | 0), y * 13 + z * 31) - 0.5) * amt : 0;
    if (nx * nx + ny * ny + nz * nz <= 1 + n) vs(m, x, y, z, c);
  }
}
// recolour voxels: fn(x,y,z,c) returns a new colour index or undefined
function vpaint(m, fn, x0, y0, z0, x1, y1, z1) {
  x0 = x0 || 0; y0 = y0 || 0; z0 = z0 || 0; x1 = x1 === undefined ? m.w - 1 : x1; y1 = y1 === undefined ? m.d - 1 : y1; z1 = z1 === undefined ? m.h - 1 : z1;
  for (let z = Math.max(0, z0); z <= Math.min(m.h - 1, z1); z++) for (let y = Math.max(0, y0); y <= Math.min(m.d - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(m.w - 1, x1); x++) {
    const i = (z * m.d + y) * m.w + x, c = m.v[i]; if (!c) continue;
    const n = fn(x, y, z, c); if (n !== undefined) m.v[i] = n;
  }
}
function vtop(m, c, p, seed, only) { // recolour exposed top voxels (snow, moss, highlights)
  const W = m.w, D = m.d;
  for (let z = 0; z < m.h; z++) for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const i = (z * D + y) * W + x, v = m.v[i]; if (!v) continue;
    if (only && !only.includes(v)) continue;
    const above = z + 1 < m.h ? m.v[i + W * D] : 0;
    if (!above && hash2(x * 7 + z * 3 + (seed | 0), y * 13 + z) < p) m.v[i] = c;
  }
}
function lie(src, y0, H) { // tip a standing model onto its back (z → y)
  H = H || 12; const m = VM(src.w, src.h + 2, H);
  for (let z = 0; z < src.h; z++) for (let y = 0; y < src.d; y++) for (let x = 0; x < src.w; x++) {
    const c = src.v[(z * src.d + y) * src.w + x]; if (!c) continue;
    const nz = y - y0; if (nz < 0 || nz >= H) continue;
    vs(m, x, z + 1, nz, c);
  }
  return m;
}
function lieSide(src, x0, H) { // onto its side (z → x), for horses
  H = H || 14; const m = VM(src.h + 2, src.d, H);
  for (let z = 0; z < src.h; z++) for (let y = 0; y < src.d; y++) for (let x = 0; x < src.w; x++) {
    const c = src.v[(z * src.d + y) * src.w + x]; if (!c) continue;
    const nz = x - x0; if (nz < 0 || nz >= H) continue;
    vs(m, z + 1, y, nz, c);
  }
  return m;
}

// slices → one row sheet. Tops are lit, exposed top edges get a highlight, sides are darker.
function finalize(m) {
  const MW = m.w, D0 = m.d, WD = MW * D0;
  // crop the sheet to the occupied box; the rotation centre stays the grid centre
  let x0 = MW, x1 = -1, y0 = D0, y1 = -1, zt = 0;
  for (let z = 0; z < m.h; z++) for (let y = 0; y < D0; y++) { const r = (z * D0 + y) * MW; for (let x = 0; x < MW; x++) if (m.v[r + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; zt = z + 1; } }
  if (x1 < 0) { x0 = x1 = y0 = y1 = 0; zt = 1; }
  const cw = x1 - x0 + 1, cd = y1 - y0 + 1, H = zt, W = cw * H;
  const sheet = mkCanvas(W, cd), sx = sheet.getContext('2d'), id = sx.createImageData(W, cd), px = id.data;
  const ems = [];
  for (let z = 0; z < H; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = (z * D0 + y) * MW + x, c = m.v[i]; if (!c) continue;
    const o = ((y - y0) * W + z * cw + (x - x0)) * 4, col = VPAL[c];
    let f = 1;
    if (VEM[c]) ems.push(o);
    else {
      const above = z + 1 < m.h ? m.v[i + WD] : 0;
      if (above) f = z < 2 ? 0.6 : z < 5 ? 0.68 : 0.76;
      else {
        const edge = x === 0 || y === 0 || x === MW - 1 || y === D0 - 1 || !m.v[i - 1] || !m.v[i + 1] || !m.v[i - MW] || !m.v[i + MW];
        f = edge ? 1.16 : 1.04;
      }
    }
    px[o] = Math.min(255, col[0] * f); px[o + 1] = Math.min(255, col[1] * f); px[o + 2] = Math.min(255, col[2] * f); px[o + 3] = 255;
  }
  sx.putImageData(id, 0, 0);
  // glow sheet: emissive voxels in colour, everything else opaque black. Stacked and drawn with 'screen',
  // black is neutral, so only glow not hidden behind other voxels brightens the night scene.
  let em = null, ez0 = 0;
  if (ems.length) {
    em = mkCanvas(W, cd); const ex = em.getContext('2d'), eid = ex.createImageData(W, cd), ed = eid.data;
    for (let i = 0; i < px.length; i += 4) if (px[i + 3]) ed[i + 3] = 255;
    ez0 = 1e9; for (const o of ems) { for (let k = 0; k < 3; k++) ed[o + k] = px[o + k]; ez0 = Math.min(ez0, Math.floor((o >> 2) % W / cw)); }
    ex.putImageData(eid, 0, 0);
  }
  // radius of the top few layers, so overlays can sit just above the visible top of the stack
  let rt = 0;
  for (let z = Math.max(0, zt - 4); z < zt; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m.v[(z * D0 + y) * MW + x]) rt = Math.max(rt, Math.hypot(x + 0.5 - MW / 2, y + 0.5 - D0 / 2));
  const cx = MW / 2 - x0, cy = D0 / 2 - y0;
  const R = Math.max(Math.hypot(cx, cy), Math.hypot(cw - cx, cy), Math.hypot(cx, cd - cy), Math.hypot(cw - cx, cd - cy));
  return { w: cw, d: cd, h: H, cx, cy, R, sheet, em, ez0, zt, rt, px: W * cd * (em ? 2 : 1) };
}
function buildComp(m, th) {
  const cs2 = Math.cos(th), sn = Math.sin(th);
  const diag = 2 * Math.ceil(m.R);
  const W = diag + 4, gH = Math.ceil(diag * SQ), H = gH + m.h + 4;
  const ax = Math.floor(W / 2), ay = H - 2 - Math.ceil(gH / 2);
  // tight box of the projected model (+1 px for the outline), so cached composites hold little empty space
  let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
  for (const u of [-m.cx, m.w - m.cx]) for (const v of [-m.cy, m.d - m.cy]) {
    const X = ax + cs2 * u - sn * v, Y = ay + SQ * (sn * u + cs2 * v);
    bx0 = Math.min(bx0, X); bx1 = Math.max(bx1, X); by0 = Math.min(by0, Y - m.h); by1 = Math.max(by1, Y);
  }
  bx0 = Math.max(0, Math.floor(bx0) - 2); by0 = Math.max(0, Math.floor(by0) - 2); bx1 = Math.min(W, Math.ceil(bx1) + 2); by1 = Math.min(H, Math.ceil(by1) + 2);
  const bw = bx1 - bx0, bh = by1 - by0;
  if (scratch.width < W || scratch.height < H) { scratch.width = Math.max(scratch.width, W); scratch.height = Math.max(scratch.height, H); scx = c2d(scratch); }
  scx.setTransform(1, 0, 0, 1, 0, 0); scx.globalCompositeOperation = 'source-over'; scx.clearRect(0, 0, W, H);
  for (let z = 0; z < m.h; z++) { scx.setTransform(cs2, SQ * sn, -sn, SQ * cs2, ax, ay - z); scx.drawImage(m.sheet, z * m.w, 0, m.w, m.d, -m.cx, -m.cy, m.w, m.d); }
  scx.setTransform(1, 0, 0, 1, 0, 0);
  // 1 px outline in a darker shade of the neighbouring fill, done once on the finished stack
  if (silC.width < bw || silC.height < bh) { silC.width = Math.max(silC.width, bw); silC.height = Math.max(silC.height, bh); }
  const sl = c2d(silC); sl.setTransform(1, 0, 0, 1, 0, 0); sl.globalCompositeOperation = 'source-over'; sl.clearRect(0, 0, bw, bh);
  sl.drawImage(scratch, bx0, by0, bw, bh, -1, 0, bw, bh); sl.drawImage(scratch, bx0, by0, bw, bh, 1, 0, bw, bh); sl.drawImage(scratch, bx0, by0, bw, bh, 0, -1, bw, bh); sl.drawImage(scratch, bx0, by0, bw, bh, 0, 1, bw, bh);
  sl.globalCompositeOperation = 'source-atop'; sl.fillStyle = 'rgba(14,8,6,0.72)'; sl.fillRect(0, 0, bw, bh); sl.globalCompositeOperation = 'source-over';
  const out = mkCanvas(bw, bh), o = c2d(out);
  o.drawImage(silC, 0, 0, bw, bh, 0, 0, bw, bh);
  o.drawImage(scratch, bx0, by0, bw, bh, 0, 0, bw, bh);
  let em = null;
  if (m.em) {
    em = mkCanvas(bw, bh); const e = c2d(em);
    for (let z = m.ez0; z < m.h; z++) { e.setTransform(cs2, SQ * sn, -sn, SQ * cs2, ax - bx0, ay - by0 - z); e.drawImage(m.em, z * m.w, 0, m.w, m.d, -m.cx, -m.cy, m.w, m.d); }
  }
  return { c: out, em, ax: ax - bx0, ay: ay - by0, top: m.zt + Math.ceil(m.rt * SQ) + 1, w: bw, h: bh, t: null, px: bw * bh * (em ? 2 : 1) };
}
// caches, capped by total pixels (≈4 bytes each)
const MODELS = new Map(), COMPS = new Map();
let modelPx = 0, compPx = 0;
const MODEL_CAP = 8e6, COMP_CAP = 12e6;
function getModel(key, build) {
  let m = MODELS.get(key);
  if (!m) {
    m = finalize(build()); MODELS.set(key, m); modelPx += m.px;
    while (modelPx > MODEL_CAP && MODELS.size > 1) { const k = MODELS.keys().next().value; modelPx -= MODELS.get(k).px; MODELS.delete(k); }
  }
  return m;
}
function comp(key, build, th, nb) {
  nb = nb || NB;
  const b = ((Math.round(th / TAU * nb) % nb) + nb) % nb;
  const ck = key + '@' + b + '/' + nb;
  let c = COMPS.get(ck);
  if (c) { if (c.f !== frameNo) { c.f = frameNo; COMPS.delete(ck); COMPS.set(ck, c); } return c; }
  if (now() - frameStart > compBudgetMs) { // over budget: reuse the nearest angle already built
    for (let k = 1; k <= nb / 2; k++) for (const s of [-1, 1]) { const c2 = COMPS.get(key + '@' + (((b + s * k) % nb) + nb) % nb + '/' + nb); if (c2) return c2; }
  }
  c = buildComp(getModel(key, build), b / nb * TAU); c.f = frameNo;
  COMPS.set(ck, c); compPx += c.px;
  while (compPx > COMP_CAP && COMPS.size > 1) { const k = COMPS.keys().next().value, v = COMPS.get(k); compPx -= v.px + (v.tp || 0); COMPS.delete(k); }
  return c;
}
function tintOf(cp, col, a) {
  const k = col + (a || 1); cp.t = cp.t || {};
  let c = cp.t[k]; if (c) return c;
  c = mkCanvas(cp.w, cp.h); const x = c2d(c); x.drawImage(cp.c, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a || 1; x.fillStyle = col; x.fillRect(0, 0, cp.w, cp.h);
  cp.t[k] = c; cp.tp = (cp.tp || 0) + cp.w * cp.h; compPx += cp.w * cp.h;
  return c;
}

// ---------- ground: one 514×514 texture per chunk (1 px overlap border, 16 px per tile) ----------
const TEXN = 514, NBK = Math.ceil(TEXN / 2), GTEX_CAP = 30;
const GTEX = new Map(), GJOBS = new Map();
const pk = c => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
const PKC = h => pk(rgbOf(h));
const SINT = new Float32Array(256); for (let i = 0; i < 256; i++) SINT[i] = Math.sin(i / 256 * TAU);
function ih(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
const GP = []; // per tile: packed colours
(function () {
  const T = (...a) => a.map(PKC);
  GP[T_GRASS] = T('#4f8f3c', '#4a883a', '#3c7630', '#62a548', '#78b856', '#2f6426');
  GP[T_TALL] = T('#43802f', '#3e7a2c', '#2f6424', '#5a9a40', '#78b04e', '#c8b070');
  GP[T_FLOOR] = T('#2f5a28', '#2b5426', '#224820', '#5a4a2a', '#8a5a2a', '#c04030');
  GP[T_WATER] = T('#2a5c9e', '#2c60a4', '#3a70b4', '#24508e', '#5a92cc', '#a8d0f0');
  GP[T_DIRT] = T('#6a5236', '#5e482e', '#8e8478', '#7e7468', '#a29a8e', '#4e3e28');
  GP[T_WHEAT] = T('#8a6a28', '#7a5c22', '#c8a038', '#e8c858', '#b08a2c', '#d04030');
  GP[T_SNOW] = T('#e8eef6', '#e2e9f3', '#d4dded', '#f6f9fc', '#ffffff', '#b8c8dc');
  GP[T_DRIFT] = T('#f0f4fa', '#eef2f8', '#d4deec', '#ffffff', '#ffffff', '#c4d0e2');
  GP[T_ICE] = T('#9cc8e8', '#98c4e6', '#8abcde', '#b4daf2', '#e0f4ff', '#78aad2');
  GP[T_SAND] = T('#d8b878', '#d4b474', '#c6a466', '#e6c890', '#8a7454', '#f0d8d0');
  GP[T_DUNE] = T('#e0c286', '#dcbe82', '#c8a868', '#eed29c', '#a89050', '#b8a060');
  GP[T_MUD] = T('#5a4a30', '#56462e', '#4c3e28', '#66553a', '#3e4a40', '#7a8a84');
  GP[T_MARSH] = T('#4a5c30', '#46582e', '#3e4e28', '#5a6c38', '#6a8a3a', '#6a4a28');
  GP[T_BOG] = T('#2c3c2e', '#2a3a2c', '#344a38', '#3e5a34', '#4a7a3a', '#e8e8f0');
  GP[T_HEATHER] = T('#4e4a3a', '#4a4636', '#7a4a8a', '#a868b8', '#4a6a3a', '#d8a0e0');
  GP[T_ROCKY] = T('#6a665e', '#66625a', '#5a5650', '#7a766c', '#9a968a', '#4a4842');
})();
function tileAtWorld(x, y) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS), c = CHUNKS.get(cx + ',' + cy);
  if (c) return c.tiles[((Math.floor(y) - cy * CS) << 5) + (Math.floor(x) - cx * CS)];
  return tileBase(x, y);
}
const tileNoGen = tileAtWorld;
function texJob(c) { let j = GJOBS.get(c.key); if (!j) { j = { c, stage: 0, y: 0 }; GJOBS.set(c.key, j); } return j; }
function runJob(j, deadline) {
  const c = j.c, gx0 = c.cx * 512 - 1, gy0 = c.cy * 512 - 1;
  if (j.stage === 0) {
    j.cv = mkCanvas(TEXN, TEXN); j.x = j.cv.getContext('2d'); j.id = j.x.createImageData(TEXN, TEXN); j.d = new Uint32Array(j.id.data.buffer); j.tt = new Uint8Array(TEXN * TEXN);
    const bt = j.bt = new Uint8Array(NBK * NBK);
    for (let by = 0; by < NBK; by++) for (let bx = 0; bx < NBK; bx++) {
      // tile borders: coarse wobble every 8 px plus a fine 2 px fray, so edges read as organic pixel art
      const gx = gx0 + bx * 2 + 1, gy = gy0 + by * 2 + 1, h = ih(gx >> 3, gy >> 3), f = ih(gx >> 1, gy >> 1);
      const jx = ((h & 255) / 255 - 0.5) * 10 + ((f & 255) / 255 - 0.5) * 4, jy = (((h >>> 8) & 255) / 255 - 0.5) * 10 + (((f >>> 8) & 255) / 255 - 0.5) * 4;
      const wx = (gx + jx) / PPU, wy = (gy + jy) / PPU, tx = Math.floor(wx) - c.cx * CS, ty = Math.floor(wy) - c.cy * CS;
      bt[by * NBK + bx] = (tx >= 0 && ty >= 0 && tx < CS && ty < CS) ? c.tiles[ty * CS + tx] : tileAtWorld(wx, wy);
    }
    j.stage = 1;
  }
  if (j.stage === 1) {
    const d = j.d, tt = j.tt, bt = j.bt;
    while (j.y < TEXN) {
      const v = j.y, gy = gy0 + v, row = v * TEXN, brow = (v >> 1) * NBK;
      for (let u = 0; u < TEXN; u++) {
        const t = bt[brow + (u >> 1)], gx = gx0 + u, h = ih(gx, gy), r = h & 1023, p = GP[t];
        let col = ((ih(gx >> 3, gy >> 3) & 1) ? p[1] : p[0]);
        switch (t) {
          case T_WATER: case T_BOG: { const w = (gy + Math.round(SINT[(gx * 3) & 255] * 3)) % 11; if (w === 0) col = p[2]; else if (r < 40) col = p[3]; break; }
          case T_DRIFT: { const w = (gy + Math.round(SINT[(gx * 2) & 255] * 4)) % 13; if (w === 0) col = p[3]; else if (w === 1 || w === 2) col = p[2]; else if (r < 60) col = p[2]; break; }
          case T_SAND: { const w = (gy + Math.round(SINT[(gx * 3) & 255] * 2.5)) % 7; if (w === 0) col = p[2]; else if (w === 1) col = p[3]; break; }
          case T_DUNE: { const w = (gy + Math.round(SINT[gx & 255] * 5)) % 6; if (w === 0) col = p[2]; else if (w === 1) col = p[3]; break; }
          case T_WHEAT: col = (u % 3 === 0) ? p[1] : p[0]; if (r < 30) col = p[4]; break;
          case T_DIRT: if (r < 140) col = p[1]; else if (r > 1000) col = p[5]; break;
          default: if (r < 130) col = p[2]; else if (r > 960) col = p[3];
        }
        d[row + u] = col; tt[row + u] = t;
      }
      j.y++;
      if ((j.y & 15) === 0 && now() > deadline) return false;
    }
    j.stage = 2; if (now() > deadline) return false;
  }
  if (j.stage === 2) { stampTex(j); j.stage = 3; if (now() > deadline) return false; }
  j.x.putImageData(j.id, 0, 0);
  GTEX.set(c.key, { cv: j.cv, f: frameNo, c });
  GJOBS.delete(c.key);
  return true;
}
function stampTex(j) {
  const c = j.c, d = j.d, tt = j.tt;
  // shorelines: water next to land gets a lighter shallow band and foam
  for (let v = 0; v < TEXN; v++) for (let u = 0; u < TEXN; u++) {
    const i = v * TEXN + u, t = tt[i]; if (t !== T_WATER && t !== T_BOG) continue;
    const far = (u > 5 && tt[i - 6] !== t) || (u < TEXN - 6 && tt[i + 6] !== t) || (v > 5 && tt[i - 6 * TEXN] !== t) || (v < TEXN - 6 && tt[i + 6 * TEXN] !== t);
    if (!far) continue;
    const near = (u > 1 && tt[i - 2] !== t) || (u < TEXN - 2 && tt[i + 2] !== t) || (v > 1 && tt[i - 2 * TEXN] !== t) || (v < TEXN - 2 && tt[i + 2 * TEXN] !== t);
    d[i] = near ? GP[t][5] : GP[t][4];
  }
  let ct = 0;
  const sp = (x, y, col) => { if (x < 0 || y < 0 || x >= TEXN || y >= TEXN) return; const i = y * TEXN + x; if (tt[i] === ct) d[i] = col; };
  for (let jy = -1; jy <= CS; jy++) for (let jx = -1; jx <= CS; jx++) {
    const wx = c.cx * CS + jx, wy = c.cy * CS + jy;
    ct = (jx >= 0 && jy >= 0 && jx < CS && jy < CS) ? c.tiles[jy * CS + jx] : tileAtWorld(wx + 0.5, wy + 0.5);
    const p = GP[ct], u0 = jx * 16 + 1, v0 = jy * 16 + 1;
    let s = ih(wx * 31 + 7, wy * 17 + 3);
    const R = () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9E3779B9) >>> 0; return (s >>> 8) / 16777216; };
    const X = () => u0 + ((R() * 16) | 0), Y = () => v0 + ((R() * 16) | 0);
    switch (ct) {
      case T_GRASS: {
        for (let k = 0; k < 7; k++) { const x = X(), y = Y(), L = 2 + ((R() * 3) | 0), col = R() < 0.5 ? p[3] : p[2], lean = R() < 0.5 ? -1 : 1; for (let t = 0; t < L; t++) sp(x + (t > 1 ? lean : 0), y - t, col); }
        if (R() < 0.12) { const x = X(), y = Y(), pc = PKC(pick2(R, ['#f0e060', '#f4f4f4', '#f080a8', '#9ab0ff', '#ff9040'])); sp(x, y + 2, p[5]); sp(x - 1, y, pc); sp(x + 1, y, pc); sp(x, y - 1, pc); sp(x, y + 1, pc); sp(x, y, PKC('#ffe040')); }
        break;
      }
      case T_TALL: for (let k = 0; k < 11; k++) { const x = X(), y = Y(), L = 3 + ((R() * 4) | 0), col = R() < 0.5 ? p[3] : p[2], lean = R() < 0.5 ? -1 : 1; for (let t = 0; t < L; t++) sp(x + (t > 2 ? lean : 0), y - t, col); if (R() < 0.3) sp(x + lean, y - L, p[5]); } break;
      case T_FLOOR: {
        for (let k = 0; k < 6; k++) { const x = X(), y = Y(); sp(x, y, p[3]); sp(x + 1, y + 1, p[3]); }
        if (R() < 0.3) { const x = X(), y = Y(); sp(x, y, p[4]); sp(x + 1, y, p[4]); sp(x, y + 1, p[4]); }
        if (R() < 0.1) { const x = X(), y = Y(); for (let t = 0; t < 5; t++) sp(x + t, y + (t >> 1), p[3]); }
        if (R() < 0.05) { const x = X(), y = Y(), cap = p[5], w = PKC('#f0e8e0'); sp(x, y + 2, w); sp(x - 1, y, cap); sp(x, y, cap); sp(x + 1, y, cap); sp(x, y - 1, cap); sp(x, y, w); }
        break;
      }
      case T_DIRT: { // worn cobbles
        for (let r = 0; r < 4; r++) { const off = (r & 1) * 3; for (let k = -1; k < 4; k++) {
          if (R() < 0.14) continue;
          const x0 = u0 + off + k * 5, y0 = v0 + r * 4, col = [p[2], p[3], p[4]][(R() * 3) | 0];
          for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 4; xx++) sp(x0 + xx, y0 + yy, col);
          sp(x0, y0, p[4]); sp(x0 + 3, y0 + 2, p[1]);
        } }
        break;
      }
      case T_WHEAT: for (let k = 0; k < 6; k++) { const x = u0 + k * 3 + ((R() * 2) | 0), top = v0 + ((R() * 6) | 0); for (let y = top + 3; y < v0 + 16; y++) sp(x, y, p[4]); sp(x, top, p[3]); sp(x, top + 1, p[3]); sp(x, top + 2, p[2]); if (R() < 0.04) { sp(x + 1, top + 1, p[5]); sp(x - 1, top + 1, p[5]); } } break;
      case T_SNOW: case T_DRIFT: {
        for (let k = 0; k < 2; k++) if (R() < 0.6) { const x = X(), y = Y(); sp(x, y, p[4]); if (R() < 0.3) { sp(x - 1, y, p[3]); sp(x + 1, y, p[3]); sp(x, y - 1, p[3]); sp(x, y + 1, p[3]); } }
        if (R() < 0.22) { const x = X(), y = Y(); for (let xx = -3; xx <= 3; xx++) { sp(x + xx, y, p[2]); if (Math.abs(xx) < 2) sp(x + xx, y + 1, p[2]); } }
        if (R() < 0.05) { const x = X(), y = Y(); sp(x, y, p[5]); sp(x + 1, y, p[5]); }
        break;
      }
      case T_ICE: {
        let x = X(), y = Y(); for (let t = 0; t < 12; t++) { sp(x, y, p[4]); x += R() < 0.5 ? 1 : -1; if (R() < 0.6) y += 1; }
        for (let k = 0; k < 2; k++) { const x2 = X(), y2 = Y(); sp(x2, y2, p[3]); }
        if (R() < 0.3) { const x2 = X(), y2 = Y(); for (let t = 0; t < 4; t++) sp(x2 + t, y2, p[5]); }
        break;
      }
      case T_SAND: case T_DUNE:
        if (R() < 0.18) { const x = X(), y = Y(); sp(x, y, p[4]); sp(x + 1, y, p[4]); sp(x, y + 1, p[2]); }
        if (R() < 0.05) { const x = X(), y = Y(); sp(x, y, p[5]); sp(x + 1, y, p[5]); }
        if (ct === T_DUNE && R() < 0.07) { const x = X(), y = Y(); for (let t = 0; t < 4; t++) { sp(x - 1, y - t, p[5]); sp(x + 1, y - t, p[5]); } }
        break;
      case T_MUD:
        if (R() < 0.25) { const x = X(), y = Y(), rx = 3 + R() * 3; for (let yy = -2; yy <= 2; yy++) for (let xx = -6; xx <= 6; xx++) if ((xx / rx) ** 2 + (yy / 2) ** 2 <= 1) sp(x + xx, y + yy, p[4]); sp(x - 1, y - 1, p[5]); sp(x, y - 1, p[5]); }
        for (let k = 0; k < 3; k++) sp(X(), Y(), p[2]);
        break;
      case T_MARSH: for (let k = 0; k < 4; k++) { const x = X(), y = Y(), L = 5 + ((R() * 4) | 0); for (let t = 0; t < L; t++) sp(x, y - t, p[4]); if (R() < 0.45) { sp(x, y - L, p[5]); sp(x, y - L - 1, p[5]); } } break;
      case T_BOG:
        if (R() < 0.18) { const x = X(), y = Y(); for (let yy = -2; yy <= 2; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy * 2 <= 8 && !(xx > 0 && yy === 0)) sp(x + xx, y + yy, p[4]); if (R() < 0.3) { sp(x - 1, y - 1, p[5]); sp(x - 1, y - 2, p[5]); } }
        for (let k = 0; k < 3; k++) sp(X(), Y(), p[3]);
        break;
      case T_HEATHER: for (let k = 0; k < 7; k++) { const x = X(), y = Y(); sp(x, y + 1, p[4]); sp(x, y, p[2]); sp(x + 1, y, p[2]); sp(x, y - 1, p[3]); if (R() < 0.3) sp(x + 1, y - 1, p[5]); } break;
      case T_ROCKY: for (let k = 0; k < 3; k++) { const x = X(), y = Y(), rr2 = 1.5 + R() * 1.8; for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { if (xx * xx + yy * yy > rr2 * rr2) continue; sp(x + xx, y + yy, yy < -rr2 * 0.4 ? p[4] : yy > rr2 * 0.4 ? p[5] : p[3]); } } break;
      case T_WATER: if (R() < 0.1) { const x = X(), y = Y(); for (let t = 0; t < 5; t++) sp(x + t, y, p[2]); } break;
    }
  }
}
function pick2(R, a) { return a[(R() * a.length) | 0]; }
function ensureTex(c) { let t = GTEX.get(c.key); if (t) return t; const j = texJob(c); while (!runJob(j, Infinity)); return GTEX.get(c.key); }
function prewarmGround(budget) {
  const t0 = now(), R = VIEWR + 22;
  const c0x = Math.floor((CAM.x - R) / CS), c1x = Math.floor((CAM.x + R) / CS), c0y = Math.floor((CAM.y - R) / CS), c1y = Math.floor((CAM.y + R) / CS);
  let best = null, bd = 1e9;
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const k = cx + ',' + cy; if (GTEX.has(k)) continue; const c = CHUNKS.get(k); if (!c) continue;
    const d = Math.hypot((cx + 0.5) * CS - CAM.x, (cy + 0.5) * CS - CAM.y); if (d < bd) { bd = d; best = c; }
  }
  if (best) runJob(texJob(best), t0 + budget);
  // evict textures whose chunk is gone, then the farthest beyond the cap
  if (frameNo % 30 === 0) {
    for (const [k, t] of GTEX) if (!CHUNKS.has(k)) GTEX.delete(k);
    for (const [k, j] of GJOBS) if (!CHUNKS.has(k)) GJOBS.delete(k);
    if (GTEX.size > GTEX_CAP) {
      const arr = [...GTEX.entries()].map(([k, t]) => [k, Math.hypot((t.c.cx + 0.5) * CS - CAM.x, (t.c.cy + 0.5) * CS - CAM.y)]).sort((a, b) => b[1] - a[1]);
      for (let i = 0; i < arr.length && GTEX.size > GTEX_CAP; i++) GTEX.delete(arr[i][0]);
    }
  }
}
function drawGround() {
  const cs2 = CAM.c, sn = CAM.s;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const [sx, sy] of [[0, 0], [LW, 0], [0, LH], [LW, LH]]) { const w = s2w(sx, sy); x0 = Math.min(x0, w[0]); x1 = Math.max(x1, w[0]); y0 = Math.min(y0, w[1]); y1 = Math.max(y1, w[1]); }
  const c0x = Math.floor(x0 / CS), c1x = Math.floor(x1 / CS), c0y = Math.floor(y0 / CS), c1y = Math.floor(y1 / CS);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) {
    const t = ensureTex(getChunk(cx, cy)); t.f = frameNo;
    const dx = cx * CS - 1 / PPU - CAM.x, dy = cy * CS - 1 / PPU - CAM.y;
    lctx.setTransform(-sn, -SQ * cs2, cs2, -SQ * sn, FCX + PPU * (-sn * dx + cs2 * dy), FCY - PPU * SQ * (cs2 * dx + sn * dy));
    lctx.drawImage(t.cv, 0, 0);
  }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
}

// ---------- lights ----------
const LIGHTS = [];
function collectLights() {
  LIGHTS.length = 0;
  if (S.darkness < 0.05) return;
  const fl = 1 + Math.sin(S.t * 13) * 0.04 + Math.sin(S.t * 31) * 0.03;
  if (S.mode !== 'title' && hasTorch()) LIGHTS.push([P.x, P.y, 8.5 * fl, 1]); else LIGHTS.push([P.x, P.y, 2.6, 0]);
  const pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS), rad = VIEWR + 10;
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c) continue;
    for (const o of c.statics) {
      if (Math.abs(o.x - CAM.x) > rad || Math.abs(o.y - CAM.y) > rad) continue;
      if (o.light) LIGHTS.push([o.x, o.y, o.light * 0.85 * fl, 1]);
      else if (o.type === 'house') LIGHTS.push([o.x, o.y, 3.8, 1]);
    }
  }
  for (const e of S.ents) { if (e.burnT > 0) LIGHTS.push([e.x, e.y, 2.8, 1]); else if (e.state === 'cast') LIGHTS.push([e.x, e.y, 2.4, 1]); }
  for (const p of S.projs) if (p.kind === 'fire') LIGHTS.push([p.x, p.y, 3.2, 1]);
  if (S.mode === 'title' && S.darkness > 0.3) LIGHTS[0][2] = 5;
}
function drawLighting() {
  const d = S.darkness, du = d > 0.02 && d < 0.98 ? Math.max(0, 1 - Math.abs(d - 0.5) * 2.4) : 0;
  if (d > 0.02) {
    lgt.setTransform(1, 0, 0, 1, 0, 0); lgt.globalCompositeOperation = 'source-over'; lgt.clearRect(0, 0, LW, LH);
    lgt.fillStyle = S.bloodMoon ? 'rgba(42,4,10,' + (0.84 * d).toFixed(3) + ')' : 'rgba(4,8,28,' + (0.84 * d).toFixed(3) + ')';
    lgt.fillRect(0, 0, LW, LH);
    lgt.globalCompositeOperation = 'destination-out'; lgt.fillStyle = 'rgba(0,0,0,0.36)';
    for (const L of LIGHTS) {
      const q = w2s(L[0], L[1]), r = L[2] * PPU;
      if (q[0] < -r || q[0] > LW + r || q[1] < -r || q[1] > LH + r) continue;
      for (let k = 0; k < 5; k++) { const rr2 = Math.round(r * (1 - k * 0.17)); lgt.beginPath(); lgt.ellipse(Math.round(q[0]), Math.round(q[1] - 8), rr2, Math.round(rr2 * SQ), 0, 0, TAU); lgt.fill(); }
    }
    lgt.globalCompositeOperation = 'source-over';
    lctx.drawImage(lightC, 0, 0);
    lctx.globalCompositeOperation = 'lighter';
    lctx.fillStyle = 'rgba(255,120,30,' + (0.08 * d).toFixed(3) + ')';
    for (const L of LIGHTS) { if (!L[3]) continue; const q = w2s(L[0], L[1]), r = L[2] * PPU * 0.7; lctx.beginPath(); lctx.ellipse(Math.round(q[0]), Math.round(q[1] - 8), r, r * SQ, 0, 0, TAU); lctx.fill(); }
    lctx.globalCompositeOperation = 'source-over';
  }
  if (du > 0) { lctx.fillStyle = 'rgba(255,110,40,' + (0.13 * du).toFixed(3) + ')'; lctx.fillRect(0, 0, LW, LH); }
}

// ---------- pixel font (5×7) ----------
const FONT5 = {};
('0:01110100011001110101110011000101110,1:00100011000010000100001000010001110,2:01110100010000100010001000100011111,3:11110000010000101110000010000111110,' +
  '4:00010001100101010010111110001000010,5:11111100001111000001000011000101110,6:00110010001000011110100011000101110,7:11111000010001000100010000100001000,' +
  '8:01110100011000101110100011000101110,9:01110100011000101111000010001001100,A:01110100011000111111100011000110001,B:11110100011000111110100011000111110,' +
  'C:01110100011000010000100001000101110,D:11110100011000110001100011000111110,E:11111100001000011110100001000011111,F:11111100001000011110100001000010000,' +
  'G:01110100011000010111100011000101111,H:10001100011000111111100011000110001,I:01110001000010000100001000010001110,J:00111000100001000010000101001001100,' +
  'K:10001100101010011000101001001010001,L:10000100001000010000100001000011111,M:10001110111010110101100011000110001,N:10001100011100110101100111000110001,' +
  'O:01110100011000110001100011000101110,P:11110100011000111110100001000010000,Q:01110100011000110001101011001001101,R:11110100011000111110101001001010001,' +
  'S:01111100001000001110000010000111110,T:11111001000010000100001000010000100,U:10001100011000110001100011000101110,V:10001100011000110001100010101000100,' +
  'W:10001100011000110101101011010101010,X:10001100010101000100010101000110001,Y:10001100010101000100001000010000100,Z:11111000010001000100010001000011111,' +
  '!:00100001000010000100001000000000100,+:00000001000010011111001000010000000,-:00000000000000011111000000000000000,$:00100011111010001110001011111000100,' +
  '?:01110100010000100010001000000000100,.:00000000000000000000000000110001100,/:00001000100001000100010000100010000, :00000000000000000000000000000000000').split(',').forEach(s => { FONT5[s[0]] = s.slice(2); });
FONT5[':'] = '00000011000110000000011000110000000';
const TXT = new Map();
function txtImg(s, col) {
  s = String(s).toUpperCase(); const k = s + col;
  let c = TXT.get(k); if (c) return c;
  const W = s.length * 6 + 1, H = 9; c = mkCanvas(W, H); const x = c2d(c), pix = [];
  for (let i = 0; i < s.length; i++) { const g = FONT5[s[i]] || FONT5['?']; for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) if (g[r * 5 + q] === '1') pix.push([1 + i * 6 + q, 1 + r]); }
  x.fillStyle = '#140c08'; for (const [px2, py] of pix) x.fillRect(px2 - 1, py - 1, 3, 3);
  x.fillStyle = col; for (const [px2, py] of pix) x.fillRect(px2, py, 1, 1);
  x.fillStyle = 'rgba(255,255,255,0.35)'; for (const [px2, py] of pix) if (py <= 2) x.fillRect(px2, py, 1, 1);
  TXT.set(k, c); if (TXT.size > 400) TXT.delete(TXT.keys().next().value);
  return c;
}
function drawTxt(s, x, y, col) { const c = txtImg(s, col); lctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y)); }

// ---------- frame ----------
const DRAW = [], SHAD = [], OVL = [], SPARK = [], SMOKE = [];
function onScreen(x, y, m) { return x > -m && x < LW + m && y > -m && y < LH + m * 1.5; }
let PLY = [0, 0], PLYTOP = 30;
function buildDrawList() {
  DRAW.length = 0; SHAD.length = 0; OVL.length = 0;
  const rad = VIEWR + 8, pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS), cr = Math.ceil(rad / CS);
  for (let j = -cr; j <= cr; j++) for (let i = -cr; i <= cr; i++) {
    const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c) continue;
    for (const o of c.statics) {
      if (Math.abs(o.x - CAM.x) > rad || Math.abs(o.y - CAM.y) > rad) continue;
      const q = w2s(o.x, o.y); if (!onScreen(q[0], q[1], 140)) continue;
      const [key, build, nb] = staticModel(o);
      const rot = o.rot !== undefined ? o.rot : hash2(Math.round(o.x * 7), Math.round(o.y * 7)) * TAU;
      DRAW.push({ x: q[0], y: q[1], cp: comp(key, build, rot - CAM.a, nb), lift: 0, st: true });
      if (o.type !== 'house' && o.type !== 'ruin' && o.type !== 'fire') SHAD.push([q[0], q[1], (o.r + 0.6) * PPU]);
      if (o.type === 'house' && o.v !== 'sand') smokeFrom(o, rot);
    }
  }
  for (const e of S.ents) {
    if (e.dead) continue;
    const q = w2s(e.x, e.y); if (!onScreen(q[0], q[1], 120)) continue;
    const [key, build] = entModel(e), lift = Math.round(e.elev * PPU);
    const cp = comp(key, build, e.a - CAM.a, e.k.boss ? 32 : NB);
    const tint = e.hurtT > 0 ? '#ffffff' : (e.burnT > 0 && ((S.t * 12) | 0) % 2 ? '#ff8a2a' : null);
    DRAW.push({ x: q[0], y: q[1], cp, lift, tint, ta: e.hurtT > 0 ? 0.85 : 0.55 });
    SHAD.push([q[0], q[1], (e.r + 0.3) * PPU]);
    OVL.push({ e, x: q[0], y: q[1] - lift - cp.top });
  }
  for (const c of S.corpses) {
    const q = w2s(c.x, c.y); if (!onScreen(q[0], q[1], 80)) continue;
    const [key, build] = lyingModel(c.c);
    DRAW.push({ x: q[0], y: q[1] - 1, cp: comp(key, build, hash2(Math.round(c.x * 9), Math.round(c.y * 9)) * TAU - CAM.a, 32), lift: 0 });
  }
  for (const d of S.drops) {
    const q = w2s(d.x, d.y); if (!onScreen(q[0], q[1], 40)) continue;
    const lift = 3 + Math.round(Math.sin(S.t * 3 + d.x) * 3);
    const cp = d.kind === 'gold' ? comp('coins', mkCoins, 0, 1) : comp('loot|' + d.id, () => mkLoot(d.id), S.t * 1.5 + d.x, 32);
    DRAW.push({ x: q[0], y: q[1], cp, lift });
    SHAD.push([q[0], q[1], 6]);
    if (d.kind !== 'gold') OVL.push({ spark: true, x: q[0], y: q[1] - lift - cp.top, d });
  }
  for (const p of S.projs) {
    if (p.kind !== 'boulder') continue;
    const q = w2s(p.x, p.y); if (!onScreen(q[0], q[1], 80)) continue;
    DRAW.push({ x: q[0], y: q[1], cp: comp(p.frost ? 'boulderF' : 'boulder', () => mkBoulder(p.frost), S.t * 4, 16), lift: Math.round(p.elev * PPU) });
    SHAD.push([q[0], q[1], 10 + Math.max(0, 12 - p.elev * 2)]);
  }
  if (!P.mounted && S.mode !== 'title') {
    const h = S.horse, q = w2s(h.x, h.y);
    if (onScreen(q[0], q[1], 120)) {
      const fr = h.state === 'coming' || h.state === 'flee' ? 1 + (Math.floor(S.t * 9) % 2) : 0;
      DRAW.push({ x: q[0], y: q[1], cp: comp('horse|' + fr, () => mkHorse({ saddle: true, cloth: '#2f5fc0', frame: fr }), h.a - CAM.a, NB), lift: 0 });
      SHAD.push([q[0], q[1], 1.3 * PPU]);
    }
  }
  {
    const q = w2s(P.x, P.y), [key, build] = playerModel(); PLY = q;
    const cp = comp(key, build, P.a - CAM.a, NB);
    const tint = P.hurtT > 0 && ((S.t * 20) | 0) % 2 ? '#ff4030' : null;
    DRAW.push({ x: q[0], y: q[1], cp, lift: 0, tint, ta: 0.6, player: true }); PLYTOP = cp.top;
    SHAD.push([q[0], q[1], (P.mounted ? 1.3 : 0.75) * PPU]);
  }
  DRAW.sort((a, b) => a.y - b.y);
}
function smokeFrom(o, rot) {
  if (S.mode === 'paused' || Math.random() > 0.05) return;
  // chimney position in model space (x right, y back), units from the house centre
  const mx = (66 - 42) / PPU, my = (26 - 34) / PPU, f = [Math.cos(rot), Math.sin(rot)], r = [-Math.sin(rot), Math.cos(rot)];
  SMOKE.push({ x: o.x + mx * r[0] - my * f[0], y: o.y + mx * r[1] - my * f[1], z: 72 / PPU, t: 0, s: 1 + Math.random() });
  if (SMOKE.length > 60) SMOKE.shift();
}
function drawShadows() {
  lctx.fillStyle = 'rgba(10,8,20,0.26)';
  for (const s of SHAD) { lctx.beginPath(); lctx.ellipse(Math.round(s[0]), Math.round(s[1]), s[2], Math.max(1, s[2] * SQ * 0.8), 0, 0, TAU); lctx.fill(); }
}
function drawStacks(emissive) {
  const pxs = PLY[0], pys = PLY[1] - 16;
  if (emissive) { if (S.darkness < 0.04) return; lctx.globalCompositeOperation = 'screen'; lctx.globalAlpha = Math.min(0.8, S.darkness); }
  for (const d of DRAW) {
    const x = Math.round(d.x - d.cp.ax), y = Math.round(d.y - d.cp.ay - d.lift);
    // statics standing between the camera and the player turn see-through
    const fade = d.st && d.y > PLY[1] + 2 && pxs > x + 4 && pxs < x + d.cp.w - 4 && pys > y && pys < y + d.cp.h - 6;
    if (emissive) { if (d.cp.em && !d.tint && !fade) lctx.drawImage(d.cp.em, x, y); continue; }
    if (fade) lctx.globalAlpha = 0.4;
    lctx.drawImage(d.tint ? tintOf(d.cp, d.tint, d.ta) : d.cp.c, x, y);
    if (fade) lctx.globalAlpha = 1;
  }
  if (emissive) { lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1; }
}
function px(x, y, w, h, col) { lctx.fillStyle = col; lctx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawParticles(em) {
  for (const p of S.parts) {
    if (!!p.em !== em) continue;
    const q = w2s(p.x, p.y), x = Math.round(q[0]), y = Math.round(q[1] - p.elev * PPU);
    if (x < -6 || y < -6 || x > LW + 6 || y > LH + 6) continue;
    const col = p.col.charCodeAt(0) === 33 ? p.col.slice(1) : p.col, ch = p.ch;
    if (ch === '*' || ch === '+') { px(x, y - 2, 1, 5, col); px(x - 2, y, 5, 1, col); px(x - 1, y - 1, 3, 3, col); }
    else if (ch === 'o' || ch === 'O' || ch === '@' || ch === '$') { px(x - 1, y, 4, 2, col); px(x, y - 1, 2, 4, col); }
    else if (ch === '~' || ch === '-' || ch === '=') { px(x - 2, y, 5, 2, col); px(x - 1, y - 1, 3, 1, col); }
    else if (ch === '^' || ch === '&') { px(x, y - 2, 2, 4, col); }
    else px(x, y, 2, 2, col);
  }
}
function drawSmoke(dt) {
  for (let i = SMOKE.length - 1; i >= 0; i--) {
    const s = SMOKE[i]; if (S.mode !== 'paused') { s.t += dt; s.z += dt * 1.1; s.x += dt * 0.6; }
    if (s.t > 3) { SMOKE.splice(i, 1); continue; }
    const q = w2s(s.x, s.y), r = Math.round(2 + s.t * 2 * s.s), a = (0.32 * (1 - s.t / 3)).toFixed(3);
    lctx.fillStyle = 'rgba(190,190,196,' + a + ')'; lctx.beginPath(); lctx.arc(Math.round(q[0]), Math.round(q[1] - s.z * PPU), r, 0, TAU); lctx.fill();
  }
}
function drawProjectiles() {
  for (const p of S.projs) {
    if (p.kind === 'boulder') continue;
    const q = w2s(p.x, p.y), x = q[0], y = q[1] - p.elev * PPU;
    if (!onScreen(x, y, 20)) continue;
    if (p.kind === 'arrow') {
      const sp = Math.hypot(p.vx, p.vy) || 1, t = w2s(p.x - p.vx / sp * 0.9, p.y - p.vy / sp * 0.9), tx = t[0], ty = t[1] - p.elev * PPU;
      const n = Math.max(1, Math.round(Math.hypot(x - tx, y - ty)));
      for (let i = 0; i <= n; i++) px(lerp(tx, x, i / n), lerp(ty, y, i / n), 1, 1, i >= n - 1 ? '#e8eef4' : i <= 2 ? '#f4f0e8' : '#a8784a');
    } else if (p.kind === 'ball') { px(x - 1, y - 1, 3, 3, '#3a3a40'); px(x - 1, y - 1, 1, 1, '#d0d0d8'); }
    else if (p.kind === 'pball') { px(x - 1, y - 1, 3, 3, '#ffe080'); px(x, y, 1, 1, '#ffffff'); }
    else if (p.kind === 'fire') {
      lctx.fillStyle = '#ff5a10'; lctx.beginPath(); lctx.arc(Math.round(x), Math.round(y), 5, 0, TAU); lctx.fill();
      lctx.fillStyle = '#ffb030'; lctx.beginPath(); lctx.arc(Math.round(x), Math.round(y), 3.4, 0, TAU); lctx.fill();
      px(x - 1, y - 1, 3, 3, '#fff2b0');
    }
  }
  for (const m of S.marks) {
    if (((S.t * 8) | 0) % 2) continue;
    const q = w2s(m.x, m.y), x = Math.round(q[0]), y = Math.round(q[1]);
    for (let i = -7; i <= 7; i++) { px(x + i, y + Math.round(i * SQ), 2, 1, '#ff3a2a'); px(x + i, y - Math.round(i * SQ), 2, 1, '#ff3a2a'); }
  }
}
function drawOverlays() {
  const blink = ((S.t * 8) | 0) % 2;
  for (const o of OVL) {
    if (o.spark) { if (((S.t * 4 + o.d.x) | 0) % 3 === 0) { px(o.x, o.y - 6, 1, 5, '#fff6c0'); px(o.x - 2, o.y - 4, 5, 1, '#fff6c0'); } continue; }
    const e = o.e, k = e.k; let y = Math.round(o.y - 4);
    if (e.downT > 0) { const a = S.t * 6; for (let i = 0; i < 3; i++) { const b = a + i * 2.1; px(o.x + Math.cos(b) * 8, y + 12 + Math.sin(b) * 3, 2, 2, '#ffd84a'); } continue; }
    if (e.state === 'wind' || e.state === 'aim' || e.state === 'cast' || e.state === 'slam' || e.state === 'throw') { drawTxt(k.boss ? '!!' : '!', o.x, y - 9, blink ? '#ffd84a' : '#ff5a3a'); y -= 10; }
    if (e.team === 1 && !k.boss && e.hp < e.maxHp) { const w = 18, f = Math.ceil(clamp(e.hp / e.maxHp, 0, 1) * w), x0 = Math.round(o.x - w / 2); px(x0 - 1, y - 1, w + 2, 4, '#140c08'); px(x0, y, w, 2, '#4a1a1a'); px(x0, y, f, 2, '#e8443a'); px(x0, y, f, 1, '#ff8a7a'); y -= 5; }
    if (e.team === 2) { drawTxt('$', o.x, y - 9, '#ffd84a'); y -= 10; }
    if (e === S.aim) { const ax = Math.round(o.x); for (let i = 0; i < 5; i++) px(ax - 4 + i, y - 6 + i, 9 - i * 2, 1, '#ffd84a'); px(ax - 5, y - 7, 11, 1, '#140c08'); }
  }
  if (P.drawing && twoHanded()) { // bow draw charge above the player's head
    const it = ITEMS[P.hands[1]], ch = clamp(P.draw / it.draw, 0, 1), x0 = Math.round(PLY[0] - 12), y0 = Math.round(PLY[1] - PLYTOP - 8);
    px(x0 - 1, y0 - 1, 26, 4, '#140c08'); px(x0, y0, 24, 2, '#3a2a14'); px(x0, y0, Math.round(24 * ch), 2, ch >= 0.98 ? '#ffd84a' : '#e8e0c8');
  }
  for (const t of S.texts) {
    const q = w2s(t.x, t.y);
    drawTxt(t.s, q[0], q[1] - t.elev * PPU - 10, t.col.charCodeAt(0) === 33 ? t.col.slice(1) : t.col);
  }
}
function drawCloudShadows() {
  const a = (1 - S.darkness) * 0.08; if (a < 0.01) return;
  const cell = 44, t = S.t * 1.3;
  lctx.fillStyle = 'rgba(0,0,10,' + a.toFixed(3) + ')';
  const i0 = Math.floor((CAM.x - t - VIEWR) / cell), i1 = Math.floor((CAM.x - t + VIEWR) / cell), j0 = Math.floor((CAM.y - t * 0.4 - VIEWR) / cell), j1 = Math.floor((CAM.y - t * 0.4 + VIEWR) / cell);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const h = hash2(i * 3 + 101, j * 5 + 77); if (h > 0.45) continue;
    const wx = i * cell + t + hash2(i, j) * cell, wy = j * cell + t * 0.4 + hash2(j, i) * cell, r = (6 + h * 22) * PPU;
    const q = w2s(wx, wy); if (!onScreen(q[0], q[1], r)) continue;
    lctx.beginPath(); lctx.ellipse(Math.round(q[0]), Math.round(q[1]), r, r * SQ * 0.8, 0, 0, TAU); lctx.fill();
  }
}
function drawWater(dt) {
  for (let i = 0; i < 6; i++) {
    const sx = Math.random() * LW, sy = Math.random() * LH, w = s2w(sx, sy), t = tileAtWorld(w[0], w[1]);
    if (t === T_WATER) SPARK.push({ x: w[0], y: w[1], t: 0.8 });
  }
  for (let i = SPARK.length - 1; i >= 0; i--) { const s = SPARK[i]; s.t -= dt; if (s.t <= 0) { SPARK.splice(i, 1); continue; } const q = w2s(s.x, s.y); px(q[0], q[1], s.t > 0.4 ? 5 : 3, 1, '#c0dcff'); if (s.t > 0.55) px(q[0] + 1, q[1] - 1, 2, 1, '#ffffff'); }
  if (SPARK.length > 100) SPARK.splice(0, SPARK.length - 100);
}
function drawSnow(dt) {
  const want = S.curBiome === B_SNOW ? Math.floor(LW * LH / 650) : 0, F = S.flakes;
  while (F.length < want) F.push({ x: Math.random() * LW, y: Math.random() * LH, v: rr(20, 55), s: Math.random() < 0.3 ? 2 : 1, ph: Math.random() * TAU });
  if (F.length > want) F.length = want;
  if (!F.length) return;
  lctx.fillStyle = S.darkness > 0.5 ? '#aab8d0' : '#ffffff';
  for (const f of F) {
    f.y += f.v * dt; f.x += (Math.sin(S.t * 1.3 + f.ph) * 14 - 10) * dt;
    if (f.y > LH) { f.y = -2; f.x = Math.random() * LW; }
    if (f.x < 0) f.x += LW; if (f.x > LW) f.x -= LW;
    lctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
  }
}
let lastRenderMs = 0;
function render(dt) {
  dt = dt || 0.016; frameNo++; frameStart = now();
  compBudgetMs = S.mode === 'loading' ? 40 : 3;
  collectLights();
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.globalAlpha = 1;
  lctx.fillStyle = '#0a0806'; lctx.fillRect(0, 0, LW, LH);
  drawGround();
  drawWater(dt);
  drawCloudShadows();
  buildDrawList();
  drawShadows();
  drawStacks(false);
  drawParticles(false);
  drawProjectiles();
  drawSmoke(dt);
  drawSnow(dt);
  drawLighting();
  drawStacks(true);
  drawParticles(true);
  drawOverlays();
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalAlpha = 1;
  if (S.flash > 0) { lctx.fillStyle = 'rgba(190,20,10,' + (S.flash * 0.45).toFixed(3) + ')'; lctx.fillRect(0, 0, LW, LH); }
  if (S.fade > 0) { lctx.fillStyle = 'rgba(0,0,0,' + clamp(S.fade, 0, 1).toFixed(3) + ')'; lctx.fillRect(0, 0, LW, LH); }
  // the browser scales the low-res canvas up (no full-resolution copy); shake is a compositor transform
  const sh = S.shake > 0 ? Math.round(S.shake * 7) : 0;
  const sc = sh ? 'translate(' + (ri(-sh, sh) * SC / DPR) + 'px,' + (ri(-sh, sh) * SC / DPR) + 'px)' : '';
  if (sc !== shakeCss && low.style) { low.style.transform = sc; shakeCss = sc; }
  // HUD overlay at device resolution
  const hud = S.mode !== 'title' && S.mode !== 'loading';
  if (hud || hudDirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); hudDirty = false; }
  if (hud) { drawHUD(); hudDirty = true; }
  // background work with what is left of the frame budget
  prewarmGround(S.mode === 'loading' ? 30 : Math.max(1, 9 - (now() - frameStart)));
  lastRenderMs = now() - frameStart;
}
// pre-build common stacks (called while loading); returns how many were built
function prewarmStacks(n) {
  const list = [['pine0', () => mkPine(0, false)], ['pine1', () => mkPine(1, false)], ['pine2', () => mkPine(2, false)], ['oak0', () => mkOak(0)], ['oak1', () => mkOak(1)],
    ['bush0', () => mkBush(0)], ['bush1', () => mkBush(1)], ['rock0_0', () => mkRock(0, 0)], ['rock1_0', () => mkRock(1, 0)], ['rock2_0', () => mkRock(2, 0)]];
  let made = 0;
  for (const [k, b] of list) for (let i = 0; i < NBS && made < n; i++) { if (!COMPS.has(k + '@' + i + '/' + NBS)) { frameStart = now(); comp(k, b, i / NBS * TAU, NBS); made++; } }
  return made;
}
