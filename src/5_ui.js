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
  const name = itemIcon(it), rows = ICONS[name], s = 2, w = rows[0].length * s, h = rows.length * s;
  icon(name, x + 12 - w / 2, y + 12 - h / 2, s, it && it.type === 'armor' ? { A: it.color } : null);
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
    if (!inside) { mx = clamp(mx, x0 + 2, x0 + sz - 2); my = clamp(my, y0 + 2, y0 + sz - 2); }
    return [mx, my, inside];
  };
  const dot = (q, col, s) => { ctx.fillStyle = '#000'; ctx.fillRect(Math.round(q[0] - s / 2) - 1, Math.round(q[1] - s / 2) - 1, s + 2, s + 2); ctx.fillStyle = col; ctx.fillRect(Math.round(q[0] - s / 2), Math.round(q[1] - s / 2), s, s); };
  const pcx = Math.floor(P.x / CS), pcy = Math.floor(P.y / CS);
  for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
    const v = villageFor(pcx + i, pcy + j); if (!v) continue;
    const q = toMM(v.x, v.y, Math.hypot(v.x - P.x, v.y - P.y) < 160); if (!q) continue;
    ctx.fillStyle = '#000'; ctx.fillRect(Math.round(q[0]) - 3, Math.round(q[1]) - 3, 7, 6); ctx.fillStyle = '#ffd84a'; ctx.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) - 1, 5, 3); ctx.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 2, 3, 1);
  }
  if (!P.mounted) { const q = toMM(S.horse.x, S.horse.y, true); if (q) dot(q, q[2] ? '#d8a060' : '#8a6a40', 3); }
  for (const e of S.ents) {
    if (e.dead) continue;
    const col = e.team === 2 ? '#ffd84a' : e.team === 0 ? '#6a9aff' : (e.k.boss ? '#ff7a2a' : e.k.unholy ? '#d070ff' : '#ff4a3a');
    const q = toMM(e.x, e.y, e.team === 1 && dist(e, P) < 90); if (!q) continue;
    dot(q, q[2] ? col : '#a03a2a', e.k.boss ? 4 : 3);
  }
  // player arrow
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx + 5, cy + 5); ctx.lineTo(cx - 5, cy + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(cx, cy - 4); ctx.lineTo(cx + 3, cy + 3); ctx.lineTo(cx - 3, cy + 3); ctx.closePath(); ctx.fill();
  // north marker on the border
  const nx = -ca, ny = sa, t = Math.min(Math.abs(nx) > 1e-6 ? (sz / 2 - 7) / Math.abs(nx) : 1e9, Math.abs(ny) > 1e-6 ? (sz / 2 - 7) / Math.abs(ny) : 1e9);
  const qx = cx + nx * t, qy = cy + ny * t;
  ctx.fillStyle = '#000'; ctx.fillRect(Math.round(qx) - 6, Math.round(qy) - 7, 12, 13);
  ctx.font = HUD_FONT; hudText('N', qx, qy - 6, '#ffd84a', 'center');
}
function shadeMsg(col, t) { const c = rgbOf(col.replace('!', '')); const k = clamp(t, 0.2, 1); return css(c[0] * k, c[1] * k, c[2] * k); }
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.font = HUD_FONT; ctx.textBaseline = 'top';
  const narrow = VW < 520;
  // --- health / level panel
  const pw = Math.min(narrow ? 168 : 230, Math.floor(VW * 0.43)), x0 = 6, y0 = 6;
  hudPanel(x0, y0, pw, 38);
  icon('heart', x0 + 6, y0 + 6, 2);
  const fr = clamp(P.hp / P.maxHp, 0, 1), hc = fr > 0.5 ? '#5ad04a' : fr > 0.25 ? '#e8c050' : '#ff4a3a';
  const bw = pw - 64;
  hudBar(x0 + 24, y0 + 8, bw, 8, fr, hc, '#3a1a14');
  hudText(String(Math.ceil(P.hp)), x0 + 28 + bw, y0 + 5, hc);
  hudText('LV' + P.level, x0 + 6, y0 + 22, '#9ae0ff');
  hudBar(x0 + 44, y0 + 26, pw - 52, 3, P.xp / xpNext(), '#7ab0ff', '#1a2a3a');
  // --- hands, armour, purse
  const two = twoHanded() ? ITEMS[P.hands[1]] : null, hy = y0 + 44;
  if (two) { slot(x0, hy, two, '2H', P.drawing || P.anim[1] > 0); slot(x0 + 26, hy, null, '', false); ctx.fillStyle = 'rgba(12,9,6,0.9)'; ctx.fillRect(x0 + 27, hy + 1, 22, 22); }
  else { slot(x0, hy, P.hands[0] ? ITEMS[P.hands[0]] : null, 'L', P.anim[0] > 0 || (P.blocking && shieldItem() && P.hands[0] && ITEMS[P.hands[0]].type === 'shield')); slot(x0 + 26, hy, P.hands[1] ? ITEMS[P.hands[1]] : null, 'R', P.anim[1] > 0); }
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
  // --- boss bar
  let boss = null, bd = 45;
  for (const e of S.ents) if (e.k.boss && !e.dead) { const d = dist(e, P); if (d < bd) { bd = d; boss = e; } }
  let ty = narrow ? hy + 56 : hy + 34;
  if (boss) {
    const w = narrow ? Math.min(200, VW - mmS - 40) : Math.min(220, VW - 40), bx = (VW - w) / 2, by = narrow ? hy + 54 : 36;
    hudText(boss.k.name.toUpperCase(), VW / 2, by, '#ff7a5a', 'center');
    hudBar(bx, by + 16, w, 6, boss.hp / boss.maxHp, '#e8443a', '#3a1414');
    if (narrow) ty = Math.max(ty, by + 28);
  }
  // --- messages (left column)
  const colW = Math.max(120, VW - mmS - 30);
  const maxCh = Math.floor(colW / 7.3);
  for (const m of S.msgs) {
    const col = m.t < 1 ? shadeMsg(m.col, m.t) : m.col;
    for (const l of wrapText(m.txt, maxCh).slice(0, 2)) { hudText(l, 8, ty, col); ty += 15; }
  }
  // --- banner
  if (S.banner) {
    const b = S.banner, w = Math.min(460, VW - 24), inner = Math.floor((w - 24) / 7.3);
    const lines = wrapText(b.sub, inner), h = 30 + lines.length * 15;
    const bx = Math.round((VW - w) / 2);
    // below the stats panels when it would overlap them (narrow or short landscape screens)
    const by = narrow ? Math.round(Math.max(ty + 6, VH * 0.24)) : bx < pw + 16 ? Math.max(hy + 30, boss ? 64 : 36) : (boss ? 64 : 36);
    const a = clamp(b.t * 2, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(14,10,6,0.88)'; ctx.fillRect(bx, by, w, h);
    ctx.strokeStyle = '#8a6a30'; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1); ctx.strokeStyle = '#3a2a14'; ctx.strokeRect(bx + 3.5, by + 3.5, w - 7, h - 7);
    ctx.font = 'bold 14px ui-monospace,Menlo,Consolas,monospace'; hudText(b.title, VW / 2, by + 8, b.col, 'center');
    ctx.font = HUD_FONT; lines.forEach((l, i) => hudText(l, VW / 2, by + 28 + i * 15, '#e8dcc0', 'center'));
    ctx.globalAlpha = 1;
  }
  // --- interaction hint (keyboard)
  if (S.interact && !IS_TOUCH) {
    const s = '[E] ' + S.interact.label[0] + S.interact.label.slice(1).toLowerCase(), w = s.length * 7.3 + 20;
    hudPanel(Math.round(VW / 2 - w / 2), VH - 44, Math.round(w), 24); hudText(s, VW / 2, VH - 38, '#ffd84a', 'center');
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
    }
  } catch (e) { }
}
function setMute(m) { AU.muted = m; try { localStorage.setItem('ironcrown1700_mute', m ? '1' : '0'); } catch (e) { } const b = $('btnSound'); if (b) b.textContent = 'Sound: ' + (m ? 'Off' : 'On'); }

// ---------- input ----------
const keys = {}, edge = {};
let mouseL = false, mouseR = false;
const touch = { active: false, jx: 0, jy: 0, L: false, R: false, horse: false, pot: false, use: false };
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
function consume(code) { const v = edge[code]; edge[code] = false; return !!v; }
function readInput() {
  let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  let turn = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  if (touch.active) { fwd += -touch.jy; turn += Math.sign(touch.jx) * Math.pow(Math.abs(touch.jx), 1.4); }
  const inp = {
    fwd: clamp(fwd, -1, 1), turn: clamp(turn, -1, 1),
    L: !!(keys.KeyK || keys.KeyQ || mouseR || touch.L), R: !!(keys.KeyJ || keys.Space || mouseL || touch.R),
    horse: consume('KeyH') || touch.horse, pot: consume('KeyR') || touch.pot, use: consume('KeyE') || touch.use
  };
  touch.horse = touch.pot = touch.use = false;
  return inp;
}
function onKeyDown(e) {
  audioInit();
  if (GAME_KEYS.includes(e.code) && (S.mode === 'play' || S.mode === 'dying')) e.preventDefault();
  if (e.repeat && keys[e.code]) return;
  if (!keys[e.code]) edge[e.code] = true;
  keys[e.code] = true;
  const c = e.code;
  if (c === 'KeyP' || c === 'Escape') { if (S.mode === 'play') openPause(); else if (S.mode === 'paused') closePause(); else if (S.mode === 'inv') closeInv(); else if (S.mode === 'shop') closeShop(); }
  else if (c === 'KeyM') setMute(!AU.muted);
  else if (c === 'KeyI' || c === 'Tab' || c === 'KeyB') { if (S.mode === 'play') openInv(); else if (S.mode === 'inv') closeInv(); if (c === 'Tab') e.preventDefault(); }
}
function onKeyUp(e) { keys[e.code] = false; }
function clearInputs() { for (const k in keys) keys[k] = false; mouseL = mouseR = false; touch.L = touch.R = false; touch.active = false; touch.jx = touch.jy = 0; }

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
  hold('bR', 'R'); hold('bL', 'L');
  tap('bHorse', () => { touch.horse = true; });
  tap('bUse', () => { touch.use = true; });
  tap('bPot', () => { touch.pot = true; });
  tap('bBag', () => { if (S.mode === 'play') openInv(); });
  tap('bPause', () => { if (S.mode === 'play') openPause(); });
}
function layoutTouch() {
  const pb = typeof document !== 'undefined' ? $('bPause') : null;
  if (pb) { pb.style.top = '6px'; pb.style.height = '26px'; }
}
let uiKey = '';
function handBtn(s) {
  if (twoHanded()) { const it = ITEMS[P.hands[1]]; return it.type === 'bow' ? 'DRAW' : it.short.toUpperCase(); }
  const id = P.hands[s]; if (!id) return 'PUNCH';
  const it = ITEMS[id];
  return it.type === 'shield' ? 'BLOCK' : it.type === 'gun' ? 'FIRE' : it.type === 'torch' ? 'TORCH' : 'SLASH';
}
function syncUI() {
  if (typeof document === 'undefined') return;
  const showTouch = IS_TOUCH && S.mode === 'play';
  const k = [showTouch, S.mode, S.interact ? S.interact.label : '', handBtn(0), handBtn(1), invCount('potion'), P.mounted, S.horse.state].join('|');
  if (k === uiKey) return; uiKey = k;
  $('touch').classList.toggle('on', showTouch);
  $('bPause').classList.toggle('hidden', S.mode !== 'play');
  const u = $('bUse'); u.style.display = S.interact && showTouch && S.interact.type !== 'mount' ? 'flex' : 'none'; if (S.interact) u.textContent = S.interact.label;
  $('bL').innerHTML = '<small>LEFT</small>' + handBtn(0);
  $('bR').innerHTML = '<small>RIGHT</small>' + handBtn(1);
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
    spawnEnt('bandit', 16, -12, { tut: true, hp: 22, maxHp: 22, D: 0 });
    S.tut = 0; S.time = 0.29;
    banner(TUT[0][0], TUT[0][1], 8, '#9ae0ff');
    msg('Ashford, Anno Domini 1700.', '#ffe070', 6);
    sfx('horn');
  });
}
function continueGame() {
  const sv = readSave(); if (!sv) { startNew(); return; }
  resetWorld(); applySave(sv);
  startLoading(() => { banner('Welcome back', 'Day ' + S.day + ' · ' + BIOME_NAMES[biomeAt(P.x, P.y)], 3.5); });
}
function openPause() { S.mode = 'paused'; clearInputs(); setMute(AU.muted); show('pause', true); }
function closePause() { S.mode = 'play'; show('pause', false); }

// inventory
function invHTML() {
  const arm = ITEMS[P.armor];
  const spd = Math.round(arm.slow * 100);
  let h = '<div class="hdr"><b>INVENTORY</b><button class="x" data-a="close">✕</button></div>';
  h += '<div class="stats">HP ' + Math.ceil(P.hp) + '/' + P.maxHp + ' · LV ' + P.level + ' <span class="dim">(XP ' + P.xp + '/' + xpNext() + ')</span> · <span class="gold">$' + P.gold + '</span><br>Armor ' + Math.round(arm.def * 100) + '% · Speed ' + spd + '% · Damage ×' + dmgMult().toFixed(2) + '</div>';
  h += '<div class="sec">EQUIPPED</div>';
  const row = (label, it, btn) => '<div class="row"><span class="slot">' + label + '</span><span class="nm">' + (it ? '<b>' + esc(it.name) + '</b><br><span class="dim">' + itemDesc(it) + '</span>' : '<span class="dim">Bare fist · punch, 3-hit takedown</span>') + '</span>' + (btn || '') + '</div>';
  if (twoHanded()) { const it = ITEMS[P.hands[1]]; h += row('Both hands', it, '<button data-a="uneq" data-s="1">Unequip</button>'); }
  else {
    for (const s of [0, 1]) { const it = P.hands[s] ? ITEMS[P.hands[s]] : null; h += row(s ? 'Right hand' : 'Left hand', it, it ? '<button data-a="uneq" data-s="' + s + '">Unequip</button>' : ''); }
  }
  h += row('Body', arm, '');
  h += '<div class="sec">BAG (' + P.inv.length + '/' + INV_MAX + ')</div>';
  if (!P.inv.length) h += '<div class="dim pad">Empty. Loot fallen foes, chests in ruins, or trade with merchants.</div>';
  P.inv.forEach((s, i) => {
    const it = ITEMS[s.id]; let b = '';
    if (it.type === 'sword' || it.type === 'torch' || it.type === 'gun' || it.type === 'shield') b += '<button data-a="eq" data-i="' + i + '" data-s="0">L</button><button data-a="eq" data-i="' + i + '" data-s="1">R</button>';
    else if (it.hands === 2) b += '<button data-a="eq" data-i="' + i + '" data-s="1">Equip</button>';
    else if (it.type === 'armor') b += '<button data-a="eq" data-i="' + i + '" data-s="0">Wear</button>';
    else if (it.type === 'potion') b += '<button data-a="drink">Drink</button>';
    b += '<button class="dim2" data-a="drop" data-i="' + i + '">Drop</button>';
    h += '<div class="row"><span class="gl">' + esc(it.glyph) + '</span><span class="nm"><b>' + esc(it.name) + '</b>' + (s.n > 1 ? ' ×' + s.n : '') + '<br><span class="dim">' + itemDesc(it) + '</span></span><span class="bt">' + b + '</span></div>';
  });
  h += '<div class="foot"><button data-a="close" class="big">Back to the field</button></div>';
  return h;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function openInv() { S.mode = 'inv'; clearInputs(); $('invPanel').innerHTML = invHTML(); show('inv', true); }
function closeInv() { S.mode = 'play'; show('inv', false); }
function invClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a, i = +b.dataset.i, s = +b.dataset.s;
  if (a === 'close') { closeInv(); return; }
  if (a === 'eq') equipFromInv(i, s);
  else if (a === 'uneq') unequipHand(s);
  else if (a === 'drink') drinkPotion();
  else if (a === 'drop') { const q = P.inv[i]; if (q) { P.inv.splice(i, 1); dropItem(P.x + Math.cos(P.a) * 1.5, P.y + Math.sin(P.a) * 1.5, q.id, q.n, true); sfx('equip'); } }
  $('invPanel').innerHTML = invHTML();
}

// shop
let shopRef = null, shopTab = 'buy';
function genStock(m) {
  const v = m.village || { seed: 1, tier: 0, name: 'the road' };
  const R = mulberry(v.seed | 0), t = v.tier | 0, up = Math.min(4, t + 1);
  const ids = new Set(['potion', 'arrows', 'torch', TIER.sword[t], TIER.sword[up], TIER.armor[t], TIER.armor[up], TIER.shield[up], TIER.bow[up]]);
  if (t === 0) { ids.add('iron_sword'); ids.add('gambeson'); ids.add('buckler'); ids.add('short_bow'); ids.add('leather'); }
  if (t >= 1 && R() < 0.6) ids.add('pistol');
  if (t >= 1 && R() < 0.5) ids.add('claymore');
  if (R() < 0.35) ids.add('kite_shield');
  const out = [];
  for (const id of ids) {
    const it = ITEMS[id];
    if (id === 'arrows') out.push({ id, n: 10, price: 18 });
    else out.push({ id, n: 1, price: Math.round(it.price * (0.95 + R() * 0.2)) });
  }
  const order = ['potion', 'arrows', 'torch'];
  out.sort((a, b) => (order.indexOf(b.id) + 1 ? 1 : 0) - (order.indexOf(a.id) + 1 ? 1 : 0) || a.price - b.price);
  return out;
}
function sellPrice(id) { return id === 'arrows' ? 8 : Math.max(1, Math.floor(ITEMS[id].price * 0.4)); }
function shopHTML() {
  const m = shopRef, v = m.village;
  let h = '<div class="hdr"><b>MERCHANT' + (v ? ' OF ' + esc(v.name.toUpperCase()) : '') + '</b><button class="x" data-a="close">✕</button></div>';
  h += '<div class="stats">Your purse: <span class="gold">$' + P.gold + '</span> · Bag ' + P.inv.length + '/' + INV_MAX + '</div>';
  h += '<div class="tabs"><button data-a="tab" data-t="buy" class="' + (shopTab === 'buy' ? 'on' : '') + '">Buy</button><button data-a="tab" data-t="sell" class="' + (shopTab === 'sell' ? 'on' : '') + '">Sell</button></div>';
  if (shopTab === 'buy') {
    m.stock.forEach((s, i) => {
      const it = ITEMS[s.id], can = P.gold >= s.price;
      h += '<div class="row"><span class="gl">' + esc(it.glyph) + '</span><span class="nm"><b>' + esc(it.name) + '</b>' + (s.n > 1 ? ' ×' + s.n : '') + '<br><span class="dim">' + itemDesc(it) + '</span></span><span class="bt"><button data-a="buy" data-i="' + i + '"' + (can ? '' : ' disabled') + '>$' + s.price + '</button></span></div>';
    });
  } else {
    if (!P.inv.length) h += '<div class="dim pad">Nothing to sell. (Equipped items must be unequipped first.)</div>';
    P.inv.forEach((s, i) => {
      const it = ITEMS[s.id];
      h += '<div class="row"><span class="gl">' + esc(it.glyph) + '</span><span class="nm"><b>' + esc(it.name) + '</b>' + (s.n > 1 ? ' ×' + s.n : '') + '<br><span class="dim">' + itemDesc(it) + '</span></span><span class="bt"><button data-a="sell" data-i="' + i + '">+$' + sellPrice(s.id) + (s.id === 'arrows' ? ' /10' : '') + '</button></span></div>';
    });
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
  else if (a === 'buy') {
    const s = shopRef.stock[i];
    if (s && P.gold >= s.price) { if (invAdd(s.id, s.n)) { P.gold -= s.price; sfx('coin'); autoEquip(s.id); } else { sfx('hurt'); } }
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
  if (S.mode === 'play' || S.mode === 'dying') update(dt, readInput());
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
  window.addEventListener('blur', () => { clearInputs(); if (S.mode === 'play') openPause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') openPause(); });
  canvas.addEventListener('pointerdown', e => { audioInit(); if (e.pointerType !== 'mouse') return; if (e.button === 0) mouseL = true; if (e.button === 2) mouseR = true; });
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
  $('invPanel').addEventListener('click', invClick);
  $('shopPanel').addEventListener('click', shopClick);
  $('overPanel').addEventListener('click', overClick);
  bindTouch();
  if (IS_TOUCH) document.body.classList.add('touchdev');
  setMute(AU.muted);
  showTitle();
  requestAnimationFrame(frame);
}
if (typeof window !== 'undefined' && !window.__NO_AUTOSTART) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
}
