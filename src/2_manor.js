// =====================================================================
//  HAUNTED MANORS — rare deterministic landmarks: a derelict three-wing house
//  in a walled, overgrown garden with graves, dead trees and a broken gate.
//  Pure data (placement, plan, colliders, structures); meshes live in 3_manor.js
// =====================================================================
const MREG = 10 * CS, MANC = new Map();
const MAN_G = 23;                 // garden half-size (wall centre line)
const MAN_HZ = -5;                // house centre (manor-local z)
const MAN_W = 15, MAN_D = 7.5;    // house half extents
const MAN_H = 3.6, MAN_H2 = 3.0;  // ground floor / upper storey wall heights
const MAN_PART = 2.0;             // interior partition height
const MAN_A = ['Thorn', 'Black', 'Hollow', 'Raven', 'Grey', 'Wither', 'Mourn', 'Crow', 'Gall', 'Bleak', 'Shade', 'Rook', 'Briar', 'Ashen', 'Weeping', 'Cinder'];
const MAN_B = ['wood', 'moor', 'hall', 'field', 'gate', 'croft', 'mere', 'combe', 'hurst', 'ley', 'stone', 'cote'];
// one try per 10x10-chunk region; prefers forest, swamp and heath (plains rarely), never snow or sand
function manorFor(rx, ry) {
  const key = rx + ',' + ry;
  if (MANC.has(key)) return MANC.get(key);
  const R = mulberry((Math.imul(rx, 91631) ^ Math.imul(ry, 12919) ^ 0x3a40e) | 0);
  let m = null;
  const want = R();
  for (let tr = 0; tr < 26 && !m && want < 0.66; tr++) {
    const x = rx * MREG + 70 + R() * (MREG - 140), y = ry * MREG + 70 + R() * (MREG - 140), pr = R();
    if (Math.hypot(x, y) < 150) continue;
    const b = biomeAt(x, y);
    if (b === B_SNOW || b === B_DESERT) continue;
    if (b === B_PLAINS && pr > 0.3) continue;
    let ok = true;
    for (let j = -3; j <= 3 && ok; j++) for (let i = -3; i <= 3 && ok; i++) {
      const sx = x + i * 9, sy = y + j * 9, t = tileBase(sx, sy), bb = biomeAt(sx, sy);
      if (isWet(t) || bb === B_SNOW || bb === B_DESERT) ok = false;
    }
    if (!ok) continue;
    const ccx = Math.floor(x / CS), ccy = Math.floor(y / CS);
    for (let j = -4; j <= 4 && ok; j++) for (let i = -4; i <= 4 && ok; i++) { const v = villageFor(ccx + i, ccy + j); if (v && Math.hypot(v.x - x, v.y - y) < 78) ok = false; }
    if (!ok) continue;
    for (const cs of castlesNear(x, y, 160)) if (Math.hypot(cs.x - x, cs.y - y) < 150) ok = false;
    if (!ok) continue;
    const nm = MAN_A[(R() * MAN_A.length) | 0] + MAN_B[(R() * MAN_B.length) | 0];
    const rot = Math.floor(R() * 4) * HALF;
    m = { id: 'M' + key, rx, ry, x, y, b, rot, s: Math.sin(rot), c: Math.cos(rot), seed: (R() * 1e9) | 0, name: nm + ' Manor', short: nm, gh: Math.max(0.3, heightBase(x, y)) };
    m.D = Math.hypot(x, y) / 320;
    m.ckey = Math.floor(l2w(m, 0, MAN_HZ)[0] / CS) + ',' + Math.floor(l2w(m, 0, MAN_HZ)[1] / CS);
  }
  MANC.set(key, m);
  return m;
}
function manorsNear(x, y, rad) {
  const out = [];
  for (let ry = Math.floor((y - rad) / MREG); ry <= Math.floor((y + rad) / MREG); ry++) for (let rx = Math.floor((x - rad) / MREG); rx <= Math.floor((x + rad) / MREG); rx++) {
    const m = manorFor(rx, ry); if (m && Math.abs(m.x - x) < rad + 30 && Math.abs(m.y - y) < rad + 30) out.push(m);
  }
  return out;
}
function nearestManor(x, y, maxR) {
  let best = null, bd = maxR || 1e9;
  for (const m of manorsNear(x, y, maxR || 900)) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } }
  return best;
}
// the manor whose ground (garden + margin) covers (x, y); manors sit >= 70 from region borders
function manorGround(x, y, pad) {
  const m = manorFor(Math.floor(x / MREG), Math.floor(y / MREG));
  if (!m) return null;
  const l = w2l(m, x, y), r = MAN_G + (pad === undefined ? 18 : pad);
  return Math.abs(l[0]) < r && Math.abs(l[1]) < r ? m : null;
}
const inManorGarden = (x, y, pad) => manorGround(x, y, pad || 0);

// ---------- manor furniture colliders (draw functions in 3_manor.js) ----------
Object.assign(FURN, {
  chair: { col: () => [] }, armchair: { col: () => [['circ', 0, 0, 0.42, 0.9]] }, desk: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 0.85]] },
  globe: { col: () => [['circ', 0, 0, 0.35, 1.1]] }, sarco: { col: () => [['box', 0, 0, 0.62, 1.15, 0, 1.0]] }, coffin: { col: () => [['box', 0, 0, 0.36, 0.2, 0, 1.6]] },
  cryptstairs: { col: it => [['box', 0, 0, it.w / 2 + 0.15, it.d / 2 + 0.15, 0, 1.0]] }, candles: { col: () => [] }, portrait: { col: () => [] }, chandelier: { col: () => [] },
  cobweb: { col: () => [] }, clock: { col: () => [['box', 0, 0, 0.32, 0.24, 0, 2.2]] }, sideboard: { col: it => [['box', 0, 0, it.w / 2, 0.3, 0, 1.0]] },
  books: { col: () => [] }, bones: { col: () => [] }, gstatue: { col: () => [['circ', 0, 0, 0.55, 2.4]] }, fountain: { col: () => [['circ', 0, 0, 1.7, 1.0]] }
});

// ---------- plan (manor-local coords; gate at +z). Shared by colliders, meshes and spawns ----------
function manorPlan(m) {
  if (m.P) return m.P;
  const R = mulberry(m.seed ^ 0x51a7), G = MAN_G, hz = z => z + MAN_HZ;
  const P = { gwalls: [], cols: [], parts: [], lights: [], items: [], chests: [], posts: {}, wins: [], shafts: [], house: { x: 0, z: MAN_HZ, hx: MAN_W, hz: MAN_D } };
  // garden wall: ~4-unit pieces, some crumbled low, a few gaps; the gate is a 5-wide opening in the front
  for (const [sd, ax, az, bx, bz] of [['f', -G, G, G, G], ['b', -G, -G, G, -G], ['l', -G, -G, -G, G], ['r', G, -G, G, G]]) {
    const L = Math.hypot(bx - ax, bz - az), n = Math.round(L / 4);
    for (let i = 0; i < n; i++) {
      let u0 = i / n, u1 = (i + 1) / n;
      const x0 = lerp(ax, bx, u0), z0 = lerp(az, bz, u0), x1 = lerp(ax, bx, u1), z1 = lerp(az, bz, u1);
      if (sd === 'f' && Math.max(x0, x1) > -2.6 && Math.min(x0, x1) < 2.6) continue;
      const r = R(); let h = 2.1;
      if (r < 0.1 && i > 0 && i < n - 1) h = 0; else if (r < 0.32) h = 0.6 + R() * 0.8;
      P.gwalls.push({ x0, z0, x1, z1, h, side: sd });
      if (h > 0) P.cols.push(['seg', x0, z0, x1, z1, 0.3, h]);
    }
  }
  // gate pillars
  for (const sx of [-1, 1]) P.cols.push(['box', sx * 2.9, G, 0.45, 0.45, 0, 3.2]);
  // house shell: outer walls (capsules split at the front door), interior partitions with wide doorways
  const W = MAN_W, D = MAN_D, t = 0.18;
  const segs = [[-W + t, D - t, -1.3, D - t], [1.3, D - t, W - t, D - t], [-W + t, -D + t, W - t, -D + t], [-W + t, -D + t, -W + t, D - t], [W - t, -D + t, W - t, D - t]];
  for (const s of segs) P.cols.push(['seg', s[0], hz(s[1]), s[2], hz(s[3]), t, MAN_H + 1.4]);
  // partitions: x = -5.5 and +5.5 (doorways at house z 3.0..5.4), z = -1 between hall and crypt (doorway x -1.3..1.3)
  for (const sx of [-1, 1]) { const x = sx * 5.5; P.cols.push(['seg', x, hz(-D + t), x, hz(2.9), 0.12, MAN_PART], ['seg', x, hz(5.5), x, hz(D - t), 0.12, MAN_PART]); }
  P.cols.push(['seg', -5.5, hz(-1), -1.35, hz(-1), 0.12, MAN_PART], ['seg', 1.35, hz(-1), 5.5, hz(-1), 0.12, MAN_PART]);
  P.part =[[-5.5, -D + t, -5.5, 2.9], [-5.5, 5.5, -5.5, D - t], [5.5, -D + t, 5.5, 2.9], [5.5, 5.5, 5.5, D - t], [-5.5, -1, -1.35, -1], [1.35, -1, 5.5, -1]];
  // porch columns
  for (const sx of [-1, 1]) P.cols.push(['circ', sx * 2.3, hz(D + 1.7), 0.32, 4]);
  // windows (house-local side, centre) — front, back, sides; used by meshes and for moonlight shafts
  P.wins = [{ side: 'f', c: -3.4 }, { side: 'f', c: 3.4 }, { side: 'f', c: -8.2 }, { side: 'f', c: -12.4 }, { side: 'f', c: 8.2 }, { side: 'f', c: 12.4 },
    { side: 'b', c: -12.4 }, { side: 'b', c: -8.2 }, { side: 'b', c: -2.8 }, { side: 'b', c: 2.8 }, { side: 'b', c: 8.2 }, { side: 'b', c: 12.4 },
    { side: 'l', c: -3.2 }, { side: 'l', c: 3.2 }, { side: 'r', c: -3.2 }, { side: 'r', c: 3.2 }];
  for (const w of P.wins) { w.w = 1.0; w.y0 = 1.0; w.y1 = 2.85; w.broken = R() < 0.4; w.boarded = !w.broken && R() < 0.3; }
  // furniture (house-local): hall, crypt (with the stairs down), dining room (west wing), library (east wing)
  const F = [];
  // hall
  F.push({ f: 'carpet', x: 0, z: 3.2, w: 2.2, d: 7.6, col: '#4a2226' }, { f: 'stairs', x: 3.6, z: -0.42, w: 3.4, d: 0.95, dir: 1 }, { f: 'chandelier', x: 0, z: 3.2 },
    { f: 'clock', x: -5.0, z: 6.7, r: Math.PI }, { f: 'astand', x: 4.2, z: 6.9 }, { f: 'candles', x: -4.6, z: 0.3 }, { f: 'candles', x: 4.6, z: 2.4 },
    { f: 'portrait', x: -5.38, z: 1.3, r: HALF, col: '#5a3a2a', y0: 0.55 }, { f: 'portrait', x: 5.38, z: 6.5, r: -HALF, col: '#3a3a4a', y0: 0.55 }, { f: 'gstatue', x: -3.6, z: 1.0 },
    { f: 'cobweb', x: -5.3, z: 7.3, r: HALF }, { f: 'cobweb', x: 5.3, z: -0.8, r: -HALF }, { f: 'chair', x: 2.4, z: 6.2, r: 2.6, broken: 1 }, { f: 'books', x: -2.6, z: 5.8 });
  // crypt
  F.push({ f: 'cryptstairs', x: 0, z: -5.0, w: 3.0, d: 3.0 }, { f: 'sarco', x: -3.5, z: -4.2 }, { f: 'sarco', x: 3.5, z: -4.2 }, { f: 'coffin', x: -5.05, z: -2.2, r: HALF }, { f: 'coffin', x: 5.05, z: -2.4, r: -HALF },
    { f: 'candles', x: -2.0, z: -7.0 }, { f: 'candles', x: 2.0, z: -7.0 }, { f: 'bones', x: 1.8, z: -2.2 }, { f: 'bones', x: -2.4, z: -2.6 }, { f: 'cobweb', x: -5.3, z: -7.3, r: 0 }, { f: 'cobweb', x: 5.3, z: -7.3, r: -HALF });
  // dining
  F.push({ f: 'rug', x: -10.2, z: 0, w: 4.2, d: 9.4, col: '#3a2a3a' }, { f: 'longtable', x: -10.2, z: 0, w: 1.5, d: 7.0 }, { f: 'sideboard', x: -14.55, z: -2.5, r: HALF, w: 2.8 },
    { f: 'portrait', x: -14.82, z: 3.0, r: HALF, col: '#4a2a2a' }, { f: 'portrait', x: -10.2, z: -7.32, col: '#2a3a2a' }, { f: 'clock', x: -14.5, z: 5.8, r: HALF }, { f: 'chandelier', x: -10.2, z: 0 },
    { f: 'cobweb', x: -14.8, z: -7.3, r: 0 }, { f: 'cobweb', x: -6.0, z: 7.2, r: Math.PI });
  for (const z of [-2.6, -0.9, 0.8, 2.5]) for (const sx of [-1, 1]) F.push({ f: 'chair', x: -10.2 + sx * 1.15, z, r: sx > 0 ? -HALF : HALF, broken: R() < 0.2 ? 1 : 0 });
  F.push({ f: 'chair', x: -10.2, z: 4.2, r: Math.PI }, { f: 'chair', x: -10.2, z: -4.2 });
  // library
  F.push({ f: 'rug', x: 10.3, z: 1.5, w: 5.0, d: 5.0, col: '#2a3a4a' }, { f: 'shelf', x: 8.0, z: -7.1, w: 3.0 }, { f: 'shelf', x: 11.6, z: -7.1, w: 3.0 }, { f: 'shelf', x: 14.62, z: -3.2, w: 3.2, r: -HALF }, { f: 'shelf', x: 14.62, z: 1.2, w: 3.2, r: -HALF },
    { f: 'shelf', x: 6.1, z: -4.4, w: 2.6, r: HALF }, { f: 'desk', x: 10.2, z: 0.8, w: 2.0, d: 1.0 }, { f: 'armchair', x: 8.0, z: 4.6, r: 0.5 }, { f: 'armchair', x: 12.2, z: 4.9, r: -0.6 }, { f: 'globe', x: 13.6, z: 6.2 },
    { f: 'books', x: 9.0, z: -2.0 }, { f: 'books', x: 12.6, z: 2.8 }, { f: 'candles', x: 14.2, z: 6.6 }, { f: 'cobweb', x: 14.8, z: 7.3, r: Math.PI }, { f: 'cobweb', x: 6.0, z: -7.3, r: 0 });
  P.furn = F;
  for (const c of furnCols(F)) { const q = c.slice(); q[2] = hz(q[2]); P.cols.push(q); }
  // garden: graves, tombs, dead trees, a statue, a dry fountain (manor-local, outside the house)
  const graves = [];
  for (let k = 0; k < 26; k++) {
    let x = (R() * 2 - 1) * (G - 3), z = (R() * 2 - 1) * (G - 3);
    if (Math.abs(x) < MAN_W + 1.5 && z > MAN_HZ - MAN_D - 1.5 && z < MAN_HZ + MAN_D + 3.5) continue; // the house + porch
    if (Math.abs(x) < 3.2 && z > 0) continue; // the path
    if (Math.hypot(x, z - 13) < 3.4) continue; // the fountain
    if (graves.some(g => Math.hypot(g[0] - x, g[1] - z) < 2.2)) continue;
    graves.push([x, z]);
    const r = R(); P.items.push({ type: r < 0.5 ? 'grave' : r < 0.78 ? 'grave2' : 'tomb', x, z, rot: (R() - 0.5) * 0.5 + (R() < 0.15 ? 0.4 : 0) });
  }
  for (const [x, z] of [[-17, 14], [16, 17], [-18, -17], [18, -12], [-9, 19], [11, 8.5]]) P.items.push({ type: 'deadtree', x: x + (R() - 0.5) * 2, z: z + (R() - 0.5) * 2 });
  P.items.push({ type: 'gstatue', x: -7, z: 13 }, { type: 'gstatue', x: 7, z: 13 });
  P.items.push({ type: 'fountain', x: 0, z: 13 });
  // spawn posts (manor-local): inside rooms and in the garden
  P.posts = { hall: [[0, hz(4.0)], [-2.5, hz(1.5)]], dining: [[-10.2, hz(4.6)], [-12.5, hz(-3.5)]], library: [[10.2, hz(3.4)], [8.5, hz(-3.0)]], crypt: [[0, hz(-2.6)]],
    garden: [[-12, 12], [12, 15], [-15, -16], [15, -18], [0, 18], [-6, -18]] };
  // treasure: crypt and library
  P.chests = [{ x: -4.7, z: hz(-6.85), id: m.id + ':c0', tier: clamp(Math.floor(m.D + 0.9), 0, 4) }, { x: 4.7, z: hz(-6.85), id: m.id + ':c1', tier: clamp(Math.floor(m.D + 0.6), 0, 4) }, { x: 13.8, z: hz(-5.6), id: m.id + ':c2', tier: clamp(Math.floor(m.D + 0.4), 0, 4) }];
  // candle light (house-local -> manor-local), always on inside; a cold lantern at the gate
  for (const [x, z, k] of [[-4.6, 0.3, 0.5], [4.6, 2.4, 0.5], [-2, -7, 0.55], [2, -7, 0.55], [-10.2, -1.8, 0.5], [-10.2, 1.8, 0.5], [10.2, 0.8, 0.55], [14.2, 6.6, 0.4]])
    P.lights.push([x, hz(z), 1.4, 7.5, [1.0, 0.6, 0.28], k * 1.35, 'house']);
  P.lights.push([2.9, G + 0.6, 3.0, 6, [0.55, 0.75, 1.0], 0.45, null], [-2.9, G + 0.6, 3.0, 6, [0.55, 0.75, 1.0], 0.45, null]);
  // moonlight shafts through the back and side windows (house-local window, inward direction)
  for (const w of P.wins) if (w.side !== 'f') P.shafts.push(w);
  m.P = P;
  return P;
}
// world-space parts / structures / lights of a manor, built once and cached
function manorWorld(m) {
  if (m.Wd) return m.Wd;
  const P = manorPlan(m), Wd = { parts: [], structs: [], lights: [], npcs: [] };
  collidersTo(m, P.cols, Wd.parts);
  for (const it of P.items) {
    const p = l2w(m, it.x, it.z), base = { x: p[0], y: p[1], rot: m.rot + (it.rot || 0), block: true };
    if (it.type === 'deadtree') Wd.parts.push(Object.assign(base, { type: 'deadtree', r: 0.5, h: 4, rot: undefined }));
    else if (it.type === 'gstatue') Wd.parts.push(Object.assign(base, { type: 'gstatue', r: 0.6, h: 2.6 }));
    else if (it.type === 'fountain') Wd.parts.push(Object.assign(base, { type: 'fountain', r: 1.8, h: 1.0 }));
    else Wd.parts.push(Object.assign(base, { type: it.type, r: it.type === 'tomb' ? 0.75 : 0.36, h: it.type === 'tomb' ? 0.9 : 1.1 }));
  }
  for (const c of P.chests) { const p = l2w(m, c.x, c.z); Wd.parts.push({ type: 'chest', x: p[0], y: p[1], r: 0.6, h: 0.8, block: true, id: c.id, tier: c.tier, rot: m.rot + Math.PI }); }
  const hc = l2w(m, 0, MAN_HZ);
  const house = mkStruct(xform(hc[0], hc[1], m.rot), { kind: 'manor', hx: MAN_W, hz: MAN_D, stub: BSTUB, wallH: MAN_H, margin: 3.4, band: 0.75, skipOcc: 1, roof: true, name: m.name, manor: m,
    doors: [{ side: 'f', c: 0, w: 2.4, dep: 1.6 }] });
  house.gy = m.gh;
  Wd.structs.push(house); Wd.house = house;
  for (const l of P.lights) { const p = l2w(m, l[0], l[1]); const li = { x: p[0], y: p[1], h: l[2], r: l[3], c: l[4], k: l[5], s: l[6] ? house : null, night: true, gy: m.gh, flick: true, base: l[6] ? 0.06 : 0 }; Wd.lights.push(li); if (li.s) house.lights.push(li); }
  m.Wd = Wd;
  return Wd;
}
// manor ground: overgrown garden, a gravel path to the door, a lane from the gate; no water inside the walls
function manorTile(m, wx, wy, t) {
  const l = w2l(m, wx, wy), ax = Math.abs(l[0]), az = Math.abs(l[1]);
  if (ax < MAN_G + 0.8 && az < MAN_G + 0.8) {
    if (ax < MAN_W + 0.6 && l[1] > MAN_HZ - MAN_D - 0.6 && l[1] < MAN_HZ + MAN_D + 2.6) return T_DIRT;
    if (ax < 1.5 && l[1] > 0) return T_DIRT;
    if (Math.hypot(l[0], l[1] - 13) < 3.2) return T_DIRT;
    return hash2(Math.floor(wx * 0.5), Math.floor(wy * 0.5)) < 0.22 ? T_MUD : T_TALL;
  }
  if (ax < 1.3 + Math.max(0, l[1] - MAN_G) * 0.015 && l[1] > 0 && l[1] < MAN_G + 34 && !isWet(t)) return T_DIRT;
  if (ax < MAN_G + 5 && az < MAN_G + 5 && isWet(t)) return T_MUD;
  return t;
}
