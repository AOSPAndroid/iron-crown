// =====================================================================
//  MESHES — builder, chibi characters (rigged), horse, items, toon scenery
// =====================================================================
// vertex: pos f32x3 | normal i8x4 | colour u8x4 | ext u8x4 (bone, emissive, wind, water)
const VSTRIDE = 24;
const hexC = h => { if (Array.isArray(h)) return h; if (h.charCodeAt(0) === 33) h = h.slice(1); const c = rgbOf(h); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
class MB {
  constructor(seed) {
    this.d = []; this.T = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; this.st = [];
    this.bone = 0; this.em = 0; this.wind = 0; this.mask = 1; this.jit = 0; this.R = mulberry(seed || 7); this.water = 0; this.smooth = true;
  }
  push() { this.st.push(this.T.slice()); return this; }
  pop() { this.T = this.st.pop(); return this; }
  mul(M) {
    const A = this.T, o = new Array(12);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * M[c] + A[r * 3 + 1] * M[3 + c] + A[r * 3 + 2] * M[6 + c];
    for (let r = 0; r < 3; r++) o[9 + r] = A[r * 3] * M[9] + A[r * 3 + 1] * M[10] + A[r * 3 + 2] * M[11] + A[9 + r];
    this.T = o; return this;
  }
  tr(x, y, z) { return this.mul([1, 0, 0, 0, 1, 0, 0, 0, 1, x, y, z]); }
  sc(x, y, z) { return this.mul([x, 0, 0, 0, y === undefined ? x : y, 0, 0, 0, z === undefined ? x : z, 0, 0, 0]); }
  rx(a) { const c = Math.cos(a), s = Math.sin(a); return this.mul([1, 0, 0, 0, c, -s, 0, s, c, 0, 0, 0]); }
  ry(a) { const c = Math.cos(a), s = Math.sin(a); return this.mul([c, 0, s, 0, 1, 0, -s, 0, c, 0, 0, 0]); }
  rz(a) { const c = Math.cos(a), s = Math.sin(a); return this.mul([c, -s, 0, s, c, 0, 0, 0, 1, 0, 0, 0]); }
  xf(p) { const T = this.T; return [T[0] * p[0] + T[1] * p[1] + T[2] * p[2] + T[9], T[3] * p[0] + T[4] * p[1] + T[5] * p[2] + T[10], T[6] * p[0] + T[7] * p[1] + T[8] * p[2] + T[11]]; }
  tri(a, b, c, col) {
    a = this.xf(a); b = this.xf(b); c = this.xf(c);
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    let cc = typeof col === 'function' ? col([nx, ny, nz], [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]) : col;
    cc = hexC(cc);
    const j = this.jit ? 1 + (this.R() - 0.5) * 2 * this.jit : 1;
    const r = clamp(cc[0] * j, 0, 1), g = clamp(cc[1] * j, 0, 1), bl = clamp(cc[2] * j, 0, 1);
    const sm = this.smooth ? 1 : 0;
    for (const p of [a, b, c]) this.d.push(p[0], p[1], p[2], nx, ny, nz, r, g, bl, sm, this.bone, this.em, this.wind, this.water);
    return this;
  }
  quad(a, b, c, d, col) { this.tri(a, b, c, col); this.tri(a, c, d, col); return this; }
  box(x0, y0, z0, x1, y1, z1, col, top) {
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const tc = top || col;
    this.quad(p[0], p[1], p[2], p[3], col); this.quad(p[5], p[4], p[7], p[6], col);
    this.quad(p[4], p[0], p[3], p[7], col); this.quad(p[1], p[5], p[6], p[2], col);
    this.quad(p[3], p[2], p[6], p[7], tc); this.quad(p[4], p[5], p[1], p[0], col);
    return this;
  }
  bc(cx, cy, cz, sx, sy, sz, col, top) { return this.box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, col, top); }
  beam(a, b, w, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-3;
    const yaw = Math.atan2(dx, dz), pitch = Math.asin(clamp(dy / L, -1, 1));
    this.push().tr(a[0], a[1], a[2]).ry(yaw).rx(-pitch).box(-w / 2, -w / 2, 0, w / 2, w / 2, L, col).pop();
    return this;
  }
  cyl(x, y, z, r0, r1, h, seg, col, cap) {
    seg = seg || 8;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p0 = [x + c0 * r0, y, z + s0 * r0], p1 = [x + c1 * r0, y, z + s1 * r0], q0 = [x + c0 * r1, y + h, z + s0 * r1], q1 = [x + c1 * r1, y + h, z + s1 * r1];
      if (r1 > 0.0001) this.quad(p0, p1, q1, q0, col); else this.tri(p0, p1, [x, y + h, z], col);
      if (cap !== false && r1 > 0.0001) this.tri([x, y + h, z], q0, q1, cap || col);
      if (cap === 'both') this.tri([x, y, z], p1, p0, col);
    }
    return this;
  }
  // frustum between two points, radii r0 -> r1
  tube(a, b, r0, r1, seg, col, caps) {
    seg = seg || 8;
    const w = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(w[0], w[1], w[2]) || 1e-4; w[0] /= L; w[1] /= L; w[2] /= L;
    const t = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [w[1] * t[2] - w[2] * t[1], w[2] * t[0] - w[0] * t[2], w[0] * t[1] - w[1] * t[0]]; const ul = Math.hypot(...u); u = u.map(q => q / ul);
    const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const ring = (c, r, k) => { const a0 = k / seg * TAU, ca = Math.cos(a0), sa = Math.sin(a0); return [c[0] + (u[0] * ca + v[0] * sa) * r, c[1] + (u[1] * ca + v[1] * sa) * r, c[2] + (u[2] * ca + v[2] * sa) * r]; };
    for (let k = 0; k < seg; k++) {
      const p0 = ring(a, r0, k), p1 = ring(a, r0, k + 1), q0 = ring(b, r1, k), q1 = ring(b, r1, k + 1);
      this.quad(p0, q0, q1, p1, col);
      if (caps) { this.tri(a, p0, p1, col); this.tri(b, q1, q0, col); }
    }
    return this;
  }
  // capsule: tube with sphere ends
  cap(a, b, r, col, seg) { this.tube(a, b, r, r, seg || 8, col); this.sph(a[0], a[1], a[2], r, r, r, col, 0); this.sph(b[0], b[1], b[2], r, r, r, col, 0); return this; }
  // smooth ellipsoid (icosphere)
  sph(x, y, z, rx, ry, rz, col, sub) { return this.ico(x, y, z, rx, ry, rz, col, 0, sub === undefined ? 1 : sub, 1); }
  ico(x, y, z, rx, ry, rz, col, jit, sub, seed) {
    const ic = ICO[sub || 0], R = mulberry(seed || 1), J = ic.v.map(() => 1 + (R() - 0.5) * 2 * (jit || 0));
    const P = ic.v.map((v, i) => [x + v[0] * rx * J[i], y + v[1] * ry * J[i], z + v[2] * rz * J[i]]);
    for (const f of ic.f) this.tri(P[f[0]], P[f[1]], P[f[2]], col);
    return this;
  }
  roof(w, L, y, h, col, ov) {
    ov = ov || 0.3; const x0 = -w / 2 - ov, x1 = w / 2 + ov, z0 = -L / 2 - ov, z1 = L / 2 + ov;
    this.quad([x0, y, z0], [0, y + h, z0], [0, y + h, z1], [x0, y, z1], col); this.quad([x1, y, z0], [0, y + h, z0], [0, y + h, z1], [x1, y, z1], col);
    this.quad([x0, y - 0.14, z0], [x0, y, z0], [x0, y, z1], [x0, y - 0.14, z1], col); this.quad([x1, y - 0.14, z0], [x1, y, z0], [x1, y, z1], [x1, y - 0.14, z1], col);
    this.quad([x0, y - 0.14, z0], [x0, y, z0], [0, y + h, z0], [0, y + h - 0.14, z0], col); this.quad([x1, y - 0.14, z0], [x1, y, z0], [0, y + h, z0], [0, y + h - 0.14, z0], col);
    this.quad([x0, y - 0.14, z1], [x0, y, z1], [0, y + h, z1], [0, y + h - 0.14, z1], col); this.quad([x1, y - 0.14, z1], [x1, y, z1], [0, y + h, z1], [0, y + h - 0.14, z1], col);
    return this;
  }
}
const ICO = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  let v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => { const l = Math.hypot(...p); return p.map(q => q / l); });
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const out = [{ v: v.slice(), f: f.slice() }];
  const mid = new Map(), m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid.has(k)) return mid.get(k); const p = [(v[a][0] + v[b][0]) / 2, (v[a][1] + v[b][1]) / 2, (v[a][2] + v[b][2]) / 2], l = Math.hypot(...p); v.push(p.map(q => q / l)); mid.set(k, v.length - 1); return v.length - 1; };
  const f2 = []; for (const [a, b, c] of f) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); f2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
  out.push({ v: v.slice(), f: f2 });
  return out;
})();
// crease-angle normal smoothing: vertices at the same spot (same bone) average the face normals within ~52 degrees
function smoothNormals(d) {
  const n = d.length / 14, groups = new Map(), fn = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = i * 14; fn[i * 3] = d[s + 3]; fn[i * 3 + 1] = d[s + 4]; fn[i * 3 + 2] = d[s + 5];
    if (!d[s + 9]) continue;
    const k = Math.round(d[s] * 400) + ',' + Math.round(d[s + 1] * 400) + ',' + Math.round(d[s + 2] * 400) + ',' + d[s + 10];
    let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(i);
  }
  const cosT = 0.62;
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    for (const i of g) {
      let x = 0, y = 0, z = 0; const ax = fn[i * 3], ay = fn[i * 3 + 1], az = fn[i * 3 + 2];
      for (const j of g) { const bx = fn[j * 3], by = fn[j * 3 + 1], bz = fn[j * 3 + 2]; if (ax * bx + ay * by + az * bz > cosT) { x += bx; y += by; z += bz; } }
      const l = Math.hypot(x, y, z) || 1, s = i * 14; d[s + 3] = x / l; d[s + 4] = y / l; d[s + 5] = z / l;
    }
  }
}
function gpuMesh(mb) {
  smoothNormals(mb.d);
  const n = mb.d.length / 14, buf = new ArrayBuffer(n * VSTRIDE), f = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf), d = mb.d;
  for (let i = 0; i < n; i++) {
    const s = i * 14, o = i * VSTRIDE;
    f[o / 4] = d[s]; f[o / 4 + 1] = d[s + 1]; f[o / 4 + 2] = d[s + 2];
    i8[o + 12] = Math.round(d[s + 3] * 127); i8[o + 13] = Math.round(d[s + 4] * 127); i8[o + 14] = Math.round(d[s + 5] * 127);
    u8[o + 16] = d[s + 6] * 255; u8[o + 17] = d[s + 7] * 255; u8[o + 18] = d[s + 8] * 255; u8[o + 19] = 255;
    u8[o + 20] = d[s + 10]; u8[o + 21] = d[s + 11] * 255; u8[o + 22] = d[s + 12] * 255; u8[o + 23] = d[s + 13] * 255;
  }
  const vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); meshAttribs(vbo); gl.bindVertexArray(null);
  return { vbo, vao, n };
}
function meshAttribs(vbo) {
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VSTRIDE, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, VSTRIDE, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 16);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, VSTRIDE, 20);
}

// ---------- chibi character rig ----------
// heights: feet 0, hips 0.5, chest 0.9, head centre ~1.22 (big head, about 1/3 of the figure)
const BN = { root: 0, hips: 1, torso: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7, cape: 8, hbody: 10, hFL: 11, hFR: 12, hBL: 13, hBR: 14, hneck: 15, htail: 16 };
const PIV = [[0, 0, 0], [0, 0.5, 0], [0, 0.55, 0], [0, 0.97, 0], [0.25, 0.9, 0], [-0.25, 0.9, 0], [0.1, 0.48, 0], [-0.1, 0.48, 0], [0, 0.93, -0.16], [0, 0, 0],
  [0, 1.15, 0], [0.2, 0.98, 0.55], [-0.2, 0.98, 0.55], [0.2, 1.0, -0.55], [-0.2, 1.0, -0.55], [0, 1.4, 0.62], [0, 1.38, -0.82], [0, 0, 0]];
const HAND = { y: 0.5, x: 0.27, z: 0.02 };
const HUMANS = {
  bandit: { coat: '#8a6a44', pants: '#5a4a34', boots: '#3e2c1c', hat: 'hood', hatC: '#6a4e34', belt: '#3a2614', mask: '#4a3a2c', hair: '#3a2a1a' },
  soldier: { coat: '#d83a30', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'tricorn', lace: '#f4e8b0', cross: true, buttons: true, boots: '#2a2228', R: { t: 'sword', col: '#d8e0e8' } },
  ally: { coat: '#2f6ae0', pants: '#f0ece0', facing: '#d83a30', cuff: '#d83a30', hat: 'tricorn', lace: '#ffd84a', buttons: true, boots: '#2a2228', R: { t: 'sword', col: '#d8e0e8' } },
  guard: { coat: '#2f9a5a', pants: '#e8e0cc', facing: '#ffd84a', hat: 'morion', buttons: true, boots: '#3a2a1a', R: { t: 'sword', col: '#d8e0e8' }, L: { t: 'shield', id: 'buckler' } },
  pikeman: { coat: '#c83228', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'morion', cross: true, boots: '#2a2228', R: { t: 'pike' } },
  musketeer: { coat: '#d83a30', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'tricorn', lace: '#f4e8b0', cross: true, buttons: true, boots: '#2a2228', R: { t: 'musket' } },
  archer: { coat: '#b84a32', pants: '#7a6a48', hat: 'hood', hatC: '#5a7a34', straps: true, boots: '#4a3420', L: { t: 'bow' } },
  vampire: { coat: '#3a2450', pants: '#2a1a38', boots: '#18101e', skin: '#ece8f8', hair: '#1a1424', eye: '#ff2a3a', eyeEm: true, cape: '#2a1440', capeIn: '#c81e3a', collar: true, buttons: true },
  witch: { robe: '#7a3aa8', coat: '#6a3098', skin: '#9ad070', hair: '#e8e0f0', eye: '#ffe040', eyeEm: true, hat: 'witch', hatC: '#4a2270', broom: true },
  merchant: { coat: '#3a9a5a', pants: '#7a5a38', apron: '#f4ecd8', hat: 'cap', hatC: '#a86a32', pack: true, buttons: true, hair: '#7a4a24' }
};
const ARMOR_LOOK = {
  tunic: { coat: '#e8dcbc', pants: '#9a8462', boots: '#6a4a2c', belt: '#a07a48', hair: '#6a3e1e' },
  gambeson: { coat: '#d8b478', pants: '#8a7450', boots: '#5a3e24', quilt: true, belt: '#7a5432', hair: '#6a3e1e' },
  leather: { coat: '#a86a36', pants: '#6a4e30', boots: '#3e2a18', straps: true, belt: '#4a3018', hair: '#6a3e1e' },
  chainmail: { coat: '#b8c4d0', mail: true, pants: '#7a8490', boots: '#3a3430', hat: 'coif', belt: '#5a3e24' },
  halfplate: { coat: '#a8b4c0', mail: true, plate: '#dce6f0', pants: '#7a8490', boots: '#3a3430', hat: 'sallet', crest: '#3a6ae0', pauldron: true },
  fullplate: { coat: '#e0e8f2', plate: '#f0f6fc', plateArms: true, pants: '#c8d2dc', boots: '#9aa4ae', greaves: true, hat: 'great', crest: '#e03a3a', pauldron: true }
};
const GIANTS = {
  giant: { skin: '#d8a878', hair: '#6a4422', beard: '#6a4422', fur: '#9a7044', belt: '#5a3a1e', club: '#8a6038', eye: '#ff4a1a' },
  frostgiant: { skin: '#a8d0ec', hair: '#f4f8ff', beard: '#eaf4ff', fur: '#f4f8fc', belt: '#5a7a9a', club: '#c0e4f8', eye: '#4ad8ff', frost: true }
};
function itemSpec(id) {
  if (!id) return null; const it = ITEMS[id]; if (!it) return null;
  return it.type === 'sword' ? { t: 'sword', col: it.col, tier: it.tier } : it.type === 'sword2' ? { t: 'claymore' } : it.type === 'bow' ? { t: 'bow' } : it.type === 'shield' ? { t: 'shield', id } : it.type === 'torch' ? { t: 'torch' } : it.type === 'gun' ? { t: 'pistol' } : null;
}
// a held item in the arm's rest frame (arm hangs along -y from the shoulder); hand at HAND
function buildItem(mb, it, side) {
  const hx = side * HAND.x, hy = HAND.y, hz = HAND.z;
  mb.push().tr(hx, hy, hz);
  switch (it.t) {
    case 'sword': case 'claymore': {
      const big = it.t === 'claymore', L = big ? 1.15 : 0.78, bc = hexC(it.col || '#d8e0e8');
      mb.rx(0.35);
      mb.cap([0, -0.02, 0], [0, 0.12, 0], 0.035, '#5a3418', 6);
      mb.sph(0, 0.17, 0, 0.05, 0.05, 0.05, '#e8c050', 0);
      mb.bc(0, -0.06, 0, big ? 0.36 : 0.28, 0.05, 0.07, '#e8c050');
      mb.box(-0.05, -0.08 - L, -0.016, 0.05, -0.08, 0.016, bc);
      mb.box(-0.015, -0.08 - L, -0.02, 0.015, -0.1, 0.02, bc.map(v => Math.min(1, v * 1.15)));
      mb.tri([-0.05, -0.08 - L, 0], [0.05, -0.08 - L, 0], [0, -0.2 - L, 0], bc);
      if (it.tier >= 4) { const e = mb.em; mb.em = 0.7; mb.box(-0.022, -0.08 - L, -0.021, 0.022, -0.1, 0.021, '#ffe080'); mb.em = e; }
      break;
    }
    case 'pike':
      mb.tube([0, 0.8, 0], [0, -2.7, 0], 0.04, 0.04, 6, '#a87a44');
      mb.tri([-0.07, -2.7, 0], [0.07, -2.7, 0], [0, -3.1, 0], '#e8eef4'); mb.tri([0, -2.7, -0.07], [0, -2.7, 0.07], [0, -3.1, 0], '#c8d0d8');
      break;
    case 'musket':
      mb.box(-0.04, -1.15, -0.05, 0.04, 0.22, 0.05, '#8a5a2e'); mb.box(-0.025, -1.35, -0.08, 0.025, -0.2, -0.04, '#4a4a52');
      mb.box(-0.01, -1.65, -0.07, 0.01, -1.35, -0.05, '#e8eef4');
      break;
    case 'pistol':
      mb.box(-0.035, -0.3, 0.0, 0.035, 0.02, 0.07, '#4a4a52'); mb.box(-0.04, -0.03, -0.03, 0.04, 0.1, 0.09, '#8a5a2e');
      break;
    case 'torch': {
      mb.rx(-0.25);
      mb.tube([0, -0.2, 0.0], [0, -0.2, 0.55], 0.04, 0.05, 6, '#7a4a24', true);
      mb.sph(0, -0.2, 0.58, 0.07, 0.07, 0.07, '#3a2412', 0);
      const e = mb.em; mb.em = 1;
      mb.push().tr(0, -0.2, 0.62).rx(Math.PI / 2);
      mb.cyl(0, 0, 0, 0.1, 0, 0.34, 6, '#ff7a20'); mb.cyl(0, 0.02, 0, 0.06, 0, 0.24, 6, '#ffe070');
      mb.pop(); mb.em = e;
      break;
    }
    case 'bow': {
      const c = '#9a6232', N = 8;
      let prev = null;
      for (let i = 0; i <= N; i++) { const t = i / N * 2 - 1, p = [0, -0.06 - (1 - t * t) * 0.2, t * 0.7]; if (prev) mb.tube(prev, p, 0.035, 0.035, 5, c); prev = p; }
      mb.beam([0, -0.06, -0.7], [0, -0.06, 0.7], 0.014, '#fff8e0');
      break;
    }
    case 'shield': {
      const id = it.id;
      mb.tr(side * 0.08, 0.1, 0.04);
      if (id === 'buckler') { mb.push().rz(side * Math.PI / 2).cyl(0, 0, 0, 0.26, 0.26, 0.06, 12, '#a86a32', '#c88a48').cyl(0, 0.06, 0, 0.1, 0.06, 0.04, 10, '#d8dde2').pop(); }
      else {
        const tower = id === 'tower_shield', w = tower ? 0.36 : 0.29, top = tower ? 0.52 : 0.38, bot = tower ? -0.64 : -0.52;
        const fc = tower ? '#2a4ab0' : '#3a6ae8', x = side * 0.04;
        const pts = tower ? [[top, -w], [top, w], [bot, w], [bot, -w]] : [[top, -w], [top, w], [-0.05, w], [bot, 0], [-0.05, -w]];
        for (const xx of [x, x - side * 0.06]) {
          const col = xx === x ? fc : '#7a5030';
          for (let i = 1; i < pts.length - 1; i++) mb.tri([xx, pts[0][0], pts[0][1]], [xx, pts[i][0], pts[i][1]], [xx, pts[i + 1][0], pts[i + 1][1]], col);
        }
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; mb.beam([x - side * 0.03, a[0], a[1]], [x - side * 0.03, b[0], b[1]], 0.06, '#e8c050'); }
        mb.bc(x + side * 0.006, (top + bot) * 0.35, 0, 0.012, 0.07, w * 1.2, '#ffe070'); mb.bc(x + side * 0.006, 0.0, 0, 0.012, (top - bot) * 0.66, 0.07, '#ffe070');
      }
      break;
    }
  }
  mb.pop();
}
// chibi humanoid (giants reuse it at scale); spec keys: coat pants boots skin hair hat ...; side items L / R
function buildHuman(spec) {
  const mb = new MB(91), s = spec, giant = !!s.giant;
  const skin = s.skin || '#f4c8a0', coat = s.coat || '#9a8a6a', pants = s.pants || '#6a5a42', boots = s.boots || '#3a2a1c';
  // legs + boots
  for (const side of [1, -1]) {
    mb.bone = side > 0 ? BN.legL : BN.legR;
    const x = side * 0.1;
    if (!s.robe) mb.cap([x, 0.45, 0], [x, 0.16, 0.0], 0.085, s.greaves ? '#e8eef4' : pants, 8);
    mb.sph(x, 0.09, 0.035, 0.1, 0.09, 0.14, boots);
  }
  // hips / skirt
  mb.bone = BN.hips;
  if (s.robe) mb.tube([0, 0.02, 0], [0, 0.72, 0], 0.32, 0.2, 10, s.robe, true);
  else if (giant) { mb.sph(0, 0.52, 0, 0.27, 0.16, 0.2, s.fur); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; mb.sph(Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.16, 0.08, 0.12, 0.08, s.fur, 0); } mb.tube([0, 0.6, 0], [0, 0.66, 0], 0.27, 0.27, 10, s.belt, true); }
  else {
    mb.sph(0, 0.52, 0, 0.19, 0.12, 0.15, pants);
    if (!s.plate) mb.tube([0, 0.38, 0], [0, 0.62, 0], 0.24, 0.2, 10, coat, false);
  }
  if (s.apron) mb.box(-0.15, 0.32, 0.17, 0.15, 0.7, 0.19, s.apron);
  // torso
  mb.bone = BN.torso;
  const tw = giant ? 0.28 : 0.22;
  mb.sph(0, 0.74, 0, tw, 0.24, tw * 0.78, giant ? skin : coat);
  if (giant) { mb.sph(0, 0.78, 0.1, 0.22, 0.14, 0.12, skin); mb.beam([0.2, 0.92, 0.12], [-0.2, 0.58, 0.14], 0.07, s.fur); }
  if (s.quilt) for (let i = 0; i < 3; i++) mb.tube([-tw * 0.95, 0.62 + i * 0.1, 0], [tw * 0.95, 0.62 + i * 0.1, 0], 0.012, 0.012, 4, '#a8844e');
  if (s.mail) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) mb.sph(-0.12 + j * 0.08, 0.6 + i * 0.075, 0.165, 0.03, 0.025, 0.012, '#8a96a2', 0); }
  if (s.plate) { mb.sph(0, 0.76, 0.02, tw + 0.025, 0.23, tw * 0.82, s.plate); mb.sph(0.06, 0.82, 0.17, 0.05, 0.08, 0.02, '#ffffff', 0); }
  if (s.pauldron) for (const side of [1, -1]) mb.sph(side * 0.24, 0.9, 0, 0.11, 0.07, 0.12, s.plate || '#dce6f0');
  if (s.facing) { mb.box(0.05, 0.56, 0.155, 0.12, 0.92, 0.17, s.facing); mb.box(-0.12, 0.56, 0.155, -0.05, 0.92, 0.17, s.facing); }
  if (s.cross) { mb.beam([0.18, 0.93, 0.13], [-0.16, 0.54, 0.15], 0.05, '#ffffff'); mb.beam([-0.18, 0.93, 0.135], [0.16, 0.54, 0.155], 0.05, '#ffffff'); }
  if (s.straps) { mb.beam([0.17, 0.92, 0.14], [-0.15, 0.56, 0.15], 0.045, '#4a2e16'); }
  if (s.buttons) for (let i = 0; i < 3; i++) mb.sph(0, 0.62 + i * 0.1, 0.175, 0.022, 0.022, 0.015, '#ffd84a', 0);
  if (s.belt || s.cross) mb.tube([0, 0.56, 0], [0, 0.61, 0], tw + 0.01, tw + 0.01, 10, s.belt || '#3a2414', false);
  if (s.collar) { mb.box(0.08, 0.9, -0.12, 0.2, 1.1, 0.06, s.capeIn || s.cape); mb.box(-0.2, 0.9, -0.12, -0.08, 1.1, 0.06, s.capeIn || s.cape); }
  if (s.pack) mb.sph(0, 0.76, -0.2, 0.18, 0.2, 0.1, '#8a6034');
  // head (big, round)
  mb.bone = BN.head;
  const hr = giant ? 0.3 : 0.33, hy = giant ? 1.18 : 1.23;
  mb.sph(0, hy, 0, hr, hr * 0.96, hr * 0.94, skin);
  // face: big dark eyes with a white catch-light, small mouth, blush
  const eye = s.eye || '#1e1624', ez = hr * 0.9, ey = hy - 0.01;
  { const e = mb.em; if (s.eyeEm) mb.em = 1; mb.sph(0.11, ey, ez, 0.045, 0.068, 0.025, eye, 0); mb.sph(-0.11, ey, ez, 0.045, 0.068, 0.025, eye, 0); mb.em = e; }
  if (!s.eyeEm) { mb.sph(0.125, ey + 0.03, ez + 0.02, 0.015, 0.018, 0.01, '#ffffff', 0); mb.sph(-0.095, ey + 0.03, ez + 0.02, 0.015, 0.018, 0.01, '#ffffff', 0); }
  mb.box(-0.035, hy - 0.13, hr * 0.92 - 0.01, 0.035, hy - 0.115, hr * 0.92 + 0.01, giant ? '#3a1a10' : '#8a3a30');
  if (!giant && !s.eyeEm) { mb.sph(0.19, hy - 0.08, hr * 0.78, 0.045, 0.025, 0.01, '#f8a0a0', 0); mb.sph(-0.19, hy - 0.08, hr * 0.78, 0.045, 0.025, 0.01, '#f8a0a0', 0); }
  if (s.beard) { mb.sph(0, hy - 0.2, 0.16, 0.24, 0.2, 0.16, s.beard); mb.sph(0, hy - 0.36, 0.14, 0.15, 0.14, 0.11, s.beard); }
  const hair = s.hair || '#5a3a1e';
  const helm = s.hat === 'great' || s.hat === 'sallet' || s.hat === 'coif';
  if (!helm) { mb.sph(0, hy + 0.07, -0.05, hr * 1.04, hr * 0.92, hr * 0.96, hair); mb.sph(0.1, hy + 0.2, 0.2, 0.12, 0.08, 0.09, hair, 0); mb.sph(-0.12, hy + 0.21, 0.19, 0.11, 0.08, 0.09, hair, 0); }
  switch (s.hat) {
    case 'tricorn': {
      const c = '#22202a', l = s.lace || '#f0e0a0';
      for (let k = 0; k < 3; k++) { mb.push().tr(0, hy + 0.27, 0).ry(k * TAU / 3 + Math.PI).beam([-0.3, 0, 0.17], [0.3, 0, 0.17], 0.1, c).beam([-0.3, 0.05, 0.22], [0.3, 0.05, 0.22], 0.025, l).pop(); }
      mb.sph(0, hy + 0.3, 0, 0.27, 0.13, 0.27, c); break;
    }
    case 'hood': mb.sph(0, hy + 0.04, -0.03, hr * 1.12, hr * 1.08, hr * 1.08, s.hatC || '#6a4e34'); mb.sph(0, hy - 0.1, -0.14, 0.24, 0.2, 0.18, s.hatC || '#6a4e34'); if (s.mask) mb.box(-0.2, hy - 0.16, hr * 0.88, 0.2, hy - 0.06, hr * 0.98, s.mask); break;
    case 'morion': mb.sph(0, hy + 0.16, 0, hr * 1.08, hr * 0.78, hr * 1.08, '#e0e6ec'); mb.cyl(0, hy + 0.1, 0, 0.42, 0.42, 0.03, 14, '#c8d0d8'); mb.bc(0, hy + 0.42, 0, 0.04, 0.1, 0.36, '#f0f4f8'); break;
    case 'coif': mb.sph(0, hy + 0.04, -0.02, hr * 1.1, hr * 1.06, hr * 1.06, '#b8c4d0'); mb.box(-0.16, hy - 0.16, hr * 0.98, 0.16, hy + 0.08, hr * 1.04, skin); mb.sph(0.11, ey, hr * 1.02, 0.04, 0.06, 0.02, eye, 0); mb.sph(-0.11, ey, hr * 1.02, 0.04, 0.06, 0.02, eye, 0); break;
    case 'sallet': mb.sph(0, hy + 0.04, -0.02, hr * 1.12, hr * 1.06, hr * 1.1, '#dce6f0'); mb.box(-0.22, ey - 0.02, hr * 1.04, 0.22, ey + 0.03, hr * 1.1, '#1a1a22'); if (s.crest) mb.sph(0, hy + 0.36, -0.04, 0.05, 0.1, 0.24, s.crest); break;
    case 'great': mb.tube([0, hy - 0.32, 0], [0, hy + 0.3, 0], hr * 1.05, hr * 1.0, 12, '#eef4fa', true); mb.box(-0.22, ey - 0.02, hr * 1.0, 0.22, ey + 0.03, hr * 1.08, '#1a1a22'); mb.box(-0.02, hy - 0.2, hr * 1.0, 0.02, ey - 0.02, hr * 1.08, '#1a1a22'); if (s.crest) { mb.sph(0, hy + 0.42, 0, 0.06, 0.14, 0.24, s.crest); } break;
    case 'cap': mb.sph(0, hy + 0.2, 0, hr * 1.02, hr * 0.55, hr * 1.02, s.hatC); mb.sph(0, hy + 0.14, 0.26, 0.2, 0.03, 0.12, s.hatC); break;
    case 'witch': mb.cyl(0, hy + 0.2, 0, 0.5, 0.5, 0.03, 14, s.hatC); mb.push().tr(0, hy + 0.2, 0).rx(-0.2).cyl(0, 0, 0, 0.28, 0.0, 0.72, 10, s.hatC).pop(); mb.cyl(0, hy + 0.21, 0, 0.29, 0.27, 0.07, 10, '#e8c050'); break;
  }
  if (s.hair && s.hat === 'witch') mb.sph(0, hy - 0.08, -0.2, 0.3, 0.36, 0.12, s.hair);
  // arms
  for (const side of [1, -1]) {
    mb.bone = side > 0 ? BN.armL : BN.armR;
    const x = side * (giant ? 0.3 : 0.27), ar = giant ? 0.1 : 0.068;
    const sleeve = giant ? skin : s.plateArms ? '#e8eef4' : s.robe ? s.coat : coat;
    mb.cap([x, 0.88, 0], [x, 0.6, 0], ar, sleeve, 8);
    if (s.cuff) mb.tube([x, 0.6, 0], [x, 0.56, 0], ar + 0.015, ar + 0.015, 8, s.cuff, true);
    mb.sph(x, HAND.y + 0.02, HAND.z, ar * 1.12, ar * 1.12, ar * 1.12, s.plateArms ? '#c8d2dc' : skin, 0);
    if (giant && side < 0) { // spiked club
      mb.push().tr(x, HAND.y, 0.03).rx(0.3);
      mb.tube([0, 0.1, 0], [0, -0.3, 0], 0.06, 0.08, 8, s.club, true); mb.tube([0, -0.3, 0], [0, -1.0, 0], 0.08, 0.17, 8, s.club, true);
      mb.sph(0, -1.0, 0, 0.19, 0.2, 0.19, s.club);
      for (let k = 0; k < 6; k++) { const a = k * 1.05, y = -0.55 - k * 0.08; mb.cyl(Math.cos(a) * 0.14, y, Math.sin(a) * 0.14, 0.04, 0, 0.12, 5, '#f4ecdc'); }
      mb.pop();
    }
    const it = side > 0 ? s.L : s.R;
    if (it) buildItem(mb, it, side);
  }
  if (s.cape) {
    mb.bone = BN.cape;
    mb.box(-0.21, 0.28, -0.2, 0.21, 0.94, -0.17, s.cape); mb.box(-0.2, 0.3, -0.17, 0.2, 0.92, -0.155, s.capeIn || s.cape); mb.sph(0, 0.93, -0.1, 0.24, 0.06, 0.12, s.cape);
  }
  if (s.broom) {
    mb.bone = BN.root;
    mb.tube([0, 0.42, 0.95], [0, 0.42, -0.7], 0.045, 0.045, 6, '#8a5a30', true);
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; mb.beam([0, 0.42, -0.6], [Math.cos(a) * 0.16, 0.42 + Math.sin(a) * 0.16, -1.05], 0.04, '#e8c060'); }
    mb.sph(0, 0.42, -0.62, 0.08, 0.08, 0.06, '#8a4a20', 0);
  }
  if (giant) {
    const k = s.scale || 3.0;
    for (let i = 0; i < mb.d.length; i += 14) { mb.d[i] *= k; mb.d[i + 1] *= k; mb.d[i + 2] *= k; }
  }
  return mb;
}
function buildHorse(o) {
  const mb = new MB(33);
  const coat = o.coat || '#a86a3a', dark = o.dark || '#3a2414', cloth = o.cloth || '#2f6ae0';
  mb.bone = BN.hbody;
  mb.sph(0, 1.15, 0, 0.38, 0.36, 0.82, coat);
  mb.sph(0, 1.2, 0.45, 0.36, 0.36, 0.38, coat); mb.sph(0, 1.2, -0.5, 0.38, 0.36, 0.38, coat);
  if (o.saddle) { mb.sph(0, 1.48, -0.02, 0.4, 0.06, 0.42, cloth); mb.sph(0, 1.54, -0.05, 0.27, 0.1, 0.3, '#6a3a1c'); mb.sph(0, 1.62, -0.25, 0.18, 0.08, 0.05, '#6a3a1c'); mb.bc(0.34, 1.18, 0, 0.02, 0.36, 0.04, '#3a2414'); mb.bc(-0.34, 1.18, 0, 0.02, 0.36, 0.04, '#3a2414'); }
  for (const [b, x, z] of [[BN.hFL, 0.2, 0.55], [BN.hFR, -0.2, 0.55], [BN.hBL, 0.2, -0.55], [BN.hBR, -0.2, -0.55]]) {
    mb.bone = b;
    mb.cap([x, 0.95, z], [x, 0.15, z], 0.09, coat, 8);
    if (o.stockings) mb.tube([x, 0.45, z], [x, 0.14, z], 0.1, 0.1, 8, '#f4f0e6', false);
    mb.sph(x, 0.07, z + 0.02, 0.11, 0.08, 0.13, dark, 0);
  }
  mb.bone = BN.hneck;
  mb.cap([0, 1.3, 0.6], [0, 1.78, 0.9], 0.25, coat, 8);
  mb.sph(0, 1.86, 1.12, 0.23, 0.23, 0.33, coat);
  mb.sph(0, 1.76, 1.38, 0.17, 0.15, 0.13, o.muzzle || '#f0dcc8');
  mb.sph(0.15, 1.95, 1.2, 0.045, 0.06, 0.03, '#1a1418', 0); mb.sph(-0.15, 1.95, 1.2, 0.045, 0.06, 0.03, '#1a1418', 0);
  mb.sph(0.16, 1.97, 1.215, 0.016, 0.02, 0.01, '#ffffff', 0); mb.sph(-0.14, 1.97, 1.215, 0.016, 0.02, 0.01, '#ffffff', 0);
  mb.cyl(0.11, 2.02, 0.98, 0.065, 0, 0.2, 5, coat); mb.cyl(-0.11, 2.02, 0.98, 0.065, 0, 0.2, 5, coat);
  mb.cap([0, 1.5, 0.42], [0, 2.02, 0.9], 0.1, dark, 6); mb.sph(0, 2.08, 1.02, 0.1, 0.07, 0.12, dark, 0);
  if (o.blaze) mb.sph(0, 1.95, 1.33, 0.06, 0.03, 0.14, '#ffffff', 0);
  if (o.saddle) { mb.beam([0.13, 1.9, 1.3], [0.2, 1.52, 0.35], 0.025, '#2a1c10'); mb.beam([-0.13, 1.9, 1.3], [-0.2, 1.52, 0.35], 0.025, '#2a1c10'); }
  mb.bone = BN.htail;
  mb.cap([0, 1.36, -0.82], [0, 0.85, -1.08], 0.1, dark, 6); mb.sph(0, 0.85, -1.1, 0.12, 0.18, 0.1, dark, 0);
  return mb;
}

// ---------- scenery (one mesh per static type, drawn instanced) ----------
const STATIC_BUILD = {
  pine: () => mkPineM(false), snowpine: () => mkPineM(true),
  oak: () => { const mb = new MB(5); mb.tube([0, 0, 0], [0, 2.2, 0], 0.3, 0.2, 8, '#8a5a32', false); for (const a of [0.4, 2.3, 4.2]) mb.tube([0, 1.6, 0], [Math.cos(a) * 0.7, 2.4, Math.sin(a) * 0.7], 0.1, 0.07, 6, '#8a5a32');
    mb.wind = 0.4; const g = ['#4aa83c', '#5cb848', '#3e9a34'];
    [[0, 3.1, 0, 1.35], [0.95, 2.6, 0.3, 0.95], [-0.85, 2.7, -0.4, 1.0], [0.25, 2.5, -1.0, 0.9], [-0.3, 2.55, 0.95, 0.9], [0.2, 3.75, 0.1, 0.85]].forEach((c, i) => mb.sph(c[0], c[1], c[2], c[3], c[3] * 0.86, c[3], g[i % 3]));
    return mb; },
  deadtree: () => { const mb = new MB(6); const c = '#7a6a5a'; mb.tube([0, 0, 0], [0, 3.3, 0], 0.22, 0.07, 6, c); const R = mulberry(9);
    const br = (p, a, el, L, w, d) => { const q = [p[0] + Math.cos(a) * Math.cos(el) * L, p[1] + Math.sin(el) * L, p[2] + Math.sin(a) * Math.cos(el) * L]; mb.tube(p, q, w, w * 0.6, 5, c); if (d) { br(q, a + 0.6, el + 0.1, L * 0.6, w * 0.7, d - 1); br(q, a - 0.6, el - 0.1, L * 0.6, w * 0.7, d - 1); } };
    for (let k = 0; k < 4; k++) br([0, 1.6 + k * 0.45, 0], k * 1.9 + R(), 0.5, 1.0 - k * 0.15, 0.09, 1); return mb; },
  palm: () => { const mb = new MB(8); let x = 0; for (let i = 0; i < 9; i++) { const nx = Math.sin(i * 0.35) * 0.35; mb.tube([x, i * 0.5, 0], [nx, (i + 1) * 0.5, 0], 0.15, 0.14, 7, i % 2 ? '#b8905a' : '#a07a48'); x = nx; }
    mb.wind = 0.8; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; let p = [x, 4.5, 0]; for (let s = 1; s <= 4; s++) { const q = [x + Math.cos(a) * s * 0.55, 4.6 + Math.sin(s * 0.7) * 0.5 - s * s * 0.1, Math.sin(a) * s * 0.55]; mb.tube(p, q, 0.16 - s * 0.025, 0.13 - s * 0.025, 4, k % 2 ? '#4ab040' : '#3a9a34'); p = q; } } mb.sph(x, 4.45, 0, 0.18, 0.15, 0.18, '#7a5a2a', 0); return mb; },
  bush: () => { const mb = new MB(11); mb.wind = 0.3; const R = mulberry(4); for (let k = 0; k < 6; k++) mb.sph((R() - 0.5) * 0.8, 0.35 + R() * 0.3, (R() - 0.5) * 0.8, 0.36 + R() * 0.1, 0.32, 0.36 + R() * 0.1, k % 2 ? '#3e9a38' : '#4cac40');
    for (let k = 0; k < 6; k++) { const a = k * 1.1; mb.sph(Math.cos(a) * 0.5, 0.58 + (k % 3) * 0.12, Math.sin(a) * 0.5, 0.07, 0.07, 0.07, '#e83a4a', 0); } return mb; },
  rock: () => mkRockM(0), rocksnow: () => mkRockM(1), rocksand: () => mkRockM(2), pebble: () => mkRockM(0, true), pebblesnow: () => mkRockM(1, true), pebblesand: () => mkRockM(2, true),
  tuft: () => { const mb = new MB(71); mb.wind = 1; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + 0.3, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08; mb.tri([x - 0.04, 0, z], [x + 0.04, 0, z], [x * 3, 0.42 + (k % 2) * 0.12, z * 3], '#5cb848'); mb.tri([x, 0, z - 0.04], [x, 0, z + 0.04], [x * 3, 0.42 + (k % 2) * 0.12, z * 3], '#4aa83c'); } return mb; },
  flower: () => { const mb = new MB(72); mb.wind = 1; mb.tube([0, 0, 0], [0, 0.32, 0], 0.015, 0.015, 4, '#4aa83c'); const cols = ['#ffffff', '#ffe04a', '#ff7ab0'];
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; mb.sph(Math.cos(a) * 0.07, 0.34, Math.sin(a) * 0.07, 0.05, 0.02, 0.05, cols[0], 0); } mb.sph(0, 0.35, 0, 0.035, 0.025, 0.035, '#ffd030', 0); return mb; },
  flower2: () => { const mb = new MB(73); mb.wind = 1; mb.tube([0, 0, 0], [0, 0.3, 0], 0.015, 0.015, 4, '#4aa83c');
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; mb.sph(Math.cos(a) * 0.07, 0.32, Math.sin(a) * 0.07, 0.05, 0.02, 0.05, '#ff6a9a', 0); } mb.sph(0, 0.33, 0, 0.035, 0.025, 0.035, '#fff0a0', 0); return mb; },
  reed: () => { const mb = new MB(74); mb.wind = 1; for (let k = 0; k < 4; k++) { const a = k * 1.7, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1; mb.tube([x, 0, z], [x * 1.5, 0.9 + k * 0.08, z * 1.5], 0.02, 0.012, 4, '#8aa84a'); if (k % 2) mb.cap([x * 1.5, 0.75 + k * 0.08, z * 1.5], [x * 1.5, 0.92 + k * 0.08, z * 1.5], 0.035, '#7a4a2a', 5); } return mb; },
  menhir: () => { const mb = new MB(12); mb.ico(0, 1.4, 0, 0.45, 1.55, 0.32, '#a8a49c', 0.08, 1, 4); mb.bc(0, 1.5, 0.31, 0.06, 0.8, 0.02, '#5ad0ff'); mb.bc(0, 1.7, 0.31, 0.3, 0.06, 0.02, '#5ad0ff'); return mb; },
  house: () => mkHouseM(''), housesnow: () => mkHouseM('snow'), housesand: () => mkHouseM('sand'),
  ruin: () => { const mb = new MB(13), st = '#a8a296', st2 = '#968e82', moss = '#5cac48';
    const wall = (x0, z0, x1, z1, h) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, hh = h * (0.4 + 0.6 * hash2(i * 7 + x0 * 3, z0 * 5)); mb.box(Math.min(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) - 0.2, 0, Math.min(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) - 0.2, Math.max(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) + 0.2, hh, Math.max(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) + 0.2, i % 2 ? st : st2, moss); } };
    wall(-4, -3, 4, -3, 4.5); wall(-4, -3, -4, 3, 3.2); wall(4, -3, 4, 1, 2.6);
    mb.box(-1.6, 0, 2.6, -0.8, 4.2, 3.4, st); mb.box(0.8, 0, 2.6, 1.6, 4.2, 3.4, st); mb.box(-1.8, 4.2, 2.5, 1.8, 4.9, 3.5, st2, moss);
    for (let k = 0; k < 7; k++) mb.sph(-3 + k, 0.2, 0.5 + hash2(k, 3) * 2, 0.4, 0.3, 0.4, st2, 0);
    return mb; },
  well: () => { const mb = new MB(14); mb.cyl(0, 0, 0, 0.85, 0.85, 0.85, 12, '#b8b0a2', '#968e82'); mb.cyl(0, 0.8, 0, 0.66, 0.66, 0.02, 12, '#3a7ab0');
    mb.box(-0.8, 0, -0.08, -0.65, 2.1, 0.08, '#8a5a32'); mb.box(0.65, 0, -0.08, 0.8, 2.1, 0.08, '#8a5a32'); mb.beam([-0.8, 1.7, 0], [0.8, 1.7, 0], 0.07, '#8a5a32');
    mb.push().ry(Math.PI / 2).roof(0.5, 1.9, 2.05, 0.55, '#d0503a', 0.25).pop(); mb.bc(0.2, 1.3, 0, 0.18, 0.2, 0.18, '#7a4a24'); return mb; },
  fire: () => { const mb = new MB(15); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.sph(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, 0.2, 0.15, 0.2, '#a09a90', 0); }
    mb.beam([-0.5, 0.12, -0.2], [0.5, 0.2, 0.2], 0.14, '#6a4020'); mb.beam([-0.4, 0.2, 0.35], [0.4, 0.12, -0.35], 0.14, '#6a4020');
    mb.em = 1; mb.cyl(0, 0.15, 0, 0.38, 0, 0.95, 8, '#ff6a1a'); mb.cyl(0.05, 0.15, 0, 0.24, 0, 1.3, 7, '#ffb030'); mb.cyl(-0.08, 0.15, 0.05, 0.13, 0, 0.8, 6, '#fff0a0'); return mb; },
  chest: () => mkChestM(false), chestopen: () => mkChestM(true)
};
const STATIC_FAR = {
  oak: () => { const mb = new MB(5); mb.tube([0, 0, 0], [0, 2.2, 0], 0.3, 0.2, 6, '#8a5a32', false); const g = ['#4aa83c', '#5cb848', '#3e9a34'];
    [[0, 3.1, 0, 1.4], [0.9, 2.6, 0.4, 1.0], [-0.8, 2.7, -0.5, 1.0]].forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3], c[3] * 0.86, c[3], g[i], 0, 0, 30 + i)); return mb; },
  pine: () => mkPineM(false, true), snowpine: () => mkPineM(true, true),
  bush: () => { const mb = new MB(11); mb.ico(0, 0.45, 0, 0.7, 0.5, 0.7, '#46a43c', 0, 0, 2); return mb; },
  house: () => mkHouseM(''), housesnow: () => mkHouseM('snow'), housesand: () => mkHouseM('sand')
};
function mkPineM(snow, far) {
  const mb = new MB(3); mb.tube([0, 0, 0], [0, 1.5, 0], 0.22, 0.16, 7, '#8a5a32', false);
  mb.wind = 0.3;
  const g = ['#2f8a44', '#3a9a4c'];
  const nt = far ? 3 : 4, sg = far ? 8 : 10;
  for (let t = 0; t < nt; t++) {
    const tt = far ? t * 1.33 : t, r = 1.65 - tt * 0.36, y = 0.9 + tt * 1.05, h = 1.75 - tt * 0.12;
    mb.cyl(0, y, 0, r, 0, h, sg, g[t % 2], false); mb.cyl(0, y, 0, r, r * 0.9, -0.12, sg, '#26703a', false);
    if (snow) mb.cyl(0, y + h * 0.45, 0, r * 0.58, 0, h * 0.58, sg, '#f4f8ff', false);
  }
  return mb;
}
function mkRockM(k, small) {
  const mb = new MB(21 + k); const base = k === 2 ? '#d8b880' : '#a8a4a0';
  mb.ico(0, 0.35, 0, 0.75, 0.6, 0.68, k === 1 ? (n => n[1] > 0.45 ? '#ffffff' : base) : base, small ? 0.15 : 0.2, 1, 5 + k);
  if (!small) mb.ico(0.5, 0.2, 0.3, 0.4, 0.32, 0.38, k === 1 ? (n => n[1] > 0.5 ? '#ffffff' : '#989490') : '#989490', 0.15, 1, 8);
  return mb;
}
function mkHouseM(v) {
  const mb = new MB(31), snow = v === 'snow', sand = v === 'sand';
  const wall = sand ? '#f0d8a8' : '#fbf2e0', timber = '#8a5a36', roofC = snow ? '#4a7ad0' : sand ? '#d8904a' : '#e05a3e', roofT = snow ? '#ffffff' : null;
  const W = 4.2, D = 3.4, H = 2.5;
  mb.box(-W / 2, 0, -D / 2, W / 2, H, D / 2, wall);
  mb.box(-W / 2 - 0.08, 0, -D / 2 - 0.08, W / 2 + 0.08, 0.38, D / 2 + 0.08, '#b0a898');
  if (!sand) {
    for (const x of [-W / 2, W / 2]) for (const z of [-D / 2 - 0.04, D / 2 + 0.04]) mb.bc(x, H / 2, z, 0.16, H, 0.08, timber);
    for (const z of [-D / 2 - 0.045, D / 2 + 0.045]) { mb.bc(0, H - 0.08, z, W, 0.16, 0.08, timber); mb.bc(0, 1.15, z, W, 0.1, 0.08, timber); }
    mb.push().ry(Math.PI / 2).roof(D, W, H, 1.7, roofC, 0.4).pop();
    if (roofT) mb.push().ry(Math.PI / 2).roof(D * 0.55, W, H + 0.9, 0.85, roofT, 0.42).pop();
    mb.tri([-W / 2, H, -D / 2], [-W / 2, H, D / 2], [-W / 2, H + 1.7, 0], wall); mb.tri([W / 2, H, -D / 2], [W / 2, H, D / 2], [W / 2, H + 1.7, 0], wall);
    mb.box(W / 2 - 1.0, H, -0.7, W / 2 - 0.45, H + 2.4, -0.15, '#b0a898'); mb.box(W / 2 - 1.06, H + 2.3, -0.76, W / 2 - 0.39, H + 2.45, -0.09, '#8a8478');
  } else { mb.box(-W / 2 - 0.12, H, -D / 2 - 0.12, W / 2 + 0.12, H + 0.28, D / 2 + 0.12, roofC); mb.box(-0.6, H + 0.28, -0.6, 0.6, H + 1.1, 0.6, wall); mb.cyl(0, H + 1.1, 0, 0.75, 0, 0.6, 12, '#e0a050'); }
  // door (front = +z)
  mb.box(-0.45, 0.38, D / 2 + 0.01, 0.45, 1.8, D / 2 + 0.06, '#7a4628'); mb.box(-0.55, 1.78, D / 2 + 0.01, 0.55, 1.9, D / 2 + 0.08, timber); mb.sph(0.28, 1.1, D / 2 + 0.08, 0.04, 0.04, 0.03, '#ffd84a', 0);
  // windows glow at night
  mb.em = 1;
  for (const [x, z, r] of [[-1.35, D / 2 + 0.04, 0], [1.35, D / 2 + 0.04, 0], [-1.0, -D / 2 - 0.04, 0], [1.0, -D / 2 - 0.04, 0], [W / 2 + 0.04, 0, 1], [-W / 2 - 0.04, 0, 1]]) {
    if (r) mb.box(x - 0.02, 1.3, z - 0.32, x + 0.02, 1.9, z + 0.32, '#ffc860'); else mb.box(x - 0.32, 1.3, z - 0.02, x + 0.32, 1.9, z + 0.02, '#ffc860');
  }
  mb.em = 0;
  for (const [x, z] of [[-1.35, D / 2 + 0.07], [1.35, D / 2 + 0.07], [-1.0, -D / 2 - 0.07], [1.0, -D / 2 - 0.07]]) { mb.bc(x, 1.6, z, 0.05, 0.62, 0.04, timber); mb.bc(x, 1.6, z, 0.68, 0.05, 0.04, timber); mb.bc(x, 1.27, z, 0.8, 0.06, 0.14, '#5cb848'); }
  return mb;
}
function mkChestM(open) {
  const mb = new MB(41); mb.box(-0.45, 0, -0.3, 0.45, 0.45, 0.3, '#a8662e');
  for (const x of [-0.3, 0.3]) mb.bc(x, 0.23, 0, 0.07, 0.47, 0.62, '#e8c050');
  if (open) { mb.push().tr(0, 0.45, -0.3).rx(-1.9).box(-0.45, 0, 0, 0.45, 0.06, 0.6, '#b8743a').pop(); mb.em = 0.7; mb.bc(0, 0.42, 0, 0.7, 0.04, 0.45, '#ffd84a'); mb.em = 0; }
  else { mb.box(-0.47, 0.45, -0.32, 0.47, 0.62, 0.32, '#b8743a'); mb.bc(0, 0.5, 0.33, 0.13, 0.15, 0.03, '#ffd84a'); }
  return mb;
}
function mkLootM(id) {
  const mb = new MB(51); const it = ITEMS[id];
  if (!it) { mb.sph(0, 0.1, 0, 0.12, 0.08, 0.12, '#ffd84a', 0); return mb; }
  switch (it.type) {
    case 'potion': mb.sph(0, 0.12, 0, 0.13, 0.13, 0.13, '#e8304a'); mb.cyl(0, 0.22, 0, 0.05, 0.05, 0.1, 6, '#f0e8d8'); break;
    case 'ammo': for (let k = -2; k <= 2; k++) mb.beam([k * 0.05, 0.05, -0.35], [k * 0.05, 0.05, 0.35], 0.03, '#c8945a'); mb.bc(0, 0.05, 0.3, 0.24, 0.07, 0.09, '#ffffff'); break;
    case 'armor': mb.sph(0, 0.1, 0, 0.32, 0.12, 0.24, it.color); mb.sph(0, 0.18, 0.1, 0.24, 0.05, 0.12, it.dark); break;
    default: { const s = itemSpec(id); if (s) { mb.push().tr(0, 0.14, 0).rz(Math.PI / 2).tr(-HAND.x, -HAND.y, 0); buildItem(mb, s, 1); mb.pop(); } }
  }
  return mb;
}
function mkCoinsM() { const mb = new MB(52); for (let k = 0; k < 6; k++) mb.cyl(Math.cos(k * 2.1) * 0.12, k * 0.03, Math.sin(k * 2.1) * 0.12, 0.09, 0.09, 0.03, 10, '#ffd84a'); return mb; }
function mkArrowM() { const mb = new MB(53); mb.beam([0, 0, -0.45], [0, 0, 0.45], 0.035, '#c8945a'); mb.tri([-0.07, 0, 0.45], [0.07, 0, 0.45], [0, 0, 0.64], '#e8eef4'); mb.tri([0, -0.07, 0.45], [0, 0.07, 0.45], [0, 0, 0.64], '#c8d0d8'); mb.tri([0, -0.08, -0.45], [0, 0.08, -0.45], [0, 0, -0.28], '#ffffff'); mb.tri([-0.08, 0, -0.45], [0.08, 0, -0.45], [0, 0, -0.28], '#ff6a4a'); return mb; }
function mkBallM(k) { const mb = new MB(54); if (k === 'pball') mb.em = 1; mb.sph(0, 0, 0, 0.1, 0.1, 0.1, k === 'pball' ? '#ffe080' : '#4a4a52', 0); return mb; }
function mkFireballM() { const mb = new MB(55); mb.em = 1; mb.sph(0, 0, 0, 0.34, 0.34, 0.34, '#ff6a1a'); mb.sph(0, 0, 0, 0.22, 0.22, 0.22, '#ffe080', 0); return mb; }
function mkBoulderM(frost) { const mb = new MB(56); mb.ico(0, 0, 0, 0.6, 0.55, 0.6, frost ? '#c8e4f8' : '#a8a098', 0.18, 1, frost ? 9 : 7); return mb; }
