// =====================================================================
//  UI — HUD, input, audio, overlays, main loop
// =====================================================================
const IS_TOUCH = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0);
const HUD_BG = '#0d0a07';

// ---------- HUD (drawn crisp at screen resolution over the pixel scene) ----------
const HUD_FONT = 'bold 12px ui-monospace,Menlo,Consolas,"DejaVu Sans Mono","Courier New",monospace';
const ICONS = {
  heart: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'],
  sun: ['...Y...', '.Y.Y.Y.', '..YYY..', 'YYYYYYY', '..YYY..', '.Y.Y.Y.', '...Y...'],
  moon: ['..WWW..', '.WW....', 'WW.....', 'WW.....', 'WW.....', '.WW....', '..WWW..'],
  coin: ['.YYY.', 'YYOYY', 'YOYOY', 'YYOYY', '.YYY.'],
  potion: ['..K..', '.LLL.', 'RRRRR', 'RRRRR', 'RRRRR', '.RRR.'],
  arrow: ['.....TT', '.....TT', '....B..', '...B...', '..B....', 'WB.....', 'W......'],
  fist: ['.SSSS.', 'SSSSSS', 'SSSSSS', 'SSSSS.', '.SSS..'],
  sword: ['......T', '.....T.', '....T..', '.G.T...', '..G....', '.N.G...', 'N......'],
  claymore: ['.......T', '......T.', '.....T..', '....T...', '.G.T....', '..G.....', '.N.G....', 'N.......'],
  bow: ['..B..', '.B..W', 'B...W', 'B...W', 'B...W', '.B..W', '..B..'],
  shield: ['TTTTT', 'TUYUT', 'TUYUT', '.TYT.', '..T..'],
  torch: ['..F..', '.FYF.', '..F..', '..N..', '..N..', '..N..'],
  gun: ['GGGGG.', '..GNN.', '...NN.', '...N..'],
  armor: ['A.A.A', 'AAAAA', '.AAA.', '.AAA.']
};
const ICOL = { R: '#e03a3a', Y: '#ffd84a', O: '#c8962a', W: '#f0ecd0', K: '#8a5a2e', L: '#c0d8e8', T: '#d8e0e8', B: '#b08a5a', S: '#e8b890', G: '#9aa0a8', N: '#6a4424', U: '#4f80e0', F: '#ff8a2a', A: '#c8b898' };
function icon(name, x, y, s, over) {
  const rows = ICONS[name]; if (!rows) return;
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) { const ch = rows[r][c]; if (ch === '.') continue; ctx.fillStyle = (over && over[ch]) || ICOL[ch]; ctx.fillRect(Math.round(x + c * s), Math.round(y + r * s), s, s); }
}
function itemIcon(it) { if (!it) return 'fist'; return { sword: 'sword', sword2: 'claymore', bow: 'bow', shield: 'shield', torch: 'torch', gun: 'gun', armor: 'armor' }[it.type] || 'fist'; }
function hudPanel(x, y, w, h) { ctx.fillStyle = 'rgba(6,8,12,0.58)'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(170,180,200,0.22)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
function hudText(s, x, y, col, align) { ctx.textAlign = align || 'left'; ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(s, x + 1, y + 1); ctx.fillStyle = col; ctx.fillText(s, x, y); }
function hudBar(x, y, w, h, f, col, bg) { ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * clamp(f, 0, 1)), h); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, Math.round(w * clamp(f, 0, 1)), 1); }
function slot(x, y, it, label, active) {
  hudPanel(x, y, 24, 24);
  if (active) { ctx.strokeStyle = '#ffd84a'; ctx.strokeRect(x + 0.5, y + 0.5, 23, 23); }
  if (it && typeof thumbCanvas === 'function') { hudThumb(it.id, x + 1, y + 1, 22); if (it.lvl) { ctx.font = 'bold 8px ui-monospace,Menlo,monospace'; hudText('+' + it.lvl, x + 23, y + 15, '#ffd84a', 'right'); ctx.font = HUD_FONT; } }
  else { const name = itemIcon(it), rows = ICONS[name], s = 2, w = rows[0].length * s, h = rows.length * s; icon(name, x + 12 - w / 2, y + 12 - h / 2, s, it && it.type === 'armor' ? { A: it.color } : null); }
  if (label) { ctx.font = 'bold 8px ui-monospace,Menlo,monospace'; hudText(label, x + 2, y + 1, '#c8b898'); ctx.font = HUD_FONT; }
}
let MM = null, mmT = 0;
const MMC = [];
MMC[T_GRASS] = '#2e5a26'; MMC[T_TALL] = '#2a5222'; MMC[T_WATER] = '#2a5a9a'; MMC[T_DIRT] = '#7a6044'; MMC[T_WHEAT] = '#9a8030'; MMC[T_SNOW] = '#c8d2e0';
MMC[T_DRIFT] = '#d8e0ec'; MMC[T_ICE] = '#7aa8cc'; MMC[T_SAND] = '#b8985a'; MMC[T_DUNE] = '#c8a868'; MMC[T_MUD] = '#4a3e28'; MMC[T_MARSH] = '#3e4a28';
MMC[T_BOG] = '#24342a'; MMC[T_HEATHER] = '#5a3a5e'; MMC[T_ROCKY] = '#5a5650'; MMC[T_FLOOR] = '#1e4018';
const MMRGB = MMC.map(c => rgbOf(c));
const MM_RANGE = 60, MM_N = 48;
function updateMinimap() {
  if (!MM) MM = mkCanvas(MM_N, MM_N);
  const x = MM.getContext('2d'), id = x.createImageData(MM_N, MM_N), d = id.data, U = MM_RANGE * 2 / MM_N, ca = Math.cos(P.a), sa = Math.sin(P.a);
  for (let py = 0; py < MM_N; py++) for (let px2 = 0; px2 < MM_N; px2++) {
    const rt = (px2 + 0.5 - MM_N / 2) * U, fw = (MM_N / 2 - py - 0.5) * U;
    const t = tileNoGen(P.x + ca * fw - sa * rt, P.y + sa * fw + ca * rt), c = MMRGB[t] || MMRGB[0], o = (py * MM_N + px2) * 4;
    const dim = 1 - S.darkness * 0.45; d[o] = c[0] * dim; d[o + 1] = c[1] * dim; d[o + 2] = c[2] * dim; d[o + 3] = 255;
  }
  x.putImageData(id, 0, 0);
}
function drawMinimap(x0, y0, sz) {
  mmT -= 1; if (mmT <= 0 || !MM) { mmT = 8; updateMinimap(); }
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(x0 - 2, y0 - 2, sz + 4, sz + 4);
  ctx.drawImage(MM, x0, y0, sz, sz);
  ctx.strokeStyle = '#6a5a3a'; ctx.lineWidth = 1; ctx.strokeRect(x0 - 1.5, y0 - 1.5, sz + 3, sz + 3);
  const k = sz / (MM_RANGE * 2), cx = x0 + sz / 2, cy = y0 + sz / 2, ca = Math.cos(P.a), sa = Math.sin(P.a);
  const toMM = (wx, wy, clampIt) => {
    const dx = wx - P.x, dy = wy - P.y, fw = dx * ca + dy * sa, rt = -dx * sa + dy * ca;
    let mx = cx + rt * k, my = cy - fw * k;
    const inside = mx > x0 + 2 && mx < x0 + sz - 2 && my > y0 + 2 && my < y0 + sz - 2;
    if (!inside && !clampIt) return null;
    if (!inside) { // slide onto the rim along the true bearing
      const ox = mx - cx, oy = my - cy, h = sz / 2 - 4, t = Math.min(Math.abs(ox) > 1e-6 ? h / Math.abs(ox) : 1e9, Math.abs(oy) > 1e-6 ? h / Math.abs(oy) : 1e9);
      mx = cx + ox * t; my = cy + oy * t;
    }
    return [mx, my, inside];
  };
  const dot = (q, col, s) => { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(q[0] - s / 2) - 1, Math.round(q[1] - s / 2) - 1, s + 2, s + 2); ctx.fillStyle = col; ctx.fillRect(Math.round(q[0] - s / 2), Math.round(q[1] - s / 2), s, s); };
  const pcx = Math.floor(P.x / CS), pcy = Math.floor(P.y / CS);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const v = villageFor(pcx + i, pcy + j); if (!v) continue;
    const q = toMM(v.x, v.y, Math.hypot(v.x - P.x, v.y - P.y) < 160); if (!q) continue;
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(q[0]) - 3, Math.round(q[1]) - 3, 7, 6); ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) - 1, 5, 3); ctx.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 2, 3, 1);
  }
  // buildings and castles: footprints in range, castles beyond it as markers on the rim
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, sz, sz); ctx.clip();
  const seen = new Set(), poly = (T, lx0, lz0, lx1, lz1, fill, stroke) => {
    const pts = [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]].map(p => { const w = l2w(T, p[0], p[1]); return toMM(w[0], w[1], true); });
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  };
  for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) {
    const c = CHUNKS.get((pcx + i) + ',' + (pcy + j)); if (!c || !c.structs) continue;
    for (const st of c.structs) { if (seen.has(st.id) || st.kind !== 'bld') continue; seen.add(st.id); if (Math.abs(st.x - P.x) > MM_RANGE + 8 || Math.abs(st.y - P.y) > MM_RANGE + 8) continue; poly(st, -st.hx, -st.hz, st.hx, st.hz, st === S.cut.s ? '#e8c060' : '#5a4632', '#1a120a'); }
  }
  ctx.restore();
  const cl = castlesNear(P.x, P.y, 700).sort((a, b) => Math.hypot(b.x - P.x, b.y - P.y) - Math.hypot(a.x - P.x, a.y - P.y));
  for (const cs of cl) {
    const d = Math.hypot(cs.x - P.x, cs.y - P.y), col = cs.kind === 'usurper' ? '#ff6a4a' : cs.kind === 'royal' ? '#7aa8ff' : '#b8b0a0', big = cs === cl[cl.length - 1] ? 1 : 0;
    if (d < MM_RANGE + 40) {
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, sz, sz); ctx.clip();
      poly(cs, -CAS_S, -CAS_S, CAS_S, CAS_S, 'rgba(40,34,28,0.55)', col);
      poly(cs, -11, -14, 11, 2, '#6a6258', '#1a120a');
      ctx.restore();
    } else {
      const q = toMM(cs.x, cs.y, true); if (!q) continue;
      const X = Math.round(q[0]), Y = Math.round(q[1]), g = big ? 2 : 1;
      ctx.fillStyle = '#000'; ctx.fillRect(X - 3 * g - 1, Y - 3 * g - 1, 7 * g + 2, 7 * g + 2); ctx.fillStyle = col;
      ctx.fillRect(X - 3 * g, Y - g, 7 * g, 4 * g); ctx.fillRect(X - 3 * g, Y - 3 * g, 2 * g, 2 * g); ctx.fillRect(X + 2 * g, Y - 3 * g, 2 * g, 2 * g); ctx.fillRect(X, Y - 3 * g, g, 2 * g);
    }
  }
  for (const m of manorsNear(P.x, P.y, 600)) {
    const d = Math.hypot(m.x - P.x, m.y - P.y), cl = S.manors[m.id] && S.manors[m.id].cleared, col = cl ? '#8a8098' : '#b88aff';
    if (d < MM_RANGE + 30) { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, sz, sz); ctx.clip(); poly(m, -MAN_G, -MAN_G, MAN_G, MAN_G, 'rgba(30,26,40,0.45)', col); poly(m, -MAN_W, MAN_HZ - MAN_D, MAN_W, MAN_HZ + MAN_D, '#5a5068', '#1a120a'); ctx.restore(); }
    else { const q = toMM(m.x, m.y, d < 420); if (!q) continue; const X = Math.round(q[0]), Y = Math.round(q[1]); ctx.fillStyle = '#000'; ctx.fillRect(X - 4, Y - 4, 9, 8); ctx.fillStyle = col; ctx.fillRect(X - 3, Y - 1, 7, 4); ctx.fillRect(X - 2, Y - 3, 5, 2); ctx.fillRect(X, Y - 4, 1, 1); }
  }
  if (!P.mounted) { const q = toMM(S.horse.x, S.horse.y, true); if (q) dot(q, q[2] ? '#d8a060' : '#8a6a40', 3); }
  for (const e of S.ents) {
    if (e.dead) continue;
    const col = e.team === 2 ? '#ffd84a' : e.team === 0 ? '#6a9aff' : (e.thief ? '#ffe040' : e.k.boss || e.elite ? '#ff7a2a' : e.k.unholy ? '#d070ff' : e.k.gremlin ? '#a8d040' : '#ff4a3a');
    const q = toMM(e.x, e.y, e.team === 1 && (dist(e, P) < 90 || e.thief)); if (!q) continue;
    dot(q, q[2] ? col : (e.thief ? '#ffe040' : '#a03a2a'), e.k.boss || e.elite || e.thief ? 4 : 3);
  }
  // tracked objective: a gold diamond (on the rim when out of range)
  const tg = S.Q && questTarget();
  if (tg) { const q = toMM(tg.x, tg.y, true); if (q) { const X = q[0], Y = q[1], r = q[2] ? 4 : 5, pul = ((S.t * 3) | 0) % 2; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(X, Y - r - 2); ctx.lineTo(X + r + 2, Y); ctx.lineTo(X, Y + r + 2); ctx.lineTo(X - r - 2, Y); ctx.closePath(); ctx.fill(); ctx.fillStyle = pul ? '#ffe070' : '#e8b030'; ctx.beginPath(); ctx.moveTo(X, Y - r); ctx.lineTo(X + r, Y); ctx.lineTo(X, Y + r); ctx.lineTo(X - r, Y); ctx.closePath(); ctx.fill(); } }
  // player arrow
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 5, cy + 5); ctx.lineTo(cx - 5, cy + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 3, cy + 3); ctx.lineTo(cx - 3, cy + 3); ctx.closePath(); ctx.fill();
  // north marker on the border
  const nx = -ca, ny = sa, t = Math.min(Math.abs(nx) > 1e-6 ? (sz / 2 - 7) / Math.abs(nx) : 1e9, Math.abs(ny) > 1e-6 ? (sz / 2 - 7) / Math.abs(ny) : 1e9);
  const qx = cx + nx * t, qy = cy + ny * t;
  ctx.fillStyle = '#000'; ctx.fillRect(Math.round(qx) - 6, Math.round(qy) - 7, 12, 13);
  ctx.font = HUD_FONT; hudText('N', qx, qy - 6, '#ffd84a', 'center');
}
// STYLE rank: grows with clean combos, perfect dodges and parries; any hit taken drops it. Multiplies XP and gold.
const RANK_COL = { D: '#a8b0c0', C: '#7ad0ff', B: '#7aff9a', A: '#ffd84a', S: '#ff7a4a' };
function drawStyle(xr, y) {
  if (S.style <= 0.5) return;
  const r = styleRank(), i = STYLE_RANKS.indexOf(r), nx = STYLE_RANKS[i + 1], f = nx ? (S.style - r[1]) / (nx[1] - r[1]) : 1;
  const pop = 1 + (S.rankPop || 0) * 0.5, px = Math.round(30 * pop);
  ctx.textAlign = 'right'; ctx.textBaseline = 'top';
  ctx.font = 'bold ' + px + 'px "Trebuchet MS",Verdana,sans-serif'; ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(16,10,24,0.95)';
  ctx.strokeText(r[0], xr - 2, y); ctx.fillStyle = RANK_COL[r[0]]; ctx.fillText(r[0], xr - 2, y);
  ctx.font = 'bold 10px ui-monospace,Menlo,monospace'; hudText('STYLE x' + r[2].toFixed(2), xr - 38, y + 4, '#e8dcc0', 'right');
  hudBar(xr - 112, y + 20, 74, 3, f, RANK_COL[r[0]], '#20202a');
  ctx.font = HUD_FONT; ctx.textAlign = 'left';
}
function drawCombo(x, y) {
  const a = P.act, it = mainItem(), list = MOVES[weaponKey(it)] || MOVES.fists;
  if (list.length < 2 || (!a && P.comboT <= 0)) return;
  const done = a && a.k === 'atk' && a.step < 99 ? a.step + (a.t >= a.mv.w ? 1 : 0) : P.comboStep;
  for (let i = 0; i < list.length; i++) {
    ctx.fillStyle = '#000'; ctx.fillRect(x + i * 12 - 1, y - 1, 10, 6);
    ctx.fillStyle = i < done ? (list[i].fin ? '#ff9a3a' : '#f4f0ff') : '#3a3448'; ctx.fillRect(x + i * 12, y, 8, 4);
  }
  if (S.cueT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (S.cueT / 0.22).toFixed(2) + ')'; ctx.fillRect(x - 3, y - 3, list.length * 12 + 4, 10); }
}
function shadeMsg(col, t) { const c = rgbOf(col.replace('!', '')); const k = clamp(t, 0.2, 1); return css(c[0] * k, c[1] * k, c[2] * k); }
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.font = HUD_FONT; ctx.textBaseline = 'top';
  const narrow = VW < 520;
  // --- health / level panel
  const pw = Math.min(narrow ? 168 : 230, Math.floor(VW * 0.43)), x0 = 6, y0 = 6;
  hudPanel(x0, y0, pw, 50);
  icon('heart', x0 + 6, y0 + 6, 2);
  const fr = clamp(P.hp / P.maxHp, 0, 1), hc = fr > 0.5 ? '#5ad04a' : fr > 0.25 ? '#e8c050' : '#ff4a3a';
  const bw = pw - 64;
  hudBar(x0 + 24, y0 + 8, bw, 8, fr, hc, '#3a1a14');
  hudText(String(Math.ceil(P.hp)), x0 + 28 + bw, y0 + 5, hc);
  // stamina: dashes, attacks and blocking drain it; flashes when too low to dash
  const sf = clamp(P.st / P.stMax, 0, 1), low = P.st < DASH.minSt;
  ctx.font = 'bold 8px ui-monospace,Menlo,monospace'; hudText('ST', x0 + 7, y0 + 21, '#c8e890'); ctx.font = HUD_FONT;
  hudBar(x0 + 24, y0 + 22, bw, 5, sf, low ? (((S.t * 8) | 0) % 2 ? '#ff7a4a' : '#8a3a2a') : '#c8f060', '#22301a');
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(x0 + 24 + bw * DASH.minSt / P.stMax), y0 + 21, 1, 7);
  hudText('LV' + P.level, x0 + 6, y0 + 33, '#9ae0ff');
  hudBar(x0 + 44, y0 + 37, pw - 52, 3, P.xp / xpNext(), '#7ab0ff', '#1a2a3a');
  // --- hands, armour, purse
  const two = twoHanded() ? ITEMS[P.hands[1]] : null, hy = y0 + 56, act = P.act;
  const busy = h => !!(act && (act.k === 'atk' || act.k === 'shoot' || act.k === 'charge') && (act.hand === h || (act.k === 'charge' && mainHand() === h)));
  if (two) { slot(x0, hy, two, '2H', P.drawing || busy(1)); slot(x0 + 26, hy, null, '', false); ctx.fillStyle = 'rgba(12,9,6,0.9)'; ctx.fillRect(x0 + 27, hy + 1, 22, 22); }
  else { slot(x0, hy, P.hands[0] ? ITEMS[P.hands[0]] : null, 'L', busy(0) || (P.blocking && P.hands[0] && ITEMS[P.hands[0]].type === 'shield')); slot(x0 + 26, hy, P.hands[1] ? ITEMS[P.hands[1]] : null, 'R', busy(1)); }
  slot(x0 + 52, hy, ITEMS[P.armor], '', false);
  let px2 = x0 + 82, py2 = hy + 6;
  if (narrow && px2 + 150 > pw + 40) { px2 = x0 + 4; py2 = hy + 30; }
  hudPanel(px2 - 4, py2 - 5, 152, 22);
  icon('coin', px2, py2 + 1, 2); hudText(String(P.gold), px2 + 13, py2, '#ffd84a');
  icon('potion', px2 + 56, py2 - 1, 2); hudText(String(invCount('potion')), px2 + 69, py2, '#ff8a9a');
  icon('arrow', px2 + 94, py2 - 1, 2); hudText(String(invCount('arrows')), px2 + 110, py2, '#d8c8a0');
  // --- clock + minimap (top right)
  const mmS = narrow ? 84 : 112, mx = VW - mmS - 8, my = 30;
  hudPanel(mx - 2, 4, mmS + 4, 22);
  const night = S.darkness > 0.5;
  icon(night ? 'moon' : 'sun', mx + 3, 8, 2, night && S.bloodMoon ? { W: '#ff4040' } : null);
  hudText('D' + S.day + ' ' + clockStr(), mx + mmS - 2, 9, '#e8dcc0', 'right');
  drawMinimap(mx, my, mmS);
  drawStyle(VW - 8, my + mmS + 10);
  drawCombo(x0 + 4, hy + 28);
  // --- boss bar
  let boss = null, bd = 45;
  for (const e of S.ents) if ((e.k.boss || e.elite) && !e.dead && e.team === 1) { const d = dist(e, P); if (d < bd) { bd = d; boss = e; } }
  let ty = narrow ? hy + 56 : hy + 34;
  if (boss) {
    const w = narrow ? Math.min(200, VW - mmS - 40) : Math.min(220, VW - 40), bx = (VW - w) / 2, by = narrow ? hy + 54 : 36;
    hudText((boss.ename || boss.k.name).toUpperCase(), VW / 2, by, '#ff7a5a', 'center');
    hudBar(bx, by + 16, w, 6, boss.hp / boss.maxHp, '#e8443a', '#3a1414');
    hudBar(bx, by + 24, w, 2, boss.poise / boss.poiseMax, boss.state === 'stagger' ? '#ff9a3a' : '#ffd84a', '#2a2410');
    if (narrow) ty = Math.max(ty, by + 28);
  }
  // --- messages (left column)
  const colW = Math.max(120, VW - mmS - 30);
  const maxCh = Math.floor(colW / 7.3);
  // --- tracked quest objective
  { const q = S.Q && qById(S.Q.track), st = qStep(q);
    if (q && st) {
      const tg = questTarget(q), dd = tg ? Math.round(Math.hypot(tg.x - P.x, tg.y - P.y)) : null, w = Math.min(narrow ? VW - 16 : 360, colW);
      const lines = wrapText(st.txt + stepProgress(st) + (dd !== null && dd > 6 ? ' · ' + dd + 'm' : ''), Math.floor((w - 22) / 7.3)).slice(0, 2);
      hudPanel(6, ty - 2, w, 20 + lines.length * 14);
      ctx.fillStyle = q.main ? '#e8c050' : '#c8d0a0'; ctx.beginPath(); ctx.moveTo(14, ty + 3); ctx.lineTo(18, ty + 7); ctx.lineTo(14, ty + 11); ctx.lineTo(10, ty + 7); ctx.closePath(); ctx.fill();
      ctx.font = 'bold 11px ui-monospace,Menlo,monospace'; hudText(q.title + (q.main ? '' : '  (side)'), 23, ty + 2, q.main ? '#e8c050' : '#c8d0a0'); ctx.font = HUD_FONT;
      lines.forEach((l, i) => hudText(l, 12, ty + 17 + i * 14, '#e8dcc0'));
      ty += 26 + lines.length * 14;
    }
  }
  for (const m of S.msgs) {
    const col = m.t < 1 ? shadeMsg(m.col, m.t) : m.col, ix = m.icon ? 26 : 0;
    if (m.icon) { ctx.globalAlpha = clamp(m.t, 0.2, 1); ctx.fillStyle = 'rgba(10,8,6,0.55)'; ctx.fillRect(6, ty - 3, 21, 21); hudThumb(m.icon, 7, ty - 2, 19); ctx.globalAlpha = 1; }
    for (const l of wrapText(m.txt, maxCh - (ix ? 4 : 0)).slice(0, 2)) { hudText(l, 8 + ix, ty, col); ty += 15; }
    if (m.icon) ty += 4;
  }
  // --- banner
  if (S.banner) {
    const b = S.banner, w = Math.min(460, VW - 24), inner = Math.floor((w - 24) / 7.3);
    const lines = wrapText(b.sub, inner), ic = b.icons && b.icons.length ? Math.min(b.icons.length, 6) : 0, h = 30 + lines.length * 15 + (ic ? 40 : 0);
    const bx = Math.round((VW - w) / 2);
    // below the stats panels when it would overlap them (narrow or short landscape screens)
    const by = narrow ? Math.round(Math.max(ty + 6, VH * 0.24)) : bx < pw + 16 ? Math.max(hy + 30, boss ? 64 : 36) : (boss ? 64 : 36);
    const a = clamp(b.t * 2, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,10,6,0.88)'; ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = '#8a6a30'; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1); ctx.strokeStyle = '#3a2a14'; ctx.strokeRect(bx + 3.5, by + 3.5, w - 7, h - 7);
    ctx.font = 'bold 14px ui-monospace,Menlo,Consolas,monospace'; hudText(b.title, VW / 2, by + 8, b.col, 'center');
    ctx.font = HUD_FONT; lines.forEach((l, i) => hudText(l, VW / 2, by + 28 + i * 15, '#e8dcc0', 'center'));
    for (let i = 0; i < ic; i++) { const ix = VW / 2 - ic * 19 + i * 38, iy = by + 30 + lines.length * 15; ctx.fillStyle = 'rgba(40,30,16,0.8)'; ctx.fillRect(ix, iy, 34, 34); ctx.strokeStyle = tierCol(ITEMS[b.icons[i]]); ctx.strokeRect(ix + 0.5, iy + 0.5, 33, 33); hudThumb(b.icons[i], ix + 2, iy + 2, 30); }
    ctx.globalAlpha = 1;
  }
  // --- hotbar
  drawHotbar();
  // --- interaction hint (keyboard)
  if (S.interact && !IS_TOUCH) {
    const s = '[E] ' + S.interact.label[0] + S.interact.label.slice(1).toLowerCase(), w = s.length * 7.3 + 20, hy2 = hotLayout().y - 62;
    ctx.font = HUD_FONT; hudPanel(Math.round(VW / 2 - w / 2), hy2, Math.round(w), 24); hudText(s, VW / 2, hy2 + 6, '#ffd84a', 'center');
  }
  ctx.textAlign = 'left';
}
// ---------- audio ----------
const AU = { ctx: null, noise: null, master: null, muted: false, last: {} };
try { AU.muted = localStorage.getItem('ironcrown1700_mute') === '1'; } catch (e) { }
function audioInit() {
  if (AU.ctx) { try { if (AU.ctx.state === 'suspended') AU.ctx.resume(); } catch (e) { } return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    AU.ctx = new AC();
    const len = AU.ctx.sampleRate, buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf; AU.master = AU.ctx.createGain(); AU.master.gain.value = 0.55; AU.master.connect(AU.ctx.destination);
  } catch (e) { AU.ctx = null; }
}
function nz(dur, type, f0, f1, g, q, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const s = c.createBufferSource(); s.buffer = AU.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); f.Q.value = q || 1;
  const gn = c.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(AU.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function tn(f0, f1, dur, type, g, delay) {
  const c = AU.ctx, t = c.currentTime + (delay || 0);
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gn = c.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn); gn.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
}
function sfx(n) {
  if (!AU.ctx || AU.muted) return;
  const now = performance.now(); if (AU.last[n] && now - AU.last[n] < 45) return; AU.last[n] = now;
  try {
    switch (n) {
      case 'swing': nz(0.14, 'bandpass', 2600, 700, 0.22, 2); break;
      case 'swing_light': nz(0.08, 'bandpass', 2000, 900, 0.1, 2); break;
      case 'punch': nz(0.08, 'lowpass', 900, 200, 0.4); tn(120, 60, 0.08, 'sine', 0.2); break;
      case 'takedown': nz(0.3, 'lowpass', 600, 60, 0.6); tn(90, 35, 0.3, 'sine', 0.4); break;
      case 'hit': nz(0.09, 'lowpass', 1800, 300, 0.35); tn(160, 70, 0.1, 'square', 0.07); break;
      case 'clang': tn(1400, 1250, 0.12, 'triangle', 0.05); nz(0.05, 'highpass', 3000, 3000, 0.08); break;
      case 'block': tn(900, 700, 0.15, 'triangle', 0.09); nz(0.08, 'bandpass', 2500, 1500, 0.15, 3); break;
      case 'torch': nz(0.25, 'bandpass', 700, 1500, 0.2, 1.2); break;
      case 'gun': nz(0.35, 'lowpass', 2600, 150, 0.7); tn(110, 40, 0.18, 'sine', 0.3); break;
      case 'musket': nz(0.3, 'lowpass', 1600, 120, 0.35); break;
      case 'bow': tn(220, 120, 0.12, 'triangle', 0.08); nz(0.12, 'highpass', 2500, 5000, 0.08); break;
      case 'coin': tn(1300, 1900, 0.09, 'square', 0.04); break;
      case 'pickup': tn(600, 900, 0.08, 'triangle', 0.08); tn(900, 1200, 0.08, 'triangle', 0.06, 0.07); break;
      case 'equip': nz(0.06, 'bandpass', 3000, 2000, 0.12, 2); tn(700, 700, 0.05, 'square', 0.03); break;
      case 'hurt': tn(240, 90, 0.22, 'sawtooth', 0.12); break;
      case 'die': nz(0.25, 'lowpass', 900, 100, 0.25); break;
      case 'horn': tn(196, 196, 0.55, 'sawtooth', 0.08); tn(262, 262, 0.7, 'sawtooth', 0.08, 0.45); break;
      case 'roar': tn(110, 38, 1.0, 'sawtooth', 0.2); nz(0.9, 'lowpass', 500, 80, 0.3); break;
      case 'slam': nz(0.6, 'lowpass', 400, 40, 0.8); tn(70, 30, 0.5, 'sine', 0.5); break;
      case 'poof': nz(0.35, 'highpass', 1500, 4000, 0.16); break;
      case 'fire': nz(0.5, 'bandpass', 600, 1400, 0.2, 1.5); break;
      case 'potion': tn(400, 900, 0.35, 'sine', 0.12); break;
      case 'level': [523, 659, 784, 1046, 1318].forEach((f, i) => tn(f, f, 0.22, 'triangle', 0.08, i * 0.09)); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => tn(f, f, 0.25, 'triangle', 0.08, i * 0.12)); break;
      case 'neigh': tn(700, 1100, 0.18, 'square', 0.035); tn(1100, 500, 0.35, 'square', 0.035, 0.16); break;
      case 'whistle': tn(1800, 2600, 0.15, 'sine', 0.08); tn(2600, 1700, 0.2, 'sine', 0.08, 0.17); break;
      case 'hiss': nz(0.45, 'highpass', 3000, 6000, 0.12); break;
      case 'cackle': for (let i = 0; i < 4; i++) tn(900 - i * 80, 700 - i * 80, 0.08, 'square', 0.03, i * 0.1); break;
      case 'death': tn(300, 60, 1.2, 'sawtooth', 0.14); break;
      case 'dash': nz(0.16, 'bandpass', 900, 2600, 0.16, 1.2); break;
      case 'perfect': tn(1200, 2400, 0.25, 'sine', 0.12); tn(600, 1800, 0.35, 'triangle', 0.06, 0.03); break;
      case 'parry': tn(2200, 1800, 0.22, 'triangle', 0.14); tn(3300, 3000, 0.18, 'sine', 0.06); nz(0.06, 'highpass', 4000, 4000, 0.18); break;
      case 'parrytry': nz(0.05, 'bandpass', 3500, 2500, 0.05, 3); break;
      case 'heavy': nz(0.22, 'bandpass', 1800, 400, 0.3, 1.5); break;
      case 'chargeup': tn(220, 440, 0.3, 'triangle', 0.04); break;
      case 'charged': tn(1500, 1500, 0.08, 'square', 0.05); tn(2000, 2000, 0.1, 'sine', 0.06, 0.05); break;
      case 'tele': tn(1800, 1800, 0.06, 'square', 0.035); break;
      case 'lock': tn(900, 1300, 0.06, 'triangle', 0.05); break;
      case 'nope': tn(200, 160, 0.08, 'square', 0.04); break;
      case 'rank': tn(880, 1320, 0.15, 'triangle', 0.07); break;
      case 'giggle': { const b = 900 + Math.random() * 500; for (let i = 0; i < 5; i++) tn(b + (i % 2) * 260, b - 120 + (i % 2) * 300, 0.06, 'square', 0.022, i * 0.075); break; }
      case 'scratch': nz(0.07, 'highpass', 2500, 4000, 0.14); break;
      case 'screech': tn(1800, 2600, 0.25, 'sawtooth', 0.05); tn(2400, 1500, 0.3, 'square', 0.03, 0.12); nz(0.3, 'bandpass', 3000, 2000, 0.1, 3); break;
      case 'wail': tn(420, 300, 1.2, 'sine', 0.07); tn(560, 380, 1.1, 'sine', 0.04, 0.2); break;
      case 'chant': tn(160, 150, 0.5, 'sawtooth', 0.05); tn(240, 230, 0.5, 'triangle', 0.04, 0.1); break;
      case 'boom': nz(0.45, 'lowpass', 1400, 60, 0.6); tn(90, 40, 0.3, 'sine', 0.35); break;
      case 'anvil': tn(1650, 1600, 0.35, 'triangle', 0.09); tn(2480, 2400, 0.25, 'sine', 0.05); nz(0.05, 'highpass', 3500, 3500, 0.2); break;
      case 'anvil_perfect': tn(1760, 1740, 0.6, 'triangle', 0.11); tn(2640, 2620, 0.5, 'sine', 0.07); tn(3520, 3500, 0.35, 'sine', 0.04, 0.02); nz(0.05, 'highpass', 4000, 4000, 0.22); break;
      case 'anvil_bad': nz(0.12, 'lowpass', 1200, 300, 0.4); tn(320, 220, 0.12, 'square', 0.05); break;
      case 'mine': tn(1300, 1100, 0.12, 'triangle', 0.07); nz(0.12, 'bandpass', 2200, 900, 0.3, 2); break;
      case 'chop': nz(0.1, 'lowpass', 900, 250, 0.45); tn(180, 110, 0.08, 'triangle', 0.12); break;
    }
  } catch (e) { }
}
function setMute(m) { AU.muted = m; try { localStorage.setItem('ironcrown1700_mute', m ? '1' : '0'); } catch (e) { } const b = $('btnSound'); if (b) b.textContent = 'Sound: ' + (m ? 'Off' : 'On'); }

// ---------- input ----------
const keys = {}, edge = {};
let mouseL = false, mouseR = false;
const touch = { active: false, jx: 0, jy: 0, atk: false, off: false, dash: false, lock: false, horse: false, pot: false, use: false };
const MOUSE = { x: 0, y: 0, ok: false, t: 0 };
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'];
function consume(code) { const v = edge[code]; edge[code] = false; return !!v; }
// camera-relative movement: my = screen up, mx = screen right
function readInput() {
  let my = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (touch.active) { mx += touch.jx; my -= touch.jy; }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  S.mouseAim = !IS_TOUCH && MOUSE.ok && performance.now() - MOUSE.t < 4000;
  const inp = {
    mx, my,
    atk: !!(keys.KeyJ || mouseL || touch.atk), off: !!(keys.KeyK || mouseR || touch.off),
    dash: consume('Space') || consume('ShiftLeft') || consume('ShiftRight') || touch.dash,
    lock: consume('KeyL') || consume('Tab') || touch.lock,
    horse: consume('KeyH') || touch.horse, pot: consume('KeyR') || touch.pot, use: consume('KeyE') || touch.use
  };
  touch.horse = touch.pot = touch.use = touch.dash = touch.lock = false;
  return inp;
}
function onKeyDown(e) {
  audioInit();
  if (GAME_KEYS.includes(e.code) && (S.mode === 'play' || S.mode === 'dying')) e.preventDefault();
  if (e.repeat && keys[e.code]) return;
  if (!keys[e.code]) edge[e.code] = true;
  keys[e.code] = true;
  const c = e.code;
  if (S.mode === 'forge' && FORGE.mg && (c === 'Space' || c === 'KeyJ' || c === 'Enter')) { if (e.preventDefault) e.preventDefault(); forgeStrike(); return; }
  if (/^Digit[1-8]$/.test(c) && S.mode === 'play') { hotSelect(+c.slice(5) - 1, 'key'); return; }
  if (c === 'KeyP' || c === 'Escape') { if (S.mode === 'play') openPause(); else if (S.mode === 'paused') closePause(); else if (S.mode === 'inv') closeInv(); else if (S.mode === 'shop') closeShop(); else if (S.mode === 'log') closeLog(); else if (S.mode === 'talk') closeTalk(); else if (S.mode === 'forge') { if (FORGE.mg) { FORGE.mg = null; forgeRender(); } else closeForge(); } }
  else if (c === 'KeyQ') { if (S.mode === 'play') openLog(); else if (S.mode === 'log') closeLog(); }
  else if (c === 'KeyM') setMute(!AU.muted);
  else if (c === 'KeyI' || c === 'KeyB') { if (S.mode === 'play') openInv(); else if (S.mode === 'inv') closeInv(); }
  else if (c === 'Tab') e.preventDefault();
  else if (c === 'KeyZ' && S.mode === 'play') CAMK.yawT -= Math.PI / 4;
  else if (c === 'KeyX' && S.mode === 'play') CAMK.yawT += Math.PI / 4;
}
function onKeyUp(e) { keys[e.code] = false; }
function clearInputs() { for (const k in keys) keys[k] = false; mouseL = mouseR = false; touch.atk = touch.off = false; touch.active = false; touch.jx = touch.jy = 0; }

function bindTouch() {
  const zone = $('zone'), base = $('base'), knob = $('knob');
  let sid = null, ox = 0, oy = 0; const RAD = 52;
  const reset = () => { base.style.left = ''; base.style.top = ''; base.style.bottom = ''; base.classList.remove('on'); knob.style.transform = 'translate(0px,0px)'; };
  zone.addEventListener('pointerdown', e => {
    audioInit(); if (sid !== null) return; sid = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch (_) { }
    ox = e.clientX; oy = e.clientY;
    base.style.left = (ox - 59) + 'px'; base.style.top = (oy - 59) + 'px'; base.style.bottom = 'auto'; base.classList.add('on');
    touch.active = true; touch.jx = touch.jy = 0; e.preventDefault();
  });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
    if (d > RAD) { dx *= RAD / d; dy *= RAD / d; }
    knob.style.transform = 'translate(' + dx.toFixed(0) + 'px,' + dy.toFixed(0) + 'px)';
    let jx = dx / RAD, jy = dy / RAD; if (Math.hypot(jx, jy) < 0.15) { jx = 0; jy = 0; }
    touch.jx = jx; touch.jy = jy; e.preventDefault();
  });
  const end = e => { if (e.pointerId !== sid) return; sid = null; touch.active = false; touch.jx = touch.jy = 0; reset(); };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  const hold = (id, key) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { audioInit(); e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) { } el.classList.add('down'); touch[key] = true; });
    const up = () => { el.classList.remove('down'); touch[key] = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  };
  const tap = (id, fn) => {
    const el = $(id);
    el.addEventListener('pointerdown', e => { audioInit(); e.preventDefault(); el.classList.add('down'); fn(); });
    const up = () => el.classList.remove('down');
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
  };
  hold('bAtk', 'atk'); hold('bOff', 'off');
  tap('bDash', () => { touch.dash = true; });
  tap('bLock', () => { touch.lock = true; });
  tap('bHorse', () => { touch.horse = true; });
  tap('bUse', () => { touch.use = true; });
  tap('bPot', () => { touch.pot = true; });
  tap('bBag', () => { if (S.mode === 'play') openInv(); });
  tap('bPause', () => { if (S.mode === 'play') openPause(); });
  const bq = $('bQuest'); if (bq) bq.addEventListener('click', () => { audioInit(); if (S.mode === 'play') openLog(); else if (S.mode === 'log') closeLog(); });
}
function layoutTouch() {
  const pb = typeof document !== 'undefined' ? $('bPause') : null;
  if (pb) { pb.style.top = '6px'; pb.style.height = '26px'; }
  if (typeof document === 'undefined') return;
  // the hotbar owns the bottom strip: in portrait the thumb controls sit above it; in landscape it fits between them
  const L = hotLayout(), t = $('touch'), u = $('bUse');
  if (t && t.style) t.style.bottom = (VH >= VW ? L.s + 40 : 0) + 'px'; // room for the bar and its item-name label
  if (u && u.style) { u.style.bottom = VH >= VW ? '' : '104px'; u.style.right = VH >= VW ? '' : '196px'; }
  layoutHotbarDOM();
}
let uiKey = '';
function atkBtn() {
  if (typeof hotConsumable === 'function' && hotConsumable()) return 'DRINK';
  const it = mainItem();
  if (!it) return P.mounted ? 'SWEEP' : 'ATTACK';
  return it.type === 'bow' ? 'DRAW' : it.type === 'gun' ? 'FIRE' : P.mounted ? 'SWEEP' : 'ATTACK';
}
function offBtn() {
  const k = offKind(), it = offItem();
  return k === 'shield' ? 'BLOCK' : k === 'parryW' ? 'PARRY' : k === 'grab' ? 'PARRY' : k === 'gun' ? 'FIRE' : k === 'torch' ? 'TORCH' : it ? 'SLASH' : 'PARRY';
}
function syncUI() {
  if (typeof document === 'undefined') return;
  const showTouch = IS_TOUCH && S.mode === 'play';
  if (S.mode === 'play' && S.Q && S.Q.story.length) { const b = S.Q.story.shift(); openStory(b.title, b.lines); }
  const k = [showTouch, S.mode, S.interact ? S.interact.label : '', atkBtn(), offBtn(), invCount('potion'), P.mounted, S.horse.state, !!P.lock, P.hotSel].join('|');
  if (k === uiKey) return; uiKey = k;
  { const hb = $('hotbar'); if (hb) hb.classList.toggle('hidden', S.mode !== 'play'); }
  $('touch').classList.toggle('on', showTouch);
  $('bPause').classList.toggle('hidden', S.mode !== 'play');
  { const bq = $('bQuest'); if (bq) bq.classList.toggle('hidden', S.mode !== 'play'); }
  const u = $('bUse'); u.style.display = S.interact && showTouch && S.interact.type !== 'mount' ? 'flex' : 'none'; if (S.interact) u.textContent = S.interact.label;
  const mi = mainItem();
  const hc = hotConsumable();
  $('bAtk').innerHTML = atkBtn() + '<small>' + (hc ? ITEMS[hc].short + ' ×' + invCount(hc) : (mi ? mi.short : 'fists') + (mi && (mi.type === 'bow' || mi.type === 'gun') ? '' : ' · hold')) + '</small>';
  $('bOff').innerHTML = offBtn() + (offKind() === 'grab' ? '<small>grab</small>' : '');
  $('bLock').innerHTML = P.lock ? 'NEXT' : 'LOCK';
  $('bLock').classList.toggle('lit', !!P.lock);
  $('bPot').innerHTML = '<small>POT</small>' + invCount('potion');
  $('bHorse').innerHTML = P.mounted ? 'DIS<br>MOUNT' : (dist(S.horse, P) < 3.2 ? 'MOUNT' : 'CALL<br>HORSE');
}

// ---------- overlays ----------
function show(id, on) { $(id).classList.toggle('hidden', !on); }
const LOGO_L = {
  I: [' ___ ', '|_ _|', ' | | ', ' | | ', '|___|'],
  R: [' ____  ', '|  _ \\ ', '| |_) |', '|  _ < ', '|_| \\_\\'],
  O: ['  ___  ', ' / _ \\ ', '| | | |', '| |_| |', ' \\___/ '],
  N: [' _   _ ', '| \\ | |', '|  \\| |', '| |\\  |', '|_| \\_|'],
  C: ['  ____ ', ' / ___|', '| |    ', '| |___ ', ' \\____|'],
  W: ['__        __', '\\ \\      / /', ' \\ \\ /\\ / / ', '  \\ V  V /  ', '   \\_/\\_/   ']
};
function logoWord(w) { const rows = []; for (let i = 0; i < 5; i++) rows.push(w.split('').map(c => LOGO_L[c][i]).join(' ')); return rows; }
function buildLogo() {
  const a = logoWord('IRON'), b = logoWord('CROWN');
  const narrow = (window.innerWidth || 800) < 720;
  $('logo').textContent = narrow ? a.join('\n') + '\n\n' + b.join('\n') : a.map((l, i) => l + '   ' + b[i]).join('\n');
}
let newArmed = false;
function showTitle() {
  S.mode = 'title'; buildLogo();
  const sv = readSave();
  const bc = $('btnCont');
  if (sv) { bc.style.display = ''; bc.textContent = 'Continue · Day ' + sv.day + ' · LV ' + sv.level; } else bc.style.display = 'none';
  $('btnNew').textContent = 'New Game'; newArmed = false;
  show('title', true);
}
let loadCB = null, loadStart = 0, loadTotal = 0;
function startLoading(cb) {
  S.mode = 'loading'; loadCB = cb; loadStart = performance.now(); loadTotal = 0;
  show('title', false); show('loading', true);
}
function loadingStep() {
  const pcx = Math.floor(P.x / CS), pcy = Math.floor(P.y / CS);
  let missing = 0, made = 0;
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
    if (!CHUNKS.has((pcx + i) + ',' + (pcy + j))) { if (made < 6) { getChunk(pcx + i, pcy + j); made++; } else missing++; }
  }
  const done = 49 - missing;
  const el = performance.now() - loadStart;
  $('loadbar').style.width = Math.min(100, Math.round(Math.min(done / 49, el / 700) * 100)) + '%';
  const warm = missing === 0 ? prewarmStacks(30) : 1;
  if (missing === 0 && warm === 0 && el > 700) {
    show('loading', false);
    updateCamera(0, true);
    S.mode = 'play';
    const cb = loadCB; loadCB = null; if (cb) cb();
  }
}
function resetWorld() { newState(); CHUNKS.clear(); VILC.clear(); lastChunk = null; uiKey = ''; }
function startNew() {
  resetWorld();
  startLoading(() => {
    S.time = 0.29; S.dirT = 45;
    startMain(0, true);
    msg('Ashford, Anno Domini 1700.', '#ffe070', 6);
    sfx('horn');
    openStory('THE IRON CROWN', storyText('prologue'), 'Begin');
  });
}
function continueGame() {
  const sv = readSave(); if (!sv) { startNew(); return; }
  resetWorld(); applySave(sv);
  startLoading(() => { banner('Welcome back', 'Day ' + S.day + ' · ' + BIOME_NAMES[biomeAt(P.x, P.y)], 3.5); });
}
function openPause() { S.mode = 'paused'; clearInputs(); setMute(AU.muted); show('pause', true); }
function closePause() { S.mode = 'play'; show('pause', false); }

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// shop
let shopRef = null, shopTab = 'buy';
// stock by trade: the general merchant (supplies, bows, light gear), the blacksmith (arms and armour),
// a royal quartermaster (two tiers better)
function genStock(m) {
  const v = m.village || { seed: 1, tier: 0, name: 'the road' };
  const R = mulberry((v.seed | 0) + (m.role === 'smith' ? 17 : m.role === 'qm' ? 29 : 0)), t = v.tier | 0, up = Math.min(4, t + 1);
  let ids;
  if (m.role === 'smith') {
    ids = new Set([TIER.sword[t], TIER.sword[up], TIER.armor[t], TIER.armor[up], TIER.shield[t], TIER.shield[up]]);
    if (t === 0) { ids.add('iron_sword'); ids.add('gambeson'); ids.add('leather'); ids.add('buckler'); }
    if (t >= 1 || R() < 0.5) ids.add('claymore');
    if (R() < 0.45) ids.add('kite_shield');
    if (t >= 2) ids.add(TIER.armor[Math.min(4, t + 1)]);
  } else if (m.role === 'qm') {
    const q = Math.min(4, t), q0 = Math.max(0, q - 1);
    ids = new Set(['potion', 'arrows', TIER.sword[q0], TIER.sword[q], TIER.armor[q0], TIER.armor[q], 'tower_shield', 'war_bow', 'pistol', 'claymore']);
  } else {
    ids = new Set(['potion', 'arrows', 'torch', 'bandage', TIER.bow[t], TIER.bow[up], 'buckler', TIER.armor[t], 'wood', 'cloth', 'leather_hide', 'iron_ore', 'herb']);
    if (t >= 1) ids.add('steel_ingot');
    if (t === 0) { ids.add('short_bow'); ids.add('gambeson'); ids.add('iron_sword'); }
    if (t >= 1 && R() < 0.6) ids.add('pistol');
    if (R() < 0.35) ids.add('kite_shield');
  }
  const out = [];
  for (const id of ids) {
    const it = ITEMS[id];
    if (id === 'arrows') out.push({ id, n: 10, price: 18 });
    else if (it.type === 'mat') out.push({ id, n: 3, price: Math.round(it.price * 3 * (1 + R() * 0.25)) });
    else out.push({ id, n: 1, price: Math.round(it.price * (0.95 + R() * 0.2)) });
  }
  const order = ['potion', 'arrows', 'torch'], rank = s => order.includes(s.id) ? 0 : ITEMS[s.id].type === 'mat' ? 2 : 1;
  out.sort((a, b) => rank(a) - rank(b) || a.price - b.price);
  return out;
}
function sellPrice(id) { return id === 'arrows' ? 8 : Math.max(1, Math.floor(ITEMS[id].price * (ITEMS[id].type === 'mat' ? 0.5 : 0.4))); }
function shopRow(id, n, desc, btn) { const it = ITEMS[id]; return '<div class="row">' + thumbImg(id) + '<span class="nm">' + nameHTML(it) + (n > 1 ? ' <span class="dim">×' + n + '</span>' : '') + (it.lvl ? '' : '') + '<br><span class="dim">' + esc(desc) + '</span></span><span class="bt">' + btn + '</span></div>'; }
function repDisc(m) { const v = m && m.village; return v && v.id && S.Q ? Math.min(0.15, 0.03 * (S.Q.rep[v.id] || 0)) : 0; }
function buyPrice(m, s) { return Math.max(1, Math.round(s.price * (1 - repDisc(m)))); }
function shopHTML() {
  const m = shopRef, v = m.village;
  const title = m.role === 'smith' ? 'BLACKSMITH' : m.role === 'qm' ? 'QUARTERMASTER' : 'MERCHANT';
  let h = '<div class="hdr"><b>' + title + (v ? ' OF ' + esc(v.name.toUpperCase()) : '') + '</b><button class="x" data-a="close">✕</button></div>';
  h += '<div class="stats">Your purse: <span class="gold">$' + P.gold + '</span> · Bag ' + P.inv.length + '/' + INV_MAX + (repDisc(m) ? ' · <span class="gold">friend of ' + esc(v.name) + ': -' + Math.round(repDisc(m) * 100) + '%</span>' : '') + '</div>';
  h += '<div class="tabs"><button data-a="tab" data-t="buy" class="' + (shopTab === 'buy' ? 'on' : '') + '">Buy</button><button data-a="tab" data-t="sell" class="' + (shopTab === 'sell' ? 'on' : '') + '">Sell</button>' + (m.role === 'smith' ? '<button data-a="forge" class="alt">Forge</button>' : '') + '</div>';
  if (shopTab === 'buy') {
    m.stock.forEach((s, i) => {
      const it = ITEMS[s.id], pr = buyPrice(m, s), can = P.gold >= pr;
      h += shopRow(s.id, s.n, itemDesc(it), '<button data-a="buy" data-i="' + i + '"' + (can ? '' : ' disabled') + '>$' + pr + '</button>');
    });
  } else {
    if (!P.inv.length && !Object.keys(P.mats).length) h += '<div class="dim pad">Nothing to sell. (Equipped items must be unequipped first.)</div>';
    P.inv.forEach((s, i) => {
      const it = ITEMS[s.id];
      h += shopRow(s.id, s.n, itemDesc(it), '<button data-a="sell" data-i="' + i + '">+$' + sellPrice(s.id) + (s.id === 'arrows' ? ' /10' : '') + '</button>');
    });
    for (const k of Object.keys(P.mats)) h += shopRow(k, P.mats[k], itemDesc(ITEMS[k]), '<button data-a="sellmat" data-id="' + k + '">+$' + sellPrice(k) + '</button>');
  }
  h += '<div class="foot"><button data-a="close" class="big">Leave</button></div>';
  return h;
}
function openShop(m) {
  shopRef = m; if (!m.stock) m.stock = genStock(m);
  shopTab = 'buy'; S.mode = 'shop'; clearInputs();
  $('shopPanel').innerHTML = shopHTML(); show('shop', true);
}
function closeShop() { S.mode = 'play'; show('shop', false); saveGame(); }
function shopClick(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.a, i = +b.dataset.i;
  if (a === 'close') { closeShop(); return; }
  if (a === 'tab') shopTab = b.dataset.t;
  else if (a === 'forge') { const r = shopRef; closeShop(); openForge(r, 'smith'); return; }
  else if (a === 'sellmat') { if (invTake(b.dataset.id, 1)) { P.gold += sellPrice(b.dataset.id); sfx('coin'); } }
  else if (a === 'buy') {
    const s = shopRef.stock[i];
    const pr = s ? buyPrice(shopRef, s) : 0;
    if (s && P.gold >= pr) { if (invAdd(s.id, s.n)) { P.gold -= pr; sfx('coin'); autoEquip(s.id); hotAuto(s.id); } else { sfx('hurt'); } }
  } else if (a === 'sell') {
    const s = P.inv[i];
    if (s) {
      if (s.id === 'arrows') { const n = Math.min(10, s.n); P.gold += Math.round(sellPrice('arrows') * n / 10); invTake('arrows', n); }
      else { P.gold += sellPrice(s.id); invTake(s.id, 1); }
      sfx('coin');
    }
  }
  $('shopPanel').innerHTML = shopHTML();
}

// ---------- dialogue: quest givers, story beats, offers (Accept / Decline) ----------
let TALK = null;
const ROLE_GREET = {
  innkeeper: ['Come in out of the cold. A bed is %COST% gold, and the stew is free if you don\'t ask what\'s in it.'],
  priest: ['Peace be with you, traveller. These are dark days; the dead do not rest as they should.'],
  captain: ['Royal army. We hold this road for the true Crown, whatever the Protector says.'],
  stranger: ['The hooded man watches the door more than his ale.'],
  heir: ['Elinor smiles, though she looks tired. "The realm is mending. Slowly."'],
  captive: ['"Is it over? Please, take me home."']
};
function npcTitle(e) { if (e.kind === 'stranger') return S.Q.main >= 2 ? 'Sir Aldous Grey' : 'The Stranger'; if (e.kind === 'heir') return 'Lady Elinor'; if (e.cname) return e.cname; return giverName(e).replace(/^the /, '').replace(/^./, c => c.toUpperCase()); }
function openTalk(e) {
  TALK = { e, view: 'menu', offers: [] }; S.mode = 'talk'; clearInputs();
  const b = npcBusiness(e);
  if (b.story.length) TALK.view = 'story', TALK.q = b.story[0];
  else if (b.turnin.length) TALK.view = 'turnin', TALK.q = b.turnin[0];
  else if (b.free.length) TALK.view = 'free', TALK.q = b.free[0];
  talkRender(); show('talk', true);
}
function openStory(title, lines, btn) { TALK = { e: null, view: 'narr', title, lines, btn: btn || 'Continue' }; S.mode = 'talk'; clearInputs(); talkRender(); show('talk', true); }
function closeTalk() { show('talk', false); TALK = null; if (S.mode === 'talk') S.mode = 'play'; }
function talkRender() {
  const T = TALK; if (!T) return;
  let h = '', who = T.e ? npcTitle(T.e) : T.title, lines = [], btns = [];
  const e = T.e;
  if (T.view === 'narr') { lines = T.lines; btns.push(['close', T.btn]); }
  else if (T.view === 'story') { const q = T.q; lines = storyLines(q) || ['"' + qStep(q).txt + '"']; btns.push(['story', 'Continue']); }
  else if (T.view === 'turnin') { const q = T.q; lines = storyLines(q) || ['"You did it? Then you\'ve earned this."', 'You report: ' + q.steps[q.si - 1 >= 0 ? q.si - 1 : 0].txt.toLowerCase() + '.']; btns.push(['turnin', 'Claim reward']); }
  else if (T.view === 'free') { lines = ['"Bless you! I thought I\'d die out here."', '"Lead the way. I\'ll stay close."']; btns.push(['free', 'Follow me']); }
  else if (T.view === 'offer') {
    const q = T.offer; who = npcTitle(e) + ' · ' + q.title;
    lines = (q.lines || []).concat(['<span class="dim">Objective: ' + esc(q.steps[0].txt) + (q.steps.length > 1 ? ', then ' + esc(q.steps[q.steps.length - 1].txt.charAt(0).toLowerCase() + q.steps[q.steps.length - 1].txt.slice(1)) : '') + '</span>', '<span class="gold">Reward: ' + q.rew.gold + ' gold · ' + q.rew.xp + ' XP' + (q.rew.items || []).map(id => id[0] === '$' ? ' · gear' : ' · ' + thumbImg(id, 'sm') + esc(ITEMS[id].name)).join('') + (q.rew.rep ? ' · reputation' : '') + '</span>']);
    btns.push(['accept', 'Accept'], ['decline', 'Decline']);
  } else {
    const greet = (ROLE_GREET[e.kind] || ['"Good day."']).map(l => l.replace('%COST%', e.role === 'inn' ? innCost(e) : ''));
    lines = greet.slice();
    T.offers = npcBusiness(e).offers;
    if (T.offers.length && S.Q.act.filter(q => !q.main).length < QMAX_SIDE) { lines.push('"I could use someone handy with a blade..."'); T.offers.forEach((q, i) => btns.push(['offer:' + i, '! ' + q.title])); }
    else if (T.offers.length) lines.push('<span class="dim">(Your quest log is full.)</span>');
    if (e.role === 'inn') btns.push(['rest', 'Rent a bed (' + innCost(e) + 'g)']);
    btns.push(['close', 'Farewell']);
  }
  h += '<div class="hdr"><b>' + esc(who) + '</b><button class="x" data-a="close">✕</button></div>';
  h += '<div class="talk">' + lines.map(l => '<p>' + (l.indexOf('<span') === 0 ? l : esc(l)) + '</p>').join('') + '</div>';
  h += '<div class="choices">' + btns.map(b => '<button data-a="' + b[0] + '"' + (b[0] === 'decline' || b[0] === 'close' && T.view === 'menu' ? ' class="dim2"' : '') + '>' + esc(b[1]) + '</button>').join('') + '</div>';
  $('talkPanel').innerHTML = h;
}
function talkAct(a) {
  const T = TALK; if (!T) return;
  if (a === 'close') { closeTalk(); return; }
  if (a === 'story') { const q = T.q; closeTalk(); storyStep(q); return; }
  if (a === 'turnin') { const q = T.q; closeTalk(); turnIn(q); return; }
  if (a === 'free') { const q = T.q; freeCaptive(q, T.e); closeTalk(); return; }
  if (a === 'rest') { const e = T.e; closeTalk(); innRest(e); return; }
  if (a.startsWith('offer:')) { T.offer = T.offers[+a.slice(6)]; T.view = 'offer'; talkRender(); return; }
  if (a === 'accept') { const q = T.offer; closeTalk(); acceptQuest(q); return; }
  if (a === 'decline') { T.view = 'menu'; T.offer = null; talkRender(); return; }
}
function talkClick(e) { const b = e.target.closest('button'); if (!b) return; talkAct(b.dataset.a); }
// ---------- quest log ----------
function logHTML() {
  let h = '<div class="hdr"><b>QUEST LOG</b><button class="x" data-a="close">✕</button></div>';
  const act = S.Q.act.slice().sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
  if (!act.length) h += '<div class="dim pad">No quests. Look for <span class="gold">!</span> over innkeepers, priests and captains.</div>';
  for (const q of act) {
    const st = qStep(q), tg = questTarget(q), d = tg ? Math.round(Math.hypot(tg.x - P.x, tg.y - P.y)) : null, tr = S.Q.track === q.id;
    h += '<div class="quest' + (tr ? ' tracked' : '') + '"><div class="qt">' + (q.main ? '<span class="gold">◆ ' : '◇ ') + esc(q.title) + (q.main ? '</span> <span class="dim">· chapter ' + (q.ch + 1) + ' of ' + MAIN_TITLES.length + '</span>' : ' <span class="dim">· ' + esc(q.giver ? q.giver.name : '') + '</span>') + '</div>';
    if (q.sum) h += '<div class="dim">' + esc(q.sum) + '</div>';
    q.steps.forEach((x, i) => { if (i > q.si) return; h += '<div class="step' + (i < q.si ? ' done' : '') + '">' + (i < q.si ? '✓ ' : '› ') + esc(x.txt) + (i === q.si ? esc(stepProgress(x)) + (d !== null ? ' <span class="dim">· ' + d + 'm</span>' : '') : '') + '</div>'; });
    h += '<div class="bt">' + (tr ? '<button disabled>Tracked</button>' : '<button data-a="track" data-q="' + esc(q.id) + '">Track</button>') + (q.main ? '' : '<button class="dim2" data-a="abandon" data-q="' + esc(q.id) + '">Abandon</button>') + '</div></div>';
  }
  const doneT = S.Q.done.map(id => id.startsWith('main') ? MAIN_TITLES[+id.slice(4)] : null).filter(Boolean);
  const sideN = S.Q.done.filter(id => !id.startsWith('main')).length;
  h += '<div class="sec">STORY</div><div class="dim pad">' + (doneT.length ? doneT.map(esc).join(' · ') : 'The story has only begun.') + (sideN ? '<br>Side quests completed: ' + sideN : '') + '</div>';
  const reps = Object.entries(S.Q.rep).filter(r => r[1] > 0).map(([id, n]) => { const v = villageByKey(id); return v ? esc(v.name) + ' ' + '★'.repeat(Math.min(5, n)) : null; }).filter(Boolean);
  if (reps.length) h += '<div class="sec">REPUTATION</div><div class="dim pad">' + reps.join(' · ') + '<br>Friendly villages sell to you for less.</div>';
  if (S.stats.stolen) h += '<div class="dim pad">Gremlins have stolen ' + S.stats.stolen + ' gold from you; you got ' + S.stats.recovered + ' back.</div>';
  h += '<div class="foot"><button data-a="close" class="big">Back to the field</button></div>';
  return h;
}
function openLog() { S.mode = 'log'; clearInputs(); $('logPanel').innerHTML = logHTML(); show('qlog', true); }
function closeLog() { S.mode = 'play'; show('qlog', false); }
function logClick(e) {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'close') { closeLog(); return; }
  if (a === 'track') S.Q.track = b.dataset.q;
  else if (a === 'abandon') abandonQuest(b.dataset.q);
  $('logPanel').innerHTML = logHTML();
}

// game over
function showOver() {
  S.mode = 'over'; clearInputs();
  const v = S.lastVillage;
  $('overPanel').innerHTML = '<div class="dead">YOU HAVE FALLEN</div><p>Slain by a ' + esc(S.killer) + ' on day ' + S.day + '.<br>Foes slain: ' + S.kills + ' · Level ' + P.level + '</p>' +
    '<button class="btn" data-a="rise">Rise again at ' + esc(v.name) + '</button><div class="dim small">You keep your gear but lose 30% of your gold.</div><button class="btn ghost" data-a="new">New Game</button>';
  show('over', true);
}
function overClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  show('over', false);
  if (b.dataset.a === 'rise') { respawn(); saveGame(); } else startNew();
}

// ---------- main loop ----------
let lastT = 0;
function step(dt) {
  if (typeof window !== 'undefined' && window.__FREEZE) { render(dt); syncUI(); return; } // test hook: hold a staged frame
  if (S.mode === 'play' || S.mode === 'dying') update(dt, readInput());
  else if (S.mode === 'talk' || S.mode === 'log') { S.fade = Math.max(0, S.fade - dt); updateCamera(dt); }
  else if (S.mode === 'forge') { forgeTick(dt); updateCamera(dt); }
  else if (S.mode === 'title') {
    S.t += dt; P.a += dt * 0.1; S.time = 0.735; S.darkness = darkAt(S.time);
    manageChunks(3); updateCamera(dt);
  } else if (S.mode === 'loading') loadingStep();
  render(dt);
  syncUI();
  for (const k in edge) edge[k] = false;
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = lastT ? (now - lastT) / 1000 : 0.016; lastT = now;
  dt = clamp(dt, 0.001, 0.05);
  try { step(dt); } catch (err) { console.error(err); }
}
function init() {
  canvas = $('cv'); ctx = canvas.getContext('2d');
  newState();
  resize();
  manageChunks(25);
  updateCamera(0, true);
  window.addEventListener('resize', () => { resize(); buildLogo(); uiKey = ''; });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // losing focus only releases held keys/buttons; the game keeps running (pause is manual: P / Esc / II)
  window.addEventListener('blur', () => { clearInputs(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInputs(); });
  window.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; MOUSE.x = e.clientX; MOUSE.y = e.clientY; MOUSE.ok = true; MOUSE.t = performance.now(); });
  canvas.addEventListener('pointerdown', e => { audioInit(); if (e.pointerType !== 'mouse') return; MOUSE.t = performance.now(); if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
  window.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') return; if (e.button === 0) mouseL = false; if (e.button === 2) mouseR = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  $('btnNew').addEventListener('click', () => {
    audioInit();
    if (readSave() && !newArmed) { newArmed = true; $('btnNew').textContent = 'Tap again: overwrite save'; return; }
    startNew();
  });
  $('btnCont').addEventListener('click', () => { audioInit(); continueGame(); });
  $('btnResume').addEventListener('click', closePause);
  $('btnSound').addEventListener('click', () => { audioInit(); setMute(!AU.muted); });
  $('btnQuit').addEventListener('click', () => { if (S.mode === 'paused') saveGame(); show('pause', false); resetWorld(); manageChunks(25); updateCamera(0, true); showTitle(); });
  { const bl = $('btnLog'); if (bl) bl.addEventListener('click', () => { show('pause', false); S.mode = 'play'; openLog(); }); }
  $('invPanel').addEventListener('click', invClick);
  $('invPanel').addEventListener('pointerdown', invPointerDown);
  window.addEventListener('pointermove', invPointerMove);
  window.addEventListener('pointerup', invPointerUp);
  window.addEventListener('pointercancel', () => { invDragEnd(); });
  window.addEventListener('wheel', onWheel, { passive: false });
  $('forgePanel').addEventListener('click', forgeClick);
  $('forgePanel').addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('button'); if ((b && b.dataset.a === 'strike') || e.target.id === 'mgcv') { e.preventDefault(); audioInit(); forgeStrike(); } });
  bindHotbar();
  try { thumbsInit(); } catch (err) { console.error(err); }
  $('shopPanel').addEventListener('click', shopClick);
  $('overPanel').addEventListener('click', overClick);
  $('talkPanel').addEventListener('click', talkClick);
  $('logPanel').addEventListener('click', logClick);
  bindTouch();
  if (IS_TOUCH) document.body.classList.add('touchdev');
  layoutTouch();
  setMute(AU.muted);
  showTitle();
  requestAnimationFrame(frame);
}
if (typeof window !== 'undefined' && !window.__NO_AUTOSTART) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
