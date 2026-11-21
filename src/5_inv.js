// =====================================================================
//  INVENTORY UI — HUD hotbar (wheel / 1-8 / tap / swipe), the bag grid with drag and drop,
//  item details with compare, the forge and campfire screens with the hammer minigame
// =====================================================================
// ---------- HUD hotbar ----------
function hotLayout() {
  const touch = typeof IS_TOUCH !== 'undefined' && IS_TOUCH, port = VH >= VW;
  const gap = touch ? 3 : 4;
  let s = touch ? (port ? 44 : 40) : 46;
  s = Math.max(30, Math.min(s, Math.floor((VW - 16 - gap * (HOT_N - 1)) / HOT_N)));
  const w = s * HOT_N + gap * (HOT_N - 1), x = Math.round((VW - w) / 2), y = Math.round(VH - s - (touch ? 8 : 10));
  return { x, y, s, gap, w };
}
function hudThumb(id, x, y, s) {
  const c = thumbCanvas(id); const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, Math.round(x), Math.round(y), Math.round(s), Math.round(s)); ctx.imageSmoothingEnabled = sm;
}
function handMark(id) { if (!id) return ''; if (P.hands[0] === id && P.hands[1] === id) return '2H'; if (P.hands[1] === id) return 'R'; if (P.hands[0] === id) return 'L'; if (P.armor === id) return 'B'; return ''; }
function drawHotbar() {
  if (S.mode !== 'play' && S.mode !== 'dying') return;
  hotSync();
  const L = hotLayout(), touch = typeof IS_TOUCH !== 'undefined' && IS_TOUCH;
  ctx.fillStyle = 'rgba(6,5,4,0.42)'; ctx.fillRect(L.x - 4, L.y - 4, L.w + 8, L.s + 8);
  for (let j = 0; j < HOT_N; j++) {
    const x = L.x + j * (L.s + L.gap), sel = j === P.hotSel, y = L.y - (sel ? 3 : 0), id = P.hot[j], it = id ? ITEMS[id] : null;
    ctx.fillStyle = sel ? 'rgba(40,30,16,0.82)' : 'rgba(12,10,8,0.66)'; ctx.fillRect(x, y, L.s, L.s);
    if (it) { ctx.fillStyle = tierCol(it); ctx.globalAlpha = 0.85; ctx.fillRect(x + 2, y + L.s - 3, L.s - 4, 2); ctx.globalAlpha = 1; }
    ctx.lineWidth = sel ? 2 : 1; ctx.strokeStyle = sel ? '#ffd84a' : 'rgba(200,180,140,0.3)';
    ctx.strokeRect(x + (sel ? 1 : 0.5), y + (sel ? 1 : 0.5), L.s - (sel ? 2 : 1), L.s - (sel ? 2 : 1));
    if (sel) { ctx.strokeStyle = 'rgba(255,216,74,0.28)'; ctx.lineWidth = 3; ctx.strokeRect(x - 2.5, y - 2.5, L.s + 5, L.s + 5); }
    ctx.lineWidth = 1;
    if (it) {
      const pad = Math.round(L.s * 0.08); hudThumb(id, x + pad, y + pad - 1, L.s - pad * 2);
      ctx.font = 'bold 10px ui-monospace,Menlo,monospace'; ctx.textBaseline = 'top';
      if (it.lvl) hudText('+' + it.lvl, x + 3, y + 2, '#ffd84a');
      if (it.temper) { ctx.fillStyle = '#000'; ctx.fillRect(x + L.s - 9, y + 3, 6, 6); ctx.fillStyle = TEMPER[it.temper].col; ctx.fillRect(x + L.s - 8, y + 4, 4, 4); }
      if (it.stack) { ctx.font = 'bold 11px ui-monospace,Menlo,monospace'; hudText(String(invCount(id)), x + L.s - 3, y + L.s - 15, '#ffffff', 'right'); }
      const hm = handMark(id); if (hm) { ctx.font = 'bold 8px ui-monospace,Menlo,monospace'; hudText(hm, x + 3, y + L.s - 12, '#9ae0ff'); }
    }
    if (!touch) { ctx.font = 'bold 8px ui-monospace,Menlo,monospace'; ctx.textBaseline = 'top'; hudText(String(j + 1), x + L.s - 3, y + 2, sel ? '#ffd84a' : 'rgba(220,210,190,0.55)', 'right'); }
  }
  // the fading name of what you just picked
  const lb = S.hotLbl;
  if (lb && lb.t > 0) {
    lb.t -= (typeof RDT !== 'undefined' ? RDT : 0.016);
    const a = clamp(lb.t / 0.5, 0, 1); ctx.globalAlpha = a;
    ctx.font = 'bold 13px Georgia,"Times New Roman",serif'; ctx.textBaseline = 'top';
    const w = ctx.measureText(lb.txt).width + 22, yy = L.y - 30;
    ctx.fillStyle = 'rgba(10,8,6,0.72)'; ctx.fillRect(Math.round(VW / 2 - w / 2), yy, Math.round(w), 21);
    hudText(lb.txt, VW / 2, yy + 4, lb.col, 'center');
    ctx.globalAlpha = 1;
  }
  ctx.font = HUD_FONT; ctx.textAlign = 'left';
}
function layoutHotbarDOM() {
  if (typeof document === 'undefined') return;
  const el = $('hotbar'); if (!el || !el.style) return;
  const L = hotLayout();
  el.style.left = (L.x - 4) + 'px'; el.style.top = (L.y - 6) + 'px'; el.style.width = (L.w + 8) + 'px'; el.style.height = (L.s + 12) + 'px';
}
function bindHotbar() {
  const el = $('hotbar'); if (!el) return;
  let pid = null, x0 = 0, moved = false, lp = null;
  const slotAt = cx => { const L = hotLayout(), j = Math.floor((cx - L.x + L.gap / 2) / (L.s + L.gap)); return j >= 0 && j < HOT_N ? j : -1; };
  el.addEventListener('pointerdown', e => {
    audioInit(); e.preventDefault(); e.stopPropagation(); if (S.mode !== 'play') return;
    pid = e.pointerId; x0 = e.clientX; moved = false; try { el.setPointerCapture(pid); } catch (_) { }
    clearTimeout(lp); lp = setTimeout(() => { if (pid !== null && !moved) { pid = null; openInv(); } }, 550);
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const dx = e.clientX - x0, step = Math.max(24, hotLayout().s * 0.75);
    if (Math.abs(dx) > step) { hotWheel(dx > 0 ? 1 : -1); x0 = e.clientX; moved = true; clearTimeout(lp); }
  });
  const up = e => { if (e.pointerId !== pid) return; pid = null; clearTimeout(lp); if (!moved && S.mode === 'play') { const j = slotAt(e.clientX); if (j >= 0) hotSelect(j, 'tap'); } };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => { pid = null; clearTimeout(lp); });
  el.addEventListener('contextmenu', e => e.preventDefault());
}
let wheelAcc = 0, wheelT = 0;
function onWheel(e) {
  if (!S || S.mode !== 'play') return;
  if (e.preventDefault) e.preventDefault();
  const d = (e.deltaY || 0) * (e.deltaMode === 1 ? 40 : 1), t = performance.now();
  if (Math.abs(d) >= 50) { wheelAcc = 0; wheelT = t; hotWheel(d > 0 ? 1 : -1); return; }
  wheelAcc += d; if (Math.abs(wheelAcc) >= 50 && t - wheelT > 70) { hotWheel(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; wheelT = t; }
}

// ---------- shared HTML bits ----------
const TIER_NAME = ['Common', 'Sturdy', 'Superior', 'Rare', 'Legendary'];
function thumbImg(id, cls) {
  const u = thumbURL(id), it = ITEMS[id];
  return u ? '<img class="th ' + (cls || '') + '" src="' + u + '" alt="" draggable="false">' : '<span class="th gly ' + (cls || '') + '" style="color:' + tierCol(it) + '">' + esc(it ? it.glyph : '?') + '</span>';
}
function matChips(mats, owned) {
  return '<span class="chips">' + Object.entries(mats).map(([k, n]) => { const have = invCount(k), ok = have >= n; return '<span class="chip' + (ok ? '' : ' short') + '" title="' + esc(ITEMS[k].name) + '">' + thumbImg(k, 'sm') + '<b>' + (owned === false ? n : have + '/' + n) + '</b></span>'; }).join('') + '</span>';
}
function yieldChips(mats) { return '<span class="chips">' + Object.entries(mats).map(([k, n]) => '<span class="chip gain" title="' + esc(ITEMS[k].name) + '">' + thumbImg(k, 'sm') + '<b>+' + n + '</b></span>').join('') + '</span>'; }
function nameHTML(it) { return '<b class="inm" style="color:' + tierCol(it) + '">' + esc(it.name) + '</b>'; }
function pouchHTML() {
  const ks = Object.keys(P.mats).filter(k => P.mats[k] > 0);
  if (!ks.length) return '<div class="dim pad">No materials yet. Mine ore outcrops and chop trees (hit them), loot foes and chests, salvage gear, or buy from merchants.</div>';
  return '<div class="pouch">' + ks.map((k, i) => '<div class="sl mat t' + (ITEMS[k].tier || 0) + (INV.sel && INV.sel.k === 'mat' && INV.sel.i === i ? ' sel' : '') + '" data-k="mat" data-i="' + i + '" title="' + esc(ITEMS[k].name) + '">' + thumbImg(k) + '<i class="n">' + P.mats[k] + '</i></div>').join('') + '</div>';
}

// ---------- inventory ----------
const INV = { sel: null, drag: null };
function itemAt(k, i) {
  if (k === 'bag') { const s = P.inv[i]; return s ? { id: s.id, n: s.n } : null; }
  if (k === 'hot') { const id = P.hot[i]; return id && hotOwned(id) ? { id, n: ITEMS[id].stack ? invCount(id) : 1 } : null; }
  if (k === 'eq') { const id = i === 2 ? P.armor : (i === 0 && twoHanded() ? P.hands[1] : P.hands[i]); return id ? { id, n: 1 } : null; }
  if (k === 'mat') { const ks = Object.keys(P.mats).filter(x => P.mats[x] > 0), id = ks[i]; return id ? { id, n: P.mats[id] } : null; }
  return null;
}
function slotHTML(k, i, cap) {
  const o = itemAt(k, i), it = o && ITEMS[o.id], sel = INV.sel && INV.sel.k === k && INV.sel.i === i;
  let h = '<div class="sl ' + k + (sel ? ' sel' : '') + (it ? ' t' + clamp((it.tier || 0) + (it.q === 2 ? 1 : 0), 0, 4) : ' empty') + (k === 'hot' && i === P.hotSel ? ' cur' : '') + '" data-k="' + k + '" data-i="' + i + '">';
  if (it) {
    h += thumbImg(o.id);
    if (it.lvl) h += '<b class="lv">+' + it.lvl + '</b>';
    if (it.temper) h += '<u class="tp" style="background:' + TEMPER[it.temper].col + '"></u>';
    if (o.n > 1 || (it.stack && k !== 'eq')) h += '<i class="n">' + o.n + '</i>';
    if (k !== 'eq') { const hm = handMark(o.id); if (hm) h += '<em class="hm">' + hm + '</em>'; }
    if (k === 'eq' && i === 0 && twoHanded()) h += '<em class="hm">2H</em>';
  } else if (cap) h += '<span class="cap">' + cap + '</span>';
  if (k === 'hot') h += '<span class="key">' + (i + 1) + '</span>';
  return h + '</div>';
}
function statRows(it) {
  const r = [], pct = v => Math.round(v * 100);
  if (!it) return r;
  if (it.dmg !== undefined && it.type !== 'potion') r.push(['Damage', it.dmg, '']);
  if (it.type === 'bow') r.push(['Draw', it.draw, 's', true]);
  if (it.range) r.push(['Reach', it.range, 'm']);
  if (it.type === 'gun') r.push(['Reload', it.reload, 's', true]);
  if (it.block !== undefined) { r.push(['Block', pct(it.block), '%']); r.push(['Guard speed', pct(it.slow), '%']); }
  if (it.type === 'armor') { r.push(['Armour', pct(it.def), '%']); r.push(['Speed', pct(it.slow), '%']); }
  if (it.heal) r.push(['Heals', it.heal, ' HP']);
  return r;
}
function cmpTarget(it, id) {
  if (!it) return null;
  let o = null;
  if (it.type === 'armor') o = P.armor;
  else if (it.type === 'shield') o = (shieldItem() || {}).id || null;
  else if (it.type === 'bow') o = twoHanded() && ITEMS[P.hands[1]].type === 'bow' ? P.hands[1] : null;
  else if (it.type === 'sword' || it.type === 'sword2' || it.type === 'gun' || it.type === 'torch') { const m = mainItem(); o = m && m.type !== 'bow' ? m.id : null; }
  if (!o || o === id || P.hands[0] === id || P.hands[1] === id || P.armor === id) return null;
  return o;
}
function detailHTML() {
  const s = INV.sel; if (!s) return '<div class="dtl empty dim">Select an item to see its details. Drag items between the bag, the hotbar and your hands. On touch: tap an item, then tap where it should go.</div>';
  const o = itemAt(s.k, s.i); if (!o) return '<div class="dtl empty dim">Empty slot.</div>';
  const id = o.id, it = ITEMS[id], cid = cmpTarget(it, id), ci = cid ? ITEMS[cid] : null;
  let h = '<div class="dtl"><div class="dimg t' + clamp((it.tier || 0) + (it.q === 2 ? 1 : 0), 0, 4) + '">' + thumbImg(id, 'big') + (it.lvl ? '<b class="lv">+' + it.lvl + '</b>' : '') + '</div><div class="dtx">';
  h += nameHTML(it) + (o.n > 1 ? ' <span class="dim">×' + o.n + '</span>' : '');
  h += '<div class="sub">' + (it.type === 'mat' ? 'Material' : TIER_NAME[clamp(it.tier || 0, 0, 4)] + ' ' + ({ sword: 'sword', sword2: 'two-handed sword', bow: 'bow', shield: 'shield', torch: 'torch', gun: 'firearm', armor: 'armour', potion: 'consumable', ammo: 'ammunition' }[it.type] || '')) + (handMark(id) ? ' · <span class="eqd">equipped</span>' : '') + '</div>';
  const rows = statRows(it), crow = ci ? statRows(ci) : null;
  if (rows.length) {
    h += '<table class="st">';
    for (const [lab, v, u, lowBetter] of rows) {
      let d = '';
      if (crow) { const c = crow.find(x => x[0] === lab); if (c) { const dv = Math.round((v - c[1]) * 100) / 100; if (dv) d = '<span class="' + ((dv > 0) !== !!lowBetter ? 'up' : 'dn') + '">' + (dv > 0 ? '▲ +' : '▼ ') + dv + '</span>'; } }
      h += '<tr><td>' + lab + '</td><td><b>' + v + u + '</b> ' + d + '</td></tr>';
    }
    h += '</table>';
    if (ci) h += '<div class="dim">compared with ' + esc(ci.name) + '</div>';
  }
  if (it.temper) h += '<div class="tpx" style="color:' + TEMPER[it.temper].col + '">' + esc(TEMPER[it.temper].name) + ': ' + TEMPER[it.temper].desc + '</div>';
  if (it.q) h += '<div class="dim">' + QUAL[it.q] + ' craftsmanship</div>';
  if (it.type === 'mat') h += '<div class="dim">' + esc(itemDesc(it)) + '</div>';
  else if (!rows.length) h += '<div class="dim">' + esc(itemDesc(it)) + '</div>';
  h += '</div></div><div class="acts">';
  const inBag = s.k === 'bag' || (s.k === 'hot' && P.inv.some(q => q.id === id)), bi = s.k === 'bag' ? s.i : P.inv.findIndex(q => q.id === id), hm = handMark(id);
  if (hm === 'L' || hm === 'R' || hm === '2H') h += '<button data-a="uneq" data-s="' + (hm === 'L' ? 0 : 1) + '">Unequip</button>';
  if (hm === 'B' && id !== 'tunic') h += '<button data-a="unarm">Take off</button>';
  if (inBag && bi >= 0) {
    if (it.type === 'sword' || it.type === 'torch' || it.type === 'gun' || it.type === 'shield') h += '<button data-a="eq" data-i="' + bi + '" data-s="0">Equip L</button><button data-a="eq" data-i="' + bi + '" data-s="1">Equip R</button>';
    else if (it.hands === 2) h += '<button data-a="eq" data-i="' + bi + '" data-s="1">Equip</button>';
    else if (it.type === 'armor') h += '<button data-a="eq" data-i="' + bi + '" data-s="0">Wear</button>';
    else if (it.type === 'potion') h += '<button data-a="use" data-id="' + esc(id) + '">Use</button>';
    if (it.stack && P.inv[bi] && P.inv[bi].n > 1 && s.k === 'bag') h += '<button data-a="split" data-i="' + bi + '">Split</button>';
  }
  if (s.k === 'hot') h += '<button class="dim2" data-a="unhot" data-i="' + s.i + '">Off hotbar</button>';
  else if (HOT_TYPES[it.type] && !P.hot.includes(id)) h += '<button data-a="tohot" data-id="' + esc(id) + '">To hotbar</button>';
  if (s.k === 'bag') h += '<button class="dim2" data-a="drop" data-i="' + s.i + '">Drop</button>';
  if (s.k === 'mat') h += '<button class="dim2" data-a="dropmat" data-id="' + esc(id) + '">Drop 1</button>';
  return h + '</div>';
}
function invHTML() {
  hotClean();
  const arm = ITEMS[P.armor];
  let h = '<div class="hdr"><b>INVENTORY</b><span class="hgold">$' + P.gold + '</span><button class="x" data-a="close">✕</button></div>';
  h += '<div class="invtop"><div class="eqbox"><div class="lab">EQUIPPED</div><div class="eqrow">' + slotHTML('eq', 0, 'L') + slotHTML('eq', 1, 'R') + slotHTML('eq', 2, 'Body') + '</div></div>';
  h += '<div class="stats">HP <b>' + Math.ceil(P.hp) + '/' + P.maxHp + '</b> · LV <b>' + P.level + '</b> <span class="dim">(XP ' + P.xp + '/' + xpNext() + ')</span><br>Armour <b>' + Math.round(arm.def * 100) + '%</b> · Speed <b>' + Math.round(arm.slow * 100) + '%</b> · Damage <b>×' + dmgMult().toFixed(2) + '</b>' + (mainItem() ? '<br>Weapon: ' + nameHTML(mainItem()) : '<br><span class="dim">Bare fists · 3-hit takedown</span>') + '</div></div>';
  h += '<div class="sec">HOTBAR <span class="hint">' + (IS_TOUCH ? 'tap a slot in play · swipe the bar' : 'keys 1-8 · mouse wheel') + '</span></div><div class="grid g8">';
  for (let i = 0; i < HOT_N; i++) h += slotHTML('hot', i);
  h += '</div><div class="sec">BAG <span class="hint">' + P.inv.length + '/' + INV_MAX + '</span></div><div class="grid g10">';
  for (let i = 0; i < INV_MAX; i++) h += slotHTML('bag', i);
  h += '</div><div class="sec">MATERIALS</div>' + pouchHTML();
  h += '<div class="detail">' + detailHTML() + '</div>';
  h += '<div class="foot"><button data-a="close" class="big">Back to the field</button></div>';
  return h;
}
function invRender() { if (typeof document !== 'undefined' && $('invPanel')) $('invPanel').innerHTML = invHTML(); }
function openInv() { S.mode = 'inv'; clearInputs(); INV.sel = null; invRender(); show('inv', true); }
function closeInv() { S.mode = 'play'; show('inv', false); invDragEnd(); }
// moving an item from one slot to another (drag and drop, or tap-to-select then tap-to-place)
function invDrop(src, dst) {
  if (!src || !dst || (src.k === dst.k && src.i === dst.i)) return false;
  const so = itemAt(src.k, src.i); if (!so) return false;
  const id = so.id, it = ITEMS[id];
  const nope = t => { sfx('nope'); if (t) msg(t, '#ff9a7a', 2.5); return false; };
  if (src.k === 'mat') return dst.k === 'hot' ? nope('Materials live in the pouch.') : false;
  if (dst.k === 'hot') {
    if (src.k === 'hot') { const t = P.hot[dst.i]; P.hot[dst.i] = P.hot[src.i]; P.hot[src.i] = t; if (P.hotSel === src.i) P.hotSel = dst.i; else if (P.hotSel === dst.i) P.hotSel = src.i; }
    else { if (!HOT_TYPES[it.type] && it.type !== 'armor') return nope(it.name + " can't go on the hotbar."); const k = P.hot.indexOf(id); if (k >= 0) P.hot[k] = P.hot[dst.i]; P.hot[dst.i] = id; }
    sfx('equip'); return true;
  }
  if (dst.k === 'bag') {
    if (src.k === 'bag') {
      if (dst.i >= P.inv.length) { const [q] = P.inv.splice(src.i, 1); P.inv.push(q); }
      else { const a = P.inv[src.i], b = P.inv[dst.i]; if (a.id === b.id && ITEMS[a.id].stack) { b.n += a.n; P.inv.splice(src.i, 1); } else { P.inv[src.i] = b; P.inv[dst.i] = a; } }
      sfx('equip'); return true;
    }
    if (src.k === 'hot') { P.hot[src.i] = null; sfx('equip'); return true; }
    if (src.k === 'eq') {
      if (src.i === 2) { if (P.armor === 'tunic') return nope(); if (P.inv.length >= INV_MAX) return nope('Your bag is full.'); giveOrDrop(P.armor); P.armor = 'tunic'; sfx('equip'); return true; }
      if (P.inv.length >= INV_MAX) return nope('Your bag is full.');
      unequipHand(twoHanded() ? 1 : src.i); P.act = null; sfx('equip');
      if (dst.i < P.inv.length - 1) { const q = P.inv.pop(); P.inv.splice(dst.i, 0, q); }
      return true;
    }
    return false;
  }
  if (dst.k === 'eq') {
    if (src.k === 'eq') {
      if (src.i === 2 || dst.i === 2 || twoHanded()) return nope();
      const t = P.hands[0]; P.hands[0] = P.hands[1]; P.hands[1] = t; P.act = null; sfx('equip'); return true;
    }
    if (dst.i === 2) { if (it.type !== 'armor') return nope('Only armour goes on the body.'); }
    else if (!(it.type === 'sword' || it.type === 'sword2' || it.type === 'bow' || it.type === 'shield' || it.type === 'torch' || it.type === 'gun')) return nope(it.name + ' is not held in the hand.');
    let idx = src.k === 'bag' ? src.i : P.inv.findIndex(q => q.id === id);
    if (idx < 0) { // a hotbar item already in the other hand: swap hands
      if (dst.i < 2 && !twoHanded() && P.hands[1 - dst.i] === id) { const t = P.hands[0]; P.hands[0] = P.hands[1]; P.hands[1] = t; sfx('equip'); return true; }
      return false;
    }
    equipFromInv(idx, dst.i === 2 ? 0 : it.hands === 2 ? 1 : dst.i);
    return true;
  }
  return false;
}
function invTap(k, i) {
  const o = itemAt(k, i), s = INV.sel;
  if (!s) { if (o) INV.sel = { k, i }; return; }
  if (s.k === k && s.i === i) { INV.sel = null; return; }
  const placeable = !o || k === 'eq' || (k === 'hot' && s.k !== 'hot') || (k === 'bag' && s.k !== 'bag' && s.k !== 'mat');
  if (placeable && s.k !== 'mat' && invDrop(s, { k, i })) { INV.sel = null; return; }
  INV.sel = o ? { k, i } : null;
}
function invAct(a, d) {
  if (a === 'eq') { equipFromInv(+d.i, +d.s); INV.sel = null; }
  else if (a === 'uneq') { unequipHand(+d.s); INV.sel = null; }
  else if (a === 'unarm') { if (P.armor !== 'tunic') { giveOrDrop(P.armor); P.armor = 'tunic'; sfx('equip'); } INV.sel = null; }
  else if (a === 'use') useConsumable(d.id);
  else if (a === 'drink') drinkPotion();
  else if (a === 'split') { const q = P.inv[+d.i]; if (q && q.n > 1 && P.inv.length < INV_MAX) { const h = Math.floor(q.n / 2); q.n -= h; P.inv.push({ id: q.id, n: h }); sfx('equip'); } else sfx('nope'); }
  else if (a === 'tohot') { if (!hotAuto(d.id)) { P.hot[P.hotSel] = d.id; } sfx('equip'); }
  else if (a === 'unhot') { P.hot[+d.i] = null; INV.sel = null; }
  else if (a === 'drop') { const q = P.inv[+d.i]; if (q) { P.inv.splice(+d.i, 1); dropItem(P.x + Math.cos(P.a) * 1.5, P.y + Math.sin(P.a) * 1.5, q.id, q.n, true); sfx('equip'); hotClean(); } INV.sel = null; }
  else if (a === 'dropmat') { if (invTake(d.id, 1)) dropItem(P.x + Math.cos(P.a) * 1.5, P.y + Math.sin(P.a) * 1.5, d.id, 1, true); if (!invCount(d.id)) INV.sel = null; }
}
function invClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'close') { closeInv(); return; }
  invAct(a, b.dataset);
  invRender();
}
// pointer drag and drop (mouse and touch); a press without movement is a tap
function invDragEnd() { const g = typeof document !== 'undefined' && document.getElementById ? document.getElementById('dragGhost') : null; if (g && g.remove) g.remove(); INV.drag = null; }
function invPointerDown(e) {
  const sl = e.target.closest && e.target.closest('.sl'); if (!sl) return;
  INV.drag = { k: sl.dataset.k, i: +sl.dataset.i, x0: e.clientX, y0: e.clientY, pid: e.pointerId, on: false, el: sl, hov: null };
  e.preventDefault();
}
function invPointerMove(e) {
  const D = INV.drag; if (!D || e.pointerId !== D.pid) return;
  if (!D.on) {
    if (Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 7 || !itemAt(D.k, D.i) || D.k === 'mat') return;
    D.on = true; D.el.classList.add('lift');
    const g = document.createElement('div'); g.id = 'dragGhost'; g.className = 'ghost'; g.innerHTML = thumbImg(itemAt(D.k, D.i).id); document.body.appendChild(g);
  }
  const g = document.getElementById('dragGhost'); if (g) g.style.transform = 'translate(' + (e.clientX - 30) + 'px,' + (e.clientY - 30) + 'px)';
  const t = document.elementFromPoint(e.clientX, e.clientY), sl = t && t.closest ? t.closest('.sl') : null;
  if (D.hov && D.hov !== sl) D.hov.classList.remove('hov');
  if (sl && sl !== D.el) sl.classList.add('hov'); D.hov = sl;
}
function invPointerUp(e) {
  const D = INV.drag; if (!D || e.pointerId !== D.pid) return;
  if (D.on) {
    const t = document.elementFromPoint(e.clientX, e.clientY), sl = t && t.closest ? t.closest('.sl') : null;
    invDragEnd();
    if (sl) { if (invDrop({ k: D.k, i: D.i }, { k: sl.dataset.k, i: +sl.dataset.i })) INV.sel = null; }
  } else { invDragEnd(); invTap(D.k, D.i); }
  invRender();
}

// ---------- forge (blacksmith) and workbench (campfire) ----------
const FORGE = { ref: null, st: 'smith', tab: 'craft', mg: null, res: null, cat: null };
function forgeTitle() { const v = FORGE.ref && FORGE.ref.village; return FORGE.st === 'camp' ? 'CAMPFIRE WORKBENCH' : (v && v.name ? 'THE ' + v.name.toUpperCase() + ' FORGE' : 'THE FORGE'); }
function openForge(ref, st) { FORGE.ref = ref; FORGE.st = st || 'smith'; FORGE.tab = 'craft'; FORGE.mg = null; FORGE.res = null; S.mode = 'forge'; clearInputs(); forgeRender(); show('forge', true); }
function closeForge() { if (FORGE.mg && !FORGE.mg.m.done) FORGE.mg = null; S.mode = 'play'; show('forge', false); saveGame(); }
function forgeRender() { if (typeof document !== 'undefined' && $('forgePanel')) $('forgePanel').innerHTML = forgeHTML(); }
function shortStat(it) { const r = statRows(it); return r.length ? r.slice(0, 2).map(x => x[0] + ' ' + x[1] + x[2]).join(' · ') : itemDesc(it); }
function forgeHTML() {
  const F = FORGE, smith = F.st === 'smith';
  let h = '<div class="hdr"><b>' + esc(forgeTitle()) + '</b><span class="hgold">$' + P.gold + '</span><button class="x" data-a="close">✕</button></div>';
  if (F.mg) return h + mgHTML();
  if (F.res) return h + resHTML();
  const tabs = smith ? [['craft', 'Craft'], ['upgrade', 'Upgrade'], ['temper', 'Temper'], ['salvage', 'Salvage'], ['orders', 'Orders']] : [['craft', 'Craft']];
  h += '<div class="tabs">' + tabs.map(t => '<button data-a="tab" data-t="' + t[0] + '" class="' + (F.tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'orders' && smithBiz().turnin.length ? ' <span class="gold">?</span>' : '') + '</button>').join('') + (smith ? '<button data-a="trade" class="alt">Trade</button>' : '<button data-a="rest" class="alt">Rest</button>') + '</div>';
  h += '<div class="pouchbar">' + (Object.keys(P.mats).length ? Object.keys(P.mats).map(k => '<span class="chip own" title="' + esc(ITEMS[k].name) + '">' + thumbImg(k, 'sm') + '<b>' + P.mats[k] + '</b></span>').join('') : '<span class="dim">Your material pouch is empty.</span>') + '</div>';
  if (F.tab === 'craft') {
    let cat = '';
    for (const r of RECIPES) {
      if (r.st !== F.st) continue;
      if (r.cat !== cat) { cat = r.cat; h += '<div class="sec">' + esc(cat.toUpperCase()) + '</div>'; }
      const it = ITEMS[r.id], ok = canCraft(r);
      h += '<div class="row rec' + (ok ? '' : ' no') + '">' + thumbImg(r.id) + '<span class="nm">' + nameHTML(it) + (r.n > 1 ? ' ×' + r.n : '') + '<br><span class="dim">' + esc(shortStat(it)) + '</span><br>' + matChips(r.mats) + (r.gold ? ' <span class="gp' + (P.gold >= r.gold ? '' : ' short') + '">$' + r.gold + '</span>' : '') + '</span><span class="bt"><button data-a="craft" data-r="' + r.key + '"' + (ok ? '' : ' disabled') + '>' + (r.mg ? 'Forge' : 'Make') + '</button></span></div>';
    }
  } else if (F.tab === 'upgrade') {
    const own = forgeOwned(id => UPG_TYPES[ITEMS[id].type]);
    h += '<div class="dim pad">Each level adds damage, block or armour. +4 and +5 need silver and ghost essence. A clean hammer rhythm can raise the quality too.</div>';
    if (!own.length) h += '<div class="dim pad">Nothing to upgrade.</div>';
    for (const id of own) {
      const it = ITEMS[id];
      if (!upgradable(id)) { h += '<div class="row rec no">' + thumbImg(id) + '<span class="nm">' + nameHTML(it) + '<br><span class="dim">At its finest: +5.</span></span></div>'; continue; }
      const c = upgradeCost(id), v = parseVid(id), nx = ITEMS[makeVid(v.base, c.lvl, v.temper, v.q)], ok = haveMats(c.mats, c.gold);
      const a = statRows(it)[0], b = statRows(nx)[0];
      h += '<div class="row rec' + (ok ? '' : ' no') + '">' + thumbImg(id) + '<span class="nm">' + nameHTML(it) + (handMark(id) ? ' <span class="eqd">' + handMark(id) + '</span>' : '') + '<br><span class="dim">' + (a ? a[0] + ' ' + a[1] + a[2] + ' → </span><b class="up">' + b[1] + b[2] + '</b>' : '</span>') + '<br>' + matChips(c.mats) + ' <span class="gp' + (P.gold >= c.gold ? '' : ' short') + '">$' + c.gold + '</span></span><span class="bt"><button data-a="upg" data-id="' + esc(id) + '"' + (ok ? '' : ' disabled') + '>+' + c.lvl + '</button></span></div>';
    }
  } else if (F.tab === 'temper') {
    h += '<div class="dim pad">Temper a blade with special materials. <span style="color:' + TEMPER.s.col + '">Silvered</span>: ' + TEMPER.s.desc + '. <span style="color:' + TEMPER.f.col + '">Frost-tempered</span>: ' + TEMPER.f.desc + '.</div>';
    const own = forgeOwned(id => canTemper(id));
    if (!own.length) h += '<div class="dim pad">You carry no sword to temper.</div>';
    for (const id of own) {
      const it = ITEMS[id], v = parseVid(id);
      h += '<div class="row rec">' + thumbImg(id) + '<span class="nm">' + nameHTML(it) + '<br>' + ['s', 'f'].map(t => '<span class="tline">' + matChips(TEMPER_COST[t].mats) + ' <span class="gp">$' + TEMPER_COST[t].gold + '</span></span>').join(' ') + '</span><span class="bt col">' +
        ['s', 'f'].map(t => '<button data-a="temper" data-id="' + esc(id) + '" data-t="' + t + '"' + (v.temper !== t && haveMats(TEMPER_COST[t].mats, TEMPER_COST[t].gold) ? '' : ' disabled') + '>' + (t === 's' ? 'Silver' : 'Frost') + '</button>').join('') + '</span></div>';
    }
  } else if (F.tab === 'salvage') {
    h += '<div class="dim pad">Break down gear from your bag into materials (equipped items must be unequipped first).</div>';
    let any = false;
    P.inv.forEach((q, i) => { const y = salvageYield(q.id); if (!y) return; any = true; const it = ITEMS[q.id]; h += '<div class="row rec">' + thumbImg(q.id) + '<span class="nm">' + nameHTML(it) + '<br>' + yieldChips(y) + '</span><span class="bt"><button class="dim2" data-a="salv" data-i="' + i + '">Salvage</button></span></div>'; });
    if (!any) h += '<div class="dim pad">Nothing in your bag can be salvaged.</div>';
  } else if (F.tab === 'orders') {
    const b = smithBiz(), act = S.Q.act.filter(q => q.type === 'order' && q.giver && FORGE.ref && q.giver.key === giverKey(FORGE.ref));
    if (!act.length && !b.offers.length) h += '<div class="dim pad">"No orders today. Come back after you\'ve done me a good turn elsewhere."</div>';
    for (const q of act) { const st = qStep(q), ok = st && haveMats(st.need); h += '<div class="row rec' + (ok ? '' : ' no') + '"><span class="nm"><b class="inm">' + esc(q.title) + '</b><br><span class="dim">' + esc(q.sum || '') + '</span><br>' + matChips(st.need) + rewHTML(q) + '</span><span class="bt"><button data-a="deliver" data-q="' + esc(q.id) + '"' + (ok ? '' : ' disabled') + '>Deliver</button></span></div>'; }
    b.offers.forEach((q, i) => { h += '<div class="row rec"><span class="nm"><b class="inm">' + esc(q.title) + '</b><br><span class="dim">' + esc((q.lines || []).join(' ')) + '</span><br>' + matChips(q.steps[0].need) + rewHTML(q) + '</span><span class="bt"><button data-a="accept" data-i="' + i + '">Accept</button></span></div>'; });
  }
  h += '<div class="foot"><button data-a="close" class="big">Leave</button></div>';
  return h;
}
function rewHTML(q) { const r = q.rew || {}; return '<div class="rew">Reward: <span class="gold">' + (r.gold || 0) + ' gold</span> · ' + (r.xp || 0) + ' XP' + (r.items || []).filter(id => id[0] !== '$').map(id => ' · ' + thumbImg(id, 'sm') + '<span style="color:' + tierCol(ITEMS[id]) + '">' + esc(ITEMS[id].name) + '</span>').join('') + '</div>'; }
function smithBiz() { return FORGE.ref && FORGE.ref.kind === 'smith' && S.Q ? npcBusiness(FORGE.ref) : { turnin: [], offers: [] }; }
function forgeOwned(f) { const out = []; for (const id of [P.hands[1], P.hands[0], P.armor].concat(P.inv.map(q => q.id))) if (id && ITEMS[id] && f(id) && !out.includes(id)) out.push(id); return out; }
// the hammer minigame
function forgeJob(job) {
  if (job.mg) { FORGE.mg = { job, m: mgNew(job) }; forgeRender(); sfx('anvil'); return; }
  forgeFinish(job, 0);
}
function forgeFinish(job, grade) {
  let id = null;
  if (job.k === 'craft') id = craftItem(job.r, grade);
  else if (job.k === 'upg') id = upgradeItem(job.id, grade);
  else if (job.k === 'temper') id = temperItem(job.id, job.t, grade);
  FORGE.mg = null;
  if (!id) { msg('You lack the materials for that.', '#ff9a7a'); forgeRender(); return null; }
  const it = ITEMS[id];
  if (job.mg) { FORGE.res = { id, grade }; sfx(grade === 2 ? 'win' : 'pickup'); }
  else { msg('Made ' + ((job.r && job.r.n) > 1 ? job.r.n + ' ' : '') + it.name + '.', '#d8e8b0', 3, id); sfx('anvil'); }
  forgeRender(); return id;
}
function mgHTML() {
  const { job, m } = FORGE.mg, id = job.k === 'craft' ? job.r.id : job.id, it = ITEMS[id];
  let h = '<div class="mg"><div class="mgh">' + thumbImg(id, 'big') + '<div><div class="sub">' + (job.k === 'craft' ? 'Forging' : job.k === 'upg' ? 'Upgrading' : 'Tempering') + '</div>' + nameHTML(it) + '<div class="dim">Strike when the glowing marker crosses the bright mark. Three strikes; a clean rhythm makes finer work.</div></div></div>';
  h += '<canvas id="mgcv" width="560" height="128"></canvas>';
  h += '<div class="pips">' + [0, 1, 2].map(i => '<span class="pip' + (i < m.res.length ? (m.res[i] >= 1 ? ' p' : m.res[i] >= 0.6 ? ' g' : m.res[i] > 0 ? ' f' : ' m') : '') + '"></span>').join('') + '</div>';
  h += '<div class="foot"><button data-a="strike" class="big strike">STRIKE</button><div class="dim">' + (IS_TOUCH ? 'tap STRIKE or the bar' : 'Space / J / click') + '</div><button data-a="mgcancel" class="dim2">Stop</button></div></div>';
  return h;
}
function resHTML() {
  const r = FORGE.res, it = ITEMS[r.id];
  return '<div class="mg res"><div class="sub">' + (r.grade === 2 ? 'A MASTERWORK!' : r.grade === 1 ? 'Fine work' : 'Done') + '</div>' + thumbImg(r.id, 'huge') + '<div>' + nameHTML(it) + '</div><div class="dim">' + esc(shortStat(it)) + '</div><div class="foot"><button data-a="resok" class="big">Continue</button></div></div>';
}
function drawMG() {
  if (typeof document === 'undefined' || !FORGE.mg) return;
  const cv = $('mgcv'); if (!cv || !cv.getContext) return;
  const x = cv.getContext('2d'), m = FORGE.mg.m, W = cv.width, H = cv.height, bx = 20, bw = W - 40, by = 46, bh = 30;
  if (!x || typeof x.fillRect !== 'function') return;
  x.clearRect(0, 0, W, H);
  // the hot iron bar
  const g = x.createLinearGradient ? x.createLinearGradient(bx, 0, bx + bw, 0) : null;
  if (g) { g.addColorStop(0, '#3a1608'); g.addColorStop(0.5, '#a8401a'); g.addColorStop(1, '#3a1608'); x.fillStyle = g; } else x.fillStyle = '#7a3010';
  x.fillRect(bx, by, bw, bh);
  // good / perfect zones
  const zx = bx + m.zone * bw;
  x.fillStyle = 'rgba(255,200,90,0.32)'; x.fillRect(zx - MG.good * bw, by, MG.good * 2 * bw, bh);
  x.fillStyle = 'rgba(255,240,170,0.85)'; x.fillRect(zx - MG.perfect * bw, by - 4, MG.perfect * 2 * bw, bh + 8);
  x.strokeStyle = '#1a0e06'; x.lineWidth = 2; x.strokeRect(bx, by, bw, bh);
  // the hammer marker
  const mx = bx + m.pos * bw;
  x.fillStyle = '#fff8e0'; x.beginPath(); x.moveTo(mx, by - 2); x.lineTo(mx - 9, by - 18); x.lineTo(mx + 9, by - 18); x.closePath(); x.fill();
  x.fillRect(mx - 2, by - 2, 4, bh + 4);
  x.fillStyle = '#e8dcc0'; x.font = 'bold 17px ui-monospace,monospace'; x.textAlign = 'center';
  x.fillText('Strike ' + Math.min(m.i + 1, MG.strikes) + ' of ' + MG.strikes, W / 2, 20);
  if (m.fb && m.fbT > 0) { x.globalAlpha = clamp(m.fbT / 0.4, 0, 1); x.font = 'bold 26px Georgia,serif'; x.fillStyle = m.fb === 'PERFECT!' ? '#ffe070' : m.fb === 'GOOD' ? '#a8f080' : m.fb === 'FAIR' ? '#e8c8a0' : '#ff7a5a'; x.fillText(m.fb, W / 2, by + bh + 38); x.globalAlpha = 1; }
}
function forgeTick(dt) {
  const F = FORGE; if (!F.mg) return;
  mgTick(F.mg.m, dt);
  if (F.mg.m.done) { F.mg.m.doneT = (F.mg.m.doneT || 0) + dt; if (F.mg.m.doneT > 0.45) { const g = forgeGrade(F.mg.m.res).grade; forgeFinish(F.mg.job, g); return; } }
  drawMG();
}
function forgeStrike() {
  const F = FORGE; if (!F.mg || F.mg.m.done) return;
  mgStrike(F.mg.m); S.shake = 0;
  forgeRender(); drawMG();
}
function forgeAct(a, d) {
  const F = FORGE;
  if (a === 'tab') { F.tab = d.t; }
  else if (a === 'trade') { const r = F.ref; closeForge(); openShop(r); return; }
  else if (a === 'rest') { closeForge(); rest(); return; }
  else if (a === 'craft') { const r = RECIPES.find(x => x.key === d.r); if (r && canCraft(r)) forgeJob({ k: 'craft', r, mg: !!r.mg }); return; }
  else if (a === 'upg') { forgeJob({ k: 'upg', id: d.id, mg: true }); return; }
  else if (a === 'temper') { forgeJob({ k: 'temper', id: d.id, t: d.t, mg: true }); return; }
  else if (a === 'salv') { const y = salvageBag(+d.i); if (y) { sfx('anvil_bad'); msg('Salvaged: ' + matsLine(y), '#d8e8b0', 3, Object.keys(y)[0]); } }
  else if (a === 'strike') { forgeStrike(); return; }
  else if (a === 'mgcancel') { F.mg = null; }
  else if (a === 'resok') { F.res = null; }
  else if (a === 'accept') { const q = smithBiz().offers[+d.i]; if (q) acceptQuest(q); }
  else if (a === 'deliver') { const q = qById(d.q); if (q) deliverOrder(q); }
  forgeRender();
}
function forgeClick(e) {
  const b = e.target.closest('button');
  if (!b) { if (e.target.id === 'mgcv') forgeStrike(); return; }
  if (b.disabled) return;
  const a = b.dataset.a;
  if (a === 'close') { closeForge(); return; }
  forgeAct(a, b.dataset);
}
