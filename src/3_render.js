// =====================================================================
//  RENDERER — sprite-stacked pixel art
//  Every object is a voxel model cut into 1-voxel horizontal slices.
//  A stack is drawn slice 0 first; every slice is rotated by the same
//  angle (nearest neighbour), squashed by SQ and lifted 1 px per slice.
//  Finished stacks are outlined once and cached per angle bucket.
// =====================================================================
const PPU = 8, SQ = 0.75, NB = 64;
const OUTLINE = '#140e0a';
let canvas = null, ctx = null, low = null, lctx = null, lightC = null, lgt = null, scratch = null, scx = null, silC = null;
let VW = 800, VH = 600, DPR = 1, SC = 3, LW = 266, LH = 200, FCX = 133, FCY = 128, VIEWR = 40, PORTRAIT = false;
let frameNo = 0, compBudget = 14;
const CAM = { x: 0, y: 0, a: 0, c: 1, s: 0 };
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function c2d(c) { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; }

function resize() {
  VW = window.innerWidth || 800; VH = window.innerHeight || 600; DPR = Math.min(3, window.devicePixelRatio || 1);
  canvas.width = Math.round(VW * DPR); canvas.height = Math.round(VH * DPR);
  ctx.imageSmoothingEnabled = false;
  PORTRAIT = VH > VW;
  const shortDev = Math.min(canvas.width, canvas.height);
  SC = Math.max(1, Math.round(shortDev / (PORTRAIT ? 188 : 228)));
  LW = Math.ceil(canvas.width / SC); LH = Math.ceil(canvas.height / SC);
  if (!low) { low = mkCanvas(LW, LH); lightC = mkCanvas(LW, LH); scratch = mkCanvas(128, 128); silC = mkCanvas(128, 128); }
  low.width = LW; low.height = LH; lightC.width = LW; lightC.height = LH;
  lctx = c2d(low); lgt = c2d(lightC); scx = c2d(scratch);
  FCX = Math.floor(LW / 2); FCY = Math.floor(LH * (PORTRAIT ? 0.66 : 0.64));
  VIEWR = Math.ceil(Math.hypot(Math.max(FCX, LW - FCX) / PPU, Math.max(FCY, LH - FCY) / (PPU * SQ))) + 6;
  groundKey = '';
  if (S) S.flakes = [];
  if (typeof layoutTouch === 'function') layoutTouch();
}
function w2s(x, y) { const dx = x - CAM.x, dy = y - CAM.y; return [FCX + PPU * (-dx * CAM.s + dy * CAM.c), FCY - PPU * SQ * (dx * CAM.c + dy * CAM.s)]; }
function s2w(sx, sy) { const r = (sx - FCX) / PPU, f = (FCY - sy) / (PPU * SQ); return [CAM.x + f * CAM.c - r * CAM.s, CAM.y + f * CAM.s + r * CAM.c]; }
function hx(col, f) { const c = rgbOf(col); return '#' + [0, 1, 2].map(i => clamp(Math.round(c[i] * f), 0, 255).toString(16).padStart(2, '0')).join(''); }

// ---------- voxel models ----------
const VPAL = [[0, 0, 0]], VEM = [false], VPALI = new Map();
function ci(col, em) {
  if (col[0] === '!') { em = true; col = col.slice(1); }
  const k = em ? col + '!' : col; let i = VPALI.get(k);
  if (i === undefined) { i = VPAL.length; if (i > 255) return 1; VPAL.push(rgbOf(col)); VEM.push(!!em); VPALI.set(k, i); }
  return i;
}
function VM(w, d, h) { return { w, d, h, v: new Uint8Array(w * d * h) }; }
function vs(m, x, y, z, c) { x = Math.round(x); y = Math.round(y); z = Math.round(z); if (x < 0 || y < 0 || z < 0 || x >= m.w || y >= m.d || z >= m.h) return; m.v[(z * m.d + y) * m.w + x] = c; }
function vbox(m, x0, y0, z0, x1, y1, z1, c) { for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) vs(m, x, y, z, c); }
function vline(m, x0, y0, z0, x1, y1, z1, c, thick) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t; vs(m, x, y, z, c); if (thick) { vs(m, x + 1, y, z, c); vs(m, x, y + 1, z, c); } }
}
function vdisc(m, cx, cy, r, z, c, seed) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr2 = seed !== undefined ? r + (hash2(x * 7 + seed, y * 13 + z * 3) - 0.5) * 1.6 : r;
    if (dx * dx + dy * dy <= rr2 * rr2) vs(m, x, y, z, c);
  }
}
function vcone(m, cx, cy, r0, r1, z0, z1, c, seed) { for (let z = z0; z <= z1; z++) vdisc(m, cx, cy, lerp(r0, r1, (z - z0) / Math.max(1, z1 - z0)), z, c, seed); }
function vblob(m, cx, cy, cz, rx, ry, rz, c, seed, amt) {
  for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++) for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, nz = (z + 0.5 - cz) / rz;
    const n = amt ? (hash2(x * 7 + (seed | 0), y * 13 + z * 31) - 0.5) * amt : 0;
    if (nx * nx + ny * ny + nz * nz <= 1 + n) vs(m, x, y, z, c);
  }
}
function vtop(m, c, p, seed, colorsOnly) { // recolour exposed top voxels (snow, moss)
  const W = m.w, D = m.d;
  for (let z = 0; z < m.h; z++) for (let y = 0; y < D; y++) for (let x = 0; x < W; x++) {
    const i = (z * D + y) * W + x; if (!m.v[i]) continue;
    if (colorsOnly && !colorsOnly.includes(m.v[i])) continue;
    const above = z + 1 < m.h ? m.v[i + W * D] : 0;
    if (!above && hash2(x * 7 + z * 3 + (seed | 0), y * 13 + z) < p) m.v[i] = c;
  }
}
// tip a standing model onto its back (z → y)
function lie(src, y0, H) {
  H = H || 8; const m = VM(src.w, src.h + 2, H);
  for (let z = 0; z < src.h; z++) for (let y = 0; y < src.d; y++) for (let x = 0; x < src.w; x++) {
    const c = src.v[(z * src.d + y) * src.w + x]; if (!c) continue;
    const nz = y - y0; if (nz < 0 || nz >= H) continue;
    vs(m, x, z + 1, nz, c);
  }
  return m;
}
// tip onto its side (z → x), for horses
function lieSide(src, x0, H) {
  H = H || 8; const m = VM(src.h + 2, src.d, H);
  for (let z = 0; z < src.h; z++) for (let y = 0; y < src.d; y++) for (let x = 0; x < src.w; x++) {
    const c = src.v[(z * src.d + y) * src.w + x]; if (!c) continue;
    const nz = x - x0; if (nz < 0 || nz >= H) continue;
    vs(m, z + 1, y, nz, c);
  }
  return m;
}

// slices → sheet (one row of slices); side faces darker than tops
function finalize(m) {
  const W = m.w * m.h, D = m.d;
  const sheet = mkCanvas(W, D), sx = sheet.getContext('2d'), id = sx.createImageData(W, D), px = id.data;
  const ems = [];
  for (let z = 0; z < m.h; z++) for (let y = 0; y < D; y++) for (let x = 0; x < m.w; x++) {
    const i = (z * D + y) * m.w + x, c = m.v[i]; if (!c) continue;
    const o = (y * W + z * m.w + x) * 4, col = VPAL[c];
    let f = 1;
    if (VEM[c]) ems.push(o);
    else { const above = z + 1 < m.h ? m.v[i + m.w * D] : 0; f = above ? (z < 2 ? 0.62 : 0.74) : 1.06; }
    px[o] = Math.min(255, col[0] * f); px[o + 1] = Math.min(255, col[1] * f); px[o + 2] = Math.min(255, col[2] * f); px[o + 3] = 255;
  }
  sx.putImageData(id, 0, 0);
  let em = null, occ = null;
  if (ems.length) {
    em = mkCanvas(W, D); occ = mkCanvas(W, D);
    const ex = em.getContext('2d'), ox = occ.getContext('2d');
    const eid = ex.createImageData(W, D), oid = ox.createImageData(W, D);
    oid.data.set(px);
    for (const o of ems) { for (let k = 0; k < 4; k++) eid.data[o + k] = px[o + k]; oid.data[o + 3] = 0; }
    ex.putImageData(eid, 0, 0); ox.putImageData(oid, 0, 0);
  }
  return { w: m.w, d: m.d, h: m.h, cx: m.w / 2, cy: m.d / 2, sheet, em, occ };
}
function buildComp(m, th) {
  const cs = Math.cos(th), sn = Math.sin(th);
  const diag = Math.ceil(Math.hypot(m.w, m.d));
  const W = diag + 4, gH = Math.ceil(diag * SQ), H = gH + m.h + 4;
  const ax = Math.floor(W / 2), ay = H - 2 - Math.ceil(gH / 2);
  if (scratch.width < W || scratch.height < H) { scratch.width = Math.max(scratch.width, W); scratch.height = Math.max(scratch.height, H); scx = c2d(scratch); }
  scx.setTransform(1, 0, 0, 1, 0, 0); scx.globalCompositeOperation = 'source-over'; scx.clearRect(0, 0, W, H);
  for (let z = 0; z < m.h; z++) { scx.setTransform(cs, SQ * sn, -sn, SQ * cs, ax, ay - z); scx.drawImage(m.sheet, z * m.w, 0, m.w, m.d, -m.cx, -m.cy, m.w, m.d); }
  scx.setTransform(1, 0, 0, 1, 0, 0);
  // outline once, on the finished stack
  if (silC.width < W || silC.height < H) { silC.width = Math.max(silC.width, W); silC.height = Math.max(silC.height, H); }
  const sl = c2d(silC); sl.setTransform(1, 0, 0, 1, 0, 0); sl.globalCompositeOperation = 'source-over'; sl.clearRect(0, 0, silC.width, silC.height);
  sl.drawImage(scratch, 0, 0, W, H, 0, 0, W, H); sl.globalCompositeOperation = 'source-in'; sl.fillStyle = OUTLINE; sl.fillRect(0, 0, W, H); sl.globalCompositeOperation = 'source-over';
  const out = mkCanvas(W, H), o = c2d(out);
  o.drawImage(silC, 0, 0, W, H, -1, 0, W, H); o.drawImage(silC, 0, 0, W, H, 1, 0, W, H); o.drawImage(silC, 0, 0, W, H, 0, -1, W, H); o.drawImage(silC, 0, 0, W, H, 0, 1, W, H);
  o.drawImage(scratch, 0, 0, W, H, 0, 0, W, H);
  let em = null;
  if (m.em) {
    em = mkCanvas(W, H); const e = c2d(em);
    for (let z = 0; z < m.h; z++) {
      e.setTransform(cs, SQ * sn, -sn, SQ * cs, ax, ay - z);
      e.globalCompositeOperation = 'destination-out'; e.drawImage(m.occ, z * m.w, 0, m.w, m.d, -m.cx, -m.cy, m.w, m.d);
      e.globalCompositeOperation = 'source-over'; e.drawImage(m.em, z * m.w, 0, m.w, m.d, -m.cx, -m.cy, m.w, m.d);
    }
  }
  return { c: out, em, ax, ay, top: m.h + Math.ceil(gH / 2), w: W, h: H, t: null };
}
const MODELS = new Map(), COMPS = new Map();
function getModel(key, build) {
  let m = MODELS.get(key);
  if (!m) { m = finalize(build()); MODELS.set(key, m); if (MODELS.size > 700) MODELS.delete(MODELS.keys().next().value); }
  return m;
}
function comp(key, build, th, nb) {
  nb = nb || NB;
  const b = ((Math.round(th / TAU * nb) % nb) + nb) % nb;
  const ck = key + '@' + b + '/' + nb;
  let c = COMPS.get(ck);
  if (c) { if (c.f !== frameNo) { c.f = frameNo; COMPS.delete(ck); COMPS.set(ck, c); } return c; }
  if (compBudget <= 0) {
    for (let k = 1; k <= nb / 2; k++) for (const s of [-1, 1]) { const c2 = COMPS.get(key + '@' + (((b + s * k) % nb) + nb) % nb + '/' + nb); if (c2) return c2; }
  }
  compBudget--;
  c = buildComp(getModel(key, build), b / nb * TAU); c.f = frameNo;
  COMPS.set(ck, c);
  if (COMPS.size > 2600) { const it = COMPS.keys(); for (let i = 0; i < 300; i++) COMPS.delete(it.next().value); }
  return c;
}
function tintOf(cp, col, a) {
  const k = col + (a || 1); cp.t = cp.t || {};
  let c = cp.t[k]; if (c) return c;
  c = mkCanvas(cp.w, cp.h); const x = c2d(c); x.drawImage(cp.c, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.globalAlpha = a || 1; x.fillStyle = col; x.fillRect(0, 0, cp.w, cp.h);
  cp.t[k] = c; return c;
}

// ---------- model builders ----------
function flame(m, x, y, z, f, big) {
  const o = ci('#ff6a10', true), yl = ci('#ffc030', true), w = ci('#fff2b0', true);
  const k = (f | 0) % 3;
  vs(m, x, y, z, o); vs(m, x + (k === 1 ? 1 : -1), y, z, o); vs(m, x, y + (k === 2 ? 1 : -1), z, o);
  vs(m, x, y, z + 1, yl); vs(m, x + (k === 0 ? 1 : 0), y, z + 1, o);
  vs(m, x + (k === 1 ? 1 : k === 2 ? -1 : 0), y, z + 2, w);
  if (big) { vs(m, x + 1, y + 1, z, o); vs(m, x, y, z + 3, yl); }
}
function shieldVox(m, id, s, h, pose, ox, oy, oz) {
  let cx, cy, cz;
  if (pose === 'block') { cx = 8; cy = 4; cz = 9; } else { cx = h[0] + 0.5; cy = h[1] - 2; cz = h[2] + 3; }
  const P_ = (x, z, c) => vs(m, Math.floor(cx + x) + ox, cy + oy, Math.floor(cz + z) + oz, c);
  if (id === 'buckler') {
    const wd = ci('#8a5a2e'), rim = ci('#5a3a1e'), boss = ci('#c8d0d8');
    for (let z = -3; z <= 2; z++) for (let x = -3; x <= 2; x++) { const d = Math.hypot(x + 0.5, z + 0.5); if (d <= 2.9) P_(x, z, d > 2.1 ? rim : wd); }
    P_(0, 0, boss); P_(-1, 0, boss);
  } else if (id === 'kite_shield') {
    const fld = ci('#2f5fc0'), rim = ci('#c8d0d8'), em = ci('#e8c050');
    for (let z = -5; z <= 4; z++) { const w = z < -1 ? 0.6 + (z + 5) * 0.7 : 3; for (let x = -3; x <= 2; x++) { const xx = x + 0.5; if (Math.abs(xx) > w) continue; P_(x, z, Math.abs(xx) > w - 1 || z === 4 ? rim : (x === 0 || x === -1 ? em : fld)); } }
  } else {
    const fld = ci('#2a3a64'), rim = ci('#9aa4ae'), em = ci('#e8c050');
    for (let z = -7; z <= 5; z++) for (let x = -3; x <= 2; x++) P_(x, z, x === -3 || x === 2 || z === -7 || z === 5 ? rim : (x === -1 || x === 0 || z === 0 ? em : fld));
  }
}
function handItem(m, it, s, h, pose, ox, oy, oz, o) {
  const sg = s ? 1 : -1;
  const P_ = (dx, dy, dz, c) => vs(m, h[0] + sg * dx + ox, h[1] + dy + oy, h[2] + dz + oz, c);
  const L_ = (a, b, c0, d, e, f, c) => vline(m, h[0] + sg * a + ox, h[1] + b + oy, h[2] + c0 + oz, h[0] + sg * d + ox, h[1] + e + oy, h[2] + f + oz, c);
  const gd = ci('#d8b040'), wd = ci('#6a4424');
  switch (it.t) {
    case 'sword': {
      const bl = ci(it.col || '#c8d0d8');
      if (pose === 'atk') { P_(0, -1, 0, gd); P_(-1, -1, 0, gd); L_(-1, -2, 0, -8, -4, 1, bl); }
      else { P_(-1, -1, 0, gd); P_(0, -1, 0, gd); P_(1, -1, 0, gd); L_(0, -2, 0, 0, -6, -1, bl); P_(0, 1, 0, gd); }
      break;
    }
    case 'claymore': {
      const bl = ci('#dfe8f0'), gr = ci('#5a3a22');
      if (pose === 'atk') { P_(0, -1, 0, gd); P_(-1, -1, 0, gd); P_(1, -1, 0, gd); L_(-1, -2, 0, -11, -4, 1, bl); L_(-1, -2, 1, -10, -4, 2, bl); }
      else { L_(0, 0, 0, 0, 0, 2, gr); P_(-1, 0, 3, gd); P_(0, 0, 3, gd); P_(1, 0, 3, gd); L_(0, 0, 4, 2, 5, 15, bl); }
      break;
    }
    case 'torch':
      if (pose === 'atk') { L_(0, -1, 0, 2, -3, 3, wd); flame(m, h[0] + sg * 2 + ox, h[1] - 3 + oy, h[2] + 4 + oz, o.ff, true); }
      else { L_(0, -1, 0, 1, -1, 6, wd); flame(m, h[0] + sg + ox, h[1] - 1 + oy, h[2] + 7 + oz, o.ff, true); }
      break;
    case 'pistol': { const dk = ci('#34343c'); if (pose === 'aim') { L_(0, -1, 0, 0, -3, 0, dk); P_(0, 0, -1, wd); } else { P_(0, -1, 0, dk); P_(0, -2, -1, dk); P_(0, 0, 0, wd); } break; }
    case 'shield': shieldVox(m, it.id, s, h, pose, ox, oy, oz); break;
    case 'pike': { const st = ci('#d8e0e8'), pw = ci('#8a6a3a'); if (pose === 'atk') { L_(0, 6, 0, 0, -2, 0, pw); P_(0, -3, 0, st); } else { L_(0, -1, -4, 0, -1, 20, pw); P_(0, -1, 21, st); P_(0, -1, 22, st); } break; }
    case 'musket': { const dk = ci('#3a3a42'), sw = ci('#7a4a24'); if (pose === 'aim') { L_(0, 2, 0, 0, -1, 0, sw); L_(0, -2, 0, 0, -3, 0, dk); } else { L_(0, -1, -3, 0, -1, 6, sw); L_(0, -1, 7, 0, -1, 10, dk); } break; }
    case 'bow': {
      const bw = ci('#8a5a2a'), str = ci('#e8e0c8'), sh = ci('#c8a070'), st = ci('#d8e0e8'), fl = ci('#f0ece0');
      if (pose === 'draw') {
        for (let k = -5; k <= 5; k++) vs(m, 7 + ox, 2 + (Math.abs(k) > 3 ? 1 : 0) + oy, 9 + k + oz, bw);
        vline(m, 7 + ox, 3 + oy, 4 + oz, 7 + ox, 9 + oy, 9 + oz, str); vline(m, 7 + ox, 9 + oy, 9 + oz, 7 + ox, 3 + oy, 14 + oz, str);
        vline(m, 8 + ox, 9 + oy, 9 + oz, 8 + ox, 1 + oy, 9 + oz, sh); vs(m, 8 + ox, oy, 9 + oz, st); vs(m, 8 + ox, 10 + oy, 9 + oz, fl);
      } else { for (let k = -5; k <= 5; k++) P_(1, -1 - (Math.abs(k) > 3 ? 1 : 0), k + 2, bw); L_(1, -2, -3, 1, -2, 7, str); }
      break;
    }
  }
}
// humanoid: 16×16 footprint, centre (8,8), facing −y
function human(m, o, ox, oy, oz) {
  const set = (x, y, z, c) => vs(m, x + ox, y + oy, z + oz, c);
  const box = (x0, y0, z0, x1, y1, z1, c) => vbox(m, x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz, c);
  const coat = ci(o.coat), skin = ci(o.skin || '#e8b890'), hair = ci(o.hair || '#4a2e18');
  const pants = ci(o.pants || '#d8d0bc'), boots = ci(o.boots || '#2a2018'), belt = ci(o.belt || '#3a2616');
  const fr = o.frame | 0, lo = fr === 1 ? -1 : fr === 2 ? 1 : 0;
  // legs
  if (o.robe) vcone(m, 8 + ox, 8 + oy, 4.2, 3.1, oz, oz + 8, ci(o.robe));
  else if (o.mounted) { box(3, 7, 1, 3, 8, 4, pants); box(12, 7, 1, 12, 8, 4, pants); box(3, 6, 0, 3, 8, 0, boots); box(12, 6, 0, 12, 8, 0, boots); }
  else { box(5, 6 + lo, 0, 6, 9 + lo, 1, boots); box(5, 6 + lo, 2, 6, 9 + lo, 4, pants); box(9, 6 - lo, 0, 10, 9 - lo, 1, boots); box(9, 6 - lo, 2, 10, 9 - lo, 4, pants); }
  // torso
  box(5, 6, o.robe ? 8 : 5, 10, 9, 10, coat);
  if (!o.robe) box(5, 6, 5, 10, 9, 5, belt);
  if (o.coatD) box(5, 9, 6, 10, 9, 10, ci(o.coatD));
  if (o.trim) { const t = ci(o.trim); box(5, 6, 10, 10, 6, 10, t); box(7, 6, 6, 8, 6, 9, t); }
  if (o.cross) { const w = ci('#f0ece0'); vline(m, 5 + ox, 6 + oy, 10 + oz, 10 + ox, 6 + oy, 5 + oz, w); vline(m, 10 + ox, 6 + oy, 10 + oz, 5 + ox, 6 + oy, 5 + oz, w); }
  if (o.apron) box(6, 6, 5, 9, 6, 9, ci(o.apron));
  if (o.pack) { box(5, 10, 5, 10, 11, 11, ci('#7a5230')); box(6, 12, 6, 9, 12, 10, ci('#6a4424')); box(5, 10, 12, 10, 11, 12, ci('#c8b898')); }
  if (o.cape) { const cin = ci(o.capeIn), cout = ci(o.cape); box(4, 10, 1, 11, 10, 11, cin); box(4, 11, 1, 11, 11, 11, cout); box(3, 9, 2, 3, 11, 10, cout); box(12, 9, 2, 12, 11, 10, cout); box(5, 10, 11, 10, 10, 14, cout); }
  // arms
  const pose = [o.poseL || 'idle', o.poseR || 'idle'], hands = [];
  for (let s = 0; s < 2; s++) {
    const ax = s ? 11 : 4, p = pose[s]; let h;
    if (p === 'atk' || p === 'aim' || p === 'draw' || p === 'claw') { box(ax, 4, 9, ax, 8, 10, coat); h = [ax, 3, 9]; }
    else if (p === 'block') { box(ax, 6, 7, ax, 8, 10, coat); h = [ax, 5, 7]; }
    else if (p === 'up') { box(ax, 7, 10, ax, 8, 15, coat); h = [ax, 7, 16]; }
    else { const sw = fr ? (s ? lo : -lo) : 0; box(ax, 7 + sw, 6, ax, 8 + sw, 10, coat); h = [ax, 7 + sw, 5]; }
    set(h[0], h[1], h[2], skin);
    if (p === 'claw') { set(h[0], h[1] - 1, h[2], ci('#f0f0f8')); }
    if (p === 'up' && o.spark) { set(h[0], h[1], h[2] + 1, ci('#d070ff', true)); set(h[0], h[1] - 1, h[2] + 1, ci('#f0b0ff', true)); }
    hands.push(h);
  }
  // head
  box(6, 6, 11, 9, 9, 14, skin);
  box(6, 9, 11, 9, 9, 14, hair); box(6, 6, 14, 9, 9, 14, hair);
  if (o.longHair) box(6, 10, 7, 9, 10, 13, hair);
  const eye = ci(o.eye || '#201810', !!o.eyeEm); set(6, 6, 12, eye); set(9, 6, 12, eye);
  if (o.mask) box(6, 6, 11, 9, 6, 11, ci(o.mask));
  switch (o.hat) {
    case 'tricorn': { const hc = ci(o.hatC || '#2a2226'), tr = ci(o.trim || '#8a7a60'); box(5, 5, 15, 10, 10, 15, hc); box(6, 6, 16, 9, 9, 16, hc); set(7, 5, 15, tr); set(8, 5, 15, tr); set(5, 10, 15, tr); set(10, 10, 15, tr); break; }
    case 'helm': { const st = ci(o.helmC || '#b8c2cc'); box(5, 5, 13, 10, 10, 14, st); box(6, 6, 15, 9, 9, 15, st); box(6, 5, 13, 9, 5, 13, ci('#2a2a34')); if (o.crest) box(7, 6, 16, 8, 10, 16, ci(o.crest)); break; }
    case 'hood': { const hc = ci(o.hatC || '#4a3a2a'); box(5, 6, 11, 5, 10, 14, hc); box(10, 6, 11, 10, 10, 14, hc); box(5, 10, 11, 10, 10, 15, hc); box(5, 6, 15, 10, 10, 15, hc); box(6, 7, 16, 9, 10, 16, hc); break; }
    case 'morion': { const st = ci('#c0c8d0'); vdisc(m, 8 + ox, 8 + oy, 4.6, 15 + oz, st); box(6, 6, 16, 9, 9, 16, st); box(7, 5, 17, 8, 10, 17, st); break; }
    case 'cap': { const hc = ci(o.hatC || '#6a4a2a'); box(6, 6, 15, 9, 9, 15, hc); box(6, 5, 15, 9, 5, 15, hc); break; }
    case 'witch': { const hc = ci(o.hatC); vdisc(m, 8 + ox, 8 + oy, 4.8, 15 + oz, hc); vdisc(m, 8 + ox, 8.5 + oy, 3, 16 + oz, ci('#e8c050')); vcone(m, 8 + ox, 9 + oy, 2.6, 0.6, 17 + oz, 22 + oz, hc); break; }
  }
  // held items
  if (o.L && o.L.t === 'bow' && pose[0] === 'draw') { handItem(m, o.L, 0, hands[0], 'draw', ox, oy, oz, o); }
  else {
    if (o.L) handItem(m, o.L, 0, hands[0], pose[0], ox, oy, oz, o);
    if (o.R) { const s = (o.R.t === 'claymore' && pose[1] === 'atk' && o.atkSide < 0) ? 0 : 1; handItem(m, o.R, s, hands[s], pose[1], ox, oy, oz, o); }
  }
  if (o.broom) { vline(m, 8 + ox, 1 + oy, oz - 1, 8 + ox, 12 + oy, oz - 1, ci('#7a5230')); vbox(m, 7 + ox, 12 + oy, oz - 1, 9 + ox, 15 + oy, oz, ci('#d8b050')); }
}
function mkHuman(o) { const m = VM(16, 16, o.H || 24); human(m, o, 0, 0, o.broom ? 1 : 0); return m; }
function horseVox(m, o) {
  const body = ci(o.coat || '#8a5a32'), dark = ci(o.dark || '#4a2e18'), hoof = ci('#2a2020'), muz = ci(o.muzzle || '#5a3a22');
  const f = o.frame | 0, fo = f === 1 ? -2 : f === 2 ? 1 : 0, bo = f === 1 ? 1 : f === 2 ? -2 : 0;
  const legs = [[4, 7 + fo], [10, 7 - Math.round(fo / 2)], [4, 16 + bo], [10, 16 - Math.round(bo / 2)]];
  for (const [x, y] of legs) { vbox(m, x, y, 1, x + 1, y + 1, 7, body); vbox(m, x, y, 0, x + 1, y + 1, 0, hoof); }
  vbox(m, 4, 7, 7, 11, 17, 11, body); vbox(m, 5, 6, 8, 10, 6, 11, body);
  vbox(m, 6, 4, 10, 9, 7, 13, body);
  vbox(m, 6, 1, 13, 9, 5, 16, body);
  vbox(m, 6, 0, 13, 9, 1, 14, muz);
  vs(m, 6, 4, 17, body); vs(m, 9, 4, 17, body);
  vs(m, 6, 2, 15, ci('#101010')); vs(m, 9, 2, 15, ci('#101010'));
  vbox(m, 7, 5, 14, 8, 8, 14, dark); vbox(m, 7, 4, 17, 8, 5, 17, dark); vbox(m, 7, 6, 12, 8, 7, 13, dark);
  vbox(m, 7, 18, 5, 8, 19, 10, dark);
  if (o.saddle) { vbox(m, 5, 10, 12, 10, 13, 12, ci('#5a2a1a')); const cl = ci(o.cloth || '#9a2a22'); vbox(m, 3, 10, 8, 3, 13, 11, cl); vbox(m, 12, 10, 8, 12, 13, 11, cl); }
}
function mkHorse(o) { const m = VM(16, 24, o.rider ? 32 : 20); horseVox(m, o); if (o.rider) human(m, o.rider, 0, 4, 8); return m; }
const GIANTS = {
  giant: { skin: '#b09a7a', fur: '#6a4a2a', eye: '#ff3a2a', hair: '#4a3020', knob: '#7a7670' },
  frostgiant: { skin: '#9cc0dc', fur: '#eef4fa', eye: '#7af0ff', hair: '#f0f4fa', knob: '#c0dcf0', beard: true }
};
function mkGiant(o) {
  const m = VM(32, 32, 52), sk = ci(o.skin), skD = ci(hx(o.skin, 0.8)), fur = ci(o.fur), eye = ci(o.eye, true), hair = ci(o.hair), wd = ci('#6a4424'), knob = ci(o.knob), teeth = ci('#f0ece0');
  const fr = o.frame | 0, lo = fr === 1 ? -2 : fr === 2 ? 2 : 0, p = o.pose;
  vbox(m, 10, 13 + lo, 0, 14, 18 + lo, 15, sk); vbox(m, 18, 13 - lo, 0, 22, 18 - lo, 15, sk);
  vbox(m, 10, 12 + lo, 0, 14, 18 + lo, 1, skD); vbox(m, 18, 12 - lo, 0, 22, 18 - lo, 1, skD);
  vbox(m, 9, 12, 13, 23, 20, 18, fur);
  vbox(m, 9, 12, 19, 23, 20, 32, sk); vbox(m, 11, 11, 20, 21, 11, 29, sk); vbox(m, 10, 12, 31, 22, 20, 32, skD);
  if (p === 'throw') vbox(m, 6, 14, 26, 8, 18, 44, sk); else { vbox(m, 5, 14, 20, 8, 18, 31, sk); vbox(m, 5, 14, 17, 8, 18, 19, skD); }
  if (p === 'slam') { vbox(m, 24, 14, 28, 27, 18, 44, sk); vline(m, 25, 16, 44, 23, 22, 49, wd, true); vblob(m, 22, 24, 48, 3.4, 3.2, 3, knob, 5, 0.4); }
  else if (p === 'throw') { vbox(m, 24, 14, 26, 26, 18, 44, sk); vblob(m, 16, 15, 46, 5, 4.5, 4.5, ci('#8a8478'), 9, 0.5); }
  else { vbox(m, 24, 14, 20, 27, 18, 31, sk); vbox(m, 24, 14, 17, 27, 18, 19, skD); vline(m, 25, 15, 17, 25, 5, 7, wd, true); vblob(m, 25.5, 4.5, 6, 3.5, 3.5, 3.5, knob, 3, 0.45); }
  vbox(m, 12, 12, 33, 20, 19, 41, sk); vbox(m, 12, 11, 38, 20, 11, 39, skD);
  vbox(m, 13, 11, 37, 14, 11, 37, eye); vbox(m, 18, 11, 37, 19, 11, 37, eye);
  vbox(m, 14, 11, 34, 18, 11, 34, teeth); vbox(m, 12, 13, 42, 20, 19, 42, hair); vbox(m, 12, 19, 35, 20, 19, 41, hair);
  if (o.beard) vbox(m, 12, 10, 29, 20, 12, 33, hair);
  return m;
}
const HUMANS = {
  bandit: { coat: '#6e5a3c', pants: '#5a4830', boots: '#3a2a1a', hat: 'hood', hatC: '#4a3a28', belt: '#2a1e12', mask: '#3a3028' },
  soldier: { coat: '#c4302a', coatD: '#9a2420', pants: '#e8e0d0', hat: 'tricorn', trim: '#e8c050', cross: true, R: { t: 'sword', col: '#c8d0d8' } },
  ally: { coat: '#2f60c4', coatD: '#244a9a', pants: '#e8e0d0', hat: 'tricorn', trim: '#e8c050', R: { t: 'sword', col: '#c8d0d8' } },
  guard: { coat: '#2f8a5a', coatD: '#246a46', pants: '#d8d0bc', hat: 'morion', R: { t: 'sword', col: '#c8d0d8' }, L: { t: 'shield', id: 'buckler' } },
  pikeman: { coat: '#b42c26', coatD: '#8a221e', pants: '#e8e0d0', hat: 'morion', cross: true, R: { t: 'pike' }, H: 30 },
  musketeer: { coat: '#c4302a', coatD: '#9a2420', pants: '#e8e0d0', hat: 'tricorn', trim: '#e8c050', cross: true, R: { t: 'musket' } },
  archer: { coat: '#a8382a', coatD: '#842c22', pants: '#8a7a5a', hat: 'hood', hatC: '#5a3a24', L: { t: 'bow' } },
  vampire: { coat: '#2a1c34', pants: '#1c1424', boots: '#100c14', skin: '#e4e2f0', hair: '#121018', eye: '#ff3030', eyeEm: true, cape: '#3c1c50', capeIn: '#a01a2a' },
  witch: { robe: '#5a2a7a', coat: '#5a2a7a', skin: '#86c058', hair: '#c8c8d0', longHair: true, eye: '#ffe040', eyeEm: true, hat: 'witch', hatC: '#3a1a50', broom: true, spark: true, H: 26 },
  merchant: { coat: '#3a7a4a', coatD: '#2a5a36', pants: '#5a4830', apron: '#e8dcc0', hat: 'cap', hatC: '#6a4a2a', pack: true }
};
function playerSpec(withItems) {
  const arm = ITEMS[P.armor];
  return { coat: arm.color, coatD: arm.dark, pants: arm.legs, boots: '#2a2018', hair: '#5a381c', hat: arm.helm ? 'helm' : 'tricorn', hatC: '#2a2226',
    trim: P.armor === 'tunic' ? '#8a7a5a' : '#e8c050', crest: (P.armor === 'fullplate' || P.armor === 'halfplate') ? '#c03030' : null, L: withItems ? undefined : null, R: withItems ? undefined : null };
}
const itemDescV = it => !it ? null : it.type === 'sword' ? { t: 'sword', col: it.col } : it.type === 'sword2' ? { t: 'claymore' } : it.type === 'bow' ? { t: 'bow' } : it.type === 'shield' ? { t: 'shield', id: it.id } : it.type === 'torch' ? { t: 'torch' } : it.type === 'gun' ? { t: 'pistol' } : null;
function playerModel() {
  const m = P.mounted;
  if (S.mode === 'dying' || S.mode === 'over') return ['Pdead|' + P.armor, () => lie(mkHuman(playerSpec(false)), 5)];
  const fr = Math.abs(P.v) > 0.6 ? 1 + (Math.floor(P.step * (m ? 0.9 : 1.6)) % 2) : 0;
  const two = twoHanded() ? ITEMS[P.hands[1]] : null;
  let L = null, R = null, pL = 'idle', pR = 'idle';
  if (two) {
    if (two.type === 'bow') { L = itemDescV(two); if (P.drawing) pL = pR = 'draw'; }
    else { R = itemDescV(two); if (P.anim[0] > 0 || P.anim[1] > 0) pR = 'atk'; }
  } else {
    L = itemDescV(P.hands[0] && ITEMS[P.hands[0]]); R = itemDescV(P.hands[1] && ITEMS[P.hands[1]]);
    for (let s = 0; s < 2; s++) {
      const it = P.hands[s] && ITEMS[P.hands[s]]; let p = 'idle';
      if (P.anim[s] > 0) p = it && it.type === 'gun' ? 'aim' : 'atk';
      else if (it && it.type === 'shield' && P.blocking) p = 'block';
      if (s) pR = p; else pL = p;
    }
  }
  const torch = (L && L.t === 'torch') || (R && R.t === 'torch');
  const ff = torch ? Math.floor(S.t * 9) % 3 : 0, side = P.atkSide || 1;
  const key = 'P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-') + '|' + pL + pR + '|' + fr + '|' + (m ? 1 : 0) + '|' + ff + '|' + side;
  const spec = Object.assign(playerSpec(true), { L, R, poseL: pL, poseR: pR, frame: m ? 0 : fr, ff, atkSide: side });
  if (m) return [key, () => mkHorse({ coat: '#8a5a32', dark: '#4a2e18', saddle: true, cloth: '#2f5fc0', frame: fr, rider: Object.assign(spec, { mounted: true }) })];
  return [key, () => mkHuman(spec)];
}
function entModel(e) {
  const kind = e.kind, pose = e.state === 'move' ? 'idle' : e.state;
  const fr = e.moving && kind !== 'witch' ? 1 + (Math.floor(S.t * (kind === 'vampire' ? 10 : kind === 'dragoon' ? 9 : 7) + e.seed) % 2) : 0;
  if (e.downT > 0) return lyingModel(e.k.corpse || 'R', kind);
  if (GIANTS[kind]) { const p = pose === 'slam' || pose === 'throw' ? pose : 'idle'; return [kind + '|' + p + '|' + fr, () => mkGiant(Object.assign({ pose: p, frame: fr }, GIANTS[kind]))]; }
  if (kind === 'dragoon') { const pr = pose === 'wind' || e.passT > 0.8 ? 'atk' : 'idle'; return ['dragoon|' + pr + '|' + fr, () => mkHorse({ coat: '#3a281c', dark: '#1e140e', saddle: true, cloth: '#9a2a22', frame: fr, rider: Object.assign({}, HUMANS.soldier, { mounted: true, poseR: pr }) })]; }
  const base = HUMANS[kind] || HUMANS.soldier;
  let pL = 'idle', pR = 'idle';
  if (pose === 'wind') { if (kind === 'vampire') pL = pR = 'claw'; else pR = 'atk'; }
  else if (pose === 'aim') { if (kind === 'archer') pL = pR = 'draw'; else pR = 'aim'; }
  else if (pose === 'cast') pL = pR = 'up';
  return [kind + '|' + pL + pR + '|' + fr, () => mkHuman(Object.assign({}, base, { poseL: pL, poseR: pR, frame: fr }))];
}
const CORPSE_KIND = { R: 'soldier', B: 'ally', N: 'bandit', H: 'dragoon', G: 'giant', F: 'frostgiant' };
function lyingModel(c, kind) {
  kind = kind && (HUMANS[kind] || GIANTS[kind] || kind === 'dragoon') ? kind : CORPSE_KIND[c] || 'soldier';
  if (kind === 'dragoon') return ['L|dragoon', () => lieSide(mkHorse({ coat: '#3a281c', dark: '#1e140e', saddle: true, cloth: '#9a2a22', rider: Object.assign({}, HUMANS.soldier, { mounted: true, R: null }) }), 4, 10)];
  if (GIANTS[kind]) return ['L|' + kind, () => lie(mkGiant(Object.assign({ pose: 'idle', frame: 0 }, GIANTS[kind])), 10, 12)];
  return ['L|' + kind, () => lie(mkHuman(Object.assign({}, HUMANS[kind], { R: null, L: null, broom: false })), 5)];
}
// statics
function mkPine(v, snow) {
  const H = 34 + v * 4, m = VM(22, 22, H), tr = ci('#5a3a20');
  vbox(m, 10, 10, 0, 11, 11, 6, tr);
  const g1 = ci(snow ? '#2a5638' : '#2a6632'), g2 = ci(snow ? '#356644' : '#3a7e3e');
  vcone(m, 11, 11, 9.5, 3, 5, 15, g1, v * 11 + 1); vcone(m, 11, 11, 7.5, 2, 12, 24, g2, v * 11 + 2); vcone(m, 11, 11, 5.5, 0.6, 21, H - 1, g1, v * 11 + 3);
  if (snow) vtop(m, ci('#f2f6ff'), 0.85, v);
  else vtop(m, ci('#4a9446'), 0.3, v);
  return m;
}
function mkOak(v) {
  const m = VM(24, 24, 30), bark = ci('#5e4024'), lf = ci('#3a8434'), lf2 = ci('#58a046');
  vbox(m, 11, 11, 0, 12, 12, 13, bark); vline(m, 11, 11, 9, 6, 8, 15, bark); vline(m, 12, 12, 10, 17, 15, 16, bark);
  vblob(m, 12, 12, 20, 10, 10, 7.5, lf, v * 17, 0.45);
  vblob(m, 9, 10, 25, 5, 5, 3.5, lf2, v * 31 + 5, 0.5); vblob(m, 15, 14, 24, 5, 4, 3.5, lf2, v * 7 + 3, 0.5);
  return m;
}
function mkDead(v) {
  const m = VM(18, 18, 28), b = ci('#6e5e4c');
  vbox(m, 8, 8, 0, 9, 9, 18, b);
  vline(m, 9, 9, 12, 15, 6 + v, 22, b); vline(m, 8, 8, 9, 2, 12, 17, b); vline(m, 8, 9, 16, 6 - v, 15, 25, b); vline(m, 9, 8, 18, 12, 3, 26, b);
  return m;
}
function mkPalm(v) {
  const m = VM(24, 24, 34), tr = ci('#8a6a44'), tr2 = ci('#6e5236'), fr = ci('#3c9a3a'), fr2 = ci('#2e7a2e');
  for (let z = 0; z < 28; z++) { const x = 11 + Math.round(Math.sin(z / 10 + v) * 2.5); vbox(m, x, 11, z, x + 1, 12, z, z % 4 === 0 ? tr2 : tr); }
  const tx = 11 + Math.round(Math.sin(2.8 + v) * 2.5);
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + v, ex = tx + Math.cos(a) * 10, ey = 11.5 + Math.sin(a) * 10, mx = (tx + ex) / 2, my = (11.5 + ey) / 2; vline(m, tx, 11, 28, mx, my, 31, k % 2 ? fr : fr2); vline(m, mx, my, 31, ex, ey, 25, k % 2 ? fr : fr2); }
  return m;
}
function mkBush(v) { const m = VM(12, 12, 8); vblob(m, 6, 6, 2, 5, 4.5, 4, ci(v ? '#3a7a30' : '#4a8a36'), v * 13 + 2, 0.5); if (v) vtop(m, ci('#c03040'), 0.12, 5); return m; }
function mkRock(v) { const m = VM(12, 12, 8); vblob(m, 6, 6, 1.5, 4.8, 4.2, 4.5, ci(v === 1 ? '#7e7a72' : '#8a867c'), v * 23 + 1, 0.55); if (v === 2) vtop(m, ci('#5a7a3a'), 0.3, 9); return m; }
function mkMenhir() {
  const m = VM(10, 10, 27), st = ci('#8a8478'), st2 = ci('#76705e');
  for (let z = 0; z < 26; z++) { const s = z > 20 ? 1 : 0; vbox(m, 3 + s, 4, z, 6, 6 - s, z, z % 7 < 2 ? st2 : st); }
  vs(m, 4, 4, 26, st); vtop(m, ci('#5a7a3a'), 0.25, 4);
  return m;
}
function mkHouse(v, night) {
  const m = VM(40, 32, 36);
  const sand = v === 'sand', snow = v === 'snow';
  const wall = ci(sand ? '#d8b070' : '#dccba8'), beam = ci(sand ? '#8a6a3a' : '#5a3a22');
  const roof = ci(snow ? '#eef4fa' : sand ? '#b88a50' : '#a03a2a'), roof2 = ci(snow ? '#d0dae6' : sand ? '#a07a44' : '#8a2e22');
  const win = ci(night ? '#ffd060' : '#2c3a48', night), door = ci('#4a2a14');
  const x0 = 3, x1 = 36, y0 = 6, y1 = 25, wz = 16;
  vbox(m, x0, y0, 0, x1, y1, wz, wall);
  if (!sand) {
    for (const x of [x0, x0 + 11, x1 - 11, x1]) { vbox(m, x, y0, 0, x, y0, wz, beam); vbox(m, x, y1, 0, x, y1, wz, beam); }
    vbox(m, x0, y0, wz, x1, y0, wz, beam); vbox(m, x0, y1, wz, x1, y1, wz, beam); vbox(m, x0, y0, 8, x1, y0, 8, beam); vbox(m, x0, y1, 8, x1, y1, 8, beam);
    vbox(m, x0, y0, 0, x0, y1, wz, beam); vbox(m, x1, y0, 0, x1, y1, wz, beam);
  }
  vbox(m, 18, y0, 0, 21, y0, 9, door); vbox(m, 18, y0 - 1, 0, 21, y0 - 1, 0, ci('#7a746a'));
  for (const x of [8, 28]) { vbox(m, x, y0, 10, x + 2, y0, 13, win); vbox(m, x, y1, 10, x + 2, y1, 13, win); }
  vbox(m, x0, 14, 10, x0, 16, 13, win); vbox(m, x1, 14, 10, x1, 16, 13, win);
  if (sand) {
    vbox(m, x0, y0, wz + 1, x1, y1, wz + 1, roof); vbox(m, x0, y0, wz + 2, x1, y0, wz + 3, roof2); vbox(m, x0, y1, wz + 2, x1, y1, wz + 3, roof2);
    vbox(m, x0, y0, wz + 2, x0, y1, wz + 3, roof2); vbox(m, x1, y0, wz + 2, x1, y1, wz + 3, roof2);
    for (const x of [8, 16, 24, 32]) vbox(m, x, y0 - 2, wz - 2, x, y0 - 1, wz - 2, beam);
  } else {
    for (let k = 0; k <= 14; k++) { const z = wz + 1 + k, ya = y0 - 2 + k, yb = y1 + 2 - k; if (ya > yb) break; vbox(m, x0 - 1, ya, z, x1 + 1, yb, z, k % 2 ? roof2 : roof); }
    vbox(m, 28, 10, wz, 30, 12, 32, ci('#7a746a'));
  }
  return m;
}
function mkFire(f) {
  const m = VM(12, 12, 12), st = ci('#7a7670'), lg = ci('#5a3a1e');
  for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; vs(m, 6 + Math.cos(a) * 4.3, 6 + Math.sin(a) * 4.3, 0, st); }
  vline(m, 3, 4, 0, 9, 8, 1, lg); vline(m, 3, 8, 0, 9, 4, 1, lg);
  const o = ci('#ff6a10', true), yl = ci('#ffc030', true), w = ci('#fff0a0', true);
  for (let z = 1; z < 9; z++) { const r = (9 - z) * 0.4; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d2 = dx * dx + dy * dy; if (d2 <= r * r && hash2(dx * 5 + z * 11 + f * 97, dy * 7 + f * 31) < 0.78) vs(m, 6 + dx, 6 + dy, z, z > 5 ? w : d2 < r * r * 0.35 ? yl : o); } }
  return m;
}
function mkWell() {
  const m = VM(14, 14, 20), st = ci('#8a867c'), st2 = ci('#6e6a62'), wd = ci('#6a4424'), rf = ci('#8a3a2a'), wa = ci('#2a4a7a');
  for (let z = 0; z <= 5; z++) for (let y = 0; y < 14; y++) for (let x = 0; x < 14; x++) { const d = Math.hypot(x + 0.5 - 7, y + 0.5 - 7); if (d <= 5 && d >= 3.6) vs(m, x, y, z, (z + x) % 3 ? st : st2); }
  vdisc(m, 7, 7, 3.6, 3, wa);
  vbox(m, 1, 6, 6, 1, 7, 15, wd); vbox(m, 12, 6, 6, 12, 7, 15, wd); vbox(m, 1, 6, 15, 12, 7, 15, wd);
  for (let k = 0; k < 4; k++) vbox(m, 0, 3 + k, 16 + k, 13, 10 - k, 16 + k, rf);
  return m;
}
function mkRuin() {
  const m = VM(48, 40, 40), st = ci('#9a9488'), st2 = ci('#7e786c'), moss = ci('#5a7a3e');
  const wall = (x0, y0, x1, y1, hf) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) { const x = Math.round(lerp(x0, x1, i / n)), y = Math.round(lerp(y0, y1, i / n)), h = hf(i); for (let z = 0; z < h; z++) vbox(m, x, y, z, x + 2, y + 2, z, (((x + y) >> 2) + (z >> 2)) % 3 === 0 ? st2 : st); }
  };
  wall(4, 32, 43, 32, i => 12 + Math.round(fbm(i * 0.15, 3) * 26));
  wall(4, 8, 4, 32, i => 8 + Math.round(fbm(i * 0.2, 9) * 24));
  wall(43, 12, 43, 32, i => 6 + Math.round(fbm(i * 0.2, 19) * 18));
  wall(4, 8, 14, 8, i => 4 + (i % 3) * 3);
  wall(34, 8, 43, 8, i => 3 + (i % 4) * 2);
  for (let k = 0; k < 6; k++) vblob(m, 10 + k * 5, 14 + (k % 3) * 5, 0.5, 2, 1.6, 1.5, st2, k * 7, 0.6);
  vtop(m, moss, 0.22, 3);
  return m;
}
function mkChest(open) {
  const m = VM(10, 10, 10), wd = ci('#8a5a2e'), dk = ci('#5a3a1e'), gd = ci('#e8c050');
  vbox(m, 2, 3, 0, 7, 6, 3, wd); vbox(m, 2, 3, 0, 7, 6, 0, dk);
  if (!open) { vbox(m, 2, 3, 4, 7, 6, 4, dk); vbox(m, 3, 3, 0, 3, 6, 4, gd); vbox(m, 6, 3, 0, 6, 6, 4, gd); vs(m, 4, 2, 3, gd); vs(m, 5, 2, 3, gd); }
  else { vbox(m, 2, 7, 4, 7, 7, 8, dk); vbox(m, 3, 4, 3, 6, 5, 3, ci('#2a1a10')); }
  return m;
}
function mkLoot(id) {
  const it = ITEMS[id], m = VM(10, 10, 6), wd = ci('#6a4424'), gd = ci('#d8b040');
  switch (it.type) {
    case 'sword': vline(m, 5, 1, 1, 5, 6, 1, ci(it.col)); vbox(m, 4, 7, 1, 6, 7, 1, gd); vline(m, 5, 8, 1, 5, 9, 1, wd); break;
    case 'sword2': vline(m, 5, 0, 1, 5, 6, 1, ci('#dfe8f0')); vbox(m, 3, 7, 1, 7, 7, 1, gd); vline(m, 5, 8, 1, 5, 9, 1, wd); break;
    case 'bow': for (let k = -4; k <= 4; k++) vs(m, 3 + Math.round(k * k / 8), 5 + k, 1, ci('#8a5a2a')); vline(m, 5, 1, 1, 5, 9, 1, ci('#e8e0c8')); break;
    case 'shield': { const f = it.id === 'buckler' ? '#8a5a2e' : it.id === 'kite_shield' ? '#2f5fc0' : '#2a3a64'; vdisc(m, 5, 5, 3.4, 0, ci('#9aa4ae')); vdisc(m, 5, 5, 2.5, 1, ci(f)); vs(m, 5, 5, 2, ci('#e8c050')); break; }
    case 'torch': vline(m, 3, 7, 1, 7, 3, 1, wd); vs(m, 7, 2, 1, ci('#ff8a2a', true)); vs(m, 8, 2, 1, ci('#ffd040', true)); break;
    case 'gun': vline(m, 3, 5, 1, 7, 5, 1, ci('#34343c')); vbox(m, 2, 6, 1, 3, 7, 1, wd); break;
    case 'armor': vbox(m, 2, 3, 0, 7, 6, 3, ci(it.color)); vbox(m, 2, 3, 3, 7, 6, 3, ci(it.dark)); break;
    case 'potion': vbox(m, 4, 4, 0, 5, 5, 2, ci('#d02840')); vs(m, 4, 4, 3, ci('#a0c8d8')); vs(m, 4, 4, 4, ci('#8a5a2e')); break;
    case 'ammo': for (const x of [3, 5, 7]) { vline(m, x, 2, 1, x, 8, 1, ci('#b08a5a')); vs(m, x, 1, 1, ci('#d0d8e0')); vs(m, x, 9, 1, ci('#f0ece0')); } break;
  }
  return m;
}
function staticModel(o) {
  const v = (hash2(Math.round(o.x * 10), Math.round(o.y * 10)) * 3) | 0;
  switch (o.type) {
    case 'pine': return ['pine' + v, () => mkPine(v, false), 16];
    case 'snowpine': return ['spine' + v, () => mkPine(v, true), 16];
    case 'oak': return ['oak' + (v % 2), () => mkOak(v % 2), 16];
    case 'deadtree': return ['dead' + (v % 2), () => mkDead(v % 2), 32];
    case 'palm': return ['palm' + (v % 2), () => mkPalm(v % 2), 32];
    case 'bush': return ['bush' + (v % 2), () => mkBush(v % 2), 16];
    case 'rock': return ['rock' + v, () => mkRock(v), 16];
    case 'menhir': return ['menhir', mkMenhir, 32];
    case 'house': { const n = S.darkness > 0.45; return ['house' + o.v + (n ? 'n' : 'd'), () => mkHouse(o.v, n), NB]; }
    case 'fire': { const f = Math.floor(S.t * 8) % 3; return ['fire' + f, () => mkFire(f), 16]; }
    case 'well': return ['well', mkWell, NB];
    case 'ruin': return ['ruin', mkRuin, NB];
    case 'chest': { const op = S.looted.has(o.id); return ['chest' + (op ? 'o' : 'c'), () => mkChest(op), NB]; }
  }
  return ['rock0', () => mkRock(0), 16];
}

// ---------- ground ----------
const GTEX = new Map();
let groundC = null, groundKey = '', gOX = 0, gOY = 0, gR = 0, gCX = 0, gCY = 0;
const TPAL = [];
(function () {
  const T = (...a) => a.map(rgbOf);
  TPAL[T_GRASS] = T('#4a8a3a', '#3c7830', '#62a248');
  TPAL[T_TALL] = T('#3e7a32', '#2e6628', '#5a9a40');
  TPAL[T_WATER] = T('#2a5a9c', '#3a6cae', '#7aa8dc', '#4a86b8');
  TPAL[T_DIRT] = T('#8a6a48', '#765a3a', '#a48a6a');
  TPAL[T_WHEAT] = T('#c8a43a', '#a8862a', '#e8c858');
  TPAL[T_SNOW] = T('#e6ecf4', '#cdd8e6', '#ffffff');
  TPAL[T_DRIFT] = T('#f2f6fc', '#d4deec', '#ffffff');
  TPAL[T_ICE] = T('#98c6e6', '#80b2d8', '#cdeafa');
  TPAL[T_SAND] = T('#d8b878', '#c4a466', '#e6c890');
  TPAL[T_DUNE] = T('#e2c48a', '#c8a86a', '#f0d6a0');
  TPAL[T_MUD] = T('#5a4a30', '#4a3c26', '#4a5a50');
  TPAL[T_MARSH] = T('#4a5a30', '#3a4a26', '#7a8a3a');
  TPAL[T_BOG] = T('#2a3a2c', '#3a5a32', '#4a6a40', '#344636');
  TPAL[T_HEATHER] = T('#5a4a4e', '#8a4a9a', '#b47ac4', '#4a6a3a');
  TPAL[T_ROCKY] = T('#6a665e', '#4c4a44', '#8a867c');
  TPAL[T_FLOOR] = T('#2e5a28', '#244a20', '#5a4a2a');
})();
const FLOWER_RGB = ['#f0e060', '#f080a0', '#f0f0f0', '#a0c0ff'].map(rgbOf);
function tileNoGen(x, y) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS), c = CHUNKS.get(cx + ',' + cy);
  if (c) return c.tiles[((Math.floor(y) - cy * CS) << 5) + (Math.floor(x) - cx * CS)];
  return tileBase(x, y);
}
function chunkTex(c) {
  let tex = GTEX.get(c.key); if (tex) return tex;
  tex = mkCanvas(256, 256);
  const x2 = tex.getContext('2d'), id = x2.createImageData(256, 256), d = id.data;
  const ox = c.cx * CS, oy = c.cy * CS;
  const tl = (u, v) => { const tx = Math.floor(u / 8), ty = Math.floor(v / 8); return (tx >= 0 && ty >= 0 && tx < 32 && ty < 32) ? c.tiles[ty * 32 + tx] : tileNoGen(ox + u / 8, oy + v / 8); };
  for (let v = 0; v < 256; v++) for (let u = 0; u < 256; u++) {
    const gx = c.cx * 256 + u, gy = c.cy * 256 + v, h = hash2(gx, gy);
    const jx = (hash2(gx >> 1, (gy >> 1) + 7) - 0.5) * 5, jy = (hash2((gx >> 1) + 3, gy >> 1) - 0.5) * 5;
    const t = tl(u + jx, v + jy), p = TPAL[t];
    let col = p[0];
    switch (t) {
      case T_GRASS: if (h < 0.1) col = p[1]; else if (h < 0.17 || (hash2(gx, gy - 1) < 0.06)) col = p[2]; if (h > 0.996) col = FLOWER_RGB[(h * 1e5 | 0) % 4]; break;
      case T_TALL: if (((gx + (gy >> 1)) % 3 === 0) && h < 0.7) col = p[2]; else if (h < 0.1) col = p[1]; break;
      case T_FLOOR: if (h < 0.16) col = p[1]; else if (h > 0.965) col = p[2]; break;
      case T_WATER: case T_BOG: {
        const sh = tl(u + 6, v) !== t || tl(u - 6, v) !== t || tl(u, v + 6) !== t || tl(u, v - 6) !== t;
        if (sh) col = p[3]; else if ((gy + Math.floor(3 * Math.sin(gx * 0.18))) % 7 === 0) col = p[1]; else if (h < 0.006) col = p[2];
        break;
      }
      case T_DIRT: if (h < 0.15) col = p[1]; else if (h > 0.95) col = p[2]; break;
      case T_WHEAT: col = (gx & 3) < 2 ? p[0] : p[1]; if (h < 0.09) col = p[2]; break;
      case T_SNOW: if (h < 0.12) col = p[1]; else if (h > 0.988) col = p[2]; break;
      case T_DRIFT: if ((gy + Math.floor(3 * Math.sin(gx * 0.15))) % 6 === 0) col = p[1]; break;
      case T_ICE: if ((gx * 3 + gy * 5) % 37 === 0 || (gx - gy * 2) % 41 === 0) col = p[2]; else if (h < 0.1) col = p[1]; break;
      case T_SAND: if ((gy + Math.floor(2 * Math.sin(gx * 0.25))) % 5 === 0) col = p[1]; else if (h > 0.97) col = p[2]; break;
      case T_DUNE: if ((gy + Math.floor(3 * Math.sin(gx * 0.12))) % 4 === 0) col = p[1]; else if (h > 0.95) col = p[2]; break;
      case T_MUD: if (h < 0.2) col = p[1]; else if (h > 0.95) col = p[2]; break;
      case T_MARSH: if (h > 0.88 || ((gx % 5 === 0) && h > 0.6)) col = p[2]; else if (h < 0.1) col = p[1]; break;
      case T_HEATHER: if (h < 0.22) col = p[1]; else if (h > 0.86) col = p[2]; else if (h > 0.4 && h < 0.5) col = p[3]; break;
      case T_ROCKY: { const s = hash2(gx >> 2, gy >> 2); if (s < 0.28) col = ((gx & 3) === 0 || (gy & 3) === 0) ? p[1] : p[2]; else if (h < 0.08) col = p[1]; break; }
    }
    const o = (v * 256 + u) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  x2.putImageData(id, 0, 0);
  GTEX.set(c.key, tex);
  return tex;
}
function ensureGround() {
  const need = VIEWR + 3, key = LW + 'x' + LH;
  if (groundC && key === groundKey && Math.abs(P.x - gCX) < gR - need && Math.abs(P.y - gCY) < gR - need) { prewarmGround(); return; }
  gR = need + 14; gCX = Math.round(P.x); gCY = Math.round(P.y); groundKey = key;
  gOX = gCX - gR; gOY = gCY - gR;
  const px = gR * 2 * PPU;
  if (!groundC) groundC = mkCanvas(px, px);
  if (groundC.width !== px) { groundC.width = px; groundC.height = px; }
  const g = c2d(groundC);
  const c0x = Math.floor(gOX / CS), c1x = Math.floor((gOX + 2 * gR) / CS), c0y = Math.floor(gOY / CS), c1y = Math.floor((gOY + 2 * gR) / CS);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) g.drawImage(chunkTex(getChunk(cx, cy)), (cx * CS - gOX) * PPU, (cy * CS - gOY) * PPU);
}
function prewarmGround() {
  if ((frameNo & 1) === 0) return;
  const R = gR + 24, c0x = Math.floor((P.x - R) / CS), c1x = Math.floor((P.x + R) / CS), c0y = Math.floor((P.y - R) / CS), c1y = Math.floor((P.y + R) / CS);
  for (let cy = c0y; cy <= c1y; cy++) for (let cx = c0x; cx <= c1x; cx++) { const c = CHUNKS.get(cx + ',' + cy); if (c && !GTEX.has(c.key)) { chunkTex(c); return; } }
  if (frameNo % 240 === 1) for (const k of GTEX.keys()) if (!CHUNKS.has(k)) GTEX.delete(k);
}
function drawGround() {
  const cs = CAM.c, sn = CAM.s, dx = gOX - CAM.x, dy = gOY - CAM.y;
  lctx.setTransform(-sn, -SQ * cs, cs, -SQ * sn, FCX + PPU * (-sn * dx + cs * dy), FCY - PPU * SQ * (cs * dx + sn * dy));
  lctx.drawImage(groundC, 0, 0);
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
    lgt.globalCompositeOperation = 'destination-out'; lgt.fillStyle = 'rgba(0,0,0,0.42)';
    for (const L of LIGHTS) {
      const q = w2s(L[0], L[1]), r = L[2] * PPU;
      if (q[0] < -r || q[0] > LW + r || q[1] < -r || q[1] > LH + r) continue;
      for (let k = 0; k < 4; k++) { const rr2 = Math.round(r * (1 - k * 0.2)); lgt.beginPath(); lgt.ellipse(Math.round(q[0]), Math.round(q[1] - 4), rr2, Math.round(rr2 * SQ), 0, 0, TAU); lgt.fill(); }
    }
    lgt.globalCompositeOperation = 'source-over';
    lctx.drawImage(lightC, 0, 0);
    lctx.globalCompositeOperation = 'lighter';
    lctx.fillStyle = 'rgba(255,120,30,' + (0.08 * d).toFixed(3) + ')';
    for (const L of LIGHTS) { if (!L[3]) continue; const q = w2s(L[0], L[1]), r = L[2] * PPU * 0.7; lctx.beginPath(); lctx.ellipse(Math.round(q[0]), Math.round(q[1] - 4), r, r * SQ, 0, 0, TAU); lctx.fill(); }
    lctx.globalCompositeOperation = 'source-over';
  }
  if (du > 0) { lctx.fillStyle = 'rgba(255,110,40,' + (0.13 * du).toFixed(3) + ')'; lctx.fillRect(0, 0, LW, LH); }
}

// ---------- pixel font (3×5) ----------
const FONT3 = {};
('0:111101101101111,1:010110010010111,2:111001111100111,3:111001111001111,4:101101111001001,5:111100111001111,6:111100111101111,7:111001001010010,8:111101111101111,9:111101111001111,' +
  'A:010101111101101,B:110101110101110,C:011100100100011,D:110101101101110,E:111100110100111,F:111100110100100,G:011100101101011,H:101101111101101,I:111010010010111,J:001001001101010,' +
  'K:101101110101101,L:100100100100111,M:101111111101101,N:110101101101101,O:010101101101010,P:110101110100100,Q:010101101110011,R:110101110101101,S:011100010001110,T:111010010010010,' +
  'U:101101101101111,V:101101101101010,W:101101111111101,X:101101010101101,Y:101101010010010,Z:111001010100111,!:010010010000010,+:000010111010000,-:000000111000000,$:011110010011110,' +
  '?:110001010000010,.:000000000000010,/:001001010100100, :000000000000000').split(',').forEach(s => { FONT3[s[0]] = s.slice(2); });
FONT3[':'] = '000010000010000';
const TXT = new Map();
function txtImg(s, col) {
  s = String(s).toUpperCase(); const k = s + col;
  let c = TXT.get(k); if (c) return c;
  const W = s.length * 4 + 1, H = 7; c = mkCanvas(W, H); const x = c2d(c);
  const pix = [];
  for (let i = 0; i < s.length; i++) { const g = FONT3[s[i]] || FONT3['?']; for (let r = 0; r < 5; r++) for (let q = 0; q < 3; q++) if (g[r * 3 + q] === '1') pix.push([1 + i * 4 + q, 1 + r]); }
  x.fillStyle = OUTLINE; for (const [px, py] of pix) x.fillRect(px - 1, py - 1, 3, 3);
  x.fillStyle = col; for (const [px, py] of pix) x.fillRect(px, py, 1, 1);
  TXT.set(k, c); if (TXT.size > 400) TXT.delete(TXT.keys().next().value);
  return c;
}
function drawTxt(s, x, y, col) { const c = txtImg(s, col); lctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y)); }

// ---------- frame ----------
const DRAW = [], SHAD = [], OVL = [], SPARK = [];
function onScreen(x, y, m) { return x > -m && x < LW + m && y > -m && y < LH + m * 1.5; }
function buildDrawList() {
  DRAW.length = 0; SHAD.length = 0; OVL.length = 0;
  const rad = VIEWR + 8, pcx = Math.floor(CAM.x / CS), pcy = Math.floor(CAM.y / CS), cr = Math.ceil(rad / CS);
  for (let j = -cr; j <= cr; j++) for (let i = -cr; i <= cr; i++) {
    const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c) continue;
    for (const o of c.statics) {
      if (Math.abs(o.x - CAM.x) > rad || Math.abs(o.y - CAM.y) > rad) continue;
      const q = w2s(o.x, o.y); if (!onScreen(q[0], q[1], 70)) continue;
      const [key, build, nb] = staticModel(o);
      const rot = o.rot !== undefined ? o.rot : hash2(Math.round(o.x * 7), Math.round(o.y * 7)) * TAU;
      DRAW.push({ x: q[0], y: q[1], cp: comp(key, build, rot - CAM.a, nb), lift: 0, st: true });
      if (o.type !== 'house' && o.type !== 'ruin' && o.type !== 'fire') SHAD.push([q[0], q[1], (o.r + 0.6) * PPU]);
    }
  }
  for (const e of S.ents) {
    if (e.dead) continue;
    const q = w2s(e.x, e.y); if (!onScreen(q[0], q[1], 60)) continue;
    const [key, build] = entModel(e), lift = Math.round(e.elev * PPU);
    const cp = comp(key, build, e.a - CAM.a, e.k.boss ? 32 : NB);
    const tint = e.hurtT > 0 ? '#ffffff' : (e.burnT > 0 && ((S.t * 12) | 0) % 2 ? '#ff8a2a' : null);
    DRAW.push({ x: q[0], y: q[1], cp, lift, tint, ta: e.hurtT > 0 ? 0.85 : 0.55 });
    SHAD.push([q[0], q[1], (e.r + 0.3) * PPU]);
    OVL.push({ e, x: q[0], y: q[1] - lift - cp.top });
  }
  for (const c of S.corpses) {
    const q = w2s(c.x, c.y); if (!onScreen(q[0], q[1], 40)) continue;
    const [key, build] = lyingModel(c.c);
    DRAW.push({ x: q[0], y: q[1] - 1, cp: comp(key, build, hash2(Math.round(c.x * 9), Math.round(c.y * 9)) * TAU - CAM.a, 32), lift: 0 });
  }
  for (const d of S.drops) {
    const q = w2s(d.x, d.y); if (!onScreen(q[0], q[1], 20)) continue;
    const lift = 2 + Math.round(Math.sin(S.t * 3 + d.x) * 1.5);
    const cp = d.kind === 'gold' ? comp('coins', () => { const m = VM(6, 6, 3); vblob(m, 3, 3, 0.5, 2.5, 2.5, 2, ci('#e8c050'), 3, 0.4); return m; }, 0, 1) : comp('loot|' + d.id, () => mkLoot(d.id), S.t * 1.5 + d.x, 32);
    DRAW.push({ x: q[0], y: q[1], cp, lift });
    SHAD.push([q[0], q[1], 3]);
    if (d.kind !== 'gold') OVL.push({ spark: true, x: q[0], y: q[1] - lift - cp.top, d });
  }
  for (const p of S.projs) {
    if (p.kind !== 'boulder') continue;
    const q = w2s(p.x, p.y); if (!onScreen(q[0], q[1], 40)) continue;
    DRAW.push({ x: q[0], y: q[1], cp: comp('boulder', () => { const m = VM(12, 12, 10); vblob(m, 6, 6, 4.5, 5, 5, 4.5, ci(p.frost ? '#b8d8ec' : '#8a8478'), 77, 0.5); return m; }, S.t * 4, 16), lift: Math.round(p.elev * PPU) });
    SHAD.push([q[0], q[1], 5 + Math.max(0, 6 - p.elev)]);
  }
  if (!P.mounted && S.mode !== 'title') {
    const h = S.horse, q = w2s(h.x, h.y);
    if (onScreen(q[0], q[1], 60)) {
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
function drawShadows() {
  lctx.fillStyle = 'rgba(10,8,20,0.28)';
  for (const s of SHAD) { lctx.beginPath(); lctx.ellipse(Math.round(s[0]), Math.round(s[1]), s[2], Math.max(1, s[2] * SQ * 0.8), 0, 0, TAU); lctx.fill(); }
}
let PLY = [0, 0], PLYTOP = 16;
function drawStacks(emissive) {
  const pxs = PLY[0], pys = PLY[1] - 9;
  for (const d of DRAW) {
    const x = Math.round(d.x - d.cp.ax), y = Math.round(d.y - d.cp.ay - d.lift);
    // statics standing between the camera and the player turn see-through
    const fade = d.st && d.y > PLY[1] + 1 && pxs > x + 2 && pxs < x + d.cp.w - 2 && pys > y && pys < y + d.cp.h - 3;
    if (emissive) { if (d.cp.em && !d.tint && !fade) lctx.drawImage(d.cp.em, x, y); continue; }
    if (fade) lctx.globalAlpha = 0.42;
    lctx.drawImage(d.tint ? tintOf(d.cp, d.tint, d.ta) : d.cp.c, x, y);
    if (fade) lctx.globalAlpha = 1;
  }
}
function px(x, y, w, h, col) { lctx.fillStyle = col; lctx.fillRect(Math.round(x), Math.round(y), w, h); }
function drawParticles(em) {
  for (const p of S.parts) {
    if (!!p.em !== em) continue;
    const q = w2s(p.x, p.y), x = Math.round(q[0]), y = Math.round(q[1] - p.elev * PPU);
    if (x < -4 || y < -4 || x > LW + 4 || y > LH + 4) continue;
    const col = p.col.charCodeAt(0) === 33 ? p.col.slice(1) : p.col, ch = p.ch;
    if (ch === '*' || ch === '+') { px(x, y - 1, 1, 3, col); px(x - 1, y, 3, 1, col); }
    else if (ch === 'o' || ch === 'O' || ch === '@' || ch === '$') px(x, y, 2, 2, col);
    else if (ch === '~' || ch === '-' || ch === '=') px(x, y, 2, 1, col);
    else if (ch === '^' || ch === '&') { px(x, y, 1, 2, col); }
    else px(x, y, 1, 1, col);
  }
}
function drawProjectiles() {
  for (const p of S.projs) {
    if (p.kind === 'boulder') continue;
    const q = w2s(p.x, p.y), x = q[0], y = q[1] - p.elev * PPU;
    if (!onScreen(x, y, 10)) continue;
    if (p.kind === 'arrow') {
      const sp = Math.hypot(p.vx, p.vy) || 1, t = w2s(p.x - p.vx / sp * 0.8, p.y - p.vy / sp * 0.8), tx = t[0], ty = t[1] - p.elev * PPU;
      const n = Math.max(1, Math.round(Math.hypot(x - tx, y - ty)));
      for (let i = 0; i <= n; i++) px(lerp(tx, x, i / n), lerp(ty, y, i / n), 1, 1, i === n ? '#e8eef4' : i === 0 ? '#ffffff' : '#c8a070');
    } else if (p.kind === 'ball') px(x - 1, y - 1, 2, 2, '#f0f0f0');
    else if (p.kind === 'pball') { px(x - 1, y - 1, 2, 2, '#ffe080'); px(x, y, 1, 1, '#ffffff'); }
    else if (p.kind === 'fire') { px(x - 2, y - 1, 4, 3, '#ff6a10'); px(x - 1, y - 2, 2, 5, '#ff6a10'); px(x - 1, y - 1, 2, 2, '#ffd040'); px(x, y, 1, 1, '#fff2b0'); }
  }
  for (const m of S.marks) {
    if (((S.t * 8) | 0) % 2) continue;
    const q = w2s(m.x, m.y), x = Math.round(q[0]), y = Math.round(q[1]);
    for (let i = -3; i <= 3; i++) { px(x + i, y + Math.round(i * SQ), 1, 1, '#ff3a2a'); px(x + i, y - Math.round(i * SQ), 1, 1, '#ff3a2a'); }
  }
}
function drawOverlays() {
  const blink = ((S.t * 8) | 0) % 2;
  for (const o of OVL) {
    if (o.spark) { if (((S.t * 4 + o.d.x) | 0) % 3 === 0) { px(o.x, o.y - 3, 1, 3, '#fff6c0'); px(o.x - 1, o.y - 2, 3, 1, '#fff6c0'); } continue; }
    const e = o.e, k = e.k; let y = Math.round(o.y - 3);
    if (e.downT > 0) { const a = S.t * 6; px(o.x + Math.cos(a) * 4, y + 6 + Math.sin(a) * 1.5, 1, 1, '#ffd84a'); px(o.x - Math.cos(a) * 4, y + 6 - Math.sin(a) * 1.5, 1, 1, '#ffd84a'); continue; }
    if (e.state === 'wind' || e.state === 'aim' || e.state === 'cast' || e.state === 'slam' || e.state === 'throw') { drawTxt(k.boss ? '!!' : '!', o.x, y - 6, blink ? '#ffd84a' : '#ff5a3a'); y -= 7; }
    if (e.team === 1 && !k.boss && e.hp < e.maxHp) { const w = 10, f = Math.ceil(clamp(e.hp / e.maxHp, 0, 1) * w), x0 = Math.round(o.x - w / 2); px(x0 - 1, y - 1, w + 2, 3, OUTLINE); px(x0, y, w, 1, '#4a1a1a'); px(x0, y, f, 1, '#e8443a'); y -= 4; }
    if (e.team === 2) { drawTxt('$', o.x, y - 6, '#ffd84a'); y -= 7; }
    if (e === S.aim) { const ax = Math.round(o.x); px(ax - 2, y - 3, 5, 1, '#ffd84a'); px(ax - 1, y - 2, 3, 1, '#ffd84a'); px(ax, y - 1, 1, 1, '#ffd84a'); }
  }
  if (P.drawing && twoHanded()) { // bow draw charge above the player's head
    const it = ITEMS[P.hands[1]], ch = clamp(P.draw / it.draw, 0, 1), x0 = Math.round(PLY[0] - 6), y0 = Math.round(PLY[1] - PLYTOP - 5);
    px(x0 - 1, y0 - 1, 14, 3, OUTLINE); px(x0, y0, 12, 1, '#3a2a14'); px(x0, y0, Math.round(12 * ch), 1, ch >= 0.98 ? '#ffd84a' : '#e8e0c8');
  }
  for (const t of S.texts) {
    const q = w2s(t.x, t.y);
    drawTxt(t.s, q[0], q[1] - t.elev * PPU - 6, t.col.charCodeAt(0) === 33 ? t.col.slice(1) : t.col);
  }
}
function drawCloudShadows() {
  const a = (1 - S.darkness) * 0.085; if (a < 0.01) return;
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
  for (let i = 0; i < 5; i++) {
    const sx = Math.random() * LW, sy = Math.random() * LH, w = s2w(sx, sy), t = tileNoGen(w[0], w[1]);
    if (t === T_WATER) SPARK.push({ x: w[0], y: w[1], t: 0.7 });
  }
  for (let i = SPARK.length - 1; i >= 0; i--) { const s = SPARK[i]; s.t -= dt; if (s.t <= 0) { SPARK.splice(i, 1); continue; } const q = w2s(s.x, s.y); px(q[0], q[1], s.t > 0.35 ? 3 : 2, 1, '#b8d8ff'); }
  if (SPARK.length > 80) SPARK.splice(0, SPARK.length - 80);
}
function drawSnow(dt) {
  const want = S.curBiome === B_SNOW ? Math.floor(LW * LH / 230) : 0, F = S.flakes;
  while (F.length < want) F.push({ x: Math.random() * LW, y: Math.random() * LH, v: rr(14, 34), s: Math.random() < 0.25 ? 2 : 1, ph: Math.random() * TAU });
  if (F.length > want) F.length = want;
  if (!F.length) return;
  lctx.fillStyle = S.darkness > 0.5 ? '#aab8d0' : '#ffffff';
  for (const f of F) {
    f.y += f.v * dt; f.x += (Math.sin(S.t * 1.3 + f.ph) * 8 - 6) * dt;
    if (f.y > LH) { f.y = -2; f.x = Math.random() * LW; }
    if (f.x < 0) f.x += LW; if (f.x > LW) f.x -= LW;
    lctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
  }
}
function render(dt) {
  dt = dt || 0.016; frameNo++;
  compBudget = S.mode === 'loading' ? 60 : 16;
  collectLights();
  ensureGround();
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
  drawSnow(dt);
  drawLighting();
  drawStacks(true);
  drawParticles(true);
  drawOverlays();
  // upscale to the screen
  const sh = S.shake > 0 ? Math.round(S.shake * 4) : 0;
  const ox = sh ? ri(-sh, sh) * SC : 0, oy = sh ? ri(-sh, sh) * SC : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(low, 0, 0, LW, LH, ox, oy, LW * SC, LH * SC);
  if (S.flash > 0) { ctx.fillStyle = 'rgba(190,20,10,' + (S.flash * 0.45).toFixed(3) + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (S.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + clamp(S.fade, 0, 1).toFixed(3) + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  if (S.mode !== 'title' && S.mode !== 'loading') drawHUD();
}
// pre-build common stacks (called while loading)
function prewarmStacks(n) {
  const list = [['pine0', () => mkPine(0, false), 16], ['pine1', () => mkPine(1, false), 16], ['pine2', () => mkPine(2, false), 16], ['oak0', () => mkOak(0), 16], ['oak1', () => mkOak(1), 16], ['bush0', () => mkBush(0), 16], ['bush1', () => mkBush(1), 16], ['rock0', () => mkRock(0), 16], ['rock1', () => mkRock(1), 16], ['rock2', () => mkRock(2), 16]];
  let made = 0;
  for (const [k, b, nb] of list) for (let i = 0; i < nb && made < n; i++) { if (!COMPS.has(k + '@' + i + '/' + nb)) { compBudget = 1; comp(k, b, i / nb * TAU, nb); made++; } }
  return made;
}
