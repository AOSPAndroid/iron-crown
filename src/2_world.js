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
  menhir: { r: 0.7, h: 3 }, palm: { r: 0.5, h: 5 }, bush: { r: 0.5, h: 1, block: false }, house: { r: 2.7, h: 4.5 }, fire: { r: 0.6, h: 1.0 },
  well: { r: 0.9, h: 1.6 }, ruin: { r: 4.2, h: 7 }, chest: { r: 0.6, h: 0.8 }
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
  const c = { cx, cy, key: cx + ',' + cy, tiles: new Uint8Array(CS * CS), statics: [], grid: [], village: null, biome: 0 };
  for (let i = 0; i < 16; i++) c.grid.push([]);
  const ox = cx * CS, oy = cy * CS;
  c.biome = biomeAt(ox + 16, oy + 16);
  const vils = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const v = villageFor(cx + i, cy + j); if (v) vils.push(v); }
  const own = villageFor(cx, cy); c.village = own;
  for (let ty = 0; ty < CS; ty++) for (let tx = 0; tx < CS; tx++) {
    const wx = ox + tx + 0.5, wy = oy + ty + 0.5;
    let t = tileBase(wx, wy);
    for (const v of vils) {
      const d = Math.hypot(wx - v.x, wy - v.y);
      if (d < 11.5) t = T_DIRT;
      else if (v.farm && d < 17 && Math.cos(Math.atan2(wy - v.y, wx - v.x) - v.farmA) > 0.72 && !isWet(t)) t = T_WHEAT;
    }
    c.tiles[ty * CS + tx] = t;
  }
  const tileL = (x, y) => c.tiles[(clamp(Math.floor(y - oy), 0, 31)) * CS + clamp(Math.floor(x - ox), 0, 31)];
  const nearVil = (x, y, rad) => vils.some(v => Math.hypot(v.x - x, v.y - y) < rad);

  // village structures
  if (own) {
    const v = own;
    const snow = v.b === B_SNOW, sand = v.b === B_DESERT;
    const hv = snow ? 'snow' : sand ? 'sand' : '';
    const n = v.nh;
    for (let i = 0; i < n; i++) {
      const a = v.gap + 0.6 + i * ((TAU - 1.2) / (n - 1 || 1));
      const rad = 8.5 + R() * 1.5;
      addStaticTo(c, 'house', v.x + Math.cos(a) * rad, v.y + Math.sin(a) * rad, { v: hv, rot: a + Math.PI });
    }
    addStaticTo(c, 'fire', v.x, v.y, { light: 10, village: v });
    addStaticTo(c, 'well', v.x - 3.2, v.y + 2.4);
    c.spawnVillage = v;
  }
  // ruins + chest
  if (!own && !nearVil(ox + 16, oy + 16, 34) && R() < 0.06 && (c.biome === B_HEATH || c.biome === B_FOREST || c.biome === B_SNOW || c.biome === B_DESERT || c.biome === B_PLAINS)) {
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
    [B_PLAINS]: { n: 26, th: 0.6, list: [['oak', 0.55], ['pine', 0.15], ['bush', 0.3]], rocks: 3 },
    [B_FOREST]: { n: 110, th: 0.36, list: [['pine', 0.55], ['oak', 0.4], ['bush', 0.05]], rocks: 2 },
    [B_SNOW]: { n: 55, th: 0.48, list: [['snowpine', 0.9], ['deadtree', 0.1]], rocks: 5 },
    [B_SWAMP]: { n: 40, th: 0.4, list: [['deadtree', 0.6], ['bush', 0.3], ['oak', 0.1]], rocks: 1 },
    [B_HEATH]: { n: 10, th: 0.45, list: [['deadtree', 0.4], ['bush', 0.35], ['menhir', 0.25]], rocks: 8 },
    [B_DESERT]: { n: 5, th: 0.4, list: [['palm', 0.4], ['deadtree', 0.3], ['bush', 0.3]], rocks: 5 }
  }[B];
  for (let i = 0; i < plan.n * 2; i++) {
    const x = ox + R() * CS, y = oy + R() * CS;
    if (fbm(x * 0.04 + 50, y * 0.04 + 50) < plan.th) continue;
    const t = tileL(x, y);
    if (isWet(t) || t === T_DIRT || t === T_WHEAT) continue;
    if (nearVil(x, y, 15)) continue;
    if (Math.hypot(x - 16, y + 2) < 8 || (Math.abs(x - 16) < 3 && y < 4 && y > -30)) continue; // keep the starting road clear
    if (localNear(c, x, y, 1.6)) continue;
    let roll = R(), type = plan.list[0][0];
    for (const [tp, w] of plan.list) { if (roll < w) { type = tp; break; } roll -= w; }
    addStaticTo(c, type, x, y);
  }
  for (let i = 0; i < plan.rocks; i++) {
    const x = ox + R() * CS, y = oy + R() * CS;
    const t = tileL(x, y);
    if (isWet(t) || t === T_DIRT || nearVil(x, y, 14) || localNear(c, x, y, 1.5) || Math.hypot(x - 16, y) < 10) continue;
    addStaticTo(c, 'rock', x, y);
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
  return forStatics(x, y, r, o => { if (!o.block) return false; const dx = x - o.x, dy = y - o.y, rs = r + o.r; return dx * dx + dy * dy < rs * rs; });
}
function collide(e, r) {
  let hit = false;
  forStatics(e.x, e.y, r, o => {
    if (!o.block) return false;
    const dx = e.x - o.x, dy = e.y - o.y, rs = r + o.r, d2 = dx * dx + dy * dy;
    if (d2 < rs * rs) { const d = Math.sqrt(d2) || 0.01, p = rs - d; e.x += dx / d * p; e.y += dy / d * p; hit = true; }
    return false;
  });
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
