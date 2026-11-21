// =====================================================================
//  HOTBAR, FORGING & CRAFTING — the Minecraft-style hotbar (8 shortcuts to your gear), materials,
//  blacksmith recipes, +1..+5 upgrades, tempering, salvage, campfire recipes, the hammer minigame,
//  mining ore outcrops and chopping wood
// =====================================================================
const HOT_N = 8;
const HOT_TYPES = { sword: 1, sword2: 1, bow: 1, shield: 1, torch: 1, gun: 1, potion: 1, armor: 0, ammo: 0, mat: 0 };

// ---------- hotbar ----------
function hotOwned(id) { return !!id && (P.hands[0] === id || P.hands[1] === id || P.armor === id || invCount(id) > 0); }
function hotClean() { for (let i = 0; i < HOT_N; i++) if (P.hot[i] && !hotOwned(P.hot[i])) P.hot[i] = null; }
// a newly gained item takes the first free slot (weapons, shields, torches, consumables)
function hotAuto(id) {
  const it = ITEMS[id]; if (!it || !HOT_TYPES[it.type] || !hotOwned(id) || P.hot.includes(id)) return false;
  const i = P.hot.indexOf(null); if (i < 0) return false;
  P.hot[i] = id; return true;
}
// saves from before the hotbar (and new games): fill it from the hands, then the bag
function hotInit() {
  P.hot = new Array(HOT_N).fill(null); P.hotSel = 0;
  const main = mainItem();
  if (main) { P.hot[0] = P.hands[mainHand()]; }
  for (const h of P.hands) if (h) hotAuto(h);
  for (const q of P.inv) hotAuto(q.id);
  P.hotSel = main ? 0 : Math.max(0, P.hot.indexOf(null));
}
function hotLabel(txt, col) { S.hotLbl = { txt, col: col || '#f0e2c0', t: 1.8 }; }
function hotConsumable() { const id = P.hot[P.hotSel]; return id && ITEMS[id] && ITEMS[id].type === 'potion' && invCount(id) > 0 ? id : null; }
function stowHand(side) { const id = P.hands[side]; if (!id) return; if (ITEMS[id].hands === 2) { P.hands = [null, null]; giveOrDrop(id); } else { P.hands[side] = null; giveOrDrop(id); } }
// put an item from the bag into the hands, following the two-hand rules
function hotEquip(id) {
  const it = ITEMS[id];
  if (P.hands[0] === id || P.hands[1] === id) return true;
  const idx = P.inv.findIndex(q => q.id === id); if (idx < 0) return false;
  const main = P.hands[1] ? ITEMS[P.hands[1]] : null, oneHandMain = main && main.hands !== 2 && (main.type === 'sword' || main.type === 'gun' || main.type === 'torch');
  if (it.hands === 2) equipFromInv(idx, 1);
  else if (it.type === 'shield') { if (twoHanded()) stowHand(1); equipFromInv(P.inv.findIndex(q => q.id === id), 0); }
  else if (it.type === 'torch') {
    if (oneHandMain && main.type !== 'torch') equipFromInv(idx, 0);
    else { if (twoHanded()) stowHand(1); equipFromInv(P.inv.findIndex(q => q.id === id), 1); }
  } else equipFromInv(idx, 1);
  return true;
}
// selecting a slot: weapons go to the main hand, shields / torches to the off hand beside a one-hand weapon,
// a consumable gets ready (ATTACK or the same key again drinks it), an empty slot means bare fists
function hotSelect(j, how) {
  j = ((j % HOT_N) + HOT_N) % HOT_N; hotClean();
  const again = P.hotSel === j; P.hotSel = j;
  const id = P.hot[j], it = id ? ITEMS[id] : null;
  if (!it) {
    let stowed = false;
    for (const s of [1, 0]) { const h = P.hands[s]; if (h && ITEMS[h].type !== 'shield') { stowHand(s); stowed = true; } }
    if (stowed) { P.act = null; P.comboStep = 0; sfx('equip'); }
    hotLabel('Bare fists', '#e8d8b8'); return 'fists';
  }
  if (it.type === 'potion') {
    hotLabel(it.name + ' ×' + invCount(id) + (IS_TOUCH_G() ? ' · tap ATTACK to drink' : ' · attack to drink'), '#ff9aa8');
    if (again && (how === 'key' || how === 'tap')) useConsumable(id);
    return 'potion';
  }
  if (it.type === 'armor') { if (P.armor !== id) { const i = P.inv.findIndex(q => q.id === id); if (i >= 0) equipFromInv(i, 0); } hotLabel(it.name, tierCol(it)); return 'armor'; }
  if (!HOT_TYPES[it.type]) { hotLabel(it.name + (it.stack ? ' ×' + invCount(id) : ''), tierCol(it)); return 'none'; }
  if (P.act && (P.act.k === 'atk' || P.act.k === 'dash')) { /* swapping mid-swing simply cancels it */ }
  hotEquip(id);
  hotLabel(it.name, tierCol(it));
  return 'equip';
}
const IS_TOUCH_G = () => typeof IS_TOUCH !== 'undefined' && IS_TOUCH;
function hotWheel(dir) { if (S.mode !== 'play') return; hotSelect(P.hotSel + (dir > 0 ? 1 : -1), 'wheel'); }
// keep the highlight on the slot holding your weapon when gear changes elsewhere (pickups, the bag)
function hotSync() {
  hotClean();
  const id = P.hot[P.hotSel], it = id ? ITEMS[id] : null;
  if (it && (it.type === 'potion' || it.type === 'armor' || !HOT_TYPES[it.type])) return;
  const held = mainHand() >= 0 ? P.hands[mainHand()] : null;
  if (it && (P.hands[0] === id || P.hands[1] === id)) return;
  if (!it && !held) return;
  const k = held ? P.hot.indexOf(held) : -1;
  if (k >= 0) P.hotSel = k;
}
function hotFilterInput(inp) {
  const c = hotConsumable();
  if (!c) { P.hotAtkPrev = !!inp.atk; return inp; }
  if (inp.atk && !P.hotAtkPrev && S.mode === 'play') useConsumable(c);
  P.hotAtkPrev = !!inp.atk;
  return Object.assign({}, inp, { atk: false });
}

// ---------- recipes ----------
// st: 'smith' = the blacksmith's forge, 'camp' = a campfire workbench; mg = the hammer minigame decides quality
const RECIPES = [
  { id: 'steel_ingot', st: 'smith', cat: 'Smelting', mats: { iron_ore: 2, wood: 1 }, gold: 0 },
  { id: 'iron_sword', st: 'smith', cat: 'Weapons', mats: { iron_ore: 3, wood: 1, leather_hide: 1 }, gold: 8, mg: true },
  { id: 'steel_sword', st: 'smith', cat: 'Weapons', mats: { steel_ingot: 3, leather_hide: 1 }, gold: 20, mg: true },
  { id: 'longsword', st: 'smith', cat: 'Weapons', mats: { steel_ingot: 5, silver: 1, leather_hide: 2 }, gold: 60, mg: true },
  { id: 'claymore', st: 'smith', cat: 'Weapons', mats: { steel_ingot: 6, wood: 2, leather_hide: 1 }, gold: 45, mg: true },
  { id: 'crown_blade', st: 'smith', cat: 'Weapons', mats: { steel_ingot: 6, silver: 3, frost_shard: 2, ghost_essence: 2 }, gold: 150, mg: true },
  { id: 'pistol', st: 'smith', cat: 'Weapons', mats: { steel_ingot: 3, wood: 2, scrap: 3 }, gold: 40, mg: true },
  { id: 'buckler', st: 'smith', cat: 'Shields', mats: { wood: 3, iron_ore: 1 }, gold: 0, mg: true },
  { id: 'kite_shield', st: 'smith', cat: 'Shields', mats: { wood: 3, steel_ingot: 2, leather_hide: 1 }, gold: 15, mg: true },
  { id: 'tower_shield', st: 'smith', cat: 'Shields', mats: { wood: 4, steel_ingot: 4, leather_hide: 2 }, gold: 40, mg: true },
  { id: 'gambeson', st: 'smith', cat: 'Armour', mats: { cloth: 4 }, gold: 0, mg: true },
  { id: 'leather', st: 'smith', cat: 'Armour', mats: { leather_hide: 4, cloth: 1 }, gold: 10, mg: true },
  { id: 'chainmail', st: 'smith', cat: 'Armour', mats: { steel_ingot: 4, iron_ore: 2, cloth: 2 }, gold: 30, mg: true },
  { id: 'halfplate', st: 'smith', cat: 'Armour', mats: { steel_ingot: 6, leather_hide: 2 }, gold: 60, mg: true },
  { id: 'fullplate', st: 'smith', cat: 'Armour', mats: { steel_ingot: 9, silver: 2, leather_hide: 3 }, gold: 120, mg: true },
  { id: 'arrows', n: 10, st: 'camp', cat: 'Supplies', mats: { wood: 1, iron_ore: 1 }, gold: 0 },
  { id: 'torch', st: 'camp', cat: 'Supplies', mats: { wood: 1, cloth: 1 }, gold: 0 },
  { id: 'bandage', n: 2, st: 'camp', cat: 'Supplies', mats: { cloth: 2 }, gold: 0 },
  { id: 'potion', st: 'camp', cat: 'Supplies', mats: { herb: 3 }, gold: 0 },
  { id: 'short_bow', st: 'camp', cat: 'Bows', mats: { wood: 3, cloth: 1 }, gold: 0, mg: true },
  { id: 'long_bow', st: 'camp', cat: 'Bows', mats: { wood: 5, cloth: 2, leather_hide: 1 }, gold: 0, mg: true },
  { id: 'war_bow', st: 'camp', cat: 'Bows', mats: { wood: 6, leather_hide: 2, steel_ingot: 1 }, gold: 0, mg: true }
];
for (const r of RECIPES) r.key = r.st + ':' + r.id;
const recipeFor = (id, st) => RECIPES.find(r => r.id === id && (!st || r.st === st));
function haveMats(mats, gold) { for (const k in mats) if (invCount(k) < mats[k]) return false; return P.gold >= (gold || 0); }
function takeMats(mats, gold) { for (const k in mats) invTake(k, mats[k]); P.gold -= gold || 0; }
function canCraft(r) { return haveMats(r.mats, r.gold); }
// crafting consumes the materials and gives the item (equipment gets a quality grade from the minigame)
function craftItem(r, grade) {
  if (!canCraft(r)) return null;
  const it = ITEMS[r.id];
  if (!it.stack && P.inv.length >= INV_MAX) { msg('Your bag is full.', '#ff9a7a'); return null; }
  takeMats(r.mats, r.gold);
  const id = UPG_TYPES[it.type] && grade ? makeVid(r.id, 0, '', grade) : r.id;
  giveOrDrop(id, r.n || 1); hotAuto(id);
  if (typeof questOnCraft === 'function') questOnCraft(id);
  return id;
}
// ---------- upgrades, tempering, salvage ----------
function upgradable(id) { const it = ITEMS[id]; return !!(it && UPG_TYPES[it.type] && (it.lvl || 0) < 5); }
function upgradeCost(id) {
  const it = ITEMS[id], L = (it.lvl || 0) + 1, t = it.tier || 0, m = {};
  const add = (k, n) => { if (n > 0) m[k] = (m[k] || 0) + n; };
  if (it.type === 'bow') { add('wood', L < 3 ? 2 : L < 5 ? 3 : 4); if (L >= 2) add('leather_hide', 1); if (L >= 3) add('steel_ingot', 1); }
  else { const T = [null, { iron_ore: 2 }, { steel_ingot: 1, iron_ore: 1 }, { steel_ingot: 2 }, { steel_ingot: 3 }, { steel_ingot: 4 }][L]; for (const k in T) add(k, T[k]); }
  if (it.type === 'armor' || it.type === 'shield') add('leather_hide', Math.ceil(L / 2));
  if (L >= 4) add('silver', 1);
  if (L >= 5) add('ghost_essence', 1);
  return { mats: m, gold: 10 * L * (1 + t), lvl: L };
}
function canTemper(id) { const it = ITEMS[id]; return !!(it && (it.type === 'sword' || it.type === 'sword2')); }
const TEMPER_COST = { s: { mats: { silver: 2 }, gold: 25 }, f: { mats: { frost_shard: 2 }, gold: 25 } };
// where an item is: a hand, the armour slot or a bag slot
function locate(id) {
  if (P.hands[1] === id) return { w: 'hand', s: 1 };
  if (P.hands[0] === id) return { w: 'hand', s: 0 };
  if (P.armor === id) return { w: 'armor' };
  const i = P.inv.findIndex(q => q.id === id); if (i >= 0) return { w: 'bag', i };
  return null;
}
function replaceItem(id, nid) {
  const L = locate(id); if (!L) return false;
  if (L.w === 'hand') { if (ITEMS[id].hands === 2) P.hands = [nid, nid]; else P.hands[L.s] = nid; }
  else if (L.w === 'armor') P.armor = nid;
  else P.inv[L.i] = { id: nid, n: 1 };
  for (let i = 0; i < HOT_N; i++) if (P.hot[i] === id) P.hot[i] = nid;
  return true;
}
function upgradeItem(id, grade) {
  if (!upgradable(id)) return null;
  const c = upgradeCost(id); if (!haveMats(c.mats, c.gold)) return null;
  const v = parseVid(id), nid = makeVid(v.base, c.lvl, v.temper, Math.max(v.q, grade || 0));
  takeMats(c.mats, c.gold); replaceItem(id, nid); return nid;
}
function temperItem(id, t, grade) {
  if (!canTemper(id) || !TEMPER_COST[t]) return null;
  const c = TEMPER_COST[t]; if (!haveMats(c.mats, c.gold)) return null;
  const v = parseVid(id); if (v.temper === t) return null;
  const nid = makeVid(v.base, v.lvl, t, Math.max(v.q, grade || 0));
  takeMats(c.mats, c.gold); replaceItem(id, nid); return nid;
}
// salvage: about half the materials back, plus something for upgrade levels and tempering
const SALV_EXTRA = { rusty_sword: { iron_ore: 1 }, tunic: { cloth: 1 }, war_bow: { wood: 3, leather_hide: 1 }, short_bow: { wood: 2 }, long_bow: { wood: 3, cloth: 1 } };
function salvageYield(id) {
  const it = ITEMS[id]; if (!it || it.type === 'mat' || it.type === 'potion' || it.type === 'ammo') return null;
  const b = it.base || id, r = RECIPES.find(x => x.id === b), out = {};
  if (r) { let first = true; for (const k in r.mats) { const n = Math.floor(r.mats[k] / 2); if (n > 0 || first) out[k] = Math.max(1, n); first = false; } }
  else if (SALV_EXTRA[b]) Object.assign(out, SALV_EXTRA[b]);
  else if (b === 'torch') out.wood = 1;
  else return null;
  if (it.lvl) { const k = it.type === 'bow' ? 'wood' : 'steel_ingot'; out[k] = (out[k] || 0) + Math.ceil(it.lvl / 2); }
  if (it.temper) { const k = it.temper === 's' ? 'silver' : 'frost_shard'; out[k] = (out[k] || 0) + 1; }
  return out;
}
function salvageBag(i) {
  const s = P.inv[i]; if (!s) return null;
  const y = salvageYield(s.id); if (!y) return null;
  if (ITEMS[s.id].stack) { if (!invTake(s.id, 1)) return null; } else P.inv.splice(i, 1);
  for (const k in y) invAdd(k, y[k]);
  hotClean();
  return y;
}

// ---------- the hammer minigame: three strikes on a marker sweeping across the bar ----------
const MG = { strikes: 3, spd: [1.05, 1.35, 1.65], perfect: 0.045, good: 0.12, fair: 0.22 };
function mgNew(job) { return { job, i: 0, pos: 0, dir: 1, zone: rr(0.32, 0.68), res: [], fb: null, fbT: 0, done: false, t: 0 }; }
function mgTick(m, dt) {
  if (!m || m.done) return;
  m.t += dt; m.fbT -= dt;
  const v = MG.spd[Math.min(m.i, MG.spd.length - 1)];
  m.pos += m.dir * v * dt;
  if (m.pos > 1) { m.pos = 2 - m.pos; m.dir = -1; } else if (m.pos < 0) { m.pos = -m.pos; m.dir = 1; }
}
function mgScore(d) { return d <= MG.perfect ? 1 : d <= MG.good ? 0.6 : d <= MG.fair ? 0.3 : 0; }
function mgStrike(m) {
  if (!m || m.done) return null;
  const d = Math.abs(m.pos - m.zone), sc = mgScore(d);
  m.res.push(sc); m.i++;
  m.fb = sc >= 1 ? 'PERFECT!' : sc >= 0.6 ? 'GOOD' : sc > 0 ? 'FAIR' : 'MISS'; m.fbT = 0.7;
  sfx(sc >= 1 ? 'anvil_perfect' : sc > 0 ? 'anvil' : 'anvil_bad');
  if (m.i >= MG.strikes) m.done = true; else { m.zone = rr(0.28, 0.72); }
  return sc;
}
// quality from the strikes: masterwork for a near-perfect rhythm, fine for a good one
function forgeGrade(res) { const q = res.length ? res.reduce((a, b) => a + b, 0) / res.length : 0; return { q, grade: q >= 0.85 ? 2 : q >= 0.5 ? 1 : 0 }; }

// ---------- mining ore outcrops and chopping wood (any swing that hits no foe) ----------
const CHOP = { oak: 3, pine: 3, snowpine: 3, birch: 3, deadtree: 2, palm: 2, willow: 3, log: 2, stump: 1 };
function oreState(o) { let st = S.ore[o.id]; if (st && st.day !== undefined && S.day >= st.day + 2 && st.left <= 0) { delete S.ore[o.id]; st = null; } if (!st) st = S.ore[o.id] = { left: o.silver ? 3 : 4, h: 0 }; return st; }
function oreDepleted(o) { const st = S.ore[o.id]; return !!(st && st.left <= 0 && !(st.day !== undefined && S.day >= st.day + 2)); }
function hitWorld(a, range, arc) {
  a.world = true;
  let best = null, bd = 1e9;
  forStatics(P.x, P.y, range + 1.5, o => {
    if (o.type !== 'ore' && !CHOP[o.type] && o.type !== 'bush') return false;
    const dx = o.x - P.x, dy = o.y - P.y, d = Math.hypot(dx, dy) - o.r;
    if (d > range + 0.2) return false;
    if (Math.abs(angDiff(a.dir, Math.atan2(dy, dx))) > arc + 0.3 && d > 0.4) return false;
    if (d < bd) { bd = d; best = o; }
    return false;
  });
  if (!best) return null;
  const o = best, it = a.it, hx = o.x - Math.cos(a.dir) * o.r * 0.7, hy = o.y - Math.sin(a.dir) * o.r * 0.7;
  if (o.type === 'ore') {
    if (oreDepleted(o)) { addText(o.x, o.y, 1.6, 'depleted', '#8a8a9a'); sfx('clang'); sparks(hx, hy, 0.7, '!#fff4c0', 3); return 'empty'; }
    const st = oreState(o), pw = !it ? 0.55 : it.type === 'sword2' ? 1.4 : a.mv.heavy ? 1.3 : 1;
    st.h += pw; sparks(hx, hy, 0.7, '!#ffd890', 7, true); sfx('mine'); S.shake = Math.max(S.shake, 0.08);
    burst(hx, hy, 0.6, '#8a847a', 4, ['.', ','], 2);
    if (st.h >= 2) {
      st.h -= 2; st.left--;
      const id = o.silver && Math.random() < 0.6 ? 'silver' : 'iron_ore';
      invAdd(id, 1); addText(o.x, o.y, 1.9, '+1 ' + ITEMS[id].name, id === 'silver' ? '#e8f0ff' : '#ffc890', true); sfx('pickup');
      msg('Mined ' + ITEMS[id].name + ' (' + invCount(id) + ')', '#d8e8b0', 3, id);
      if (st.left <= 0) { st.day = S.day; msg('The vein is spent. It will show new ore in a couple of days.', '#a8a090', 4); }
      return id;
    }
    return 'hit';
  }
  const key = Math.round(o.x * 10) + ',' + Math.round(o.y * 10), n = S.chop.get(key) || 0;
  if (o.type === 'bush') {
    burst(o.x, o.y, 0.6, '#5a8a3a', 5, ['*', ','], 2); sfx('scratch');
    if (n < 1 && Math.random() < 0.4) { S.chop.set(key, n + 1); invAdd('herb', 1); addText(o.x, o.y, 1.4, '+1 Healing Herb', '#a8e080', true); msg('Found a Healing Herb (' + invCount('herb') + ')', '#d8e8b0', 3, 'herb'); return 'herb'; }
    return 'hit';
  }
  burst(hx, hy, 1.0, '#c8a070', 5, ['/', '\\', '.'], 2.5); sfx('chop'); S.shake = Math.max(S.shake, 0.06);
  if (o.type !== 'log' && o.type !== 'stump') burst(o.x, o.y, 3, o.type === 'snowpine' ? '#f0f4ff' : '#4e7a3a', 5, ['*', ','], 2);
  if (n < CHOP[o.type] && Math.random() < (it && (it.type === 'sword2' || it.type === 'sword') ? 0.6 : 0.35)) {
    S.chop.set(key, n + 1); invAdd('wood', 1); addText(o.x, o.y, 1.8, '+1 Timber', '#e8c890', true); msg('Chopped Timber (' + invCount('wood') + ')', '#d8e8b0', 3, 'wood'); return 'wood';
  }
  return 'hit';
}

// ---------- smith orders (side quests: bring the blacksmith materials) ----------
function matsLine(mats) { return Object.entries(mats).map(([k, n]) => n + ' ' + ITEMS[k].name.toLowerCase()).join(', '); }
function questOnCraft(id) { }
