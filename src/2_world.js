// =====================================================================
//  WORLD — infinite chunked terrain, biomes, villages, statics
// =====================================================================
const B_PLAINS = 0, B_FOREST = 1, B_SNOW = 2, B_SWAMP = 3, B_HEATH = 4, B_DESERT = 5;
const BIOME_NAMES = ['the Green Vales', 'the Old Forest', 'the Frostlands', 'the Mirefen Swamps', 'the Grimmoor Heath', 'the Southern Sands'];

function climate(x, y) {
  const d = Math.hypot(x, y), w = smooth(clamp((d - 40) / 70, 0, 1));
  let t = 0.56 + y / 900 + (fbm(x * 0.0022 + 11, y * 0.0022 + 7) - 0.5) * 0.75 + (vnoise(x * 0.06, y * 0.06) - 0.5) * 0.05;
  let m = fbm(x * 0.0028 + 101, y * 0.0028 + 57) + (vnoise(x * 0.07 + 5, y * 0.07) - 0.5) * 0.05;
  return [lerp(0.5, t, w), lerp(0.55, m, w)];
}
function biomeAt(x, y) {
  const c = climate(x, y), t = c[0], m = c[1];
  if (t < 0.22) return B_SNOW;
  if (t > 0.82) return m < 0.56 ? B_DESERT : B_SWAMP;
  if (m > 0.63) return t > 0.68 ? B_SWAMP : B_FOREST;
  if (m < 0.48) return B_HEATH;
  return B_PLAINS;
}

// tiles
const T_GRASS = 0, T_TALL = 1, T_WATER = 2, T_DIRT = 3, T_WHEAT = 4, T_SNOW = 5, T_DRIFT = 6, T_ICE = 7, T_SAND = 8, T_DUNE = 9,
  T_MUD = 10, T_MARSH = 11, T_BOG = 12, T_HEATHER = 13, T_ROCKY = 14, T_FLOOR = 15, NT = 16;
// fg, bg, chars [near, mid, far], foot speed, horse speed
const TDEF = [
  ['#58a046', '#14361a', ["'\",.;' ", "',. ", ".  "], 1, 1],
  ['#70b44e', '#18381a', ["\"';,'.\" ", "\"', ", "'.  "], 1, 1],
  ['#70b0f0', '#0e3256', null, 0.5, 0.68],
  ['#b09070', '#30261a', [".,:'", ".,", ".  "], 1, 1],
  ['#e8c858', '#3a3414', ["\"|'\"", "\"'", "'. "], 0.9, 0.95],
  ['#f4f8ff', '#9aa8bc', [".'*,  ", ". ", ".  "], 0.92, 0.95],
  ['#ffffff', '#aab6c8', ["~-^.", "-.", ". "], 0.72, 0.85],
  ['#d0f4ff', '#5a88ae', ["-_ =", "- ", "  "], 1, 1],
  ['#f0dca0', '#8e7446', [".,'` ", ".,", ". "], 0.93, 0.96],
  ['#f6e4b0', '#a08452', ["~-'.", "~.", ". "], 0.8, 0.88],
  ['#8a8a5a', '#2a2a18', [",.;'", ",.", ". "], 0.85, 0.9],
  ['#8aa850', '#26301a', ["\"|v,", "\"'", ". "], 0.85, 0.9],
  ['#6a9a6a', '#14261a', null, 0.45, 0.62],
  ['#b874c8', '#2e2030', ["*\"',;", "\"'.", ". "], 1, 1],
  ['#a09a8e', '#2e2c28', [".o,:'", ".,", ". "], 0.95, 0.97],
  ['#4a8a3a', '#10281a', [",'.;`", ",.", ". "], 1, 1]
];

function tileBase(x, y) {
  const b = biomeAt(x, y);
  const lake = fbm(x * 0.011 + 300, y * 0.011 + 300);
  const n = fbm(x * 0.07 + 31, y * 0.07 + 17);
  switch (b) {
    case B_SNOW: if (lake > 0.7) return T_ICE; return n > 0.6 ? T_DRIFT : T_SNOW;
    case B_DESERT: if (lake > 0.8) return T_WATER; return n > 0.55 ? T_DUNE : T_SAND;
    case B_SWAMP: if (lake > 0.57) return T_BOG; return n > 0.55 ? T_MARSH : T_MUD;
    case B_HEATH: if (lake > 0.76) return T_WATER; return n > 0.5 ? T_HEATHER : T_ROCKY;
    case B_FOREST: if (lake > 0.74) return T_WATER; return n > 0.62 ? T_TALL : T_FLOOR;
    default: if (lake > 0.73) return T_WATER; return n > 0.6 ? T_TALL : T_GRASS;
  }
}
const isWet = t => t === T_WATER || t === T_BOG || t === T_ICE;

// ---------- villages ----------
const VIL_A = ['Ash', 'Wyn', 'Thorn', 'Mar', 'Elder', 'Brack', 'Cold', 'Raven', 'Stone', 'Wolf', 'Oak', 'Mill', 'Fen', 'Black', 'Grey', 'Holly', 'Kings', 'Lang', 'Frost', 'Sand', 'Red', 'Bram'];
const VIL_B = ['ford', 'mere', 'by', 'wick', 'ham', 'stead', 'ton', 'dale', 'holm', 'bury', 'field', 'gate', 'well', 'moor', 'cross', 'haven'];
const VILC = new Map();
const CS = 32;
function villageFor(cx, cy) {
  const k = cx + ',' + cy;
  if (VILC.has(k)) return VILC.get(k);
  let v = null;
  const R = mulberry((Math.imul(cx, 91815541) ^ Math.imul(cy, 26544357) ^ 0x51ed) | 0);
  const roll = R(), ox = cx * CS, oy = cy * CS;
  if (cx === 0 && cy === 0) v = { x: 16, y: 16 };
  else if ((cx & 1) === 0 && (cy & 1) === 0) {
    const bx = ox + 11 + R() * 10, by = oy + 11 + R() * 10;
    const b = biomeAt(bx, by);
    if (Math.hypot(bx, by) > 120 && b !== B_SWAMP && roll < (b === B_DESERT ? 0.14 : 0.22) && !isWet(tileBase(bx, by))) v = { x: bx, y: by };
  }
  if (v) {
    v.b = biomeAt(v.x, v.y);
    v.farm = (v.b === B_PLAINS || v.b === B_FOREST) && R() < 0.75;
    v.farmA = R() * TAU;
    v.name = (cx === 0 && cy === 0) ? 'Ashford' : VIL_A[(R() * VIL_A.length) | 0] + VIL_B[(R() * VIL_B.length) | 0];
    v.id = k; v.cx = cx; v.cy = cy;
    v.nh = 4 + ((R() * 3) | 0);
    v.gap = (cx === 0 && cy === 0) ? -Math.PI / 2 : R() * TAU;
    v.seed = (R() * 1e9) | 0;
    v.tier = clamp(Math.floor(Math.hypot(v.x, v.y) / 320 + R() * 0.8), 0, 4);
  }
  VILC.set(k, v);
  return v;
}
function nearVillage(x, y, rad) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS);
  let best = null, bd = rad;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const v = villageFor(cx + i, cy + j); if (!v) continue;
    const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; }
  }
  return best;
}

// ---------- statics ----------
const SDEF = {
  pine: { r: 0.7, h: 5 }, snowpine: { r: 0.7, h: 5 }, oak: { r: 1.0, h: 4.2 }, deadtree: { r: 0.5, h: 4 }, rock: { r: 0.6, h: 0.9 },
  menhir: { r: 0.7, h: 3 }, palm: { r: 0.5, h: 5 }, bush: { r: 0.5, h: 1, block: false }, fire: { r: 0.6, h: 1.0 },
  well: { r: 0.9, h: 1.6 }, ruin: { r: 4.2, h: 7 }, chest: { r: 0.6, h: 0.8 },
  col: { r: 1, h: 3 }, bld: { r: 4, h: 5, block: false }, fence: { r: 1.6, h: 1.0 }, lamp: { r: 0.2, h: 2.7 }, barrel: { r: 0.38, h: 0.9 }, crate: { r: 0.38, h: 0.8 },
  birch: { r: 0.45, h: 5 }, willow: { r: 0.8, h: 4.5 }, log: { r: 0.55, h: 0.6 }, stump: { r: 0.42, h: 0.6 }, bigrock: { r: 1.3, h: 1.6 }
};
const GC = 8, MAXR = 4.6;
let STAMP = 1;
const CHUNKS = new Map();
let lastChunk = null;

function addStaticTo(c, type, x, y, extra) {
  const d = SDEF[type];
  const o = { type, x, y, r: d.r, h: d.h, block: d.block !== false, _s: 0 };
  if (extra) Object.assign(o, extra);
  c.statics.push(o);
  const lx = clamp(Math.floor((x - c.cx * CS) / GC), 0, 3), ly = clamp(Math.floor((y - c.cy * CS) / GC), 0, 3);
  c.grid[ly * 4 + lx].push(o);
  return o;
}
function localNear(c, x, y, rad) {
  for (const o of c.statics) { const dx = o.x - x, dy = o.y - y, rs = rad + o.r; if (dx * dx + dy * dy < rs * rs) return true; }
  return false;
}

function genChunk(cx, cy) {
  const R = mulberry((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ 0x1700) | 0);
  const c = { cx, cy, key: cx + ',' + cy, tiles: new Uint8Array(CS * CS), statics: [], grid: [], village: null, biome: 0, structs: [], lights: [] };
  for (let i = 0; i < 16; i++) c.grid.push([]);
  const ox = cx * CS, oy = cy * CS;
  c.biome = biomeAt(ox + 16, oy + 16);
  const vils = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const v = villageFor(cx + i, cy + j); if (v) vils.push(v); }
  const own = villageFor(cx, cy); c.village = own;
  const lays = vils.map(v => villageLayout(v));
  const cass = castlesNear(ox + 16, oy + 16, 16 + CAS_S + 50);
  const mans = manorsNear(ox + 16, oy + 16, 16 + MAN_G + 45);
  const roads = roadsNear(ox - 3, oy - 3, ox + CS + 3, oy + CS + 3);
  for (let ty = 0; ty < CS; ty++) for (let tx = 0; tx < CS; tx++) {
    const wx = ox + tx + 0.5, wy = oy + ty + 0.5;
    let t = tileBase(wx, wy);
    if (roads.length && !isWet(t)) for (const r of roads) if (onRoad(r, wx, wy)) { t = T_DIRT; break; }
    for (let k = 0; k < vils.length; k++) t = villageTile(vils[k], lays[k], wx, wy, t);
    for (const cs of cass) t = castleTile(cs, wx, wy, t);
    for (const m of mans) t = manorTile(m, wx, wy, t);
    c.tiles[ty * CS + tx] = t;
  }
  const tileL = (x, y) => c.tiles[(clamp(Math.floor(y - oy), 0, 31)) * CS + clamp(Math.floor(x - ox), 0, 31)];
  const nearVil = (x, y, rad) => vils.some(v => Math.hypot(v.x - x, v.y - y) < rad);
  const nearCas = (x, y, pad) => cass.some(cs => { const l = w2l(cs, x, y); return Math.abs(l[0]) < CAS_S + pad && Math.abs(l[1]) < CAS_S + pad + (l[1] > 0 && Math.abs(l[0]) < 4 ? 40 : 0); });

  // village structures (buildings of neighbouring villages reach into this chunk too)
  for (const L of lays) injectLayout(c, L);
  if (own) c.spawnVillage = own;
  // castles
  for (const cs of cass) { injectLayout(c, castleWorld(cs)); if (cs.ckey === c.key) c.castle = cs; }
  for (const m of mans) { injectLayout(c, manorWorld(m)); if (m.ckey === c.key) c.manor = m; }
  const nearMan = (x, y, pad) => mans.some(m => { const l = w2l(m, x, y); return Math.abs(l[0]) < MAN_G + pad && Math.abs(l[1]) < MAN_G + pad + (l[1] > 0 && Math.abs(l[0]) < 3 ? 34 : 0); });
  // ruins + chest
  if (!own && !nearVil(ox + 16, oy + 16, 40) && !nearCas(ox + 16, oy + 16, 30) && !nearMan(ox + 16, oy + 16, 24) && R() < 0.06 && (c.biome === B_HEATH || c.biome === B_FOREST || c.biome === B_SNOW || c.biome === B_DESERT || c.biome === B_PLAINS)) {
    const rx = ox + 8 + R() * 16, ry = oy + 8 + R() * 14;
    if (!isWet(tileL(rx, ry))) {
      addStaticTo(c, 'ruin', rx, ry);
      const id = c.key + ':c';
      addStaticTo(c, 'chest', rx + R() * 2 - 1, ry + 5.2, { id, tier: clamp(Math.floor(Math.hypot(rx, ry) / 300 + 0.5), 0, 4) });
    }
  }
  // vegetation & rocks
  const B = c.biome;
  const plan = {
    [B_PLAINS]: { n: 30, th: 0.58, list: [['oak', 0.42], ['birch', 0.16], ['pine', 0.1], ['bush', 0.24], ['stump', 0.04], ['log', 0.04]], rocks: 4 },
    [B_FOREST]: { n: 120, th: 0.36, list: [['pine', 0.48], ['oak', 0.3], ['birch', 0.1], ['bush', 0.06], ['log', 0.03], ['stump', 0.03]], rocks: 3 },
    [B_SNOW]: { n: 58, th: 0.48, list: [['snowpine', 0.84], ['deadtree', 0.08], ['log', 0.04], ['stump', 0.04]], rocks: 6 },
    [B_SWAMP]: { n: 46, th: 0.4, list: [['deadtree', 0.4], ['willow', 0.22], ['bush', 0.24], ['stump', 0.08], ['log', 0.06]], rocks: 1 },
    [B_HEATH]: { n: 13, th: 0.45, list: [['deadtree', 0.34], ['bush', 0.36], ['menhir', 0.16], ['stump', 0.06], ['birch', 0.08]], rocks: 10 },
    [B_DESERT]: { n: 5, th: 0.4, list: [['palm', 0.4], ['deadtree', 0.3], ['bush', 0.3]], rocks: 5 }
  }[B];
  for (let i = 0; i < plan.n * 2; i++) {
    const x = ox + R() * CS, y = oy + R() * CS;
    if (fbm(x * 0.04 + 50, y * 0.04 + 50) < plan.th) continue;
    const t = tileL(x, y);
    if (isWet(t) || t === T_DIRT || t === T_WHEAT) continue;
    if (nearVil(x, y, 31) || nearCas(x, y, 7) || nearMan(x, y, 3)) continue;
    if (Math.hypot(x - 16, y + 2) < 8 || (Math.abs(x - 16) < 3 && y < 4 && y > -30)) continue; // keep the starting road clear
    if (localNear(c, x, y, 1.6)) continue;
    let roll = R(), type = plan.list[0][0];
    for (const [tp, w] of plan.list) { if (roll < w) { type = tp; break; } roll -= w; }
    // trees follow the ground they stand on at biome borders
    if (t === T_SNOW || t === T_DRIFT) { if (type === 'pine' || type === 'oak') type = 'snowpine'; else if (type === 'bush' || type === 'palm') type = 'deadtree'; }
    else if (type === 'snowpine') type = 'pine';
    if ((t === T_SAND || t === T_DUNE) && (type === 'pine' || type === 'oak' || type === 'snowpine' || type === 'birch' || type === 'willow')) type = 'palm';
    if ((t === T_SNOW || t === T_DRIFT) && (type === 'birch' || type === 'willow')) type = 'snowpine';
    addStaticTo(c, type, x, y, type === 'log' ? { rot: R() * TAU, snow: t === T_SNOW || t === T_DRIFT ? 1 : 0 } : null);
  }
  for (let i = 0; i < plan.rocks; i++) {
    const x = ox + R() * CS, y = oy + R() * CS;
    const t = tileL(x, y);
    if (isWet(t) || t === T_DIRT || nearVil(x, y, 31) || nearCas(x, y, 7) || nearMan(x, y, 3) || localNear(c, x, y, 1.5) || Math.hypot(x - 16, y) < 10) continue;
    addStaticTo(c, i % 4 === 3 && B !== B_DESERT ? 'bigrock' : 'rock', x, y, (t === T_SNOW || t === T_DRIFT) ? { snow: 1 } : (t === T_SAND || t === T_DUNE) ? { sand: 1 } : null);
  }
  return c;
}

function getChunk(cx, cy) {
  const k = cx + ',' + cy;
  let c = CHUNKS.get(k);
  if (!c) { c = genChunk(cx, cy); CHUNKS.set(k, c); onChunkCreated(c); }
  return c;
}
function tileAt(x, y) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS);
  let c = lastChunk;
  if (!c || c.cx !== cx || c.cy !== cy) { c = getChunk(cx, cy); lastChunk = c; }
  return c.tiles[((Math.floor(y) - cy * CS) << 5) + (Math.floor(x) - cx * CS)];
}
function forStatics(x, y, rad, cb) {
  const R2 = rad + MAXR, st = ++STAMP;
  const gx0 = Math.floor((x - R2) / GC), gx1 = Math.floor((x + R2) / GC), gy0 = Math.floor((y - R2) / GC), gy1 = Math.floor((y + R2) / GC);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const cx = Math.floor(gx / 4), cy = Math.floor(gy / 4);
    const c = CHUNKS.get(cx + ',' + cy); if (!c) continue;
    const cell = c.grid[(gy - cy * 4) * 4 + (gx - cx * 4)];
    for (let i = 0; i < cell.length; i++) { const o = cell[i]; if (o._s === st) continue; o._s = st; if (cb(o)) return true; }
  }
  return false;
}
function blockedAt(x, y, r) {
  return forStatics(x, y, r, o => o.block && hitCol(o, x, y, r));
}
// push e out of every blocking static; (px, py) = its position before this step, so fast movers can't tunnel through walls
function collide(e, r, px, py) {
  let hit = false;
  forStatics(e.x, e.y, r, o => { if (o.block && pushCol(e, o, r, px, py)) hit = true; return false; });
  return hit;
}
function findFree(x, y, r, spread) {
  for (let i = 0; i < 14; i++) {
    const tx = x + (i ? rr(-spread, spread) : 0), ty = y + (i ? rr(-spread, spread) : 0);
    const t = tileAt(tx, ty);
    if (!blockedAt(tx, ty, r + 0.2) && t !== T_WATER && t !== T_BOG) return [tx, ty];
  }
  return [x, y];
}
function manageChunks(budget) {
  const pcx = Math.floor(P.x / CS), pcy = Math.floor(P.y / CS);
  let made = 0;
  for (let ring = 0; ring <= 3 && made < budget; ring++) {
    for (let j = -ring; j <= ring && made < budget; j++) for (let i = -ring; i <= ring && made < budget; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
      if (!CHUNKS.has((pcx + i) + ',' + (pcy + j))) { getChunk(pcx + i, pcy + j); made++; }
    }
  }
  if (CHUNKS.size > 90) {
    for (const [k, c] of CHUNKS) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cy - pcy)) > 4) { onChunkRemoved(c); CHUNKS.delete(k); if (lastChunk === c) lastChunk = null; }
    }
  }
}

// village ground: a dirt square, paths to every door, the road out through the gap, fields
function villageTile(v, L, wx, wy, t) {
  const d = Math.hypot(wx - v.x, wy - v.y);
  if (d > 50) return t;
  if (d < 9.5) return T_DIRT;
  for (const s of L.structs) if (structContains(s, wx, wy)) return T_DIRT;
  for (const p of L.paths) { const q = segQ(p, wx, wy); if (Math.hypot(wx - q[0], wy - q[1]) < 1.0) return T_DIRT; }
  const r = L.road, q = segQ(r, wx, wy); if (Math.hypot(wx - q[0], wy - q[1]) < 1.5 && !isWet(t)) return T_DIRT;
  const F = L.farm;
  if (F && d > F.r0 && d < F.r1 && Math.abs(angDiff(F.a, Math.atan2(wy - v.y, wx - v.x))) < F.hw && !isWet(t)) return T_WHEAT;
  return t;
}
// castle ground: courtyard (snow stays in the north) and the road from the gate
function castleTile(cs, wx, wy, t) {
  const l = w2l(cs, wx, wy), ax = Math.abs(l[0]), az = Math.abs(l[1]);
  if (ax < CAS_S + 1.5 && az < CAS_S + 1.5) return cs.snow ? (t === T_DRIFT || t === T_SNOW ? t : T_SNOW) : T_DIRT;
  if (ax < 2.4 + Math.max(0, l[1] - CAS_S) * 0.02 && l[1] > 0 && l[1] < CAS_S + 48) return T_DIRT;
  if ((ax < CAS_S + 6 && az < CAS_S + 6) && isWet(t)) return cs.snow ? T_SNOW : T_GRASS;
  return t;
}

// ---------- roads: dirt tracks between neighbouring villages, and lanes to castle gates and manor gates ----------
const ROADS = new Map();
function villageLinks(v) {
  if (v.links) return v.links;
  const c = [];
  for (let j = -10; j <= 10; j++) for (let i = -10; i <= 10; i++) {
    const cx = v.cx + i, cy = v.cy + j; if ((cx & 1) || (cy & 1)) continue;
    const u = villageFor(cx, cy); if (!u || u === v) continue;
    const d = Math.hypot(u.x - v.x, u.y - v.y); if (d < 330) c.push([d, u]);
  }
  c.sort((a, b) => a[0] - b[0]);
  v.links = c.slice(0, 2).map(q => q[1]);
  return v.links;
}
function nearestVillageTo(x, y, maxR) {
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS), n = Math.ceil(maxR / CS);
  let best = null, bd = maxR;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) { const v = villageFor(cx + i, cy + j); if (!v) continue; const d = Math.hypot(v.x - x, v.y - y); if (d < bd) { bd = d; best = v; } }
  return best;
}
const edgePt = (v, tx, ty) => { const a = Math.atan2(ty - v.y, tx - v.x); return [v.x + Math.cos(a) * 27, v.y + Math.sin(a) * 27]; };
function mkRoad(key, a, b, seed, w) {
  let r = ROADS.get(key); if (r) return r;
  const R = mulberry(seed | 0), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(2, Math.round(L / 36));
  const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, pts = [a];
  for (let i = 1; i < n; i++) { const t = i / n, off = (R() - 0.5) * Math.min(40, L * 0.16) * Math.sin(t * Math.PI); pts.push([a[0] + (b[0] - a[0]) * t - dy * off, a[1] + (b[1] - a[1]) * t + dx * off]); }
  pts.push(b);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  r = { key, pts, w: w || 1.35, bb: [x0 - 3, y0 - 3, x1 + 3, y1 + 3] };
  ROADS.set(key, r); return r;
}
function roadsNear(x0, y0, x1, y1) {
  const out = [], seen = new Set(), add = r => { if (seen.has(r.key)) return; seen.add(r.key); if (r.bb[2] > x0 && r.bb[0] < x1 && r.bb[3] > y0 && r.bb[1] < y1) out.push(r); };
  const pad = 340, cx0 = Math.floor((x0 - pad) / CS), cx1 = Math.floor((x1 + pad) / CS), cy0 = Math.floor((y0 - pad) / CS), cy1 = Math.floor((y1 + pad) / CS);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    if ((cx & 1) || (cy & 1)) continue;
    const v = villageFor(cx, cy); if (!v) continue;
    for (const u of villageLinks(v)) { const [p, q] = v.id < u.id ? [v, u] : [u, v]; add(mkRoad(p.id + '|' + q.id, edgePt(p, q.x, q.y), edgePt(q, p.x, p.y), p.seed ^ q.seed)); }
  }
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  for (const cs of castlesNear(mx, my, 420)) {
    if (cs.link === undefined) { const g = l2w(cs, 0, CAS_S + 46); cs.link = nearestVillageTo(g[0], g[1], 420) || null; }
    if (cs.link) { const g = l2w(cs, 0, CAS_S + 46); add(mkRoad(cs.id, g, edgePt(cs.link, g[0], g[1]), cs.seed)); }
  }
  for (const m of manorsNear(mx, my, 420)) {
    if (m.link === undefined) { const g = l2w(m, 0, MAN_G + 32); m.link = nearestVillageTo(g[0], g[1], 400) || null; }
    if (m.link) { const g = l2w(m, 0, MAN_G + 32); add(mkRoad(m.id, g, edgePt(m.link, g[0], g[1]), m.seed, 1.0)); }
  }
  return out;
}
function onRoad(r, x, y) {
  if (x < r.bb[0] || x > r.bb[2] || y < r.bb[1] || y > r.bb[3]) return false;
  const p = r.pts, w = r.w + (hash2(Math.floor(x * 0.7), Math.floor(y * 0.7)) - 0.5) * 0.5;
  for (let i = 0; i < p.length - 1; i++) { const q = segQ([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]], x, y); if ((x - q[0]) ** 2 + (y - q[1]) ** 2 < w * w) return true; }
  return false;
}
