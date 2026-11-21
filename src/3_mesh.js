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
  // tapered box (frustum) centred on x=0: half-width/half-depth w0,d0 at y0 and w1,d1 at y1
  frus(y0, y1, w0, d0, w1, d1, col, z) {
    z = z || 0;
    const p = [[-w0, y0, z - d0], [w0, y0, z - d0], [w1, y1, z - d1], [-w1, y1, z - d1], [-w0, y0, z + d0], [w0, y0, z + d0], [w1, y1, z + d1], [-w1, y1, z + d1]];
    this.quad(p[0], p[1], p[2], p[3], col); this.quad(p[5], p[4], p[7], p[6], col);
    this.quad(p[4], p[0], p[3], p[7], col); this.quad(p[1], p[5], p[6], p[2], col);
    this.quad(p[3], p[2], p[6], p[7], col); this.quad(p[4], p[5], p[1], p[0], col);
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
// rig units: feet 0, hips 0.5, chest 0.9, neck 0.97 (remapped to adult proportions by remapHuman)
const BN = { root: 0, hips: 1, torso: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7, cape: 8, shinL: 9, shinR: 17, hbody: 10, hFL: 11, hFR: 12, hBL: 13, hBR: 14, hneck: 15, htail: 16 };
const PIV = [[0, 0, 0], [0, 0.5, 0], [0, 0.55, 0], [0, 0.97, 0], [0.25, 0.9, 0], [-0.25, 0.9, 0], [0.1, 0.48, 0], [-0.1, 0.48, 0], [0, 0.93, -0.16], [0, 0, 0],
  [0, 1.15, 0], [0.2, 0.98, 0.55], [-0.2, 0.98, 0.55], [0.2, 1.0, -0.55], [-0.2, 1.0, -0.55], [0, 1.4, 0.62], [0, 1.38, -0.82], [0, 0, 0]];
const HAND = { y: 0.5, x: 0.27, z: 0.02 };
// Adult proportions. Humans are modelled in compact "rig units" and then remapped bone by bone:
// legs x1.3 (with a knee bone), torso/arms x1.12, hips raised to match. HANDM is the hand after remapping.
const LEGK = 1.3, TORK = 1.12, LIFT = 0.48 * (LEGK - 1);
const PIV0 = PIV.map(q => q.slice());
const BMAP = {}; // bone -> [old pivot y, new pivot y, vertical scale]
(() => {
  const ty = 0.55, tyN = ty + LIFT, up = y => tyN + (y - ty) * TORK;
  BMAP[BN.root] = [0, LIFT, 1];
  BMAP[BN.hips] = [0.5, 0.5 + LIFT, 1.05];
  BMAP[BN.torso] = [ty, tyN, TORK];
  BMAP[BN.head] = [0.97, up(0.97), 1];
  BMAP[BN.armL] = BMAP[BN.armR] = [0.9, up(0.9), TORK];
  BMAP[BN.cape] = [0.93, up(0.93), 1.18];
  BMAP[BN.legL] = BMAP[BN.legR] = BMAP[BN.shinL] = BMAP[BN.shinR] = [0, 0, LEGK];
  for (const b of [1, 2, 3, 4, 5, 6, 7, 8]) { const m = BMAP[b]; PIV[b][1] = m[1] + (PIV0[b][1] - m[0]) * m[2]; }
  PIV[BN.shinL] = [0.1, 0.3 * LEGK, 0]; PIV[BN.shinR] = [-0.1, 0.3 * LEGK, 0];
})();
const HANDM = { x: HAND.x, y: BMAP[BN.armL][1] + (HAND.y - 0.9) * TORK, z: HAND.z };
function remapHuman(d) {
  for (let i = 0; i < d.length; i += 14) {
    const m = BMAP[d[i + 10]]; if (!m) continue;
    d[i + 1] = m[1] + (d[i + 1] - m[0]) * m[2];
    if (m[2] !== 1) { const nx = d[i + 3], ny = d[i + 4] / m[2], nz = d[i + 5], l = Math.hypot(nx, ny, nz) || 1; d[i + 3] = nx / l; d[i + 4] = ny / l; d[i + 5] = nz / l; }
  }
}
const HUMANS = {
  bandit: { coat: '#8a6a44', pants: '#5a4a34', boots: '#3e2c1c', hat: 'hood', hatC: '#6a4e34', belt: '#3a2614', mask: '#4a3a2c', hair: '#3a2a1a' },
  soldier: { coat: '#a83a32', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'tricorn', lace: '#f4e8b0', cross: true, buttons: true, boots: '#2a2228', scab: 'empty', R: { t: 'sword', col: '#d8e0e8' } },
  ally: { coat: '#36589e', pants: '#f0ece0', facing: '#a83a32', cuff: '#a83a32', hat: 'tricorn', lace: '#ffd84a', buttons: true, boots: '#2a2228', scab: 'empty', R: { t: 'sword', col: '#d8e0e8' } },
  guard: { coat: '#3a7a54', pants: '#e8e0cc', facing: '#ffd84a', hat: 'morion', buttons: true, boots: '#3a2a1a', scab: 'empty', R: { t: 'sword', col: '#d8e0e8' }, L: { t: 'shield', id: 'buckler' } },
  pikeman: { coat: '#9e342c', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'morion', cross: true, boots: '#2a2228', scab: 'full', R: { t: 'pike' } },
  musketeer: { coat: '#a83a32', pants: '#f0ece0', facing: '#2a4aa8', cuff: '#2a4aa8', hat: 'tricorn', lace: '#f4e8b0', cross: true, buttons: true, boots: '#2a2228', scab: 'full', R: { t: 'musket' } },
  archer: { coat: '#b84a32', pants: '#7a6a48', hat: 'hood', hatC: '#5a7a34', straps: true, boots: '#4a3420', L: { t: 'bow' } },
  vampire: { coat: '#3a2450', pants: '#2a1a38', boots: '#18101e', skin: '#ece8f8', hair: '#1a1424', eye: '#ff2a3a', eyeEm: true, cape: '#2a1440', capeIn: '#c81e3a', collar: true, buttons: true },
  witch: { robe: '#7a3aa8', coat: '#6a3098', skin: '#9ad070', hair: '#e8e0f0', eye: '#ffe040', eyeEm: true, hat: 'witch', hatC: '#4a2270', broom: true },
  merchant: { coat: '#3a9a5a', pants: '#7a5a38', apron: '#f4ecd8', hat: 'cap', hatC: '#a86a32', pack: true, buttons: true, hair: '#7a4a24' },
  smith: { coat: '#6a5a4a', pants: '#3a3028', boots: '#2a2018', apron: '#3e2c1e', belt: '#2a1c12', hair: '#2a1e14', skin: '#e0b088' },
  innkeeper: { coat: '#8a6a44', pants: '#4e3e2c', apron: '#e0d6c0', belt: '#4a3018', hair: '#5a3a20', buttons: true },
  quartermaster: { coat: '#36589e', pants: '#e8e0cc', facing: '#a83a32', hat: 'tricorn', lace: '#ffd84a', buttons: true, boots: '#2a2228', pack: true },
  priest: { coat: '#2e2a34', robe: '#2e2a34', skin: '#f0c8a0', hair: '#8a8478', belt: '#c8b070' },
  villager: { coat: '#7a7458', pants: '#5a4a34', hat: 'cap', hatC: '#6a5a3a', belt: '#4a3018', hair: '#4a3020' },
  captive: { coat: '#8a7a62', pants: '#5a4a34', belt: '#4a3018', hair: '#7a4a24', apron: '#c8bca0' },
  stranger: { coat: '#4e4c48', robe: '#46443f', skin: '#e0b898', hat: 'hood', hatC: '#3a3936', beard: '#8a8478', belt: '#2a2218', cape: '#3a3834', capeIn: '#2a2826', R: { t: 'staff', col: '#5a4630' } },
  captain: { coat: '#36589e', pants: '#e8e0cc', facing: '#d8b050', cuff: '#d8b050', hat: 'tricorn', lace: '#e8c050', buttons: true, boots: '#2a2228', sash: '#a83a32', cape: '#2a3a6a', capeIn: '#a83a32', scab: 'full' },
  heir: { coat: '#d8d0c0', pants: '#4a5a7a', boots: '#3a2a1e', hat: 'circlet', hair: '#a8743a', cape: '#2e4a8a', capeIn: '#d8c070', belt: '#8a6a30', buttons: true },
  lord: { coat: '#2a2228', pants: '#d8d0c0', facing: '#a8343a', cuff: '#a8343a', hat: 'tricorn', lace: '#e8c050', buttons: true, boots: '#1a1418', cape: '#6a1418', capeIn: '#2a0a0e', sash: '#e8c050', collar: true, R: { t: 'sword', col: '#e8eef8', tier: 4 }, hair: '#d8d4cc' },
  vlord: { coat: '#4a1420', pants: '#1a0e18', boots: '#120a10', skin: '#f0ecf8', hair: '#0e0a12', eye: '#ff2a3a', eyeEm: true, cape: '#1e0a18', capeIn: '#b81a30', collar: true, buttons: true, hat: 'circlet', crownC: '#8a8a92' },
  ghost: { wisp: true, robe: '#c8d8e8', coat: '#c0d4e6', skin: '#dce8f2', hat: 'hood', hatC: '#b4c8dc', eye: '#8ae8ff', eyeEm: true },
  gremlin: { gremlin: true, scale: 0.62, skin: '#6e7a4e', coat: '#5a4632', pants: '#6e7a4e', boots: '#5e6a42', eye: '#ffd23a', eyeEm: true, belt: '#3a2a1a', rag: '#4a3a2a', R: { t: 'shiv' } },
  gremlin_bomber: { gremlin: true, scale: 0.62, skin: '#7a7450', coat: '#4a3e34', pants: '#7a7450', boots: '#6a6444', eye: '#ffb02a', eyeEm: true, belt: '#3a2a1a', rag: '#5a4030', pack: true, goggles: true, L: { t: 'bomb' } },
  gremlin_shaman: { gremlin: true, scale: 0.66, skin: '#5e6e58', coat: '#3a4a3a', pants: '#5e6e58', boots: '#4e5e48', eye: '#8aff6a', eyeEm: true, hat: 'hood', hatC: '#2e3a2e', bonesN: true, rag: '#2e3a2e', R: { t: 'staff', col: '#4a3a24', skull: true } },
  gremlin_brute: { gremlin: true, brute: true, scale: 1.35, skin: '#5a6440', coat: '#3a3028', pants: '#5a6440', boots: '#4a5236', eye: '#ff6a2a', eyeEm: true, belt: '#2a1e12', rag: '#3a2a1e', pauldron: true, plate: null, spikes: true, R: { t: 'club' } }
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
  return it.type === 'sword' ? { t: 'sword', col: it.col, tier: it.tier } : it.type === 'sword2' ? { t: 'claymore', col: it.col } : it.type === 'bow' ? { t: 'bow' } : it.type === 'shield' ? { t: 'shield', id: it.base || id } : it.type === 'torch' ? { t: 'torch' } : it.type === 'gun' ? { t: 'pistol' } : null;
}
// a held item in the arm's rest frame (arm hangs along -y from the shoulder); hand at HAND
function buildItem(mb, it, side) {
  const hx = side * HAND.x, hy = HAND.y, hz = HAND.z;
  mb.push().tr(hx, hy, hz);
  switch (it.t) {
    case 'sword': case 'claymore': {
      const big = it.t === 'claymore', L = big ? 1.15 : 0.78, bc = hexC(it.col || '#d8e0e8');
      mb.rx(-0.8);
      const bw = big ? 0.045 : 0.032, bt = 0.011;
      mb.tube([0, -0.02, 0], [0, 0.13, 0], 0.026, 0.024, 6, '#4a2c14', true);
      mb.ico(0, 0.16, 0, 0.04, 0.04, 0.04, '#c8a048', 0, 0, 5);
      mb.bc(0, -0.045, 0, big ? 0.34 : 0.24, 0.035, 0.05, '#c8a048');
      mb.box(-bw, -0.06 - L, -bt, bw, -0.065, bt, bc);
      mb.box(-0.008, -0.06 - L * 0.9, -bt - 0.003, 0.008, -0.1, bt + 0.003, bc.map(v => v * 0.72));
      mb.tri([-bw, -0.06 - L, 0], [bw, -0.06 - L, 0], [0, -0.06 - L - (big ? 0.17 : 0.12), 0], bc);
      if (it.tier >= 4) { const e = mb.em; mb.em = 0.7; mb.box(-0.009, -0.06 - L * 0.9, -bt - 0.004, 0.009, -0.1, bt + 0.004, '#ffe080'); mb.em = e; }
      break;
    }
    case 'staff': {
      mb.tube([0, 0.35, 0], [0, -1.45, 0], 0.03, 0.025, 6, it.col || '#5a4630', true);
      if (it.skull) { mb.ico(0, -1.52, 0.02, 0.09, 0.08, 0.1, '#e8e0cc', 0, 0, 7); const e = mb.em; mb.em = 0.8; mb.sph(0.03, -1.52, 0.09, 0.018, 0.018, 0.012, '#8aff6a', 0); mb.sph(-0.03, -1.52, 0.09, 0.018, 0.018, 0.012, '#8aff6a', 0); mb.em = e; for (let k = 0; k < 3; k++) mb.beam([0, -1.4, 0], [Math.cos(k * 2.1) * 0.12, -1.25, Math.sin(k * 2.1) * 0.12], 0.012, '#8a7a5a'); }
      else mb.ico(0, -1.48, 0, 0.06, 0.08, 0.06, '#6a5236', 0, 0, 3);
      break;
    }
    case 'shiv': mb.rx(-0.8); mb.tube([0, -0.02, 0], [0, 0.08, 0], 0.02, 0.02, 5, '#3a2a1a', true); mb.tri([-0.025, -0.02, 0], [0.025, -0.02, 0], [0, -0.3, 0], '#a8a49a'); mb.tri([0, -0.02, -0.02], [0, -0.02, 0.02], [0, -0.3, 0], '#8a867c'); break;
    case 'bomb': { mb.sph(0, -0.06, 0.04, 0.11, 0.11, 0.11, '#2a2a30', 0); mb.tube([0, 0.04, 0.04], [0.03, 0.12, 0.06], 0.012, 0.01, 4, '#c8a060'); const e = mb.em; mb.em = 1; mb.sph(0.03, 0.14, 0.06, 0.03, 0.03, 0.03, '#ffb030', 0); mb.em = e; break; }
    case 'club': mb.rx(0.25); mb.tube([0, 0.08, 0], [0, -0.35, 0], 0.035, 0.045, 6, '#5a3e24', true); mb.tube([0, -0.35, 0], [0, -0.95, 0], 0.05, 0.11, 7, '#6a4a2c', true);
      for (let k = 0; k < 5; k++) { const a = k * 1.3, y = -0.55 - k * 0.08; mb.cyl(Math.cos(a) * 0.09, y, Math.sin(a) * 0.09, 0.025, 0, 0.09, 4, '#b8b4a8'); } break;
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
        const fc = tower ? '#2a4ab0' : '#3e5ea8', x = side * 0.04;
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
  mb.smooth = false; // faceted, angular look
  const skin = s.skin || '#f4c8a0', coat = s.coat || '#9a8a6a', pants = s.pants || '#6a5a42', boots = s.boots || '#3a2a1c';
  // legs + boots
  const gr = !!s.gremlin, lw = gr ? 0.72 : 1;
  for (const side of [1, -1]) {
    if (s.wisp) break;
    const x = side * (gr ? 0.12 : 0.1);
    mb.bone = side > 0 ? BN.legL : BN.legR;
    if (gr) { // bony, bent legs and big clawed feet
      mb.tube([x, 0.48, 0], [x, 0.3, 0.02], 0.07, 0.05, 5, pants, true);
      mb.bone = side > 0 ? BN.shinL : BN.shinR;
      mb.tube([x, 0.31, 0.02], [x, 0.08, -0.03], 0.05, 0.04, 5, pants, true);
      mb.box(x - 0.075, 0, -0.08, x + 0.075, 0.08, 0.14, boots);
      for (let k = -1; k <= 1; k++) mb.tube([x + k * 0.045, 0.03, 0.13], [x + k * 0.06, 0.0, 0.22], 0.022, 0.003, 4, '#d8d0b0');
      continue;
    }
    if (!s.robe) mb.tube([x, 0.48, 0], [x, 0.29, 0.0], 0.095, 0.078, 6, s.greaves ? '#e8eef4' : pants, true);
    mb.bone = side > 0 ? BN.shinL : BN.shinR;
    if (!s.robe) { mb.tube([x, 0.31, 0], [x, 0.12, 0.0], 0.076, 0.062, 6, s.greaves ? '#e8eef4' : pants, true); if (!giant) mb.tube([x, 0.25, 0], [x, 0.09, 0.005], 0.08, 0.082, 6, boots, true); }
    mb.box(x - 0.068, 0, -0.07, x + 0.068, 0.11, 0.15, boots);
  }
  // hips / skirt
  mb.bone = BN.hips;
  if (s.wisp) { // a robe that thins into a trailing wisp instead of legs
    mb.tube([0, 0.12, -0.08], [0, 0.72, 0], 0.05, 0.25, 8, s.robe, false);
    const RR = mulberry(17); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU, r0 = 0.22; mb.tri([Math.cos(a) * r0, 0.55, Math.sin(a) * r0], [Math.cos(a + 0.5) * r0, 0.55, Math.sin(a + 0.5) * r0], [Math.cos(a + 0.25) * 0.12, 0.08 + RR() * 0.25, Math.sin(a + 0.25) * 0.12 - 0.05], s.robe); }
  }
  else if (s.robe) mb.tube([0, 0.02, 0], [0, 0.72, 0], 0.32, 0.2, 10, s.robe, true);
  else if (gr) { mb.box(-0.15, 0.42, -0.11, 0.15, 0.6, 0.11, s.rag || coat); const RR = mulberry(23); for (let k = 0; k < 6; k++) { const x0 = -0.15 + k * 0.05; mb.tri([x0, 0.44, 0.115], [x0 + 0.05, 0.44, 0.115], [x0 + 0.025, 0.3 - RR() * 0.08, 0.12], s.rag || coat); mb.tri([x0 + 0.05, 0.44, -0.115], [x0, 0.44, -0.115], [x0 + 0.025, 0.3 - RR() * 0.08, -0.12], s.rag || coat); } }
  else if (giant) { mb.sph(0, 0.52, 0, 0.27, 0.16, 0.2, s.fur); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; mb.sph(Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.16, 0.08, 0.12, 0.08, s.fur, 0); } mb.tube([0, 0.6, 0], [0, 0.66, 0], 0.27, 0.27, 10, s.belt, true); }
  else {
    mb.box(-0.18, 0.42, -0.13, 0.18, 0.62, 0.13, pants);
    if (!s.plate) mb.tube([0, 0.38, 0], [0, 0.62, 0], 0.24, 0.2, 10, coat, false);
  }
  if (s.apron) mb.box(-0.15, 0.32, 0.17, 0.15, 0.7, 0.19, s.apron);
  // torso
  mb.bone = BN.torso;
  const tw = giant ? 0.28 : gr ? (s.brute ? 0.27 : 0.18) : 0.22;
  mb.frus(0.5, 0.92, tw * 0.8, tw * 0.6, tw * 1.05, tw * 0.68, giant ? skin : coat); mb.frus(0.92, 1.0, tw * 1.05, tw * 0.68, tw * 0.62, tw * 0.5, giant ? skin : coat);
  if (gr) { // hunched back, bare bony chest under a torn vest
    mb.ico(0, 0.9, -0.1, tw * 0.95, 0.13, 0.13, coat, 0.15, 0, 9); mb.frus(0.62, 0.9, tw * 0.5, 0.03, tw * 0.7, 0.03, skin, tw * 0.62);
    for (let k = 0; k < 3; k++) mb.box(-tw * 0.55, 0.66 + k * 0.07, tw * 0.62 + 0.01, tw * 0.55, 0.68 + k * 0.07, tw * 0.62 + 0.03, '#4a5236');
    const RR = mulberry(31); for (let k = 0; k < 5; k++) { const x0 = -tw + k * tw * 0.4; mb.tri([x0, 0.52, tw * 0.62], [x0 + tw * 0.4, 0.52, tw * 0.62], [x0 + tw * 0.2, 0.4 - RR() * 0.06, tw * 0.64], coat); }
    if (s.spikes) for (const sd of [1, -1]) for (let k = 0; k < 3; k++) mb.tube([sd * (0.2 + k * 0.05), 0.98 - k * 0.04, -0.04], [sd * (0.3 + k * 0.07), 1.12 - k * 0.03, -0.1], 0.03, 0.002, 4, '#c8c0a8');
    if (s.bonesN) for (let k = 0; k < 7; k++) { const a = (k / 6 - 0.5) * 2.2; mb.sph(Math.sin(a) * 0.15, 0.93 - Math.cos(a) * 0.06, Math.cos(a) * 0.12 + 0.05, 0.025, 0.035, 0.025, '#e8e0c8', 0); }
  }
  if (s.sash) mb.beam([0.18, 0.93, 0.16], [-0.17, 0.55, 0.15], 0.07, s.sash);
  if (giant) { mb.sph(0, 0.78, 0.1, 0.22, 0.14, 0.12, skin); mb.beam([0.2, 0.92, 0.12], [-0.2, 0.58, 0.14], 0.07, s.fur); }
  if (s.quilt) for (let i = 0; i < 3; i++) mb.bc(0, 0.64 + i * 0.1, tw * 0.66, tw * 1.8, 0.018, 0.02, '#a8844e');
  if (s.mail) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) mb.sph(-0.12 + j * 0.08, 0.6 + i * 0.075, 0.165, 0.03, 0.025, 0.012, '#8a96a2', 0); }
  if (s.plate) { mb.frus(0.56, 0.95, tw * 0.86, tw * 0.68, tw * 1.1, tw * 0.75, s.plate, 0.01); mb.bc(0.07, 0.8, tw * 0.76 + 0.01, 0.04, 0.14, 0.01, '#ffffff'); }
  if (s.pauldron) for (const side of [1, -1]) mb.sph(side * 0.24, 0.9, 0, 0.11, 0.07, 0.12, s.plate || '#dce6f0');
  if (s.facing) { mb.box(0.05, 0.56, 0.155, 0.12, 0.92, 0.17, s.facing); mb.box(-0.12, 0.56, 0.155, -0.05, 0.92, 0.17, s.facing); }
  if (s.cross) { mb.beam([0.18, 0.93, 0.155], [-0.16, 0.54, 0.14], 0.05, '#ffffff'); mb.beam([-0.18, 0.93, 0.16], [0.16, 0.54, 0.145], 0.05, '#ffffff'); }
  if (s.straps) { mb.beam([0.17, 0.92, 0.155], [-0.15, 0.56, 0.14], 0.045, '#4a2e16'); }
  if (s.buttons) for (let i = 0; i < 3; i++) mb.sph(0, 0.62 + i * 0.1, 0.175, 0.022, 0.022, 0.015, '#ffd84a', 0);
  if (s.belt || s.cross) mb.bc(0, 0.585, 0, tw * 1.72, 0.06, tw * 1.3, s.belt || '#3a2414');
  if (s.collar) { mb.box(0.08, 0.9, -0.12, 0.2, 1.1, 0.06, s.capeIn || s.cape); mb.box(-0.2, 0.9, -0.12, -0.08, 1.1, 0.06, s.capeIn || s.cape); }
  if (s.pack && gr) { mb.box(-0.14, 0.62, -0.3, 0.14, 0.92, -0.12, '#6a4a2a'); for (let k = 0; k < 3; k++) mb.sph(-0.08 + k * 0.08, 0.96, -0.2, 0.06, 0.06, 0.06, '#2a2a30', 0); }
  else if (s.pack) mb.sph(0, 0.76, -0.2, 0.18, 0.2, 0.1, '#8a6034');
  // head (big, round)
  mb.bone = BN.head;
  const hr = giant ? 0.3 : 0.33, hy = giant ? 1.18 : gr ? 1.16 : 1.23, headStart = mb.d.length;
  if (gr) mb.ico(0, hy, 0.02, hr * 1.06, hr * 0.84, hr * 0.98, skin, 0.08, 1, 12); else
  mb.sph(0, hy, 0, hr, hr * 0.96, hr * 0.94, skin);
  if (gr) {
    for (const sd of [1, -1]) { mb.tube([sd * hr * 0.8, hy + 0.04, -0.02], [sd * hr * 2.15, hy + 0.3, -0.14], 0.11, 0.005, 4, skin); mb.tube([sd * hr * 0.84, hy + 0.05, 0.0], [sd * hr * 1.9, hy + 0.27, -0.1], 0.06, 0.004, 4, '#a86a5a'); }
    mb.tube([0, hy - 0.02, hr * 0.85], [0, hy - 0.14, hr * 1.42], 0.075, 0.012, 5, skin);
    mb.box(-0.15, hy + 0.08, hr * 0.8, 0.15, hy + 0.13, hr * 0.95, '#3a3a24');
    mb.box(-0.15, hy - 0.2, hr * 0.78, 0.15, hy - 0.15, hr * 0.92, '#2a1a14');
    for (let k = 0; k < 5; k++) { const x = -0.12 + k * 0.06; mb.tri([x - 0.022, hy - 0.15, hr * 0.93], [x + 0.022, hy - 0.15, hr * 0.93], [x, hy - 0.2 + (k % 2) * 0.02, hr * 0.95], '#ece4cc'); }
    if (s.goggles) { mb.box(-0.26, hy + 0.12, -0.2, 0.26, hy + 0.17, hr * 0.84, '#3a2a1a'); for (const sd of [1, -1]) { mb.cyl(sd * 0.11, hy + 0.1, hr * 0.84, 0.07, 0.07, 0.05, 7, '#8a7a5a'); } }
  }
  // face: big dark eyes with a white catch-light, small mouth, blush
  const eye = s.eye || '#1e1624', ez = hr * 0.9, ey = hy + 0.01;
  { const e = mb.em, er = gr ? 2.1 : 1; if (s.eyeEm) mb.em = 1; mb.sph(0.1 * (gr ? 1.12 : 1), ey, ez, 0.034 * er, 0.042 * er * 0.8, 0.022, eye, 0); mb.sph(-0.1 * (gr ? 1.12 : 1), ey, ez, 0.034 * er, 0.042 * er * 0.8, 0.022, eye, 0); mb.em = e; }
  if (!s.eyeEm && !giant) { const bc = s.hair || '#3a2414'; mb.box(0.045, ey + 0.065, ez - 0.02, 0.165, ey + 0.092, ez + 0.022, bc); mb.box(-0.165, ey + 0.065, ez - 0.02, -0.045, ey + 0.092, ez + 0.022, bc); }
  if (!gr) { mb.sph(0, hy - 0.05, hr * 0.96, 0.042, 0.06, 0.05, skin);
    mb.box(-0.05, hy - 0.145, hr * 0.9 - 0.01, 0.05, hy - 0.13, hr * 0.9 + 0.012, giant ? '#3a1a10' : '#6a3028'); }
  if (s.beard && giant) { mb.sph(0, hy - 0.2, 0.16, 0.24, 0.2, 0.16, s.beard); mb.sph(0, hy - 0.36, 0.14, 0.15, 0.14, 0.11, s.beard); }
  else if (s.beard) { mb.ico(0, hy - 0.17, 0.2, 0.22, 0.17, 0.13, s.beard, 0.1, 0, 4); mb.ico(0, hy - 0.34, 0.17, 0.13, 0.14, 0.09, s.beard, 0.1, 0, 5); }
  const hair = s.hair || '#5a3a1e';
  const helm = s.hat === 'great' || s.hat === 'sallet' || s.hat === 'coif' || gr;
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
    case 'circlet': mb.cyl(0, hy + 0.13, 0, hr * 1.06, hr * 1.06, 0.07, 12, s.crownC || '#d8b050', false); for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; mb.cyl(Math.cos(a) * hr * 1.06, hy + 0.2, Math.sin(a) * hr * 1.06, 0.035, 0, 0.1, 4, s.crownC || '#d8b050'); } { const e = mb.em; mb.em = 0.6; mb.sph(0, hy + 0.17, hr * 1.08, 0.035, 0.035, 0.02, s.crownC ? '#c81e3a' : '#4a7ae8', 0); mb.em = e; } break;
    case 'witch': mb.cyl(0, hy + 0.2, 0, 0.5, 0.5, 0.03, 14, s.hatC); mb.push().tr(0, hy + 0.2, 0).rx(-0.2).cyl(0, 0, 0, 0.28, 0.0, 0.72, 10, s.hatC).pop(); mb.cyl(0, hy + 0.21, 0, 0.29, 0.27, 0.07, 10, '#e8c050'); break;
  }
  if (s.hair && s.hat === 'witch') mb.sph(0, hy - 0.08, -0.2, 0.3, 0.36, 0.12, s.hair);
  { // shrink the whole head group (head, face, hair, hat) about its centre; keep the bottom on the neck
    const k = giant ? 0.8 : gr ? (s.brute ? 0.66 : 0.82) : 0.6, bottom = hy - hr * 0.96, ny = bottom + hr * 0.96 * k;
    for (let i = headStart; i < mb.d.length; i += 14) { mb.d[i] *= k; mb.d[i + 1] = ny + (mb.d[i + 1] - hy) * k; mb.d[i + 2] *= k; }
  }
  // arms
  for (const side of [1, -1]) {
    mb.bone = side > 0 ? BN.armL : BN.armR;
    const x = side * (giant ? 0.3 : gr ? tw + 0.06 : 0.27), ar = giant ? 0.1 : gr ? (s.brute ? 0.085 : 0.05) : 0.068;
    const sleeve = giant ? skin : gr ? skin : s.plateArms ? '#e8eef4' : s.robe ? s.coat : coat;
    mb.tube([x, 0.92, 0], [x, 0.58, 0], ar * 1.08, ar * 0.86, 6, sleeve, true); mb.ico(x, 0.89, 0, ar * 1.25, ar * 1.1, ar * 1.25, gr ? s.rag || coat : sleeve, 0, 0, 3);
    if (s.cuff) mb.tube([x, 0.6, 0], [x, 0.56, 0], ar + 0.015, ar + 0.015, 6, s.cuff, true);
    mb.bc(x, HAND.y + 0.02, HAND.z, ar * 1.6, ar * 1.9, ar * 1.7, s.plateArms ? '#c8d2dc' : skin);
    if (gr) for (let k = -1; k <= 1; k++) mb.tube([x + k * ar * 0.5, HAND.y - 0.04, HAND.z + 0.02], [x + k * ar * 0.7, HAND.y - 0.14, HAND.z + 0.07], 0.016, 0.002, 4, '#e0d8c0');
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
  if (s.scab) buildSheath(mb, [{ slot: 'hip', side: 1, full: s.scab === 'full' }]);
  if (s.sheath) buildSheath(mb, s.sheath);
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
  remapHuman(mb.d);
  const ks = s.scale || (giant ? 3.0 : 1);
  if (ks !== 1) for (let i = 0; i < mb.d.length; i += 14) { mb.d[i] *= ks; mb.d[i + 1] *= ks; mb.d[i + 2] *= ks; }
  return mb;
}
// weapons worn on the body (rig units): sword scabbards on the hip, claymore / bow / shield on the back, quiver, pistol holster
function buildSheath(mb, list) {
  const leather = '#3a2616', metal = '#c8b070';
  const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const hilt = (top, dir, len, guard, gripC, bladeTier) => {
    const g1 = [top[0] + dir[0] * len, top[1] + dir[1] * len, top[2] + dir[2] * len];
    mb.beam([top[0] - guard, top[1], top[2]], [top[0] + guard, top[1], top[2]], 0.034, bladeTier >= 4 ? '#ffe080' : '#c8a048');
    mb.tube(top, g1, 0.024, 0.022, 5, gripC || '#5a3418', true);
    mb.sph(g1[0], g1[1], g1[2], 0.035, 0.035, 0.035, '#c8a048', 0);
  };
  for (const w of list) {
    const it = w.it || {}, sd = w.side || 1;
    switch (w.slot) {
      case 'hip': {
        mb.bone = BN.hips;
        const top = [sd * 0.22, 0.6, 0.1], bot = [sd * 0.31, 0.1, -0.34];
        mb.tube(top, bot, 0.042, 0.03, 6, leather, true);
        mb.tube(top, [lerp(top[0], bot[0], 0.07), lerp(top[1], bot[1], 0.07), lerp(top[2], bot[2], 0.07)], 0.05, 0.05, 6, metal, true);
        mb.sph(bot[0], bot[1], bot[2], 0.036, 0.04, 0.036, metal, 0);
        mb.beam([sd * 0.2, 0.6, 0.12], [sd * 0.16, 0.66, 0.0], 0.03, leather);
        if (w.full) hilt(top, nrm([top[0] - bot[0], top[1] - bot[1], top[2] - bot[2]]), 0.16, 0.09, null, it.tier || 0);
        break;
      }
      case 'back2': {
        mb.bone = BN.torso;
        const top = [0.27, 0.98, -0.25], bot = [-0.3, 0.12, -0.28];
        mb.tube(top, bot, 0.05, 0.038, 6, leather, true);
        mb.sph(bot[0], bot[1], bot[2], 0.044, 0.05, 0.044, metal, 0);
        mb.beam([0.22, 0.95, 0.16], [-0.22, 0.6, 0.17], 0.04, leather);
        if (w.full) hilt(top, nrm([top[0] - bot[0], top[1] - bot[1], top[2] - bot[2]]), 0.28, 0.16, null, 0);
        break;
      }
      case 'bowback': {
        mb.bone = BN.torso;
        const a = [-0.3, 1.06, -0.25], b = [0.3, 0.26, -0.25], N = 8; let prev = null;
        for (let i = 0; i <= N; i++) { const t = i / N, bow = Math.sin(t * Math.PI) * 0.14, p = [lerp(a[0], b[0], t) + bow * 0.6, lerp(a[1], b[1], t) + bow * 0.45, -0.25 - bow * 0.5]; if (prev) mb.tube(prev, p, 0.03, 0.03, 5, '#9a6232'); prev = p; }
        mb.beam(a, b, 0.012, '#fff8e0');
        break;
      }
      case 'quiver': {
        mb.bone = BN.torso;
        const top = [-0.13, 1.02, -0.25], bot = [-0.22, 0.5, -0.28];
        mb.tube(bot, top, 0.07, 0.075, 8, '#6a4224', true);
        mb.tube(top, [-0.12, 1.06, -0.25], 0.08, 0.08, 8, '#3a2414', true);
        for (let k = 0; k < 4; k++) { const ox = (k % 2 ? 0.03 : -0.03), oz = (k < 2 ? 0.025 : -0.025); const q = [top[0] + ox, top[1] + 0.12, top[2] + oz]; mb.beam([top[0] + ox, top[1], top[2] + oz], q, 0.016, '#c8945a'); mb.tri([q[0] - 0.035, q[1] - 0.06, q[2]], [q[0] + 0.035, q[1] - 0.06, q[2]], [q[0], q[1] + 0.03, q[2]], k % 2 ? '#e8e0d0' : '#a8403a'); }
        mb.beam([0.2, 0.95, 0.15], [-0.18, 0.56, 0.16], 0.035, leather);
        break;
      }
      case 'shback': {
        mb.bone = BN.torso;
        const id = it.id;
        if (id === 'buckler') { mb.push().tr(0, 0.72, -0.24).rx(-Math.PI / 2).cyl(0, 0, 0, 0.26, 0.26, 0.06, 12, '#a86a32', '#c88a48').cyl(0, 0.06, 0, 0.1, 0.06, 0.04, 10, '#d8dde2').pop(); }
        else {
          const tower = id === 'tower_shield', W = tower ? 0.34 : 0.28, top = 0.72 + (tower ? 0.46 : 0.36), bot = 0.72 + (tower ? -0.56 : -0.48), z = -0.27;
          const fc = tower ? '#2a4ab0' : '#3e5ea8';
          const pts = tower ? [[-W, top], [W, top], [W, bot], [-W, bot]] : [[-W, top], [W, top], [W, 0.67], [0, bot], [-W, 0.67]];
          for (let i = 1; i < pts.length - 1; i++) mb.tri([pts[0][0], pts[0][1], z], [pts[i + 1][0], pts[i + 1][1], z], [pts[i][0], pts[i][1], z], fc);
          for (let i = 0; i < pts.length; i++) { const p0 = pts[i], p1 = pts[(i + 1) % pts.length]; mb.beam([p0[0], p0[1], z - 0.01], [p1[0], p1[1], z - 0.01], 0.05, '#c8a048'); }
          mb.bc(0, (top + bot) / 2 + 0.06, z - 0.012, 0.06, (top - bot) * 0.62, 0.012, '#e8c050'); mb.bc(0, (top + bot) / 2 + 0.14, z - 0.012, W * 1.3, 0.06, 0.012, '#e8c050');
        }
        break;
      }
      case 'holster': {
        mb.bone = BN.hips;
        mb.box(sd * 0.2, 0.36, 0.0, sd * 0.29, 0.6, 0.12, leather);
        if (w.full) { mb.push().tr(sd * 0.245, 0.6, 0.06).rx(-0.5).box(-0.03, 0, -0.03, 0.03, 0.14, 0.04, '#8a5a2e').pop(); }
        break;
      }
    }
  }
}
function buildHorse(o) {
  const mb = new MB(33); mb.smooth = false;
  const coat = o.coat || '#a86a3a', dark = o.dark || '#3a2414', cloth = o.cloth || '#36589e';
  mb.bone = BN.hbody;
  mb.sph(0, 1.15, 0, 0.38, 0.36, 0.82, coat);
  mb.sph(0, 1.2, 0.45, 0.36, 0.36, 0.38, coat); mb.sph(0, 1.2, -0.5, 0.38, 0.36, 0.38, coat);
  if (o.saddle) { mb.sph(0, 1.48, -0.02, 0.4, 0.06, 0.42, cloth); mb.sph(0, 1.54, -0.05, 0.27, 0.1, 0.3, '#6a3a1c'); mb.sph(0, 1.62, -0.25, 0.18, 0.08, 0.05, '#6a3a1c'); mb.bc(0.34, 1.18, 0, 0.02, 0.36, 0.04, '#3a2414'); mb.bc(-0.34, 1.18, 0, 0.02, 0.36, 0.04, '#3a2414'); }
  for (const [b, lb, x, z] of [[BN.hFL, 1, 0.2, 0.55], [BN.hFR, 2, -0.2, 0.55], [BN.hBL, 3, 0.2, -0.55], [BN.hBR, 4, -0.2, -0.55]]) {
    mb.bone = b; const kneeY = HPIVL[lb][1];
    mb.tube([x, 1.0, z], [x, kneeY, z], z > 0 ? 0.11 : 0.13, 0.075, 6, coat, true);
    mb.bone = lb;
    mb.tube([x, kneeY + 0.02, z], [x, 0.15, z], 0.072, 0.06, 6, coat, true);
    mb.sph(x, 0.19, z + 0.01, 0.085, 0.07, 0.09, coat, 0);
    if (o.stockings) mb.tube([x, 0.42, z], [x, 0.14, z], 0.085, 0.09, 8, '#f4f0e6', false);
    mb.sph(x, 0.07, z + 0.02, 0.1, 0.08, 0.12, dark, 0);
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
const HPIVL = { 1: [0.2, 0.52, 0.55], 2: [-0.2, 0.52, 0.55], 3: [0.2, 0.56, -0.55], 4: [-0.2, 0.56, -0.55] };
const STATIC_BUILD = {
  pine: () => mkPineM(false), snowpine: () => mkPineM(true),
  oak: () => { const mb = new MB(5); mb.tube([0, 0, 0], [0, 2.2, 0], 0.3, 0.2, 8, '#8a5a32', false); for (const a of [0.4, 2.3, 4.2]) mb.tube([0, 1.6, 0], [Math.cos(a) * 0.7, 2.4, Math.sin(a) * 0.7], 0.1, 0.07, 6, '#8a5a32');
    mb.wind = 0.4; const g = ['#4e7a3a', '#5a8644', '#466f36'];
    [[0, 3.1, 0, 1.3], [0.95, 2.6, 0.3, 0.95], [-0.85, 2.7, -0.4, 1.0], [0.25, 2.5, -1.0, 0.9], [-0.3, 2.55, 0.95, 0.9], [0.2, 3.75, 0.1, 0.85], [0.8, 3.35, -0.6, 0.7], [-0.75, 3.4, 0.55, 0.7], [1.1, 2.2, 0.9, 0.6], [-1.1, 2.3, -0.9, 0.6]].forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3], c[3] * 0.82, c[3], g[i % 3], 0.16, 1, 60 + i));
    return mb; },
  deadtree: () => { const mb = new MB(6); const c = '#7a6a5a'; mb.tube([0, 0, 0], [0, 3.3, 0], 0.22, 0.07, 6, c); const R = mulberry(9);
    const br = (p, a, el, L, w, d) => { const q = [p[0] + Math.cos(a) * Math.cos(el) * L, p[1] + Math.sin(el) * L, p[2] + Math.sin(a) * Math.cos(el) * L]; mb.tube(p, q, w, w * 0.6, 5, c); if (d) { br(q, a + 0.6, el + 0.1, L * 0.6, w * 0.7, d - 1); br(q, a - 0.6, el - 0.1, L * 0.6, w * 0.7, d - 1); } };
    for (let k = 0; k < 4; k++) br([0, 1.6 + k * 0.45, 0], k * 1.9 + R(), 0.5, 1.0 - k * 0.15, 0.09, 1); return mb; },
  palm: () => { const mb = new MB(8); let x = 0; for (let i = 0; i < 9; i++) { const nx = Math.sin(i * 0.35) * 0.35; mb.tube([x, i * 0.5, 0], [nx, (i + 1) * 0.5, 0], 0.15, 0.14, 7, i % 2 ? '#b8905a' : '#a07a48'); x = nx; }
    mb.wind = 0.8; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; let p = [x, 4.5, 0]; for (let s = 1; s <= 4; s++) { const q = [x + Math.cos(a) * s * 0.55, 4.6 + Math.sin(s * 0.7) * 0.5 - s * s * 0.1, Math.sin(a) * s * 0.55]; mb.tube(p, q, 0.16 - s * 0.025, 0.13 - s * 0.025, 4, k % 2 ? '#4e7e3e' : '#44703a'); p = q; } } mb.sph(x, 4.45, 0, 0.18, 0.15, 0.18, '#7a5a2a', 0); return mb; },
  bush: () => { const mb = new MB(11); mb.wind = 0.3; const R = mulberry(4); for (let k = 0; k < 8; k++) mb.ico((R() - 0.5) * 0.85, 0.32 + R() * 0.3, (R() - 0.5) * 0.85, 0.3 + R() * 0.12, 0.28, 0.3 + R() * 0.12, k % 2 ? '#45703a' : '#52803e', 0.16, 1, 80 + k);
    for (let k = 0; k < 6; k++) { const a = k * 1.1; mb.sph(Math.cos(a) * 0.5, 0.58 + (k % 3) * 0.12, Math.sin(a) * 0.5, 0.07, 0.07, 0.07, '#a8404a', 0); } return mb; },
  rock: () => mkRockM(0), rocksnow: () => mkRockM(1), rocksand: () => mkRockM(2), pebble: () => mkRockM(0, true), pebblesnow: () => mkRockM(1, true), pebblesand: () => mkRockM(2, true),
  tuft: () => { const mb = new MB(71); mb.wind = 1; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + 0.3, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08; mb.tri([x - 0.04, 0, z], [x + 0.04, 0, z], [x * 3, 0.42 + (k % 2) * 0.12, z * 3], '#5a8644'); mb.tri([x, 0, z - 0.04], [x, 0, z + 0.04], [x * 3, 0.42 + (k % 2) * 0.12, z * 3], '#4e7a3a'); } return mb; },
  flower: () => { const mb = new MB(72); mb.wind = 1; mb.tube([0, 0, 0], [0, 0.32, 0], 0.015, 0.015, 4, '#4e7a3a'); const cols = ['#ffffff', '#ffe04a', '#ff7ab0'];
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; mb.sph(Math.cos(a) * 0.07, 0.34, Math.sin(a) * 0.07, 0.05, 0.02, 0.05, cols[0], 0); } mb.sph(0, 0.35, 0, 0.035, 0.025, 0.035, '#ffd030', 0); return mb; },
  flower2: () => { const mb = new MB(73); mb.wind = 1; mb.tube([0, 0, 0], [0, 0.3, 0], 0.015, 0.015, 4, '#4e7a3a');
    for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; mb.sph(Math.cos(a) * 0.07, 0.32, Math.sin(a) * 0.07, 0.05, 0.02, 0.05, '#ff6a9a', 0); } mb.sph(0, 0.33, 0, 0.035, 0.025, 0.035, '#fff0a0', 0); return mb; },
  reed: () => { const mb = new MB(74); mb.wind = 1; for (let k = 0; k < 4; k++) { const a = k * 1.7, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1; mb.tube([x, 0, z], [x * 1.5, 0.9 + k * 0.08, z * 1.5], 0.02, 0.012, 4, '#8aa84a'); if (k % 2) mb.cap([x * 1.5, 0.75 + k * 0.08, z * 1.5], [x * 1.5, 0.92 + k * 0.08, z * 1.5], 0.035, '#7a4a2a', 5); } return mb; },
  menhir: () => { const mb = new MB(12); mb.ico(0, 1.4, 0, 0.45, 1.55, 0.32, '#a8a49c', 0.08, 1, 4); mb.bc(0, 1.5, 0.31, 0.06, 0.8, 0.02, '#5ad0ff'); mb.bc(0, 1.7, 0.31, 0.3, 0.06, 0.02, '#5ad0ff'); return mb; },
  ruin: () => { const mb = new MB(13), st = '#a8a296', st2 = '#968e82', moss = '#5cac48';
    const wall = (x0, z0, x1, z1, h) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, hh = h * (0.4 + 0.6 * hash2(i * 7 + x0 * 3, z0 * 5)); mb.box(Math.min(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) - 0.2, 0, Math.min(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) - 0.2, Math.max(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) + 0.2, hh, Math.max(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) + 0.2, i % 2 ? st : st2, moss); } };
    wall(-4, -3, 4, -3, 4.5); wall(-4, -3, -4, 3, 3.2); wall(4, -3, 4, 1, 2.6);
    mb.box(-1.6, 0, 2.6, -0.8, 4.2, 3.4, st); mb.box(0.8, 0, 2.6, 1.6, 4.2, 3.4, st); mb.box(-1.8, 4.2, 2.5, 1.8, 4.9, 3.5, st2, moss);
    for (let k = 0; k < 7; k++) mb.sph(-3 + k, 0.2, 0.5 + hash2(k, 3) * 2, 0.4, 0.3, 0.4, st2, 0);
    return mb; },
  well: () => { const mb = new MB(14); mb.cyl(0, 0, 0, 0.85, 0.85, 0.85, 12, '#b8b0a2', '#968e82'); mb.cyl(0, 0.8, 0, 0.66, 0.66, 0.02, 12, '#3a7ab0');
    mb.box(-0.8, 0, -0.08, -0.65, 2.1, 0.08, '#8a5a32'); mb.box(0.65, 0, -0.08, 0.8, 2.1, 0.08, '#8a5a32'); mb.beam([-0.8, 1.7, 0], [0.8, 1.7, 0], 0.07, '#8a5a32');
    mb.push().ry(Math.PI / 2).roof(0.7, 1.9, 2.05, 0.55, '#7e4a3a', 0.25).pop(); mb.bc(0.2, 1.3, 0, 0.18, 0.2, 0.18, '#7a4a24'); return mb; },
  fire: () => { const mb = new MB(15); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.sph(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, 0.2, 0.15, 0.2, '#a09a90', 0); }
    mb.beam([-0.5, 0.12, -0.2], [0.5, 0.2, 0.2], 0.14, '#6a4020'); mb.beam([-0.4, 0.2, 0.35], [0.4, 0.12, -0.35], 0.14, '#6a4020');
    mb.em = 1; mb.cyl(0, 0.15, 0, 0.38, 0, 0.95, 8, '#ff6a1a'); mb.cyl(0.05, 0.15, 0, 0.24, 0, 1.3, 7, '#ffb030'); mb.cyl(-0.08, 0.15, 0.05, 0.13, 0, 0.8, 6, '#fff0a0'); return mb; },
  chest: () => mkChestM(false), chestopen: () => mkChestM(true)
};
const STATIC_FAR = {
  oak: () => { const mb = new MB(5); mb.tube([0, 0, 0], [0, 2.2, 0], 0.3, 0.2, 6, '#8a5a32', false); const g = ['#4e7a3a', '#5a8644', '#466f36'];
    [[0, 3.1, 0, 1.4], [0.9, 2.6, 0.4, 1.0], [-0.8, 2.7, -0.5, 1.0]].forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3], c[3] * 0.86, c[3], g[i], 0, 0, 30 + i)); return mb; },
  pine: () => mkPineM(false, true), snowpine: () => mkPineM(true, true),
  bush: () => { const mb = new MB(11); mb.ico(0, 0.45, 0, 0.7, 0.5, 0.7, '#4e7a3c', 0, 0, 2); return mb; }
};
function mkPineM(snow, far) {
  const mb = new MB(3); mb.tube([0, 0, 0], [0, 1.5, 0], 0.22, 0.16, 7, '#8a5a32', false);
  mb.wind = 0.3;
  const g = ['#2f6640', '#3a7446'];
  const nt = far ? 3 : 4, sg = far ? 8 : 10;
  for (let t = 0; t < nt; t++) {
    const tt = far ? t * 1.33 : t, r = 1.65 - tt * 0.36, y = 0.9 + tt * 1.05, h = 1.75 - tt * 0.12;
    mb.cyl(0, y, 0, r, 0, h, sg, g[t % 2], false); mb.cyl(0, y, 0, r, r * 0.9, -0.12, sg, '#245238', false);
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
    case 'potion':
      if (id === 'bandage') { mb.push().tr(0, 0.1, 0).rz(Math.PI / 2).cyl(0, -0.14, 0, 0.1, 0.1, 0.28, 10, '#ece4d0', '#d8ccb0').pop(); mb.bc(0.05, 0.1, 0.1, 0.06, 0.18, 0.02, '#c84a3a'); mb.tri([0.14, 0.02, 0.08], [0.14, 0.18, 0.08], [0.3, 0.0, 0.1], '#ece4d0'); }
      else { mb.sph(0, 0.12, 0, 0.13, 0.13, 0.13, '#e8304a'); mb.cyl(0, 0.22, 0, 0.05, 0.05, 0.1, 6, '#f0e8d8'); mb.cyl(0, 0.32, 0, 0.055, 0.055, 0.04, 6, '#8a5a2e'); }
      break;
    case 'ammo': for (let k = -2; k <= 2; k++) mb.beam([k * 0.05, 0.05, -0.35], [k * 0.05, 0.05, 0.35], 0.03, '#c8945a'); mb.bc(0, 0.05, 0.3, 0.24, 0.07, 0.09, '#ffffff'); break;
    case 'armor': mb.push().tr(0, 0.06, 0).rx(-Math.PI / 2).sc(0.55).tr(0, -0.55, 0); mkArmorIcon(mb, it); mb.pop(); break;
    case 'mat': mkMatMesh(mb, it.id); break;
    default: { const s = itemSpec(id); if (s) { mb.push().tr(0, 0.14, 0).rz(Math.PI / 2).tr(-HAND.x, -HAND.y, 0); buildItem(mb, s, 1); mb.pop(); } }
  }
  return mb;
}
// a little cuirass on a stand: torso, shoulders, belt, helm for the heavier sets (rig units, feet at 0)
function mkArmorIcon(mb, it) {
  const c = it.color, d = it.dark, l = it.legs || d, plate = it.def >= 0.4;
  mb.frus(0.5, 0.92, 0.2, 0.13, 0.27, 0.15, c);
  mb.frus(0.36, 0.52, 0.22, 0.14, 0.2, 0.13, l);
  mb.bc(0, 0.53, 0, 0.44, 0.06, 0.3, d);
  mb.bc(0, 0.53, 0.152, 0.07, 0.07, 0.01, '#e8c050');
  for (const sd of [-1, 1]) { mb.sph(sd * 0.29, 0.88, 0, 0.11, 0.08, 0.13, plate ? d : c, 0); }
  if (plate) { mb.push().tr(0.32, 0, 0); mb.frus(0.58, 0.84, 0.06, 0.06, 0.07, 0.07, c); mb.pop(); mb.push().tr(-0.32, 0, 0); mb.frus(0.58, 0.84, 0.06, 0.06, 0.07, 0.07, c); mb.pop(); }
  mb.bc(0, 0.72, 0.15, 0.03, 0.34, 0.01, d);
  if (it.helm) { mb.sph(0, 1.06, 0, 0.13, 0.13, 0.14, c, 1); mb.bc(0, 1.03, 0.12, 0.2, 0.025, 0.04, '#2a2a30'); if (it.def >= 0.6) mb.cyl(0, 1.17, 0, 0.02, 0.0, 0.14, 5, '#d0453a'); }
  else mb.cyl(0, 0.92, 0, 0.07, 0.06, 0.06, 7, '#e8c39e');
}
// crafting materials (rig-ish units, resting on y = 0)
function mkMatMesh(mb, id) {
  switch (id) {
    case 'iron_ore': mb.ico(0, 0.16, 0, 0.22, 0.17, 0.2, '#6e6862', 0.25, 0, 31); for (let k = 0; k < 5; k++) { const a = k * 1.3, r = 0.15; mb.ico(Math.cos(a) * r, 0.18 + (k % 2) * 0.08, Math.sin(a) * r, 0.06, 0.05, 0.06, k % 2 ? '#c87a3a' : '#a85a2a', 0.2, 0, 40 + k); } break;
    case 'silver': mb.ico(0, 0.12, 0, 0.16, 0.12, 0.15, '#7a7a82', 0.25, 0, 33); { const e = mb.em; mb.em = 0.35; for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.4; mb.ico(Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1, 0.07, 0.06, 0.07, '#f0f6ff', 0.2, 0, 50 + k); } mb.em = e; } break;
    case 'steel_ingot': for (const [x, y] of [[-0.12, 0], [0.12, 0], [0, 0.11]]) { mb.push().tr(x, y, 0); mb.frus(0, 0.1, 0.11, 0.2, 0.08, 0.16, '#c8d4e0'); mb.pop(); } break;
    case 'leather_hide': { const pts = [[-0.3, -0.2], [0.05, -0.28], [0.3, -0.18], [0.26, 0.2], [-0.05, 0.3], [-0.3, 0.16]]; for (let i = 1; i < pts.length - 1; i++) mb.tri([pts[0][0], 0.05, pts[0][1]], [pts[i][0], 0.05 + i * 0.012, pts[i][1]], [pts[i + 1][0], 0.05 + i * 0.012, pts[i + 1][1]], '#a8703e'); mb.push().tr(-0.1, 0.08, 0).rz(Math.PI / 2).cyl(0, -0.2, 0, 0.07, 0.07, 0.42, 8, '#8a5830', '#c89060').pop(); break; }
    case 'wood': for (const [x, y, z] of [[-0.1, 0.08, 0], [0.1, 0.08, 0], [0, 0.24, 0]]) { mb.push().tr(x, y, z).rx(Math.PI / 2).cyl(0, -0.3, 0, 0.09, 0.09, 0.6, 7, '#8a5a32', '#d0a870').pop(); } break;
    case 'cloth': mb.push().tr(0, 0.1, 0).rz(Math.PI / 2).cyl(0, -0.26, 0, 0.12, 0.12, 0.52, 10, '#e0d6bc', '#c8bc9a').pop(); mb.box(-0.27, 0.0, 0.05, 0.27, 0.02, 0.3, '#d8ccb0'); mb.bc(0, 0.1, 0, 0.06, 0.25, 0.25, '#b8403a'); break;
    case 'herb': for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, c = Math.cos(a), sn = Math.sin(a); mb.tri([0, 0.02, 0], [c * 0.08 - sn * 0.06, 0.12, sn * 0.08 + c * 0.06], [c * 0.3, 0.2 + (k % 2) * 0.1, sn * 0.3], k % 2 ? '#5aa040' : '#78c050'); } mb.cyl(0, 0, 0, 0.025, 0.02, 0.18, 5, '#5a7a30'); mb.sph(0, 0.2, 0, 0.05, 0.05, 0.05, '#e8e070', 0); break;
    case 'scrap': mb.cyl(-0.08, 0.02, 0, 0.13, 0.13, 0.05, 8, '#8a8a52'); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.bc(-0.08 + Math.cos(a) * 0.15, 0.045, Math.sin(a) * 0.15, 0.05, 0.05, 0.05, '#7a7a46'); } mb.beam([0.02, 0.06, -0.1], [0.28, 0.14, 0.12], 0.05, '#6a5a3a'); mb.bc(0.18, 0.08, -0.12, 0.12, 0.06, 0.08, '#a8a060'); break;
    case 'frost_shard': { const e = mb.em; mb.em = 0.45; mb.cyl(0, 0, 0, 0.09, 0, 0.5, 5, '#8ae0ff'); mb.push().tr(0.12, 0, 0.04).rz(-0.4).cyl(0, 0, 0, 0.06, 0, 0.32, 5, '#c8f4ff').pop(); mb.push().tr(-0.1, 0, -0.03).rz(0.5).cyl(0, 0, 0, 0.055, 0, 0.28, 5, '#6ac8f0').pop(); mb.em = e; break; }
    case 'ghost_essence': mb.cyl(0, 0, 0, 0.11, 0.09, 0.22, 8, '#5a4a7a'); mb.cyl(0, 0.22, 0, 0.05, 0.05, 0.08, 6, '#5a4a7a'); { const e = mb.em; mb.em = 0.8; mb.sph(0, 0.11, 0, 0.085, 0.09, 0.085, '#d8c8ff', 0); mb.em = e; } mb.cyl(0, 0.3, 0, 0.055, 0.055, 0.04, 6, '#8a5a2e'); break;
    default: mb.sph(0, 0.1, 0, 0.12, 0.08, 0.12, '#ffd84a', 0);
  }
}
// an ore outcrop: a craggy grey rock studded with rusty iron (or bright silver) nuggets; spent veins show only scars
function mkOreM(k, snow) {
  const mb = new MB(120); mb.smooth = false;
  const base = '#7e7872', top = snow ? (n => n[1] > 0.55 ? '#f0f4f8' : base) : (n => n[1] > 0.8 ? '#6e6e52' : base);
  mb.ico(0, 0.45, 0, 0.85, 0.62, 0.78, top, 0.2, 1, 61); mb.ico(0.62, 0.22, 0.42, 0.45, 0.36, 0.42, top, 0.2, 1, 62); mb.ico(-0.55, 0.2, -0.32, 0.38, 0.3, 0.36, '#6e6964', 0.2, 0, 63);
  const R = mulberry(64), sil = k === 'ore_silver', dep = k === 'ore_dep';
  // veins: clusters of chunky nuggets standing proud of the surface
  for (let i = 0; i < 16; i++) {
    const a = R() * TAU, h = 0.25 + Math.sqrt(R()) * 0.78, f = Math.sqrt(Math.max(0.08, 1 - ((h - 0.45) / 0.62) ** 2)), x = Math.cos(a) * 0.85 * f, z = Math.sin(a) * 0.78 * f, s = 0.1 + R() * 0.08;
    if (dep) { mb.ico(x * 0.97, h, z * 0.97, s * 0.9, s * 0.7, s * 0.9, '#45413d', 0.2, 0, 70 + i); continue; }
    const e = mb.em; mb.em = sil ? 0.5 : 0.18;
    mb.ico(x * 1.02, h, z * 1.02, s, s * 0.85, s, sil ? (i % 2 ? '#f4f8ff' : '#c8d8f0') : (i % 3 ? '#e0883a' : '#b85a22'), 0.3, 0, 70 + i);
    mb.em = e;
  }
  return mb;
}
function mkCoinsM() { const mb = new MB(52); for (let k = 0; k < 6; k++) mb.cyl(Math.cos(k * 2.1) * 0.12, k * 0.03, Math.sin(k * 2.1) * 0.12, 0.09, 0.09, 0.03, 10, '#ffd84a'); return mb; }
function mkArrowM() { const mb = new MB(53); mb.beam([0, 0, -0.45], [0, 0, 0.45], 0.035, '#c8945a'); mb.tri([-0.07, 0, 0.45], [0.07, 0, 0.45], [0, 0, 0.64], '#e8eef4'); mb.tri([0, -0.07, 0.45], [0, 0.07, 0.45], [0, 0, 0.64], '#c8d0d8'); mb.tri([0, -0.08, -0.45], [0, 0.08, -0.45], [0, 0, -0.28], '#ffffff'); mb.tri([-0.08, 0, -0.45], [0.08, 0, -0.45], [0, 0, -0.28], '#ff6a4a'); return mb; }
function mkBallM(k) { const mb = new MB(54); if (k === 'pball') mb.em = 1; mb.sph(0, 0, 0, 0.1, 0.1, 0.1, k === 'pball' ? '#ffe080' : '#4a4a52', 0); return mb; }
function mkFireballM() { const mb = new MB(55); mb.em = 1; mb.sph(0, 0, 0, 0.34, 0.34, 0.34, '#ff6a1a'); mb.sph(0, 0, 0, 0.22, 0.22, 0.22, '#ffe080', 0); return mb; }
function mkBoulderM(frost) { const mb = new MB(56); mb.ico(0, 0, 0, 0.6, 0.55, 0.6, frost ? '#c8e4f8' : '#a8a098', 0.18, 1, frost ? 9 : 7); return mb; }

// ---------- richer scenery: more tree species, deadfall, graves, and small ground detail (decor is visual only) ----------
function mkBirchM(far) {
  const mb = new MB(91); mb.smooth = false;
  mb.tube([0, 0, 0], [0.12, 3.4, 0.05], 0.16, 0.08, 6, '#d8d4c8', false);
  if (!far) for (let k = 0; k < 6; k++) { const y = 0.4 + k * 0.48; mb.box(-0.15 + k * 0.012, y, -0.02, -0.04 + k * 0.012, y + 0.07, 0.16, '#3a3632'); }
  mb.tube([0.05, 2.2, 0.02], [0.6, 3.1, 0.3], 0.06, 0.03, 4, '#c8c4b8'); mb.tube([0.08, 2.6, 0.03], [-0.5, 3.4, -0.2], 0.05, 0.03, 4, '#c8c4b8');
  mb.wind = 0.5; const g = ['#8a9a4a', '#7a8e44', '#94a254'];
  const cr = far ? [[0.1, 3.7, 0, 1.1]] : [[0.1, 3.8, 0, 0.95], [0.6, 3.3, 0.35, 0.7], [-0.5, 3.5, -0.25, 0.72], [0.15, 4.5, 0.05, 0.62], [-0.2, 3.0, 0.5, 0.55]];
  cr.forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3] * 0.85, c[3] * 1.1, c[3] * 0.85, g[i % 3], 0.18, far ? 0 : 1, 140 + i));
  return mb;
}
function mkWillowM() {
  const mb = new MB(92); mb.smooth = false;
  mb.tube([0, 0, 0], [0.2, 1.8, 0], 0.4, 0.26, 7, '#5a4a38', false);
  for (const a of [0.3, 2.2, 4.1]) mb.tube([0.2, 1.6, 0], [Math.cos(a) * 1.0, 2.6, Math.sin(a) * 1.0], 0.13, 0.07, 5, '#5a4a38');
  mb.wind = 0.7; const g = ['#5e6e3a', '#566634', '#667640'];
  [[0, 3.0, 0, 1.5], [1.0, 2.7, 0.5, 1.0], [-0.9, 2.8, -0.4, 1.05], [0.3, 2.7, -1.0, 0.95]].forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3], c[3] * 0.7, c[3], g[i % 3], 0.15, 1, 150 + i));
  const R = mulberry(93);
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + R() * 0.3, r = 1.2 + R() * 0.7, x = Math.cos(a) * r, z = Math.sin(a) * r, y = 2.4 + R() * 0.5; mb.tri([x - 0.14, y, z], [x + 0.14, y, z], [x * 1.08, y - 1.4 - R() * 0.9, z * 1.08], g[k % 3]); mb.tri([x, y, z - 0.14], [x, y, z + 0.14], [x * 1.08, y - 1.3 - R() * 0.9, z * 1.08], g[(k + 1) % 3]); }
  return mb;
}
function mkLogM() {
  const mb = new MB(94); mb.smooth = false;
  mb.tube([-1.3, 0.28, 0], [1.3, 0.24, 0.05], 0.3, 0.26, 7, '#6a5038', true);
  mb.push().tr(-1.32, 0.28, 0).rz(Math.PI / 2).cyl(0, 0, 0, 0.27, 0.27, 0.02, 7, '#b0946a').pop();
  mb.push().tr(1.32, 0.24, 0.05).rz(-Math.PI / 2).cyl(0, 0, 0, 0.23, 0.23, 0.02, 7, '#a88a60').pop();
  mb.ico(0.2, 0.5, 0.05, 0.42, 0.1, 0.2, '#4e6a32', 0.2, 0, 3); mb.ico(-0.7, 0.48, -0.05, 0.25, 0.08, 0.16, '#566e36', 0.2, 0, 4);
  mb.tube([0.5, 0.3, 0.1], [0.9, 0.7, 0.45], 0.06, 0.02, 4, '#6a5038');
  for (const [x, c] of [[-0.3, '#c8a878'], [-0.15, '#b8946a'], [0.9, '#d0b080']]) { mb.cyl(x, 0.48, 0.22, 0.06, 0.07, 0.04, 6, c); mb.tube([x, 0.44, 0.2], [x, 0.49, 0.22], 0.02, 0.02, 4, '#e8dcc0'); }
  return mb;
}
function mkStumpM() {
  const mb = new MB(95); mb.smooth = false;
  mb.cyl(0, 0, 0, 0.42, 0.36, 0.55, 8, '#6a5038', '#b8986c');
  mb.cyl(0, 0.555, 0, 0.26, 0.26, 0.005, 8, '#a08058', false);
  for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.3; mb.tube([Math.cos(a) * 0.3, 0.2, Math.sin(a) * 0.3], [Math.cos(a) * 0.75, 0.0, Math.sin(a) * 0.75], 0.12, 0.04, 5, '#5e4632'); }
  mb.ico(0.2, 0.6, 0.1, 0.16, 0.05, 0.12, '#4e6a32', 0.2, 0, 2);
  return mb;
}
function mkBigRockM(k) {
  const mb = new MB(96 + k); mb.smooth = false; const base = k === 1 ? '#a8a6a4' : '#9a968e', dk = '#7e7a72';
  const top = k === 1 ? (n => n[1] > 0.5 ? '#f0f4f8' : base) : (n => n[1] > 0.72 ? '#6a7a48' : base);
  mb.ico(0, 0.55, 0, 1.25, 0.95, 1.05, top, 0.22, 1, 11 + k); mb.ico(0.95, 0.3, 0.6, 0.65, 0.5, 0.6, top, 0.2, 1, 13); mb.ico(-0.9, 0.25, -0.5, 0.5, 0.4, 0.55, dk, 0.2, 0, 14);
  return mb;
}
function mkGraveM(kind) {
  const mb = new MB(97); mb.smooth = false; const st = '#8e8a82', st2 = '#76726a', moss = '#5a6a3e';
  mb.box(-0.42, -0.1, -0.2, 0.42, 0.06, 0.55, '#5a5038');
  if (kind === 0) { mb.box(-0.3, 0, -0.1, 0.3, 0.85, 0.06, st); mb.push().tr(0, 0.85, -0.02).rx(Math.PI / 2).cyl(0, -0.08, 0, 0.3, 0.3, 0.16, 8, st).pop(); mb.box(-0.2, 0.5, 0.06, 0.2, 0.54, 0.075, st2); mb.box(-0.15, 0.4, 0.06, 0.15, 0.43, 0.075, st2); mb.ico(-0.2, 0.05, 0.05, 0.22, 0.08, 0.12, moss, 0.2, 0, 3); }
  else { mb.box(-0.07, 0, -0.06, 0.07, 1.25, 0.06, st); mb.box(-0.38, 0.78, -0.06, 0.38, 0.93, 0.06, st); mb.ico(0.05, 0.05, 0.05, 0.2, 0.07, 0.12, moss, 0.2, 0, 4); }
  for (let k = 0; k < 4; k++) mb.tri([-0.35 + k * 0.22, 0.04, 0.5], [-0.25 + k * 0.22, 0.04, 0.52], [-0.3 + k * 0.22, 0.28, 0.48], '#5e6e3a');
  return mb;
}
function mkTombM() {
  const mb = new MB(98); mb.smooth = false; const st = '#8a867e', st2 = '#6e6a62';
  mb.box(-0.62, 0, -1.05, 0.62, 0.62, 1.05, st); mb.box(-0.7, 0.62, -1.12, 0.7, 0.78, 1.12, st2);
  mb.push().tr(0, 0.78, 0).rz(0.06).box(-0.55, 0, -0.95, 0.55, 0.12, 0.95, st).pop();
  for (const z of [-0.6, 0, 0.6]) mb.box(0.62, 0.15, z - 0.18, 0.66, 0.5, z + 0.18, st2);
  mb.ico(-0.4, 0.9, 0.5, 0.3, 0.08, 0.35, '#5a6a3e', 0.2, 0, 5);
  return mb;
}
function mkStatueM() {
  const mb = new MB(99); mb.smooth = false; const st = '#9a968c', st2 = '#7e7a72';
  mb.box(-0.55, 0, -0.55, 0.55, 0.7, 0.55, st2); mb.box(-0.62, 0.7, -0.62, 0.62, 0.82, 0.62, st);
  mb.frus(0.82, 2.0, 0.34, 0.26, 0.2, 0.16, st);              // robed body
  mb.ico(0, 2.12, 0.08, 0.15, 0.17, 0.15, st, 0.05, 0, 3);      // bowed head
  mb.ico(0, 2.12, -0.02, 0.18, 0.2, 0.16, st2, 0.05, 0, 4);    // hood
  for (const sd of [1, -1]) { mb.tri([sd * 0.12, 1.9, -0.15], [sd * 0.75, 2.5, -0.35], [sd * 0.3, 1.0, -0.3], st2); mb.tri([sd * 0.12, 1.9, -0.15], [sd * 0.3, 1.0, -0.3], [sd * 0.1, 1.2, -0.2], st); }
  mb.beam([0.2, 1.75, 0.15], [0.05, 2.05, 0.2], 0.08, st); mb.beam([-0.2, 1.75, 0.15], [-0.05, 2.05, 0.2], 0.08, st); // hands to the face
  mb.ico(0.35, 0.85, 0.3, 0.3, 0.1, 0.25, '#5a6a3e', 0.2, 0, 6);
  return mb;
}
function mkFountainM() {
  const mb = new MB(100); mb.smooth = false; const st = '#8e8a82', st2 = '#74706a';
  for (let k = 0; k < 10; k++) { const a0 = k / 10 * TAU, a1 = (k + 1) / 10 * TAU, h = k === 3 ? 0.25 : 0.62; mb.push().ry(-(a0 + a1) / 2).box(-0.5, 0, 1.45, 0.5, h, 1.75, k % 2 ? st : st2).pop(); }
  mb.cyl(0, 0, 0, 1.5, 1.5, 0.15, 10, '#5a5444', false);
  mb.cyl(0, 0.15, 0, 0.35, 0.28, 1.2, 8, st); mb.cyl(0, 1.35, 0, 0.75, 0.55, 0.22, 8, st2); mb.ico(0, 1.75, 0, 0.18, 0.4, 0.18, st, 0.1, 0, 7);
  mb.ico(-0.6, 0.18, 0.5, 0.45, 0.06, 0.4, '#3e4a36', 0.2, 0, 8); mb.ico(1.9, 0.12, 0.6, 0.3, 0.15, 0.25, st2, 0.25, 0, 9);
  return mb;
}
// small ground detail (no colliders, no outlines)
const DECOR_BUILD = {
  mushroom: () => { const mb = new MB(110); const R = mulberry(5); for (let k = 0; k < 4; k++) { const x = (R() - 0.5) * 0.4, z = (R() - 0.5) * 0.4, h = 0.08 + R() * 0.12, c = k % 3 === 0 ? '#a8402e' : k % 3 === 1 ? '#c8a878' : '#8a6a4a'; mb.cyl(x, 0, z, 0.025, 0.022, h, 5, '#e8e0cc'); mb.cyl(x, h, z, 0.08 + R() * 0.04, 0.0, 0.07, 6, c); } return mb; },
  fern: () => { const mb = new MB(111); mb.wind = 1; for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + 0.2, c = Math.cos(a), s = Math.sin(a), L = 0.55 + (k % 3) * 0.12; mb.tri([c * 0.03 - s * 0.05, 0, s * 0.03 + c * 0.05], [c * 0.03 + s * 0.05, 0, s * 0.03 - c * 0.05], [c * L, 0.3 + (k % 2) * 0.1, s * L], k % 2 ? '#4e7a38' : '#5a8642'); mb.tri([c * L * 0.4 - s * 0.12, 0.2, s * L * 0.4 + c * 0.12], [c * L * 0.4 + s * 0.12, 0.2, s * L * 0.4 - c * 0.12], [c * L, 0.3 + (k % 2) * 0.1, s * L], '#467034'); } return mb; },
  puddle: () => { const mb = new MB(112); mb.smooth = false; const R = mulberry(7), N = 9, pts = []; for (let k = 0; k < N; k++) { const a = k / N * TAU, r = 0.7 + R() * 0.4; pts.push([Math.cos(a) * r * 1.3, 0.03, Math.sin(a) * r]); } for (let k = 0; k < N; k++) mb.tri([0, 0.03, 0], pts[(k + 1) % N], pts[k], '#66727a'); for (let k = 0; k < N; k++) { const p = pts[k], q = pts[(k + 1) % N]; mb.quad([p[0] * 1.2, 0.012, p[2] * 1.2], [q[0] * 1.2, 0.012, q[2] * 1.2], q, p, '#6e604a'); } return mb; },
  heathbush: () => { const mb = new MB(113); mb.wind = 0.6; const R = mulberry(9); for (let k = 0; k < 5; k++) mb.ico((R() - 0.5) * 0.5, 0.16 + R() * 0.1, (R() - 0.5) * 0.5, 0.2, 0.16, 0.2, k % 2 ? '#7a5a7e' : '#5e6a3e', 0.2, 0, 20 + k); return mb; },
  deadbush: () => { const mb = new MB(114); const R = mulberry(10); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + R(), L = 0.4 + R() * 0.3; mb.tube([0, 0, 0], [Math.cos(a) * L * 0.6, 0.5 + R() * 0.3, Math.sin(a) * L * 0.6], 0.025, 0.008, 3, '#7a6650'); } return mb; },
  snowtuft: () => { const mb = new MB(115); for (let k = 0; k < 4; k++) { const a = k * 1.6, x = Math.cos(a) * 0.08, z = Math.sin(a) * 0.08; mb.tri([x - 0.04, 0, z], [x + 0.04, 0, z], [x * 2.5, 0.32, z * 2.5], '#8a8a6a'); } mb.ico(0, 0.02, 0, 0.3, 0.06, 0.25, '#e8ecf2', 0.2, 0, 3); return mb; },
  leaves: () => { const mb = new MB(116); mb.smooth = false; const R = mulberry(11), cols = ['#8a5a2a', '#a8742e', '#6e4a26', '#9a6a34']; for (let k = 0; k < 9; k++) { const x = (R() - 0.5) * 1.0, z = (R() - 0.5) * 1.0, a = R() * TAU, c = Math.cos(a) * 0.09, s = Math.sin(a) * 0.09; mb.tri([x - c, 0.02, z - s], [x + s * 0.6, 0.025, z - c * 0.6], [x + c, 0.02, z + s], cols[k % 4]); } return mb; },
  twigs: () => { const mb = new MB(117); const R = mulberry(12); for (let k = 0; k < 4; k++) { const a = R() * TAU, x = (R() - 0.5) * 0.6, z = (R() - 0.5) * 0.6; mb.beam([x, 0.03, z], [x + Math.cos(a) * 0.5, 0.04, z + Math.sin(a) * 0.5], 0.03, '#6a5038'); } return mb; },
  stones: () => { const mb = new MB(118); mb.smooth = false; const R = mulberry(13); for (let k = 0; k < 5; k++) mb.ico((R() - 0.5) * 0.8, 0.03, (R() - 0.5) * 0.8, 0.1 + R() * 0.08, 0.06, 0.1 + R() * 0.06, k % 2 ? '#8e8a82' : '#7a766e', 0.25, 0, 30 + k); return mb; },
  grassclump: () => { const mb = new MB(119); mb.wind = 1; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.4, x = Math.cos(a) * 0.1, z = Math.sin(a) * 0.1, h = 0.45 + (k % 3) * 0.15; mb.tri([x - 0.035, 0, z], [x + 0.035, 0, z], [x * 3.2, h, z * 3.2], k % 2 ? '#6a8a44' : '#7a9650'); mb.tri([x, 0, z - 0.035], [x, 0, z + 0.035], [x * 3.2, h, z * 3.2], '#5e7e3e'); } return mb; },
  cattail: () => { const mb = new MB(120); mb.wind = 1; for (let k = 0; k < 6; k++) { const a = k * 1.3, x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12; mb.tri([x - 0.03, 0, z], [x + 0.03, 0, z], [x * 2, 1.0 + (k % 3) * 0.2, z * 2], '#6a8a3e'); } return mb; }
};
Object.assign(STATIC_BUILD, { birch: () => mkBirchM(false), willow: mkWillowM, log: mkLogM, logsnow: mkLogM, stump: mkStumpM, bigrock: () => mkBigRockM(0), bigrocksnow: () => mkBigRockM(1), grave: () => mkGraveM(0), grave2: () => mkGraveM(1), tomb: mkTombM, gstatue: mkStatueM, fountain: mkFountainM }, DECOR_BUILD);
Object.assign(STATIC_FAR, { birch: () => mkBirchM(true) });
