// =====================================================================
//  MANOR MESHES — the derelict house (walls split at the cutaway heights, three roof masses,
//  a corner tower, a portico), furnished interiors, the walled garden and the broken gate
// =====================================================================
const MPAL = { st: '#6e6a62', st2: '#57534d', st3: '#86817a', wall: '#6a625a', roof: '#3a3e46', roof2: '#2e3238', moss: '#4e5a38', ivy: '#3e5430',
  wood: '#3e3026', wood2: '#2c221c', plank: '#4e3e30', plank2: '#43352a', glass: '#232c36', lit: '#d09048', paper: '#8e7a62', tile: '#54504a', tile2: '#46423e' };
const MCOB = '#b8b8b0';
// ---------- furniture ----------
function drawStatue(mb) {
  const st = '#9a968c', st2 = '#7e7a72';
  mb.box(-0.55, 0, -0.55, 0.55, 0.7, 0.55, st2); mb.box(-0.62, 0.7, -0.62, 0.62, 0.82, 0.62, st);
  mb.frus(0.82, 2.0, 0.34, 0.26, 0.2, 0.16, st);
  mb.ico(0, 2.12, 0.08, 0.15, 0.17, 0.15, st, 0.05, 0, 3); mb.ico(0, 2.12, -0.02, 0.18, 0.2, 0.16, st2, 0.05, 0, 4);
  for (const sd of [1, -1]) { mb.tri([sd * 0.12, 1.9, -0.15], [sd * 0.75, 2.5, -0.35], [sd * 0.3, 1.0, -0.3], st2); mb.tri([sd * 0.12, 1.9, -0.15], [sd * 0.3, 1.0, -0.3], [sd * 0.1, 1.2, -0.2], st); }
  mb.beam([0.2, 1.75, 0.15], [0.05, 2.05, 0.2], 0.08, st); mb.beam([-0.2, 1.75, 0.15], [-0.05, 2.05, 0.2], 0.08, st);
}
function candle(mb, x, y, z, h) { mb.cyl(x, y, z, 0.035, 0.035, h, 5, '#e0d8c0'); const e = mb.em; mb.em = 1; mb.cyl(x, y + h, z, 0.03, 0, 0.09, 4, '#ffc050'); mb.em = e; }
Object.assign(FD, {
  chair: (mb, it) => { if (it.broken) mb.push().tr(0, 0.25, 0).rx(1.35).tr(0, -0.25, 0); mb.box(-0.22, 0.42, -0.22, 0.22, 0.48, 0.22, MPAL.wood); for (const sx of [-1, 1]) for (const sz of [-1, 1]) mb.box(sx * 0.18 - 0.03, 0, sz * 0.18 - 0.03, sx * 0.18 + 0.03, 0.42, sz * 0.18 + 0.03, MPAL.wood2);
    mb.box(-0.22, 0.48, -0.24, 0.22, 1.15, -0.18, MPAL.wood); mb.box(-0.15, 0.62, -0.25, 0.15, 1.02, -0.23, '#5a2a2e'); if (it.broken) mb.pop(); },
  armchair: mb => { const c = '#5a2a2e', c2 = '#4a2226'; mb.box(-0.42, 0, -0.4, 0.42, 0.42, 0.4, MPAL.wood2); mb.box(-0.36, 0.42, -0.34, 0.36, 0.55, 0.36, c); mb.box(-0.42, 0.42, -0.42, 0.42, 1.25, -0.26, c2);
    for (const sx of [-1, 1]) { mb.box(sx * 0.42 - 0.1, 0.42, -0.4, sx * 0.42 + 0.02 * sx, 0.78, 0.38, c2); mb.box(sx * 0.42 - 0.12, 0.95, -0.42, sx * 0.42 + 0.02 * sx, 1.25, -0.1, c); } mb.ico(0.1, 0.6, 0.05, 0.12, 0.05, 0.14, '#8a7a5a', 0.2, 0, 3); },
  desk: (mb, it) => { const w = it.w, d = it.d; mb.box(-w / 2, 0.74, -d / 2, w / 2, 0.82, d / 2, MPAL.wood); for (const sx of [-1, 1]) mb.box(sx * w / 2 - (sx > 0 ? 0.55 : 0), 0, -d / 2 + 0.05, sx * w / 2 + (sx < 0 ? 0.55 : 0), 0.74, d / 2 - 0.05, MPAL.wood2);
    for (const sx of [-1, 1]) for (const y of [0.2, 0.45]) mb.box(sx * (w / 2 - 0.28) - 0.18, y, d / 2 - 0.04, sx * (w / 2 - 0.28) + 0.18, y + 0.16, d / 2 - 0.02, MPAL.wood);
    mb.box(-0.4, 0.82, -0.2, 0.1, 0.83, 0.15, '#c8bca0'); mb.box(0.15, 0.82, -0.1, 0.5, 0.835, 0.2, '#b8ac90'); mb.cyl(0.6, 0.82, -0.25, 0.05, 0.05, 0.07, 5, '#1a1a1e'); candle(mb, -0.65, 0.82, -0.25, 0.2);
    mb.box(0.3, 0.83, -0.35, 0.62, 0.95, -0.15, '#5a2a24'); },
  globe: mb => { mb.cyl(0, 0, 0, 0.3, 0.3, 0.05, 6, MPAL.wood2); for (let k = 0; k < 3; k++) { const a = k * TAU / 3; mb.beam([Math.cos(a) * 0.25, 0.05, Math.sin(a) * 0.25], [0, 0.6, 0], 0.04, MPAL.wood); } mb.ico(0, 0.82, 0, 0.24, 0.24, 0.24, n => n[1] > 0.3 ? '#8a7a4a' : '#4a5a6a', 0, 1, 2);
    mb.push().tr(0, 0.82, 0).rz(0.4).cyl(0, -0.015, 0, 0.29, 0.29, 0.03, 12, '#a8884a', false).pop(); },
  sarco: (mb, it, A) => { const st = '#77736b', st2 = '#615d56'; mb.box(-0.62, 0, -1.15, 0.62, 0.72, 1.15, st); mb.box(-0.68, 0.72, -1.22, 0.68, 0.86, 1.22, st2);
    mb.ico(0, 0.95, 0.15, 0.3, 0.12, 0.75, st, 0.1, 0, 5); mb.ico(0, 0.98, -0.75, 0.16, 0.13, 0.16, st, 0.05, 0, 6); for (const z of [-0.7, 0, 0.7]) mb.box(-0.64, 0.2, z - 0.2, -0.62, 0.55, z + 0.2, st2); },
  coffin: mb => { const w = MPAL.wood2; mb.push().rx(-0.12); mb.box(-0.3, 0, -0.18, 0.3, 1.75, 0.16, w); mb.box(-0.36, 1.05, -0.2, 0.36, 1.45, 0.18, w); mb.box(-0.04, 0.4, 0.16, 0.04, 1.6, 0.19, '#6a6458'); mb.box(-0.2, 1.2, 0.16, 0.2, 1.26, 0.19, '#6a6458'); mb.pop(); },
  cryptstairs: (mb, it) => { const w = it.w, d = it.d, st = '#6a665e', st2 = '#56524c';
    for (let i = 0; i < 9; i++) { const z0 = d / 2 - i * d / 9, k = 1 - i / 9, c = hexC(st); mb.box(-w / 2 + 0.1, 0.05, z0 - d / 9, w / 2 - 0.1, 0.065 + 0.0001 * i, z0, [c[0] * (0.18 + 0.8 * k * k), c[1] * (0.18 + 0.8 * k * k), c[2] * (0.2 + 0.8 * k * k)]); }
    const e = mb.em; mb.em = 0.35; mb.box(-w / 2 + 0.3, 0.07, -d / 2 + 0.08, w / 2 - 0.3, 0.075, -d / 2 + 0.4, '#3a5a7a'); mb.em = e;
    for (const sx of [-1, 1]) { mb.box(sx * w / 2 - 0.1, 0, -d / 2, sx * w / 2 + 0.1, 0.85, d / 2, st2); mb.box(sx * w / 2 - 0.14, 0.85, -d / 2, sx * w / 2 + 0.14, 0.95, d / 2, st); }
    mb.box(-w / 2, 0, -d / 2 - 0.1, w / 2, 0.85, -d / 2 + 0.1, st2); mb.box(-w / 2 - 0.04, 0.85, -d / 2 - 0.14, w / 2 + 0.04, 0.95, -d / 2 + 0.14, st);
    for (const sx of [-1, 1]) { mb.box(sx * w / 2 - 0.16, 0, d / 2 - 0.16, sx * w / 2 + 0.16, 1.25, d / 2 + 0.16, st); mb.ico(sx * w / 2, 1.38, d / 2, 0.16, 0.14, 0.16, st2, 0.1, 0, 4); } },
  candles: mb => { mb.cyl(0, 0, 0, 0.18, 0.18, 0.04, 6, '#2a2a2e'); mb.box(-0.025, 0.04, -0.025, 0.025, 1.4, 0.025, '#2a2a2e'); mb.box(-0.3, 1.38, -0.02, 0.3, 1.42, 0.02, '#2a2a2e');
    for (const x of [-0.28, 0, 0.28]) candle(mb, x, 1.42, 0, x ? 0.18 : 0.26); mb.box(-0.27, 1.3, -0.04, -0.24, 1.38, 0.04, '#e0d8c0'); },
  portrait: (mb, it) => { const c = it.col || '#4a3a2a', y = (it.y0 === undefined ? 1.25 : it.y0) - 1.25; mb.push().tr(0, y, 0); mb.box(-0.6, 1.25, -0.04, 0.6, 2.65, 0.04, '#6a5428'); mb.box(-0.5, 1.35, 0.04, 0.5, 2.55, 0.06, c);
    mb.ico(0, 2.05, 0.07, 0.17, 0.22, 0.03, '#a89070', 0, 0, 2); mb.frus(1.35, 1.8, 0.4, 0.02, 0.22, 0.02, '#2a2226', 0.07); mb.box(-0.6, 1.25, 0.04, 0.6, 1.31, 0.08, '#8a7034'); mb.pop(); },
  chandelier: mb => { mb.box(-0.02, 2.9, -0.02, 0.02, 3.55, 0.02, '#1e1e22'); mb.push().tr(0, 2.85, 0).cyl(0, 0, 0, 0.7, 0.7, 0.06, 10, '#2a2a2e', false).pop();
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; mb.beam([0, 2.95, 0], [Math.cos(a) * 0.68, 2.88, Math.sin(a) * 0.68], 0.03, '#2a2a2e'); if (k % 2 === 0) candle(mb, Math.cos(a) * 0.68, 2.91, Math.sin(a) * 0.68, 0.12); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.3; mb.tri([Math.cos(a) * 0.68, 2.85, Math.sin(a) * 0.68], [Math.cos(a + 0.4) * 0.68, 2.85, Math.sin(a + 0.4) * 0.68], [Math.cos(a + 0.2) * 0.6, 2.4, Math.sin(a + 0.2) * 0.6], MCOB); } },
  cobweb: mb => { const R = mulberry(3); for (let k = 0; k < 5; k++) { const a = k / 5 * HALF; mb.tri([0, 3.4, 0], [Math.cos(a) * 1.3, 3.4 - R() * 0.3, Math.sin(a) * 1.3], [Math.cos(a + 0.3) * 1.1, 2.4 + R() * 0.4, Math.sin(a + 0.3) * 1.1], k % 2 ? MCOB : '#a0a098'); } },
  clock: mb => { mb.box(-0.32, 0, -0.24, 0.32, 2.15, 0.24, MPAL.wood); mb.box(-0.36, 2.15, -0.27, 0.36, 2.3, 0.27, MPAL.wood2); mb.cyl(0, 1.75, 0.24, 0.22, 0.22, 0.02, 10, '#c8bc98'); mb.push().tr(0, 1.75, 0.25).rx(HALF).cyl(0, 0, 0, 0.22, 0.22, 0.02, 10, '#c8bc98').pop();
    mb.box(-0.015, 1.7, 0.27, 0.015, 1.9, 0.28, '#1a1a1a'); mb.box(-0.15, 0.3, 0.24, 0.15, 1.3, 0.25, '#2a2018'); mb.cyl(0, 0.55, 0.25, 0.08, 0.08, 0.02, 8, '#a8884a'); },
  sideboard: (mb, it) => { const w = it.w; mb.box(-w / 2, 0, -0.3, w / 2, 0.95, 0.3, MPAL.wood); mb.box(-w / 2 - 0.04, 0.95, -0.33, w / 2 + 0.04, 1.02, 0.33, MPAL.wood2); for (let x = -w / 2 + 0.35; x < w / 2; x += 0.7) mb.box(x - 0.3, 0.15, 0.3, x + 0.3, 0.85, 0.32, MPAL.wood2);
    for (const x of [-0.8, -0.3, 0.3]) mb.cyl(x, 1.02, 0, 0.14, 0.14, 0.02, 8, '#c8c0b0'); candle(mb, 0.9, 1.02, 0, 0.25); mb.cyl(0.9, 1.02, 0, 0.08, 0.05, 0.05, 6, '#a8884a'); },
  books: mb => { const R = mulberry(17), cols = ['#5a2a24', '#2a3a4a', '#3a4a2a', '#6a5a3a', '#4a2a3a']; for (let k = 0; k < 7; k++) { const x = (R() - 0.5) * 0.9, z = (R() - 0.5) * 0.7, h = k < 4 ? 0 : 0.07 * (k - 3); mb.push().tr(x, h, z).ry(R() * TAU).box(-0.14, 0, -0.1, 0.14, 0.06, 0.1, cols[k % 5]).pop(); } },
  bones: mb => { const b = '#d8d0b8'; mb.ico(0, 0.1, 0, 0.11, 0.1, 0.13, b, 0.05, 0, 3); mb.box(-0.04, 0.05, 0.08, 0.04, 0.08, 0.13, '#2a2420'); mb.beam([0.2, 0.04, -0.1], [0.55, 0.04, 0.15], 0.05, b); mb.beam([-0.15, 0.04, 0.2], [-0.5, 0.04, 0.05], 0.05, b); mb.beam([0.1, 0.04, 0.35], [0.3, 0.04, 0.5], 0.04, b); },
  gstatue: mb => drawStatue(mb)
});
for (const k of ['chair', 'armchair', 'desk', 'globe', 'sarco', 'coffin', 'cryptstairs', 'candles', 'portrait', 'chandelier', 'cobweb', 'clock', 'sideboard', 'books', 'bones', 'gstatue']) if (FURN[k]) FURN[k].draw = FD[k];

// ---------- the house ----------
// a wall along one side (house-local), split around doors and windows, boxes cut at the cutaway heights
function mWall(mb, side, ops, y0, y1, far, R, cuts) {
  const W2 = MAN_W, D2 = MAN_D, fb = side === 'f' || side === 'b', T = 0.36;
  const u0 = fb ? -W2 : -D2 + T, u1 = fb ? W2 : D2 - T, us = [u0, u1];
  for (const o of ops) us.push(clamp(o.c - o.w / 2, u0, u1), clamp(o.c + o.w / 2, u0, u1));
  us.sort((a, b) => a - b);
  for (let i = 0; i < us.length - 1; i++) {
    const a = us[i], b = us[i + 1]; if (b - a < 0.005) continue;
    const m = (a + b) / 2, op = ops.find(o => m > o.c - o.w / 2 && m < o.c + o.w / 2);
    const ivs = op ? [[y0, op.y0], [op.y1, y1]] : [[y0, y1]];
    for (const [ya, yb] of ivs) {
      if (yb - ya < 0.01) continue;
      if (ya < 0.9 && y0 < 0) { bbox(mb, ...sideBox(W2, D2, side, a, b, ya, Math.min(yb, 0.9), -0.08, T), MPAL.st2, cuts); if (yb > 0.9) bbox(mb, ...sideBox(W2, D2, side, a, b, 0.9, yb, 0, T), MPAL.wall, cuts); }
      else bbox(mb, ...sideBox(W2, D2, side, a, b, ya, yb, 0, T), MPAL.wall, cuts);
    }
  }
  if (far) return;
  // stone string course and quoins
  mb.box(...sideBox(W2, D2, side, u0, u1, y1 - 0.22, y1, -0.1, 0.02), MPAL.st3);
  if (fb) for (const u of [u0, u1]) for (let y = Math.max(0, y0) + 0.1; y < y1 - 0.4; y += 0.7) { const k = Math.round(y / 0.7) % 2; mb.box(...sideBox(W2, D2, side, u > 0 ? u - (k ? 0.7 : 0.45) : u, u > 0 ? u : u + (k ? 0.7 : 0.45), y, y + 0.32, -0.05, 0.02), MPAL.st3); }
  // window surrounds, glass (dark, broken, boarded, or candle-lit), sills
  for (const o of ops) {
    if (o.door) continue;
    const a = o.c - o.w / 2, b = o.c + o.w / 2;
    mb.box(...sideBox(W2, D2, side, a - 0.16, b + 0.16, o.y0 - 0.16, o.y0, -0.14, T), MPAL.st3);
    mb.box(...sideBox(W2, D2, side, a - 0.14, a, o.y0, o.y1, -0.07, T), MPAL.st3); mb.box(...sideBox(W2, D2, side, b, b + 0.14, o.y0, o.y1, -0.07, T), MPAL.st3);
    const p0 = sidePt(W2, D2, side, a - 0.14, o.y1, -0.07), p1 = sidePt(W2, D2, side, b + 0.14, o.y1, -0.07), pk = sidePt(W2, D2, side, o.c, o.y1 + 0.42, -0.07);
    mb.tri(p0, p1, pk, MPAL.st3); const q0 = sidePt(W2, D2, side, a - 0.14, o.y1, T), q1 = sidePt(W2, D2, side, b + 0.14, o.y1, T), qk = sidePt(W2, D2, side, o.c, o.y1 + 0.42, T); mb.tri(q0, qk, q1, MPAL.st3);
    mb.quad(p0, pk, qk, q0, MPAL.st3); mb.quad(pk, p1, q1, qk, MPAL.st3);
    if (o.broken) { mb.box(...sideBox(W2, D2, side, a, b, o.y0, o.y1, 0.2, 0.24), '#0c0e12'); for (let k = 0; k < 3; k++) { const u = lerp(a, b, R()), y = lerp(o.y0, o.y1, R()); mb.tri(sidePt(W2, D2, side, a, y, 0.14), sidePt(W2, D2, side, a, y + 0.3, 0.14), sidePt(W2, D2, side, u, y + 0.1, 0.14), MPAL.glass); } }
    else {
      const e = mb.em; if (o.lit) mb.em = 0.6; else mb.em = 0.12;
      mb.box(...sideBox(W2, D2, side, a, b, o.y0, o.y1, 0.12, 0.16), o.lit ? MPAL.lit : MPAL.glass); mb.em = e;
      mb.box(...sideBox(W2, D2, side, o.c - 0.03, o.c + 0.03, o.y0, o.y1, 0.08, 0.12), MPAL.wood2);
      for (const y of [lerp(o.y0, o.y1, 0.33), lerp(o.y0, o.y1, 0.66)]) mb.box(...sideBox(W2, D2, side, a, b, y - 0.025, y + 0.025, 0.08, 0.12), MPAL.wood2);
    }
    if (o.boarded) for (let k = 0; k < 3; k++) { const ya = lerp(o.y0, o.y1, 0.15 + k * 0.33); mb.beam(sidePt(W2, D2, side, a - 0.2, ya + (k % 2 ? 0.15 : -0.1), -0.1), sidePt(W2, D2, side, b + 0.2, ya + (k % 2 ? -0.1 : 0.15), -0.1), 0.1, '#5a4634'); }
  }
}
function mkManorHouseM(m, far) {
  const mb = new MB(501); mb.smooth = false;
  const P = manorPlan(m), R = mulberry(m.seed ^ 0x77), W2 = MAN_W, D2 = MAN_D, H = MAN_H, H2 = MAN_H2, top = H + H2, cuts = [BSTUB, H];
  mb.push().tr(0, 0, MAN_HZ);
  const wins = P.wins, lit = new Set([3, 9]);
  for (const side of ['f', 'b', 'l', 'r']) {
    const ops = wins.filter(w => w.side === side).map((w, i) => Object.assign({}, w, { lit: lit.has(wins.indexOf(w)) && !w.broken && !w.boarded }));
    if (side === 'f') ops.push({ c: 0, w: 2.4, y0: -0.7, y1: 3.0, door: true });
    mWall(mb, side, ops, -0.6, H, far, R, cuts);
    // upper storey with its own windows
    const up = wins.filter(w => w.side === side).map(w => ({ c: w.c, w: 0.9, y0: H + 0.55, y1: H + 2.25, broken: R() < 0.35, boarded: R() < 0.2, lit: false }));
    mWall(mb, side, up, H, top, far, R, []);
  }
  // floor slab between storeys (always above the cut when inside)
  mb.box(-W2 + 0.3, H + 0.04, -D2 + 0.3, W2 - 0.3, H + 0.18, D2 - 0.3, MPAL.wood2);
  // central attic block and three roof masses (gables to the front), chimneys, a hole in the east wing roof
  for (const side of ['f', 'b']) { const z = side === 'f' ? D2 : -D2; mb.box(-5.6, top, z - (side === 'f' ? 0.36 : 0), 5.6, top + 1.5, z + (side === 'f' ? 0 : 0.36), MPAL.wall); }
  for (const sx of [-1, 1]) mb.box(sx * 5.6 - 0.18, top, -D2, sx * 5.6 + 0.18, top + 1.5, D2, MPAL.wall);
  const roofs = [[-10.3, 9.6, top, 3.0], [10.3, 9.6, top, 3.0], [0, 11.6, top + 1.5, 4.2]];
  for (const [cx, w, y, h] of roofs) {
    mb.push().tr(cx, 0, 0).roof(w, 2 * D2, y, h, MPAL.roof, 0.4);
    if (!far) for (let k = 1; k < 4; k++) { const f = k / 4, x = w / 2 * f + 0.2, yy = y + h * (1 - f) + 0.04; for (const sx of [-1, 1]) mb.beam([sx * x, yy, -D2 - 0.4], [sx * x, yy, D2 + 0.4], 0.06, MPAL.roof2); }
    for (const sz of [-1, 1]) { mb.tri([-w / 2, y, sz * D2], [w / 2, y, sz * D2], [0, y + h, sz * D2], MPAL.wall); mb.box(-w / 2 - 0.3, y - 0.05, sz * D2 - 0.12, w / 2 + 0.3, y + 0.12, sz * D2 + 0.12, MPAL.st3); }
    if (!far) { mb.box(-0.45, y + h * 0.3, D2, 0.45, y + h * 0.62, D2 + 0.08, MPAL.st3); const e = mb.em; mb.em = 0.1; mb.box(-0.32, y + h * 0.34, D2 + 0.08, 0.32, y + h * 0.58, D2 + 0.1, MPAL.glass); mb.em = e; }
    mb.pop();
  }
  if (!far) {
    // roof moss and a broken patch with bare rafters
    for (let k = 0; k < 7; k++) { const cx = (R() - 0.5) * 2 * (W2 - 1), z = (R() - 0.5) * 2 * (D2 - 1); const rf = roofs.find(r => Math.abs(cx - r[0]) < r[1] / 2) || roofs[2]; const dx = Math.abs(cx - rf[0]) / (rf[1] / 2); mb.ico(cx, rf[2] + rf[3] * (1 - dx) + 0.05, z, 0.5 + R() * 0.5, 0.06, 0.4 + R() * 0.4, MPAL.moss, 0.25, 0, 50 + k); }
    mb.box(9.2, top + 1.3, -3.2, 11.2, top + 1.42, -0.6, '#0e1014'); for (let k = 0; k < 4; k++) mb.beam([9.0 + k * 0.6, top + 0.5, -3.6], [9.0 + k * 0.6, top + 2.2, -0.2], 0.08, MPAL.wood);
  }
  for (const [x, z, h] of [[-11.5, -2.5, 4.6], [12.4, 2.5, 4.4], [-2.8, -4.5, 6.2], [3.2, 4.0, 6.0]]) { bbox(mb, x - 0.45, top, z - 0.45, x + 0.45, top + h, z + 0.45, MPAL.st, []); mb.box(x - 0.55, top + h, z - 0.55, x + 0.55, top + h + 0.18, z + 0.55, MPAL.st2); if (!far) for (const ox of [-0.18, 0.18]) mb.cyl(x + ox, top + h + 0.18, z, 0.1, 0.09, 0.35, 6, '#7a4a3a'); }
  // corner tower (front-left) with a spire
  { const tx = -13.2, tz = 5.4, w = 1.9, th = top + 4.4;
    bbox(mb, tx - w, -0.6, tz - w, tx + w, th, tz + w, MPAL.st, cuts);
    if (!far) { for (let y = 1.2; y < th - 0.8; y += 2.6) for (const [nx, nz] of [[0, 1], [-1, 0]]) { const e = mb.em; mb.em = 0.1; mb.box(tx + nx * (w + 0.02) - (nz ? 0.18 : 0.02), y, tz + nz * (w + 0.02) - (nx ? 0.18 : 0.02), tx + nx * (w + 0.02) + (nz ? 0.18 : 0.04), y + 0.9, tz + nz * (w + 0.02) + (nx ? 0.18 : 0.04), MPAL.glass); mb.em = e; }
      for (const y of [H, top]) mb.box(tx - w - 0.12, y - 0.2, tz - w - 0.12, tx + w + 0.12, y, tz + w + 0.12, MPAL.st3); }
    mb.box(tx - w - 0.2, th, tz - w - 0.2, tx + w + 0.2, th + 0.25, tz + w + 0.2, MPAL.st3);
    mb.push().tr(tx, th + 0.25, tz).ry(Math.PI / 4).cyl(0, 0, 0, w * 1.55, 0, 5.4, 4, MPAL.roof).pop();
    mb.box(tx - 0.03, th + 5.5, tz - 0.03, tx + 0.03, th + 6.4, tz + 0.03, '#2a2a2e'); mb.box(tx - 0.03, th + 6.0, tz - 0.03, tx + 0.45, th + 6.06, tz + 0.03, '#2a2a2e'); }
  // portico: columns, a pediment, steps; the front door hangs open, one leaf fallen
  { const z0 = D2, z1 = D2 + 2.4;
    mb.box(-3.2, -0.6, z0, 3.2, 0.12, z1 + 0.4, MPAL.st2); mb.box(-2.6, -0.6, z1 + 0.4, 2.6, -0.04, z1 + 1.0, MPAL.st2);
    for (const sx of [-1, 1]) { const x = sx * 2.3, z = D2 + 1.7; mb.box(x - 0.42, 0.12, z - 0.42, x + 0.42, 0.42, z + 0.42, MPAL.st3); mb.cyl(x, 0.42, z, 0.3, 0.26, 3.2, 8, MPAL.st3); mb.box(x - 0.4, 3.62, z - 0.4, x + 0.4, 3.85, z + 0.4, MPAL.st3); }
    mb.box(-3.0, 3.85, z0, 3.0, 4.2, z1 + 0.2, MPAL.st3);
    mb.tri([-3.1, 4.2, z1 + 0.2], [3.1, 4.2, z1 + 0.2], [0, 5.4, z1 + 0.2], MPAL.st); mb.tri([-3.1, 4.2, z0], [0, 5.4, z0], [3.1, 4.2, z0], MPAL.st);
    mb.quad([-3.3, 4.15, z0], [0, 5.5, z0], [0, 5.5, z1 + 0.4], [-3.3, 4.15, z1 + 0.4], MPAL.roof); mb.quad([3.3, 4.15, z0], [0, 5.5, z0], [0, 5.5, z1 + 0.4], [3.3, 4.15, z1 + 0.4], MPAL.roof);
    if (!far) {
      mb.box(-1.5, 3.0, z0 - 0.4, 1.5, 3.4, z0 + 0.1, MPAL.st3); mb.box(-1.4, -0.04, z0 - 0.38, -1.2, 3.0, z0 + 0.08, MPAL.st3); mb.box(1.2, -0.04, z0 - 0.38, 1.4, 3.0, z0 + 0.08, MPAL.st3);
      mb.push().tr(-1.2, 0, z0 - 0.36).ry(-1.2).box(0, 0.05, -0.05, 1.15, 2.9, 0.05, '#3a2a20').pop();
      mb.push().tr(0.6, 0.06, z0 + 1.2).rx(-HALF + 0.06).ry(0.3).box(-0.55, 0, -0.05, 0.55, 2.8, 0.05, '#3a2a20').pop();
    }
  }
  // ivy creeping up the facade
  if (!far) for (let k = 0; k < 9; k++) { const u = (R() - 0.5) * 2 * (W2 - 1), y = 0.4 + R() * 4.5, side = R() < 0.65 ? 'f' : R() < 0.5 ? 'l' : 'r', fb = side === 'f';
    const p = fb ? [u, y, D2 + 0.06] : [side === 'l' ? -W2 - 0.06 : W2 + 0.06, y, (R() - 0.5) * 2 * (D2 - 1)];
    mb.ico(p[0], p[1], p[2], fb ? 0.6 + R() * 0.5 : 0.08, 0.7 + R() * 0.9, fb ? 0.08 : 0.6 + R() * 0.5, R() < 0.5 ? MPAL.ivy : MPAL.moss, 0.25, 0, 70 + k); }
  if (!far) {
    // floors: flagstones in the hall and crypt, dark planks in the wings
    for (let x = -5.4; x < 5.4 - 0.01; x += 1.2) for (let z = -D2 + 0.3; z < D2 - 0.3 - 0.01; z += 1.2) { const c = ((Math.round(x / 1.2) + Math.round(z / 1.2)) & 1) ? MPAL.tile : MPAL.tile2; mb.box(x, -0.3, z, Math.min(5.4, x + 1.2) - 0.03, 0.04, Math.min(D2 - 0.3, z + 1.2) - 0.03, c); }
    for (const [x0, x1] of [[-W2 + 0.3, -5.5], [5.5, W2 - 0.3]]) floorPlanks(mb, x0, -D2 + 0.3, x1, D2 - 0.3, x0 * 7);
    mb.box(-1.2, -0.3, D2 - 0.4, 1.2, 0.04, D2 + 0.1, MPAL.tile);
    // partitions (house-local) with wainscot and a cap; wainscot on the outer walls inside
    for (const [x0, z0, x1, z1] of P.part) {
      const ax = x0 === x1, t = 0.12;
      const b = ax ? [x0 - t, 0, Math.min(z0, z1), x0 + t, MAN_PART, Math.max(z0, z1)] : [Math.min(x0, x1), 0, z0 - t, Math.max(x0, x1), MAN_PART, z0 + t];
      mb.box(...b, '#5e564e'); mb.box(b[0] - 0.03, 0, b[2] - 0.03, b[3] + 0.03, 0.9, b[5] + 0.03, MPAL.wood2); mb.box(b[0] - 0.05, MAN_PART, b[2] - 0.05, b[3] + 0.05, MAN_PART + 0.1, b[5] + 0.05, MPAL.wood);
    }
    for (const side of ['f', 'b', 'l', 'r']) { const fb = side === 'f' || side === 'b'; mb.box(...sideBox(W2, D2, side, fb ? -W2 + 0.36 : -D2 + 0.36, fb ? W2 - 0.36 : D2 - 0.36, 0, 0.95, 0.36, 0.42), MPAL.wood2); }
    drawFurn(mb, P.furn, { stone: MPAL.st, stone2: MPAL.st2 });
  }
  mb.pop();
  return mb;
}
// ---------- the walled garden and the broken gate ----------
function mkManorGardenM(m, far) {
  const mb = new MB(502); mb.smooth = false;
  const P = manorPlan(m), R = mulberry(m.seed ^ 0x99), G = MAN_G;
  for (const w of P.gwalls) {
    const dx = w.x1 - w.x0, dz = w.z1 - w.z0, L = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
    mb.push().tr(w.x0, 0, w.z0).ry(a);
    if (w.h <= 0) { if (!far) for (let k = 0; k < 3; k++) mb.ico((R() - 0.5) * 0.8, 0.12, L * (k + 0.5) / 3, 0.45 + R() * 0.3, 0.25, 0.45 + R() * 0.3, R() < 0.5 ? MPAL.st : MPAL.st2, 0.25, 0, 90 + k); mb.pop(); continue; }
    mb.box(-0.3, -0.5, 0, 0.3, w.h, L, MPAL.st);
    if (!far) {
      mb.box(-0.36, w.h, -0.02, 0.36, w.h + 0.14, L + 0.02, MPAL.st3);
      mb.box(-0.36, -0.5, 0, 0.36, 0.4, L, MPAL.st2);
      if (w.h < 2) for (let k = 0; k < 2; k++) mb.ico((R() - 0.5) * 1.6, 0.15, L * R(), 0.35, 0.2, 0.35, MPAL.st2, 0.25, 0, 95 + k);
      if (R() < 0.5) mb.ico(R() < 0.5 ? -0.32 : 0.32, w.h * 0.5, L * R(), 0.08, w.h * 0.45, 0.6 + R() * 0.6, MPAL.ivy, 0.25, 0, 98);
      if (w.h > 2) mb.box(-0.06, w.h + 0.14, L * 0.5 - 0.02, 0.06, w.h + 0.5, L * 0.5 + 0.02, '#2a2a2e');
    }
    mb.pop();
  }
  // gate pillars with urns, cold lanterns, a hanging leaf and a fallen one
  for (const sx of [-1, 1]) {
    const x = sx * 2.9; mb.box(x - 0.45, -0.5, G - 0.45, x + 0.45, 3.0, G + 0.45, MPAL.st); mb.box(x - 0.55, 3.0, G - 0.55, x + 0.55, 3.2, G + 0.55, MPAL.st3);
    if (!far) { mb.cyl(x, 3.2, G, 0.25, 0.3, 0.4, 7, MPAL.st3); mb.ico(x, 3.75, G, 0.28, 0.2, 0.28, MPAL.st2, 0.1, 0, 4); const e = mb.em; mb.em = 0.9; mb.box(x - 0.1, 2.3, G + 0.47, x + 0.1, 2.6, G + 0.62, '#9ac8ff'); mb.em = e; mb.box(x - 0.13, 2.6, G + 0.45, x + 0.13, 2.66, G + 0.65, '#2a2a2e'); }
  }
  if (!far) {
    const bars = (mb2, w, h) => { mb2.box(0, 0, -0.03, w, 0.08, 0.03, '#26262a'); mb2.box(0, h - 0.4, -0.03, w, h - 0.32, 0.03, '#26262a'); for (let x = 0.1; x < w; x += 0.22) { mb2.box(x - 0.025, 0, -0.025, x + 0.025, h, 0.025, '#26262a'); mb2.cyl(x, h, 0, 0.04, 0, 0.16, 4, '#26262a'); } };
    mb.push().tr(-2.45, 0.05, G).ry(0.9); bars(mb, 2.3, 2.5); mb.pop();
    mb.push().tr(0.4, 0.06, G + 1.4).rz(0.0).rx(-HALF + 0.05).ry(0.25).tr(-1.2, 0, 0); bars(mb, 2.3, 2.5); mb.pop();
  }
  return mb;
}
// ---------- GPU: parts built lazily (one per frame), far silhouette, culling ----------
const MGPU = new Map();
let manorBuildBudget = 0;
function manorGPU(m, near) {
  let G = MGPU.get(m.id);
  if (!G) {
    G = { defs: [{ name: 'house', build: far => mkManorHouseM(m, far) }, { name: 'garden', build: far => mkManorGardenM(m, far) }], parts: [], far: null, ready: false };
    const mb = new MB(503); mb.smooth = false;
    for (const d of G.defs) { const q = d.build(true); for (let i = 0; i < q.d.length; i++) mb.d.push(q.d[i]); }
    G.far = gpuMesh(mb); MGPU.set(m.id, G);
  }
  if (near && !G.ready && manorBuildBudget > 0) {
    manorBuildBudget--;
    const d = G.defs[G.parts.length], mb = d.build(false);
    G.parts.push({ name: d.name, mesh: gpuMesh(mb), b: meshBounds(mb) });
    if (G.parts.length === G.defs.length) G.ready = true;
  }
  return G;
}
function freeFarManors() {
  for (const [id, G] of MGPU) {
    const m = MANC.get(id.slice(1)); if (m && Math.hypot(m.x - CAM.x, m.y - CAM.y) < 380) continue;
    freeMesh(G.far); for (const p of G.parts) freeMesh(p.mesh); MGPU.delete(id);
  }
}
const MANM = m4();
function drawManors(U) {
  if (frameNo % 120 === 60) freeFarManors();
  manorBuildBudget = S.mode === 'loading' ? 99 : 1;
  for (const m of manorsNear(CAM.x, CAM.y, 170)) {
    const d = Math.hypot(m.x - CAM.x, m.y - CAM.y);
    if (!inView(m.x, m.gh + 4, m.y, 42)) { if (d < 110) manorGPU(m, true); continue; }
    const G = manorGPU(m, d < 130);
    m4trs(MANM, m.x, m.gh, m.y, yawOf(m.rot), 0, 0, 1);
    gl.uniformMatrix4fv(U.uModel, false, MANM);
    if (!G.ready || d > 90) { setId(1); gl.bindVertexArray(G.far.vao); gl.drawArrays(gl.TRIANGLES, 0, G.far.n); continue; }
    for (const p of G.parts) {
      const b = p.b, w = [m.x + b[0] * m.s + b[2] * m.c, m.gh + b[1], m.y - b[0] * m.c + b[2] * m.s];
      if (!inView(w[0], w[1], w[2], b[3])) continue;
      setId(1); gl.bindVertexArray(p.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n);
    }
  }
  gl.uniformMatrix4fv(U.uModel, false, UNITM);
}
// moonlight (or dusty daylight) shafts falling through the back and side windows of a manor you are in or near
function buildShafts() {
  const B = FXA, d = S.darkness;
  for (const m of manorsNear(CAM.x, CAM.y, 60)) {
    if (Math.hypot(m.x - CAM.x, m.y - CAM.y) > 55) continue;
    const P = manorPlan(m), inside = S.cut && S.cut.s && S.cut.s.manor === m ? S.cut.k : 0.25;
    const col = d > 0.5 ? [0.62, 0.78, 1.0, 0.11 * inside] : [1.0, 0.92, 0.72, 0.08 * inside];
    const T = xform(...l2w(m, 0, MAN_HZ), m.rot), gy = m.gh;
    for (const w of P.shafts) {
      const n = w.side === 'b' ? [0, 1] : w.side === 'l' ? [1, 0] : [-1, 0], t = [n[1], -n[0]];
      const c = w.side === 'b' ? [w.c, -MAN_D + 0.4] : w.side === 'l' ? [-MAN_W + 0.4, w.c] : [MAN_W - 0.4, w.c];
      const k = 0.72, hw = 0.48 + (w.broken ? 0.1 : 0);
      const P3 = (u, y, along) => { const lx = c[0] + t[0] * u + n[0] * along, lz = c[1] + t[1] * u + n[1] * along, p = l2w(T, lx, lz); return [p[0], gy + y, p[1]]; };
      const a = P3(-hw, w.y1, 0), b = P3(hw, w.y1, 0), cc = P3(hw, 0.06, w.y1 * k), dd = P3(-hw, 0.06, w.y1 * k);
      const a2 = P3(-hw, w.y0, 0), b2 = P3(hw, w.y0, 0), c2 = P3(hw, 0.06, w.y0 * k), d2 = P3(-hw, 0.06, w.y0 * k);
      fxq(B, [...a, 0, 0], [...b, 1, 0], [...cc, 1, 1], [...dd, 0, 1], col, 0, 4);
      fxq(B, [...a2, 0, 0], [...b2, 1, 0], [...c2, 1, 1], [...d2, 0, 1], col, 0, 4);
      fxq(B, [...d2, 0, 0.6], [...c2, 1, 0.6], [...cc, 1, 0.9], [...dd, 0, 0.9], [col[0], col[1], col[2], col[3] * 1.4], 0, 4);
    }
  }
}
