// =====================================================================
//  GAME — state, player, skill-based action combat, creatures, world events
// =====================================================================
const DAY_LEN = 420;          // seconds per full day
const INV_MAX = 20;
const SAVE_KEY = 'ironcrown1700_save_v1';
let S = null, P = null;

// ---------- combat tuning (seconds) ----------
const DASH = { dur: 0.28, ifr: 0.16, dist: 4.4, cost: 22, minSt: 18, rec: 0.08 };
const BUF = 0.14;                 // input buffer for attack / dash / off-hand
const CHAIN_GRACE = 0.14;         // combo can still continue this long after recovery ends
const SHARP = 0.1;                // pressing within this of the window opening = "sharp" (bonus)
const HOLD_HEAVY = 0.26;          // hold attack this long to start charging a heavy
const PARRY_WIN = { shield: 0.16, parryW: 0.1, grab: 0.12 };
const PARRY_CD = 0.42;
const SLOWMO = { dur: 0.45, scale: 0.3 };
const COUNTER_WIN = 1.4, RIPOSTE_WIN = 1.2;
// light combo strings: w = wind-up, a = active, r = recovery (combo window opens at w+a, closes CHAIN_GRACE after w+a+r)
const MOVES = {
  fists: [
    { n: 'jab', w: 0.07, a: 0.08, r: 0.17, dmg: 1.0, rng: 1.55, arc: 0.9, kb: 2.0, poise: 10, st: 5, lunge: 0.25, sw: 1 },
    { n: 'cross', w: 0.08, a: 0.08, r: 0.19, dmg: 1.3, rng: 1.6, arc: 0.9, kb: 2.5, poise: 12, st: 6, lunge: 0.3, sw: -1 },
    { n: 'hook', w: 0.13, a: 0.1, r: 0.3, dmg: 2.2, rng: 1.7, arc: 1.2, kb: 6, poise: 28, st: 9, lunge: 0.45, fin: true, sw: 1 }
  ],
  sword: [
    { n: 'slash1', w: 0.1, a: 0.1, r: 0.22, dmg: 1.0, arc: 1.15, kb: 3, poise: 14, st: 9, lunge: 0.35, sw: -1 },
    { n: 'slash2', w: 0.09, a: 0.1, r: 0.24, dmg: 1.05, arc: 1.15, kb: 3, poise: 14, st: 9, lunge: 0.35, sw: 1 },
    { n: 'thrust', w: 0.16, a: 0.12, r: 0.36, dmg: 1.7, arc: 0.6, rngB: 0.6, kb: 7, poise: 32, st: 13, lunge: 0.8, fin: true, sw: 0 }
  ],
  sword2: [
    { n: 'sweep1', w: 0.22, a: 0.14, r: 0.36, dmg: 1.0, arc: 1.7, kb: 5, poise: 24, st: 16, lunge: 0.4, sw: -1 },
    { n: 'sweep2', w: 0.26, a: 0.16, r: 0.45, dmg: 1.5, arc: 1.9, kb: 9, poise: 40, st: 20, lunge: 0.55, fin: true, sw: 1 }
  ],
  torch: [
    { n: 'torch1', w: 0.09, a: 0.1, r: 0.24, dmg: 1.0, arc: 1.1, kb: 2.5, poise: 10, st: 8, lunge: 0.3, sw: -1, burn: true },
    { n: 'torch2', w: 0.13, a: 0.12, r: 0.34, dmg: 1.4, arc: 1.3, kb: 5, poise: 20, st: 11, lunge: 0.45, fin: true, sw: 1, burn: true }
  ],
  ride: [
    { n: 'ride', w: 0.08, a: 0.16, r: 0.3, dmg: 1.0, arc: 1.25, kb: 6, poise: 25, st: 8, lunge: 0, sw: 1 }
  ]
};
const CHARGE_FULL = { fists: 0.55, sword: 0.7, torch: 0.65, sword2: 0.85 };
// enemy moves: col 'y' = parryable / blockable, 'r' = unblockable (dodge only)
const EATK = {
  bandit: [{ k: 'melee', wind: 0.5, col: 'y', rng: 1.5, arc: 0.9, dmg: 1.0, rec: 0.6 }],
  soldier: [{ k: 'combo', hits: [{ wind: 0.42, col: 'y', rng: 1.8, arc: 1.0, dmg: 1.0, gap: 0.22 }, { wind: 0.3, col: 'y', rng: 1.8, arc: 1.0, dmg: 0.9, gap: 0.2 }, { wind: 0.72, col: 'y', rng: 2.0, arc: 1.1, dmg: 1.4 }], rec: 0.9 },
    { k: 'melee', wind: 0.45, col: 'y', rng: 1.8, arc: 1.0, dmg: 1.0, rec: 0.7 }],
  pikeman: [{ k: 'line', wind: 0.62, col: 'r', len: 3.9, w: 1.0, dmg: 1.0, rec: 0.9, lunge: 0.8 }],
  musketeer: [{ k: 'shot', aim: 1.05, lock: 0.32, col: 'r', proj: 'ball', spd: 42, dmg: 1.0, rec: 2.4 }],
  archer: [{ k: 'shot', aim: 0.85, lock: 0.26, col: 'y', proj: 'arrow', spd: 26, dmg: 1.0, rec: 1.7 }],
  dragoon: [{ k: 'charge', wind: 0.62, col: 'r', len: 15, w: 1.5, dmg: 1.0, spd: 15, rec: 1.5 }],
  vampire: [{ k: 'lunge', wind: 0.34, col: 'y', len: 5, w: 1.1, dmg: 1.0, rec: 0.55 }, { k: 'grab', wind: 0.58, col: 'r', rng: 1.6, arc: 0.9, dmg: 1.3, rec: 0.9 }, { k: 'melee', wind: 0.3, col: 'y', rng: 1.6, arc: 1.0, dmg: 0.8, rec: 0.5 }],
  witch: [{ k: 'cast', wind: 0.6, col: 'y', rec: 1.5 }, { k: 'aoe', wind: 1.0, col: 'r', rad: 2.3, dmg: 1.1, rec: 1.7 }],
  giant: [{ k: 'slam', wind: 1.1, col: 'r', rad: 5, dmg: 1.0, rec: 1.4 }, { k: 'sweep', wind: 0.8, col: 'y', rng: 4.8, arc: 0.85, dmg: 0.85, rec: 1.1 }, { k: 'throw', wind: 0.9, col: 'r', rad: 2.5, dmg: 0.8, rec: 1.3 }]
};
EATK.frostgiant = EATK.giant;
const POISE = { bandit: 30, soldier: 45, pikeman: 50, musketeer: 30, archer: 30, dragoon: 60, vampire: 50, witch: 40, giant: 230, frostgiant: 250, ally: 60, guard: 70, merchant: 999 };
const STYLE_RANKS = [['D', 0, 1.0], ['C', 120, 1.1], ['B', 300, 1.25], ['A', 520, 1.4], ['S', 800, 1.6]];

function newState() {
  S = {
    mode: 'title', t: 0, day: 1, time: 0.29, darkness: 0, bloodMoon: false,
    ents: [], projs: [], parts: [], texts: [], drops: [], corpses: [], marks: [], msgs: [], banner: null, fx: [], ghosts: [],
    dirT: 6, battle: null, kills: 0, looted: new Set(), lastVillage: { x: 16, y: 16, name: 'Ashford' },
    curBiome: -1, curVillage: null, biomeT: 0, tut: 0, tutStep: 0, tutT: 0, shake: 0, flash: 0, fade: 0, pflash: 0, aim: null, dieT: 0, killer: '',
    interact: null, saveT: 40, flakes: [], horse: { x: 18, y: 3, a: Math.PI * 0.75, state: 'idle', fleeT: 0 },
    slowT: 0, hitstop: 0, style: 0, styleT: 0, tok: new Set(), tokR: new Set(), fxLight: 0, cueT: 0, mouseAim: false
  };
  P = {
    x: 16, y: 6, a: -Math.PI / 2, v: 0, vx: 0, vy: 0, kx: 0, ky: 0, hp: 100, maxHp: 100, mounted: false, r: 0.5, team: 0, isPlayer: true,
    hands: [null, null], armor: 'tunic', inv: [], gold: 10, level: 1, xp: 0, hurtT: 0, invT: 0, step: 0, dead: false, slowT: 0,
    st: 100, stMax: 100, stDelay: 0, act: null, iframes: 0, parryT: 0, parryCd: 0, blockT: 0, blocking: false, counterT: 0, riposteT: 0,
    comboStep: 0, comboT: 0, lock: null, buf: { atk: 0, dash: 0, off: 0 }, atkHeld: false, atkHeldT: 0, offHeld: false, prevAtk: false, prevOff: false,
    gunCd: [0, 0], burstT: 0, ghostT: 0, offStep: 0, inDir: null, drawing: false, draw: 0, chain: 0, chainT: 0
  };
}

// ---------- helpers ----------
const danger = () => Math.hypot(P.x, P.y) / 320 + (S.day - 1) * 0.3;
const dmgMult = () => 1 + 0.07 * (P.level - 1);
const xpNext = () => 40 + P.level * 35;
function twoHanded() { const id = P.hands[1]; return !!(id && ITEMS[id].hands === 2); }
function hasTorch() { return P.hands[0] === 'torch' || P.hands[1] === 'torch'; }
function shieldItem() { for (const id of P.hands) if (id && ITEMS[id].type === 'shield') return ITEMS[id]; return null; }
function msg(txt, col, dur) { S.msgs.unshift({ txt, col: col || '#e8dcc0', t: dur || 4.5 }); if (S.msgs.length > 3) S.msgs.length = 3; }
function banner(title, sub, t, col) { S.banner = { title, sub: sub || '', t: t || 4, col: col || '#e8c050' }; }
function addText(x, y, elev, s, col, big) { S.texts.push({ x, y, elev, s, col, t: 1.0, big: !!big }); if (S.texts.length > 40) S.texts.shift(); }
function part(x, y, elev, vx, vy, vz, life, ch, col, g, em, sz) {
  if (S.parts.length > 420) S.parts.shift();
  S.parts.push({ x, y, elev, vx, vy, vz, t: life, ch, col, g: g === undefined ? 14 : g, em: !!em, sz: sz || 0 });
}
function burst(x, y, elev, col, n, chars, spd, em, sz) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(0.5, spd || 4); part(x, y, elev, Math.cos(a) * s, Math.sin(a) * s, rr(1, 5), rr(0.3, 0.8), chars ? pick(chars) : (Math.random() < 0.5 ? '*' : '.'), col, 14, em, sz); }
}
function fx(o) { o.t = 0; S.fx.push(o); if (S.fx.length > 80) S.fx.shift(); return o; }
function sparks(x, y, elev, col, n, big) { for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(2, 7); part(x, y, elev, Math.cos(a) * s, Math.sin(a) * s, rr(1, 4), rr(0.15, 0.32), '+', col || '!#fff4c0', 6, true, big ? 0.55 : 0.36); } }
// keyboard / touch labels for prompts
function btnName(k) { const t = typeof IS_TOUCH !== 'undefined' && IS_TOUCH; return t ? ({ atk: 'ATTACK', off: 'BLOCK', dash: 'DASH', lock: 'LOCK' })[k] : ({ atk: 'J / click', off: 'K / right-click', dash: 'Space', lock: 'L / Tab' })[k]; }

// ---------- style rank ----------
function styleRank() { let r = STYLE_RANKS[0]; for (const x of STYLE_RANKS) if (S.style >= x[1]) r = x; return r; }
function styleMult() { return styleRank()[2]; }
function styleAdd(n) { const before = styleRank()[0]; S.style = Math.min(1100, S.style + n); S.styleT = 3; const after = styleRank()[0]; if (after !== before && n > 0) { S.rankPop = 1; if (after === 'S' || after === 'A') sfx('rank'); } }
function styleHit() { const i = STYLE_RANKS.indexOf(styleRank()); S.style = Math.max(0, Math.min(S.style * 0.4, i > 0 ? STYLE_RANKS[i - 1][1] : 0)); S.styleT = 0; }

// ---------- inventory ----------
function invAdd(id, n) {
  n = n || 1; const it = ITEMS[id];
  if (it.stack) { const s = P.inv.find(q => q.id === id); if (s) { s.n += n; return true; } }
  if (P.inv.length >= INV_MAX) return false;
  P.inv.push({ id, n: it.stack ? n : 1 }); return true;
}
function invCount(id) { const s = P.inv.find(q => q.id === id); return s ? s.n : 0; }
function invTake(id, n) {
  n = n || 1; const i = P.inv.findIndex(q => q.id === id); if (i < 0) return false;
  const s = P.inv[i]; if (ITEMS[id].stack) { if (s.n < n) return false; s.n -= n; if (s.n <= 0) P.inv.splice(i, 1); } else P.inv.splice(i, 1);
  return true;
}
function giveOrDrop(id, n) { if (!invAdd(id, n)) { dropItem(P.x, P.y, id, n || 1, true); msg('Bag full — ' + ITEMS[id].name + ' dropped.', '#ff9a7a'); } }
function unequipHand(side) {
  const id = P.hands[side]; if (!id) return;
  if (ITEMS[id].hands === 2) { P.hands = [null, null]; giveOrDrop(id); return; }
  P.hands[side] = null; giveOrDrop(id);
}
function equipFromInv(idx, side) {
  const s = P.inv[idx]; if (!s) return; const it = ITEMS[s.id];
  if (it.type === 'armor') { P.inv.splice(idx, 1); const old = P.armor; P.armor = s.id; if (old) giveOrDrop(old); sfx('equip'); return; }
  if (it.type === 'potion') { drinkPotion(); return; }
  if (it.type === 'ammo') return;
  P.inv.splice(idx, 1);
  if (it.hands === 2) { const a = P.hands[0], b = P.hands[1]; const was2 = twoHanded(); P.hands = [s.id, s.id]; if (was2) giveOrDrop(b); else { if (a) giveOrDrop(a); if (b) giveOrDrop(b); } }
  else { if (twoHanded()) { const b = P.hands[1]; P.hands = [null, null]; giveOrDrop(b); } else if (P.hands[side]) giveOrDrop(P.hands[side]); P.hands[side] = s.id; }
  P.act = null; P.comboStep = 0; sfx('equip');
}
function autoEquip(id) {
  const it = ITEMS[id];
  const idx = P.inv.findIndex(q => q.id === id);
  if (idx < 0) return false;
  if ((it.type === 'sword' || it.type === 'torch' || it.type === 'gun') && !P.hands[1]) { equipFromInv(idx, 1); return true; }
  if (it.type === 'shield' && !P.hands[0] && !twoHanded()) { equipFromInv(idx, 0); return true; }
  if (it.hands === 2 && !P.hands[0] && !P.hands[1]) { equipFromInv(idx, 1); return true; }
  if (it.type === 'armor' && P.armor === 'tunic') { equipFromInv(idx, 0); return true; }
  return false;
}
function drinkPotion() {
  if (invCount('potion') <= 0) { msg('No potions.', '#ff9a7a'); return; }
  if (P.hp >= P.maxHp) { msg('You are already at full health.'); return; }
  invTake('potion'); P.hp = Math.min(P.maxHp, P.hp + ITEMS.potion.heal);
  sfx('potion'); addText(P.x, P.y, 2.2, '+' + ITEMS.potion.heal, '#6aff7a');
  for (let i = 0; i < 8; i++) part(P.x + rr(-0.5, 0.5), P.y + rr(-0.5, 0.5), rr(0.5, 2), 0, 0, rr(1, 3), 0.7, '+', '#6aff7a', 0, true);
}
function dropItem(x, y, id, n, lock) { S.drops.push({ kind: 'item', id, n: n || 1, x: x + rr(-0.8, 0.8), y: y + rr(-0.8, 0.8), t: 90, warn: 0, lock: !!lock }); }
function dropGold(x, y, val) {
  const pieces = clamp(Math.ceil(val / 6), 1, 6);
  for (let i = 0; i < pieces; i++) S.drops.push({ kind: 'gold', val: Math.ceil(val / pieces), x: x + rr(-1, 1), y: y + rr(-1, 1), t: 60 });
}
function rollLoot(token, D) {
  const tier = clamp(Math.floor(D * 0.9 + rr(-0.6, 0.9)), 0, 4);
  if (token === '$sword') return TIER.sword[tier];
  if (token === '$armor') return TIER.armor[tier];
  if (token === '$bow') return TIER.bow[tier];
  if (token === '$shield') return TIER.shield[tier];
  if (token === '$any') { const k = pick(['sword', 'sword', 'armor', 'bow', 'shield']); return TIER[k][tier]; }
  return token;
}

// ---------- entities ----------
function spawnEnt(kind, x, y, opt) {
  const k = KINDS[kind], D = (opt && opt.D !== undefined) ? opt.D : danger();
  const hpM = k.team === 1 ? 1 + 0.25 * D : 1, pm = (POISE[kind] || 40) * (k.team === 1 ? 1 + 0.12 * D : 1);
  const e = {
    kind, k, x, y, a: rr(0, TAU), hp: k.hp * hpM, maxHp: k.hp * hpM, dmgM: k.team === 1 ? 1 + 0.15 * D : 1, team: k.team, r: k.r,
    kx: 0, ky: 0, cd: rr(0.6, 1.6), state: 'move', wt: 0, target: null, tT: 0, hurtT: 0, invT: 0, elev: 0, seed: Math.random() * 100,
    strafe: Math.random() < 0.5 ? 1 : -1, tpCd: 0, throwCd: rr(2, 4), passT: 0, trampleCd: 0, spd: 0, dead: false, downT: 0, burnT: 0, burnDps: 0, moving: false, D,
    poise: pm, poiseMax: pm, poiseT: 0, atk: null, wdir: 0, hitIdx: 0, rt: 0, stT: 0, tele: 0
  };
  if (opt) Object.assign(e, opt);
  S.ents.push(e); return e;
}
function spawnNear(kind, x, y, spread, opt) { const p = findFree(x, y, KINDS[kind].r, spread || 3); return spawnEnt(kind, p[0], p[1], opt); }
function onChunkCreated(c) {
  if (c.spawnVillage && S) {
    const v = c.spawnVillage;
    spawnEnt('merchant', v.x + 2.6, v.y - 0.4, { home: c.key, village: v, a: Math.PI / 2 });
    for (let i = 0; i < 2; i++) { const a = v.gap + (i ? 0.35 : -0.35); spawnEnt('guard', v.x + Math.cos(a) * 6.5, v.y + Math.sin(a) * 6.5, { home: c.key, post: { x: v.x + Math.cos(a) * 6.5, y: v.y + Math.sin(a) * 6.5 } }); }
  }
}
function onChunkRemoved(c) { for (const e of S.ents) if (e.home === c.key) e.dead = true; if (typeof freeChunkTex === 'function') freeChunkTex(c); }

function pickTarget(e) {
  let best = null, bd = 1e9;
  if (e.team === 1) {
    if (S.mode === 'play' && P.hp > 0) { bd = dist(e, P) * (e.k.prefP || 0.85); best = P; }
    for (const a of S.ents) { if (a.team !== 0 || a.dead) continue; const d = dist(e, a); if (d < bd) { bd = d; best = a; } }
    if (bd > 70) best = null;
  } else if (e.team === 0) {
    const ref = e.post || e;
    for (const a of S.ents) { if (a.team !== 1 || a.dead) continue; const d = dist(ref, a); if (d < bd) { bd = d; best = a; } }
    if (e.post && bd > 20) best = null;
    if (!e.post && bd > 45) best = null;
  }
  return best;
}
function moveToward(e, tx, ty, spd, dt) {
  let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx, dy) || 1; let ux = dx / d, uy = dy / d;
  if (blockedAt(e.x + ux * 1.6, e.y + uy * 1.6, e.r)) { const s = e.strafe, ca = Math.cos(1.0 * s), sa = Math.sin(1.0 * s); const nx = ux * ca - uy * sa, ny = ux * sa + uy * ca; ux = nx; uy = ny; }
  const t = tileAt(e.x, e.y); const slow = (t === T_WATER || t === T_BOG) ? 0.6 : t === T_DRIFT ? 0.8 : 1;
  e.x += ux * spd * slow * dt; e.y += uy * spd * slow * dt; e.a = Math.atan2(uy, ux); e.moving = true;
}
function blinkTo(e, x, y) {
  if (blockedAt(x, y, e.r)) return false;
  burst(e.x, e.y, 1, '#b060e0', 10, ['*', '.', '~'], 3, true);
  e.x = x; e.y = y; e.invT = 0.3;
  burst(e.x, e.y, 1, '#b060e0', 10, ['*', '.', '~'], 3, true);
  if (dist(e, P) < 30) sfx('poof');
  return true;
}

// ---------- attack tokens (only 1-2 foes may wind up on the player at once) ----------
function tokCap(ranged) { return ranged ? 2 : (danger() < 0.6 ? 1 : 2); }
function tokClean() { for (const set of [S.tok, S.tokR]) for (const e of set) if (e.dead || !S.ents.includes(e) || (e.state !== 'wind' && e.state !== 'aim' && e.state !== 'gallop' && e.state !== 'lunge')) set.delete(e); }
function tokTake(e, t) {
  if (!t || !t.isPlayer || e.k.boss) return true;
  const ranged = e.k.ai === 'ranged' || e.k.ai === 'caster', set = ranged ? S.tokR : S.tok;
  if (set.has(e)) return true;
  if (set.size >= tokCap(ranged)) return false;
  set.add(e); return true;
}
function tokFree(e) { S.tok.delete(e); S.tokR.delete(e); }

// ---------- enemy combat (telegraphed, fair, punishable) ----------
const inArc = (e, t, rng, arc, dir) => { const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) - (t.r || 0.5); return d <= rng && (Math.abs(angDiff(dir, Math.atan2(dy, dx))) <= arc || d < 0.4); };
const inLine = (e, t, len, w, dir) => { const dx = t.x - e.x, dy = t.y - e.y, c = Math.cos(dir), s = Math.sin(dir), along = dx * c + dy * s, perp = -dx * s + dy * c; return along > -0.4 && along < len + (t.r || 0.5) && Math.abs(perp) < w / 2 + (t.r || 0.5); };
const inCircle = (x, y, t, rad) => Math.hypot(t.x - x, t.y - y) < rad + (t.r || 0.5);
// strike every valid target inside a shape; returns true when the player was hit
function strike(e, test, dmg, col, opts) {
  opts = opts || {}; let hitP = false;
  if (S.mode === 'play') {
    // a dash whose i-frames cover the impact, started inside the hitbox, is a perfect dodge
    const da = P.act, dodging = P.iframes > 0 && da && da.k === 'dash';
    if (dodging && (test(P) || test({ x: da.sx, y: da.sy, r: P.r }))) perfectDodge(e);
    else if (test(P)) hitP = strikePlayer(e, dmg, col, opts);
  }
  for (const a of S.ents) if (a.team === 0 && !a.dead && test(a)) hurtEnt(a, dmg, e.x, e.y, opts.kb || 3, false);
  return hitP;
}
function frontOf(src) { return Math.abs(angDiff(P.a, Math.atan2(src.y - P.y, src.x - P.x))) < 1.45; }
function strikePlayer(e, dmg, col, opts) {
  if (P.iframes > 0) { perfectDodge(e); return false; }
  if (col === 'y' && P.parryT > 0 && frontOf(e)) { parryFoe(e); return false; }
  if (col === 'y' && P.blocking && frontOf(e)) { blockHit(dmg, e, opts); return true; }
  hurtPlayer(dmg, e, opts); return true;
}
function perfectDodge(src) {
  if (S.slowT > 0.2) return;
  S.slowT = SLOWMO.dur; P.counterT = COUNTER_WIN; P.st = Math.min(P.stMax, P.st + 25); S.pflash = 0.35;
  addText(P.x, P.y, 2.6, 'PERFECT!', '#7af0ff', true); styleAdd(40); sfx('perfect');
  fx({ k: 'ring', x: P.x, y: P.y, h: 0.9, r0: 0.4, r1: 3.2, dur: 0.45, col: [0.5, 0.95, 1, 0.9] });
  if (S.tut === 0 && S.tutStep === 2) tutStepDone();
}
function parryFoe(e) {
  S.hitstop = 0.12; styleAdd(45); sfx('parry');
  const mx = (P.x + e.x) / 2, my = (P.y + e.y) / 2; sparks(mx, my, 1.3, '!#fff4c0', 14, true);
  fx({ k: 'ring', x: mx, y: my, h: 1.2, r0: 0.2, r1: 1.8, dur: 0.3, col: [1, 0.95, 0.6, 1] });
  const kind = offKind();
  if (kind === 'grab' && !e.k.boss && !e.k.mounted && !e.k.hover) {
    P.act = { k: 'grab', t: 0, dur: 0.55, tgt: e }; e.state = 'stagger'; e.stT = 0.6; tokFree(e);
    addText(P.x, P.y, 2.4, 'GRAB!', '#ffd84a', true);
  } else {
    if (e.k.boss) { e.poise -= e.poiseMax * 0.4; if (e.poise <= 0) staggerFoe(e, 2.6, true); else { e.state = 'rec'; e.rt = 0.8; } }
    else staggerFoe(e, 1.3);
    P.riposteT = RIPOSTE_WIN; addText(P.x, P.y, 2.4, 'PARRY!', '#ffe070', true);
  }
  P.parryT = 0;
  if (S.tut === 0 && S.tutStep === 1) tutStepDone();
}
function blockHit(dmg, e, opts) {
  const sh = shieldItem() || { block: 0.4 };
  const taken = dmg * (1 - sh.block) * (opts.heavy ? 1.6 : 1);
  P.st -= dmg * (2.05 - sh.block) * 0.9; P.stDelay = 0.8; sfx('block');
  sparks(P.x + Math.cos(P.a) * 0.7, P.y + Math.sin(P.a) * 0.7, 1.1, '!#ffe6a0', 6);
  if (P.st <= 0) { P.st = 0; P.blocking = false; P.act = { k: 'stun', t: 0, dur: 0.8 }; addText(P.x, P.y, 2.4, 'GUARD BREAK', '#ff7a5a', true); sfx('hurt'); }
  hurtPlayer(taken, e, Object.assign({}, opts, { blocked: true }));
}
function staggerFoe(e, dur, big) {
  e.state = 'stagger'; e.stT = dur; e.atk = null; e.poise = e.poiseMax; tokFree(e);
  if (big) { addText(e.x, e.y, e.k.h + 0.6, 'BROKEN!', '#ff9a3a', true); S.shake = Math.max(S.shake, 0.4); sfx('takedown'); }
}
function beginFoeAttack(e, a, t) {
  e.atk = a; e.wt = 0; e.hitIdx = 0; e.locked = false; e.wdir = Math.atan2(t.y - e.y, t.x - e.x); e.tgt = t;
  e.state = a.k === 'shot' ? 'aim' : 'wind';
  if (a.k === 'aoe') e.aoe = { x: t.x, y: t.y };
  if (a.k === 'throw') {
    const d = dist(e, t), T = clamp(d / 13, 0.9, 2.2);
    e.aoe = { x: t.x + (t.isPlayer ? P.vx * T * 0.4 : 0), y: t.y + (t.isPlayer ? P.vy * T * 0.4 : 0), T };
  }
  if (a.col === 'r' && dist(e, P) < 30) sfx('tele');
}
function foeWind(a, i) { return a.k === 'combo' ? a.hits[i].wind : a.wind; }
function resolveFoe(e, t) {
  const a = e.atk, k = e.k, dm = k.dmg * e.dmgM;
  e.swingAt = S.t; e.lastK = a.k; e.swSide = -(e.swSide || 1);
  switch (a.k) {
    case 'melee': case 'grab': case 'sweep': {
      const hit = a.k === 'combo' ? a.hits[e.hitIdx] : a;
      const got = strike(e, q => inArc(e, q, hit.rng * (k.boss ? 1 : 1), hit.arc, e.wdir), dm * hit.dmg, hit.col, { heavy: k.boss });
      fx({ k: 'slash', x: e.x, y: e.y, h: k.boss ? 3 : 1.1, dir: e.wdir, arc: hit.arc, r: hit.rng * 0.9, side: 1, dur: 0.18, col: a.col === 'r' ? [1, 0.4, 0.3, 0.8] : [1, 1, 1, 0.7] });
      if (got && a.k === 'grab') { e.hp = Math.min(e.maxHp, e.hp + dm * hit.dmg * 0.8); addText(e.x, e.y, 2.2, 'DRAIN', '#ff4a6a'); }
      if (dist(e, P) < 25) sfx(k.spr === 'bandit' ? 'punch' : 'clang');
      break;
    }
    case 'combo': {
      const hit = a.hits[e.hitIdx];
      strike(e, q => inArc(e, q, hit.rng, hit.arc, e.wdir), dm * hit.dmg, hit.col, {});
      fx({ k: 'slash', x: e.x, y: e.y, h: 1.1, dir: e.wdir, arc: hit.arc, r: hit.rng * 0.9, side: e.hitIdx % 2 ? -1 : 1, dur: 0.18, col: [1, 1, 1, 0.7] });
      if (dist(e, P) < 25) sfx('clang');
      if (e.hitIdx < a.hits.length - 1) { e.hitIdx++; e.wt = -(hit.gap || 0.2); return; }
      break;
    }
    case 'line': {
      e.x += Math.cos(e.wdir) * (a.lunge || 0); e.y += Math.sin(e.wdir) * (a.lunge || 0); collide(e, e.r);
      strike(e, q => inLine(e, q, a.len, a.w, e.wdir), dm * a.dmg, a.col, { kb: 5 });
      fx({ k: 'thrust', x: e.x, y: e.y, dir: e.wdir, len: a.len, dur: 0.2, col: [1, 0.95, 0.8, 0.9] });
      if (dist(e, P) < 25) sfx('swing');
      break;
    }
    case 'lunge': {
      const sx = e.x, sy = e.y, L = Math.min(a.len, Math.max(0, dist(e, t) - 0.6));
      const ox = e.x, oy = e.y; e.x += Math.cos(e.wdir) * L; e.y += Math.sin(e.wdir) * L; collide(e, e.r);
      strike({ x: sx, y: sy, k: e.k, dmgM: e.dmgM }, q => inLine({ x: sx, y: sy }, q, L + 1.2, a.w, e.wdir), dm * a.dmg, a.col, {});
      burst(ox, oy, 1, '#6a2a7a', 8, ['*', '.'], 3, true);
      if (dist(e, P) < 25) sfx('hiss');
      break;
    }
    case 'slam': {
      S.shake = Math.max(S.shake, dist(e, P) < 25 ? 0.7 : 0.2); sfx('slam');
      for (let i = 0; i < 28; i++) { const an = i / 28 * TAU; part(e.x + Math.cos(an) * 1.5, e.y + Math.sin(an) * 1.5, 0.2, Math.cos(an) * 9, Math.sin(an) * 9, 2, 0.5, pick(['*', '.', 'o']), k.frost ? '#c8f0ff' : '#c8a878', 10); }
      fx({ k: 'ring', x: e.x, y: e.y, h: 0.2, r0: 1, r1: a.rad + 0.5, dur: 0.35, col: k.frost ? [0.8, 0.95, 1, 0.9] : [1, 0.85, 0.6, 0.9] });
      const hitP = strike(e, q => inCircle(e.x, e.y, q, a.rad), dm * a.dmg, a.col, { dismount: true, heavy: true, kb: 9 });
      if (hitP) { const an = Math.atan2(P.y - e.y, P.x - e.x); P.kx += Math.cos(an) * 9; P.ky += Math.sin(an) * 9; if (k.frost) { P.slowT = 3; msg('Frozen! You are slowed.', '#9ae0ff'); } }
      break;
    }
    case 'aoe': {
      const o = e.aoe; fx({ k: 'ring', x: o.x, y: o.y, h: 0.2, r0: 0.3, r1: a.rad + 0.4, dur: 0.4, col: [0.6, 1, 0.4, 0.95] });
      for (let i = 0; i < 18; i++) part(o.x + rr(-1.5, 1.5), o.y + rr(-1.5, 1.5), 0.2, 0, 0, rr(4, 8), rr(0.4, 0.8), '*', '#8aff5a', 9, true, 0.45);
      strike(e, q => inCircle(o.x, o.y, q, a.rad), dm * a.dmg, a.col, { kb: 4 });
      sfx('fire');
      break;
    }
    case 'cast': {
      const an = e.wdir;
      S.projs.push({ x: e.x, y: e.y, elev: e.elev + 1.2, vx: Math.cos(an) * 11, vy: Math.sin(an) * 11, vz: 0, team: 1, dmg: dm, life: 4, kind: 'fire', col: 'y', target: t, src: e });
      if (dist(e, P) < 35) sfx('fire');
      break;
    }
    case 'throw': {
      const o = e.aoe, T = o.T, z0 = 5, g = 18;
      S.projs.push({ x: e.x, y: e.y, elev: z0, vx: (o.x - e.x) / T, vy: (o.y - e.y) / T, vz: (-z0 + 0.5 * g * T * T) / T, team: 1, dmg: dm * a.dmg, life: T + 0.6, kind: 'boulder', src: e, frost: k.frost, col: 'r', rad: a.rad });
      S.marks.push({ x: o.x, y: o.y, t: T, T0: T, rad: a.rad }); e.throwCd = rr(4.5, 6.5);
      break;
    }
    case 'charge': e.state = 'gallop'; e.gT = a.len / a.spd; e.hitDone = false; return;
  }
  e.state = 'rec'; e.rt = a.rec * rr(0.9, 1.15); e.cd = k.cd * rr(0.8, 1.2); tokFree(e);
}
function chooseFoeAttack(e, t, d) {
  const A = EATK[e.kind]; if (!A) return null;
  switch (e.kind) {
    case 'vampire': return d > 2.6 && d < 5.4 ? A[0] : d < 1.9 ? (Math.random() < 0.35 ? A[1] : A[2]) : null;
    case 'witch': return d < 14 && Math.random() < 0.4 ? A[1] : A[0];
    case 'giant': case 'frostgiant': {
      if (d < A[0].rad + 0.3 && Math.random() < 0.55) return A[0];
      if (d < A[1].rng + 0.5 && Math.abs(angDiff(e.a, Math.atan2(t.y - e.y, t.x - e.x))) < 1.2) return A[1];
      if (d > 9 && d < 28 && e.throwCd <= 0) return A[2];
      return d < A[0].rad + 0.3 ? A[0] : null;
    }
    case 'soldier': return Math.random() < 0.6 ? A[0] : A[1];
    default: return A[0];
  }
}
function foeRange(e) {
  switch (e.kind) {
    case 'bandit': return 1.5; case 'soldier': return 1.9; case 'pikeman': return 3.4; case 'vampire': return 4.6;
    case 'giant': case 'frostgiant': return 4.5; default: return 1.8;
  }
}
function updateFoe(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  switch (e.state) {
    case 'stagger': e.stT -= dt; if (e.stT <= 0) { e.state = 'move'; e.cd = 0.4; } return;
    case 'rec': e.rt -= dt; if (e.rt <= 0) { e.state = 'move'; tokFree(e); } return;
    case 'wind': {
      const a = e.atk, W = foeWind(a, e.hitIdx);
      e.wt += dt;
      if (a.k !== 'slam' && a.k !== 'aoe' && a.k !== 'throw' && e.wt < W * 0.6) e.wdir += clamp(angDiff(e.wdir, ang), -6 * dt, 6 * dt);
      e.a = e.wdir;
      if (e.wt >= W) resolveFoe(e, t);
      return;
    }
    case 'aim': {
      const a = e.atk; e.wt += dt;
      if (e.wt < a.aim - a.lock) { e.wdir += clamp(angDiff(e.wdir, ang), -5 * dt, 5 * dt); }
      else if (!e.locked) { e.locked = true; if (dist(e, P) < 35) sfx('tele'); }
      e.a = e.wdir;
      if (e.wt >= a.aim) {
        const an = e.wdir, sp = a.spd;
        S.projs.push({ x: e.x + Math.cos(an) * 0.7, y: e.y + Math.sin(an) * 0.7, elev: 1.25, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, vz: 0, team: 1, dmg: k.dmg * e.dmgM * a.dmg, life: 1.4, kind: a.proj, col: a.col, src: e });
        if (a.proj === 'ball') { burst(e.x + Math.cos(an), e.y + Math.sin(an), 1.4, '#e8e8e8', 6, ['o', '.'], 1.5); sparks(e.x + Math.cos(an) * 1.1, e.y + Math.sin(an) * 1.1, 1.3, '!#ffd080', 5); if (dist(e, P) < 40) sfx('musket'); }
        else if (dist(e, P) < 30) sfx('bow');
        e.state = 'rec'; e.rt = a.rec * rr(0.9, 1.2); e.cd = k.cd * rr(0.9, 1.2); tokFree(e);
      }
      return;
    }
    case 'gallop': {
      const a = e.atk, c = Math.cos(e.wdir), s = Math.sin(e.wdir);
      e.x += c * a.spd * dt; e.y += s * a.spd * dt; e.a = e.wdir; e.moving = true; e.gT -= dt;
      if (Math.random() < dt * 14) part(e.x - c, e.y - s, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.4, '.', '#c8b898', 6);
      if (!e.hitDone) { const hit = strike(e, q => inCircle(e.x, e.y, q, 1.25), k.dmg * e.dmgM * a.dmg, a.col, { dismount: true, kb: 7 }); if (hit || dist(e, P) < 1.25 + P.r) e.hitDone = true; }
      if (e.gT <= 0 || collide(e, e.r)) { e.state = 'rec'; e.rt = a.rec; e.cd = 0.6; tokFree(e); }
      return;
    }
  }
  // positioning
  const A = EATK[e.kind], want = foeRange(e);
  const canAtk = e.cd <= 0;
  if (k.ai === 'ranged') {
    if (d > 14) moveToward(e, t.x, t.y, k.spd, dt);
    else if (d < 7) moveToward(e, e.x - dx, e.y - dy, k.spd * 0.8, dt);
    else { moveToward(e, e.x - dy / d * e.strafe * 3, e.y + dx / d * e.strafe * 3, k.spd * 0.45, dt); if (Math.random() < dt * 0.3) e.strafe *= -1; }
    if (canAtk && d < k.range && tokTake(e, t)) beginFoeAttack(e, A[0], t);
    return;
  }
  if (k.ai === 'caster') {
    if (d < 5 && e.tpCd <= 0) { const a = rr(0, TAU), rd = rr(11, 15); blinkTo(e, t.x + Math.cos(a) * rd, t.y + Math.sin(a) * rd); e.tpCd = 5; return; }
    if (d > 14) moveToward(e, t.x, t.y, k.spd, dt);
    else if (d < 9) moveToward(e, e.x - dx, e.y - dy, k.spd, dt);
    else { moveToward(e, e.x - dy / d * e.strafe * 3, e.y + dx / d * e.strafe * 3, k.spd * 0.5, dt); if (Math.random() < dt * 0.4) e.strafe *= -1; }
    if (canAtk && d < k.range && tokTake(e, t)) { beginFoeAttack(e, chooseFoeAttack(e, t, d), t); if (Math.random() < 0.4 && dist(e, P) < 30) sfx('cackle'); }
    return;
  }
  if (k.ai === 'cavalry') {
    if (d < 9 && e.passT <= 0) { e.passT = 1.4; e.away = ang + Math.PI + rr(-0.6, 0.6); }
    if (e.passT > 0) { e.passT -= dt; moveToward(e, e.x + Math.cos(e.away) * 4, e.y + Math.sin(e.away) * 4, k.spd * 0.8, dt); return; }
    if (d > 16) { moveToward(e, t.x, t.y, k.spd * 0.85, dt); return; }
    e.a += clamp(angDiff(e.a, ang), -3 * dt, 3 * dt);
    if (canAtk && tokTake(e, t)) beginFoeAttack(e, A[0], t);
    return;
  }
  // melee + giants: approach, or circle at a distance when another foe holds the attack token
  if (d > want * 0.9) {
    const hasTok = !t.isPlayer || k.boss || S.tok.has(e) || S.tok.size < tokCap(false);
    if (hasTok || d > 4.6) moveToward(e, t.x, t.y, k.spd, dt);
    else { const orb = Math.atan2(e.y - t.y, e.x - t.x) + e.strafe * 0.8; moveToward(e, t.x + Math.cos(orb) * 4, t.y + Math.sin(orb) * 4, k.spd * 0.55, dt); if (Math.random() < dt * 0.25) e.strafe *= -1; e.a = ang; }
  } else e.a += clamp(angDiff(e.a, ang), -5 * dt, 5 * dt);
  if (canAtk && d < want + 0.4) {
    const a = chooseFoeAttack(e, t, d);
    if (a && tokTake(e, t)) beginFoeAttack(e, a, t);
  }
}
// allies and guards: simple brawlers
function updateAlly(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy), reach = k.range + (t.r || 0.5) + e.r * 0.5;
  if (e.state === 'wind') { e.wt -= dt; e.a = Math.atan2(dy, dx); if (e.wt <= 0) { e.state = 'move'; e.cd = k.cd * rr(0.85, 1.15); if (d < reach + 0.5) { hurtEnt(t, k.dmg * e.dmgM, e.x, e.y, 3, false); fx({ k: 'slash', x: e.x, y: e.y, h: 1.1, dir: e.a, arc: 1, r: 1.6, side: 1, dur: 0.16, col: [1, 1, 1, 0.5] }); if (dist(e, P) < 20) sfx('clang'); } } return; }
  if (d > reach * 0.8) moveToward(e, t.x, t.y, k.spd, dt);
  if (d < reach && e.cd <= 0) { e.state = 'wind'; e.wt = k.wind; }
}
function updateEnt(e, dt) {
  const k = e.k;
  e.cd -= dt; e.hurtT -= dt; e.invT -= dt; e.tpCd -= dt; e.throwCd -= dt; e.trampleCd -= dt; e.tT -= dt; e.moving = false; e.poiseT -= dt;
  if (e.poiseT <= 0 && e.poise < e.poiseMax) e.poise = Math.min(e.poiseMax, e.poise + e.poiseMax * 0.3 * dt);
  if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; const f = Math.pow(0.004, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 0.08) { e.kx = 0; e.ky = 0; } }
  if (e.burnT > 0) {
    e.burnT -= dt; e.burnTick = (e.burnTick || 0) - dt;
    if (e.burnTick <= 0) { e.burnTick = 0.5; hurtEnt(e, e.burnDps * 0.5, e.x, e.y, 0, true, true); }
    if (Math.random() < dt * 12) part(e.x + rr(-0.4, 0.4), e.y + rr(-0.4, 0.4), rr(0.5, 1.8), 0, 0, 2, 0.35, pick(FLAME), '#ff8a2a', 0, true);
    if (e.dead) return;
  }
  if (k.ai === 'none') { e.a = Math.atan2(P.y - e.y, P.x - e.x); return; }
  if (e.downT > 0) { e.downT -= dt; e.state = 'move'; e.atk = null; tokFree(e); return; }
  const busy = e.state === 'wind' || e.state === 'aim' || e.state === 'gallop' || e.state === 'rec' || e.state === 'stagger';
  if (!busy && (e.tT <= 0 || !e.target || e.target.dead || (e.target.isPlayer && S.mode !== 'play'))) { e.target = pickTarget(e); e.tT = 0.4 + Math.random() * 0.3; }
  let t = e.target;
  if (busy && (!t || t.dead || (t.isPlayer && S.mode !== 'play'))) { if (e.state !== 'stagger') { e.state = 'move'; e.atk = null; tokFree(e); } t = null; }
  if (k.hover) e.elev = k.hover + Math.sin(S.t * 2.3 + e.seed) * 0.35;
  if (!t) {
    if (e.state !== 'stagger') e.state = 'move';
    else { e.stT -= dt; if (e.stT <= 0) e.state = 'move'; }
    if (e.post) { if (Math.hypot(e.post.x - e.x, e.post.y - e.y) > 1.5) moveToward(e, e.post.x, e.post.y, k.spd * 0.7, dt); }
    else if (e.team === 0) { if (e.leave) moveToward(e, e.x + Math.cos(e.leave) * 5, e.y + Math.sin(e.leave) * 5, k.spd * 0.8, dt); else if (dist(e, P) > 6) moveToward(e, P.x, P.y, k.spd, dt); }
    else if (e.team === 1 && S.mode === 'play' && dist(e, P) < 90) moveToward(e, P.x, P.y, k.spd * 0.6, dt);
    collide(e, e.r); return;
  }
  if (e.team === 1) updateFoe(e, t, dt); else updateAlly(e, t, dt);
  if (e.post && Math.hypot(e.post.x - e.x, e.post.y - e.y) > 24) e.target = null;
  collide(e, e.r);
}

function hurtEnt(e, amt, sx, sy, kb, byPlayer, silent, opt) {
  if (e.dead || e.invT > 0 || e.team === 2) return;
  opt = opt || {};
  if (e.tut && S.tutStep < 3 && e.hp - amt < 1) amt = Math.max(0, e.hp - 1);
  e.hp -= amt; if (!silent) e.hurtT = 0.12;
  if (kb) { const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, m = e.k.boss ? 0.12 : e.k.mounted ? 0.5 : 1; e.kx += dx / d * kb * m; e.ky += dy / d * kb * m; }
  if (byPlayer && !silent) addText(e.x, e.y, e.k.h + 0.4 + e.elev, String(Math.round(amt)) + (opt.crit ? '!' : ''), opt.crit ? '#ff9a3a' : '#ffffff', opt.crit);
  if (!silent) burst(e.x, e.y, e.k.h * 0.6 + e.elev, e.k.blood || '#e04a3a', 4, null, 3);
  if (byPlayer && e.team === 1 && !e.target) e.target = P;
  if (e.hp <= 0) { killEnt(e, byPlayer); return; }
  if (byPlayer && e.team === 1) {
    // early hits interrupt a wind-up (punish window); late ones trade
    if (e.state === 'wind' && !e.k.boss && e.atk && e.wt / Math.max(0.01, foeWind(e.atk, e.hitIdx)) < 0.5) { e.state = 'rec'; e.rt = 0.45; tokFree(e); }
    if (opt.interrupt && (e.state === 'wind' || e.state === 'aim')) { staggerFoe(e, 0.9); addText(e.x, e.y, e.k.h + 0.9, 'INTERRUPT!', '#7af0ff', true); styleAdd(25); }
    if (opt.poise) { e.poise -= opt.poise; e.poiseT = 1.5; if (e.poise <= 0 && e.state !== 'stagger') staggerFoe(e, e.k.boss ? 2.6 : 1.0, e.k.boss); }
    if (opt.gb && !e.k.boss && e.state !== 'stagger') staggerFoe(e, 1.1);
  }
  if (e.k.blink && e.tpCd <= 0 && Math.random() < 0.3 && byPlayer && e.state !== 'stagger') { const a = P.a + Math.PI + rr(-0.6, 0.6); if (blinkTo(e, P.x + Math.cos(a) * 2.4, P.y + Math.sin(a) * 2.4)) { e.tpCd = 3.5; e.state = 'move'; e.cd = 0.25; } }
}
function killEnt(e, byPlayer) {
  e.dead = true; const k = e.k; tokFree(e);
  if (P.lock === e) P.lock = null;
  if (e.team === 1) {
    S.kills++;
    const D = e.D || 0, sm = byPlayer ? styleMult() : 1;
    dropGold(e.x, e.y, Math.round(k.gold * (1 + 0.3 * D) * rr(0.7, 1.3) * sm));
    if (e.tut) { dropItem(e.x, e.y, 'rusty_sword'); if (S.tut === 0) { S.tutStep = 9; tutAdvance(); } }
    else if (k.loot) for (const L of k.loot) if (Math.random() < L[1]) { const id = rollLoot(L[0], D); dropItem(e.x, e.y, id, L[2] ? ri(L[2], L[3]) : 1); }
    if (byPlayer !== false) { gainXP(Math.round(k.xp * (1 + 0.25 * D) * sm)); styleAdd(20); }
    if (k.boss) { msg('The ' + k.name + ' has fallen!', '#ffd84a'); S.shake = Math.max(S.shake, 0.6); sfx('roar'); }
  }
  if (k.ash) { burst(e.x, e.y, 1, '#8a8a8a', 16, ['.', ',', '*', "'"], 3); burst(e.x, e.y, 1.2, k.blood, 6, ['*'], 3); }
  else if (k.corpse) { S.corpses.push({ x: e.x, y: e.y, c: k.corpse, t: 30 }); if (S.corpses.length > 40) S.corpses.shift(); burst(e.x, e.y, 1, k.blood || '#e04a3a', 8, null, 3); }
  if (dist(e, P) < 30) sfx('die');
}
function gainXP(n) {
  P.xp += n;
  while (P.xp >= xpNext()) {
    P.xp -= xpNext(); P.level++; P.maxHp += 12; P.hp = P.maxHp;
    banner('LEVEL ' + P.level, 'Max HP +12 · damage +7%', 3.5, '#6aff7a'); sfx('level');
  }
}

// ---------- player: weapons ----------
const ATKTYPES = { sword: 1, sword2: 1, torch: 1, gun: 1, bow: 1 };
function armorSlow() { return ITEMS[P.armor].slow; }
function horseMult() { return 1 - (1 - armorSlow()) * 0.45; }
function mainHand() { const r = P.hands[1], l = P.hands[0]; if (r && ATKTYPES[ITEMS[r].type]) return 1; if (l && ATKTYPES[ITEMS[l].type]) return 0; return -1; }
function mainItem() { const h = mainHand(); return h < 0 ? null : ITEMS[P.hands[h]]; }
function offItem() {
  if (twoHanded()) return null;
  const h = mainHand(); const id = h === 1 ? P.hands[0] : h === 0 ? P.hands[1] : (P.hands[0] || P.hands[1]);
  return id ? ITEMS[id] : null;
}
function offKind() {
  const it = offItem(), m = mainItem();
  if (it) { if (it.type === 'shield') return 'shield'; if (it.type === 'torch') return 'torch'; if (it.type === 'gun') return 'gun'; if (it.type === 'sword') return 'sword'; }
  if (m && (m.type === 'sword' || m.type === 'sword2')) return 'parryW';
  return 'grab';
}
function weaponKey(it) { if (P.mounted && it && (it.type === 'sword' || it.type === 'sword2' || it.type === 'torch')) return 'ride'; if (!it) return P.mounted ? 'ride' : 'fists'; return it.type === 'sword2' ? 'sword2' : it.type === 'torch' ? 'torch' : it.type === 'sword' ? 'sword' : 'fists'; }
function spendSt(n) { P.st = Math.max(0, P.st - n); P.stDelay = 0.6; }
function moveRange(mv, it) { return (it && it.range ? it.range : (mv.rng || 1.6)) + (mv.rngB || 0) + (P.mounted ? 0.8 : 0); }
function aimDir(range) {
  if (P.lock && !P.lock.dead) return Math.atan2(P.lock.y - P.y, P.lock.x - P.x);
  if (S.mouseAim && typeof MOUSE !== 'undefined' && MOUSE.ok && typeof unproject === 'function') { const g = unproject(MOUSE.x, MOUSE.y, groundH(P.x, P.y) + 1); if (g) return Math.atan2(g[1] - P.y, g[0] - P.x); }
  const base = P.inDir !== null ? P.inDir : P.a;
  let best = null, bs = 1e9;
  for (const e of S.ents) {
    if (e.team !== 1 || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) - e.r; if (d > range + 2.5) continue;
    const ad = Math.abs(angDiff(base, Math.atan2(dy, dx))); if (ad > 1.15) continue;
    const sc = d * (1 + ad * 1.5); if (sc < bs) { bs = sc; best = e; }
  }
  return best ? Math.atan2(best.y - P.y, best.x - P.x) : base;
}
function startAttack(step, sharp, hand) {
  const it = hand === undefined ? mainItem() : (P.hands[hand] ? ITEMS[P.hands[hand]] : null);
  const wk = weaponKey(it), list = MOVES[wk];
  step = step % list.length; const mv = list[step];
  spendSt(mv.st * (0.7 + 0.3 / armorSlow()));
  let dir = aimDir(moveRange(mv, it));
  if (wk === 'ride') { // side sweep toward the nearest foe beside the horse
    let side = 1, bd = 4.5;
    for (const e of S.ents) { if (e.team !== 1 || e.dead) continue; const d = dist(e, P); if (d < bd) { bd = d; side = angDiff(P.a, Math.atan2(e.y - P.y, e.x - P.x)) >= 0 ? 1 : -1; } }
    dir = P.a + side * Math.PI / 2;
  } else P.a = dir;
  const crit = P.riposteT > 0 ? 2.6 : P.counterT > 0 ? 2.0 : 0;
  P.act = { k: 'atk', mv, step, wk, it, t: 0, dir, hit: new Set(), queued: false, mashed: false, sharp: !!sharp, crit, hand: hand === undefined ? mainHand() : hand, fxDone: false };
  if (crit) { P.riposteT = 0; P.counterT = 0; }
  sfx(wk === 'fists' ? 'swing_light' : wk === 'torch' ? 'torch' : 'swing');
}
function attackHits(a) {
  const mv = a.mv, it = a.it, range = moveRange(mv, it), arc = mv.arc;
  let base = it && it.dmg ? it.dmg : 5 + P.level * 0.8;
  if (a.wk === 'ride') base = (it && it.dmg ? it.dmg : 6) + Math.max(0, P.v) * 1.3 * horseMult();
  let any = false;
  for (const e of S.ents) {
    if (e.team !== 1 || e.dead || a.hit.has(e)) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) - e.r;
    if (d > range) continue;
    if (Math.abs(angDiff(a.dir, Math.atan2(dy, dx))) > arc && d > 0.5) continue;
    if (e.elev > 2.2 && !P.mounted) continue;
    a.hit.add(e); any = true;
    const stg = e.state === 'stagger' || e.downT > 0;
    let dmg = base * mv.dmg * dmgMult() * (a.crit || 1) * (a.sharp ? 1.15 : 1) * (stg ? 1.3 : 1) * rr(0.95, 1.05);
    if (mv.burn || (it && it.fire)) { dmg *= e.k.unholy ? 2.3 : 1; e.burnT = 3; e.burnDps = e.k.unholy ? 7 : 3; }
    const crit = a.crit > 0 || stg;
    hurtEnt(e, dmg, P.x, P.y, mv.kb * (a.crit ? 1.4 : 1), true, false, { crit, poise: mv.poise * (a.crit ? 1.8 : 1), gb: mv.gb });
    const hx = P.x + Math.cos(a.dir) * Math.min(range, d + e.r) * 0.8, hy = P.y + Math.sin(a.dir) * Math.min(range, d + e.r) * 0.8;
    sparks(hx, hy, P.mounted ? 1.9 : 1.1, crit ? '!#ffb040' : '!#fff4c0', crit ? 12 : 7, crit || mv.fin);
    if (a.crit) addText(e.x, e.y, e.k.h + 1.0, a.crit >= 2.6 ? 'RIPOSTE!' : 'COUNTER!', '#ffb040', true);
    styleAdd(mv.fin ? 15 : 6 + (a.sharp ? 4 : 0) + (a.crit ? 25 : 0));
    if (a.wk === 'fists' && mv.fin && !e.k.boss && !e.k.mounted && !e.k.hover && !e.dead) { e.downT = 1.6; addText(e.x, e.y, 2.6, 'TAKEDOWN!', '#ffd84a', true); styleAdd(15); }
  }
  if (any) {
    S.hitstop = Math.max(S.hitstop, mv.heavy ? 0.1 : mv.fin ? 0.08 : 0.05);
    S.shake = Math.max(S.shake, mv.heavy ? 0.35 : mv.fin ? 0.22 : 0.12);
    sfx(a.wk === 'fists' ? 'punch' : 'hit');
    if (S.tut === 0 && S.tutStep === 0 && mv.fin) tutStepDone();
  }
}
function startDash(dx, dy) {
  const mount = P.mounted;
  if (P.st < DASH.minSt) { addText(P.x, P.y, 2.3, 'no stamina', '#8a8a9a'); sfx('nope'); return false; }
  spendSt(mount ? 20 : DASH.cost * (0.85 + 0.15 / armorSlow()));
  if (mount) { P.burstT = 0.6; P.iframes = 0.12; P.v *= 1.15; sfx('neigh'); return true; }
  const l = Math.hypot(dx, dy); let a;
  if (l > 0.2) a = Math.atan2(dy, dx); else a = P.a + Math.PI; // backstep when no direction held
  const heavy = 1 - armorSlow();
  P.act = { k: 'dash', t: 0, dur: DASH.dur, a, dist: DASH.dist * (1 - heavy * 0.9), done: 0, sx: P.x, sy: P.y };
  P.iframes = DASH.ifr * (1 - heavy * 0.6);
  P.comboStep = 0;
  for (let i = 0; i < 6; i++) { const an = a + Math.PI + rr(-0.9, 0.9); part(P.x + rr(-0.3, 0.3), P.y + rr(-0.3, 0.3), 0.15, Math.cos(an) * rr(1, 3), Math.sin(an) * rr(1, 3), rr(0.5, 1.5), rr(0.35, 0.6), '~', '#ece4d4', 2); }
  sfx('dash');
  return true;
}
function startHeavy(a) {
  const it = mainItem(), wk = weaponKey(it), full = CHARGE_FULL[wk] || 0.7, ch = a.t;
  let mult, crit = false;
  if (ch < full) mult = 1.15 + 0.45 * ch / full;
  else if (ch <= full + 0.16) { mult = 2.6; crit = true; }
  else mult = 1.6;
  spendSt(crit ? 10 : 16);
  const mv = { n: 'heavy', w: 0.05, a: 0.15, r: 0.36, dmg: mult, arc: wk === 'sword2' ? 1.9 : 1.35, kb: crit ? 12 : 8, poise: crit ? 95 : 45, st: 0, lunge: 0.7, fin: true, sw: 1, heavy: true, gb: crit, rng: 1.9, burn: wk === 'torch' };
  const cc = P.riposteT > 0 ? 2.6 : P.counterT > 0 ? 2.0 : 0;
  P.act = { k: 'atk', mv, step: 99, wk, it, t: 0, dir: aimDir(moveRange(mv, it)), hit: new Set(), queued: false, mashed: false, sharp: false, crit: cc, hand: mainHand(), fxDone: false, heavyCrit: crit };
  if (cc) { P.riposteT = 0; P.counterT = 0; }
  P.a = P.act.dir;
  if (crit) { addText(P.x, P.y, 2.5, 'CRUSH!', '#ffd84a', true); styleAdd(20); S.pflash = 0.15; }
  sfx('heavy');
}
function shootGun(hand) {
  const it = ITEMS[P.hands[hand]];
  if (P.gunCd[hand] > 0) { addText(P.x, P.y, 2.3, 'reloading', '#8a8a9a'); sfx('nope'); return; }
  P.gunCd[hand] = it.reload;
  const a = aimDir(30), el = P.mounted ? 2.0 : 1.2; P.a = a;
  const cc = P.riposteT > 0 ? 2.6 : P.counterT > 0 ? 2.0 : 1; if (cc > 1) { P.riposteT = 0; P.counterT = 0; }
  S.projs.push({ x: P.x + Math.cos(a) * 0.8, y: P.y + Math.sin(a) * 0.8, elev: el, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, vz: 0, team: 0, dmg: it.dmg * dmgMult() * cc, life: 0.9, kind: 'pball', interrupt: true, crit: cc > 1 });
  sparks(P.x + Math.cos(a) * 1.2, P.y + Math.sin(a) * 1.2, el, '!#ffd84a', 8, true);
  burst(P.x + Math.cos(a) * 1.2, P.y + Math.sin(a) * 1.2, el, '#e8e8e8', 5, ['o', '.'], 1.2);
  P.act = { k: 'shoot', t: 0, dur: 0.2, hand };
  sfx('gun'); S.shake = Math.max(S.shake, 0.15); S.fxLight = 1.2;
}
function looseArrow(it, t) {
  const perfect = t >= it.draw && t <= it.draw + 0.14, ch = clamp(t / it.draw, 0, 1);
  if (t < it.draw * 0.25) return false;
  if (!invTake('arrows')) { msg('No arrows! Buy them from a merchant.', '#ff9a7a'); return false; }
  const a = aimDir(36), el = P.mounted ? 2.0 : 1.3, sp = 24 + 26 * ch + (perfect ? 8 : 0); P.a = a;
  const cc = P.riposteT > 0 ? 2.6 : P.counterT > 0 ? 2.0 : 1; if (cc > 1) { P.riposteT = 0; P.counterT = 0; }
  S.projs.push({ x: P.x + Math.cos(a) * 0.8, y: P.y + Math.sin(a) * 0.8, elev: el, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0, team: 0, dmg: it.dmg * (0.35 + 0.65 * ch) * (perfect ? 1.8 : 1) * dmgMult() * cc, life: 1.7, kind: 'arrow', pierce: perfect, hits: new Set(), crit: perfect || cc > 1 });
  if (perfect) { addText(P.x, P.y, 2.5, 'PERFECT SHOT', '#7af0ff', true); styleAdd(15); sparks(P.x + Math.cos(a), P.y + Math.sin(a), el, '!#a8f8ff', 8, true); }
  sfx('bow');
  return true;
}
function offPress() {
  const kind = offKind();
  if (kind === 'shield' || kind === 'parryW' || kind === 'grab') {
    if (P.parryCd > 0) return true; // spam guard: consumes the press, no new window
    P.parryT = PARRY_WIN[kind]; P.parryCd = PARRY_CD; P.blockT = 0;
    if (kind !== 'shield') P.act = { k: 'parry', t: 0, dur: 0.3 };
    sfx('parrytry');
    return true;
  }
  const oh = mainHand() === 1 ? 0 : 1;
  if (kind === 'gun') { shootGun(oh); return true; }
  if (kind === 'torch' || kind === 'sword') { startAttack(P.offStep++, false, oh); return true; }
  return true;
}
function toggleLock() {
  const cand = S.ents.filter(e => e.team === 1 && !e.dead && dist(e, P) < 24).sort((a, b) => dist(a, P) - dist(b, P));
  if (!cand.length) { P.lock = null; return; }
  if (!P.lock) { P.lock = cand[0]; sfx('lock'); return; }
  const i = cand.indexOf(P.lock);
  if (i < 0) P.lock = cand[0];
  else if (i + 1 < cand.length) P.lock = cand[i + 1];
  else P.lock = null;
  sfx('lock');
}

// ---------- player: update ----------
function captureInput(inp, dt) {
  const atkP = inp.atk && !P.prevAtk, atkR = !inp.atk && P.prevAtk, offP = inp.off && !P.prevOff;
  P.prevAtk = inp.atk; P.prevOff = inp.off;
  if (atkP) P.buf.atk = BUF;
  if (offP) P.buf.off = BUF;
  if (inp.dash) P.buf.dash = BUF;
  P.atkHeld = inp.atk; P.offHeld = inp.off; P.atkRel = (P.atkRel || false) || atkR;
  if (inp.lock) toggleLock();
  return { atkP };
}
function updatePlayer(dt, inp) {
  const m = P.mounted;
  P.invT -= dt; P.hurtT -= dt; P.slowT -= dt; P.iframes -= dt; P.parryT -= dt; P.parryCd -= dt; P.counterT -= dt; P.riposteT -= dt; P.comboT -= dt; P.burstT -= dt;
  P.gunCd[0] -= dt; P.gunCd[1] -= dt; P.stDelay -= dt;
  for (const k in P.buf) P.buf[k] -= dt;
  if (P.comboT <= 0) P.comboStep = 0;
  if (P.stDelay <= 0 && P.st < P.stMax) P.st = Math.min(P.stMax, P.st + 36 * (0.7 + 0.3 * armorSlow()) * dt * (P.blocking ? 0.35 : 1));
  if (P.lock && (P.lock.dead || dist(P.lock, P) > 30)) P.lock = null;
  if (P.atkHeld) P.atkHeldT += dt; else P.atkHeldT = 0;
  // movement intention (camera-relative)
  const fw = [Math.cos(CAMK.yaw), Math.sin(CAMK.yaw)], rt = [-Math.sin(CAMK.yaw), Math.cos(CAMK.yaw)];
  let wx = fw[0] * inp.my + rt[0] * inp.mx, wy = fw[1] * inp.my + rt[1] * inp.mx;
  const mag = Math.min(1, Math.hypot(wx, wy)); if (mag > 0.01) { wx /= Math.hypot(wx, wy); wy /= Math.hypot(wx, wy) || 1; }
  P.inDir = mag > 0.3 ? Math.atan2(wy, wx) : null;
  const it = mainItem(), two = twoHanded() ? ITEMS[P.hands[1]] : null, isBow = two && two.type === 'bow';
  // ---- current action
  const a = P.act;
  if (a) {
    a.t += dt;
    switch (a.k) {
      case 'atk': {
        const mv = a.mv, open = mv.w + mv.a, end = open + mv.r;
        if (a.t < open && mv.lunge) { let close = false; for (const e of S.ents) if (e.team === 1 && !e.dead && dist(e, P) < 1.1 + e.r && Math.abs(angDiff(a.dir, Math.atan2(e.y - P.y, e.x - P.x))) < 0.8) close = true; if (!close) { const s = mv.lunge / open * dt; P.x += Math.cos(a.dir) * s; P.y += Math.sin(a.dir) * s; } }
        if (!a.fxDone && a.t >= mv.w) { a.fxDone = true; fx({ k: 'slash', x: P.x, y: P.y, h: P.mounted ? 1.9 : (a.wk === 'fists' ? 1.0 : 1.05), dir: a.dir, arc: mv.arc, r: moveRange(mv, a.it) * 0.92, side: mv.sw || 1, dur: 0.16, col: a.crit ? [1, 0.75, 0.3, 0.95] : mv.burn ? [1, 0.6, 0.2, 0.9] : [1, 1, 1, 0.85], thrust: mv.sw === 0, heavy: mv.heavy }); }
        if (a.t >= mv.w && a.t <= open + 0.02) attackHits(a);
        if (a.t >= open && !a.cue) { a.cue = true; if (!mv.fin && a.step < 99) S.cueT = 0.22; }
        // chain: press inside the window (or just before it, buffered) continues the string
        if (P.buf.atk > 0 && a.step < 99 && a.hand === mainHand()) {
          if (a.t < open - BUF) { if (!a.mashed) { a.mashed = true; addText(P.x, P.y, 2.2, 'too early', '#9aa0b0'); } }
          else if (!a.queued) { a.queued = true; a.qT = Math.max(a.t, open); }
          P.buf.atk = 0;
        }
        if (a.queued && !a.mashed && a.t >= a.qT && !mv.fin) { const sharp = a.qT - open <= SHARP; startAttack(a.step + 1, sharp, a.hand); if (sharp) S.cueT = 0; break; }
        if (a.t >= end) {
          if (a.mashed) { P.act = { k: 'rec', t: 0, dur: 0.24 }; P.comboStep = 0; }
          else { P.act = null; P.comboStep = mv.fin || a.step >= 99 ? 0 : a.step + 1; P.comboT = mv.fin ? 0 : CHAIN_GRACE; }
        }
        break;
      }
      case 'dash': {
        const p0 = a.done, p1 = Math.min(1, a.t / a.dur), e0 = 1 - Math.pow(1 - p0, 3), e1 = 1 - Math.pow(1 - p1, 3);
        const s = (e1 - e0) * a.dist; P.x += Math.cos(a.a) * s; P.y += Math.sin(a.a) * s; a.done = p1;
        P.ghostT -= dt; if (P.ghostT <= 0) { P.ghostT = 0.045; S.ghosts.push({ x: P.x, y: P.y, a: P.a, t: 0.22, m: P.mounted }); }
        if (a.t >= a.dur + DASH.rec) P.act = null;
        break;
      }
      case 'charge': {
        const full = CHARGE_FULL[weaponKey(it)] || 0.7;
        if (!a.flash && a.t >= full) { a.flash = true; sfx('charged'); S.cueT = 0.18; }
        if (!P.atkHeld) startHeavy(a);
        else if (a.t > full + 0.9) startHeavy(a);
        break;
      }
      case 'bow': {
        P.drawing = true; P.draw = Math.min(two ? two.draw : 1, a.t);
        if (two && !a.flash && a.t >= two.draw) { a.flash = true; sfx('charged'); }
        if (!P.atkHeld) { P.drawing = false; P.draw = 0; looseArrow(two || ITEMS.short_bow, a.t); P.act = { k: 'rec', t: 0, dur: 0.18 }; }
        break;
      }
      case 'grab': {
        if (!a.thrown && a.t >= 0.22 && a.tgt && !a.tgt.dead) {
          a.thrown = true; const e = a.tgt;
          e.x = P.x - Math.cos(P.a) * 1.3; e.y = P.y - Math.sin(P.a) * 1.3; collide(e, e.r);
          e.downT = 1.8; e.state = 'move';
          hurtEnt(e, (14 + P.level * 1.5) * dmgMult(), P.x, P.y, 3, true, false, { crit: true });
          addText(e.x, e.y, 2.6, 'THROW!', '#ffd84a', true); S.hitstop = 0.1; S.shake = 0.35; sfx('takedown'); styleAdd(25);
          burst(e.x, e.y, 0.3, '#d8c8a0', 10, ['.', 'o'], 3);
        }
        if (a.t >= a.dur) P.act = null;
        break;
      }
      default: if (a.t >= (a.dur || 0.2)) P.act = null;
    }
  }
  const act = P.act;
  const inRec = act && act.k === 'atk' && act.t >= act.mv.w + act.mv.a;
  const free = !act || act.k === 'rec' && act.t > act.dur * 0.6;
  // ---- dash (cancels recovery, charge, bow; never wind-up or active frames)
  if (P.buf.dash > 0) {
    const canD = !act || inRec || act.k === 'charge' || act.k === 'bow' || act.k === 'shoot' || act.k === 'parry' || (act.k === 'rec' && act.t > 0.08) || (act.k === 'dash' && act.t >= act.dur);
    if (canD && act && act.k !== 'dash' && act.k !== 'stun' || canD && !act) { P.buf.dash = 0; if (act && act.k === 'bow') { P.drawing = false; P.draw = 0; } startDash(wx * mag, wy * mag); }
    else if (act && act.k === 'stun') { /* keep buffered */ }
  }
  // ---- attack
  if (P.buf.atk > 0 && (!P.act || P.act.k === 'dash' && P.act.t > 0.18 || (P.act.k === 'rec' && P.act.t > P.act.dur * 0.6))) {
    P.buf.atk = 0;
    if (isBow) P.act = { k: 'bow', t: 0 };
    else if (it && it.type === 'gun') shootGun(mainHand());
    else startAttack(P.comboT > 0 ? P.comboStep : 0, false);
  }
  // hold to charge a heavy (from idle, or by cancelling a light swing's recovery)
  if (P.atkHeld && P.atkHeldT >= HOLD_HEAVY && !isBow && !(it && it.type === 'gun') && P.st > 8) {
    const cur = P.act;
    if (!cur || (cur.k === 'atk' && cur.step < 99 && cur.t >= cur.mv.w + cur.mv.a && !cur.queued) || (cur.k === 'rec')) { P.act = { k: 'charge', t: 0 }; sfx('chargeup'); }
  }
  // ---- off hand: block / parry / grab / torch / pistol
  if (P.buf.off > 0) {
    const cur = P.act, ok = !cur || (cur.k === 'atk' && cur.t >= cur.mv.w + cur.mv.a) || cur.k === 'rec' || cur.k === 'shoot';
    if (ok) { P.buf.off = 0; offPress(); }
  }
  const okind = offKind();
  if (okind === 'shield' && P.offHeld && (!P.act || P.act.k === 'parry')) { P.blockT += dt; P.blocking = P.blockT > 0.06 && P.st > 0; } else { P.blocking = false; P.blockT = 0; }
  if (!P.act || P.act.k !== 'bow') { P.drawing = false; }
  // ---- locomotion
  const t = tileAt(P.x, P.y);
  let slow = m ? TDEF[t][4] : TDEF[t][3];
  if (P.slowT > 0) slow *= 0.55;
  if (m) {
    const sh = P.burstT > 0 ? 1.45 : 1, maxF = 10.5 * horseMult() * sh;
    if (mag > 0.05) { const want = Math.atan2(wy, wx), tr = 3.2 - Math.min(1.2, Math.abs(P.v) * 0.09); P.a += clamp(angDiff(P.a, want), -tr * dt, tr * dt); }
    const along = mag > 0.05 ? mag * Math.max(0, Math.cos(angDiff(P.a, Math.atan2(wy, wx)))) : 0;
    const target = along * maxF * (P.act && P.act.k === 'charge' ? 0.6 : 1);
    P.v += (target - P.v) * Math.min(1, (target > P.v ? 2.6 : 3.8) * dt);
    P.vx = Math.cos(P.a) * P.v; P.vy = Math.sin(P.a) * P.v;
  } else {
    const ak = P.act ? P.act.k : null;
    let mul = 1;
    if (ak === 'atk') mul = P.act.t < P.act.mv.w + P.act.mv.a ? 0.12 : 0.4;
    else if (ak === 'charge') mul = 0.35; else if (ak === 'bow') mul = 0.45; else if (ak === 'stun' || ak === 'grab') mul = 0; else if (ak === 'parry' || ak === 'shoot') mul = 0.5; else if (ak === 'dash') mul = 0; else if (ak === 'rec') mul = 0.5;
    if (P.blocking) { const sh = shieldItem(); mul *= sh ? sh.slow * 0.6 : 0.5; }
    const spd = 5.3 * armorSlow() * slow * mul;
    const tvx = wx * mag * spd, tvy = wy * mag * spd, acc = t === T_ICE ? 2.2 : 16;
    P.vx += (tvx - P.vx) * Math.min(1, acc * dt); P.vy += (tvy - P.vy) * Math.min(1, acc * dt);
    P.v = Math.hypot(P.vx, P.vy);
    // facing: action > lock-on > movement
    if (ak !== 'atk' && ak !== 'dash' && ak !== 'grab') {
      let want = null;
      if (P.lock && !P.lock.dead) want = Math.atan2(P.lock.y - P.y, P.lock.x - P.x);
      else if (mag > 0.2) want = Math.atan2(wy, wx);
      if (want !== null) P.a += clamp(angDiff(P.a, want), -15 * dt, 15 * dt);
    }
  }
  P.x += P.vx * (m ? slow : 1) * dt + P.kx * dt; P.y += P.vy * (m ? slow : 1) * dt + P.ky * dt;
  const kf = Math.pow(0.01, dt); P.kx *= kf; P.ky *= kf;
  P.r = m ? 0.85 : 0.5;
  if (collide(P, P.r) && m && Math.abs(P.v) > 6) P.v *= 0.6;
  P.step += Math.hypot(P.vx, P.vy) * dt;
  if (m && P.v > 6 && Math.random() < dt * 14) part(P.x - Math.cos(P.a) * 1.2, P.y - Math.sin(P.a) * 1.2, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.45, t === T_SNOW || t === T_DRIFT ? '*' : '.', TDEF[t][0], 6);
  // trample
  if (m && P.v > 6) for (const e of S.ents) {
    if (e.team !== 1 || e.dead || e.k.boss || e.k.hover || e.trampleCd > 0) continue;
    const dx = e.x - P.x, dy = e.y - P.y; if (dx * dx + dy * dy > (P.r + e.r + 0.7) ** 2) continue;
    if (dx * Math.cos(P.a) + dy * Math.sin(P.a) < 0) continue;
    hurtEnt(e, (6 + P.v * 1.3) * horseMult() * dmgMult(), P.x, P.y, 9, true, false, { poise: 30 }); e.trampleCd = 0.7; P.v *= 0.85; sfx('hit');
  }
  if (inp.horse) horseAction();
  if (inp.pot) drinkPotion();
  if (inp.use) doInteract();
  const ranged = isBow || (it && it.type === 'gun') || offKind() === 'gun';
  S.aim = ranged ? (P.lock || findAim(isBow ? 36 : 30, 0.5)) : null;
}
function findAim(range, cone) {
  let best = null, bs = 1e9;
  for (const e of S.ents) {
    if (e.team !== 1 || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy); if (d > range) continue;
    const ad = Math.abs(angDiff(P.a, Math.atan2(dy, dx))); if (ad > cone) continue;
    const sc = d * (1 + ad * 3); if (sc < bs) { bs = sc; best = e; }
  }
  return best;
}
function horseAction() {
  const h = S.horse;
  if (P.mounted) {
    P.mounted = false; h.state = 'idle'; P.act = null;
    const p = findFree(P.x + Math.cos(P.a + Math.PI / 2) * 1.6, P.y + Math.sin(P.a + Math.PI / 2) * 1.6, 0.8, 1);
    h.x = p[0]; h.y = p[1]; h.a = P.a; P.v = Math.min(P.v, 4); P.vx = Math.cos(P.a) * P.v; P.vy = Math.sin(P.a) * P.v; msg('You dismount.');
    return;
  }
  const d = Math.hypot(h.x - P.x, h.y - P.y);
  if (d < 3.2) mount();
  else { h.state = 'coming'; msg('You whistle for your horse...'); sfx('whistle'); }
}
function mount() { P.mounted = true; P.act = null; P.v = Math.hypot(P.vx, P.vy); S.horse.state = 'ridden'; sfx('neigh'); if (S.tut === 2) tutAdvance(); }
function updateHorse(dt) {
  const h = S.horse;
  if (P.mounted) { h.x = P.x; h.y = P.y; h.a = P.a; return; }
  if (h.state === 'coming') {
    const dx = P.x - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy);
    if (d > 120) { const p = findFree(P.x - Math.cos(CAMK.yaw) * 30, P.y - Math.sin(CAMK.yaw) * 30, 0.8, 5); h.x = p[0]; h.y = p[1]; }
    if (d < 2.4) { if (S.mode === 'play') mount(); else h.state = 'idle'; }
    else { h.x += dx / d * 13 * dt; h.y += dy / d * 13 * dt; h.a = Math.atan2(dy, dx); collide(h, 0.8); if (Math.random() < dt * 12) part(h.x, h.y, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.4, '.', '#c8b898', 6); }
  } else if (h.state === 'flee') {
    h.fleeT -= dt; h.x += Math.cos(h.a) * 9 * dt; h.y += Math.sin(h.a) * 9 * dt; collide(h, 0.8);
    if (h.fleeT <= 0) h.state = 'idle';
  }
}
function hurtPlayer(amount, src, opts) {
  opts = opts || {};
  if (S.mode !== 'play' || P.invT > 0) return;
  let a = amount * (1 - ITEMS[P.armor].def);
  if (S.tut === 0) a = Math.min(a, Math.max(0, P.hp - 12));
  P.hp -= a; P.hurtT = 0.3;
  if (!opts.blocked) {
    P.invT = 0.35; S.flash = Math.max(S.flash, clamp(a / 30, 0.15, 0.5)); styleHit();
    const ak = P.act ? P.act.k : null;
    if (ak !== 'dash') { if (ak === 'bow') { P.drawing = false; } P.act = { k: 'stun', t: 0, dur: opts.heavy ? 0.5 : 0.22 }; P.comboStep = 0; }
    if (src && src.x !== undefined) { const an = Math.atan2(P.y - src.y, P.x - src.x); P.kx += Math.cos(an) * (opts.kb || 3); P.ky += Math.sin(an) * (opts.kb || 3); }
  }
  S.shake = Math.max(S.shake, 0.15 + a / 80);
  addText(P.x, P.y, 2.4, '-' + Math.round(a), '#ff5a4a'); if (!opts.blocked) sfx('hurt');
  try { navigator.vibrate && navigator.vibrate(opts.blocked ? 10 : 30); } catch (e) { }
  if (P.mounted && !opts.blocked && (opts.dismount || a >= 18)) {
    P.mounted = false; const h = S.horse; h.state = 'flee'; h.fleeT = 1.6; h.a = P.a + rr(2, 4); h.x = P.x; h.y = P.y;
    msg('You are thrown from your horse!', '#ff9a7a'); sfx('neigh');
  }
  if (P.hp <= 0) { P.hp = 0; S.killer = src && src.k ? src.k.name : 'the wilds'; die(); }
}

// ---------- interaction ----------
function findInteract() {
  let best = null, bd = 3.2;
  for (const e of S.ents) if (e.kind === 'merchant' && !e.dead) { const d = dist(e, P); if (d < bd + 0.6) { bd = d; best = { type: 'trade', ref: e, label: 'TRADE' }; } }
  if (best) return best;
  forStatics(P.x, P.y, 3, o => {
    const d = Math.hypot(o.x - P.x, o.y - P.y) - o.r;
    if (d > 2.4) return false;
    if (o.type === 'chest' && !S.looted.has(o.id)) best = { type: 'loot', ref: o, label: 'LOOT' };
    else if (o.type === 'fire' && !best) best = { type: 'rest', ref: o, label: 'REST' };
    return false;
  });
  if (best) return best;
  if (!P.mounted && dist(S.horse, P) < 3.2) return { type: 'mount', ref: S.horse, label: 'MOUNT' };
  return null;
}
function doInteract() {
  const it = S.interact; if (!it) return;
  if (it.type === 'trade') openShop(it.ref);
  else if (it.type === 'loot') lootChest(it.ref);
  else if (it.type === 'rest') rest();
  else if (it.type === 'mount') mount();
}
function lootChest(o) {
  S.looted.add(o.id); sfx('coin');
  const g = Math.round(25 + o.tier * 30 + rr(0, 30)); P.gold += g;
  const n = ri(1, 2), got = [];
  for (let i = 0; i < n; i++) { const id = rollLoot('$any', o.tier + 0.4); got.push(ITEMS[id].name); giveOrDrop(id); }
  if (Math.random() < 0.6) { giveOrDrop('potion', 1); got.push('Healing Draught'); }
  if (Math.random() < 0.5) { const a = ri(6, 14); giveOrDrop('arrows', a); got.push(a + ' arrows'); }
  banner('TREASURE!', '+' + g + ' gold · ' + got.join(', '), 4.5);
  burst(o.x, o.y, 1, '#ffd84a', 14, ['$', '*', '+'], 3, true);
}
function rest() {
  for (const e of S.ents) if (e.team === 1 && !e.dead && dist(e, P) < 28) { msg('You cannot rest with enemies nearby!', '#ff9a7a'); return; }
  S.fade = 1.6; P.hp = P.maxHp; P.st = P.stMax;
  const night = S.time > 0.72 || S.time < 0.24;
  if (night) { if (S.time > 0.72) S.day++; S.time = 0.27; banner('You rest by the fire', 'Dawn breaks over day ' + S.day + '. You are fully healed.', 4); }
  else banner('You rest by the fire', 'Your wounds are tended. Game saved.', 3.5);
  const v = nearVillage(P.x, P.y, 20); if (v) S.lastVillage = { x: v.x, y: v.y, name: v.name };
  saveGame(); sfx('potion');
}

// ---------- projectiles / particles / drops ----------
function projBlocked(x, y, elev) {
  return forStatics(x, y, 0.5, o => { if (!o.block || o.h < elev) return false; const dx = x - o.x, dy = y - o.y, rs = o.r * 0.9; return dx * dx + dy * dy < rs * rs; });
}
function projHitsPlayer(p) {
  if (P.iframes > 0) { if (!p.dodged) { p.dodged = true; perfectDodge(p.src || p); } return false; }
  const src = p.src && !p.src.dead ? p.src : { x: p.x - p.vx, y: p.y - p.vy };
  const front = Math.abs(angDiff(P.a, Math.atan2(-p.vy, -p.vx))) < 1.45;
  if (p.col === 'y' && P.parryT > 0 && front) {
    // reflect back at the shooter
    const sp = Math.hypot(p.vx, p.vy) * 1.25, tg = p.src && !p.src.dead ? p.src : null;
    const an = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : Math.atan2(-p.vy, -p.vx);
    p.team = 0; p.vx = Math.cos(an) * sp; p.vy = Math.sin(an) * sp; p.dmg *= 1.6; p.life = 1.6; p.target = tg; p.reflected = true; p.hits = new Set();
    P.parryT = 0; S.hitstop = 0.08; addText(P.x, P.y, 2.4, 'REFLECT!', '#ffe070', true); styleAdd(40); sfx('parry'); sparks(p.x, p.y, p.elev, '!#fff4c0', 10, true);
    if (S.tut === 0 && S.tutStep === 1) tutStepDone();
    return false;
  }
  p.dead = true;
  if (P.blocking && front) { blockHit(p.dmg * (p.kind === 'ball' ? 1.3 : 1), src, {}); return true; }
  hurtPlayer(p.dmg, src, { kb: 2 });
  if (p.kind === 'fire') burst(p.x, p.y, 1.3, '#ff8a2a', 8, FLAME.split(''), 3, true);
  return true;
}
function updateProjs(dt) {
  for (const p of S.projs) {
    if (p.dead) continue;
    p.life -= dt; if (p.life <= 0) { p.dead = true; continue; }
    if (p.kind === 'fire') {
      const t = p.team === 1 ? (p.target && !p.target.dead ? p.target : P) : (p.target && !p.target.dead ? p.target : null);
      if (t) {
        const want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.vy, p.vx), na = cur + clamp(angDiff(cur, want), -1.6 * dt, 1.6 * dt), sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.elev += ((t.isPlayer ? 1.3 : 1.2) - p.elev) * dt;
      }
      if (Math.random() < dt * 30) part(p.x, p.y, p.elev, rr(-0.5, 0.5), rr(-0.5, 0.5), 0.5, 0.3, pick(['*', '.', "'"]), '#ff8a2a', 0, true);
    }
    if (p.kind === 'boulder') {
      p.vz -= 18 * dt; p.elev += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.elev <= 0 || (p.elev < 3 && projBlocked(p.x, p.y, p.elev))) {
        p.dead = true; burst(p.x, p.y, 0.3, p.frost ? '#c8f0ff' : '#b8b0a8', 16, ['o', '.', '*'], 6);
        fx({ k: 'ring', x: p.x, y: p.y, h: 0.2, r0: 0.5, r1: (p.rad || 2.5) + 0.4, dur: 0.3, col: [1, 0.85, 0.6, 0.9] });
        if (dist(p, P) < 22) { sfx('slam'); S.shake = Math.max(S.shake, 0.35); }
        const R = p.rad || 2.5;
        strike(p.src || p, q => inCircle(p.x, p.y, q, R), p.dmg, 'r', { heavy: true, kb: 6 });
        S.marks.shift();
      }
      continue;
    }
    const sp = Math.hypot(p.vx, p.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.6));
    for (let s = 0; s < steps && !p.dead; s++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
      if (projBlocked(p.x, p.y, p.elev)) { p.dead = true; burst(p.x, p.y, p.elev, p.kind === 'fire' ? '#ff8a2a' : '#d8c8a8', 4, ['*', '.'], 2, p.kind === 'fire'); break; }
      if (p.team === 1) {
        if (S.mode === 'play' && Math.hypot(P.x - p.x, P.y - p.y) < P.r + 0.45) { if (projHitsPlayer(p)) break; else continue; }
        for (const e of S.ents) { if (e.team !== 0 || e.dead) continue; if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 0.45) { p.dead = true; hurtEnt(e, p.dmg, p.x - p.vx * 0.02, p.y - p.vy * 0.02, 3, false); break; } }
      } else {
        for (const e of S.ents) {
          if (e.team !== 1 || e.dead || (p.hits && p.hits.has(e))) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 0.5 && Math.abs(p.elev - (e.elev + e.k.h * 0.5)) < e.k.h * 0.8 + 0.6) {
            const stg = e.state === 'stagger';
            hurtEnt(e, p.dmg * (p.interrupt && (e.state === 'wind' || e.state === 'aim') ? 1.5 : 1) * (stg ? 1.3 : 1), p.x - p.vx * 0.05, p.y - p.vy * 0.05, 3, true, false, { interrupt: p.interrupt, crit: p.crit || p.reflected, poise: p.reflected ? 40 : 12 });
            sparks(p.x, p.y, p.elev, '!#fff4c0', 6); sfx('hit'); S.hitstop = Math.max(S.hitstop, 0.04); styleAdd(6);
            if (p.pierce) { p.hits.add(e); } else { p.dead = true; break; }
          }
        }
      }
    }
  }
  S.projs = S.projs.filter(p => !p.dead);
}
function updateParts(dt) {
  for (const p of S.parts) {
    p.t -= dt; p.vz -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.elev += p.vz * dt;
    if (p.elev < 0) { p.elev = 0; p.vz *= -0.3; p.vx *= 0.6; p.vy *= 0.6; }
  }
  S.parts = S.parts.filter(p => p.t > 0);
  for (const t of S.texts) { t.t -= dt; t.elev += dt * 1.6; }
  S.texts = S.texts.filter(t => t.t > 0);
}
function updateDrops(dt) {
  const pr = P.mounted ? 2.3 : 1.6;
  for (const d of S.drops) {
    d.t -= dt; d.warn -= dt;
    const dx = P.x - d.x, dy = P.y - d.y, ds = Math.hypot(dx, dy);
    if (S.mode !== 'play') continue;
    if (d.lock) { if (ds > 3.5) d.lock = false; else continue; }
    if (d.kind === 'gold' && ds < 5 && ds > 0.01) { d.x += dx / ds * 9 * dt; d.y += dy / ds * 9 * dt; }
    if (ds < pr) {
      if (d.kind === 'gold') { P.gold += d.val; d.t = 0; sfx('coin'); }
      else {
        if (invAdd(d.id, d.n)) {
          d.t = 0; const it = ITEMS[d.id]; sfx('pickup');
          const eq = autoEquip(d.id);
          msg('Picked up ' + (d.n > 1 ? d.n + ' ' : '') + it.name + (eq ? ' (equipped)' : ''), '#ffe6a0');
          if (S.tut === 1 && d.id === 'rusty_sword') tutAdvance();
        } else if (d.warn <= 0) { msg('Your bag is full!', '#ff9a7a'); d.warn = 4; }
      }
    }
  }
  S.drops = S.drops.filter(d => d.t > 0 && Math.hypot(d.x - P.x, d.y - P.y) < 150);
}
function separate() {
  const arr = S.ents, n = arr.length, play = S.mode === 'play';
  for (let i = 0; i < n; i++) {
    const a = arr[i]; if (a.dead) continue;
    for (let j = i + 1; j < n; j++) {
      const b = arr[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rs = a.r + b.r;
      if (Math.abs(dx) > rs || Math.abs(dy) > rs) continue;
      const d2 = dx * dx + dy * dy; if (d2 >= rs * rs || d2 === 0) continue;
      const d = Math.sqrt(d2), o = rs - d, ma = a.k.ai === 'none' ? 50 : a.r * a.r, mb = b.k.ai === 'none' ? 50 : b.r * b.r, tot = ma + mb;
      a.x -= dx / d * o * (mb / tot); a.y -= dy / d * o * (mb / tot); b.x += dx / d * o * (ma / tot); b.y += dy / d * o * (ma / tot);
    }
    if (play && !(P.act && P.act.k === 'dash')) {
      const dx = a.x - P.x, dy = a.y - P.y, rs = a.r + P.r, d2 = dx * dx + dy * dy;
      if (d2 < rs * rs && d2 > 0) {
        const d = Math.sqrt(d2), o = rs - d, pm = P.mounted ? 2.5 : 1, am = a.k.ai === 'none' ? 50 : a.k.boss ? 6 : a.r * a.r * 4, tot = pm + am;
        a.x += dx / d * o * (pm / tot); a.y += dy / d * o * (pm / tot); P.x -= dx / d * o * (am / tot); P.y -= dy / d * o * (am / tot);
      }
    }
  }
}

// ---------- world events (director) ----------
function groupPos() {
  for (let i = 0; i < 10; i++) {
    const a = rr(0, TAU), d = rr(34, 44);
    const x = P.x + Math.cos(a) * d, y = P.y + Math.sin(a) * d;
    if (!nearVillage(x, y, 24) && !isWet(tileAt(x, y))) return [x, y];
  }
  return null;
}
function spawnGroup(g) {
  const D = danger(), extra = Math.floor(D * 0.8);
  const gp = groupPos(); if (!gp) return;
  const [cx, cy] = gp;
  switch (g) {
    case 'bandits': for (let i = 0; i < ri(1, 2) + Math.floor(extra / 2); i++) spawnNear('bandit', cx, cy, 4); break;
    case 'patrol': {
      for (let i = 0; i < ri(2, 3) + extra; i++) spawnNear('soldier', cx, cy, 4);
      if (Math.random() < 0.6) spawnNear('pikeman', cx, cy, 4);
      if (D > 0.4 && Math.random() < 0.6) spawnNear('musketeer', cx, cy, 5);
      msg('Redcoats of the Usurper on the march!', '#ff9a7a'); break;
    }
    case 'archers': for (let i = 0; i < ri(1, 2) + Math.floor(extra / 2); i++) spawnNear('archer', cx, cy, 5); spawnNear('soldier', cx, cy, 3); break;
    case 'dragoons': for (let i = 0; i < ri(2, 3) + Math.floor(extra / 2); i++) spawnNear('dragoon', cx, cy, 5); msg('Hoofbeats! Enemy dragoons ride at you!', '#ff9a7a'); sfx('horn'); break;
    case 'battle': {
      const perp = Math.atan2(cy - P.y, cx - P.x) + Math.PI / 2;
      const ax = cx + Math.cos(perp) * 7, ay = cy + Math.sin(perp) * 7, bx = cx - Math.cos(perp) * 7, by = cy - Math.sin(perp) * 7;
      const allies = [], foes = [];
      for (let i = 0; i < ri(3, 5) + extra; i++) allies.push(spawnNear('ally', ax, ay, 4));
      for (let i = 0; i < ri(4, 6) + extra; i++) foes.push(spawnNear(Math.random() < 0.7 ? 'soldier' : pick(['pikeman', 'musketeer', 'archer']), bx, by, 4));
      S.battle = { allies, foes, reward: Math.round(40 + D * 40) };
      banner('BATTLE!', 'The Royal army clashes with the Usurper\'s redcoats nearby. Join the fight!', 4.5, '#ff7a5a'); sfx('horn'); break;
    }
    case 'vampires': {
      const n = ri(1, 2) + Math.floor(extra / 2) + (S.bloodMoon ? 2 : 0);
      for (let i = 0; i < n; i++) { const a = rr(0, TAU), d = rr(26, 34); spawnNear('vampire', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, 3); }
      msg(S.bloodMoon ? 'The blood moon calls the vampires...' : 'Something hungry stalks you in the dark...', '#d08aff'); sfx('hiss'); break;
    }
    case 'witches': {
      const n = ri(1, 2) + Math.floor(extra / 3);
      for (let i = 0; i < n; i++) { const a = rr(0, TAU), d = rr(20, 28); spawnNear('witch', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, 3); }
      msg('Cackling echoes overhead. Witches!', '#d08aff'); sfx('cackle'); break;
    }
    case 'giant': case 'frostgiant':
      spawnNear(g, cx, cy, 4); msg('The ground trembles... a ' + KINDS[g].name.toUpperCase() + ' approaches!', '#ff7a5a'); sfx('roar'); S.shake = 0.3; break;
  }
}
function director(dt) {
  S.dirT -= dt; if (S.dirT > 0) return;
  S.dirT = rr(7, 13);
  if (S.tut < 3 && S.t < 150) return;
  const D = danger(), night = S.darkness > 0.55;
  let hostile = 0; for (const e of S.ents) if (e.team === 1 && !e.dead && dist(e, P) < 80) hostile++;
  const cap = Math.min(14, (night ? 4 : 3) + Math.floor(D * 1.6));
  if (hostile >= cap) return;
  const v = nearVillage(P.x, P.y, 34);
  if (v && !night) return;
  if (v && Math.random() < 0.5) return;
  const b = biomeAt(P.x, P.y), opts = [];
  if (!night) {
    opts.push(['bandits', Math.max(0.6, 3 - D)], ['patrol', 2.2 + D * 0.5], ['archers', 0.8 + D * 0.4]);
    if (D > 0.5) opts.push(['dragoons', 0.8 + D * 0.3]);
    if (!S.battle) opts.push(['battle', 1.5]);
  } else {
    opts.push(['vampires', S.bloodMoon ? 5 : 2.6], ['witches', (b === B_SWAMP || b === B_FOREST) ? 3 : 1.1], ['bandits', 0.7]);
  }
  if (b === B_SNOW) { if (D > 0.35) opts.push(['frostgiant', 0.7 + D * 0.2]); }
  else if (b === B_HEATH) opts.push(['giant', 0.9 + D * 0.2]);
  else if (D > 1.4) opts.push(['giant', 0.3]);
  let tot = 0; for (const o of opts) tot += o[1];
  let roll = Math.random() * tot;
  for (const o of opts) { if (roll < o[1]) { spawnGroup(o[0]); return; } roll -= o[1]; }
}
function updateBattle() {
  const b = S.battle; if (!b) return;
  const foesAlive = b.foes.filter(e => !e.dead && S.ents.includes(e)).length;
  const alliesAlive = b.allies.filter(e => !e.dead && S.ents.includes(e)).length;
  if (foesAlive === 0) {
    if (alliesAlive > 0) { P.gold += b.reward; gainXP(Math.round(b.reward * 0.6)); banner('VICTORY', 'The captain rewards you: +' + b.reward + ' gold', 4); sfx('win'); }
    const away = rr(0, TAU); for (const a of b.allies) a.leave = away;
    S.battle = null;
  } else if (alliesAlive === 0) { msg('The Royal squad has fallen...', '#ff9a7a'); S.battle = null; }
}

// ---------- time of day ----------
function darkAt(t) {
  if (t >= 0.3 && t <= 0.7) return 0;
  if (t > 0.7 && t < 0.8) return smooth((t - 0.7) / 0.1);
  if (t >= 0.2 && t < 0.3) return 1 - smooth((t - 0.2) / 0.1);
  return 1;
}
function clockStr() { const m = Math.floor(S.time * 24 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function updateTime(dt) {
  const prev = S.time;
  S.time += dt / DAY_LEN;
  if (S.time >= 1) { S.time -= 1; S.day++; }
  if (prev < 0.25 && S.time >= 0.25) { msg('Day ' + S.day + ' dawns.', '#ffe070'); }
  if (prev < 0.72 && S.time >= 0.72) { msg(hasTorch() ? 'Night falls. Keep your torch close.' : 'Night falls. Without a torch you are half blind!', '#d08aff', 6); }
  S.darkness = darkAt(S.time);
  S.bloodMoon = S.darkness > 0.3 && (S.day % 5 === 4) && (S.time > 0.7 || S.time < 0.3);
}

// ---------- tutorial ----------
const TUT = [
  ['A BANDIT!', ''],
  ['LOOT', 'He dropped a rusty sword. Walk over it to pick it up.'],
  ['YOUR HORSE', 'Sword equipped. Your horse waits nearby — press HORSE to ride. Riding attacks sweep to the side.'],
  ['THE REALM', 'Explore! Ashford\'s merchant (by the fire) sells torches, shields, bows and armor. Nights are deadly — carry a torch.']
];
function tutPrompt() {
  switch (S.tutStep) {
    case 0: return ['COMBO', 'Tap ' + btnName('atk') + ' in rhythm: press again when the white glint flashes. Mashing early breaks the combo. Land a 3-hit combo.'];
    case 1: return ['PARRY', 'Yellow flash = parryable. Tap ' + btnName('off') + ' just before his punch lands to GRAB and THROW him.'];
    case 2: return ['PERFECT DODGE', 'Press ' + btnName('dash') + ' through his punch at the last moment. Dodging inside the hit gives slow-mo and a guaranteed counter.'];
    default: return ['FINISH HIM', 'Use what you learned. Hold ' + btnName('atk') + ' to charge a heavy blow; release on the flash.'];
  }
}
function tutStepDone() {
  S.tutStep++; sfx('level');
  const p = tutPrompt(); banner(p[0], p[1], 99, '#9ae0ff');
}
function tutAdvance() {
  S.tut++;
  if (S.tut < TUT.length) banner(TUT[S.tut][0], TUT[S.tut][1], 7, '#9ae0ff');
  if (S.tut === 3) S.dirT = 25;
}

// ---------- death / respawn ----------
function die() { S.mode = 'dying'; S.dieT = 1.8; P.mounted = false; P.v = 0; P.vx = P.vy = 0; P.act = null; P.lock = null; sfx('death'); msg('You have fallen...', '#ff5a4a'); }
function respawn() {
  const v = S.lastVillage;
  const lost = Math.floor(P.gold * 0.3); P.gold -= lost;
  P.x = v.x; P.y = v.y + 6; P.a = -Math.PI / 2; P.hp = Math.round(P.maxHp * 0.7); P.st = P.stMax; P.v = 0; P.vx = P.vy = 0; P.kx = P.ky = 0; P.mounted = false; P.act = null;
  S.horse.x = v.x + 2.5; S.horse.y = v.y + 4; S.horse.state = 'idle';
  S.ents = S.ents.filter(e => e.team === 2 || e.post);
  S.projs = []; S.marks = []; S.battle = null; S.fade = 1.5; S.dirT = 20; S.tok.clear(); S.tokR.clear(); S.style = 0;
  S.mode = 'play';
  manageChunks(30);
  banner('You wake in ' + v.name, lost ? 'Thieves took ' + lost + ' gold while you lay senseless.' : 'Bruised, but alive.', 4.5);
}

// ---------- save / load ----------
function saveGame() {
  try {
    const d = { v: 1, x: P.x, y: P.y, a: P.a, hp: P.hp, maxHp: P.maxHp, level: P.level, xp: P.xp, gold: P.gold, inv: P.inv, hands: P.hands, armor: P.armor, mounted: P.mounted,
      horse: { x: S.horse.x, y: S.horse.y }, day: S.day, time: S.time, looted: [...S.looted], lastVillage: S.lastVillage, kills: S.kills, tut: S.tut };
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch (e) { }
}
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function applySave(d) {
  Object.assign(P, { x: d.x, y: d.y, a: d.a, hp: d.hp, maxHp: d.maxHp, level: d.level, xp: d.xp, gold: d.gold, inv: d.inv.filter(q => ITEMS[q.id]), hands: d.hands.map(h => h && ITEMS[h] ? h : null), armor: ITEMS[d.armor] ? d.armor : 'tunic', mounted: !!d.mounted });
  S.horse.x = d.horse.x; S.horse.y = d.horse.y; S.horse.state = P.mounted ? 'ridden' : 'idle';
  S.day = d.day; S.time = d.time; S.looted = new Set(d.looted || []); S.lastVillage = d.lastVillage || S.lastVillage; S.kills = d.kills || 0; S.tut = Math.max(3, d.tut || 3);
}

// ---------- main update ----------
function update(dt, inp) {
  // real-time effects first
  for (const f of S.fx) f.t += dt; S.fx = S.fx.filter(f => f.t < f.dur);
  for (const g of S.ghosts) g.t -= dt; S.ghosts = S.ghosts.filter(g => g.t > 0);
  S.shake = Math.max(0, S.shake - dt * 1.8); S.flash = Math.max(0, S.flash - dt * 1.6); S.fade = Math.max(0, S.fade - dt * 0.8); S.pflash = Math.max(0, S.pflash - dt * 1.5);
  S.cueT -= dt; S.fxLight = Math.max(0, S.fxLight - dt * 6); S.rankPop = Math.max(0, (S.rankPop || 0) - dt * 3);
  if (S.mode === 'play') captureInput(inp, dt);
  if (S.hitstop > 0) { S.hitstop -= dt; updateCamera(dt); return; }
  let wk = 1; if (S.slowT > 0) { S.slowT -= dt; wk = SLOWMO.scale; }
  const dw = dt * wk;
  S.t += dw;
  updateTime(dw);
  S.styleT -= dt; if (S.styleT <= 0 && S.style > 0) S.style = Math.max(0, S.style - 26 * dt);
  if (S.mode === 'play') updatePlayer(dt, inp); else { P.v *= 0.9; P.vx *= 0.9; P.vy *= 0.9; }
  updateHorse(dt);
  if (S.mode === 'play') director(dw);
  tokClean();
  for (let i = 0; i < S.ents.length; i++) { const e = S.ents[i]; if (!e.dead) updateEnt(e, dw); }
  separate();
  if (S.mode === 'play') collide(P, P.r);
  updateProjs(dw); updateParts(dw); updateDrops(dt); updateBattle();
  for (const e of S.ents) if (!e.dead && !e.home && dist(e, P) > 110) e.dead = true;
  S.ents = S.ents.filter(e => !e.dead);
  for (const c of S.corpses) c.t -= dt; S.corpses = S.corpses.filter(c => c.t > 0 && Math.hypot(c.x - P.x, c.y - P.y) < 120);
  for (const m of S.marks) m.t -= dw; S.marks = S.marks.filter(m => m.t > -0.3);
  for (const m of S.msgs) m.t -= dt; S.msgs = S.msgs.filter(m => m.t > 0);
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  S.biomeT -= dt;
  if (S.biomeT <= 0) {
    S.biomeT = 1;
    const b = biomeAt(P.x, P.y);
    if (b !== S.curBiome) { if (S.curBiome >= 0) msg('You enter ' + BIOME_NAMES[b] + '.', '#9ae0ff'); S.curBiome = b; }
    const v = nearVillage(P.x, P.y, 15);
    if (v !== S.curVillage) { if (v) { msg('Welcome to ' + v.name + '.', '#ffe070'); S.lastVillage = { x: v.x, y: v.y, name: v.name }; } S.curVillage = v; }
  }
  S.interact = S.mode === 'play' ? findInteract() : null;
  if (S.mode === 'dying') { S.dieT -= dt; if (S.dieT <= 0) showOver(); }
  if (S.mode === 'play') {
    S.saveT -= dt;
    if (S.saveT <= 0) { S.saveT = 40; if (!S.ents.some(e => e.team === 1 && dist(e, P) < 35)) saveGame(); }
  }
  manageChunks(2);
  updateCamera(dt);
}
