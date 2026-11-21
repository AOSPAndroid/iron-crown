'use strict';
/* =====================================================================
   IRON CROWN 1700 — an ASCII third-person open-world RPG
   ===================================================================== */

// ---------- utils ----------
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[(Math.random() * a.length) | 0];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = t => t * t * (3 - 2 * t);
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { return vnoise(x, y) * 0.55 + vnoise(x * 2.03 + 17.1, y * 2.03 + 5.3) * 0.3 + vnoise(x * 4.1 + 3.7, y * 4.1 + 11.9) * 0.15; }
function mulberry(s) { return function () { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function wrapText(s, w) {
  const out = []; let line = '';
  for (const word of String(s).split(' ')) {
    if (!line.length) line = word;
    else if ((line + ' ' + word).length <= w) line += ' ' + word;
    else { out.push(line); line = word; }
    while (line.length > w) { out.push(line.slice(0, w)); line = line.slice(w); }
  }
  if (line.length) out.push(line);
  return out;
}

// ---------- palette & colour ----------
const PAL = {
  R: '#d0453a', D: '#8e2a22', S: '#e8c39e', T: '#d0d8e0', G: '#8a8a8a', K: '#6a6470', Y: '#e8c050',
  B: '#a8703e', N: '#6e4824', U: '#4f80e0', V: '#3060b0', W: '#f0ece0', P: '#b060e0', Q: '#70409a',
  E: '#7ac050', F: '!#ff8a2a', O: '!#ffd84a', L: '#e0e0f0', M: '#8a2030', H: '#8a6a48', A: '#b0a088',
  Z: '#3f9a35', X: '!#ff3a3a', I: '#c8b898', C: '#7ad0e0'
};
const rgbC = {};
function rgbOf(h) { let c = rgbC[h]; if (c) return c; const n = parseInt(h.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbC[h] = c; return c; }
function css(r, g, b) { return 'rgb(' + clamp(r | 0, 0, 255) + ',' + clamp(g | 0, 0, 255) + ',' + clamp(b | 0, 0, 255) + ')'; }
function mixRGB(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

const FLAME = "*^&'";

// ---------- items ----------
const ITEM_DEFS = {
  rusty_sword: { name: 'Rusty Sword', short: 'RustySwd', type: 'sword', hands: 1, dmg: 12, spd: 0.46, range: 2.3, col: '#a08a70', price: 18, glyph: '/', tier: 0 },
  iron_sword: { name: 'Iron Sword', short: 'IronSwd', type: 'sword', hands: 1, dmg: 17, spd: 0.44, range: 2.4, col: '#b8c0c8', price: 65, glyph: '/', tier: 1 },
  steel_sword: { name: 'Steel Arming Sword', short: 'SteelSwd', type: 'sword', hands: 1, dmg: 23, spd: 0.42, range: 2.5, col: '#dfe8f0', price: 160, glyph: '/', tier: 2 },
  longsword: { name: "Knight's Longsword", short: 'LongSwd', type: 'sword', hands: 1, dmg: 30, spd: 0.45, range: 2.8, col: '#eef4ff', price: 340, glyph: '/', tier: 3 },
  crown_blade: { name: 'Blade of the Crown', short: 'CrownBld', type: 'sword', hands: 1, dmg: 40, spd: 0.4, range: 2.9, col: '!#ffe080', price: 750, glyph: '/', tier: 4 },
  claymore: { name: 'Claymore', short: 'Claymore', type: 'sword2', hands: 2, dmg: 42, spd: 0.85, range: 3.2, col: '#dfe8f0', price: 280, glyph: '|', tier: 2 },
  short_bow: { name: 'Short Bow', short: 'ShortBow', type: 'bow', hands: 2, dmg: 15, draw: 0.6, price: 45, glyph: ')', tier: 0 },
  long_bow: { name: 'Longbow', short: 'Longbow', type: 'bow', hands: 2, dmg: 25, draw: 0.85, price: 190, glyph: ')', tier: 2 },
  war_bow: { name: 'War Bow', short: 'WarBow', type: 'bow', hands: 2, dmg: 35, draw: 1.0, price: 420, glyph: ')', tier: 3 },
  buckler: { name: 'Wooden Buckler', short: 'Buckler', type: 'shield', hands: 1, block: 0.45, slow: 0.9, price: 28, glyph: 'o', tier: 0 },
  kite_shield: { name: 'Kite Shield', short: 'Kite', type: 'shield', hands: 1, block: 0.65, slow: 0.82, price: 150, glyph: 'O', tier: 2 },
  tower_shield: { name: 'Tower Shield', short: 'Tower', type: 'shield', hands: 1, block: 0.85, slow: 0.68, price: 320, glyph: '0', tier: 3 },
  torch: { name: 'Torch', short: 'Torch', type: 'torch', hands: 1, dmg: 8, spd: 0.5, range: 2.2, fire: true, price: 6, glyph: '!', tier: 0 },
  pistol: { name: 'Flintlock Pistol', short: 'Pistol', type: 'gun', hands: 1, dmg: 46, reload: 2.3, price: 240, glyph: 'r', tier: 2 },
  tunic: { name: 'Linen Tunic', short: 'Tunic', type: 'armor', def: 0, slow: 1, color: '#c8b898', dark: '#a08e70', legs: '#8a7a5a', price: 4, glyph: 'T', tier: 0 },
  gambeson: { name: 'Padded Gambeson', short: 'Gambeson', type: 'armor', def: 0.15, slow: 0.97, color: '#c8a46e', dark: '#987c50', legs: '#7a6a4a', price: 45, glyph: 'H', tier: 0 },
  leather: { name: 'Leather Armor', short: 'Leather', type: 'armor', def: 0.25, slow: 0.93, color: '#a8723e', dark: '#6e4824', legs: '#5a4028', price: 115, glyph: 'H', tier: 1 },
  chainmail: { name: 'Chainmail', short: 'Chain', type: 'armor', def: 0.4, slow: 0.87, color: '#a8b0b8', dark: '#788088', legs: '#6a7078', helm: true, price: 270, glyph: 'H', tier: 2 },
  halfplate: { name: 'Half-Plate', short: 'HalfPlt', type: 'armor', def: 0.52, slow: 0.81, color: '#c8d2dc', dark: '#4f80e0', legs: '#8a929a', helm: true, price: 500, glyph: 'H', tier: 3 },
  fullplate: { name: 'Full Plate', short: 'FullPlt', type: 'armor', def: 0.65, slow: 0.74, color: '#eef4fa', dark: '#b0bcc8', legs: '#c8d2dc', helm: true, price: 880, glyph: 'H', tier: 4 },
  potion: { name: 'Healing Draught', short: 'Potion', type: 'potion', stack: true, heal: 55, price: 25, glyph: '+' },
  arrows: { name: 'Arrows', short: 'Arrows', type: 'ammo', stack: true, price: 2, glyph: '>' },
  bandage: { name: 'Linen Bandage', short: 'Bandage', type: 'potion', stack: true, heal: 25, price: 10, glyph: '+' },
  // crafting materials: kept in a separate pouch (they never fill the bag)
  iron_ore: { name: 'Iron Ore', short: 'IronOre', type: 'mat', stack: true, price: 6, glyph: '*', tier: 0, col: '#b0784a' },
  steel_ingot: { name: 'Steel Ingot', short: 'Steel', type: 'mat', stack: true, price: 22, glyph: '=', tier: 1, col: '#c8d4e0' },
  leather_hide: { name: 'Leather Hide', short: 'Hide', type: 'mat', stack: true, price: 8, glyph: '~', tier: 0, col: '#a8703e' },
  wood: { name: 'Timber', short: 'Timber', type: 'mat', stack: true, price: 3, glyph: '#', tier: 0, col: '#b08a5a' },
  cloth: { name: 'Linen Cloth', short: 'Cloth', type: 'mat', stack: true, price: 5, glyph: '%', tier: 0, col: '#e0d6bc' },
  herb: { name: 'Healing Herb', short: 'Herb', type: 'mat', stack: true, price: 4, glyph: '"', tier: 0, col: '#6ab04a' },
  silver: { name: 'Silver Nugget', short: 'Silver', type: 'mat', stack: true, price: 35, glyph: '*', tier: 2, col: '#e8f0ff' },
  scrap: { name: 'Gremlin Scrap', short: 'Scrap', type: 'mat', stack: true, price: 7, glyph: '&', tier: 1, col: '#9aa040' },
  frost_shard: { name: 'Frost Shard', short: 'Frost', type: 'mat', stack: true, price: 45, glyph: '^', tier: 3, col: '#8ae0ff' },
  ghost_essence: { name: 'Ghost Essence', short: 'Essence', type: 'mat', stack: true, price: 40, glyph: 'o', tier: 3, col: '#c8b8ff' }
};
for (const k in ITEM_DEFS) ITEM_DEFS[k].id = k;
// Forged variants live in the id string: base[+level][!temper][#quality], e.g. 'iron_sword+2!s#1'
// (level 1-5, temper s = silvered / f = frost-tempered, quality 1 = fine / 2 = masterwork). ITEMS resolves them on demand,
// so every id stays a plain string in hands, bag, hotbar and saves.
const UPG_TYPES = { sword: 1, sword2: 1, bow: 1, shield: 1, gun: 1, armor: 1, torch: 0 };
const TEMPER = { s: { name: 'silvered', col: '#f4f8ff', desc: 'x1.5 vs undead, ghosts and witches' }, f: { name: 'frost-tempered', col: '#a8e8ff', desc: '+10% damage · chills foes' } };
const QUAL = ['', 'Fine', 'Masterwork'];
const VARC = new Map();
function parseVid(id) {
  const m = /^([a-z0-9_]+)(?:\+([1-5]))?(?:!([sf]))?(?:#([12]))?$/.exec(id || '');
  if (!m || !ITEM_DEFS[m[1]]) return null;
  return { base: m[1], lvl: m[2] ? +m[2] : 0, temper: m[3] || '', q: m[4] ? +m[4] : 0 };
}
function makeVid(base, lvl, temper, q) { return base + (lvl ? '+' + lvl : '') + (temper ? '!' + temper : '') + (q ? '#' + q : ''); }
function variantItem(id) {
  let v = VARC.get(id); if (v !== undefined) return v;
  const p = parseVid(id), b = p && ITEM_DEFS[p.base];
  v = null;
  if (b && UPG_TYPES[b.type] && (p.lvl || p.temper || p.q) && id === makeVid(p.base, p.lvl, p.temper, p.q)) {
    const L = p.lvl, q = p.q, qm = q === 2 ? 1.1 : q === 1 ? 1.05 : 1;
    v = Object.assign({}, b, { id, base: p.base, lvl: L, temper: p.temper, q });
    if (b.dmg) v.dmg = Math.round(b.dmg * (1 + 0.08 * L) * qm * (p.temper === 'f' ? 1.1 : 1)) + L;
    if (b.block) v.block = Math.min(0.95, b.block + 0.03 * L + 0.02 * q);
    if (b.type === 'armor') v.def = Math.min(0.82, b.def + 0.025 * L + 0.015 * q);
    if (b.draw) v.draw = b.draw * (1 - 0.02 * L);
    v.price = Math.round(b.price * (1 + 0.35 * L + 0.15 * q) + (p.temper ? 60 : 0));
    if (p.temper === 's') { v.silver = true; v.col = TEMPER.s.col; }
    if (p.temper === 'f') { v.frost = true; v.col = TEMPER.f.col; }
    v.name = (q ? QUAL[q] + ' ' : '') + b.name + (p.temper ? ' (' + TEMPER[p.temper].name + ')' : '') + (L ? ' +' + L : '');
    v.short = b.short + (L ? '+' + L : '');
  }
  VARC.set(id, v); return v;
}
const ITEMS = new Proxy(ITEM_DEFS, {
  get(t, k) { if (k in t) return t[k]; return typeof k === 'string' ? (variantItem(k) || undefined) : undefined; },
  has(t, k) { return k in t || (typeof k === 'string' && !!variantItem(k)); }
});
const baseId = id => { const it = ITEMS[id]; return it ? (it.base || it.id) : id; };
const TIER_COL = ['#d8d0c0', '#7ad06a', '#6ab0ff', '#c88aff', '#ffc848'];
function tierCol(it) { if (!it) return TIER_COL[0]; const t = it.tier === undefined ? 0 : it.tier; return TIER_COL[clamp(t + (it.q === 2 ? 1 : 0), 0, 4)]; }
const TIER = {
  sword: ['rusty_sword', 'iron_sword', 'steel_sword', 'longsword', 'crown_blade'],
  armor: ['gambeson', 'leather', 'chainmail', 'halfplate', 'fullplate'],
  bow: ['short_bow', 'short_bow', 'long_bow', 'war_bow', 'war_bow'],
  shield: ['buckler', 'buckler', 'kite_shield', 'tower_shield', 'tower_shield']
};
const MAT_USE = { iron_ore: 'smelt into steel, arrows', steel_ingot: 'blades, plate, upgrades', leather_hide: 'grips, armour', wood: 'shields, bows, arrows, torches', cloth: 'gambesons, bandages', herb: 'healing draughts', silver: 'silvering, fine work', scrap: 'pistols, gadgets', frost_shard: 'frost tempering', ghost_essence: 'high upgrades, crown work' };
function itemDesc(it) {
  switch (it.type) {
    case 'sword': return 'DMG ' + it.dmg + ' · one hand';
    case 'sword2': return 'DMG ' + it.dmg + ' · two hands, wide sweep';
    case 'bow': return 'DMG ' + it.dmg + ' · two hands · hold to draw';
    case 'shield': return 'BLOCK ' + Math.round(it.block * 100) + '% · speed ' + Math.round(it.slow * 100) + '% while blocking';
    case 'torch': return 'Light at night · fire burns undead';
    case 'gun': return 'DMG ' + it.dmg + ' · reload ' + it.reload + 's';
    case 'armor': return 'ARMOR ' + Math.round(it.def * 100) + '% · speed ' + Math.round(it.slow * 100) + '%';
    case 'potion': return 'Restores ' + it.heal + ' HP' + (it.id === 'bandage' ? ' · quick to apply' : '');
    case 'ammo': return 'For bows';
    case 'mat': return 'Crafting material' + (MAT_USE[it.id] ? ' · ' + MAT_USE[it.id] : '');
  }
  return '';
}

// ---------- creatures ----------
const KINDS = {
  bandit: { name: 'bandit', team: 1, hp: 28, spd: 3.5, dmg: 5, range: 1.5, cd: 1.0, wind: 0.38, r: 0.45, h: 1.8, gold: 4, xp: 8, spr: 'bandit', ai: 'melee', corpse: 'N', loot: [['rusty_sword', 0.15], ['buckler', 0.1], ['gambeson', 0.05], ['torch', 0.18], ['potion', 0.08]] },
  soldier: { name: 'redcoat soldier', team: 1, hp: 44, spd: 3.3, dmg: 8, range: 1.7, cd: 1.2, wind: 0.32, r: 0.45, h: 1.8, gold: 7, xp: 14, spr: 'soldier', ai: 'melee', corpse: 'R', loot: [['$sword', 0.14], ['buckler', 0.08], ['potion', 0.1], ['$armor', 0.04], ['torch', 0.08]] },
  pikeman: { name: 'redcoat pikeman', team: 1, hp: 52, spd: 2.9, dmg: 11, range: 2.7, cd: 1.5, wind: 0.42, r: 0.45, h: 1.8, gold: 8, xp: 15, spr: 'pikeman', ai: 'melee', antiHorse: 2, corpse: 'R', loot: [['potion', 0.1], ['$armor', 0.07], ['$shield', 0.06]] },
  musketeer: { name: 'redcoat musketeer', team: 1, hp: 30, spd: 3.0, dmg: 15, range: 17, cd: 3.6, wind: 0.85, r: 0.45, h: 1.8, gold: 9, xp: 16, spr: 'musketeer', ai: 'ranged', proj: 'ball', pspd: 26, corpse: 'R', loot: [['pistol', 0.05], ['potion', 0.1]] },
  archer: { name: 'redcoat archer', team: 1, hp: 32, spd: 3.1, dmg: 11, range: 20, cd: 2.6, wind: 0.7, r: 0.45, h: 1.8, gold: 7, xp: 15, spr: 'archer', ai: 'ranged', proj: 'arrow', pspd: 24, corpse: 'R', loot: [['arrows', 0.7, 4, 10], ['$bow', 0.1]] },
  dragoon: { name: 'dragoon', team: 1, hp: 80, spd: 8.2, dmg: 14, range: 2.2, cd: 1.6, wind: 0, r: 0.95, h: 2.6, gold: 15, xp: 30, spr: 'dragoon', ai: 'cavalry', mounted: true, corpse: 'H', loot: [['$sword', 0.25], ['pistol', 0.08], ['potion', 0.15]] },
  vampire: { name: 'vampire', team: 1, hp: 60, spd: 5.6, dmg: 10, range: 1.6, cd: 1.0, wind: 0.25, r: 0.45, h: 1.9, gold: 12, xp: 26, spr: 'vampire', ai: 'melee', unholy: true, drain: 0.7, blink: true, prefP: 0.5, blood: '#7a1a2a', ash: true, loot: [['potion', 0.3], ['$any', 0.06]] },
  witch: { name: 'witch', team: 1, hp: 45, spd: 3.6, dmg: 13, range: 19, cd: 2.8, wind: 0.6, r: 0.45, h: 2.0, gold: 14, xp: 30, spr: 'witch', ai: 'caster', unholy: true, hover: 1.3, prefP: 0.5, blood: '#7ac050', ash: true, loot: [['potion', 0.45], ['$any', 0.08]] },
  giant: { name: 'giant', team: 1, hp: 650, spd: 2.1, dmg: 32, range: 4.3, cd: 2.6, wind: 1.0, r: 1.6, h: 5.6, gold: 80, xp: 150, spr: 'giant', ai: 'giant', boss: true, prefP: 0.6, corpse: 'G', loot: [['$armor', 0.8], ['$any', 0.7], ['potion', 0.7], ['claymore', 0.12]] },
  frostgiant: { name: 'frost giant', team: 1, hp: 740, spd: 2.0, dmg: 34, range: 4.4, cd: 2.6, wind: 1.0, r: 1.6, h: 5.8, gold: 95, xp: 170, spr: 'frostgiant', ai: 'giant', boss: true, frost: true, prefP: 0.6, blood: '#9cc0dc', corpse: 'F', loot: [['$armor', 0.85], ['$any', 0.7], ['potion', 0.7], ['claymore', 0.15]] },
  // gremlins: small, fast and spiteful; they come in packs, mostly at night and around haunted places
  gremlin: { name: 'gremlin', team: 1, hp: 17, spd: 5.4, dmg: 5, range: 1.25, cd: 0.9, wind: 0.32, r: 0.34, h: 1.15, gold: 3, xp: 7, spr: 'gremlin', ai: 'gremlin', scale: 0.62, prefP: 0.7, blood: '#7a9a3a', corpse: 'g', gremlin: true, loot: [['potion', 0.05], ['arrows', 0.15, 2, 6]] },
  gremlin_bomber: { name: 'firebomb gremlin', team: 1, hp: 15, spd: 4.4, dmg: 10, range: 14, cd: 3.4, wind: 0.75, r: 0.34, h: 1.15, gold: 4, xp: 9, spr: 'gremlin_bomber', ai: 'gbomber', scale: 0.62, rangedTok: true, prefP: 0.8, blood: '#7a9a3a', corpse: 'b', gremlin: true, loot: [['potion', 0.08]] },
  gremlin_shaman: { name: 'gremlin shaman', team: 1, hp: 28, spd: 3.9, dmg: 7, range: 15, cd: 2.6, wind: 0.6, r: 0.36, h: 1.25, gold: 7, xp: 16, spr: 'gremlin_shaman', ai: 'gshaman', scale: 0.66, rangedTok: true, prefP: 0.9, blood: '#7a9a3a', corpse: 's', gremlin: true, loot: [['potion', 0.3], ['$any', 0.05]] },
  gremlin_brute: { name: 'gremlin brute', team: 1, hp: 260, spd: 3.3, dmg: 21, range: 2.8, cd: 1.7, wind: 0.8, r: 0.85, h: 2.5, gold: 40, xp: 90, spr: 'gremlin_brute', ai: 'giant', boss: true, scale: 1.35, prefP: 0.6, blood: '#7a9a3a', corpse: 'u', gremlin: true, loot: [['$armor', 0.4], ['$any', 0.45], ['potion', 0.6], ['claymore', 0.08]] },
  // a translucent spirit that drifts through walls; fire and torches hurt it badly
  ghost: { name: 'ghost', team: 1, hp: 42, spd: 2.7, dmg: 9, range: 1.7, cd: 1.5, wind: 0.5, r: 0.45, h: 1.9, gold: 6, xp: 20, spr: 'ghost', ai: 'melee', unholy: true, phase: true, hover: 0.35, prefP: 0.6, blood: '#b8e0ff', ash: true, loot: [['potion', 0.2]] },
  vlord: { name: 'vampire lord', team: 1, hp: 520, spd: 4.8, dmg: 17, range: 1.8, cd: 1.1, wind: 0.3, r: 0.55, h: 2.2, gold: 90, xp: 220, spr: 'vlord', ai: 'melee', boss: true, unholy: true, drain: 0.7, blink: true, scale: 1.18, prefP: 0.5, blood: '#7a1a2a', ash: true, loot: [['$armor', 0.7], ['$any', 0.8], ['potion', 0.8]] },
  lord: { name: 'Lord Protector Ravensworth', team: 1, hp: 760, spd: 3.9, dmg: 22, range: 2.0, cd: 1.1, wind: 0.4, r: 0.55, h: 2.1, gold: 300, xp: 500, spr: 'lord', ai: 'melee', boss: true, scale: 1.14, prefP: 0.5, corpse: 'L', loot: [['potion', 1]] },
  ally: { name: 'royal soldier', team: 0, hp: 70, spd: 3.4, dmg: 10, range: 1.7, cd: 1.1, wind: 0.3, r: 0.45, h: 1.8, spr: 'ally', ai: 'melee', corpse: 'B' },
  guard: { name: 'village guard', team: 0, hp: 110, spd: 3.4, dmg: 12, range: 1.8, cd: 1.0, wind: 0.3, r: 0.45, h: 1.8, spr: 'guard', ai: 'melee', guard: true, corpse: 'B' },
  merchant: { name: 'merchant', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.5, h: 1.8, spr: 'merchant', ai: 'none', role: 'trade' },
  smith: { name: 'blacksmith', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'smith', ai: 'none', role: 'smith' },
  innkeeper: { name: 'innkeeper', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'innkeeper', ai: 'none', role: 'inn' },
  quartermaster: { name: 'quartermaster', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'quartermaster', ai: 'none', role: 'qm' },
  priest: { name: 'priest', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'priest', ai: 'none', role: 'quest' },
  villager: { name: 'villager', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'villager', ai: 'none' },
  // story people
  stranger: { name: 'the Stranger', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'stranger', ai: 'none', role: 'quest' },
  captain: { name: 'captain', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'captain', ai: 'none', role: 'quest' },
  heir: { name: 'Lady Elinor', team: 2, hp: 9999, spd: 0, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.45, h: 1.8, spr: 'heir', ai: 'none', role: 'quest' },
  captive: { name: 'captive', team: 2, hp: 9999, spd: 5.2, dmg: 0, range: 0, cd: 9, wind: 0, r: 0.42, h: 1.8, spr: 'villager', ai: 'follow', role: 'quest' }
};
for (const k in KINDS) KINDS[k].id = k;
// crafting materials dropped by foes: [id, chance, min, max]
const MAT_LOOT = {
  bandit: [['leather_hide', 0.3], ['cloth', 0.3]], soldier: [['cloth', 0.3], ['iron_ore', 0.2], ['steel_ingot', 0.06]], pikeman: [['wood', 0.3], ['steel_ingot', 0.08]],
  musketeer: [['cloth', 0.3], ['scrap', 0.1]], archer: [['wood', 0.35, 1, 2]], dragoon: [['leather_hide', 0.5, 1, 2], ['steel_ingot', 0.2]],
  vampire: [['ghost_essence', 0.15], ['silver', 0.1], ['cloth', 0.3]], witch: [['herb', 0.6, 1, 3], ['ghost_essence', 0.2]],
  giant: [['leather_hide', 0.8, 2, 4], ['wood', 0.6, 2, 4]], frostgiant: [['frost_shard', 1, 2, 4], ['leather_hide', 0.6, 1, 3]],
  gremlin: [['scrap', 0.45]], gremlin_bomber: [['scrap', 0.5]], gremlin_shaman: [['herb', 0.4], ['scrap', 0.4]], gremlin_brute: [['scrap', 1, 2, 5], ['iron_ore', 0.5, 1, 2]],
  ghost: [['ghost_essence', 0.55]], vlord: [['ghost_essence', 1, 2, 3], ['silver', 0.6, 1, 2]], lord: [['silver', 1, 2, 3]]
};
for (const k in MAT_LOOT) KINDS[k].loot = (KINDS[k].loot || []).concat(MAT_LOOT[k]);
