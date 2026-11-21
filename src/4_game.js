// =====================================================================
//  GAME — state, player, combat, creatures, world events
// =====================================================================
const DAY_LEN = 420;          // seconds per full day
const INV_MAX = 20;
const SAVE_KEY = 'ironcrown1700_save_v1';
let S = null, P = null;

function newState() {
  S = {
    mode: 'title', t: 0, day: 1, time: 0.29, darkness: 0, bloodMoon: false,
    ents: [], projs: [], parts: [], texts: [], drops: [], corpses: [], marks: [], msgs: [], banner: null,
    dirT: 6, battle: null, kills: 0, looted: new Set(), lastVillage: { x: 16, y: 16, name: 'Ashford' },
    curBiome: -1, curVillage: null, biomeT: 0, tut: 0, tutT: 0, shake: 0, flash: 0, fade: 0, aim: null, dieT: 0, killer: '',
    prevHeld: [false, false], interact: null, saveT: 40, flakes: [], horse: { x: 18, y: 3, a: Math.PI * 0.75, state: 'idle', fleeT: 0 }
  };
  P = {
    x: 16, y: 6, a: -Math.PI / 2, v: 0, kx: 0, ky: 0, hp: 100, maxHp: 100, mounted: false, r: 0.5, team: 0, isPlayer: true,
    hands: [null, null], armor: 'tunic', inv: [], gold: 10, level: 1, xp: 0, cd: [0, 0], anim: [0, 0], combo: 0, comboT: 0,
    draw: 0, drawing: false, blocking: false, hurtT: 0, invT: 0, step: 0, dead: false, slowT: 0
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
function addText(x, y, elev, s, col) { S.texts.push({ x, y, elev, s, col, t: 1.0 }); if (S.texts.length > 40) S.texts.shift(); }
function part(x, y, elev, vx, vy, vz, life, ch, col, g, em) {
  if (S.parts.length > 420) S.parts.shift();
  S.parts.push({ x, y, elev, vx, vy, vz, t: life, ch, col, g: g === undefined ? 14 : g, em: !!em });
}
function burst(x, y, elev, col, n, chars, spd, em) {
  for (let i = 0; i < n; i++) { const a = rr(0, TAU), s = rr(0.5, spd || 4); part(x, y, elev, Math.cos(a) * s, Math.sin(a) * s, rr(1, 5), rr(0.3, 0.8), chars ? pick(chars) : (Math.random() < 0.5 ? '*' : '.'), col, 14, em); }
}

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
  P.cd[0] = P.cd[1] = 0.2; sfx('equip');
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
  const hpM = k.team === 1 ? 1 + 0.25 * D : 1;
  const e = {
    kind, k, x, y, a: rr(0, TAU), hp: k.hp * hpM, maxHp: k.hp * hpM, dmgM: k.team === 1 ? 1 + 0.15 * D : 1, team: k.team, r: k.r,
    kx: 0, ky: 0, cd: rr(0.4, 1.4), state: 'move', wt: 0, target: null, tT: 0, hurtT: 0, invT: 0, elev: 0, seed: Math.random() * 100,
    strafe: Math.random() < 0.5 ? 1 : -1, tpCd: 0, throwCd: rr(2, 4), passT: 0, trampleCd: 0, spd: 0, dead: false, downT: 0, burnT: 0, burnDps: 0, moving: false, D
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
function onChunkRemoved(c) { for (const e of S.ents) if (e.home === c.key) e.dead = true; }

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
function meleeHit(e, t) {
  let dmg = e.k.dmg * e.dmgM;
  if (t.isPlayer) { if (e.k.antiHorse && P.mounted) dmg *= e.k.antiHorse; hurtPlayer(dmg, e); if (e.k.drain) e.hp = Math.min(e.maxHp, e.hp + dmg * e.k.drain); }
  else hurtEnt(t, dmg, e.x, e.y, 3, false);
  if (dist(e, P) < 25) sfx(e.k.spr === 'bandit' ? 'punch' : 'clang');
}
function aiMelee(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy), reach = k.range + (t.r || 0.5) + e.r * 0.5;
  if (e.state === 'wind') { e.wt -= dt; e.a = Math.atan2(dy, dx); if (e.wt <= 0) { e.state = 'move'; e.cd = k.cd * rr(0.85, 1.15); if (d < reach + 0.5) meleeHit(e, t); } return; }
  if (d > reach * 0.8) moveToward(e, t.x, t.y, k.spd, dt);
  if (d < reach && e.cd <= 0) { e.state = 'wind'; e.wt = k.wind * (e.kind === 'vampire' && hasTorch() && t.isPlayer ? 1.8 : 1); }
}
function fireAt(e, t, kind, speed, dmg) {
  const a = Math.atan2(t.y - e.y, t.x - e.x) + rr(-0.05, 0.05);
  S.projs.push({ x: e.x + Math.cos(a) * 0.7, y: e.y + Math.sin(a) * 0.7, elev: 1.3, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, vz: 0, team: e.team, dmg, life: 1.3, kind, src: e });
  if (kind === 'ball') { burst(e.x + Math.cos(a), e.y + Math.sin(a), 1.4, '#c8c8c8', 4, ['o', '.'], 1.5); if (dist(e, P) < 40) sfx('musket'); }
  else if (dist(e, P) < 30) sfx('bow');
}
function aiRanged(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
  if (e.state === 'aim') { e.wt -= dt; e.a = Math.atan2(dy, dx); if (e.wt <= 0) { e.state = 'move'; e.cd = k.cd * rr(0.9, 1.2); fireAt(e, t, k.proj, k.pspd, k.dmg * e.dmgM); } return; }
  if (d > 14) moveToward(e, t.x, t.y, k.spd, dt);
  else if (d < 7) moveToward(e, e.x - dx, e.y - dy, k.spd * 0.8, dt);
  else { moveToward(e, e.x - dy / d * e.strafe * 3, e.y + dx / d * e.strafe * 3, k.spd * 0.45, dt); if (Math.random() < dt * 0.3) e.strafe *= -1; }
  if (e.cd <= 0 && d < k.range) { e.state = 'aim'; e.wt = k.wind; }
}
function blinkTo(e, x, y) {
  if (blockedAt(x, y, e.r)) return false;
  burst(e.x, e.y, 1, '#b060e0', 10, ['*', '.', '~'], 3, true);
  e.x = x; e.y = y; e.invT = 0.3;
  burst(e.x, e.y, 1, '#b060e0', 10, ['*', '.', '~'], 3, true);
  if (dist(e, P) < 30) sfx('poof');
  return true;
}
function aiCaster(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
  if (e.state === 'cast') {
    e.wt -= dt; if (Math.random() < 0.5) part(e.x + rr(-0.6, 0.6), e.y + rr(-0.6, 0.6), e.elev + 1.2, 0, 0, 1, 0.3, '*', '#b060e0', 0, true);
    if (e.wt <= 0) {
      e.state = 'move'; e.cd = k.cd * rr(0.9, 1.25);
      const a = Math.atan2(dy, dx);
      S.projs.push({ x: e.x, y: e.y, elev: e.elev + 1.2, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, vz: 0, team: 1, dmg: k.dmg * e.dmgM, life: 4, kind: 'fire', target: t, src: e });
      if (dist(e, P) < 35) sfx('fire');
    }
    return;
  }
  if (d < 5 && e.tpCd <= 0) { const a = rr(0, TAU), rd = rr(11, 15); blinkTo(e, t.x + Math.cos(a) * rd, t.y + Math.sin(a) * rd); e.tpCd = 5; return; }
  if (d > 14) moveToward(e, t.x, t.y, k.spd, dt);
  else if (d < 9) moveToward(e, e.x - dx, e.y - dy, k.spd, dt);
  else { moveToward(e, e.x - dy / d * e.strafe * 3, e.y + dx / d * e.strafe * 3, k.spd * 0.5, dt); if (Math.random() < dt * 0.4) e.strafe *= -1; }
  if (e.cd <= 0 && d < k.range) { e.state = 'cast'; e.wt = k.wind; if (Math.random() < 0.4 && dist(e, P) < 30) sfx('cackle'); }
}
function aiCavalry(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy), want = Math.atan2(dy, dx);
  if (e.passT > 0) e.passT -= dt; else e.a += clamp(angDiff(e.a, want), -2.2 * dt, 2.2 * dt);
  e.spd = Math.min(k.spd, e.spd + 6 * dt);
  const ux = Math.cos(e.a), uy = Math.sin(e.a);
  if (blockedAt(e.x + ux * 2, e.y + uy * 2, e.r)) { e.a += 2.6 * dt * e.strafe; e.spd *= 0.97; }
  e.x += ux * e.spd * dt; e.y += uy * e.spd * dt; e.moving = true;
  if (Math.random() < dt * 10) part(e.x - ux, e.y - uy, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.4, '.', '#8a7a5a', 6);
  if (d < k.range + (t.r || 0.5) && e.cd <= 0 && Math.abs(angDiff(e.a, want)) < 1.2) { meleeHit(e, t); e.cd = k.cd; e.passT = 1.1; }
}
function giantSlam(e) {
  const R = 5; S.shake = Math.max(S.shake, dist(e, P) < 25 ? 0.7 : 0.2); sfx('slam');
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; part(e.x + Math.cos(a) * 1.5, e.y + Math.sin(a) * 1.5, 0.2, Math.cos(a) * 9, Math.sin(a) * 9, 2, 0.5, pick(['*', '.', 'o']), e.k.frost ? '#c8f0ff' : '#a8906a', 10); }
  const hitT = t => { const d = dist(e, t); if (d > R + (t.r || 0.5)) return; const dmg = e.k.dmg * e.dmgM * (1 - d / (R * 1.7));
    if (t.isPlayer) { hurtPlayer(dmg, e, { dismount: true, heavy: true }); const a = Math.atan2(P.y - e.y, P.x - e.x); P.kx += Math.cos(a) * 9; P.ky += Math.sin(a) * 9; if (e.k.frost) { P.slowT = 3; msg('Frozen! You are slowed.', '#9ae0ff'); } }
    else hurtEnt(t, dmg, e.x, e.y, 8, false); };
  if (S.mode === 'play') hitT(P);
  for (const a of S.ents) if (a.team === 0 && !a.dead) hitT(a);
}
function aiGiant(e, t, dt) {
  const k = e.k, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy);
  if (e.state === 'slam') { e.wt -= dt; if (e.wt <= 0) { e.state = 'move'; e.cd = k.cd; giantSlam(e); } return; }
  if (e.state === 'throw') {
    e.wt -= dt; e.a = Math.atan2(dy, dx);
    if (e.wt <= 0) {
      e.state = 'move'; e.throwCd = rr(4.5, 6.5);
      const T = clamp(d / 13, 0.9, 2.2);
      let tx = t.x, ty = t.y; if (t.isPlayer) { tx += Math.cos(P.a) * P.v * T * 0.5; ty += Math.sin(P.a) * P.v * T * 0.5; }
      const z0 = 5, g = 18;
      S.projs.push({ x: e.x, y: e.y, elev: z0, vx: (tx - e.x) / T, vy: (ty - e.y) / T, vz: (-z0 + 0.5 * g * T * T) / T, team: 1, dmg: k.dmg * 0.8 * e.dmgM, life: T + 0.6, kind: 'boulder', src: e, frost: k.frost });
      S.marks.push({ x: tx, y: ty, t: T });
    }
    return;
  }
  if (d < k.range + (t.r || 0.5) && e.cd <= 0) { e.state = 'slam'; e.wt = k.wind; if (dist(e, P) < 40) sfx('roar'); return; }
  if (d > 9 && d < 30 && e.throwCd <= 0) { e.state = 'throw'; e.wt = 0.9; return; }
  if (d > k.range * 0.7) moveToward(e, t.x, t.y, k.spd, dt);
}

function updateEnt(e, dt) {
  const k = e.k;
  e.cd -= dt; e.hurtT -= dt; e.invT -= dt; e.tpCd -= dt; e.throwCd -= dt; e.trampleCd -= dt; e.tT -= dt; e.moving = false;
  if (e.kx || e.ky) { e.x += e.kx * dt; e.y += e.ky * dt; const f = Math.pow(0.004, dt); e.kx *= f; e.ky *= f; if (Math.abs(e.kx) + Math.abs(e.ky) < 0.08) { e.kx = 0; e.ky = 0; } }
  if (e.burnT > 0) {
    e.burnT -= dt; e.burnTick = (e.burnTick || 0) - dt;
    if (e.burnTick <= 0) { e.burnTick = 0.5; hurtEnt(e, e.burnDps * 0.5, e.x, e.y, 0, true, true); }
    if (Math.random() < dt * 12) part(e.x + rr(-0.4, 0.4), e.y + rr(-0.4, 0.4), rr(0.5, 1.8), 0, 0, 2, 0.35, pick(FLAME), '#ff8a2a', 0, true);
    if (e.dead) return;
  }
  if (k.ai === 'none') { e.a = Math.atan2(P.y - e.y, P.x - e.x); return; }
  if (e.downT > 0) { e.downT -= dt; e.state = 'move'; return; }
  if (e.tT <= 0 || !e.target || e.target.dead || (e.target.isPlayer && S.mode !== 'play')) { e.target = pickTarget(e); e.tT = 0.4 + Math.random() * 0.3; }
  const t = e.target;
  if (k.hover) e.elev = k.hover + Math.sin(S.t * 2.3 + e.seed) * 0.35;
  if (!t) {
    e.state = 'move';
    if (e.post) { if (Math.hypot(e.post.x - e.x, e.post.y - e.y) > 1.5) moveToward(e, e.post.x, e.post.y, k.spd * 0.7, dt); }
    else if (e.team === 0) { if (e.leave) moveToward(e, e.x + Math.cos(e.leave) * 5, e.y + Math.sin(e.leave) * 5, k.spd * 0.8, dt); else if (dist(e, P) > 6) moveToward(e, P.x, P.y, k.spd, dt); }
    else if (e.team === 1 && S.mode === 'play' && dist(e, P) < 90) moveToward(e, P.x, P.y, k.spd * 0.6, dt);
    collide(e, e.r); return;
  }
  switch (k.ai) {
    case 'melee': aiMelee(e, t, dt); break;
    case 'ranged': aiRanged(e, t, dt); break;
    case 'caster': aiCaster(e, t, dt); break;
    case 'cavalry': aiCavalry(e, t, dt); break;
    case 'giant': aiGiant(e, t, dt); break;
  }
  if (e.post && Math.hypot(e.post.x - e.x, e.post.y - e.y) > 24) e.target = null;
  collide(e, e.r);
}

function hurtEnt(e, amt, sx, sy, kb, byPlayer, silent) {
  if (e.dead || e.invT > 0 || e.team === 2) return;
  e.hp -= amt; if (!silent) e.hurtT = 0.12;
  if (kb) { const dx = e.x - sx, dy = e.y - sy, d = Math.hypot(dx, dy) || 1, m = e.k.boss ? 0.12 : e.k.mounted ? 0.5 : 1; e.kx += dx / d * kb * m; e.ky += dy / d * kb * m; }
  if (byPlayer && !silent) addText(e.x, e.y, e.k.h + 0.4 + e.elev, String(Math.round(amt)), '#ffd84a');
  if (!silent) burst(e.x, e.y, e.k.h * 0.6 + e.elev, e.k.blood || '#c0302a', 4, null, 3);
  if (byPlayer && e.team === 1 && !e.target) e.target = P;
  if (e.state === 'wind' && !e.k.boss && Math.random() < 0.45) { e.state = 'move'; e.cd = 0.5; }
  if (e.hp <= 0) { killEnt(e, byPlayer); return; }
  if (e.k.blink && e.tpCd <= 0 && Math.random() < 0.3 && byPlayer) { const a = P.a + Math.PI + rr(-0.6, 0.6); if (blinkTo(e, P.x + Math.cos(a) * 2.4, P.y + Math.sin(a) * 2.4)) e.tpCd = 3.5; }
}
function killEnt(e, byPlayer) {
  e.dead = true; const k = e.k;
  if (e.team === 1) {
    S.kills++;
    const D = e.D || 0;
    dropGold(e.x, e.y, Math.round(k.gold * (1 + 0.3 * D) * rr(0.7, 1.3)));
    if (e.tut) { dropItem(e.x, e.y, 'rusty_sword'); if (S.tut === 0) tutAdvance(); }
    else if (k.loot) for (const L of k.loot) if (Math.random() < L[1]) { const id = rollLoot(L[0], D); dropItem(e.x, e.y, id, L[2] ? ri(L[2], L[3]) : 1); }
    if (byPlayer !== false) gainXP(Math.round(k.xp * (1 + 0.25 * D)));
    if (k.boss) { msg('The ' + k.name + ' has fallen!', '#ffd84a'); S.shake = Math.max(S.shake, 0.6); sfx('roar'); }
  }
  if (k.ash) { burst(e.x, e.y, 1, '#8a8a8a', 16, ['.', ',', '*', "'"], 3); burst(e.x, e.y, 1.2, k.blood, 6, ['*'], 3); }
  else if (k.corpse) { S.corpses.push({ x: e.x, y: e.y, c: k.corpse, t: 30 }); if (S.corpses.length > 40) S.corpses.shift(); burst(e.x, e.y, 1, k.blood || '#c0302a', 8, null, 3); }
  if (dist(e, P) < 30) sfx('die');
}
function gainXP(n) {
  P.xp += n;
  while (P.xp >= xpNext()) {
    P.xp -= xpNext(); P.level++; P.maxHp += 12; P.hp = P.maxHp;
    banner('LEVEL ' + P.level, 'Max HP +12 · damage +7%', 3.5, '#6aff7a'); sfx('level');
  }
}

// ---------- player ----------
function armorSlow() { return ITEMS[P.armor].slow; }
function horseMult() { return 1 - (1 - armorSlow()) * 0.45; }
function meleeTargets(range, cone) {
  const out = [];
  for (const e of S.ents) {
    if (e.team !== 1 || e.dead) continue;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) - e.r;
    if (d > range) continue;
    const ad = Math.abs(angDiff(P.a, Math.atan2(dy, dx)));
    if (ad > cone && d > 0.7) continue;
    if (e.elev > 2.2 && !P.mounted) continue;
    out.push([d, e]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.map(q => q[1]);
}
function swingArc(side, range, cone, fire) {
  const sg = side === 0 ? -1 : 1, el = P.mounted ? 2.0 : 1.2;
  for (let i = 0; i < 7; i++) {
    const t = i / 6, a = P.a + sg * cone * (1 - 2 * t);
    part(P.x + Math.cos(a) * range * 0.85, P.y + Math.sin(a) * range * 0.85, el, 0, 0, 0, 0.1 + i * 0.018, fire ? pick(FLAME) : (i % 2 ? '~' : '-'), fire ? '#ff8a2a' : '#e8f0ff', 0, true);
  }
}
function punch(s) {
  const m = P.mounted; P.cd[s] = s === 0 ? 0.3 : 0.42; P.anim[s] = 0.18;
  const ts = meleeTargets(m ? 2.6 : 1.9, 0.85); sfx('swing_light');
  if (!ts.length) { P.combo = 0; return; }
  const e = ts[0];
  P.combo = P.comboT > 0 ? P.combo + 1 : 1; P.comboT = 1.2;
  let dmg = ((s === 0 ? 5 : 8) + P.level * 0.8) * dmgMult();
  if (e.downT > 0) dmg *= 1.6;
  if (P.combo >= 3 && !e.k.boss && !e.k.mounted && !e.k.hover && e.downT <= 0) {
    dmg *= 2.2; e.downT = 1.8; e.state = 'move'; P.combo = 0;
    addText(e.x, e.y, 2.6, 'TAKEDOWN!', '#ffd84a'); S.shake = Math.max(S.shake, 0.25); sfx('takedown');
  }
  hurtEnt(e, dmg, P.x, P.y, 4, true); sfx('punch');
}
function slash(s, it) {
  const m = P.mounted; P.cd[s] = it.spd * (m ? 1.15 : 1); P.anim[s] = 0.22;
  const range = it.range + (m ? 0.6 : 0), cone = 1.0;
  let dmg = it.dmg * dmgMult(); if (m) dmg += Math.max(0, P.v) * 1.3 * horseMult();
  sfx(it.type === 'torch' ? 'torch' : 'swing'); swingArc(s, range, cone, !!it.fire);
  let hit = false;
  for (const e of meleeTargets(range, cone)) {
    let d = dmg;
    if (it.fire) { d *= e.k.unholy ? 2.5 : 1; e.burnT = 3; e.burnDps = e.k.unholy ? 7 : 3; }
    if (e.downT > 0) d *= 1.3;
    hurtEnt(e, d * rr(0.9, 1.1), P.x, P.y, m ? 6 : 4.5, true); hit = true;
  }
  if (hit) sfx('hit');
}
function bigSwing(it) {
  P.cd[0] = P.cd[1] = it.spd; P.anim[1] = 0.3; P.anim[0] = 0.3;
  const range = it.range + (P.mounted ? 0.6 : 0), cone = 1.5;
  let dmg = it.dmg * dmgMult(); if (P.mounted) dmg += Math.max(0, P.v) * 1.3;
  sfx('swing'); swingArc(1, range, cone, false); swingArc(0, range, cone, false);
  let hit = false;
  for (const e of meleeTargets(range, cone)) { hurtEnt(e, dmg * rr(0.9, 1.1), P.x, P.y, 8, true); hit = true; }
  if (hit) { sfx('hit'); S.shake = Math.max(S.shake, 0.15); }
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
function shootGun(s, it) {
  P.cd[s] = it.reload; P.anim[s] = 0.12;
  const t = findAim(32, 0.35); const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.a, el = P.mounted ? 2.0 : 1.3;
  S.projs.push({ x: P.x + Math.cos(a) * 0.8, y: P.y + Math.sin(a) * 0.8, elev: el, vx: Math.cos(a) * 46, vy: Math.sin(a) * 46, vz: 0, team: 0, dmg: it.dmg * dmgMult(), life: 0.9, kind: 'pball' });
  burst(P.x + Math.cos(a) * 1.2, P.y + Math.sin(a) * 1.2, el, '#ffd84a', 5, ['*', '+'], 2, true);
  burst(P.x + Math.cos(a) * 1.2, P.y + Math.sin(a) * 1.2, el, '#c8c8c8', 5, ['o', '.'], 1.2);
  sfx('gun'); S.shake = Math.max(S.shake, 0.12);
}
function loose(it) {
  const ch = clamp(P.draw / it.draw, 0, 1);
  if (ch < 0.2) return;
  if (!invTake('arrows')) { msg('No arrows! Buy them from a merchant.', '#ff9a7a'); return; }
  const t = findAim(40, 0.3); const a = t ? Math.atan2(t.y - P.y, t.x - P.x) : P.a, el = P.mounted ? 2.0 : 1.4, sp = 24 + 24 * ch;
  S.projs.push({ x: P.x + Math.cos(a) * 0.8, y: P.y + Math.sin(a) * 0.8, elev: el, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: 0, team: 0, dmg: it.dmg * (0.35 + 0.65 * ch) * dmgMult(), life: 1.6, kind: 'arrow' });
  sfx('bow');
}
function updateHands(dt, Lh, Rh) {
  const held = [Lh, Rh], ph = S.prevHeld, pressed = [Lh && !ph[0], Rh && !ph[1]];
  S.prevHeld = [Lh, Rh];
  P.blocking = false;
  if (twoHanded()) {
    const it = ITEMS[P.hands[1]], h = Lh || Rh;
    if (it.type === 'bow') {
      if (h) { if (!P.drawing && P.cd[1] <= 0) { P.drawing = true; P.draw = 0; } if (P.drawing) P.draw = Math.min(it.draw, P.draw + dt); }
      else if (P.drawing) { loose(it); P.drawing = false; P.draw = 0; P.cd[1] = 0.25; }
    } else if (it.type === 'sword2' && h && P.cd[1] <= 0) bigSwing(it);
    return;
  }
  P.drawing = false;
  for (let s = 0; s < 2; s++) {
    const id = P.hands[s], it = id ? ITEMS[id] : null;
    if (!it) { if ((pressed[s] || held[s]) && P.cd[s] <= 0) punch(s); continue; }
    switch (it.type) {
      case 'sword': case 'torch': if (held[s] && P.cd[s] <= 0) slash(s, it); break;
      case 'shield': if (held[s]) P.blocking = true; break;
      case 'gun': if (pressed[s] && P.cd[s] <= 0) shootGun(s, it); break;
    }
  }
}
function horseAction() {
  const h = S.horse;
  if (P.mounted) {
    P.mounted = false; h.state = 'idle';
    const p = findFree(P.x + Math.cos(P.a + Math.PI / 2) * 1.6, P.y + Math.sin(P.a + Math.PI / 2) * 1.6, 0.8, 1);
    h.x = p[0]; h.y = p[1]; h.a = P.a; P.v = Math.min(P.v, 4); msg('You dismount.');
    return;
  }
  const d = Math.hypot(h.x - P.x, h.y - P.y);
  if (d < 3.2) mount();
  else { h.state = 'coming'; msg('You whistle for your horse...'); sfx('whistle'); }
}
function mount() { P.mounted = true; S.horse.state = 'ridden'; sfx('neigh'); if (S.tut === 2) tutAdvance(); }
function updateHorse(dt) {
  const h = S.horse;
  if (P.mounted) { h.x = P.x; h.y = P.y; h.a = P.a; return; }
  if (h.state === 'coming') {
    const dx = P.x - h.x, dy = P.y - h.y, d = Math.hypot(dx, dy);
    if (d > 120) { const p = findFree(P.x - Math.cos(P.a) * 30, P.y - Math.sin(P.a) * 30, 0.8, 5); h.x = p[0]; h.y = p[1]; }
    if (d < 2.4) { if (S.mode === 'play') mount(); else h.state = 'idle'; }
    else { h.x += dx / d * 13 * dt; h.y += dy / d * 13 * dt; h.a = Math.atan2(dy, dx); collide(h, 0.8); if (Math.random() < dt * 12) part(h.x, h.y, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.4, '.', '#8a7a5a', 6); }
  } else if (h.state === 'flee') {
    h.fleeT -= dt; h.x += Math.cos(h.a) * 9 * dt; h.y += Math.sin(h.a) * 9 * dt; collide(h, 0.8);
    if (h.fleeT <= 0) h.state = 'idle';
  }
}

function hurtPlayer(amount, src, opts) {
  opts = opts || {};
  if (S.mode !== 'play' || P.invT > 0) return;
  let a = amount;
  const sh = shieldItem();
  if (P.blocking && sh && src && P.anim[0] <= 0 && P.anim[1] <= 0) {
    const ang = Math.atan2(src.y - P.y, src.x - P.x);
    if (Math.abs(angDiff(P.a, ang)) < 1.35) {
      a *= 1 - sh.block * (opts.heavy ? 0.5 : 1); sfx('block');
      burst(P.x + Math.cos(ang) * 0.9, P.y + Math.sin(ang) * 0.9, P.mounted ? 2 : 1.2, '#ffe6a0', 6, ['*', '+', "'"], 3, true);
    }
  }
  a *= 1 - ITEMS[P.armor].def;
  P.hp -= a; P.invT = 0.25; P.hurtT = 0.3; S.flash = Math.max(S.flash, clamp(a / 30, 0.15, 0.5));
  S.shake = Math.max(S.shake, 0.15 + a / 80);
  addText(P.x, P.y, 2.4, '-' + Math.round(a), '#ff5a4a'); sfx('hurt');
  try { navigator.vibrate && navigator.vibrate(30); } catch (e) { }
  if (opts.dismount && P.mounted) {
    P.mounted = false; const h = S.horse; h.state = 'flee'; h.fleeT = 1.6; h.a = P.a + rr(2, 4); h.x = P.x; h.y = P.y;
    msg('You are thrown from your horse!', '#ff9a7a'); sfx('neigh');
  }
  if (P.hp <= 0) { P.hp = 0; S.killer = src && src.k ? src.k.name : 'the wilds'; die(); }
}

function updatePlayer(dt, inp) {
  const m = P.mounted;
  P.cd[0] -= dt; P.cd[1] -= dt; P.anim[0] -= dt; P.anim[1] -= dt; P.comboT -= dt; P.invT -= dt; P.hurtT -= dt; P.slowT -= dt;
  if (P.comboT <= 0) P.combo = 0;
  updateHands(dt, inp.L, inp.R);
  const t = tileAt(P.x, P.y);
  let slow = m ? TDEF[t][4] : TDEF[t][3];
  if (P.slowT > 0) slow *= 0.55;
  let maxF, maxB;
  const sh = shieldItem();
  if (m) { maxF = 10.5 * horseMult(); maxB = 3.4; }
  else { maxF = 4.9 * armorSlow() * (P.blocking && sh ? sh.slow * 0.65 : 1) * (P.drawing ? 0.65 : 1); maxB = 2.6 * armorSlow(); }
  const target = inp.fwd > 0 ? inp.fwd * maxF : inp.fwd * maxB;
  const ice = t === T_ICE;
  const acc = ice ? 1.2 : m ? (target > P.v ? 3.0 : 4.5) : 12;
  P.v += (target - P.v) * Math.min(1, acc * dt);
  const tr = (m ? 2.3 - Math.min(0.7, Math.abs(P.v) * 0.05) : 2.9 * (0.75 + 0.25 * armorSlow()));
  P.a += inp.turn * tr * dt;
  P.x += Math.cos(P.a) * P.v * slow * dt + P.kx * dt; P.y += Math.sin(P.a) * P.v * slow * dt + P.ky * dt;
  const kf = Math.pow(0.01, dt); P.kx *= kf; P.ky *= kf;
  P.r = m ? 0.85 : 0.5;
  if (collide(P, P.r) && m && Math.abs(P.v) > 6) P.v *= 0.6;
  P.step += Math.abs(P.v) * dt;
  if (m && P.v > 6 && Math.random() < dt * 14) part(P.x - Math.cos(P.a) * 1.2, P.y - Math.sin(P.a) * 1.2, 0.1, rr(-1, 1), rr(-1, 1), 1, 0.45, t === T_SNOW || t === T_DRIFT ? '*' : '.', TDEF[t][0], 6);
  // trample
  if (m && P.v > 6) for (const e of S.ents) {
    if (e.team !== 1 || e.dead || e.k.boss || e.k.hover || e.trampleCd > 0) continue;
    const dx = e.x - P.x, dy = e.y - P.y; if (dx * dx + dy * dy > (P.r + e.r + 0.7) ** 2) continue;
    if (dx * Math.cos(P.a) + dy * Math.sin(P.a) < 0) continue;
    hurtEnt(e, (6 + P.v * 1.3) * horseMult() * dmgMult(), P.x, P.y, 9, true); e.trampleCd = 0.7; P.v *= 0.85; sfx('hit');
  }
  if (inp.horse) horseAction();
  if (inp.pot) drinkPotion();
  if (inp.use) doInteract();
  const two = twoHanded() ? ITEMS[P.hands[1]] : null;
  const ranged = (two && two.type === 'bow') || P.hands.some(id => id && ITEMS[id].type === 'gun');
  S.aim = ranged ? findAim(two ? 40 : 32, two ? 0.3 : 0.35) : null;
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
  S.fade = 1.6; P.hp = P.maxHp;
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
function updateProjs(dt) {
  for (const p of S.projs) {
    if (p.dead) continue;
    p.life -= dt; if (p.life <= 0) { p.dead = true; continue; }
    if (p.kind === 'fire') {
      const t = p.target && !p.target.dead ? p.target : P;
      const want = Math.atan2(t.y - p.y, t.x - p.x), cur = Math.atan2(p.vy, p.vx), na = cur + clamp(angDiff(cur, want), -1.6 * dt, 1.6 * dt), sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp; p.elev += ((t.isPlayer ? 1.3 : 1.2) - p.elev) * dt;
      if (Math.random() < dt * 30) part(p.x, p.y, p.elev, rr(-0.5, 0.5), rr(-0.5, 0.5), 0.5, 0.3, pick(['*', '.', "'"]), '#ff8a2a', 0, true);
    }
    if (p.kind === 'boulder') {
      p.vz -= 18 * dt; p.elev += p.vz * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.elev <= 0 || (p.elev < 3 && projBlocked(p.x, p.y, p.elev))) {
        p.dead = true; burst(p.x, p.y, 0.3, p.frost ? '#c8f0ff' : '#9a9488', 16, ['o', '.', '*'], 6);
        if (dist(p, P) < 22) { sfx('slam'); S.shake = Math.max(S.shake, 0.35); }
        const hitT = t => { const d = dist(p, t); if (d < 2.6) { if (t.isPlayer) hurtPlayer(p.dmg * (1 - d / 4), p.src, { heavy: true }); else hurtEnt(t, p.dmg, p.x, p.y, 6, false); } };
        if (S.mode === 'play') hitT(P);
        for (const e of S.ents) if (e.team === 0 && !e.dead) hitT(e);
        S.marks.shift();
      }
      continue;
    }
    const sp = Math.hypot(p.vx, p.vy), steps = Math.max(1, Math.ceil(sp * dt / 0.6));
    for (let s = 0; s < steps && !p.dead; s++) {
      p.x += p.vx * dt / steps; p.y += p.vy * dt / steps;
      if (projBlocked(p.x, p.y, p.elev)) { p.dead = true; burst(p.x, p.y, p.elev, p.kind === 'fire' ? '#ff8a2a' : '#c8b898', 4, ['*', '.'], 2, p.kind === 'fire'); break; }
      if (p.team === 1) {
        if (S.mode === 'play' && Math.hypot(P.x - p.x, P.y - p.y) < P.r + 0.45) { p.dead = true; hurtPlayer(p.dmg, p.src || p); if (p.kind === 'fire') burst(p.x, p.y, 1.3, '#ff8a2a', 8, FLAME.split(''), 3, true); break; }
        for (const e of S.ents) { if (e.team !== 0 || e.dead) continue; if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 0.45) { p.dead = true; hurtEnt(e, p.dmg, p.x - p.vx * 0.02, p.y - p.vy * 0.02, 3, false); break; } }
      } else {
        for (const e of S.ents) {
          if (e.team !== 1 || e.dead) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 0.5 && Math.abs(p.elev - (e.elev + e.k.h * 0.5)) < e.k.h * 0.8 + 0.6) {
            p.dead = true; hurtEnt(e, p.dmg, p.x - p.vx * 0.05, p.y - p.vy * 0.05, 3, true); sfx('hit'); break;
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

// ---------- separation ----------
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
    if (play) {
      const dx = a.x - P.x, dy = a.y - P.y, rs = a.r + P.r, d2 = dx * dx + dy * dy;
      if (d2 < rs * rs && d2 > 0) {
        const d = Math.sqrt(d2), o = rs - d, pm = P.mounted ? 2.5 : 1, am = a.k.ai === 'none' ? 50 : a.k.boss ? 6 : a.r * a.r * 4, tot = pm + am;
        a.x += dx / d * o * (pm / tot); a.y += dy / d * o * (pm / tot); P.x -= dx / d * o * (am / tot); P.y -= dy / d * o * (am / tot);
      }
    }
  }
}

// ---------- world events (director) ----------
function groupPos(spread) {
  for (let i = 0; i < 10; i++) {
    const a = P.a + rr(-1.4, 1.4), d = rr(36, 48);
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
      banner('BATTLE!', 'The Royal army clashes with the Usurper\'s redcoats ahead. Join the fight!', 4.5, '#ff7a5a'); sfx('horn'); break;
    }
    case 'vampires': {
      const n = ri(1, 2) + Math.floor(extra / 2) + (S.bloodMoon ? 2 : 0);
      for (let i = 0; i < n; i++) { const a = rr(0, TAU), d = rr(28, 38); spawnNear('vampire', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, 3); }
      msg(S.bloodMoon ? 'The blood moon calls the vampires...' : 'Something hungry stalks you in the dark...', '#d08aff'); sfx('hiss'); break;
    }
    case 'witches': {
      const n = ri(1, 2) + Math.floor(extra / 3);
      for (let i = 0; i < n; i++) { const a = rr(0, TAU), d = rr(20, 30); spawnNear('witch', P.x + Math.cos(a) * d, P.y + Math.sin(a) * d, 3); }
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
  ['A BANDIT!', 'You are unarmed. Punch with L and R hands. Land 3 hits in a row for a TAKEDOWN.'],
  ['LOOT', 'He dropped a rusty sword. Walk over it to pick it up.'],
  ['YOUR HORSE', 'Sword equipped in your right hand. Your horse waits nearby — press HORSE to ride.'],
  ['THE REALM', 'Explore! Ashford\'s merchant (by the fire) sells torches, shields, bows and armor. Nights are deadly — carry a torch.']
];
function tutAdvance() {
  S.tut++;
  if (S.tut < TUT.length) banner(TUT[S.tut][0], TUT[S.tut][1], 7, '#9ae0ff');
  if (S.tut === 3) S.dirT = 25;
}

// ---------- death / respawn ----------
function die() { S.mode = 'dying'; S.dieT = 1.8; P.mounted = false; P.v = 0; sfx('death'); msg('You have fallen...', '#ff5a4a'); }
function respawn() {
  const v = S.lastVillage;
  const lost = Math.floor(P.gold * 0.3); P.gold -= lost;
  P.x = v.x; P.y = v.y + 6; P.a = -Math.PI / 2; P.hp = Math.round(P.maxHp * 0.7); P.v = 0; P.kx = P.ky = 0; P.mounted = false;
  S.horse.x = v.x + 2.5; S.horse.y = v.y + 4; S.horse.state = 'idle';
  S.ents = S.ents.filter(e => e.team === 2 || e.post);
  S.projs = []; S.marks = []; S.battle = null; S.fade = 1.5; S.dirT = 20;
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
  S.t += dt;
  updateTime(dt);
  if (S.mode === 'play') updatePlayer(dt, inp); else P.v *= 0.9;
  updateHorse(dt);
  if (S.mode === 'play') director(dt);
  for (let i = 0; i < S.ents.length; i++) { const e = S.ents[i]; if (!e.dead) updateEnt(e, dt); }
  separate();
  if (S.mode === 'play') collide(P, P.r);
  updateProjs(dt); updateParts(dt); updateDrops(dt); updateBattle();
  for (const e of S.ents) if (!e.dead && !e.home && dist(e, P) > 110) e.dead = true;
  S.ents = S.ents.filter(e => !e.dead);
  for (const c of S.corpses) c.t -= dt; S.corpses = S.corpses.filter(c => c.t > 0 && Math.hypot(c.x - P.x, c.y - P.y) < 120);
  for (const m of S.marks) m.t -= dt; S.marks = S.marks.filter(m => m.t > -0.3);
  for (const m of S.msgs) m.t -= dt; S.msgs = S.msgs.filter(m => m.t > 0);
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  S.shake = Math.max(0, S.shake - dt * 1.8); S.flash = Math.max(0, S.flash - dt * 1.6); S.fade = Math.max(0, S.fade - dt * 0.8);
  // region notices
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
function updateCamera(dt, snap) {
  // top-down chase camera: centred on the player, rotated so the heading points up
  if (snap) CAM.a = P.a;
  CAM.a += angDiff(CAM.a, P.a) * Math.min(1, dt * 5);
  CAM.c = Math.cos(CAM.a); CAM.s = Math.sin(CAM.a);
  CAM.x = P.x; CAM.y = P.y;
}
