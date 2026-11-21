// =====================================================================
//  ARCHITECTURE — enterable buildings with interiors, village props, castles
//  walls are split into closed boxes at the cutaway heights, so a cut wall shows a clean top
// =====================================================================
const APAL = {
  '': { wall: '#d2c8ae', timber: '#5e4230', roof: '#7e4a3a', roof2: '#6a3c30', stone: '#aaa498', stone2: '#8e897c', glass: '#d89a52', shutter: '#4e5a48', plank: '#6e5238', plank2: '#5e4430' },
  snow: { wall: '#cfccc4', timber: '#4e3a2c', roof: '#4e5868', roof2: '#434c5a', stone: '#a8a6a0', stone2: '#8c8a84', glass: '#d89a52', shutter: '#4a5468', plank: '#5e4a38', plank2: '#4e3c2e', cap: '#e8ecf0' },
  sand: { wall: '#ccb288', timber: '#6e5236', roof: '#a8835a', roof2: '#94724e', stone: '#a8936e', stone2: '#93805e', glass: '#d89a52', shutter: '#6a5a3e', plank: '#7a5e40', plank2: '#6a5036' }
};
const WOOD = '#6e4e34', WOOD2 = '#4e3626', WOODL = '#8e6c4a', IRON = '#4e5056', STEEL = '#9aa2aa', GOLDC = '#b8964a', CREAM = '#d2c6aa', PLANK = '#7a5e44', PLANK2 = '#6a5038', STRAW = '#b89a58', DARK = '#26221e';
const FIRE1 = '#ff7a2a', FIRE2 = '#ffc050', FIRE3 = '#fff0a0';
function bbox(mb, x0, y0, z0, x1, y1, z1, col, cuts) {
  let lo = y0;
  if (cuts) for (const c of cuts) if (c > lo + 0.03 && c < y1 - 0.03) { mb.box(x0, lo, z0, x1, c, z1, col); lo = c + 0.02; }
  mb.box(x0, lo, z0, x1, y1, z1, col);
}
function fire(mb, x, y, z, s) {
  const e = mb.em; mb.em = 1;
  mb.cyl(x, y, z, 0.3 * s, 0, 0.75 * s, 7, FIRE1); mb.cyl(x + 0.04 * s, y, z, 0.19 * s, 0, 1.0 * s, 6, FIRE2); mb.cyl(x - 0.05 * s, y, z + 0.04 * s, 0.1 * s, 0, 0.6 * s, 5, FIRE3);
  mb.em = e;
}
// a box on one side of a building: u along the wall, o0..o1 measured inward from the outer face
function sideBox(W2, D2, side, u0, u1, y0, y1, o0, o1) {
  switch (side) {
    case 'f': return [u0, y0, D2 - o1, u1, y1, D2 - o0];
    case 'b': return [u0, y0, -D2 + o0, u1, y1, -D2 + o1];
    case 'l': return [-W2 + o0, y0, u0, -W2 + o1, y1, u1];
    default: return [W2 - o1, y0, u0, W2 - o0, y1, u1];
  }
}
const sidePt = (W2, D2, side, u, y, o) => side === 'f' ? [u, y, D2 - o] : side === 'b' ? [u, y, -D2 + o] : side === 'l' ? [-W2 + o, y, u] : [W2 - o, y, u];

// ---------- furniture (item frame: origin at the item, +z = its front) ----------
const FD = {};
FD.table = (mb, it) => { const w = it.w, d = it.d; mb.box(-w / 2, 0.72, -d / 2, w / 2, 0.8, d / 2, WOODL); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(sx * (w / 2 - 0.1) - 0.04, 0, sz * (d / 2 - 0.1) - 0.04, sx * (w / 2 - 0.1) + 0.04, 0.72, sz * (d / 2 - 0.1) + 0.04, WOOD2);
  mb.cyl(-w * 0.2, 0.8, 0.05, 0.07, 0.07, 0.12, 6, '#8a8478'); mb.cyl(w * 0.25, 0.8, -0.1, 0.12, 0.12, 0.02, 8, CREAM); };
FD.rtable = (mb, it) => { const r = it.rad || 0.55; mb.cyl(0, 0.72, 0, r, r, 0.07, 10, WOODL); mb.cyl(0, 0, 0, 0.07, 0.07, 0.72, 6, WOOD2, false); mb.cyl(0, 0, 0, 0.3, 0.3, 0.06, 8, WOOD2);
  mb.cyl(0.18, 0.79, 0.1, 0.06, 0.07, 0.13, 6, '#7a6a52'); mb.cyl(-0.2, 0.79, -0.12, 0.06, 0.07, 0.13, 6, '#8a8478'); };
FD.stool = mb => { mb.cyl(0, 0.42, 0, 0.2, 0.2, 0.05, 8, WOODL); for (let k = 0; k < 3; k++) { const a = k * TAU / 3; mb.beam([Math.cos(a) * 0.08, 0.43, Math.sin(a) * 0.08], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], 0.04, WOOD2); } };
FD.bench = (mb, it) => { const w = it.w; mb.box(-w / 2, 0.4, -0.18, w / 2, 0.47, 0.18, WOODL); for (const sx of [-1, 1]) mb.box(sx * (w / 2 - 0.15) - 0.05, 0, -0.14, sx * (w / 2 - 0.15) + 0.05, 0.4, 0.14, WOOD2); };
FD.bed = (mb, it) => { const w = it.w, d = it.d; mb.box(-w / 2, 0, -d / 2, w / 2, 0.32, d / 2, WOOD); mb.box(-w / 2 + 0.06, 0.32, -d / 2 + 0.06, w / 2 - 0.06, 0.46, d / 2 - 0.06, CREAM);
  mb.box(-w / 2 + 0.03, 0.4, -d / 2 + 0.6, w / 2 - 0.03, 0.52, d / 2 - 0.03, it.col || '#8a3a30'); mb.box(-w / 2 + 0.15, 0.46, -d / 2 + 0.12, w / 2 - 0.15, 0.58, -d / 2 + 0.5, '#e2d8c2');
  mb.box(-w / 2, 0, -d / 2 - 0.06, w / 2, 0.95, -d / 2 + 0.04, WOOD2); };
FD.chest = mb => { mb.box(-0.42, 0, -0.26, 0.42, 0.4, 0.26, WOOD); mb.box(-0.44, 0.4, -0.28, 0.44, 0.52, 0.28, WOODL); for (const x of [-0.28, 0.28]) mb.bc(x, 0.26, 0, 0.06, 0.53, 0.58, IRON); };
FD.rug = (mb, it) => { mb.box(-it.w / 2, 0.035, -it.d / 2, it.w / 2, 0.05, it.d / 2, it.col || '#7a4a38'); mb.box(-it.w / 2 + 0.16, 0.05, -it.d / 2 + 0.16, it.w / 2 - 0.16, 0.056, it.d / 2 - 0.16, mixHex(it.col || '#7a4a38', '#c8b48a', 0.3)); };
FD.carpet = (mb, it) => { mb.box(-it.w / 2, 0.035, -it.d / 2, it.w / 2, 0.05, it.d / 2, it.col || '#7a2e2a'); mb.box(-it.w / 2 + 0.1, 0.05, -it.d / 2, -it.w / 2 + 0.18, 0.056, it.d / 2, GOLDC); mb.box(it.w / 2 - 0.18, 0.05, -it.d / 2, it.w / 2 - 0.1, 0.056, it.d / 2, GOLDC); };
FD.shelf = (mb, it) => { const w = it.w; for (const sx of [-1, 1]) mb.box(sx * w / 2 - 0.05, 0, -0.18, sx * w / 2 + 0.05, 1.9, 0.18, WOOD2); mb.box(-w / 2, 0.02, -0.18, w / 2, 1.9, -0.15, WOOD2);
  const R = mulberry(Math.round(w * 100 + it.x * 7)), cols = ['#8a6a4a', '#5a6a5a', '#7a4a3a', '#b8a888', '#4a5a6a', '#9a8a5a'];
  for (const y of [0.35, 0.85, 1.35, 1.82]) { mb.box(-w / 2, y - 0.04, -0.17, w / 2, y, 0.17, WOODL); if (y > 1.8) continue;
    for (let x = -w / 2 + 0.15; x < w / 2 - 0.12; x += 0.2 + R() * 0.12) { const c = cols[(R() * cols.length) | 0]; if (R() < 0.5) mb.cyl(x, y, 0, 0.07, 0.06, 0.16 + R() * 0.1, 6, c); else mb.box(x - 0.05, y, -0.1, x + 0.05, y + 0.2 + R() * 0.08, 0.1, c); } } };
FD.cupboard = (mb, it) => { const w = it.w; mb.box(-w / 2, 0, -0.3, w / 2, 2.0, 0.3, WOOD); mb.box(-w / 2 - 0.05, 2.0, -0.33, w / 2 + 0.05, 2.08, 0.33, WOOD2); mb.box(-0.02, 0.15, 0.3, 0.02, 1.9, 0.32, WOOD2);
  for (const sx of [-1, 1]) mb.bc(sx * 0.14, 1.05, 0.32, 0.05, 0.05, 0.03, GOLDC); mb.cyl(-w * 0.25, 2.08, 0, 0.12, 0.1, 0.22, 7, '#8a6a4a'); };
FD.barrel = mb => { mb.cyl(0, 0, 0, 0.3, 0.36, 0.45, 9, '#7a5634', false); mb.cyl(0, 0.45, 0, 0.36, 0.3, 0.45, 9, '#7a5634', '#6a4a2c'); for (const y of [0.12, 0.45, 0.78]) mb.cyl(0, y, 0, 0.345 - Math.abs(y - 0.45) * 0.15, 0.345 - Math.abs(y - 0.45) * 0.15, 0.05, 9, IRON, false); };
FD.qbarrel = mb => { mb.cyl(0, 0, 0, 0.34, 0.36, 0.7, 9, '#6a4a2c', false); mb.cyl(0, 0.62, 0, 0.32, 0.32, 0.02, 9, '#3a4a58'); for (const y of [0.1, 0.55]) mb.cyl(0, y, 0, 0.365, 0.365, 0.05, 9, IRON, false); };
FD.crate = mb => { mb.box(-0.35, 0, -0.35, 0.35, 0.7, 0.35, '#8a6a44'); for (const s of [-1, 1]) { mb.box(-0.36, 0.05, s * 0.36 - 0.02, 0.36, 0.12, s * 0.36 + 0.02, WOOD); mb.box(-0.36, 0.58, s * 0.36 - 0.02, 0.36, 0.65, s * 0.36 + 0.02, WOOD); } mb.beam([-0.34, 0.12, 0.37], [0.34, 0.58, 0.37], 0.05, WOOD); };
FD.sacks = mb => { mb.ico(0, 0.28, 0, 0.32, 0.3, 0.28, '#b4a27c', 0.12, 1, 31); mb.ico(0.32, 0.22, 0.25, 0.26, 0.24, 0.24, '#a89470', 0.12, 1, 32); mb.ico(-0.18, 0.62, 0.05, 0.24, 0.2, 0.22, '#bcab86', 0.12, 1, 33); };
FD.hearth = (mb, it, A) => { const w = it.w, st = A ? A.stone : '#8a857a', st2 = A ? A.stone2 : '#74705f';
  mb.box(-w / 2 - 0.1, 0, -0.45, w / 2 + 0.1, 0.16, 0.62, st2);
  mb.box(-w / 2, 0.16, -0.45, -w / 2 + 0.32, 1.25, 0.45, st); mb.box(w / 2 - 0.32, 0.16, -0.45, w / 2, 1.25, 0.45, st);
  mb.box(-w / 2, 1.25, -0.45, w / 2, 1.5, 0.45, st); mb.box(-w / 2 - 0.08, 1.5, -0.45, w / 2 + 0.08, 1.58, 0.56, WOOD2);
  mb.box(-w / 2 + 0.12, 1.58, -0.45, w / 2 - 0.12, 2.65, 0.12, st);
  mb.box(-w / 2 + 0.32, 0.16, -0.45, w / 2 - 0.32, 1.25, -0.36, DARK);
  mb.beam([-0.3, 0.24, 0.05], [0.3, 0.3, -0.1], 0.1, WOOD2); mb.beam([-0.25, 0.3, -0.15], [0.25, 0.24, 0.1], 0.1, WOOD2);
  fire(mb, 0, 0.22, -0.02, 0.95);
  { const e = mb.em; mb.em = 0.75; mb.box(-w / 2 + 0.36, 0.16, -0.3, w / 2 - 0.36, 0.2, 0.5, '#c8501a'); mb.em = 1; for (const [x, z] of [[-0.2, 0.42], [0.15, 0.55], [0.32, 0.38], [-0.38, 0.6]]) mb.ico(x, 0.2, z, 0.06, 0.04, 0.06, '#ff7a2a', 0, 0, 3); mb.em = e; }
  mb.cyl(-w * 0.32, 1.58, 0.2, 0.06, 0.06, 0.18, 6, '#8a7a5a'); mb.cyl(w * 0.3, 1.58, 0.2, 0.08, 0.07, 0.12, 6, '#5a6a5a'); };
FD.counter = (mb, it) => { const w = it.w; mb.box(-w / 2, 0, -0.3, w / 2, 0.98, 0.3, WOOD2); mb.box(-w / 2 - 0.04, 0.98, -0.34, w / 2 + 0.04, 1.06, 0.36, WOODL);
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.2; x += 0.7) mb.box(x - 0.03, 0.1, 0.3, x + 0.03, 0.9, 0.32, WOOD);
  mb.cyl(w * 0.2, 1.06, 0.05, 0.06, 0.07, 0.14, 6, '#8a8478'); mb.cyl(-w * 0.15, 1.06, -0.05, 0.06, 0.07, 0.14, 6, '#7a6a52'); mb.cyl(-w * 0.38, 1.06, 0, 0.09, 0.08, 0.3, 6, '#4a5a3a'); };
FD.kegs = (mb, it) => { const w = it.w, n = Math.max(2, Math.floor(w / 0.8));
  mb.box(-w / 2, 0, -0.38, w / 2, 0.12, 0.38, WOOD2);
  for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * w / n; mb.tube([x, 0.48, -0.32], [x, 0.48, 0.34], 0.33, 0.33, 9, '#7a5634', true); for (const z of [-0.22, 0.24]) mb.tube([x, 0.48, z], [x, 0.48, z + 0.04], 0.345, 0.345, 9, IRON); mb.bc(x, 0.38, 0.38, 0.06, 0.06, 0.1, GOLDC); }
  mb.box(-w / 2, 1.5, -0.38, w / 2, 1.56, -0.04, WOODL); mb.box(-w / 2, 2.05, -0.38, w / 2, 2.11, -0.04, WOODL);
  const R = mulberry(77); for (const y of [1.56, 2.11]) for (let x = -w / 2 + 0.12; x < w / 2 - 0.1; x += 0.16) if (R() < 0.8) mb.cyl(x, y, -0.2, 0.05, 0.04, 0.22 + R() * 0.06, 5, R() < 0.5 ? '#3e5a3a' : '#6a4a2a'); };
FD.stairs = (mb, it) => { const w = it.w, d = it.d, n = 8, dir = it.dir || 1;
  for (let i = 0; i < n; i++) { const x0 = dir > 0 ? -w / 2 + i * w / n : w / 2 - (i + 1) * w / n, x1 = x0 + w / n, y1 = 0.32 + i * 0.3; mb.box(x0, 0, -d / 2, x1, y1, d / 2, i % 2 ? PLANK : PLANK2); }
  mb.box(-w / 2, 0, d / 2 - 0.06, w / 2, 0.6, d / 2, WOOD2); mb.beam([dir > 0 ? -w / 2 : w / 2, 1.2, d / 2], [dir > 0 ? w / 2 : -w / 2, 3.0, d / 2], 0.06, WOOD2); };
FD.forge = (mb, it, A) => { const w = it.w, d = it.d, st = A ? A.stone : '#8a857a', st2 = A ? A.stone2 : '#74705f';
  mb.box(-w / 2, 0, -d / 2, w / 2, 0.8, d / 2, st); mb.box(-w / 2 - 0.05, 0.8, -d / 2 - 0.05, w / 2 + 0.05, 0.9, d / 2 + 0.05, st2);
  const e = mb.em; mb.em = 1; mb.box(-w / 2 + 0.25, 0.9, -d / 2 + 0.2, w / 2 - 0.25, 0.95, d / 2 - 0.2, '#ff5a1a'); mb.em = 0.6; mb.ico(0, 0.95, 0, 0.35, 0.08, 0.25, '#ff8a2a', 0.2, 0, 4); mb.em = e;
  fire(mb, 0.1, 0.92, -0.05, 0.55);
  mb.frus(1.8, 2.5, w / 2 + 0.05, d / 2 + 0.05, 0.45, 0.4, st2, 0); mb.box(-0.45, 2.5, -d / 2, 0.45, 3.2, -d / 2 + 0.8, st2);
  mb.push().tr(w / 2 + 0.35, 0.55, 0.1).rz(0.2); mb.box(-0.25, -0.1, -0.3, 0.25, 0.1, 0.3, '#5a3a24'); mb.box(-0.05, -0.04, 0.3, 0.05, 0.04, 0.7, WOOD2); mb.pop(); };
FD.anvil = mb => { mb.cyl(0, 0, 0, 0.32, 0.3, 0.45, 8, WOOD2); mb.box(-0.12, 0.45, -0.1, 0.12, 0.62, 0.1, IRON); mb.box(-0.3, 0.62, -0.13, 0.22, 0.78, 0.13, '#5a5c62'); mb.push().tr(-0.3, 0.7, 0).rz(Math.PI / 2).cyl(0, 0, 0, 0.08, 0, 0.25, 6, '#5a5c62').pop();
  mb.beam([0.12, 0.8, 0.05], [0.3, 0.84, 0.28], 0.04, WOOD); mb.bc(0.1, 0.82, 0.02, 0.12, 0.07, 0.07, IRON); };
FD.grind = mb => { mb.box(-0.35, 0, -0.08, 0.35, 0.45, 0.08, WOOD2); mb.push().tr(0, 0.6, 0).rx(Math.PI / 2).cyl(0, -0.07, 0, 0.38, 0.38, 0.14, 12, '#9a968a').pop(); };
FD.wrack = (mb, it) => { const w = it.w; mb.box(-w / 2, 0, -0.15, w / 2, 0.12, 0.15, WOOD2); for (const sx of [-1, 1]) mb.box(sx * w / 2 - 0.05, 0, -0.15, sx * w / 2 + 0.05, 1.8, -0.05, WOOD2);
  mb.box(-w / 2, 1.5, -0.15, w / 2, 1.58, 0.1, WOOD); mb.box(-w / 2, 0.55, -0.15, w / 2, 0.6, 0.1, WOOD);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.25; x += 0.34) { mb.box(x - 0.03, 0.15, 0.0, x + 0.03, 1.45, 0.02, STEEL); mb.box(x - 0.1, 1.42, -0.02, x + 0.1, 1.46, 0.04, GOLDC); mb.box(x - 0.025, 1.46, -0.01, x + 0.025, 1.66, 0.03, WOOD2); }
  mb.push().tr(w / 2 - 0.45, 1.0, 0.06).rx(Math.PI / 2).cyl(0, 0, 0, 0.3, 0.3, 0.05, 10, '#4a5a7a', GOLDC).pop(); };
FD.astand = mb => { mb.cyl(0, 0, 0, 0.25, 0.25, 0.06, 8, WOOD2); mb.box(-0.03, 0.06, -0.03, 0.03, 1.45, 0.03, WOOD2); mb.frus(0.85, 1.4, 0.2, 0.14, 0.27, 0.17, '#b8c0c8', 0); mb.sph(0, 1.62, 0, 0.16, 0.18, 0.16, '#a8b0b8', 0); mb.box(-0.32, 1.3, -0.03, 0.32, 1.36, 0.03, WOOD2); };
FD.pew = (mb, it) => { const w = it.w; mb.box(-w / 2, 0.42, -0.22, w / 2, 0.48, 0.16, WOODL); mb.box(-w / 2, 0.48, 0.14, w / 2, 0.92, 0.2, WOOD); for (const sx of [-1, 1]) mb.box(sx * w / 2 - 0.04, 0, -0.22, sx * w / 2 + 0.04, 0.92, 0.2, WOOD2); };
FD.altar = (mb, it, A) => { const w = it.w, d = it.d; mb.box(-w / 2, 0, -d / 2, w / 2, 0.95, d / 2, A ? A.stone : '#8a857a'); mb.box(-w / 2 - 0.04, 0.95, -d / 2 - 0.04, w / 2 + 0.04, 1.0, d / 2 + 0.04, CREAM);
  mb.box(-0.25, 0.4, d / 2, 0.25, 1.0, d / 2 + 0.05, '#7a2e2a'); const e = mb.em; for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) { mb.cyl(x, 1.0, 0, 0.05, 0.05, 0.3, 6, '#e8e0cc'); mb.em = 1; mb.cyl(x, 1.3, 0, 0.035, 0, 0.1, 5, FIRE2); mb.em = e; } mb.box(-0.2, 1.0, -0.12, 0.2, 1.06, 0.14, '#5a2a2a'); };
FD.cross = mb => { mb.box(-0.07, 1.4, -0.05, 0.07, 3.0, 0.05, WOOD); mb.box(-0.45, 2.35, -0.05, 0.45, 2.49, 0.05, WOOD); };
FD.hay = (mb, it) => { const h = it.h || 1; mb.box(-it.w / 2, 0, -it.d / 2, it.w / 2, h, it.d / 2, STRAW); mb.box(-it.w / 2 + 0.05, h, -it.d / 2 + 0.05, it.w / 2 - 0.05, h + 0.05, it.d / 2 - 0.05, '#c8ab68'); if (h > 0.8) mb.box(-it.w / 2 - 0.01, h * 0.48, -it.d / 2 - 0.01, it.w / 2 + 0.01, h * 0.52, it.d / 2 + 0.01, '#9a7e44'); };
FD.stall = (mb, it) => { const L = it.len; for (const z of [-L / 2, L / 2]) mb.box(-0.07, 0, z - 0.07, 0.07, 1.4, z + 0.07, WOOD2); for (const y of [0.45, 0.85, 1.25]) mb.box(-0.04, y - 0.06, -L / 2, 0.04, y + 0.06, L / 2, WOOD); };
FD.cart = (mb, it) => { const br = it.broken; mb.push().rx(br ? 0.18 : 0); mb.box(-0.7, 0.55, -1.0, 0.7, 0.68, 1.0, WOODL); for (const sx of [-1, 1]) mb.box(sx * 0.7 - 0.04, 0.68, -1.0, sx * 0.7 + 0.04, 1.05, 1.0, WOOD);
  mb.box(-0.7, 0.68, -1.04, 0.7, 1.05, -0.96, WOOD); mb.pop(); for (const sx of [-1, 1]) { if (br && sx > 0) continue; mb.push().tr(sx * 0.82, 0.5, -0.2).rz(Math.PI / 2).cyl(0, -0.05, 0, 0.5, 0.5, 0.1, 10, WOOD2).pop(); }
  if (!br) for (const sx of [-1, 1]) mb.beam([sx * 0.45, 0.6, 1.0], [sx * 0.4, 0.35, 2.3], 0.07, WOOD); else mb.push().tr(1.2, 0.2, 0.4).rz(1.4).cyl(0, -0.05, 0, 0.5, 0.5, 0.1, 10, WOOD2).pop(); };
FD.lantern = (mb, it) => { const y = it.y || 2.3; mb.box(-0.015, y + 0.2, -0.015, 0.015, y + 0.62, 0.015, IRON); mb.box(-0.13, y - 0.17, -0.13, 0.13, y - 0.12, 0.13, IRON); mb.box(-0.13, y + 0.15, -0.13, 0.13, y + 0.2, 0.13, IRON);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(sx * 0.13 - 0.02, y - 0.12, sz * 0.13 - 0.02, sx * 0.13 + 0.02, y + 0.15, sz * 0.13 + 0.02, IRON);
  const e = mb.em; mb.em = 1; mb.box(-0.1, y - 0.12, -0.1, 0.1, y + 0.15, 0.1, '#ffcf70'); mb.em = e; mb.cyl(0, y + 0.2, 0, 0.16, 0, 0.13, 6, IRON); };
FD.pillar = (mb, it) => { const h = it.broken ? 2.4 : 5.0; mb.box(-0.5, 0, -0.5, 0.5, 0.3, 0.5, '#7a766c'); mb.cyl(0, 0.3, 0, 0.4, 0.36, h - 0.6, 8, '#8e8a80', false); if (!it.broken) mb.box(-0.5, h - 0.3, -0.5, 0.5, h, 0.5, '#7a766c'); else mb.ico(0.6, 0.2, 0.3, 0.45, 0.3, 0.4, '#8e8a80', 0.2, 0, 3); };
FD.brazier = mb => { for (let k = 0; k < 3; k++) { const a = k * TAU / 3; mb.beam([Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32], [Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12], 0.05, IRON); }
  mb.cyl(0, 0.82, 0, 0.18, 0.4, 0.3, 9, '#3e3a36'); const e = mb.em; mb.em = 0.8; mb.cyl(0, 1.1, 0, 0.36, 0.36, 0.03, 9, '#ff6a1a'); mb.em = e; fire(mb, 0, 1.1, 0, 0.75); };
FD.dais = (mb, it) => { mb.box(-it.w / 2, 0, -it.d / 2, it.w / 2, 0.3, it.d / 2, '#7a766c'); mb.box(-it.w / 2 + 0.3, 0.3, -it.d / 2 + 0.2, it.w / 2 - 0.3, 0.32, it.d / 2, '#6a2a26'); };
FD.throne = mb => { mb.push().tr(0, 0.3, 0); mb.box(-0.55, 0, -0.45, 0.55, 0.55, 0.4, '#5a3a24'); mb.box(-0.48, 0.55, -0.4, 0.48, 0.65, 0.35, '#7a2420'); mb.box(-0.55, 0.55, -0.48, 0.55, 2.3, -0.32, '#5a3a24');
  mb.box(-0.42, 0.7, -0.33, 0.42, 2.0, -0.3, '#7a2420'); for (const sx of [-1, 1]) { mb.box(sx * 0.55 - 0.08, 0.55, -0.45, sx * 0.55 + 0.08, 1.0, 0.4, '#5a3a24'); mb.sph(sx * 0.5, 2.38, -0.4, 0.09, 0.09, 0.09, GOLDC, 0); }
  mb.cyl(0, 2.3, -0.4, 0.2, 0, 0.4, 5, GOLDC); mb.pop(); };
FD.longtable = (mb, it) => { const w = it.w, d = it.d; if (it.broken) { mb.push().rz(0.25); } mb.box(-w / 2, 0.76, -d / 2, w / 2, 0.86, d / 2, WOODL);
  for (const sz of [-1, 0, 1]) for (const sx of [-1, 1]) mb.box(sx * (w / 2 - 0.15) - 0.06, 0, sz * (d / 2 - 0.25) - 0.06, sx * (w / 2 - 0.15) + 0.06, 0.76, sz * (d / 2 - 0.25) + 0.06, WOOD2);
  if (it.broken) { mb.pop(); return; }
  mb.box(-0.3, 0.86, -d / 2 + 0.1, 0.3, 0.87, d / 2 - 0.1, '#6a2a26');
  for (let z = -d / 2 + 0.6; z < d / 2 - 0.4; z += 1.1) for (const sx of [-1, 1]) { mb.cyl(sx * 0.48, 0.86, z, 0.14, 0.14, 0.02, 8, CREAM); mb.cyl(sx * 0.5, 0.86, z + 0.35, 0.04, 0.06, 0.16, 6, GOLDC); }
  for (const z of [-d * 0.25, d * 0.25]) { mb.cyl(0, 0.87, z, 0.08, 0.05, 0.35, 6, GOLDC); const e = mb.em; mb.em = 1; mb.cyl(0, 1.22, z, 0.04, 0, 0.12, 5, FIRE2); mb.em = e; } };
FD.banner = (mb, it) => { const col = it.col || '#8a2a24'; mb.box(-0.8, 4.1, -0.06, 0.8, 4.18, 0.06, WOOD2); mb.box(-0.68, 1.3, 0.04, 0.68, 4.1, 0.1, col);
  mb.tri([-0.68, 1.3, 0.1], [0.68, 1.3, 0.1], [0, 0.95, 0.1], col); mb.box(-0.32, 2.5, 0.1, 0.32, 3.3, 0.13, GOLDC); mb.box(-0.12, 2.3, 0.1, 0.12, 2.5, 0.13, GOLDC); };
FD.dummy = mb => { mb.box(-0.06, 0, -0.06, 0.06, 1.75, 0.06, WOOD2); mb.cyl(0, 0.7, 0, 0.24, 0.27, 0.75, 8, STRAW); mb.sph(0, 1.62, 0, 0.17, 0.19, 0.17, '#c8ab68', 0); mb.box(-0.55, 1.25, -0.04, 0.55, 1.33, 0.04, WOOD2); mb.cyl(0, 1.0, 0, 0.275, 0.275, 0.08, 8, '#7a4a30', false); };
FD.target = mb => { mb.beam([-0.5, 0, -0.1], [-0.15, 1.6, 0.05], 0.07, WOOD2); mb.beam([0.5, 0, -0.1], [0.15, 1.6, 0.05], 0.07, WOOD2); mb.beam([0, 0, -0.5], [0, 1.4, 0], 0.07, WOOD2);
  mb.push().tr(0, 1.15, 0.12).rx(Math.PI / 2 - 0.2); mb.cyl(0, 0, 0, 0.55, 0.55, 0.12, 14, STRAW); mb.cyl(0, 0.12, 0, 0.4, 0.4, 0.01, 14, '#e2d8c2'); mb.cyl(0, 0.125, 0, 0.26, 0.26, 0.01, 12, '#8a3a30'); mb.cyl(0, 0.13, 0, 0.11, 0.11, 0.01, 10, '#c8a048'); mb.pop(); };
FD.rubble = (mb, it) => { const r = it.rad || 0.8, R = mulberry(Math.round(it.x * 13 + it.z * 7)); for (let k = 0; k < 5; k++) { const a = R() * TAU, d = R() * r * 0.6; mb.ico(Math.cos(a) * d, 0.1 + R() * 0.2, Math.sin(a) * d, r * (0.35 + R() * 0.3), r * (0.25 + R() * 0.2), r * (0.35 + R() * 0.3), R() < 0.5 ? '#8a857a' : '#77726a', 0.25, 0, 20 + k); } };
FD.sign = () => { };
for (const k in FD) if (FURN[k]) FURN[k].draw = FD[k];
function mixHex(a, b, t) { const A = hexC(a), B = hexC(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; }
function drawFurn(mb, list, A) { for (const it of list) { const d = FD[it.f]; if (!d) continue; mb.push().tr(it.x, it.yo || 0, it.z).ry(it.r || 0); d(mb, it, A); mb.pop(); } }

// ---------- walls with doors and windows ----------
function archWall(mb, B, A, side, far) {
  const W2 = B.W / 2, D2 = B.D / 2, H = B.H, fb = side === 'f' || side === 'b';
  const u0 = fb ? -W2 : -D2 + BT, u1 = fb ? W2 : D2 - BT, ybot = -0.3, stoneTo = B.stoneTo || 0.36;
  const cuts = [BSTUB, H], wallC = B.plank ? A.plank : B.stoneWalls ? A.stone : A.wall, sand = A === APAL.sand, frame = !sand && !B.plank && !B.stoneWalls;
  const ops = B.doors.filter(d => d.side === side).map(d => ({ c: d.c, w: d.w, y0: ybot - 0.01, y1: d.h || Math.min(H - 0.32, d.w > 2.5 ? 2.7 : 2.15), door: true }))
    .concat(B.wins.filter(w => w.side === side).map(w => ({ c: w.c, w: w.w, y0: w.y0, y1: w.y1, glass: w.glass })));
  const us = [u0, u1]; for (const o of ops) us.push(clamp(o.c - o.w / 2, u0, u1), clamp(o.c + o.w / 2, u0, u1));
  us.sort((a, b) => a - b);
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1]; if (b - a < 0.005) continue;
    const m = (a + b) / 2, op = ops.find(o => m > o.c - o.w / 2 && m < o.c + o.w / 2);
    const ivs = op ? [[ybot, op.y0], [op.y1, H]] : [[ybot, H]];
    for (const [y0, y1] of ivs) {
      if (y1 - y0 < 0.01) continue;
      if (y0 < stoneTo) { const bx = sideBox(W2, D2, side, a, b, y0, Math.min(y1, stoneTo), -0.04, BT); bbox(mb, ...bx, A.stone2, cuts); }
      if (y1 > stoneTo) { const bx = sideBox(W2, D2, side, a, b, Math.max(y0, stoneTo), y1, 0, BT); bbox(mb, ...bx, wallC, cuts); }
    }
  }
  if (far) return;
  // timber frame on the outside face
  const tb = (a, b, y0, y1, o0, o1, col) => mb.box(...sideBox(W2, D2, side, a, b, y0, y1, o0, o1), col || A.timber);
  if (frame) {
    if (fb) for (const u of [u0, u1]) tb(u > 0 ? u - 0.18 : u - 0.03, u > 0 ? u + 0.03 : u + 0.18, stoneTo, H, -0.05, 0.14);
    tb(u0, u1, H - 0.18, H, -0.04, 0.02);
    const solid = [];
    let last = u0 + 0.1;
    for (const o of ops.slice().sort((p, q) => p.c - q.c)) { solid.push([last, o.c - o.w / 2 - 0.1]); last = o.c + o.w / 2 + 0.1; }
    solid.push([last, u1 - 0.1]);
    for (const [a, b] of solid) {
      if (b - a < 0.3) continue;
      tb(a, b, 0.98, 1.06, -0.035, 0.02);
      if (b - a > 1.2) { const n = Math.max(1, Math.round((b - a) / 1.8)); for (let k = 0; k < n; k++) { const x0 = a + (b - a) * k / n + 0.1, x1 = a + (b - a) * (k + 1) / n - 0.1, flip = (k + (side === 'f' ? 0 : 1)) % 2;
        const p0 = sidePt(W2, D2, side, flip ? x1 : x0, 1.06, -0.02), p1 = sidePt(W2, D2, side, flip ? x0 : x1, H - 0.18, -0.02); mb.beam(p0, p1, 0.09, A.timber); } }
    }
  }
  for (const o of ops) {
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    if (o.door) {
      tb(a - 0.12, a, stoneTo - 0.3, o.y1 + 0.14, -0.05, BT + 0.02); tb(b, b + 0.12, stoneTo - 0.3, o.y1 + 0.14, -0.05, BT + 0.02); tb(a - 0.16, b + 0.16, o.y1, o.y1 + 0.16, -0.06, BT + 0.02);
      mb.box(...sideBox(W2, D2, side, a - 0.1, b + 0.1, -0.3, 0.05, -0.55, BT), A.stone);
      // open door leaves pushed back flat against the inside of the wall (inside the cutaway band, so they drop with it)
      const others = ops.filter(q => q !== o), freeL = Math.min(a - u0, ...others.filter(q => q.c < o.c).map(q => a - (q.c + q.w / 2))), freeR = Math.min(u1 - b, ...others.filter(q => q.c > o.c).map(q => (q.c - q.w / 2) - b));
      const leafs = o.w > 2.5 && !B.plank ? [] : o.w > 1.8 ? [[a, -1, o.w / 2], [b, 1, o.w / 2]] : [[freeL >= freeR ? a : b, freeL >= freeR ? -1 : 1, o.w]];
      for (const [hu, sg, lw0] of leafs) {
        const lw = Math.min(lw0 - 0.08, (sg < 0 ? freeL : freeR) - 0.08); if (lw < 0.3) continue;
        const u2 = hu + sg * lw;
        if (B.plank) { mb.box(...sideBox(W2, D2, side, Math.min(hu, u2), Math.max(hu, u2), 0.05, o.y1 - 0.05, -0.1, -0.02), A.plank2); continue; }
        mb.box(...sideBox(W2, D2, side, Math.min(hu, u2), Math.max(hu, u2), 0.05, o.y1 - 0.08, BT + 0.01, BT + 0.08), '#5e3e26');
        mb.box(...sideBox(W2, D2, side, Math.min(hu, u2) + 0.1, Math.max(hu, u2) - 0.1, 0.4, 0.5, BT + 0.08, BT + 0.1), IRON);
      }
    } else {
      tb(a - 0.1, b + 0.1, o.y0 - 0.1, o.y0, -0.09, BT + 0.02); tb(a - 0.1, b + 0.1, o.y1, o.y1 + 0.12, -0.05, 0.03);
      tb(a - 0.08, a, o.y0, o.y1, -0.05, 0.03); tb(b, b + 0.08, o.y0, o.y1, -0.05, 0.03);
      const e = mb.em; mb.em = 1;
      const gc = o.glass ? ['#8a6a9a', '#5a7aa0', '#a08a4a', '#7a5a4a'] : null;
      if (gc) { const n = 3; for (let k = 0; k < n; k++) mb.box(...sideBox(W2, D2, side, a, b, o.y0 + (o.y1 - o.y0) * k / n, o.y0 + (o.y1 - o.y0) * (k + 1) / n, 0.06, 0.1), gc[(k + Math.round(o.c)) & 3]); }
      else mb.box(...sideBox(W2, D2, side, a, b, o.y0, o.y1, 0.06, 0.1), A.glass);
      mb.em = e;
      mb.box(...sideBox(W2, D2, side, a, b, o.y0, o.y1, 0.12, 0.16), '#2a3038');
      tb(o.c - 0.03, o.c + 0.03, o.y0, o.y1, 0.02, 0.06); tb(a, b, (o.y0 + o.y1) / 2 - 0.03, (o.y0 + o.y1) / 2 + 0.03, 0.02, 0.06);
      if (!o.glass && !sand) for (const sg of [-1, 1]) { const s0 = sg < 0 ? a - 0.12 - o.w * 0.48 : b + 0.12, s1 = sg < 0 ? a - 0.12 : b + 0.12 + o.w * 0.48; mb.box(...sideBox(W2, D2, side, s0, s1, o.y0, o.y1, -0.07, -0.02), A.shutter); }
    }
  }
}
function gableRoof(mb, A, W, D, y, h, ov, snow) {
  mb.push().ry(Math.PI / 2).roof(D, W, y, h, A.roof, ov).pop();
  const ex = W / 2 + ov, ez = D / 2 + ov;
  for (const sz of [-1, 1]) for (let k = 1; k <= 3; k++) { const f = k / 4, z = sz * ez * f, yy = y + h * (1 - f) + 0.03; mb.beam([-ex, yy, z], [ex, yy, z], 0.07, A.roof2); }
  mb.beam([-ex - 0.05, y + h + 0.02, 0], [ex + 0.05, y + h + 0.02, 0], 0.16, A.roof2);
  if (snow) mb.push().ry(Math.PI / 2).roof(D * 0.5, W, y + h * 0.5 + 0.06, h * 0.5, A.cap, ov + 0.02).pop();
}
function gableEnds(mb, col, W, D, y, h) {
  for (const sx of [-1, 1]) { const x = sx * W / 2; mb.tri([x, y, -D / 2], [x, y, D / 2], [x, y + h, 0], col); const xi = x - sx * BT; mb.tri([xi, y, -D / 2 + BT], [xi, y, D / 2 - BT], [xi, y + h - 0.2, 0], col); }
}
function signBoard(mb, B, A, sg) {
  const D2 = B.D / 2, x = sg.x;
  mb.box(x - 0.04, 2.36, D2, x + 0.04, 2.44, D2 + 1.0, A.timber); mb.beam([x, 2.4, D2 + 0.05], [x, 1.95, D2 + 0.05], 0.06, A.timber);
  mb.box(x - 0.04, 1.62, D2 + 0.35, x + 0.04, 2.24, D2 + 0.95, '#5a4632');
  for (const s of [-1, 1]) { const xx = x + s * 0.06;
    if (sg.kind === 'tankard') { mb.box(xx - 0.02, 1.75, D2 + 0.55, xx + 0.02, 2.08, D2 + 0.76, GOLDC); mb.box(xx - 0.02, 1.82, D2 + 0.76, xx + 0.02, 2.0, D2 + 0.83, GOLDC); }
    else if (sg.kind === 'anvil') { mb.box(xx - 0.02, 1.9, D2 + 0.45, xx + 0.02, 2.02, D2 + 0.85, '#aab0b8'); mb.box(xx - 0.02, 1.76, D2 + 0.58, xx + 0.02, 1.9, D2 + 0.72, '#aab0b8'); }
    else { mb.box(xx - 0.02, 1.72, D2 + 0.52, xx + 0.02, 2.02, D2 + 0.78, GOLDC); mb.box(xx - 0.02, 2.02, D2 + 0.6, xx + 0.02, 2.1, D2 + 0.7, GOLDC); } }
}
function floorPlanks(mb, x0, z0, x1, z1, seed) {
  const R = mulberry(seed || 5);
  for (let z = z0; z < z1 - 0.01; z += 0.42) { const zz = Math.min(z1, z + 0.42), c = hexC(R() < 0.5 ? PLANK : PLANK2), j = 0.93 + R() * 0.12; mb.box(x0, -0.28, z, x1, 0.04, zz - 0.012, [c[0] * j, c[1] * j, c[2] * j]); }
}
function mkBuildingM(type, vs, far) {
  const B = BLD[type], A = APAL[vs] || APAL[''], mb = new MB(201 + type.length * 7); mb.smooth = false;
  const W = B.W, D = B.D, H = B.H, W2 = W / 2, D2 = D / 2, sand = vs === 'sand', snow = vs === 'snow';
  if (!far) {
    floorPlanks(mb, -W2 + BT * 0.5, -D2 + BT * 0.5, W2 - BT * 0.5, D2 - BT * 0.5, W * 13);
    for (const d of B.doors) if (d.side === 'f') mb.box(d.c - d.w / 2, -0.28, D2 - BT, d.c + d.w / 2, 0.04, D2 + 0.02, PLANK2);
  }
  for (const s of ['f', 'b', 'l', 'r']) archWall(mb, B, A, s, far);
  let top = H + 0.18;
  for (const sd of ['f', 'b', 'l', 'r']) { const fb = sd === 'f' || sd === 'b'; mb.box(...sideBox(W2, D2, sd, fb ? -W2 : -D2 + BT, fb ? W2 : D2 - BT, H + 0.03, top, -0.02, BT), B.plank ? A.plank2 : A.timber); }
  if (B.H2) { // jettied upper storey
    const jt = 0.3, H2 = B.H2, y0 = H + 0.03, y1 = H + H2;
    mb.box(-W2 - 0.05, y0, -D2 - jt, W2 + 0.05, y0 + 0.16, D2 + jt, A.timber);
    if (!far) for (let x = -W2 + 0.3; x < W2; x += 0.6) for (const sz of [-1, 1]) mb.box(x - 0.06, y0 - 0.12, sz * (D2 + 0.02), x + 0.06, y0, sz * (D2 + jt), A.timber);
    mb.box(-W2, y0 + 0.16, -D2 - jt, W2, y1, -D2 - jt + BT, A.wall); mb.box(-W2, y0 + 0.16, D2 + jt - BT, W2, y1, D2 + jt, A.wall);
    mb.box(-W2, y0 + 0.16, -D2 - jt + BT, -W2 + BT, y1, D2 + jt - BT, A.wall); mb.box(W2 - BT, y0 + 0.16, -D2 - jt + BT, W2, y1, D2 + jt - BT, A.wall);
    if (!far && !sand) {
      for (const sz of [-1, 1]) { const z = sz * (D2 + jt + 0.03);
        mb.box(-W2, y1 - 0.16, z - 0.04, W2, y1, z + 0.04, A.timber);
        for (const x of [-W2 + 0.08, W2 - 0.08]) mb.box(x - 0.08, y0 + 0.16, z - 0.05, x + 0.08, y1, z + 0.05, A.timber);
        const n = Math.max(2, Math.round(W / 2.6));
        for (let k = 0; k < n; k++) { const cx = -W2 + W * (k + 0.5) / n, e = mb.em;
          mb.box(cx - 0.45, y0 + 0.75, z - 0.05, cx + 0.45, y0 + 0.8, z + 0.05, A.timber); mb.box(cx - 0.45, y0 + 1.75, z - 0.05, cx + 0.45, y0 + 1.8, z + 0.05, A.timber);
          mb.em = 1; mb.box(cx - 0.36, y0 + 0.8, z - 0.035, cx + 0.36, y0 + 1.75, z + 0.035, A.glass); mb.em = e;
          mb.box(cx - 0.03, y0 + 0.8, z - 0.05, cx + 0.03, y0 + 1.75, z + 0.05, A.timber);
          if (k < n - 1) { const bx = -W2 + W * (k + 1) / n; mb.beam([bx - 0.5, y0 + 0.25, z], [bx + 0.5, y1 - 0.25, z], 0.09, A.timber); } }
      }
    }
    top = y1;
  }
  const Dr = B.H2 ? D + 0.6 : D;
  if (sand) {
    mb.box(-W2 - 0.12, top, -Dr / 2 - 0.12, W2 + 0.12, top + 0.22, Dr / 2 + 0.12, A.roof);
    for (const sz of [-1, 1]) mb.box(-W2 - 0.12, top + 0.22, sz * (Dr / 2 + 0.12) - 0.12, W2 + 0.12, top + 0.6, sz * (Dr / 2 + 0.12) + 0.12, A.wall);
    for (const sx of [-1, 1]) mb.box(sx * (W2 + 0.12) - 0.12, top + 0.22, -Dr / 2, sx * (W2 + 0.12) + 0.12, top + 0.6, Dr / 2, A.wall);
    if (!far) for (let x = -W2 + 0.5; x < W2; x += 0.9) mb.tube([x, top - 0.12, Dr / 2 - 0.1], [x, top - 0.12, Dr / 2 + 0.35], 0.07, 0.07, 5, A.timber, true);
    if (type === 'chapel' || type === 'tavern') { mb.box(-1.0, top + 0.22, -1.0, 1.0, top + 1.5, 1.0, A.wall); mb.cyl(0, top + 1.5, 0, 1.2, 0, 0.9, 10, '#c09058'); }
  } else {
    gableRoof(mb, A, W, Dr, top, B.rh, B.H2 ? 0.35 : 0.42, snow);
    gableEnds(mb, B.plank ? A.plank : A.wall, W, Dr, top, B.rh);
  }
  // chimney
  if (B.chim) {
    const c = B.chim, ch = top + B.rh + (sand ? -B.rh + 1.2 : 0.7);
    let x0, x1, z0, z1, yb = -0.3;
    if (c.inner) { x0 = c.c - 0.4; x1 = c.c + 0.4; z0 = -D2 + 0.2; z1 = -D2 + 0.9; yb = 2.5; }
    else if (c.side === 'l') { x0 = -W2 - 0.62; x1 = -W2 + 0.02; z0 = c.c - 0.5; z1 = c.c + 0.5; }
    else if (c.side === 'r') { x0 = W2 - 0.02; x1 = W2 + 0.62; z0 = c.c - 0.5; z1 = c.c + 0.5; }
    else { x0 = c.c - 0.5; x1 = c.c + 0.5; z0 = -D2 - 0.62; z1 = -D2 + 0.02; }
    bbox(mb, x0, yb, z0, x1, ch, z1, A.stone, [BSTUB, H]); mb.box(x0 - 0.06, ch, z0 - 0.06, x1 + 0.06, ch + 0.14, z1 + 0.06, A.stone2);
    if (snow) mb.box(x0 - 0.04, ch + 0.14, z0 - 0.04, x1 + 0.04, ch + 0.2, z1 + 0.04, A.cap);
  }
  // chapel: buttresses and a bell tower at the front-left
  if (B.tower) {
    const t = B.tower, w = t.w / 2, st = A.stone, st2 = A.stone2;
    bbox(mb, t.x - w, -0.3, t.z - w, t.x + w, t.h - 1.8, t.z + w, st, [BSTUB, H]);
    mb.box(t.x - w - 0.08, t.h - 1.8, t.z - w - 0.08, t.x + w + 0.08, t.h - 1.65, t.z + w + 0.08, st2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(t.x + sx * w - (sx > 0 ? 0.3 : 0), t.h - 1.65, t.z + sz * w - (sz > 0 ? 0.3 : 0), t.x + sx * w + (sx < 0 ? 0.3 : 0), t.h, t.z + sz * w + (sz < 0 ? 0.3 : 0), st);
    mb.box(t.x - w - 0.1, t.h, t.z - w - 0.1, t.x + w + 0.1, t.h + 0.18, t.z + w + 0.1, st2);
    mb.cyl(t.x, t.h - 1.25, t.z, 0.45, 0.3, 0.75, 10, '#8a7a4a'); mb.sph(t.x, t.h - 0.45, t.z, 0.3, 0.12, 0.3, '#8a7a4a', 0);
    mb.push().tr(t.x, t.h + 0.18, t.z).ry(Math.PI / 4).cyl(0, 0, 0, w * 1.45, 0, 3.0, 4, snow ? A.cap : A.roof).pop();
    mb.box(t.x - 0.04, t.h + 3.1, t.z - 0.04, t.x + 0.04, t.h + 3.8, t.z + 0.04, GOLDC); mb.box(t.x - 0.22, t.h + 3.45, t.z - 0.04, t.x + 0.22, t.h + 3.53, t.z + 0.04, GOLDC);
    if (!far) { mb.em = 1; mb.box(t.x + w - 0.01, 2.2, t.z - 0.25, t.x + w + 0.03, 3.4, t.z + 0.25, A.glass); mb.em = 0; }
    for (const sx of [-1, 1]) for (const z of [-1.5, 1.5, -4.6]) mb.push().tr(sx * (W2 + 0.2), 0, 0).frus(-0.3, H - 0.5, 0.24, 0.3, 0.12, 0.2, A.stone2, z).pop();
  }
  if (B.sign && !far) signBoard(mb, B, A, B.sign);
  if (B.plank && !far) for (const sd of ['f', 'b', 'l', 'r']) { const fb = sd === 'f' || sd === 'b', L = fb ? W : D; for (let u = -L / 2 + 0.45; u < L / 2 - 0.2; u += 0.5) { const bx = sideBox(W2, D2, sd, u - 0.03, u + 0.03, 0.4, H - 0.05, -0.02, 0.01); if (B.doors.some(d => d.side === sd && Math.abs(u - d.c) < d.w / 2 + 0.05)) continue; mb.box(...bx, A.plank2); } }
  if (!far) drawFurn(mb, B.furn, A);
  return mb;
}

// ---------- village props (instanced) ----------
function mkFenceM() { const mb = new MB(301); mb.smooth = false; for (const x of [-1.5, 1.5]) mb.box(x - 0.07, -0.2, -0.07, x + 0.07, 1.05, 0.07, WOOD2); for (const y of [0.45, 0.85]) mb.box(-1.55, y - 0.05, -0.04, 1.55, y + 0.05, 0.04, WOOD); mb.box(-0.05, -0.2, -0.05, 0.05, 0.95, 0.05, WOOD2); return mb; }
function mkLampM() { const mb = new MB(302); mb.smooth = false; mb.box(-0.25, -0.2, -0.25, 0.25, 0.2, 0.25, '#77726a'); mb.box(-0.07, 0.2, -0.07, 0.07, 2.75, 0.07, WOOD2); mb.box(-0.05, 2.62, -0.05, 0.05, 2.7, 0.62, WOOD2); FD.lantern(mb.push().tr(0, 0, 0.55), { y: 1.95 }); mb.pop(); return mb; }
function mkPropM(f) { const mb = new MB(303); mb.smooth = false; FD[f](mb, {}); return mb; }
Object.assign(STATIC_BUILD, { fence: mkFenceM, lamp: mkLampM, barrel: () => mkPropM('barrel'), crate: () => mkPropM('crate') });
for (const t in BLD) for (const vs of ['', 'snow', 'sand']) {
  const k = 'b_' + t + (vs ? '_' + vs : '');
  STATIC_BUILD[k] = () => mkBuildingM(t, vs, false); STATIC_FAR[k] = () => mkBuildingM(t, vs, true);
  OWK[k] = 1;
}
Object.assign(OWK, { fence: 0.8, lamp: 0.9, barrel: 0.85, crate: 0.85 });

// =====================================================================
//  CASTLE MESHES — built once per castle, one mesh per part (culled per part) + a far silhouette
// =====================================================================
const CPAL = {
  royal: { st: '#b6b1a5', st2: '#9b968a', st3: '#c6c1b5', roof: '#4c5666', ban: '#2e4a8a', trim: '#b8964a' },
  usurper: { st: '#aca699', st2: '#928c80', st3: '#bcb6a9', roof: '#6a3a30', ban: '#8a2a24', trim: '#b8964a' },
  ruin: { st: '#aaa79e', st2: '#8f8c85', st3: '#b8b5ac', roof: '#4c5666', ban: '#5a5040', trim: '#7a6a4a' }
};
function castleSideBox(side, u0, u1, y0, y1, o0, o1) { return sideBox(CAS_S, CAS_S, side, u0, u1, y0, y1, o0, o1); }
function cWallPiece(mb, C, w, snow, far, R) {
  const T = CAS_T, h = w.h, cuts = [CAS_STUB];
  if (h <= 0.01) { if (!far) for (let k = 0; k < 4; k++) { const u = lerp(w.u0, w.u1, (k + 0.5) / 4), p = sidePt(CAS_S, CAS_S, w.side, u, 0, T / 2 + (R() - 0.5) * 2); mb.ico(p[0], 0.15, p[2], 0.9 + R() * 0.6, 0.4 + R() * 0.3, 0.9 + R() * 0.6, R() < 0.5 ? C.st : C.st2, 0.25, 0, 40 + k); } return; }
  const ruin = h < CAS_WH - 0.01;
  bbox(mb, ...castleSideBox(w.side, w.u0, w.u1, -0.6, h, 0, T), C.st, cuts);
  if (far) return;
  for (let y = 2.1; y < h - 0.9; y += 1.3) { mb.box(...castleSideBox(w.side, w.u0, w.u1, y, y + 0.07, -0.03, 0), C.st2); mb.box(...castleSideBox(w.side, w.u0, w.u1, y, y + 0.07, T, T + 0.03), C.st2); }
  for (let k = 0; k < 3; k++) { const u = lerp(w.u0 + 0.6, w.u1 - 1.6, R()), y = 1.6 + R() * Math.max(0.5, h - 3.5); mb.box(...castleSideBox(w.side, u, u + 0.7 + R() * 0.6, y, y + 0.55, -0.02, 0), R() < 0.5 ? C.st3 : C.st2); }
  mb.box(...castleSideBox(w.side, w.u0, w.u1, -0.6, 1.3, -0.35, T * 0.5), C.st2);
  if (!ruin) {
    mb.box(...castleSideBox(w.side, w.u0, w.u1, h - 0.55, h - 0.3, -0.18, 0.02), C.st3);
    for (let u = w.u0 + 0.5; u < w.u1 - 0.4; u += 1.9) { mb.box(...castleSideBox(w.side, u, Math.min(u + 1.0, w.u1), h, h + 1.15, 0, 0.62), C.st); if (snow) mb.box(...castleSideBox(w.side, u, Math.min(u + 1.0, w.u1), h + 1.15, h + 1.22, 0, 0.62), '#e8ecf0'); }
    mb.box(...castleSideBox(w.side, w.u0, w.u1, h, h + 0.5, T - 0.3, T), C.st2);
    const mu = (w.u0 + w.u1) / 2; mb.box(...castleSideBox(w.side, mu - 0.11, mu + 0.11, 4.4, 5.8, -0.03, 0.4), DARK);
    if (snow) mb.box(...castleSideBox(w.side, w.u0, w.u1, h, h + 0.07, 0.62, T - 0.3), '#e8ecf0');
  } else {
    const n = 3; for (let k = 0; k < n; k++) { const a = lerp(w.u0, w.u1, k / n), b = lerp(w.u0, w.u1, (k + 1) / n), hh = h + (R() - 0.3) * 1.4; if (hh > h) mb.box(...castleSideBox(w.side, a, b, h, hh, R() * 0.6, T - R() * 0.6), C.st); if (snow) mb.box(...castleSideBox(w.side, a + 0.05, b - 0.05, Math.max(h, hh), Math.max(h, hh) + 0.1, 0.2, T - 0.2), '#e8ecf0'); }
    for (let k = 0; k < 2; k++) { const u = lerp(w.u0, w.u1, R()), p = sidePt(CAS_S, CAS_S, w.side, u, 0, (R() < 0.5 ? -1.2 : T + 1.2)); mb.ico(p[0], 0.1, p[2], 0.7 + R() * 0.5, 0.35, 0.7 + R() * 0.5, C.st2, 0.25, 0, 60 + k); }
  }
}
function cTower(mb, C, t, snow, far, R, kind) {
  const cuts = [CAS_STUB];
  if (t.round) {
    const r = t.r, seg = far ? 8 : 14;
    mb.cyl(t.x, -0.6, t.z, r + 0.45, r + 0.12, CAS_STUB + 0.6, seg, C.st2);
    mb.cyl(t.x, CAS_STUB + 0.02, t.z, r, r, t.h - CAS_STUB - 0.02, seg, C.st);
    if (!far) for (let y = 2.6; y < t.h - 1.0; y += 1.3) mb.cyl(t.x, y, t.z, r + 0.03, r + 0.03, 0.07, seg, C.st2, false);
    if (!t.broken) {
      if (!far) { mb.cyl(t.x, t.h - 0.5, t.z, r + 0.28, r + 0.28, 0.5, seg, C.st3); for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; mb.push().tr(t.x + Math.cos(a) * (r - 0.05), 6.0, t.z + Math.sin(a) * (r - 0.05)).ry(-a + Math.PI / 2).box(-0.12, 0, -0.1, 0.12, 1.3, 0.1, DARK).pop(); } }
      if (t.cone) { mb.cyl(t.x, t.h, t.z, r + 0.55, 0, 5.8, seg, C.roof); if (!far) { mb.box(t.x - 0.04, t.h + 5.6, t.z - 0.04, t.x + 0.04, t.h + 7.4, t.z + 0.04, WOOD2); mb.push().tr(t.x, t.h + 7.0, t.z); mb.tri([0, 0, 0], [0, 0.42, 0], [1.3, 0.2, 0.1], C.ban); mb.pop(); } if (snow) mb.cyl(t.x, t.h + 2.4, t.z, (r + 0.55) * 0.59, 0, 3.4, seg, '#e8ecf0'); }
      else if (!far) { mb.cyl(t.x, t.h, t.z, r - 0.6, r - 0.6, 0.05, seg, C.st2); for (let k = 0; k < 12; k++) { const a = k * TAU / 12; mb.push().tr(t.x + Math.cos(a) * (r - 0.15), t.h, t.z + Math.sin(a) * (r - 0.15)).ry(-a).box(-0.3, 0, -0.5, 0.3, 1.1, 0.5, C.st).pop(); } }
    } else if (!far) {
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + R(), hh = 0.6 + R() * 2.2; mb.push().tr(t.x + Math.cos(a) * (r - 0.6), t.h, t.z + Math.sin(a) * (r - 0.6)).ry(-a).box(-0.9, 0, -0.6, 0.9, hh, 0.6, C.st).pop(); if (snow) mb.push().tr(t.x + Math.cos(a) * (r - 0.6), t.h + hh, t.z + Math.sin(a) * (r - 0.6)).ry(-a).box(-0.85, 0, -0.55, 0.85, 0.1, 0.55, '#e8ecf0').pop(); }
      for (let k = 0; k < 3; k++) { const a = R() * TAU; mb.ico(t.x + Math.cos(a) * (r + 1.5), 0.1, t.z + Math.sin(a) * (r + 1.5), 0.8, 0.4, 0.8, C.st2, 0.25, 0, 70 + k); }
    }
  } else {
    bbox(mb, t.x - t.hx, -0.6, t.z - t.hz, t.x + t.hx, t.h, t.z + t.hz, C.st, cuts);
    if (far) return;
    mb.box(t.x - t.hx - 0.3, -0.6, t.z - t.hz - 0.3, t.x + t.hx + 0.3, 1.4, t.z + t.hz + 0.3, C.st2);
    if (!t.broken) {
      mb.box(t.x - t.hx - 0.15, t.h - 0.5, t.z - t.hz - 0.15, t.x + t.hx + 0.15, t.h - 0.3, t.z + t.hz + 0.15, C.st3);
      for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) { mb.box(t.x + sx * t.hx - (sx > 0 ? 0.6 : 0), t.h, t.z + sz * (t.hz - 0.5) - 0.5, t.x + sx * t.hx + (sx < 0 ? 0.6 : 0), t.h + 1.1, t.z + sz * (t.hz - 0.5) + 0.5, C.st); mb.box(t.x + sz * (t.hx - 0.5) - 0.5, t.h, t.z + sx * t.hz - (sx > 0 ? 0.6 : 0), t.x + sz * (t.hx - 0.5) + 0.5, t.h + 1.1, t.z + sx * t.hz + (sx < 0 ? 0.6 : 0), C.st); }
      if (snow) mb.box(t.x - t.hx + 0.6, t.h, t.z - t.hz + 0.6, t.x + t.hx - 0.6, t.h + 0.07, t.z + t.hz - 0.6, '#e8ecf0');
      mb.box(t.x - 0.11, 5.2, t.z + (t.z > 0 ? t.hz : -t.hz) - 0.03, t.x + 0.11, 6.5, t.z + (t.z > 0 ? t.hz : -t.hz) + 0.03, DARK);
    } else for (let k = 0; k < 3; k++) mb.box(t.x - t.hx + k * t.hx * 0.66, t.h, t.z - t.hz, t.x - t.hx + (k + 1) * t.hx * 0.66, t.h + R() * 1.6, t.z + t.hz, C.st);
  }
}
function cGatehouse(mb, C, G, cs, far, R) {
  const ruin = cs.kind === 'ruin', h = ruin ? 7 : G.h, z0 = G.tz - G.thz, z1 = G.tz + G.thz, snow = cs.snow;
  for (const sx of [-1, 1]) {
    const x0 = sx * G.tx - G.thx, x1 = sx * G.tx + G.thx;
    bbox(mb, x0, -0.6, z0, x1, h, z1, C.st, [CAS_STUB]);
    if (far) continue;
    mb.box(x0 - 0.3, -0.6, z0, x1 + 0.3, 1.4, z1 + 0.3, C.st2);
    if (!ruin) {
      mb.box(x0 - 0.15, h - 0.5, z0 - 0.15, x1 + 0.15, h - 0.3, z1 + 0.15, C.st3);
      for (let z = z0 + 0.3; z < z1 - 0.3; z += 1.8) for (const xx of [x0, x1 - 0.6]) mb.box(xx, h, z, xx + 0.6, h + 1.1, z + 0.9, C.st);
      for (let x = x0 + 0.3; x < x1 - 0.3; x += 1.8) mb.box(x, h, z1 - 0.6, x + 0.9, h + 1.1, z1, C.st);
      mb.box(sx * G.tx - 0.11, 6, z1 - 0.03, sx * G.tx + 0.11, 7.4, z1 + 0.03, DARK);
      if (snow) mb.box(x0 + 0.6, h, z0 + 0.6, x1 - 0.6, h + 0.07, z1 - 0.6, '#e8ecf0');
    } else for (let k = 0; k < 2; k++) mb.box(x0 + k * G.thx, h, z0, x0 + (k + 1) * G.thx, h + R() * 2, z1, C.st);
  }
  if (!ruin) {
    bbox(mb, -G.hw, 5.6, z0, G.hw, h - 0.6, z1, C.st, [CAS_STUB]);
    if (far) return;
    mb.box(-G.hw, 5.5, z0, G.hw, 5.62, z1, C.st2);
    for (let x = -G.hw + 0.3; x < G.hw - 0.2; x += 0.42) mb.box(x - 0.05, 4.5, z1 - 1.0, x + 0.05, 5.55, z1 - 0.9, IRON);
    mb.box(-G.hw, 4.45, z1 - 1.0, G.hw, 4.55, z1 - 0.9, IRON);
    for (const sx of [-1, 1]) mb.box(sx * (G.hw - 0.12) - 0.08, 0.02, z0 + 0.15, sx * (G.hw - 0.12) + 0.08, 5.0, z0 + 2.4, '#4e3626');
    mb.box(-1.5, 6.6, z1, 1.5, 11.6, z1 + 0.08, C.ban); mb.tri([-1.5, 6.6, z1 + 0.08], [1.5, 6.6, z1 + 0.08], [0, 5.9, z1 + 0.08], C.ban);
    mb.box(-0.65, 8.6, z1 + 0.08, 0.65, 10.0, z1 + 0.12, C.trim); mb.box(-0.25, 8.0, z1 + 0.08, 0.25, 8.6, z1 + 0.12, C.trim);
    for (const sx of [-1, 1]) { mb.box(sx * (G.hw + 0.25) - 0.06, 3.2, z1 + 0.05, sx * (G.hw + 0.25) + 0.06, 3.9, z1 + 0.35, IRON); const e = mb.em; mb.em = 1; mb.cyl(sx * (G.hw + 0.25), 3.9, z1 + 0.3, 0.12, 0, 0.35, 5, FIRE2); mb.em = e; }
  } else if (!far) {
    for (let k = 0; k < 4; k++) mb.ico((R() - 0.5) * 4, 0.1, z1 + R() * 2, 0.8, 0.35, 0.8, C.st2, 0.25, 0, 80 + k);
  }
}
function cKeep(mb, C, cs, far, R) {
  const K = castlePlan(cs).keep, ruin = cs.kind === 'ruin', snow = cs.snow, kx = K.x, kz = K.z, hx = K.hx, hz = K.hz, t = 1.0, Hh = K.H, top = ruin ? 0 : K.top;
  const cuts = [BSTUB, Hh];
  mb.push().tr(kx, 0, kz);
  // ground floor walls with the door and slit windows
  const doorW = 2.6, doorH = 3.6;
  const wall = (side, u0, u1, y0, y1) => bbox(mb, ...sideBox(hx, hz, side, u0, u1, y0, y1, 0, t), C.st, cuts);
  const wins = { f: [-6.5, 6.5], b: [-6, 0, 6], l: [-4.5, 0.5, 5], r: [-4.5, 0.5, 5] };
  for (const side of ['f', 'b', 'l', 'r']) {
    const fb = side === 'f' || side === 'b', u0 = fb ? -hx : -hz + t, u1 = fb ? hx : hz - t;
    const ops = (side === 'f' ? [[0, doorW, -1, doorH]] : []).concat(wins[side].map(c => [c, 0.5, 1.8, 3.6]));
    const us = [u0, u1]; for (const o of ops) us.push(o[0] - o[1] / 2, o[0] + o[1] / 2); us.sort((a, b) => a - b);
    for (let i = 0; i < us.length - 1; i++) {
      const a = us[i], b = us[i + 1]; if (b - a < 0.01) continue;
      const m = (a + b) / 2, op = ops.find(o => Math.abs(m - o[0]) < o[1] / 2);
      const hTop = ruin ? 2.6 + R() * 2.6 : Hh;
      if (op) { if (op[2] > -0.6) wall(side, a, b, -0.6, op[2]); if (op[3] < hTop) wall(side, a, b, op[3], hTop); } else wall(side, a, b, -0.6, hTop);
      if (snow && ruin) mb.box(...sideBox(hx, hz, side, a, b, hTop, hTop + 0.08, 0.05, t - 0.05), '#e8ecf0');
    }
    if (!far) for (const o of ops) if (o[2] > 0) { const e = mb.em; mb.em = 0.7; mb.box(...sideBox(hx, hz, side, o[0] - o[1] / 2, o[0] + o[1] / 2, o[2], o[3], 0.35, 0.45), '#c88a48'); mb.em = e; }
  }
  if (!far && !ruin) {
    // door: arched stone frame, open leaves, step
    mb.box(-doorW / 2 - 0.45, -0.6, hz - 0.1, -doorW / 2, doorH + 0.5, hz + 0.25, C.st3); mb.box(doorW / 2, -0.6, hz - 0.1, doorW / 2 + 0.45, doorH + 0.5, hz + 0.25, C.st3);
    mb.box(-doorW / 2 - 0.45, doorH, hz - 0.1, doorW / 2 + 0.45, doorH + 0.5, hz + 0.25, C.st3);
    for (const sx of [-1, 1]) mb.box(sx * doorW / 2 + (sx < 0 ? -1.25 : 0), 0.02, hz - t - 0.09, sx * doorW / 2 + (sx > 0 ? 1.25 : 0), doorH - 0.1, hz - t - 0.01, '#4e3626');
    mb.box(-doorW / 2 - 0.6, -0.6, hz, doorW / 2 + 0.6, 0.12, hz + 1.2, C.st2);
    for (const sx of [-1, 1]) { mb.box(sx * (doorW / 2 + 0.7) - 0.06, 2.4, hz + 0.02, sx * (doorW / 2 + 0.7) + 0.06, 3.0, hz + 0.3, IRON); const e = mb.em; mb.em = 1; mb.cyl(sx * (doorW / 2 + 0.7), 3.0, hz + 0.25, 0.11, 0, 0.32, 5, FIRE2); mb.em = e; }
  }
  if (!ruin) {
    // upper storeys (always cut away when inside), ceiling slab, roof walk, crenellations
    bbox(mb, -hx + t * 0.5, Hh + 0.03, -hz + t * 0.5, hx - t * 0.5, Hh + 0.35, hz - t * 0.5, C.st2, []);
    for (const side of ['f', 'b', 'l', 'r']) { const fb = side === 'f' || side === 'b'; mb.box(...sideBox(hx, hz, side, fb ? -hx : -hz + t, fb ? hx : hz - t, Hh + 0.03, top, 0, t), C.st); }
    mb.box(-hx + t, top - 0.4, -hz + t, hx - t, top - 0.1, hz - t, C.st2);
    if (!far) {
      for (const y of [Hh + 0.1, Hh + 5.1]) for (const side of ['f', 'b', 'l', 'r']) { const fb = side === 'f' || side === 'b'; mb.box(...sideBox(hx, hz, side, fb ? -hx - 0.15 : -hz, fb ? hx + 0.15 : hz, y, y + 0.25, -0.15, 0.1), C.st3); }
      for (const side of ['f', 'b', 'l', 'r']) { const fb = side === 'f' || side === 'b', L = fb ? hx : hz;
        for (let u = -L + 0.6; u < L - 0.6; u += 1.9) mb.box(...sideBox(hx, hz, side, u, u + 1.0, top, top + 1.1, 0, 0.6), C.st);
        for (const yy of [Hh + 1.8, Hh + 6.6]) for (let u = -L + 2.4; u < L - 2; u += 3.4) { const e = mb.em; mb.em = 0.8; mb.box(...sideBox(hx, hz, side, u - 0.3, u + 0.3, yy, yy + 1.7, -0.03, 0.1), '#9a6a3a'); mb.em = e; mb.box(...sideBox(hx, hz, side, u - 0.42, u + 0.42, yy + 1.7, yy + 1.92, -0.08, 0.1), C.st3); } }
      if (snow) mb.box(-hx + 0.7, top, -hz + 0.7, hx - 0.7, top + 0.06, hz - 0.7, '#e8ecf0');
      // hanging banners on the front
      for (const sx of [-1, 1]) { mb.box(sx * 4.2 - 0.8, Hh + 1.0, hz + 0.02, sx * 4.2 + 0.8, top - 1.2, hz + 0.1, C.ban); mb.tri([sx * 4.2 - 0.8, Hh + 1.0, hz + 0.1], [sx * 4.2 + 0.8, Hh + 1.0, hz + 0.1], [sx * 4.2, Hh + 0.3, hz + 0.1], C.ban); mb.box(sx * 4.2 - 0.35, top - 4.0, hz + 0.1, sx * 4.2 + 0.35, top - 3.2, hz + 0.14, C.trim); }
    }
  }
  // corner turrets
  for (const [x, z] of [[-hx, hz], [hx, hz], [hx, -hz], [-hx, -hz]]) {
    const th = ruin ? 3 + R() * 4 : top + 3.5, seg = far ? 6 : 10;
    mb.cyl(x, -0.6, z, K.tr + 0.2, K.tr, 1.1, seg, C.st2); mb.cyl(x, BSTUB + 0.02, z, K.tr, K.tr, Hh - BSTUB - 0.04, seg, C.st); mb.cyl(x, Hh, z, K.tr, K.tr, th - Hh, seg, C.st);
    if (!ruin) { mb.cyl(x, th, z, K.tr + 0.4, 0, 3.6, seg, C.roof); if (snow) mb.cyl(x, th + 1.5, z, (K.tr + 0.4) * 0.58, 0, 2.1, seg, '#e8ecf0'); if (!far) { mb.box(x - 0.03, th + 3.4, z - 0.03, x + 0.03, th + 4.6, z + 0.03, WOOD2); mb.push().tr(x, th + 4.3, z); mb.tri([0, 0, 0], [0, 0.3, 0], [0.9, 0.15, 0.05], C.ban); mb.pop(); } }
  }
  if (!far) {
    // flagstone floor
    const fx = hx - t, fz = hz - t, Rf = mulberry(5150);
    for (let x = -fx; x < fx - 0.01; x += 1.6) for (let z = -fz; z < fz - 0.01; z += 1.6) { const j = 0.9 + Rf() * 0.14, c = hexC(((Math.round(x / 1.6) + Math.round(z / 1.6)) & 1) ? '#7a766c' : '#6e6a62'); mb.box(x, -0.3, z, Math.min(fx, x + 1.6) - 0.03, 0.04, Math.min(fz, z + 1.6) - 0.03, [c[0] * j, c[1] * j, c[2] * j]); }
    if (!ruin) for (const sx of [-1, 1]) for (const z of [-4.5, 0.5, 5]) { mb.box(sx * (hx - t) - (sx > 0 ? 0.25 : -0.05), 2.4, z - 0.06, sx * (hx - t) + (sx > 0 ? -0.05 : 0.25), 3.0, z + 0.06, IRON); const e = mb.em; mb.em = 1; mb.cyl(sx * (hx - t - 0.15), 3.0, z, 0.1, 0, 0.3, 5, FIRE2); mb.em = e; }
  }
  mb.pop();
  if (!far) drawFurn(mb, castlePlan(cs).hall, { stone: C.st, stone2: C.st2 });
}
function cCourt(mb, C, cs, far) {
  const Pl = castlePlan(cs), snow = cs.snow, A = APAL[snow ? 'snow' : ''];
  for (const it of Pl.court) {
    if (it.f === 'barracks' || it.f === 'storehouse') {
      const x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2, h = it.broken ? 2.5 : it.f === 'barracks' ? 4.2 : 3.6;
      if (it.broken) { mb.box(x0, -0.3, z0, x1, 0.6, z1, C.st2); for (let k = 0; k < 5; k++) { const z = lerp(z0, z1, k / 5); mb.box(x0, 0.6, z, x0 + 0.8, 1 + (k * 7 % 3), z + it.d / 5, C.st); mb.box(x1 - 0.8, 0.6, z, x1, 0.8 + (k * 5 % 3) * 0.7, z + it.d / 5, C.st); } continue; }
      mb.box(x0, -0.3, z0, x1, 1.6, z1, C.st); mb.box(x0, 1.6, z0, x1, h, z1, A.wall);
      for (const sx of [-1, 1]) { const x = sx < 0 ? x0 : x1; for (let z = z0 + 1.2; z < z1 - 0.8; z += 2.2) { if (far) break; const e = mb.em; mb.em = 1; mb.box(x - 0.04, 2.2, z - 0.35, x + 0.04, 3.2, z + 0.35, A.glass); mb.em = e; mb.box(x - 0.07, 2.1, z - 0.45, x + 0.07, 2.2, z + 0.45, A.timber); } }
      if (!far) { const dx = it.x > 0 ? x0 : x1; mb.box(dx - 0.08, 0, it.z - 0.7, dx + 0.08, 2.3, it.z + 0.7, '#4e3626'); mb.box(dx - 0.1, 2.3, it.z - 0.85, dx + 0.1, 2.45, it.z + 0.85, A.timber); for (const z of [z0 + 0.1, z1 - 0.1]) mb.box(x0, 1.6, z - 0.08, x1, h, z + 0.08, A.timber); }
      mb.push().tr(it.x, 0, it.z).ry(Math.PI / 2); gableRoof(mb, { roof: C.roof, roof2: C.st2, cap: '#e8ecf0' }, it.d, it.w, h, 2.2, 0.35, snow); gableEnds(mb, A.wall, it.d, it.w, h, 2.2); mb.pop();
    } else if (it.f === 'stables') {
      const x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2;
      mb.box(x1 - 0.4, -0.3, z0, x1, 3.6, z1, WOOD); for (const z of [z0, z1 - 0.4]) mb.box(x0 + 0.4, -0.3, z, x1, 3.0, z + 0.4, WOOD);
      for (const z of [z0 + 0.2, (z0 + z1) / 2, z1 - 0.2]) mb.box(x0 + 0.2, 0, z - 0.12, x0 + 0.44, 2.4, z + 0.12, WOOD2);
      mb.push().tr(0, 0, 0); mb.quad([x0 - 0.3, 2.4, z0 - 0.3], [x1 + 0.2, 3.7, z0 - 0.3], [x1 + 0.2, 3.7, z1 + 0.3], [x0 - 0.3, 2.4, z1 + 0.3], C.roof); mb.pop();
      if (snow) mb.quad([x0 - 0.2, 2.46, z0 - 0.2], [x1 + 0.1, 3.76, z0 - 0.2], [x1 + 0.1, 3.76, z1 + 0.2], [x0 - 0.2, 2.46, z1 + 0.2], '#e8ecf0');
      if (!far) { for (const z of [it.z - 2.2, it.z + 2.2]) { mb.push().tr(x1 - 1.45, 0, z).ry(Math.PI / 2); FD.stall(mb, { len: 2.3 }); mb.pop(); } for (const z of [it.z - 4.3, it.z, it.z + 4.3]) { mb.push().tr(x1 - 1.0, 0, z); FD.hay(mb, { w: 0.9, d: 1.4, h: 0.5 }); mb.pop(); } }
    } else if (it.f === 'pole') {
      if (far) continue;
      mb.box(it.x - 0.08, 0, it.z - 0.08, it.x + 0.08, 6.2, it.z + 0.08, WOOD2); mb.sph(it.x, 6.25, it.z, 0.14, 0.14, 0.14, C.trim, 0);
      mb.box(it.x - 0.7, 5.7, it.z - 0.04, it.x + 0.7, 5.78, it.z + 0.04, WOOD2); mb.box(it.x - 0.62, 2.8, it.z - 0.02, it.x + 0.62, 5.7, it.z + 0.04, C.ban);
      mb.tri([it.x - 0.62, 2.8, it.z + 0.04], [it.x + 0.62, 2.8, it.z + 0.04], [it.x, 2.3, it.z + 0.04], C.ban); mb.box(it.x - 0.3, 4.0, it.z + 0.04, it.x + 0.3, 4.7, it.z + 0.08, C.trim);
    } else if (it.f === 'yard') {
      if (!far) { mb.box(it.x - it.w / 2 + 0.3, -0.2, it.z - it.d / 2 + 0.3, it.x + it.w / 2 - 0.3, 0.025, it.z + it.d / 2 - 0.3, '#a89070'); }
    } else if (FD[it.f] && !far) { mb.push().tr(it.x, 0, it.z).ry(it.r || 0); FD[it.f](mb, it, A); mb.pop(); }
  }
}
// part list: each has a builder; meshes are made lazily (one per frame) and freed when the castle is far away
function castlePartDefs(cs) {
  const Pl = castlePlan(cs), C = CPAL[cs.kind];
  const defs = [];
  for (const sd of ['f', 'b', 'l', 'r']) defs.push({ name: 'wall_' + sd, build: far => { const mb = new MB(401); mb.smooth = false; const r = mulberry(cs.seed + sd.charCodeAt(0)); for (const w of Pl.walls) if (w.side === sd) cWallPiece(mb, C, w, cs.snow, far, r); if (sd === 'f') cGatehouse(mb, C, Pl.gate, cs, far, r); for (const t of Pl.towers) if (!t.round && ((sd === 'l' && t.x < -20) || (sd === 'r' && t.x > 20) || (sd === 'b' && t.z < -20))) cTower(mb, C, t, cs.snow, far, r, cs.kind); return mb; } });
  Pl.towers.forEach((t, i) => { if (t.round) defs.push({ name: 'tower_' + i, build: far => { const mb = new MB(402); mb.smooth = false; cTower(mb, C, t, cs.snow, far, mulberry(cs.seed + i * 31), cs.kind); return mb; } }); });
  defs.push({ name: 'keep', build: far => { const mb = new MB(403); mb.smooth = false; cKeep(mb, C, cs, far, mulberry(cs.seed ^ 0x6b)); return mb; } });
  defs.push({ name: 'court', build: far => { const mb = new MB(404); mb.smooth = false; cCourt(mb, C, cs, far); return mb; } });
  return defs;
}
function meshBounds(mb) {
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9; const d = mb.d;
  for (let i = 0; i < d.length; i += 14) { const x = d[i], y = d[i + 1], z = d[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2];
}
const CGPU = new Map();
let castleBuildBudget = 0;
function freeMesh(m) { if (!m) return; gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); }
function castleGPU(cs, near) {
  let G = CGPU.get(cs.id);
  if (!G) {
    G = { defs: castlePartDefs(cs), parts: [], far: null, ready: false };
    const mb = new MB(405); mb.smooth = false;
    for (const d of G.defs) { const m = d.build(true); for (let i = 0; i < m.d.length; i++) mb.d.push(m.d[i]); }
    G.far = gpuMesh(mb); G.farB = meshBounds(mb);
    CGPU.set(cs.id, G);
  }
  if (near && !G.ready && castleBuildBudget > 0) {
    castleBuildBudget--;
    const d = G.defs[G.parts.length], mb = d.build(false);
    G.parts.push({ name: d.name, mesh: gpuMesh(mb), b: meshBounds(mb) });
    if (G.parts.length === G.defs.length) G.ready = true;
  }
  return G;
}
function freeFarCastles() {
  for (const [id, G] of CGPU) {
    const cs = CASC.get(id.slice(1)); if (cs && Math.hypot(cs.x - CAM.x, cs.y - CAM.y) < 420) continue;
    freeMesh(G.far); for (const p of G.parts) freeMesh(p.mesh); CGPU.delete(id);
  }
}
const CASM = m4();
function drawCastles(U) {
  if (frameNo % 120 === 0) freeFarCastles();
  castleBuildBudget = S.mode === 'loading' ? 99 : 1;
  for (const cs of castlesNear(CAM.x, CAM.y, 200)) {
    const d = Math.hypot(cs.x - CAM.x, cs.y - CAM.y);
    if (!inView(cs.x, cs.gh + 6, cs.y, 56)) { if (d < 120) castleGPU(cs, true); continue; }
    const G = castleGPU(cs, d < 140);
    m4trs(CASM, cs.x, cs.gh, cs.y, yawOf(cs.rot), 0, 0, 1);
    gl.uniformMatrix4fv(U.uModel, false, CASM);
    const c = cs.c, s = cs.s;
    if (!G.ready || d > 95) { setId(1); gl.bindVertexArray(G.far.vao); gl.drawArrays(gl.TRIANGLES, 0, G.far.n); continue; }
    gl.uniform4f(U.uOcc, 0, 0, 2.6, 1);
    for (const p of G.parts) {
      const b = p.b, w = [cs.x + b[0] * s + b[2] * c, cs.gh + b[1], cs.y - b[0] * c + b[2] * s];
      if (!inView(w[0], w[1], w[2], b[3])) continue;
      setId(1); gl.bindVertexArray(p.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n);
    }
    gl.uniform4f(U.uOcc, 0, 0, 0, 0);
  }
  gl.uniformMatrix4fv(U.uModel, false, UNITM);
}
