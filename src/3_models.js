// =====================================================================
//  MODELS — voxel models built in code (16 voxels per world unit)
//  Characters face −y. Humanoids are designed in a 32×32 frame centred
//  on (16,16) and placed into a 48×48 grid (offset 8) so weapons fit.
// =====================================================================
const GOLD = '#e0b840', STEEL = '#b8c2cc';
function flame(m, x, y, z, f, big) {
  const red = ci('#e8401a', true), org = ci('#ff8a1a', true), yel = ci('#ffd040', true), wht = ci('#fff4c0', true);
  const rs = big ? [2.4, 2.6, 2.4, 2.1, 1.8, 1.4, 1.0, 0.6] : [1.7, 1.8, 1.6, 1.3, 1.0, 0.6];
  for (let dz = 0; dz < rs.length; dz++) {
    const r = rs[dz], jx = Math.round(Math.sin(f * 2.1 + dz * 0.9) * (dz > 2 ? 1 : 0));
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dy); if (d > r) continue;
      if (d > r - 0.8 && hash2(dx * 13 + f * 7 + dz, dy * 7 + f * 3) < 0.25) continue;
      const k = d / r, col = (k < 0.35 && dz < rs.length - 2) ? wht : k < 0.65 ? yel : (dz > rs.length - 3 ? red : org);
      vs(m, x + dx + jx, y + dy, z + dz, col);
    }
  }
}
// ---------- held items ----------
function shieldVox(m, id, s, a, pose, ox, oy, oz) {
  let cx, cy, cz;
  if (pose === 'block') { cx = 16; cy = 9; cz = 17; } else { cx = a[0] + (s ? 0.5 : -0.5); cy = a[1] - 3; cz = a[2] + 6; }
  const F = (dx, dz, c) => vs(m, Math.floor(cx + dx) + ox, cy + oy, Math.floor(cz + dz) + oz, c);
  const Bk = (dx, dz, c) => vs(m, Math.floor(cx + dx) + ox, cy + 1 + oy, Math.floor(cz + dz) + oz, c);
  const back = ci('#5a3a20'), strap = ci('#3a2414'), rim = ci('#9aa4ae'), rimL = ci('#dce4ec'), gold = ci(GOLD), goldD = ci('#a88420');
  if (id === 'buckler') {
    const wd = ci('#8a5a2e'), wd2 = ci('#7a4e28');
    for (let dz = -5; dz <= 4; dz++) for (let dx = -5; dx <= 4; dx++) {
      const d = Math.hypot(dx + 0.5, dz + 0.5); if (d > 4.9) continue;
      F(dx, dz, d > 3.9 ? (dz > 0 ? rimL : rim) : ((dx & 1) ? wd : wd2)); Bk(dx, dz, back);
    }
    for (let dz = -1; dz <= 0; dz++) for (let dx = -1; dx <= 0; dx++) vs(m, Math.floor(cx + dx) + ox, cy - 1 + oy, Math.floor(cz + dz) + oz, rimL);
  } else if (id === 'kite_shield') {
    const fld = ci('#2f5fc0'), fldD = ci('#264e9e');
    for (let dz = -11; dz <= 7; dz++) {
      const w = dz >= -2 ? 5.5 : 5.5 * (dz + 11) / 9;
      for (let dx = -6; dx <= 5; dx++) {
        const xx = dx + 0.5; if (Math.abs(xx) > w) continue;
        const edge = Math.abs(xx) > w - 1 || dz === 7 || (dz < -2 && Math.abs(xx) > w - 1.6);
        let c = edge ? (dz > 2 ? rimL : rim) : (dx < 0 ? fld : fldD);
        if (!edge && (dx === 0 || dx === -1) && dz >= -7 && dz <= 3) c = gold;      // cross, vertical
        if (!edge && dz === 0 && Math.abs(xx) < 3.6) c = gold;                       // cross, horizontal
        if (!edge && dz >= 4 && dz <= 5 && Math.abs(xx) < 2.6 && (dz === 4 || dx % 2 === 0)) c = goldD; // little crown
        F(dx, dz, c); Bk(dx, dz, back);
      }
    }
    Bk(0, 2, strap); Bk(-1, 2, strap); Bk(0, -3, strap); Bk(-1, -3, strap);
  } else {
    const fld = ci('#2a3a64'), fldD = ci('#22304e');
    for (let dz = -12; dz <= 9; dz++) for (let dx = -7; dx <= 6; dx++) {
      const edge = dx === -7 || dx === 6 || dz === -12 || dz === 9;
      let c = edge ? (((dx + dz) % 3 === 0) ? gold : (dz > 4 ? rimL : rim)) : (dx < 0 ? fld : fldD);
      if (!edge && dz >= -1 && dz <= 0 && Math.abs(dx + 0.5) < 4.2) c = gold;                         // crown band
      if (!edge && dz >= 1 && dz <= 3 && (dx === -4 || dx === -1 || dx === 0 || dx === 3)) c = gold;    // crown points
      if (!edge && dz <= -2 && dz >= -9 && (dx === -1 || dx === 0)) c = goldD;                           // pale
      F(dx, dz, c); Bk(dx, dz, back);
    }
  }
}
function handItem(m, it, s, a, pose, ox, oy, oz, o) {
  const sg = s ? 1 : -1;
  const P_ = (dx, dy, dz, c) => vs(m, a[0] + sg * dx + ox, a[1] + dy + oy, a[2] + dz + oz, c);
  const L_ = (x0, y0, z0, x1, y1, z1, c, w) => vline(m, a[0] + sg * x0 + ox, a[1] + y0 + oy, a[2] + z0 + oz, a[0] + sg * x1 + ox, a[1] + y1 + oy, a[2] + z1 + oz, c, w);
  const gold = ci(GOLD), goldD = ci('#a88420'), wood = ci('#6a4424'), woodL = ci('#8e6238'), leather = ci('#3e2616'), steel = ci(STEEL), steelL = ci('#f0f6fc'), steelD = ci('#5e6670');
  switch (it.t) {
    case 'sword': {
      const bc = it.col || '#c8d0d8', bl = ci(bc), hl = cs(bc, 1.3);
      if (pose === 'atk') {
        L_(0, -1, 0, -15, -8, 1, bl); L_(-1, -1, 1, -15, -8, 2, hl);
        L_(1, -3, 0, -1, 1, 0, gold); P_(1, 2, 0, gold); P_(0, 1, 0, leather);
      } else {
        P_(0, 3, 0, gold); P_(-1, 3, 0, gold); L_(0, 1, 0, 0, 2, 0, leather); L_(-1, 1, 0, -1, 2, 0, leather);
        L_(-3, -1, 0, 2, -1, 0, gold); P_(-3, -1, -1, goldD); P_(2, -1, -1, goldD);
        L_(0, -2, 0, 0, -15, -4, bl); L_(-1, -2, 0, -1, -15, -4, hl); P_(0, -16, -4, bl);
      }
      break;
    }
    case 'claymore': {
      if (pose === 'atk') { L_(0, -1, 0, -24, -9, 1, steel); L_(-1, -1, 1, -24, -9, 2, steelL); L_(2, -4, 0, -1, 2, 0, gold); P_(1, 2, 0, gold); }
      else {
        L_(0, 0, 0, 0, 0, 4, leather); P_(0, 0, -1, gold); L_(-4, 0, 5, 3, 0, 5, gold); P_(-4, 0, 4, goldD); P_(3, 0, 4, goldD);
        L_(0, 0, 6, 3, 8, 30, steel); L_(-1, 0, 6, 2, 8, 30, steelL);
      }
      break;
    }
    case 'torch': {
      const cloth = ci('#3a2a1a');
      if (pose === 'atk') { L_(0, -1, 0, 3, -6, 6, wood); P_(3, -7, 7, cloth); P_(4, -7, 7, cloth); flame(m, a[0] + sg * 3 + ox, a[1] - 8 + oy, a[2] + 8 + oz, o.ff, true); }
      else { L_(0, -1, 0, 1, -2, 12, wood); L_(1, -2, 13, 1, -2, 14, cloth, 1); flame(m, a[0] + sg * 1 + ox, a[1] - 2 + oy, a[2] + 15 + oz, o.ff, true); }
      break;
    }
    case 'shield': shieldVox(m, it.id, s, a, pose, ox, oy, oz); break;
    case 'pistol':
      if (pose === 'aim') { L_(0, -1, 1, 0, -8, 1, steelD); P_(0, -9, 1, steelD); P_(0, -3, 1, gold); P_(0, -6, 1, gold); L_(0, 0, 0, 0, 1, -2, wood); P_(0, 1, 2, steel); }
      else { P_(0, 0, 1, wood); L_(0, -1, 1, 0, -7, -1, steelD); P_(0, -4, 0, gold); P_(0, 0, 2, steel); }
      break;
    case 'musket':
      if (pose === 'aim') { L_(0, 9, -1, 0, 1, 0, wood); L_(0, 0, 0, 0, -12, 0, steelD); P_(0, 1, 1, steel); L_(0, -13, 0, 0, -18, 0, steelL); }
      else { L_(0, -1, -8, 0, -1, 8, wood); L_(0, -2, -8, 0, -2, 4, woodL); P_(0, -2, 6, steel); L_(0, -1, 9, 0, -1, 24, steelD); L_(0, -1, 25, 0, -1, 31, steelL); }
      break;
    case 'pike': {
      if (pose === 'atk') { L_(0, 10, 0, 0, -6, 0, wood); L_(0, -7, 0, 0, -12, 0, steel); P_(1, -8, 0, steel); P_(-1, -8, 0, steel); P_(0, -9, 1, steelL); }
      else { L_(0, -1, -9, 0, -1, 30, wood); L_(0, -1, 31, 0, -1, 36, steel); P_(1, -1, 32, steel); P_(-1, -1, 32, steel); P_(0, -1, 34, steelL); P_(0, -1, 30, ci('#c03030')); P_(0, -1, 29, ci('#c03030')); }
      break;
    }
    case 'bow': {
      const bw = ci('#7a4a22'), bwL = ci('#9a6232'), str = ci('#f0e8d0'), shaft = ci('#c8a070'), fl = ci('#f4f0e8'), flR = ci('#c03030');
      if (pose === 'draw') { // bow held out in front, string pulled to the cheek
        const bx = 10 + ox, by = 4 + oy, bz = 18 + oz, hx2 = 18 + ox, hy = 12 + oy, hz = 19 + oz;
        for (let k = -12; k <= 12; k++) { const back = Math.round((k / 12) ** 2 * 4); vs(m, bx, by + back, bz + k, Math.abs(k) < 2 ? leather : (k > 0 ? bwL : bw)); }
        vline(m, bx, by + 4, bz + 12, hx2, hy, hz, str); vline(m, bx, by + 4, bz - 12, hx2, hy, hz, str);
        vline(m, hx2 - 1, hy, hz, bx + 1, by - 5, bz, shaft); vs(m, bx + 1, by - 6, bz, steelL); vs(m, bx + 1, by - 7, bz, steel);
        vs(m, hx2 - 1, hy + 1, hz, fl); vs(m, hx2 - 2, hy, hz, flR);
      } else {
        for (let k = -10; k <= 12; k++) { const back = Math.round((k / 11) ** 2 * 3); P_(1, -1 + back, k, Math.abs(k) < 2 ? leather : (k > 0 ? bwL : bw)); }
        L_(1, 3, -10, 1, 3, 12, str);
      }
      break;
    }
  }
}
// ---------- humanoid ----------
function human(m, o, ox, oy, oz) {
  const S_ = (x, y, z, c) => vs(m, x + ox, y + oy, z + oz, c);
  const B_ = (x0, y0, z0, x1, y1, z1, c) => vbox(m, x0 + ox, y0 + oy, z0 + oz, x1 + ox, y1 + oy, z1 + oz, c);
  const coat = ci(o.coat), coatD = ci(o.coatD || hx(o.coat, 0.78));
  const skinH = o.skin || '#e8b890', skin = ci(skinH), skinD = cs(skinH, 0.78);
  const hair = ci(o.hair || '#4a2e18'), pantsH = o.pants || '#d8d0bc', pants = ci(pantsH);
  const bootsH = o.boots || '#2a2018', boots = ci(bootsH), bootsL = cs(bootsH, 1.7), belt = ci(o.belt || '#3a2616'), gold = ci(GOLD);
  const sleeve = o.sleeve ? ci(o.sleeve) : coat, cuff = ci(o.cuff || o.facing || hx(o.sleeve || o.coat, 0.75));
  const fr = o.frame | 0, st = fr === 1 ? -2 : fr === 2 ? 2 : 0;
  // --- legs
  if (o.robe) {
    const rb = ci(o.robe), rbD = cs(o.robe, 0.72);
    for (let z = 0; z <= 19; z++) vdisc(m, 16 + ox, 16 + oy, 7 - z * 0.13, z + oz, rb);
    vpaint(m, (x, y, z) => (Math.floor((Math.atan2(y + 0.5 - 16 - oy, x + 0.5 - 16 - ox) + Math.PI) / TAU * 14) % 2 ? rbD : undefined), ox, oy, oz, ox + 31, oy + 31, oz + 19);
    B_(9, 9, 0, 23, 23, 1, rbD);
  } else if (o.mounted) {
    for (const lx of [8, 22]) { B_(lx, 14, 5, lx + 1, 17, 11, pants); B_(lx, 13, 0, lx + 1, 17, 4, boots); B_(lx, 14, 4, lx + 1, 17, 4, bootsL); }
    B_(10, 14, 10, 21, 17, 11, pants);
  } else {
    for (const [lx, s] of [[12, st], [16, -st]]) {
      B_(lx, 14 + s, 4, lx + 3, 17 + s, 11, pants);
      B_(lx, 14 + s, 0, lx + 3, 17 + s, 3, boots); B_(lx, 13 + s, 0, lx + 3, 13 + s, 1, boots);
      B_(lx, 14 + s, o.tallBoots ? 8 : 3, lx + 3, 17 + s, o.tallBoots ? 8 : 3, bootsL);
      if (o.tallBoots) B_(lx, 14 + s, 4, lx + 3, 17 + s, 7, boots);
      if (o.gaiters) { B_(lx, 14 + s, 4, lx + 3, 17 + s, 7, ci(o.gaiters)); S_(lx + (lx < 16 ? 0 : 3), 15 + s, 5, gold); S_(lx + (lx < 16 ? 0 : 3), 15 + s, 7, gold); }
      if (o.greaves) { const g = ci(o.greaves), gl = ci('#f4f8fc'); B_(lx, 13 + s, 2, lx + 3, 13 + s, 10, g); B_(lx, 14 + s, 6, lx + 3, 17 + s, 8, g); S_(lx + 1, 13 + s, 7, gl); S_(lx + 1, 13 + s, 8, gl); }
    }
  }
  // --- torso
  B_(12, 13, o.robe ? 16 : 12, 19, 18, 20, coat);
  if (!o.robe && !o.mounted && !o.noSkirt) { B_(11, 12, 8, 20, 19, 11, coat); B_(11, 12, 8, 20, 19, 8, coatD); B_(15, 12, 8, 16, 13, 11, 0); }
  if (o.mail) { const a = ci(o.mail), b = cs(o.mail, 0.78); vpaint(m, (x, y, z, c) => c === coat || c === coatD ? (((x + y + z) & 1) ? a : b) : undefined, ox + 10, oy + 11, oz + 8, ox + 21, oy + 20, oz + 21); }
  if (o.quilt) { const q = cs(o.coat, 0.8); vpaint(m, (x, y, z, c) => c === coat && ((z - oz) % 3 === 0 || (((x - ox) % 3 === 0) && ((y - oy) === 13 || (y - oy) === 12))) ? q : undefined, ox + 10, oy + 11, oz + 8, ox + 21, oy + 20, oz + 20); }
  if (o.plate) {
    const pl = ci(o.plate), hl = ci('#f8fcff'), pd = cs(o.plate, 0.8);
    B_(12, 13, 13, 19, 18, 20, pl); B_(12, 12, 14, 19, 12, 19, pl);
    B_(15, 12, 15, 15, 12, 19, hl); B_(16, 12, 17, 16, 12, 19, hl);
    B_(12, 13, 13, 19, 13, 13, pd);
    B_(9, 13, 19, 11, 18, 21, pl); B_(20, 13, 19, 22, 18, 21, pl); S_(10, 14, 21, hl); S_(21, 14, 21, hl);           // pauldrons
    if (!o.mounted) { B_(11, 12, 9, 20, 12, 11, pd); B_(11, 12, 10, 20, 12, 10, pl); }                                 // tassets
  }
  if (!o.robe) { B_(12, 13, 12, 19, 18, 13, belt); S_(15, 12, 12, gold); S_(16, 12, 12, gold); S_(15, 12, 13, gold); S_(16, 12, 13, gold); }
  if (o.ropeBelt) { const rp = ci('#b09060'); B_(12, 13, 12, 19, 18, 12, rp); S_(13, 12, 11, rp); S_(13, 12, 10, rp); }
  if (o.facing) { const f = ci(o.facing); B_(13, 13, 14, 13, 13, 20, f); B_(18, 13, 14, 18, 13, 20, f); }
  if (o.trim) { const t = ci(o.trim); B_(13, 13, 20, 18, 18, 20, t); }
  if (o.buttons) for (const z of [14, 16, 18]) { S_(14, 13, z, gold); S_(17, 13, z, gold); }
  if (o.lacing) { const l = ci('#6a4a2a'); S_(15, 13, 20, skin); S_(16, 13, 20, skin); S_(15, 13, 19, l); S_(16, 13, 18, l); S_(15, 13, 17, l); S_(16, 13, 16, l); }
  if (o.straps) {
    const sd = ci('#4a2e16'), bk = ci('#c8ccd0');
    for (const y of [13, 18]) for (let i = 0; i <= 7; i++) { S_(12 + i, y, 20 - i, sd); S_(13 + i, y, 20 - i, sd); }
    S_(15, 13, 17, bk); S_(16, 13, 17, bk);
    B_(10, 13, 19, 11, 18, 21, sd); B_(20, 13, 19, 21, 18, 21, sd);
    B_(18, 12, 10, 19, 13, 12, ci('#5a3a1e')); B_(12, 12, 10, 13, 13, 12, ci('#5a3a1e'));
  }
  if (o.cross) {
    const w = ci('#f2eee4');
    for (const y of [13, 18]) for (let i = 0; i <= 8; i++) { const x = Math.round(12 + i * 7 / 8), x2 = Math.round(19 - i * 7 / 8), z = 20 - i; S_(x, y, z, w); S_(Math.min(19, x + 1), y, z, w); S_(x2, y, z, w); S_(Math.max(12, x2 - 1), y, z, w); }
    B_(14, 19, 13, 17, 19, 15, ci('#2a1e16'));
  }
  if (o.apron) { const ap = ci(o.apron); B_(13, 12, 8, 18, 12, 19, ap); B_(13, 13, 19, 18, 13, 20, ap); }
  if (o.pack) { const pk2 = ci('#7a5230'), pkD = ci('#5a3a1e'); B_(12, 19, 12, 19, 22, 22, pk2); B_(12, 22, 12, 19, 22, 13, pkD); B_(11, 19, 23, 20, 22, 25, ci('#c8b898')); B_(13, 19, 15, 13, 19, 22, pkD); B_(18, 19, 15, 18, 19, 22, pkD); }
  if (o.patches) { const pa = ci(o.patches); S_(13, 13, 16, pa); S_(14, 13, 16, pa); S_(13, 13, 15, pa); S_(18, 18, 18, pa); S_(17, 18, 18, pa); }
  if (o.cape) {
    const cin = ci(o.capeIn), cout = ci(o.cape);
    B_(10, 19, 2, 21, 19, 20, cin); B_(10, 20, 1, 21, 20, 20, cout); B_(9, 19, 1, 9, 20, 12, cout); B_(22, 19, 1, 22, 20, 12, cout);
    for (let x = 9; x <= 22; x += 3) B_(x, 20, 1, x, 20, 18, cs(o.cape, 0.75));
    B_(11, 20, 21, 20, 20, 31, cin); B_(11, 21, 21, 20, 21, 31, cout); B_(10, 16, 21, 10, 21, 29, cout); B_(21, 16, 21, 21, 21, 29, cout);
  }
  // --- arms
  const poses = [o.poseL || 'idle', o.poseR || 'idle'], hands = [];
  const pa = o.plateArms ? ci(o.plateArms) : 0;
  for (let s = 0; s < 2; s++) {
    const ax = s ? 20 : 10, outer = s ? 21 : 10, p = poses[s];
    let h;
    if (p === 'atk' || p === 'claw') { B_(ax, 14, 18, ax + 1, 17, 20, sleeve); B_(ax, 7, 18, ax + 1, 13, 19, sleeve); B_(ax, 7, 18, ax + 1, 8, 19, cuff); B_(ax, 5, 18, ax + 1, 6, 19, skin); h = [outer, 5, 18]; if (p === 'claw') { S_(ax, 4, 18, ci('#f0f0f8')); S_(ax + 1, 4, 18, ci('#f0f0f8')); } }
    else if (p === 'aim') { B_(ax, 14, 17, ax + 1, 17, 20, sleeve); B_(ax, 8, 16, ax + 1, 13, 17, sleeve); B_(ax, 8, 16, ax + 1, 9, 17, cuff); B_(ax, 6, 16, ax + 1, 7, 17, skin); h = [outer, 6, 16]; }
    else if (p === 'draw') {
      if (!s) { B_(ax, 14, 18, ax + 1, 17, 20, sleeve); B_(ax, 6, 18, ax + 1, 13, 19, sleeve); B_(ax, 4, 18, ax + 1, 5, 19, skin); h = [outer, 4, 18]; }
      else { B_(ax, 14, 18, ax + 1, 17, 20, sleeve); B_(18, 12, 19, 21, 13, 20, sleeve); B_(18, 11, 19, 19, 11, 20, skin); h = [19, 11, 19]; }
    }
    else if (p === 'block') { B_(ax, 14, 16, ax + 1, 17, 20, sleeve); const bx = s ? 18 : 12; B_(bx, 10, 15, bx + 1, 13, 16, sleeve); B_(bx, 9, 15, bx + 1, 9, 16, skin); h = [bx, 9, 15]; }
    else if (p === 'up') { B_(ax, 15, 18, ax + 1, 16, 30, sleeve); B_(ax, 15, 31, ax + 1, 16, 32, skin); h = [outer, 15, 31]; if (o.spark) { S_(ax, 14, 33, ci('#d070ff', true)); S_(ax + 1, 15, 34, ci('#f0b0ff', true)); S_(ax, 16, 35, ci('#b050ff', true)); } }
    else { const sw = fr ? (s ? st : -st) / 2 : 0; B_(ax, 14 + sw, 12, ax + 1, 17 + sw, 20, sleeve); B_(ax, 14 + sw, 12, ax + 1, 17 + sw, 13, cuff); B_(ax, 15 + sw, 10, ax + 1, 16 + sw, 11, o.gauntlet ? ci(o.gauntlet) : skin); h = [outer, 15 + sw, 10]; }
    if (pa && p === 'idle') { const sw = fr ? (s ? st : -st) / 2 : 0; S_(outer, 14 + sw, 17, ci('#f4f8fc')); S_(outer, 14 + sw, 16, pa); }
    hands.push(h);
  }
  // --- head
  B_(14, 14, 21, 17, 17, 21, skin);
  B_(12, 12, 22, 19, 19, 28, skin);
  for (const [x, y] of [[12, 12], [19, 12], [12, 19], [19, 19]]) { S_(x, y, 22, 0); S_(x, y, 28, 0); }
  const eye = ci(o.eye || '#20140c', !!o.eyeEm), white = ci('#f4f0ec');
  S_(13, 12, 25, white); S_(14, 12, 25, eye); S_(17, 12, 25, eye); S_(18, 12, 25, white);
  S_(13, 12, 26, hair); S_(14, 12, 26, hair); S_(17, 12, 26, hair); S_(18, 12, 26, hair);
  S_(15, 11, 24, skinD); S_(16, 11, 24, skinD); S_(15, 11, 23, skinD);
  if (o.longNose) { S_(15, 10, 23, skinD); S_(15, 9, 22, skinD); S_(16, 10, 23, ci('#4a7a30')); }
  S_(15, 12, 22, ci(o.mouth || '#9a4a3a')); S_(16, 12, 22, ci(o.mouth || '#9a4a3a'));
  if (o.fangs) { S_(15, 11, 22, white); S_(16, 11, 22, white); }
  B_(12, 19, 22, 19, 19, 28, hair); B_(12, 13, 28, 19, 19, 28, hair); B_(12, 15, 25, 12, 19, 28, hair); B_(19, 15, 25, 19, 19, 28, hair);
  if (o.queue) { B_(15, 20, 20, 16, 20, 25, hair); S_(15, 20, 25, ci('#101010')); S_(16, 20, 25, ci('#101010')); }
  if (o.longHair) B_(12, 20, 14, 19, 20, 27, hair);
  if (o.mask) { const mk = ci(o.mask); B_(12, 12, 22, 19, 12, 23, mk); S_(15, 11, 23, mk); S_(16, 11, 23, mk); }
  // --- hats
  const H = o.hat;
  if (H === 'tricorn') {
    const hc = ci(o.hatC || '#221c22'), lace = ci(o.lace || '#e8dcb0');
    const V = [[0, -8], [-8, 5.5], [8, 5.5]];
    for (let y = 6; y <= 26; y++) for (let x = 6; x <= 26; x++) {
      const px2 = x + 0.5 - 16, py = y + 0.5 - 16.5; let mind = 1e9, inside = true;
      for (let k = 0; k < 3; k++) {
        const [ax2, ay] = V[k], [bx, by] = V[(k + 1) % 3], ex = bx - ax2, ey = by - ay, L = Math.hypot(ex, ey);
        const d = ((px2 - ax2) * ey - (py - ay) * ex) / L; if (d > 0) inside = false; mind = Math.min(mind, -d);
      }
      if (!inside) continue;
      S_(x, y, 29, hc); if (mind < 1.6) { S_(x, y, 30, hc); S_(x, y, 31, lace); }
    }
    vcyl(m, 16 + ox, 16.5 + oy, 3.6, 30 + oz, 32 + oz, hc);
    if (o.cockade) { S_(19, 10, 31, ci(o.cockade)); S_(19, 10, 30, ci(o.cockade)); }
  } else if (H === 'coif') {
    const a = ci('#9aa4ae'), b = ci('#7a848e');
    for (let z = 21; z <= 29; z++) for (let y = 11; y <= 20; y++) for (let x = 11; x <= 20; x++) {
      const shell = x === 11 || x === 20 || y === 20 || z === 29 || y === 11;
      if (!shell) continue;
      if (y === 11 && x >= 13 && x <= 18 && z >= 22 && z <= 27) continue;
      S_(x, y, z, ((x + y + z) & 1) ? a : b);
    }
    B_(10, 12, 19, 21, 20, 20, a);
  } else if (H === 'sallet' || H === 'great') {
    const st = ci(o.helmC || '#c8d2dc'), hl = ci('#f8fcff'), dk = ci('#20242c');
    if (H === 'great') {
      B_(11, 11, 21, 20, 20, 30, st); B_(12, 12, 31, 19, 19, 31, st);
      B_(12, 11, 25, 19, 11, 25, dk); for (const x of [14, 17]) S_(x, 11, 23, dk);
      B_(15, 11, 21, 16, 11, 30, hl);
      if (o.crest) for (let y = 12; y <= 21; y++) { const hgt = 2 + ((hash2(y, 7) * 3) | 0); B_(15, y, 32, 16, y, 31 + hgt, ci(o.crest)); }
    } else {
      B_(11, 11, 26, 20, 20, 30, st); B_(12, 12, 31, 19, 19, 31, st); B_(12, 21, 26, 19, 22, 27, st);
      B_(12, 11, 26, 19, 11, 26, dk); B_(15, 13, 31, 15, 19, 31, hl); S_(15, 11, 29, hl); S_(15, 11, 30, hl);
      if (o.crest) B_(15, 13, 32, 16, 19, 33, ci(o.crest));
    }
  } else if (H === 'hood') {
    const hc = ci(o.hatC || '#4a3a28'), hd = cs(o.hatC || '#4a3a28', 0.8);
    B_(11, 12, 21, 11, 20, 29, hc); B_(20, 12, 21, 20, 20, 29, hc); B_(11, 20, 21, 20, 20, 29, hc); B_(11, 11, 29, 20, 20, 29, hc);
    B_(11, 11, 27, 20, 11, 28, hd); B_(15, 18, 30, 16, 21, 31, hc); B_(10, 12, 19, 21, 21, 20, hc);
  } else if (H === 'morion') {
    const st = ci('#c0c8d0'), hl = ci('#f0f6fc');
    for (let y = 6; y <= 26; y++) for (let x = 6; x <= 26; x++) { const dx = x + 0.5 - 16, dy = y + 0.5 - 16; if (dx * dx / 64 + dy * dy / 100 > 1) continue; S_(x, y, 28 + (Math.abs(dy) > 6.5 ? 1 : 0), st); }
    vcyl(m, 16 + ox, 16 + oy, 4.4, 29 + oz, 31 + oz, st); B_(15, 9, 32, 16, 23, 33, st); B_(15, 10, 33, 15, 22, 33, hl);
  } else if (H === 'cap') {
    const hc = ci(o.hatC || '#6a4a2a'); B_(12, 12, 29, 19, 19, 29, hc); B_(13, 13, 30, 18, 18, 30, hc); B_(12, 9, 28, 19, 11, 28, cs(o.hatC || '#6a4a2a', 0.8)); S_(16, 13, 31, ci('#c03030'));
  } else if (H === 'witch') {
    const hc = ci(o.hatC), band = ci('#2a1830'), bk = ci(GOLD);
    vdisc(m, 16 + ox, 16 + oy, 9.5, 29 + oz, hc);
    for (let z = 30; z <= 46; z++) { const t = (z - 30) / 16, r = lerp(5, 0.6, t), bend = Math.max(0, (z - 38)) * 0.45; vdisc(m, 16 + ox, 16.5 + bend + oy, r, z + oz, z <= 31 ? band : hc); }
    S_(16, 11, 30, bk); S_(16, 11, 31, bk); S_(15, 11, 30, bk);
  }
  // --- held items
  if (o.L && o.L.t === 'bow' && poses[0] === 'draw') handItem(m, o.L, 0, hands[0], 'draw', ox, oy, oz, o);
  else {
    if (o.L) handItem(m, o.L, 0, hands[0], poses[0], ox, oy, oz, o);
    if (o.R) handItem(m, o.R, 1, hands[1], poses[1], ox, oy, oz, o);
  }
  if (o.broom) {
    const st2 = ci('#7a5230'), straw = ci('#d8b050'), strawD = ci('#a88430'), tie = ci('#5a2a1a');
    vline(m, 16 + ox, 2 + oy, oz - 1, 16 + ox, 30 + oy, oz - 1, st2);
    for (let y = 28; y <= 38; y++) { const r = 1 + (y - 28) * 0.35; for (let dx = -3; dx <= 3; dx++) for (let dz = -2; dz <= 1; dz++) if (dx * dx + dz * dz * 2 <= r * r) vs(m, 16 + dx + ox, y + oy, oz - 1 + dz, (dx + y) & 1 ? straw : strawD); }
    for (let dx = -1; dx <= 1; dx++) vs(m, 16 + dx + ox, 28 + oy, oz - 1, tie);
  }
}
function mkHuman(o) { const m = VM(48, 48, o.H || 48); human(m, o, 8, 8, o.broom ? 2 : 0); return m; }
// ---------- horse ----------
function horseVox(m, o) {
  const base = o.coat || '#8a5a32', body = ci(base), bodyD = cs(base, 0.8), dark = ci(o.dark || '#2a1a10'), hoof = ci('#1e1814'), muzzle = ci(o.muzzle || hx(base, 0.55)), white = ci('#f0ece0');
  const f = o.frame | 0;
  const legs = [[15, 23, 0], [23, 23, 1], [15, 41, 1], [23, 41, 0]];
  for (const [x, y, ph] of legs) {
    const sw = f === 0 ? 0 : ((f === 1) === (ph === 0) ? -4 : 4);
    vbox(m, x, y, 9, x + 2, y + 2, 17, body);
    vline(m, x + 0.5, y + 1, 9, x + 0.5, y + 1 + sw, 2, o.stockings ? white : dark, 1);
    vbox(m, x, y + sw, 0, x + 2, y + 2 + sw, 1, hoof);
  }
  vblob(m, 20, 33, 20, 6.5, 12, 5.5, body);
  vblob(m, 20, 23, 20, 6, 4.5, 5.5, body);
  vblob(m, 20, 42, 21, 6.6, 5.5, 5.5, body);
  vpaint(m, (x, y, z, c) => c === body && z < 17 ? bodyD : undefined);
  for (let k = 0; k <= 10; k++) vblob(m, 20, 22 - k, 24 + k, 3.2, 3, 2.6, body);
  vblob(m, 20, 9, 35, 3.2, 4, 3.2, body); vblob(m, 20, 5, 33, 2.6, 3.4, 2.6, body);
  vblob(m, 20, 2.5, 32.5, 2.3, 1.8, 2.2, muzzle);
  vs(m, 18, 1, 32, dark); vs(m, 21, 1, 32, dark);
  vs(m, 17, 7, 36, dark); vs(m, 22, 7, 36, dark); vs(m, 17, 6, 36, white); vs(m, 22, 6, 36, white);
  vbox(m, 17, 11, 38, 18, 12, 41, body); vbox(m, 21, 11, 38, 22, 12, 41, body);
  if (o.blaze) vline(m, 20, 3, 35, 20, 9, 38, white, 1);
  for (let k = 0; k <= 12; k++) { const y = 24 - k, z = 27 + k; vbox(m, 19, y, z, 20, y + 1, z + 1, dark); if (k % 3 === 0) { vs(m, 18, y + 1, z - 1, dark); vs(m, 21, y, z - 1, dark); } }
  vbox(m, 19, 8, 38, 20, 9, 39, dark);
  vtube(m, 20, 47, 23, 20, 50, 17, 1.6, dark); vtube(m, 20, 50, 17, 20.5, 52, 8, 1.3, dark);
  if (o.saddle) {
    const cl = ci(o.cloth || '#9a2a22'), clT = ci(GOLD), sd = ci('#4a2414'), sdL = ci('#7a4426'), br = ci('#3a2010'), iron = ci('#8a8e94');
    vpaint(m, (x, y, z, c) => (y >= 27 && y <= 37 && z >= 17 && (x <= 15 || x >= 25 || z >= 24)) ? (z === 17 || y === 27 || y === 37 ? clT : cl) : undefined);
    vbox(m, 15, 28, 26, 25, 36, 26, sd); vbox(m, 15, 28, 27, 25, 28, 27, sdL); vbox(m, 15, 36, 27, 25, 36, 28, sdL);
    vbox(m, 19, 27, 27, 21, 28, 29, sdL);
    vline(m, 13, 32, 24, 12, 32, 15, br); vline(m, 27, 32, 24, 28, 32, 15, br);
    vbox(m, 11, 31, 13, 13, 33, 14, iron); vbox(m, 27, 31, 13, 29, 33, 14, iron);
    vpaint(m, (x, y, z, c) => c === muzzle && y >= 3 && y <= 4 ? br : undefined);
    vline(m, 17, 5, 32, 17, 9, 37, br); vline(m, 22, 5, 32, 22, 9, 37, br);
    vline(m, 17, 4, 32, 16, 27, 28, br); vline(m, 22, 4, 32, 24, 27, 28, br);
  }
}
function mkHorse(o) { const m = VM(40, 64, o.rider ? 60 : 44); horseVox(m, o); if (o.rider) human(m, o.rider, 4, 15, 15); return m; }
// ---------- giants ----------
const GIANTS = {
  giant: { skin: '#b09a7a', fur: '#6a4a2a', eye: '#ff3a2a', hair: '#4a3020', knob: '#6e5a40', spike: '#9aa0a8', beard: true },
  frostgiant: { skin: '#a8c8e2', fur: '#eef4fa', eye: '#7af0ff', hair: '#f4f8ff', knob: '#bfe4f6', spike: '#e8f8ff', beard: true, icy: true }
};
function mkGiant(o) {
  const m = VM(64, 64, 110), sk = ci(o.skin), skD = cs(o.skin, 0.8), skL = cs(o.skin, 1.12), fur = ci(o.fur), furD = cs(o.fur, 0.75), eye = ci(o.eye, true), hair = ci(o.hair), hairD = cs(o.hair, 0.8);
  const wd = ci(o.icy ? '#7ab0d0' : '#5a3a20'), knob = ci(o.knob), spike = ci(o.spike), teeth = ci('#f0ece0'), rope = ci('#8a6a3a');
  const fr = o.frame | 0, lo = fr === 1 ? -4 : fr === 2 ? 4 : 0, p = o.pose;
  for (const [x, s] of [[25, lo], [39, -lo]]) {
    vtube(m, x, 32 + s * 0.5, 30, x, 32 + s, 6, 4.6, sk);
    vblob(m, x, 30 + s, 3, 5, 7, 3.2, skD);
    for (let t = 0; t < 4; t++) vs(m, x - 3 + t * 2, 23 + s, 1, skL);
  }
  for (let z = 30; z <= 43; z++) vdisc(m, 32, 32, 13 - (z - 30) * 0.05, z, (z % 3 === 0) ? furD : fur, z * 7, 2);
  for (let a = 0; a < 48; a++) { const an = a / 48 * TAU, r = 12.5 + hash2(a, 3) * 2; vline(m, 32 + Math.cos(an) * r, 32 + Math.sin(an) * r, 30, 32 + Math.cos(an) * r, 32 + Math.sin(an) * r, 26 + hash2(a, 9) * 3, furD); }
  for (let z = 42; z <= 44; z++) vdisc(m, 32, 32, 12.8, z, rope);
  vblob(m, 32, 32, 57, 14, 10, 15, sk);
  vblob(m, 32, 23, 52, 9, 3, 8, skL);
  vpaint(m, (x, y, z, c) => c === sk && z > 60 && y < 25 && Math.abs(x - 32) < 10 && (x === 32 || x === 31) ? skD : undefined);
  vblob(m, 18, 32, 66, 6.5, 6, 5.5, sk); vblob(m, 46, 32, 66, 6.5, 6, 5.5, sk);
  // left arm
  if (p === 'throw') { vtube(m, 18, 32, 66, 22, 30, 96, 4, sk); }
  else { vtube(m, 17, 32, 66, 14, 30, 40, 4, sk); vblob(m, 14, 29, 36, 4.6, 4.6, 4.6, skD); }
  // right arm + club
  const club = (x0, y0, z0, x1, y1, z1, kx, ky, kz) => {
    vtube(m, x0, y0, z0, x1, y1, z1, 1.6, wd);
    vblob(m, kx, ky, kz, 6, 6, 6.5, knob, 5, 0.35);
    for (let k = 0; k < 14; k++) { const a1 = k * 2.4, a2 = (k % 5) * 0.7 - 1.4, nx = Math.cos(a1) * Math.cos(a2), ny = Math.sin(a1) * Math.cos(a2), nz = Math.sin(a2); vline(m, kx + nx * 5, ky + ny * 5, kz + nz * 5.5, kx + nx * 8, ky + ny * 8, kz + nz * 8.5, spike); }
  };
  if (p === 'slam') { vtube(m, 46, 32, 66, 44, 34, 92, 4, sk); club(44, 34, 92, 38, 44, 100, 36, 48, 101); }
  else if (p === 'throw') { vtube(m, 46, 32, 66, 42, 30, 96, 4, sk); vblob(m, 32, 30, 101, 8, 7, 7, ci('#8a8478'), 9, 0.5); }
  else { vtube(m, 47, 32, 66, 50, 30, 40, 4, sk); vblob(m, 50, 29, 36, 4.6, 4.6, 4.6, skD); club(50, 28, 36, 50, 12, 14, 50, 10, 10); }
  // head
  vblob(m, 32, 31, 80, 8.5, 8, 9.5, sk);
  vbox(m, 25, 23, 84, 39, 24, 86, skD);
  vbox(m, 27, 22, 82, 29, 22, 83, eye); vbox(m, 35, 22, 82, 37, 22, 83, eye);
  vblob(m, 32, 22, 79, 2.2, 2.5, 2.8, skL);
  vbox(m, 28, 23, 74, 36, 23, 75, ci('#3a1a14')); vs(m, 28, 22, 75, teeth); vs(m, 36, 22, 75, teeth); vs(m, 28, 22, 76, teeth); vs(m, 36, 22, 76, teeth);
  vblob(m, 32, 32, 89, 8.5, 8.5, 2.5, hair, 3, 0.8);
  vbox(m, 24, 38, 76, 40, 39, 88, hair);
  if (o.beard) { for (let z = 58; z <= 75; z++) { const w = (z - 58) * 0.45 + 2; for (let x = Math.round(32 - w); x <= Math.round(32 + w); x++) vs(m, x, 22 + ((z - 58) > 12 ? 0 : 1), z, ((x + z) % 4 === 0) ? hairD : hair); } vblob(m, 32, 24, 70, 7, 2.5, 6, hair, 11, 0.6); }
  if (o.icy) vtop(m, ci('#ffffff'), 0.25, 3, [sk, skL, hair]);
  return m;
}
// ---------- character specs ----------
const HUMANS = {
  bandit: { coat: '#6e5a3c', pants: '#5a4830', boots: '#3a2a1a', hat: 'hood', hatC: '#4a3a28', belt: '#2a1e12', mask: '#3a3028', patches: '#8a7048', cuff: '#5a4a30' },
  soldier: { coat: '#c4302a', pants: '#ece6d6', facing: '#28408a', cuff: '#28408a', trim: '#28408a', hat: 'tricorn', lace: '#f0ead8', cross: true, buttons: true, gaiters: '#1e1a1a', queue: true, R: { t: 'sword', col: '#c8d0d8' } },
  ally: { coat: '#2f60c4', pants: '#ece6d6', facing: '#c42a2a', cuff: '#c42a2a', trim: '#e0b840', hat: 'tricorn', lace: '#e0b840', buttons: true, tallBoots: true, cockade: '#f0f0f0', R: { t: 'sword', col: '#c8d0d8' } },
  guard: { coat: '#2f7a52', pants: '#d8d0bc', facing: '#e0b840', hat: 'morion', tallBoots: true, buttons: true, R: { t: 'sword', col: '#c8d0d8' }, L: { t: 'shield', id: 'buckler' } },
  pikeman: { coat: '#b42c26', pants: '#ece6d6', facing: '#28408a', cuff: '#28408a', hat: 'morion', cross: true, gaiters: '#1e1a1a', R: { t: 'pike' }, H: 52 },
  musketeer: { coat: '#c4302a', pants: '#ece6d6', facing: '#28408a', cuff: '#28408a', trim: '#28408a', hat: 'tricorn', lace: '#f0ead8', cross: true, buttons: true, gaiters: '#1e1a1a', queue: true, R: { t: 'musket' }, H: 52 },
  archer: { coat: '#a8382a', pants: '#8a7a5a', hat: 'hood', hatC: '#4a5a2a', straps: true, L: { t: 'bow' } },
  vampire: { coat: '#24182e', pants: '#1c1424', boots: '#100c14', skin: '#e8e6f2', hair: '#121018', eye: '#ff2a2a', eyeEm: true, cape: '#2e1640', capeIn: '#a01a2a', fangs: true, buttons: true, apron: '#e8e4ec', mouth: '#5a1020' },
  witch: { robe: '#5a2a7a', coat: '#4a2266', skin: '#86c058', hair: '#c8c8d0', longHair: true, eye: '#ffe040', eyeEm: true, hat: 'witch', hatC: '#3a1a50', broom: true, spark: true, longNose: true, H: 50 },
  merchant: { coat: '#3a7a4a', pants: '#5a4830', apron: '#e8dcc0', hat: 'cap', hatC: '#6a4a2a', pack: true, buttons: true }
};
const ARMOR_LOOK = {
  tunic: { coat: '#d8ccb0', pants: '#8a7a5a', boots: '#4a3020', hat: 'tricorn', lacing: true, ropeBelt: true, belt: '#b09060' },
  gambeson: { coat: '#c8a46e', pants: '#7a6a4a', boots: '#3a2818', hat: 'tricorn', quilt: true, trim: '#a8844e' },
  leather: { coat: '#8a5a2e', pants: '#5a4028', boots: '#2e1e12', hat: 'tricorn', straps: true, tallBoots: true },
  chainmail: { coat: '#9aa4ae', mail: '#9aa4ae', sleeve: '#9aa4ae', cuff: '#7a848e', pants: '#6a7078', boots: '#2a2620', hat: 'coif', tallBoots: true },
  halfplate: { coat: '#9aa4ae', mail: '#9aa4ae', sleeve: '#9aa4ae', cuff: '#7a848e', plate: '#c8d2dc', pants: '#6a7078', boots: '#2a2620', hat: 'sallet', crest: '#2f5fc0', tallBoots: true },
  fullplate: { coat: '#d0dae4', sleeve: '#d0dae4', cuff: '#a8b4c0', plate: '#dce6f0', plateArms: '#dce6f0', gauntlet: '#c8d2dc', pants: '#c8d2dc', boots: '#8a949e', greaves: '#dce6f0', hat: 'great', crest: '#c03030' }
};
function playerSpec(withItems) {
  const look = ARMOR_LOOK[P.armor] || ARMOR_LOOK.tunic;
  return Object.assign({ hair: '#5a381c', skin: '#e8b890', queue: true }, look, { L: withItems ? undefined : null, R: withItems ? undefined : null });
}
const itemDescV = it => !it ? null : it.type === 'sword' ? { t: 'sword', col: it.col } : it.type === 'sword2' ? { t: 'claymore' } : it.type === 'bow' ? { t: 'bow' } : it.type === 'shield' ? { t: 'shield', id: it.id } : it.type === 'torch' ? { t: 'torch' } : it.type === 'gun' ? { t: 'pistol' } : null;
function playerModel() {
  const m = P.mounted;
  if (S.mode === 'dying' || S.mode === 'over') return ['Pdead|' + P.armor, () => lie(mkHuman(playerSpec(false)), 20, 12)];
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
  const ff = torch ? Math.floor(S.t * 9) % 3 : 0;
  const key = 'P|' + P.armor + '|' + (P.hands[0] || '-') + '|' + (P.hands[1] || '-') + '|' + pL + pR + '|' + fr + '|' + (m ? 1 : 0) + '|' + ff;
  const spec = Object.assign(playerSpec(true), { L, R, poseL: pL, poseR: pR, frame: m ? 0 : fr, ff, H: 52 });
  if (m) return [key, () => mkHorse({ coat: '#8a5a32', dark: '#24160c', saddle: true, cloth: '#2f5fc0', blaze: true, frame: fr, rider: Object.assign(spec, { mounted: true }) })];
  return [key, () => mkHuman(spec)];
}
function entModel(e) {
  const kind = e.kind, pose = e.state === 'move' ? 'idle' : e.state;
  const fr = e.moving && kind !== 'witch' ? 1 + (Math.floor(S.t * (kind === 'vampire' ? 10 : kind === 'dragoon' ? 9 : 7) + e.seed) % 2) : 0;
  if (e.downT > 0) return lyingModel(e.k.corpse || 'R', kind);
  if (GIANTS[kind]) { const p = pose === 'slam' || pose === 'throw' ? pose : 'idle'; return [kind + '|' + p + '|' + fr, () => mkGiant(Object.assign({ pose: p, frame: fr }, GIANTS[kind]))]; }
  if (kind === 'dragoon') { const pr = pose === 'wind' || e.passT > 0.8 ? 'atk' : 'idle'; return ['dragoon|' + pr + '|' + fr, () => mkHorse({ coat: '#3a281c', dark: '#140c08', saddle: true, cloth: '#9a2a22', stockings: true, frame: fr, rider: Object.assign({}, HUMANS.soldier, { mounted: true, poseR: pr, tallBoots: true }) })]; }
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
  if (kind === 'dragoon') return ['L|dragoon', () => lieSide(mkHorse({ coat: '#3a281c', dark: '#140c08', saddle: true, cloth: '#9a2a22', stockings: true, rider: Object.assign({}, HUMANS.soldier, { mounted: true, R: null }) }), 12, 18)];
  if (GIANTS[kind]) return ['L|' + kind, () => lie(mkGiant(Object.assign({ pose: 'idle', frame: 0 }, GIANTS[kind])), 20, 24)];
  return ['L|' + kind, () => lie(mkHuman(Object.assign({}, HUMANS[kind], { R: null, L: null, broom: false, H: 48 })), 20, 12)];
}
// ---------- scenery ----------
function facetRock(m, cx, cy, R, H, seed, base, nPl) {
  const rnd = mulberry(seed), planes = [];
  for (let k = 0; k < nPl; k++) { let nx = rnd() * 2 - 1, ny = rnd() * 2 - 1, nz = rnd() * 1.3 - 0.1; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; planes.push([nx, ny, nz, R * (0.72 + rnd() * 0.3) * (1 + Math.max(0, -nz) * 0.2), nz]); }
  const tones = [cs(base, 1.0), cs(base, 0.86), cs(base, 1.14), cs(base, 0.74), cs(base, 0.94)];
  const sz = H / R;
  for (let z = 0; z < H; z++) for (let y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++) for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) {
    const px2 = x + 0.5 - cx, py = y + 0.5 - cy, pz = (z + 0.5) / sz - R * 0.25;
    let ok = true, best = -1e9, bi = 0;
    for (let k = 0; k < planes.length; k++) { const p = planes[k], dd = px2 * p[0] + py * p[1] + pz * p[2] - p[3]; if (dd > 0) { ok = false; break; } if (dd > best) { best = dd; bi = k; } }
    if (ok) vs(m, x, y, z, planes[bi][4] > 0.5 ? tones[2] : tones[bi % 5]);
  }
}
function mkPine(v, snow) {
  const H = 72 + v * 8, m = VM(44, 44, H), bark = ci('#5a3a20'), barkD = ci('#3e2814');
  vcyl(m, 22, 22, 2.3, 0, 16, bark);
  vpaint(m, (x, y, z, c) => c === bark && (x + y * 2) % 3 === 0 ? barkD : undefined, 18, 18, 0, 26, 26, 16);
  for (const [dx, dy] of [[-5, 1], [4, 3], [1, -5]]) vline(m, 22, 22, 3, 22 + dx, 22 + dy, 0, bark, 1);
  const g1 = ci(snow ? '#22503a' : '#1f5a2c'), g2 = ci(snow ? '#2c5e42' : '#2a6e34'), hl = ci(snow ? '#4a7a5a' : '#58a24c'), hl2 = ci(snow ? '#5a8a68' : '#76bc5e');
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const r0 = 19 - t * 3.3, z0 = Math.round(12 + t * (H - 18) / tiers), z1 = Math.round(z0 + (H - 18) / tiers + 7);
    vcone(m, 22, 22, r0, 1.6, z0, Math.min(H - 2, z1), t % 2 ? g2 : g1, v * 31 + t * 7, 3.4);
    for (let a = 0; a < 56; a++) { const an = a / 56 * TAU, rr2 = r0 - 1 + hash2(a, t) * 1.5; vs(m, 22 + Math.cos(an) * rr2, 22 + Math.sin(an) * rr2, z0 - 1, t % 2 ? g2 : g1); }
  }
  vline(m, 22, 22, H - 6, 22, 22, H - 1, hl);
  vtop(m, hl, 0.42, v); vtop(m, hl2, 0.12, v + 9, [hl]);
  if (snow) { vtop(m, ci('#f2f6ff'), 0.82, v + 5); vtop(m, ci('#dce6f4'), 0.25, v + 2, [ci('#f2f6ff')]); }
  return m;
}
function mkOak(v) {
  const m = VM(52, 52, 64), bark = ci('#5e4024'), barkD = ci('#432c18'), lf = ci('#357e30'), lfL = ci('#52a044'), lfH = ci('#7cc060');
  vcyl(m, 26, 26, 3.2, 0, 26, bark);
  vpaint(m, (x, y, z, c) => c === bark && ((x * 3 + y) % 4 === 0 || z % 7 === 0) ? barkD : undefined, 20, 20, 0, 32, 32, 26);
  for (const [dx, dy] of [[-6, 2], [5, 4], [2, -6], [-3, -5]]) vtube(m, 26, 26, 3, 26 + dx, 26 + dy, 0, 1.3, bark);
  const R = mulberry(77 + v * 13), cl = [[26, 26, 44, 12, 11, 9]];
  for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + R(), d = 9 + R() * 5; cl.push([26 + Math.cos(a) * d, 26 + Math.sin(a) * d, 33 + R() * 14, 7 + R() * 3, 7 + R() * 3, 6 + R() * 2]); }
  for (const c of cl.slice(1)) vtube(m, 26, 26, 22, c[0], c[1], c[2] - 3, 1.2, bark);
  cl.forEach((c, i) => vblob(m, c[0], c[1], c[2], c[3], c[4], c[5], lf, v * 17 + i * 5, 0.55));
  vtop(m, lfL, 0.6, v); vtop(m, lfH, 0.16, v + 3, [lfL]);
  return m;
}
function mkDead(v) {
  const m = VM(40, 40, 60), b = ci('#6e5e4c'), bD = ci('#4e4236');
  vcone(m, 20, 20, 3.2, 1.2, 0, 40, b);
  vpaint(m, (x, y, z, c) => (x + z) % 5 === 0 ? bD : undefined);
  const R = mulberry(5 + v * 9);
  const branch = (x, y, z, a, el, len, r, d) => {
    const ex = x + Math.cos(a) * Math.cos(el) * len, ey = y + Math.sin(a) * Math.cos(el) * len, ez = z + Math.sin(el) * len;
    vtube(m, x, y, z, ex, ey, ez, r, b);
    if (d > 0) { branch(ex, ey, ez, a + 0.6 + R() * 0.3, el + 0.15, len * 0.65, Math.max(0.5, r * 0.7), d - 1); branch(ex, ey, ez, a - 0.6 - R() * 0.3, el - 0.05, len * 0.6, Math.max(0.5, r * 0.7), d - 1); }
  };
  for (let k = 0; k < 4; k++) branch(20, 20, 20 + k * 6, k * 1.7 + v, 0.5, 9 - k, 1.1, 2);
  return m;
}
function mkPalm(v) {
  const m = VM(56, 56, 76), tr = ci('#8a6a44'), tr2 = ci('#6a5034'), fr = ci('#3c9a3a'), fr2 = ci('#2e7a2e'), nut = ci('#5a3a1c');
  let tx = 28;
  for (let z = 0; z < 58; z++) { tx = 28 + Math.sin(z / 22 + v) * 5; vdisc(m, tx, 28, z < 4 ? 3.2 : 2.3, z, z % 5 === 0 ? tr2 : tr); }
  for (let k = 0; k < 3; k++) vblob(m, tx + Math.cos(k * 2.1) * 2.5, 28 + Math.sin(k * 2.1) * 2.5, 56, 1.6, 1.6, 1.6, nut);
  for (let k = 0; k < 9; k++) {
    const a = k / 9 * TAU + v, L = 20;
    for (let i = 0; i <= L; i++) {
      const t = i / L, d = t * 20, x = tx + Math.cos(a) * d, y = 28 + Math.sin(a) * d, z = 59 + Math.sin(t * Math.PI) * 6 - t * t * 12;
      vs(m, x, y, z, k % 2 ? fr : fr2);
      if (i > 2 && i % 2 === 0) { const w = 3 * Math.sin(t * Math.PI); for (const sd of [-1, 1]) vline(m, x, y, z, x - Math.sin(a) * w * sd, y + Math.cos(a) * w * sd, z - 1.5, k % 2 ? fr : fr2); }
    }
  }
  return m;
}
function mkBush(v) {
  const m = VM(28, 28, 18), g = ci(v ? '#3a7a30' : '#468a36'), gl = ci(v ? '#5a9a46' : '#64aa4c');
  const R = mulberry(31 + v);
  for (let k = 0; k < 5; k++) vblob(m, 14 + (R() - 0.5) * 9, 14 + (R() - 0.5) * 9, 5 + R() * 4, 5.5 + R() * 2, 5 + R() * 2, 4.5 + R() * 1.5, g, k * 7 + v, 0.5);
  vtop(m, gl, 0.4, v);
  vtop(m, ci(v ? '#c83040' : '#f0f0f0'), v ? 0.1 : 0.05, v + 4);
  return m;
}
function mkRock(v, k) {
  const m = VM(28, 28, 20); facetRock(m, 14, 14, 10 + v, 14 + v * 2, 101 + v * 37, k === 2 ? (v === 1 ? '#a08a68' : '#b09a74') : v === 1 ? '#7e7a72' : '#8e8a80', 10);
  if (k === 1) { vtop(m, ci('#f2f6ff'), 0.85, v + 3); vtop(m, ci('#d8e2f2'), 0.3, v + 7, [ci('#f2f6ff')]); }
  else if (k !== 2 && v === 2) vtop(m, ci('#5a7a3a'), 0.35, 9);
  return m;
}
function mkBoulder(frost) { const m = VM(22, 22, 18); facetRock(m, 11, 11, 8, 16, 333, frost ? '#bcdcf0' : '#8a8478', 9); return m; }
function mkMenhir() {
  const m = VM(22, 22, 56), base = '#8a8478', st = ci(base), stD = cs(base, 0.85), rune = ci('#4a463e'), moss = ci('#5a7a3a');
  for (let z = 0; z < 52; z++) { const t = z / 52, w = 5.5 - t * 1.5 - (t > 0.85 ? (t - 0.85) * 18 : 0), d = 3.5 - t * 0.8; for (let y = Math.round(11 - d); y <= Math.round(11 + d); y++) for (let x = Math.round(11 - w); x <= Math.round(11 + w); x++) vs(m, x, y, z, ((x + z) >> 2) % 3 ? st : stD); }
  const fy = Math.round(11 - 3.5);
  for (const [x0, z0, x1, z1] of [[11, 8, 11, 30], [9, 12, 13, 16], [9, 22, 13, 26], [8, 34, 12, 38], [10, 40, 12, 44]]) vline(m, x0, fy, z0, x1, fy, z1, rune);
  vtop(m, moss, 0.3, 4); vpaint(m, (x, y, z) => z < 4 && hash2(x, y + z) < 0.4 ? moss : undefined);
  return m;
}
function mkHouse(v, night) {
  const m = VM(84, 68, 76), sand = v === 'sand', snow = v === 'snow';
  const wallH = sand ? '#d8b070' : '#e2d4b4', wall = ci(wallH), wallD = cs(wallH, 0.9), beam = ci(sand ? '#8a6a3a' : '#5a3820'), stone = ci('#8a867c'), stoneD = ci('#6e6a62');
  const roofH = snow ? '#eef4fa' : sand ? '#b88a50' : '#a8402e', roof = ci(roofH), roof2 = cs(roofH, 0.86), seam = cs(roofH, 0.7), ridge = cs(roofH, 0.62);
  const glass = ci(night ? '#ffd060' : '#34465a', night), glassH = ci(night ? '#fff0b0' : '#7a96b4', night), frameW = ci('#4a3018'), door = ci('#5a3418'), doorL = ci('#7a4a24'), iron = ci('#2a2a30');
  const x0 = 6, x1 = 77, y0 = 12, y1 = 55, wz = 33;
  vbox(m, x0, y0, 0, x1, y1, wz, wall);
  vpaint(m, (x, y, z) => ((x * 7 + y * 3 + z * 5) % 11 === 0) ? wallD : undefined, x0, y0, 3, x1, y1, wz);
  vbox(m, x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 2, stone); vpaint(m, (x, y, z) => ((x >> 2) + z) % 2 ? stoneD : undefined, x0 - 1, y0 - 1, 0, x1 + 1, y1 + 1, 2);
  if (!sand) { // timber framing
    for (let x = x0; x <= x1; x += 12) { vbox(m, x, y0, 3, x + 1, y0, wz, beam); vbox(m, x, y1, 3, x + 1, y1, wz, beam); }
    for (let y = y0; y <= y1; y += 11) { vbox(m, x0, y, 3, x0, y + 1, wz, beam); vbox(m, x1, y, 3, x1, y + 1, wz, beam); }
    for (const z of [3, 17, wz]) { vbox(m, x0, y0, z, x1, y0, z + 1, beam); vbox(m, x0, y1, z, x1, y1, z + 1, beam); vbox(m, x0, y0, z, x0, y1, z + 1, beam); vbox(m, x1, y0, z, x1, y1, z + 1, beam); }
    for (const [xa, xb] of [[x0 + 2, x0 + 11], [x1 - 11, x1 - 2]]) { vline(m, xa, y0, 4, xb, y0, 16, beam, 1); vline(m, xa, y1, 18, xb, y1, wz - 1, beam, 1); }
  }
  // door with frame, planks and handle
  const dx0 = 38, dx1 = 45;
  vbox(m, dx0 - 1, y0, 3, dx1 + 1, y0, 21, beam); vbox(m, dx0, y0, 3, dx1, y0, 20, door);
  vpaint(m, (x) => (x - dx0) % 2 === 0 ? doorL : undefined, dx0, y0, 3, dx1, y0, 20);
  vs(m, dx1 - 1, y0 - 1, 11, iron); vbox(m, dx0 - 1, y0 - 3, 0, dx1 + 1, y0 - 2, 1, stone);
  // windows
  const win = (x, y, z, onX) => {
    const w = 7, h = 8;
    for (let a = -1; a <= w; a++) for (let b = -1; b <= h; b++) {
      const edge = a === -1 || a === w || b === -1 || b === h, mull = a === 3 || b === 4;
      const c = edge ? frameW : mull ? frameW : ((a + b) % 5 === 0 ? glassH : glass);
      if (onX) vs(m, x, y + a, z + b, c); else vs(m, x + a, y, z + b, c);
    }
  };
  win(14, y0, 21, false); win(62, y0, 21, false); win(14, y1, 21, false); win(62, y1, 21, false); win(x0, 30, 21, true); win(x1, 30, 21, true);
  if (sand) {
    vbox(m, x0, y0, wz + 1, x1, y1, wz + 1, roof); vbox(m, x0, y0, wz + 2, x1, y0, wz + 4, roof2); vbox(m, x0, y1, wz + 2, x1, y1, wz + 4, roof2); vbox(m, x0, y0, wz + 2, x0, y1, wz + 4, roof2); vbox(m, x1, y0, wz + 2, x1, y1, wz + 4, roof2);
    for (let x = x0 + 6; x < x1; x += 9) vbox(m, x, y0 - 3, wz - 3, x + 1, y0 - 1, wz - 2, beam);
  } else {
    for (let k = 0; ; k++) {
      const z = wz + 1 + k, ya = y0 - 3 + k, yb = y1 + 3 - k; if (ya > yb) break;
      vbox(m, x0 - 3, ya, z, x1 + 3, yb, z, (k >> 1) % 2 ? roof2 : roof);
      for (let x = x0 - 3 + ((k >> 1) % 2) * 2; x <= x1 + 3; x += 4) { vs(m, x, ya, z, seam); vs(m, x, yb, z, seam); }
      if (yb - ya < 2) vbox(m, x0 - 3, ya, z, x1 + 3, yb, z, ridge);
      for (const xe of [x0 - 3, x1 + 3]) if (yb - ya > 2) vbox(m, xe, ya + 1, z, xe, yb - 1, z, sand ? wall : (k % 6 === 0 ? beam : wall));
    }
    if (snow) vtop(m, ci('#ffffff'), 0.55, 3, [roof, roof2, seam]);
    vbox(m, 62, 22, wz, 67, 27, 70, stone); vpaint(m, (x, y, z) => ((x + (z >> 1)) % 3 === 0) ? stoneD : undefined, 62, 22, wz, 67, 27, 70); vbox(m, 61, 21, 70, 68, 28, 71, stoneD); vbox(m, 63, 23, 71, 66, 26, 71, ci('#201c18'));
  }
  return m;
}
function mkFire(f) {
  const m = VM(28, 28, 26), st = '#7a7670', lg = ci('#5a3a1e'), lgL = ci('#a07850'), ember = ci('#ff5a10', true);
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; vblob(m, 14 + Math.cos(a) * 9.5, 14 + Math.sin(a) * 9.5, 1, 2.2, 2.2, 1.8, ci(k % 2 ? st : '#6a665e')); }
  for (const [a, b] of [[0.4, 3.5], [2.0, 5.1], [3.6, 0.5]]) { const x0 = 14 + Math.cos(a) * 7, y0 = 14 + Math.sin(a) * 7, x1 = 14 + Math.cos(b) * 7, y1 = 14 + Math.sin(b) * 7; vtube(m, x0, y0, 1.5, x1, y1, 3, 1.3, lg); vs(m, x0, y0, 2, lgL); vs(m, x1, y1, 3, lgL); }
  for (let k = 0; k < 8; k++) vs(m, 14 + Math.cos(k * 1.7 + f) * 4, 14 + Math.sin(k * 1.7 + f) * 4, 3, ember);
  const red = ci('#e8401a', true), org = ci('#ff8a1a', true), yel = ci('#ffd040', true), wht = ci('#fff4c0', true);
  for (let z = 3; z < 24; z++) { const r = (24 - z) * 0.3 + 0.5;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = Math.hypot(dx, dy); if (d > r || hash2(dx * 5 + z * 11 + f * 97, dy * 7 + f * 31) < (d > r * 0.6 ? 0.35 : 0.05)) continue; const k = d / r; vs(m, 14 + dx + Math.round(Math.sin(z * 0.5 + f * 2) * (z / 12)), 14 + dy, z, z > 18 ? red : k < 0.3 && z < 15 ? wht : k < 0.6 ? yel : org); } }
  return m;
}
function mkWell() {
  const m = VM(32, 32, 44), st = ci('#8e8a80'), stD = ci('#6e6a62'), mort = ci('#5a564e'), wd = ci('#6a4424'), rf = ci('#8a3a2a'), rf2 = ci('#743024'), wa = ci('#2a4a7a'), waL = ci('#5a82b8'), rope = ci('#c8a878');
  for (let z = 0; z <= 10; z++) for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16); if (d > 10 || d < 7) continue;
    const a = Math.floor((Math.atan2(y - 16, x - 16) + Math.PI) / TAU * 18 + (z >> 2) * 0.5);
    vs(m, x, y, z, z % 4 === 3 ? mort : (a % 2 ? st : stD));
  }
  vdisc(m, 16, 16, 7, 7, wa); vs(m, 14, 15, 7, waL); vs(m, 15, 15, 7, waL);
  vbox(m, 4, 15, 10, 5, 17, 32, wd); vbox(m, 27, 15, 10, 28, 17, 32, wd);
  vbox(m, 4, 16, 27, 28, 16, 28, wd); vcyl(m, 16, 16, 1.5, 26, 29, ci('#8a6a4a'));
  vline(m, 16, 16, 26, 16, 16, 12, rope); vcyl(m, 16, 16, 1.6, 9, 12, wd); vdisc(m, 16, 16, 1.6, 11, ci('#8a8e94'));
  for (let k = 0; k < 9; k++) vbox(m, 2, 8 + k, 33 + k, 30, 24 - k, 33 + k, k % 2 ? rf2 : rf);
  return m;
}
function mkRuin() {
  const m = VM(96, 80, 80), st = ci('#9a9488'), st2 = ci('#86807a'), mort = ci('#6e6a62'), moss = ci('#5a7a3e'), mossD = ci('#466a30');
  const brick = (x, y, z) => (z % 5 === 4) ? mort : ((((x + y) >> 2) + ((z / 5) | 0)) % 4 === 0 ? mort : ((x * 3 + y + z) % 7 === 0 ? st2 : st));
  const wall = (xa, ya, xb, yb, th, hf, arch) => {
    const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya));
    for (let i = 0; i <= n; i++) {
      const x = Math.round(lerp(xa, xb, i / n)), y = Math.round(lerp(ya, yb, i / n)), h = hf(i);
      for (let z = 0; z < h; z++) {
        if (arch) { const ac = arch[0], aw = arch[1], ah = arch[2], dxa = i - ac; if (Math.abs(dxa) < aw && (z < ah || (dxa * dxa) / (aw * aw) + ((z - ah) * (z - ah)) / (aw * aw) < 1)) continue; }
        for (let t = 0; t < th; t++) for (let u = 0; u < th; u++) vs(m, x + t, y + u, z, brick(x + t, y + u, z));
      }
    }
  };
  wall(8, 64, 86, 64, 4, i => 26 + Math.round(fbm(i * 0.07, 3) * 50), [38, 9, 26]);
  wall(8, 16, 8, 64, 4, i => 16 + Math.round(fbm(i * 0.1, 9) * 46), [24, 6, 18]);
  wall(86, 24, 86, 64, 4, i => 12 + Math.round(fbm(i * 0.1, 19) * 34));
  wall(8, 16, 28, 16, 4, i => 8 + (i % 4) * 4);
  wall(68, 16, 86, 16, 4, i => 6 + (i % 5) * 3);
  for (let k = 0; k < 9; k++) facetRock(m, 16 + k * 8 + (k % 2) * 3, 28 + (k % 3) * 9, 2.6 + (k % 3), 5, 70 + k, '#8a847a', 7);
  vtop(m, moss, 0.28, 3); vpaint(m, (x, y, z) => z < 10 && hash2(x * 3, y + z * 7) < 0.12 ? mossD : undefined);
  return m;
}
function mkChest(open) {
  const m = VM(22, 18, 16), wd = ci('#8a5a2e'), wdD = ci('#6a4222'), band = ci('#5a5e66'), bandL = ci('#9aa0a8'), gold = ci(GOLD);
  vbox(m, 3, 5, 0, 18, 12, 7, wd); vpaint(m, (x, y, z) => z % 3 === 0 ? wdD : undefined, 3, 5, 0, 18, 12, 7);
  for (const x of [4, 11, 17]) vbox(m, x, 5, 0, x, 12, 7, band);
  if (!open) {
    for (let z = 8; z <= 10; z++) vbox(m, 3, 5 + (z - 8), z, 18, 12 - (z - 8), z, wd);
    for (const x of [4, 11, 17]) for (let z = 8; z <= 10; z++) vbox(m, x, 5 + (z - 8), z, x, 12 - (z - 8), z, band);
    vbox(m, 10, 4, 5, 11, 4, 8, gold); vs(m, 10, 3, 6, gold);
    for (const x of [4, 17]) { vs(m, x, 4, 2, bandL); vs(m, x, 4, 6, bandL); }
  } else {
    vbox(m, 3, 13, 8, 18, 14, 16, wd); for (const x of [4, 11, 17]) vbox(m, x, 13, 8, x, 14, 16, band);
    vbox(m, 4, 6, 6, 17, 11, 6, ci('#2a1a10'));
  }
  return m;
}
function mkCoins() {
  const m = VM(14, 14, 8), g = ci('#e8c050'), gD = ci('#b89030'), gL = ci('#fff0a0');
  for (const [x, y, n] of [[5, 6, 4], [9, 8, 2], [7, 10, 1]]) for (let k = 0; k < n; k++) { vdisc(m, x, y, 2.3, k, k % 2 ? gD : g); vs(m, x - 1, y - 1, k, gL); }
  return m;
}
function mkLoot(id) {
  const it = ITEMS[id], m = VM(22, 22, 10), wd = ci('#6a4424'), gold = ci(GOLD), steel = ci(STEEL), steelL = ci('#f0f6fc');
  switch (it.type) {
    case 'sword': { const bc = it.col, bl = ci(bc), hl = cs(bc, 1.3); vline(m, 11, 2, 1, 11, 14, 1, bl); vline(m, 10, 3, 1, 10, 14, 1, hl); vline(m, 8, 15, 1, 13, 15, 1, gold); vline(m, 11, 16, 1, 11, 18, 1, ci('#3e2616')); vs(m, 11, 19, 1, gold); break; }
    case 'sword2': vline(m, 11, 0, 1, 11, 14, 1, steel); vline(m, 10, 1, 1, 10, 14, 1, steelL); vline(m, 7, 15, 1, 15, 15, 1, gold); vline(m, 11, 16, 1, 11, 20, 1, ci('#3e2616')); break;
    case 'bow': for (let k = -9; k <= 9; k++) vs(m, 7 + Math.round(k * k / 16), 11 + k, 1, Math.abs(k) < 2 ? ci('#3e2616') : ci('#8a5a2a')); vline(m, 12, 2, 1, 12, 20, 1, ci('#f0e8d0')); break;
    case 'shield': { const f = it.id === 'buckler' ? '#8a5a2e' : it.id === 'kite_shield' ? '#2f5fc0' : '#2a3a64'; vdisc(m, 11, 11, 7, 0, ci('#9aa4ae')); vdisc(m, 11, 11, 5.8, 1, ci(f)); vbox(m, 10, 6, 2, 11, 16, 2, gold); vbox(m, 7, 10, 2, 14, 11, 2, gold); break; }
    case 'torch': vline(m, 6, 15, 1, 14, 7, 1, wd, 1); vbox(m, 14, 5, 1, 16, 7, 2, ci('#3a2a1a')); vs(m, 15, 4, 3, ci('#ff8a1a', true)); vs(m, 16, 4, 3, ci('#ffd040', true)); break;
    case 'gun': vline(m, 6, 11, 1, 16, 11, 1, ci('#34343c'), 2); vline(m, 4, 12, 1, 7, 15, 1, wd, 1); vs(m, 10, 11, 2, gold); break;
    case 'armor': { const a = ci(it.color), d = ci(it.dark); vbox(m, 5, 6, 0, 16, 15, 5, a); vbox(m, 5, 6, 5, 16, 15, 5, d); vbox(m, 2, 7, 3, 4, 14, 5, a); vbox(m, 17, 7, 3, 19, 14, 5, a); vbox(m, 9, 6, 5, 12, 8, 5, cs(it.color, 1.25)); break; }
    case 'potion': vcyl(m, 11, 11, 3.2, 0, 5, ci('#d02840')); vs(m, 10, 10, 5, ci('#ff7080')); vcyl(m, 11, 11, 1.4, 6, 7, ci('#a0c8d8')); vcyl(m, 11, 11, 1.2, 8, 9, ci('#8a5a2e')); break;
    case 'ammo': for (const x of [7, 10, 13]) { vline(m, x, 4, 1, x, 17, 1, ci('#b08a5a')); vs(m, x, 3, 1, steelL); vs(m, x, 2, 1, steel); vs(m, x, 18, 1, ci('#f0ece0')); vs(m, x + 1, 18, 1, ci('#c03030')); } vbox(m, 6, 12, 1, 14, 12, 2, ci('#5a3a1e')); break;
  }
  return m;
}
function staticModel(o) {
  const v = (hash2(Math.round(o.x * 10), Math.round(o.y * 10)) * 3) | 0;
  switch (o.type) {
    case 'pine': return ['pine' + v, () => mkPine(v, false), NBS];
    case 'snowpine': return ['spine' + v, () => mkPine(v, true), NBS];
    case 'oak': return ['oak' + (v % 2), () => mkOak(v % 2), NBS];
    case 'deadtree': return ['dead' + (v % 2), () => mkDead(v % 2), NBS];
    case 'palm': return ['palm' + (v % 2), () => mkPalm(v % 2), NBS];
    case 'bush': return ['bush' + (v % 2), () => mkBush(v % 2), NBS];
    case 'rock': { const k = o.snow ? 1 : o.sand ? 2 : 0; return ['rock' + v + '_' + k, () => mkRock(v, k), NBS]; }
    case 'menhir': return ['menhir', mkMenhir, NBS];
    case 'house': { const n = S.darkness > 0.45; return ['house' + o.v + (n ? 'n' : 'd'), () => mkHouse(o.v, n), NB]; }
    case 'fire': { const f = Math.floor(S.t * 8) % 3; return ['fire' + f, () => mkFire(f), NBS]; }
    case 'well': return ['well', mkWell, NBS];
    case 'ruin': return ['ruin', mkRuin, NB];
    case 'chest': { const op = S.looted.has(o.id); return ['chest' + (op ? 'o' : 'c'), () => mkChest(op), NBS]; }
  }
  return ['rock0_0', () => mkRock(0, 0), NBS];
}
