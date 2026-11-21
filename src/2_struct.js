// =====================================================================
//  STRUCTURES — wall colliders, enterable buildings, villages, castles
//  (pure data: no GL here, so the node tests can use all of it)
// =====================================================================
const BT = 0.26, BSTUB = 0.5;           // wall thickness, cutaway stub height (the meshes split their walls here)
const COL_MAXR = 4.45;                  // collider pieces stay below MAXR so the grid query always finds them

// ---------- local frames: game heading rot; local +z faces rot, local +x faces rot - 90° ----------
function xform(x, y, rot) { return { x, y, rot, s: Math.sin(rot), c: Math.cos(rot) }; }
function l2w(T, lx, lz) { return [T.x + lx * T.s + lz * T.c, T.y - lx * T.c + lz * T.s]; }
function w2l(T, x, y) { const dx = x - T.x, dy = y - T.y; return [dx * T.s - dy * T.c, dx * T.c + dy * T.s]; }
function d2w(T, dx, dz) { return [dx * T.s + dz * T.c, -dx * T.c + dz * T.s]; }
function headingOf(T, dx, dz) { const d = d2w(T, dx, dz); return Math.atan2(d[1], d[0]); }

// ---------- collider maths (circle = default static, seg = capsule wall, obox = oriented box) ----------
function segQ(s, x, y) { const ax = s[0], ay = s[1], dx = s[2] - ax, dy = s[3] - ay, L2 = dx * dx + dy * dy || 1e-9; let t = ((x - ax) * dx + (y - ay) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t; return [ax + dx * t, ay + dy * t, t]; }
function boxL(b, x, y) { const dx = x - b[0], dy = y - b[1]; return [dx * b[2] + dy * b[3], -dx * b[3] + dy * b[2]]; }
function hitCol(o, x, y, r) {
  if (o.seg) { const q = segQ(o.seg, x, y), ex = x - q[0], ey = y - q[1], rs = r + o.seg[4]; return ex * ex + ey * ey < rs * rs; }
  if (o.obox) { const b = o.obox, l = boxL(b, x, y), ex = l[0] - clamp(l[0], -b[4], b[4]), ey = l[1] - clamp(l[1], -b[5], b[5]); return ex * ex + ey * ey < r * r; }
  const dx = x - o.x, dy = y - o.y, rs = r + o.r; return dx * dx + dy * dy < rs * rs;
}
// proper segment intersection (p0-p1 vs q0-q1)
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}
// does the segment a-b pass through the box [-hx,hx]x[-hz,hz] (local coords)? (Liang-Barsky)
function segHitsRect(ax, az, bx, bz, hx, hz) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
  const clip = (p, q) => { if (Math.abs(p) < 1e-9) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  return clip(-dx, ax + hx) && clip(dx, hx - ax) && clip(-dz, az + hz) && clip(dz, hz - az) && t1 > t0;
}
function lineHitsCol(o, ax, ay, bx, by) {
  if (o.seg) { const s = o.seg; return segCross(ax, ay, bx, by, s[0], s[1], s[2], s[3]); }
  if (o.obox) { const b = o.obox, p = boxL(b, ax, ay), q = boxL(b, bx, by); return segHitsRect(p[0], p[1], q[0], q[1], b[4], b[5]); }
  return false;
}
// push an entity out of a collider; px/py = where it stood before this step (stops tunnelling through thin walls)
function pushCol(e, o, r, px, py) {
  if (o.seg) {
    const s = o.seg, ax = s[0], ay = s[1], dx = s[2] - ax, dy = s[3] - ay, L = Math.hypot(dx, dy) || 1e-6, rs = r + s[4];
    if (px !== undefined) {
      const s0 = (px - ax) * dy - (py - ay) * dx, s1 = (e.x - ax) * dy - (e.y - ay) * dx;
      if (s0 !== 0 && (s0 > 0) !== (s1 > 0)) {
        const k = s0 / (s0 - s1), X = px + (e.x - px) * k, Y = py + (e.y - py) * k, tw = ((X - ax) * dx + (Y - ay) * dy) / (L * L);
        if (tw > 0 && tw < 1) {
          const sg = s0 > 0 ? 1 : -1, nx = dy / L * sg, ny = -dx / L * sg, along = ((e.x - ax) * dx + (e.y - ay) * dy) / L;
          e.x = ax + dx / L * along + nx * (rs + 0.001); e.y = ay + dy / L * along + ny * (rs + 0.001); return true;
        }
      }
    }
    const q = segQ(s, e.x, e.y), ex = e.x - q[0], ey = e.y - q[1], d2 = ex * ex + ey * ey;
    if (d2 >= rs * rs) return false;
    const d = Math.sqrt(d2);
    if (d < 1e-5) { e.x += dy / L * rs; e.y -= dx / L * rs; return true; }
    e.x = q[0] + ex / d * rs; e.y = q[1] + ey / d * rs; return true;
  }
  if (o.obox) {
    const b = o.obox, hx = b[4], hy = b[5], l = boxL(b, e.x, e.y); let lx = l[0], ly = l[1];
    if (Math.abs(lx) < hx && Math.abs(ly) < hy) {
      let ox = hx - Math.abs(lx), oy = hy - Math.abs(ly), sx = lx >= 0 ? 1 : -1, sy = ly >= 0 ? 1 : -1;
      if (px !== undefined) { const pl = boxL(b, px, py); if (Math.abs(pl[0]) >= hx && Math.abs(pl[1]) < hy) { oy = 1e9; sx = pl[0] >= 0 ? 1 : -1; } else if (Math.abs(pl[1]) >= hy && Math.abs(pl[0]) < hx) { ox = 1e9; sy = pl[1] >= 0 ? 1 : -1; } }
      if (ox < oy) lx = sx * (hx + r); else ly = sy * (hy + r);
    } else {
      const qx = clamp(lx, -hx, hx), qy = clamp(ly, -hy, hy), ex = lx - qx, ey = ly - qy, d2 = ex * ex + ey * ey;
      if (d2 >= r * r) return false;
      const d = Math.sqrt(d2) || 1e-4; lx = qx + ex / d * r; ly = qy + ey / d * r;
    }
    e.x = b[0] + lx * b[2] - ly * b[3]; e.y = b[1] + lx * b[3] + ly * b[2]; return true;
  }
  const dx = e.x - o.x, dy = e.y - o.y, rs = r + o.r, d2 = dx * dx + dy * dy;
  if (d2 >= rs * rs) return false;
  const d = Math.sqrt(d2) || 0.01, p = rs - d; e.x += dx / d * p; e.y += dy / d * p; return true;
}
// is a wall / solid between two points? (low fences, trees and rocks don't count)
function losBlocked(ax, ay, bx, by, minH) {
  const mh = minH === undefined ? 1.3 : minH;
  return forStatics((ax + bx) / 2, (ay + by) / 2, Math.hypot(bx - ax, by - ay) / 2 + 0.2, o => o.block && (o.seg || o.obox) && o.h >= mh && lineHitsCol(o, ax, ay, bx, by));
}
// how far can something of radius r travel from (x, y) along (dx, dy) before a wall? (for lunges and throws)
function rayFree(x, y, dx, dy, len, r) {
  let ok = 0;
  for (let s = 0.25; s <= len + 1e-6; s += 0.25) { if (blockedAt(x + dx * s, y + dy * s, r)) break; ok = s; }
  return Math.min(ok, len);
}

// convert local collider specs into world statics: ['circ', x, z, r, h] | ['seg', x0, z0, x1, z1, t, h] | ['box', x, z, hx, hz, rot, h]
function collidersTo(T, list, out) {
  for (const cl of list) {
    if (cl[0] === 'circ') { const p = l2w(T, cl[1], cl[2]); out.push({ type: 'col', x: p[0], y: p[1], r: cl[3], h: cl[4], block: true }); }
    else if (cl[0] === 'seg') {
      const t = cl[5], h = cl[6], a = l2w(T, cl[1], cl[2]), b = l2w(T, cl[3], cl[4]), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(L / (2 * (COL_MAXR - t))));
      for (let i = 0; i < n; i++) {
        const x0 = lerp(a[0], b[0], i / n), y0 = lerp(a[1], b[1], i / n), x1 = lerp(a[0], b[0], (i + 1) / n), y1 = lerp(a[1], b[1], (i + 1) / n);
        out.push({ type: 'col', x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: L / n / 2 + t, h, block: true, seg: [x0, y0, x1, y1, t] });
      }
    } else if (cl[0] === 'box') {
      const cx = cl[1], cz = cl[2], hx = cl[3], hz = cl[4], r = cl[5] || 0, h = cl[6];
      const ax = d2w(T, Math.cos(r), -Math.sin(r));
      const longX = hx >= hz, Lh = longX ? hx : hz, Sh = longX ? hz : hx;
      const n = Math.max(1, Math.ceil(Lh / Math.sqrt(Math.max(0.04, COL_MAXR * COL_MAXR - Sh * Sh))));
      for (let i = 0; i < n; i++) {
        const off = -Lh + Lh * (2 * i + 1) / n;
        const lc = longX ? [cx + Math.cos(r) * off, cz - Math.sin(r) * off] : [cx + Math.sin(r) * off, cz + Math.cos(r) * off];
        const p = l2w(T, lc[0], lc[1]), phx = longX ? hx / n : hx, phz = longX ? hz : hz / n;
        out.push({ type: 'col', x: p[0], y: p[1], r: Math.hypot(phx, phz), h, block: true, obox: [p[0], p[1], ax[0], ax[1], phx, phz] });
      }
    }
  }
  return out;
}

// ---------- structures: footprints used by the cutaway, interiors, interaction and enemy navigation ----------
let STRUCT_ID = 1;
// o: { kind, hx, hz, stub, wallH, margin, band, skipOcc, roof, doors: [{ side, c, w, dep }] }
function mkStruct(T, o) {
  const s = Object.assign({ id: STRUCT_ID++, x: T.x, y: T.y, rot: T.rot, s: T.s, c: T.c, parent: null, gy: undefined, lights: [] }, o);
  s.doors = (o.doors || []).map(d => {
    const dep = d.dep || 1.5; let cx, cz, nx, nz;
    switch (d.side) {
      case 'f': cx = d.c; cz = s.hz; nx = 0; nz = -1; break;
      case 'b': cx = d.c; cz = -s.hz; nx = 0; nz = 1; break;
      case 'l': cx = -s.hx; cz = d.c; nx = 1; nz = 0; break;
      default: cx = s.hx; cz = d.c; nx = -1; nz = 0;
    }
    const w = l2w(s, cx, cz), i = l2w(s, cx + nx * dep, cz + nz * dep), ou = l2w(s, cx - nx * dep, cz - nz * dep);
    return { x: w[0], y: w[1], ix: i[0], iy: i[1], ox: ou[0], oy: ou[1], w: d.w };
  });
  // world AABB (+ margin) for chunk registration
  const ex = Math.abs(s.hx * s.s) + Math.abs(s.hz * s.c) + (s.margin || 1), ey = Math.abs(s.hx * s.c) + Math.abs(s.hz * s.s) + (s.margin || 1);
  s.aabb = [s.x - ex, s.y - ey, s.x + ex, s.y + ey];
  return s;
}
function structContains(s, x, y) { const l = w2l(s, x, y); return Math.abs(l[0]) < s.hx && Math.abs(l[1]) < s.hz; }
// innermost structure at a point (only loaded chunks know their structures)
function structAt(x, y) {
  const c = CHUNKS.get(Math.floor(x / CS) + ',' + Math.floor(y / CS));
  if (!c || !c.structs || !c.structs.length) return null;
  let best = null;
  for (const s of c.structs) if (structContains(s, x, y) && (!best || s.parent === best)) best = s;
  return best;
}
const bldAt = (x, y) => { const s = structAt(x, y); return s && s.roof ? s : null; };
function castleAt(x, y) { let s = structAt(x, y); while (s && s.kind !== 'court') s = s.parent; return s ? s.castle : null; }
function structOverlapsChunk(s, cx, cy) { const x0 = cx * CS, y0 = cy * CS; return s.aabb[2] > x0 && s.aabb[0] < x0 + CS && s.aabb[3] > y0 && s.aabb[1] < y0 + CS; }

// ---------- navigation: doors and detours for enemies moving between inside and outside ----------
function bestDoor(s, tx, ty, fx, fy) {
  let best = null, bd = 1e9;
  for (const d of s.doors) { const k = Math.hypot(d.ox - tx, d.oy - ty) + Math.hypot(d.ix - fx, d.iy - fy) * 0.5; if (k < bd) { bd = k; best = d; } }
  return best;
}
// step through a doorway: aim for the near side first, then the far side once lined up in the gap
function throughDoor(e, d, exiting) {
  const ax = exiting ? d.ix : d.ox, ay = exiting ? d.iy : d.oy, bx = exiting ? d.ox : d.ix, by = exiting ? d.oy : d.iy;
  const ux = bx - ax, uy = by - ay, L2 = ux * ux + uy * uy || 1, t = ((e.x - ax) * ux + (e.y - ay) * uy) / L2;
  const lat = Math.abs((e.x - ax) * uy - (e.y - ay) * ux) / Math.sqrt(L2);
  if ((t > -0.15 && lat < 0.55) || Math.hypot(e.x - ax, e.y - ay) < 0.7) return [bx, by];
  return [ax, ay];
}
// route around a rectangular footprint (local frame) when the straight line would cut through it
function routeAround(s, ex, ey, gx, gy, pad) {
  // paths are tested against the real footprint (+ a little clearance); detour corners sit further out
  const a = w2l(s, ex, ey), g = w2l(s, gx, gy), hx = s.hx + pad, hz = s.hz + pad, ix = s.hx + 0.25, iz = s.hz + 0.25;
  if (Math.abs(a[0]) < ix && Math.abs(a[1]) < iz) return null;
  if (!segHitsRect(a[0], a[1], g[0], g[1], ix, iz)) return null;
  const C = [[hx, hz], [-hx, hz], [-hx, -hz], [hx, -hz]], ok = (p, q) => !segHitsRect(p[0], p[1], q[0], q[1], ix, iz);
  let best = null, bl = 1e9;
  for (let i = 0; i < 4; i++) {
    const c = C[i];
    if (ok(a, c) && ok(c, g)) { const l = Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(g[0] - c[0], g[1] - c[1]); if (l < bl) { bl = l; best = c; } }
    for (const j of [(i + 1) % 4, (i + 3) % 4]) {
      const c2 = C[j];
      if (ok(a, c) && ok(c, c2) && ok(c2, g)) { const l = Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(c2[0] - c[0], c2[1] - c[1]) + Math.hypot(g[0] - c2[0], g[1] - c2[1]); if (l < bl) { bl = l; best = c; } }
    }
  }
  return best ? l2w(s, best[0], best[1]) : null;
}
// waypoint for an entity at e heading to (tx, ty), or null to go straight
function navPoint(e, tx, ty) {
  const se = structAt(e.x, e.y), st = structAt(tx, ty);
  if (se === st) return se ? null : detourOutside(e, tx, ty);
  if (se && !structContains(se, tx, ty)) { const d = bestDoor(se, tx, ty, e.x, e.y); return d ? throughDoor(e, d, true) : null; }
  let s = st; while (s && s.parent && !structContains(s.parent, e.x, e.y)) s = s.parent;
  if (!s) return null;
  const d = bestDoor(s, e.x, e.y, tx, ty); if (!d) return null;
  if (!structContains(s, e.x, e.y) && Math.hypot(e.x - d.ox, e.y - d.oy) > 1.2) { const r = routeAround(s, e.x, e.y, d.ox, d.oy, (e.r || 0.5) + 0.9); if (r) return r; }
  return throughDoor(e, d, false);
}
// both outside: walk around any structure in the way
function detourOutside(e, tx, ty) {
  const c = CHUNKS.get(Math.floor(e.x / CS) + ',' + Math.floor(e.y / CS)); if (!c || !c.structs) return null;
  let best = null, bd = 1e9;
  for (const s of c.structs) {
    if (s.parent) continue;
    const dd = Math.hypot(s.x - e.x, s.y - e.y); if (dd > Math.max(s.hx, s.hz) + 14 || dd > bd) continue;
    const r = routeAround(s, e.x, e.y, tx, ty, (e.r || 0.5) + 0.7); if (r) { bd = dd; best = r; }
  }
  return best;
}

// =====================================================================
//  BUILDING SPECS — one source of truth for meshes (3_arch.js) and colliders
//  local frame: front (door side) = +z, width W along x, depth D along z
// =====================================================================
// furniture colliders (item-local, then rotated by the item's r); draw functions are attached in 3_arch.js
const FURN = {
  table: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 0.8]] },
  rtable: { col: it => [['circ', 0, 0, it.rad || 0.55, 0.8]] },
  stool: { col: () => [] }, bench: { col: it => [['box', 0, 0, it.w / 2, 0.2, 0, 0.45]] },
  bed: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 0.7]] }, chest: { col: () => [['box', 0, 0, 0.45, 0.28, 0, 0.6]] },
  shelf: { col: it => [['box', 0, 0, it.w / 2, 0.2, 0, 1.9]] }, cupboard: { col: it => [['box', 0, 0, it.w / 2, 0.3, 0, 2.0]] },
  barrel: { col: () => [['circ', 0, 0, 0.36, 0.95]] }, qbarrel: { col: () => [['circ', 0, 0, 0.36, 0.8]] }, crate: { col: () => [['box', 0, 0, 0.36, 0.36, 0, 0.75]] },
  sacks: { col: () => [['circ', 0, 0, 0.45, 0.6]] },
  hearth: { col: it => [['box', 0, 0, it.w / 2, 0.45, 0, 1.4]] }, counter: { col: it => [['box', 0, 0, it.w / 2, 0.32, 0, 1.05]] },
  kegs: { col: it => [['box', 0, 0, it.w / 2, 0.4, 0, 1.4]] }, stairs: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 2.6]] },
  forge: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 1.0]] }, anvil: { col: () => [['circ', 0, 0, 0.38, 0.8]] },
  wrack: { col: it => [['box', 0, 0, it.w / 2, 0.18, 0, 1.8]] }, astand: { col: () => [['circ', 0, 0, 0.32, 1.8]] }, grind: { col: () => [['circ', 0, 0, 0.42, 0.9]] },
  pew: { col: it => [['box', 0, 0, it.w / 2, 0.24, 0, 0.9]] }, altar: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 1.0]] },
  hay: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, it.h || 1]] }, stall: { col: it => [['box', 0, 0, 0.07, it.len / 2, 0, 1.3]] },
  cart: { col: () => [['box', 0, 0, 0.75, 1.25, 0, 1.0]] },
  rug: { col: () => [] }, carpet: { col: () => [] }, lantern: { col: () => [] }, sign: { col: () => [] }, cross: { col: () => [] }, banner: { col: () => [] },
  pillar: { col: () => [['circ', 0, 0, 0.5, 6]] }, brazier: { col: () => [['circ', 0, 0, 0.4, 1.3]] },
  dais: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 0.35]] }, throne: { col: () => [] },
  longtable: { col: it => [['box', 0, 0, it.w / 2, it.d / 2, 0, 0.85]] }, dummy: { col: () => [['circ', 0, 0, 0.3, 1.8]] },
  target: { col: () => [['box', 0, 0, 0.65, 0.18, 0, 1.8]] }, rubble: { col: it => [['circ', 0, 0, it.rad || 0.8, 0.9]] }
};
function furnCols(list) {
  const out = [];
  for (const it of list) {
    const F = FURN[it.f]; if (!F) continue;
    const r = it.r || 0, c = Math.cos(r), s = Math.sin(r);
    for (const cl of F.col(it)) {
      // item-local -> building-local (MB.ry convention: x' = c x + s z, z' = -s x + c z)
      const tx = (x, z) => [it.x + c * x + s * z, it.z - s * x + c * z];
      if (cl[0] === 'circ') { const p = tx(cl[1], cl[2]); out.push(['circ', p[0], p[1], cl[3], cl[4]]); }
      else if (cl[0] === 'box') { const p = tx(cl[1], cl[2]); out.push(['box', p[0], p[1], cl[3], cl[4], r + (cl[5] || 0), cl[6]]); }
    }
  }
  return out;
}
const HALF = Math.PI / 2;
const BLD = {
  cottage: { W: 6.4, D: 5.0, H: 2.7, rh: 2.1, label: null, doors: [{ side: 'f', c: -1.0, w: 1.5 }],
    wins: [{ side: 'f', c: 1.4 }, { side: 'b', c: 0.6 }, { side: 'r', c: 0.9 }], chim: { side: 'l', c: -0.2 },
    furn: [{ f: 'hearth', x: -2.49, z: -0.2, r: HALF, w: 1.6 }, { f: 'bed', x: 2.24, z: -1.24, w: 1.3, d: 2.0, col: '#8a3a30' }, { f: 'chest', x: 2.24, z: 0.2 },
      { f: 'rug', x: 0.2, z: -0.4, w: 2.4, d: 1.7, col: '#7a4a38' }, { f: 'table', x: 0.2, z: -0.5, w: 1.2, d: 0.8 }, { f: 'stool', x: -0.7, z: -0.5 }, { f: 'stool', x: 0.2, z: 0.35 },
      { f: 'shelf', x: -1.6, z: -2.04, w: 1.4 }, { f: 'barrel', x: -2.5, z: 1.75 }, { f: 'crate', x: 2.5, z: 1.8, r: 0.3 }],
    lights: [[-1.7, -0.2, 0.8, 7.5, [1.0, 0.5, 0.22], 0.8, 1], [1.4, 3.6, 1.4, 4, [1.0, 0.72, 0.4], 0.3, 0]] },
  house2: { W: 7.0, D: 5.6, H: 2.9, H2: 2.5, rh: 2.3, label: null, doors: [{ side: 'f', c: 1.4, w: 1.5 }],
    wins: [{ side: 'f', c: -1.6 }, { side: 'b', c: 2.6 }, { side: 'l', c: 0.8 }], chim: { side: 'r', c: -0.6 },
    furn: [{ f: 'hearth', x: 2.79, z: -0.6, r: -HALF, w: 1.6 }, { f: 'stairs', x: -2.06, z: -2.09, w: 2.3, d: 0.9, dir: -1 },
      { f: 'rug', x: -0.2, z: 0.2, w: 2.8, d: 2.2, col: '#3e5278' }, { f: 'table', x: -0.2, z: 0.2, w: 1.9, d: 0.8 }, { f: 'bench', x: -0.2, z: -0.48, w: 1.7 }, { f: 'bench', x: -0.2, z: 0.88, w: 1.7 },
      { f: 'cupboard', x: 1.05, z: -2.24, w: 1.2 }, { f: 'barrel', x: -2.85, z: 2.05 }, { f: 'lantern', x: -0.2, z: 0.2, y: 2.3 }],
    lights: [[2.0, -0.6, 0.8, 7.5, [1.0, 0.5, 0.22], 0.8, 1], [-1.6, 3.9, 1.4, 4, [1.0, 0.72, 0.4], 0.3, 0]] },
  tavern: { W: 11.0, D: 8.0, H: 3.0, H2: 2.6, rh: 2.8, label: 'tavern', doors: [{ side: 'f', c: 0, w: 1.9 }],
    wins: [{ side: 'f', c: -3.2 }, { side: 'f', c: 3.2 }, { side: 'l', c: 2.0 }, { side: 'r', c: 2.0 }], chim: { side: 'l', c: -0.8 },
    sign: { x: 1.7, kind: 'tankard' },
    furn: [{ f: 'counter', x: 3.1, z: -1.4, w: 4.3 }, { f: 'kegs', x: 3.0, z: -3.34, w: 3.6 }, { f: 'hearth', x: -4.79, z: -0.8, r: HALF, w: 2.2 },
      { f: 'stairs', x: -2.0, z: -3.29, w: 2.6, d: 0.9, dir: -1 },
      { f: 'rtable', x: -2.6, z: 1.7 }, { f: 'stool', x: -1.8, z: 1.7 }, { f: 'stool', x: -3.0, z: 2.4 }, { f: 'stool', x: -3.0, z: 1.0 },
      { f: 'rtable', x: -2.3, z: -1.3 }, { f: 'stool', x: -1.5, z: -1.3 }, { f: 'stool', x: -2.7, z: -0.6 }, { f: 'stool', x: -2.7, z: -2.0 },
      { f: 'rtable', x: 1.9, z: 1.8 }, { f: 'stool', x: 1.1, z: 1.8 }, { f: 'stool', x: 2.3, z: 2.5 }, { f: 'stool', x: 2.3, z: 1.1 },
      { f: 'rtable', x: 4.2, z: 1.2 }, { f: 'stool', x: 4.2, z: 2.0 }, { f: 'stool', x: 4.2, z: 0.4 },
      { f: 'stool', x: 1.6, z: -0.7 }, { f: 'stool', x: 2.6, z: -0.7 }, { f: 'stool', x: 3.6, z: -0.7 },
      { f: 'lantern', x: -1.0, z: 0.2, y: 2.4 }, { f: 'lantern', x: 2.6, z: 0.3, y: 2.4 }, { f: 'rug', x: -0.2, z: 0.4, w: 3.0, d: 4.0, col: '#6a3a2e' }],
    npcs: [{ kind: 'innkeeper', x: 3.0, z: -2.45, a: [0, 1] }],
    lights: [[-3.9, -0.8, 0.9, 9, [1.0, 0.5, 0.2], 0.9, 1], [2.6, 0.3, 2.2, 5.5, [1.0, 0.75, 0.45], 0.35, 1], [0, 5.2, 1.6, 5, [1.0, 0.72, 0.4], 0.35, 0]] },
  smithy: { W: 8.0, D: 6.5, H: 2.9, rh: 2.2, stoneTo: 1.0, label: 'smithy', doors: [{ side: 'f', c: -1.4, w: 3.0 }],
    wins: [{ side: 'f', c: 2.3, w: 1.3 }, { side: 'r', c: -0.6 }], chim: { side: 'b', c: -2.3, inner: true },
    sign: { x: 1.0, kind: 'anvil' },
    furn: [{ f: 'forge', x: -2.3, z: -2.44, w: 2.2, d: 1.1 }, { f: 'anvil', x: -1.5, z: -0.7 }, { f: 'qbarrel', x: -3.3, z: -0.8 }, { f: 'grind', x: 0.4, z: -2.4 },
      { f: 'wrack', x: 2.3, z: -2.81, w: 2.4 }, { f: 'astand', x: 2.7, z: -0.4 }, { f: 'table', x: 3.34, z: 1.5, w: 0.8, d: 1.8 }, { f: 'crate', x: -3.3, z: 1.2 }, { f: 'sacks', x: -3.2, z: 2.3 }],
    npcs: [{ kind: 'smith', x: -0.7, z: -1.3, a: [0.3, 1] }],
    lights: [[-2.3, -1.7, 1.0, 7.5, [1.0, 0.42, 0.12], 0.75, 1], [-1.4, 4.6, 1.5, 4.5, [1.0, 0.55, 0.25], 0.35, 0]] },
  shop: { W: 6.6, D: 5.2, H: 2.7, rh: 2.0, label: 'shop', doors: [{ side: 'f', c: 1.75, w: 1.4 }],
    wins: [{ side: 'f', c: -1.2, w: 2.2, y0: 0.9 }, { side: 'l', c: 0.0 }], chim: null, sign: { x: 0.3, kind: 'pouch' },
    furn: [{ f: 'counter', x: -1.0, z: -0.4, w: 3.8 }, { f: 'shelf', x: -1.5, z: -2.14, w: 2.6 }, { f: 'shelf', x: 1.6, z: -2.14, w: 2.4 },
      { f: 'barrel', x: 2.6, z: -1.4 }, { f: 'crate', x: 2.6, z: 0.4 }, { f: 'sacks', x: -2.55, z: 1.75 }, { f: 'rug', x: 0.6, z: 1.0, w: 2.0, d: 1.6, col: '#4e6a3e' }, { f: 'lantern', x: -0.5, z: -0.9, y: 2.2 }],
    npcs: [{ kind: 'merchant', x: -1.0, z: -1.35, a: [0, 1] }],
    lights: [[-0.5, -0.9, 2.0, 5.5, [1.0, 0.75, 0.45], 0.35, 1], [-1.2, 3.8, 1.4, 4, [1.0, 0.72, 0.4], 0.3, 0]] },
  chapel: { W: 6.0, D: 11.0, H: 3.6, rh: 3.0, label: 'chapel', Wsp: 11.0, margin: 2.8, stoneWalls: true, stoneTo: 0.6, doors: [{ side: 'f', c: 0, w: 1.6 }],
    wins: [{ side: 'l', c: 3, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 }, { side: 'l', c: 0, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 }, { side: 'l', c: -3, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 },
      { side: 'r', c: 3, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 }, { side: 'r', c: 0, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 }, { side: 'r', c: -3, w: 0.7, y0: 1.3, y1: 3.0, glass: 1 }],
    chim: null, tower: { x: -4.2, z: 4.3, w: 2.4, h: 7.4 },
    furn: [{ f: 'carpet', x: 0, z: 0.2, w: 1.1, d: 9.6, col: '#7a2e2a' },
      { f: 'pew', x: -1.5, z: 2.8, w: 2.1 }, { f: 'pew', x: 1.5, z: 2.8, w: 2.1 }, { f: 'pew', x: -1.5, z: 1.3, w: 2.1 }, { f: 'pew', x: 1.5, z: 1.3, w: 2.1 },
      { f: 'pew', x: -1.5, z: -0.2, w: 2.1 }, { f: 'pew', x: 1.5, z: -0.2, w: 2.1 }, { f: 'pew', x: -1.5, z: -1.7, w: 2.1 }, { f: 'pew', x: 1.5, z: -1.7, w: 2.1 },
      { f: 'altar', x: 0, z: -4.3, w: 1.9, d: 0.8 }, { f: 'cross', x: 0, z: -5.18 }],
    extraCols: [['box', -4.2, 4.3, 1.2, 1.2, 0, 10]],
    npcs: [{ kind: 'priest', x: 0, z: -3.4, a: [0, 1] }],
    lights: [[0, -4.0, 1.5, 6, [1.0, 0.78, 0.45], 0.45, 1], [0, 6.6, 1.6, 4, [1.0, 0.72, 0.4], 0.25, 0]] },
  barn: { W: 8.0, D: 6.4, H: 3.2, rh: 2.6, plank: true, label: 'barn', doors: [{ side: 'f', c: 0, w: 3.4 }],
    wins: [{ side: 'l', c: 0, w: 0.8 }, { side: 'r', c: 0, w: 0.8 }], chim: null,
    furn: [{ f: 'hay', x: -2.6, z: -2.3, w: 2.1, d: 1.2, h: 1.5 }, { f: 'hay', x: -0.9, z: -2.4, w: 1.1, d: 1.0, h: 0.75 }, { f: 'stall', x: 1.2, z: -2.0, len: 1.9 }, { f: 'stall', x: 2.6, z: -2.0, len: 1.9 },
      { f: 'cart', x: -2.3, z: 1.2, r: 0.4 }, { f: 'hay', x: 3.0, z: 1.9, w: 1.0, d: 1.0, h: 0.6 }, { f: 'barrel', x: 3.25, z: -0.3 }],
    lights: [] }
};
// walls -> capsule segments along each wall's centre line, split at doorways (shortened so the round ends meet the jambs)
function wallCols(B, H) {
  const out = [], W2 = B.W / 2 - BT / 2, D2 = B.D / 2 - BT / 2, t = BT / 2, h = H || B.H + 1.4;
  const side = (sd, a0, a1, fixed) => {
    const ds = B.doors.filter(d => d.side === sd).map(d => [d.c - d.w / 2 - t, d.c + d.w / 2 + t]).sort((p, q) => p[0] - q[0]);
    let u = a0;
    const emit = (u0, u1) => { if (u1 - u0 < 0.05) return; if (sd === 'f' || sd === 'b') out.push(['seg', u0, fixed, u1, fixed, t, h]); else out.push(['seg', fixed, u0, fixed, u1, t, h]); };
    for (const [g0, g1] of ds) { emit(u, g0); u = g1; }
    emit(u, a1);
  };
  side('f', -W2, W2, D2); side('b', -W2, W2, -D2); side('l', -D2, D2, -W2); side('r', -D2, D2, W2);
  return out;
}
for (const k in BLD) {
  const B = BLD[k]; B.type = k;
  for (const w of B.wins) { w.w = w.w || 1.0; w.y0 = w.y0 || 1.05; w.y1 = w.y1 || 1.95; }
  B.cols = wallCols(B).concat(furnCols(B.furn), B.extraCols || []);
  if (B.chim && !B.chim.inner) { const c = B.chim; if (c.side === 'l') B.cols.push(['box', -B.W / 2 - 0.3, c.c, 0.32, 0.5, 0, 6]); else if (c.side === 'r') B.cols.push(['box', B.W / 2 + 0.3, c.c, 0.32, 0.5, 0, 6]); }
}

// =====================================================================
//  VILLAGE LAYOUT — a ring of enterable buildings around the square
// =====================================================================
const INN_NAMES = ['The Red Stag', 'The Crossed Keys', 'The Black Boar', 'The Drowned Lamb', 'The Crown & Anchor', 'The Green Man', 'The Old Bell', 'The Hart & Hound', 'The Rook\'s Rest', 'The Wheatsheaf'];
function bldVariant(v) { return v.b === B_SNOW ? 'snow' : v.b === B_DESERT ? 'sand' : ''; }
function placeBuilding(L, type, vs, x, y, rot, v) {
  const B = BLD[type], T = xform(x, y, rot);
  const name = type === 'tavern' ? INN_NAMES[(v.seed >>> 3) % INN_NAMES.length] : type === 'smithy' ? 'The ' + v.name + ' forge' : type === 'shop' ? v.name + ' general goods' : type === 'chapel' ? 'Chapel of ' + v.name : type === 'barn' ? 'Barn' : null;
  const s = mkStruct(T, { kind: 'bld', type, hx: B.W / 2, hz: B.D / 2, stub: BSTUB, wallH: B.H, margin: B.margin || 1.0, band: 0.75, skipOcc: 1, roof: true, name, doors: B.doors.map(d => Object.assign({ dep: 1.3 }, d)), village: v });
  L.structs.push(s);
  let chim = null;
  if (B.chim) {
    const c = B.chim, lp = c.inner ? [c.c, -B.D / 2 + 0.55] : c.side === 'l' ? [-B.W / 2 - 0.3, c.c] : c.side === 'r' ? [B.W / 2 + 0.3, c.c] : [c.c, -B.D / 2 - 0.3];
    const p = l2w(T, lp[0], lp[1]); chim = [p[0], p[1], (B.H2 ? B.H + B.H2 : B.H) + B.rh + 0.7];
  }
  L.parts.push({ type: 'bld', x, y, rot, r: Math.hypot(B.W, B.D) / 2, h: B.H + B.rh, block: false, mesh: 'b_' + type + (vs ? '_' + vs : ''), yo: 0, occ: Math.max(B.W, B.D) / 2 + 0.6, chim, struct: s });
  collidersTo(T, B.cols, L.parts);
  for (const l of B.lights) { const p = l2w(T, l[0], l[1]); const li = { x: p[0], y: p[1], h: l[2], r: l[3], c: l[4], k: l[5], s: l[6] ? s : null, night: true }; L.lights.push(li); if (l[6]) s.lights.push(li); }
  for (const n of (B.npcs || [])) { const p = l2w(T, n.x, n.z); L.npcs.push({ kind: n.kind, x: p[0], y: p[1], a: headingOf(T, n.a[0], n.a[1]), struct: s }); }
  return s;
}
function villageLayout(v) {
  if (v.L) return v.L;
  const R = mulberry((v.seed ^ 0x6a11) | 0), L = { parts: [], structs: [], npcs: [], lights: [], paths: [], farm: null };
  const vs = bldVariant(v);
  const list = ['tavern', 'smithy', 'shop'];
  if (v.id === '0,0' || R() < 0.65) list.push('chapel');
  const homes = Math.max(2, (v.nh || 4) - 2);
  for (let i = 0; i < homes; i++) list.push(R() < 0.4 ? 'house2' : 'cottage');
  for (let i = list.length - 1; i > 1; i--) { const j = 1 + Math.floor(R() * i); const tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
  const gapH = 0.5, avail = TAU - 2 * gapH, SPC = 2.4;
  const aw = (t, r0) => 2 * Math.atan(((BLD[t].Wsp || BLD[t].W) / 2 + SPC / 2) / r0);
  let R0 = 12.5;
  while (list.reduce((s, t) => s + aw(t, R0), 0) > avail && R0 < 24) R0 += 0.5;
  const slack = (avail - list.reduce((s, t) => s + aw(t, R0), 0)) / list.length;
  let a = v.gap + gapH;
  const placed = [];
  for (const t of list) {
    const w = aw(t, R0) + slack, ac = a + w / 2; a += w;
    const B = BLD[t], rr0 = R0 + B.D / 2 + (t === 'chapel' ? -0.5 : 0);
    const s = placeBuilding(L, t, vs, v.x + Math.cos(ac) * rr0, v.y + Math.sin(ac) * rr0, ac + Math.PI, v);
    placed.push(s);
    // barrels and crates by the doors of the tavern and the smithy
    if (t === 'tavern' || t === 'smithy') for (const sx of [-1, 1]) {
      const p = l2w(s, sx * (B.W / 2 - 0.7), B.D / 2 + 1.35);
      L.parts.push({ type: sx > 0 ? 'barrel' : 'crate', x: p[0], y: p[1], rot: ac + sx, r: 0.38, h: 0.9, block: true });
    }
  }
  L.R0 = R0;
  // square: campfire, well, lamp posts, guards at the road
  L.parts.push({ type: 'fire', x: v.x, y: v.y, r: 0.6, h: 1.0, block: true, village: v });
  L.lights.push({ x: v.x, y: v.y, h: 1.0, r: 8, c: [1.0, 0.6, 0.26], k: 0.55, base: 0.1, flick: true, night: true });
  const wa = v.gap + Math.PI + 0.75, wp = [v.x + Math.cos(wa) * 4.6, v.y + Math.sin(wa) * 4.6];
  L.parts.push({ type: 'well', x: wp[0], y: wp[1], r: 0.9, h: 1.6, block: true });
  for (const k of [-1, 1]) {
    const la = v.gap + k * (gapH - 0.08), lr = R0 - 1.4, lp = [v.x + Math.cos(la) * lr, v.y + Math.sin(la) * lr];
    L.parts.push({ type: 'lamp', x: lp[0], y: lp[1], r: 0.2, h: 2.7, block: true, rot: la + Math.PI });
    L.lights.push({ x: lp[0], y: lp[1], h: 2.4, r: 6.5, c: [1.0, 0.7, 0.38], k: 0.5, night: true });
  }
  for (const k of [0.25, 0.5, 0.75]) {
    const la = v.gap + Math.PI + (k - 0.5) * 3.4, lr = 8.4, lp = [v.x + Math.cos(la) * lr, v.y + Math.sin(la) * lr];
    L.parts.push({ type: 'lamp', x: lp[0], y: lp[1], r: 0.2, h: 2.7, block: true, rot: la });
    L.lights.push({ x: lp[0], y: lp[1], h: 2.4, r: 6.5, c: [1.0, 0.7, 0.38], k: 0.45, night: true });
  }
  for (let i = 0; i < 2; i++) { const ga = v.gap + (i ? 0.33 : -0.33), gr = R0 - 0.5; L.npcs.push({ kind: 'guard', x: v.x + Math.cos(ga) * gr, y: v.y + Math.sin(ga) * gr, a: v.gap, post: true }); }
  // a few villagers about the square
  L.npcs.push({ kind: 'villager', x: v.x + Math.cos(v.gap + 2.2) * 6, y: v.y + Math.sin(v.gap + 2.2) * 6, a: v.gap + 2.2 + Math.PI });
  // fields and a barn
  if (v.farm) {
    let fa = v.farmA; if (Math.abs(angDiff(fa, v.gap)) < 1.0) fa += 1.7;
    L.farm = { a: fa, r0: R0 + 9, r1: R0 + 17, hw: 0.38 };
    const F = L.farm, fen = (ax, ay, bx, by, gap) => {
      const L0 = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L0 / 3)), th = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i < n; i++) {
        if (gap && n >= 3 && i === Math.floor(n / 2)) continue; // a gap to walk into the field
        const x0 = lerp(ax, bx, i / n), y0 = lerp(ay, by, i / n), x1 = lerp(ax, bx, (i + 1) / n), y1 = lerp(ay, by, (i + 1) / n);
        L.parts.push({ type: 'fence', x: (x0 + x1) / 2, y: (y0 + y1) / 2, rot: th + HALF, sc: Math.hypot(x1 - x0, y1 - y0) / 3, r: Math.hypot(x1 - x0, y1 - y0) / 2 + 0.1, h: 1.0, block: true, seg: [x0, y0, x1, y1, 0.08], yo: -0.02 });
      }
    };
    const P2 = (ang, rad) => [v.x + Math.cos(ang) * rad, v.y + Math.sin(ang) * rad];
    const steps = 6; let prev = P2(F.a - F.hw, F.r1 + 0.6);
    for (let i = 1; i <= steps; i++) { const p = P2(F.a - F.hw + 2 * F.hw * i / steps, F.r1 + 0.6); fen(prev[0], prev[1], p[0], p[1], false); prev = p; }
    for (const sg of [-1, 1]) { const p0 = P2(F.a + sg * F.hw, F.r0 - 0.4), p1 = P2(F.a + sg * F.hw, F.r1 + 0.6); fen(p0[0], p0[1], p1[0], p1[1], sg > 0); }
    // barn beside the field, unless something is in the way
    const ba = F.a + F.hw + 0.42, br = F.r0 + 1.5, bp = P2(ba, br);
    if (placed.every(s => Math.hypot(s.x - bp[0], s.y - bp[1]) > Math.hypot(s.hx, s.hz) + 5.3)) placeBuilding(L, 'barn', vs, bp[0], bp[1], ba + Math.PI, v);
  }
  for (const s of L.structs) for (const d of s.doors) L.paths.push([d.ox, d.oy, v.x, v.y]);
  L.road = [v.x + Math.cos(v.gap) * 4, v.y + Math.sin(v.gap) * 4, v.x + Math.cos(v.gap) * 40, v.y + Math.sin(v.gap) * 40];
  v.L = L;
  return L;
}

// =====================================================================
//  CASTLES — rare deterministic landmarks: one try per 12x12-chunk region
// =====================================================================
const CREG = 12 * CS, CASC = new Map();
const CAS_A = ['Raven', 'Iron', 'Black', 'Grey', 'Storm', 'Wolf', 'Dragon', 'High', 'Thorn', 'Eagle', 'Stag', 'Frost', 'Ash', 'Red', 'White', 'Hawk', 'Crow', 'Bleak', 'Dun', 'Wyvern'];
const CAS_B = ['hold', 'keep', 'gard', 'mont', 'spire', 'watch', 'crag', 'fell', 'moor', 'stone', 'helm', 'wall'];
const CAS_S = 34, CAS_T = 2.6, CAS_WH = 9.5, CAS_STUB = 2.2;
function castleFor(rx, ry) {
  const key = rx + ',' + ry;
  if (CASC.has(key)) return CASC.get(key);
  const R = mulberry((Math.imul(rx, 48271) ^ Math.imul(ry, 69621) ^ 0x0ca571e) | 0);
  let cs = null;
  for (let tr = 0; tr < 28 && !cs; tr++) {
    const x = rx * CREG + 92 + R() * (CREG - 184), y = ry * CREG + 92 + R() * (CREG - 184);
    if (Math.hypot(x, y) < 190) continue;
    const b = biomeAt(x, y); if (b !== B_PLAINS && b !== B_HEATH && b !== B_SNOW) continue;
    let ok = true;
    for (let j = -4; j <= 4 && ok; j++) for (let i = -4; i <= 4 && ok; i++) {
      const sx = x + i * 11.5, sy = y + j * 11.5, bb = biomeAt(sx, sy);
      if (isWet(tileBase(sx, sy)) || bb === B_SWAMP || bb === B_DESERT) ok = false;
    }
    if (!ok) continue;
    const ccx = Math.floor(x / CS), ccy = Math.floor(y / CS);
    for (let j = -4; j <= 4 && ok; j++) for (let i = -4; i <= 4 && ok; i++) { const v = villageFor(ccx + i, ccy + j); if (v && Math.hypot(v.x - x, v.y - y) < 95) ok = false; }
    if (!ok) continue;
    const kind = (b === B_SNOW || b === B_HEATH) && R() < 0.42 ? 'ruin' : R() < 0.45 ? 'royal' : 'usurper';
    const nm = CAS_A[(R() * CAS_A.length) | 0] + CAS_B[(R() * CAS_B.length) | 0];
    const rot = Math.floor(R() * 4) * HALF;
    cs = { id: 'K' + key, rx, ry, x, y, b, kind, rot, s: Math.sin(rot), c: Math.cos(rot), seed: (R() * 1e9) | 0, snow: b === B_SNOW,
      name: kind === 'ruin' ? 'Ruins of ' + nm : nm + ' Castle', short: nm, gh: Math.max(0.3, heightBase(x, y)) };
    cs.D = Math.hypot(x, y) / 320;
    cs.ckey = Math.floor(x / CS) + ',' + Math.floor(y / CS);
  }
  CASC.set(key, cs);
  return cs;
}
function castlesNear(x, y, rad) {
  const out = [];
  for (let ry = Math.floor((y - rad) / CREG); ry <= Math.floor((y + rad) / CREG); ry++) for (let rx = Math.floor((x - rad) / CREG); rx <= Math.floor((x + rad) / CREG); rx++) {
    const cs = castleFor(rx, ry); if (cs && Math.abs(cs.x - x) < rad + 50 && Math.abs(cs.y - y) < rad + 50) out.push(cs);
  }
  return out;
}
// the castle whose flattened ground covers (x, y) — castles sit >= 92 from region borders, so one lookup is enough
function castleGround(x, y) {
  const cs = castleFor(Math.floor(x / CREG), Math.floor(y / CREG));
  return cs && Math.abs(x - cs.x) < 76 && Math.abs(y - cs.y) < 76 ? cs : null;
}
function nearestCastle(x, y, maxR) {
  let best = null, bd = maxR || 1e9;
  for (const cs of castlesNear(x, y, maxR || 800)) { const d = Math.hypot(cs.x - x, cs.y - y); if (d < bd) { bd = d; best = cs; } }
  return best;
}
// inside the walls (plus a margin) of any castle? used to keep random spawns and vegetation out
function inCastleArea(x, y, pad) {
  const cs = castleGround(x, y); if (!cs) return null;
  const l = w2l(cs, x, y), m = CAS_S + (pad || 0);
  return Math.abs(l[0]) < m && Math.abs(l[1]) < m ? cs : null;
}

// ---------- castle plan (local coords; gate at +z). Shared by colliders, meshes and spawns ----------
function castlePlan(cs) {
  if (cs.P) return cs.P;
  const R = mulberry(cs.seed ^ 0x77), ruin = cs.kind === 'ruin', S = CAS_S, T = CAS_T, cl = S - T / 2;
  const P = { walls: [], towers: [], gate: { hw: 2.5, tx: 4.6, thx: 2.1, tz: S + 0.2, thz: 3.2, h: 13 }, keep: { x: 0, z: -6, hx: 11, hz: 8, H: 5.0, top: 15, tr: 1.9 },
    cols: [], parts: [], structs: [], lights: [], npcs: [], posts: [], chests: [], breaches: [], items: [] };
  // curtain walls: pieces along each side's centre line
  const sides = [['f', -cl, cl], ['b', -cl, cl], ['l', -cl, cl], ['r', -cl, cl]];
  for (const [sd, a0, a1] of sides) {
    const n = Math.ceil((a1 - a0) / 6.4);
    for (let i = 0; i < n; i++) {
      let u0 = a0 + (a1 - a0) * i / n, u1 = a0 + (a1 - a0) * (i + 1) / n;
      if (sd === 'f') { const gx = P.gate.tx + P.gate.thx; if (u1 > -gx && u0 < gx) { if (u0 < -gx) u1 = -gx; else if (u1 > gx) u0 = gx; else continue; } }
      let h = CAS_WH;
      if (ruin) { const r = R(); h = i === 0 || i === n - 1 ? 5 + R() * 3 : r < 0.18 ? 0 : r < 0.5 ? 2 + R() * 3 : 5 + R() * 4; if (sd === 'f' && Math.abs(u0 + u1) < 18) h = Math.max(h, 4); }
      P.walls.push({ side: sd, u0, u1, h });
    }
  }
  // breaches in ruined walls become extra doorways for navigation
  for (const w of P.walls) if (w.h <= 0.01) P.breaches.push({ side: w.side, c: (w.u0 + w.u1) / 2, w: w.u1 - w.u0 - T, dep: 3 });
  // towers: four round corners, square towers mid-side on l / r / b
  const crn = [[-cl, cl], [cl, cl], [cl, -cl], [-cl, -cl]];
  crn.forEach((p, i) => P.towers.push({ x: p[0], z: p[1], r: 4.4, h: ruin ? (i % 2 ? 4 + R() * 3 : 8 + R() * 4) : 14, round: true, cone: !ruin && (cs.kind === 'royal' || i % 2 === 0), broken: ruin }));
  for (const [x, z] of [[-S - 0.3, 0], [S + 0.3, 0], [0, -S - 0.3]]) P.towers.push({ x, z, hx: 2.6, hz: 2.6, h: ruin ? 3 + R() * 5 : 12, round: false, broken: ruin });
  const G = P.gate, K = P.keep;
  // colliders: wall pieces (capsules along the centre line), towers, gatehouse, keep
  const wl = (sd, u) => sd === 'f' ? [u, cl] : sd === 'b' ? [u, -cl] : sd === 'l' ? [-cl, u] : [cl, u];
  for (const w of P.walls) if (w.h > 1.2) { const a = wl(w.side, w.u0), b = wl(w.side, w.u1); P.cols.push(['seg', a[0], a[1], b[0], b[1], T / 2, w.h]); }
  for (const t of P.towers) if (t.round) P.cols.push(['circ', t.x, t.z, t.r, t.h]); else P.cols.push(['box', t.x, t.z, t.hx, t.hz, 0, t.h]);
  for (const sx of [-1, 1]) P.cols.push(['box', sx * G.tx, G.tz, G.thx, G.thz, 0, ruin ? 7 : G.h]);
  // keep walls (1.0 thick) with a door in front; turrets at the corners
  const kt = 0.5, kx = K.hx - kt, kz = K.hz - kt, kc = (x, z) => [K.x + x, K.z + z], kh = ruin ? 5 : K.top;
  const kseg = (x0, z0, x1, z1) => { const a = kc(x0, z0), b = kc(x1, z1); P.cols.push(['seg', a[0], a[1], b[0], b[1], kt, kh]); };
  kseg(-kx, kz, -1.3 - kt, kz); kseg(1.3 + kt, kz, kx, kz); kseg(-kx, -kz, kx, -kz); kseg(-kx, -kz, -kx, kz); kseg(kx, -kz, kx, kz);
  for (const [x, z] of [[-K.hx, K.hz], [K.hx, K.hz], [K.hx, -K.hz], [-K.hx, -K.hz]]) { const p = kc(x, z); P.cols.push(['circ', p[0], p[1], K.tr, kh + 4]); }
  // great hall furnishings (castle-local)
  const hall = [];
  if (!ruin) {
    hall.push({ f: 'carpet', x: 0, z: -6.2, w: 2.0, d: 13.8, col: cs.kind === 'royal' ? '#2e4478' : '#7a2420' });
    hall.push({ f: 'longtable', x: 0, z: -5.8, w: 1.5, d: 7.6 }, { f: 'bench', x: -1.15, z: -5.8, w: 7.0, r: HALF }, { f: 'bench', x: 1.15, z: -5.8, w: 7.0, r: HALF });
    hall.push({ f: 'dais', x: 0, z: -12.2, w: 4.6, d: 2.0 }, { f: 'throne', x: 0, z: -12.5 });
    for (const sx of [-1, 1]) for (const z of [-1.2, -6.2, -11.2]) hall.push({ f: 'pillar', x: sx * 5.2, z });
    for (const sx of [-1, 1]) for (const z of [-2.5, -10.2]) hall.push({ f: 'brazier', x: sx * 7.8, z });
    hall.push({ f: 'banner', x: -3.4, z: -13.42, col: cs.kind === 'royal' ? '#2e4a8a' : '#8a2a24' }, { f: 'banner', x: 3.4, z: -13.42, col: cs.kind === 'royal' ? '#2e4a8a' : '#8a2a24' });
    hall.push({ f: 'wrack', x: -10.32, z: -6.2, w: 2.4, r: HALF }, { f: 'wrack', x: 10.32, z: -9.0, w: 2.4, r: -HALF }, { f: 'barrel', x: 9.6, z: -1.0 }, { f: 'crate', x: 9.5, z: -2.2 });
  } else {
    for (const [x, z, r] of [[-6, -3, 1.0], [5, -9, 1.2], [7.5, -2, 0.8], [-8, -11, 0.9], [-2.5, -8.5, 0.7]]) hall.push({ f: 'rubble', x, z, rad: r });
    hall.push({ f: 'longtable', x: 1.0, z: -5.6, w: 1.5, d: 4.4, r: 0.25, broken: 1 });
    for (const sx of [-1, 1]) hall.push({ f: 'pillar', x: sx * 5.2, z: -6.2, broken: 1 });
  }
  P.hall = hall;
  P.cols.push(...furnCols(hall));
  // treasure: usurper strongholds and ruins keep their chests in the hall
  const nCh = cs.kind === 'usurper' ? 3 : cs.kind === 'ruin' ? 2 : 0;
  const chPos = [[-2.8, -12.4], [2.8, -12.4], [-8.6, -12.5]];
  for (let i = 0; i < nCh; i++) P.chests.push({ x: chPos[i][0], z: chPos[i][1], id: cs.id + ':c' + i, tier: clamp(Math.floor(cs.D + 0.6 + (i === 2 ? 0.6 : 0)), 0, 4) });
  // courtyard: barracks, stables, storehouse, training yard, well, banners
  const court = [];
  if (!ruin) {
    court.push({ f: 'barracks', x: -24.5, z: -16, w: 7, d: 18 }, { f: 'storehouse', x: 24.5, z: -19, w: 7, d: 10 }, { f: 'stables', x: 24.8, z: 13, w: 6.4, d: 13 });
    court.push({ f: 'yard', x: -18, z: 15, w: 12, d: 13 });
    for (const [x, z] of [[-21, 11.5], [-21, 16], [-16.5, 19.5]]) court.push({ f: 'dummy', x, z });
    court.push({ f: 'target', x: -14.5, z: 10.5, r: 0.5 }, { f: 'wrack', x: -22.6, z: 20.6, w: 2.2 });
    for (const sx of [-1, 1]) court.push({ f: 'pole', x: sx * 3.4, z: 3.4 });
    court.push({ f: 'cart', x: 9.5, z: 24, r: 0.4 }, { f: 'hay', x: 20.2, z: 8.4, w: 1.2, d: 1.2, h: 0.9 });
    court.push({ f: 'brazier', x: -4.2, z: 27.5 }, { f: 'brazier', x: 4.2, z: 27.5 });
  } else {
    court.push({ f: 'barracks', x: -24.5, z: -16, w: 7, d: 18, broken: 1 });
    for (const [x, z, r] of [[-10, 18, 1.4], [14, 9, 1.1], [18, -6, 1.6], [-16, -2, 1.2], [6, 24, 1.0], [-25, 22, 1.5]]) court.push({ f: 'rubble', x, z, rad: r });
    court.push({ f: 'cart', x: 9.5, z: 20, r: 1.9, broken: 1 });
  }
  P.court = court;
  for (const it of court) {
    if (it.f === 'barracks' || it.f === 'storehouse') { if (it.broken) { P.cols.push(['box', it.x, it.z, it.w / 2, it.d / 2, 0, 2.5]); } else P.cols.push(['box', it.x, it.z, it.w / 2, it.d / 2, 0, 6]); }
    else if (it.f === 'stables') { const x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2; P.cols.push(['seg', x1 - 0.2, z0, x1 - 0.2, z1, 0.2, 3.5], ['seg', x0 + 0.4, z0 + 0.2, x1, z0 + 0.2, 0.2, 3], ['seg', x0 + 0.4, z1 - 0.2, x1, z1 - 0.2, 0.2, 3]); for (const z of [it.z - 2.2, it.z + 2.2]) P.cols.push(['seg', x1 - 2.6, z, x1 - 0.3, z, 0.07, 1.3]); }
    else if (it.f === 'yard') {
      const x0 = it.x - it.w / 2, x1 = it.x + it.w / 2, z0 = it.z - it.d / 2, z1 = it.z + it.d / 2;
      P.fences = [[x0, z0, x1, z0], [x0, z1, x1, z1], [x0, z0, x0, z1], [x1, z0, x1, it.z - 1.6], [x1, it.z + 1.6, x1, z1]];
    }
    else if (it.f === 'pole') P.cols.push(['circ', it.x, it.z, 0.18, 6]);
    else if (FURN[it.f]) P.cols.push(...furnCols([it]));
  }
  if (!ruin) P.items.push({ type: 'well', x: 8, z: 15 });
  else { P.items.push({ type: 'well', x: 8, z: 15 }); for (const [x, z] of [[-12, 6], [15, 20], [-20, -24], [12, -25]]) P.items.push({ type: 'deadtree', x, z }); }
  // posts for garrisons and night monsters
  P.posts = [[-3.6, 26.5], [3.6, 26.5], [-8, 17], [11, 6], [-6, 4], [14, -3], [-15, -5], [3, 12], [-3, -8], [3, -8]];
  // lights: hall braziers (inside: always), gate braziers (night)
  if (!ruin) {
    for (const sx of [-1, 1]) for (const z of [-2.5, -10.2]) P.lights.push([sx * 7.8, z, 1.3, 8, [1.0, 0.5, 0.2], 0.6, 'keep']);
    for (const sx of [-1, 1]) P.lights.push([sx * 4.2, 27.5, 1.3, 8, [1.0, 0.55, 0.22], 0.55, null]);
    P.lights.push([0, 39, 4.5, 7, [1.0, 0.6, 0.3], 0.35, null]);
  }
  cs.P = P;
  return P;
}
// world-space parts / structures / lights / npcs of a castle, built once and cached
function castleWorld(cs) {
  if (cs.Wd) return cs.Wd;
  const P = castlePlan(cs), Wd = { parts: [], structs: [], lights: [], npcs: [] };
  collidersTo(cs, P.cols, Wd.parts);
  for (const f of (P.fences || [])) {
    const L0 = Math.hypot(f[2] - f[0], f[3] - f[1]), n = Math.max(1, Math.round(L0 / 3));
    for (let i = 0; i < n; i++) {
      const a = l2w(cs, lerp(f[0], f[2], i / n), lerp(f[1], f[3], i / n)), b = l2w(cs, lerp(f[0], f[2], (i + 1) / n), lerp(f[1], f[3], (i + 1) / n));
      Wd.parts.push({ type: 'fence', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, rot: Math.atan2(b[1] - a[1], b[0] - a[0]) + HALF, sc: Math.hypot(b[0] - a[0], b[1] - a[1]) / 3, r: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2 + 0.1, h: 1.0, block: true, seg: [a[0], a[1], b[0], b[1], 0.08], yo: -0.02 });
    }
  }
  for (const it of P.items) { const p = l2w(cs, it.x, it.z); Wd.parts.push(it.type === 'well' ? { type: 'well', x: p[0], y: p[1], r: 0.9, h: 1.6, block: true } : { type: it.type, x: p[0], y: p[1], r: 0.5, h: 4, block: true }); }
  if (!cs.snow && cs.kind !== 'ruin') for (const [x, z] of [[7, 26], [-6.5, 25.6], [18, -10], [-18, 4]]) { const p = l2w(cs, x, z); Wd.parts.push({ type: (x + z) % 2 ? 'barrel' : 'crate', x: p[0], y: p[1], rot: x, r: 0.38, h: 0.9, block: true }); }
  for (const c of P.chests) { const p = l2w(cs, c.x, c.z); Wd.parts.push({ type: 'chest', x: p[0], y: p[1], r: 0.6, h: 0.8, block: true, id: c.id, tier: c.tier, rot: cs.rot + Math.PI }); }
  const court = mkStruct(cs, { kind: 'court', hx: CAS_S, hz: CAS_S, stub: CAS_STUB, wallH: 999, margin: 5.6, band: 4.6, skipOcc: 0, roof: false, name: cs.name, castle: cs,
    doors: [{ side: 'f', c: 0, w: 5, dep: 5.6 }].concat(P.breaches) });
  court.gy = cs.gh;
  const kp = l2w(cs, P.keep.x, P.keep.z);
  const keep = mkStruct(xform(kp[0], kp[1], cs.rot), { kind: 'keep', hx: P.keep.hx, hz: P.keep.hz, stub: BSTUB, wallH: P.keep.H, margin: 2.8, band: 1.3, skipOcc: 1, roof: cs.kind !== 'ruin', name: cs.kind === 'ruin' ? 'the ruined keep' : 'the great hall of ' + cs.short, castle: cs,
    doors: [{ side: 'f', c: 0, w: 2.6, dep: 1.8 }] });
  keep.gy = cs.gh; keep.parent = court;
  Wd.structs.push(court, keep); Wd.court = court; Wd.keep = keep;
  for (const l of P.lights) { const p = l2w(cs, l[0], l[1]); const li = { x: p[0], y: p[1], h: l[2], r: l[3], c: l[4], k: l[5], s: l[6] === 'keep' ? keep : null, night: true, gy: cs.gh }; Wd.lights.push(li); if (li.s) keep.lights.push(li); }
  cs.Wd = Wd;
  return Wd;
}

// ---------- chunk injection: every chunk adds the parts / structures / lights that fall inside it ----------
function inChunk(c, x, y) { return Math.floor(x / CS) === c.cx && Math.floor(y / CS) === c.cy; }
function addPart(c, p) {
  c.statics.push(p);
  const lx = clamp(Math.floor((p.x - c.cx * CS) / GC), 0, 3), ly = clamp(Math.floor((p.y - c.cy * CS) / GC), 0, 3);
  c.grid[ly * 4 + lx].push(p);
}
function injectLayout(c, L) {
  for (const p of L.parts) if (inChunk(c, p.x, p.y)) addPart(c, p);
  for (const s of L.structs) if (structOverlapsChunk(s, c.cx, c.cy)) c.structs.push(s);
  for (const l of L.lights) if (inChunk(c, l.x, l.y)) c.lights.push(l);
}
