// =====================================================================
//  MESHES — low-poly builder, characters (rigged), horse, items, scenery
// =====================================================================
// vertex: pos f32x3 | normal i8x4 | colour u8x4 (rgb + ascii mask) | ext u8x4 (bone, emissive, wind, water)
const VSTRIDE = 24;
const hexC = h => { if (Array.isArray(h)) return h; if (h.charCodeAt(0) === 33) h = h.slice(1); const c = rgbOf(h); return [c[0] / 255, c[1] / 255, c[2] / 255]; };
class MB {
  constructor(seed) {
    this.d = []; this.T = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; this.st = [];
    this.bone = 0; this.em = 0; this.wind = 0; this.mask = 1; this.jit = 0.07; this.R = mulberry(seed || 7); this.water = 0;
  }
  push() { this.st.push(this.T.slice()); return this; }
  pop() { this.T = this.st.pop(); return this; }
  // T = T * M  (M given as 3x4: m00 m01 m02 m10 m11 m12 m20 m21 m22 tx ty tz)
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
    const j = 1 + (this.R() - 0.5) * 2 * this.jit;
    const r = clamp(cc[0] * j, 0, 1), g = clamp(cc[1] * j, 0, 1), bl = clamp(cc[2] * j, 0, 1);
    for (const p of [a, b, c]) this.d.push(p[0], p[1], p[2], nx, ny, nz, r, g, bl, this.mask, this.bone, this.em, this.wind, this.water);
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
  // box between two points (beam), square cross-section w
  beam(a, b, w, col) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz) || 1e-3;
    const yaw = Math.atan2(dx, dz), pitch = Math.asin(clamp(dy / L, -1, 1));
    this.push().tr(a[0], a[1], a[2]).ry(yaw).rx(-pitch).box(-w / 2, -w / 2, 0, w / 2, w / 2, L, col).pop();
    return this;
  }
  cyl(x, y, z, r0, r1, h, seg, col, cap) {
    seg = seg || 6;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * TAU, a1 = (i + 1) / seg * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const p0 = [x + c0 * r0, y, z + s0 * r0], p1 = [x + c1 * r0, y, z + s1 * r0], q0 = [x + c0 * r1, y + h, z + s0 * r1], q1 = [x + c1 * r1, y + h, z + s1 * r1];
      if (r1 > 0.0001) this.quad(p0, p1, q1, q0, col); else this.tri(p0, p1, [x, y + h, z], col);
      if (cap !== false && r1 > 0.0001) this.tri([x, y + h, z], q0, q1, cap || col);
    }
    return this;
  }
  // icosphere (sub 0 = 20 faces, 1 = 80), radius jitter for rocks / foliage clumps
  ico(x, y, z, rx, ry, rz, col, jit, sub, seed) {
    const ic = ICO[sub || 0], R = mulberry(seed || 1), J = ic.v.map(() => 1 + (R() - 0.5) * 2 * (jit || 0));
    const P = ic.v.map((v, i) => [x + v[0] * rx * J[i], y + v[1] * ry * J[i], z + v[2] * rz * J[i]]);
    for (const f of ic.f) this.tri(P[f[0]], P[f[1]], P[f[2]], col);
    return this;
  }
  // gable roof prism along z: width w (x), length L (z), rise h, at base height y
  roof(w, L, y, h, col, ov) {
    ov = ov || 0.3; const x0 = -w / 2 - ov, x1 = w / 2 + ov, z0 = -L / 2 - ov, z1 = L / 2 + ov;
    this.quad([x0, y, z0], [0, y + h, z0], [0, y + h, z1], [x0, y, z1], col); this.quad([x1, y, z0], [0, y + h, z0], [0, y + h, z1], [x1, y, z1], col);
    this.quad([x0, y - 0.12, z0], [x0, y, z0], [x0, y, z1], [x0, y - 0.12, z1], col); this.quad([x1, y - 0.12, z0], [x1, y, z0], [x1, y, z1], [x1, y - 0.12, z1], col);
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
// upload a built mesh; returns { vbo, n, vao }
function gpuMesh(mb) {
  const n = mb.d.length / 14, buf = new ArrayBuffer(n * VSTRIDE), f = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf), d = mb.d;
  for (let i = 0; i < n; i++) {
    const s = i * 14, o = i * VSTRIDE;
    f[o / 4] = d[s]; f[o / 4 + 1] = d[s + 1]; f[o / 4 + 2] = d[s + 2];
    i8[o + 12] = Math.round(d[s + 3] * 127); i8[o + 13] = Math.round(d[s + 4] * 127); i8[o + 14] = Math.round(d[s + 5] * 127);
    u8[o + 16] = d[s + 6] * 255; u8[o + 17] = d[s + 7] * 255; u8[o + 18] = d[s + 8] * 255; u8[o + 19] = d[s + 9] * 255;
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

// ---------- character rig ----------
const BN = { root: 0, hips: 1, torso: 2, head: 3, armL: 4, armR: 5, legL: 6, legR: 7, cape: 8, hbody: 10, hFL: 11, hFR: 12, hBL: 13, hBR: 14, hneck: 15, htail: 16 };
const PIV = [[0, 0, 0], [0, 0.92, 0], [0, 0.95, 0], [0, 1.5, 0], [0.25, 1.43, 0], [-0.25, 1.43, 0], [0.1, 0.92, 0], [-0.1, 0.92, 0], [0, 1.45, -0.14], [0, 0, 0],
  [0, 1.25, 0], [0.17, 1.02, 0.62], [-0.17, 1.02, 0.62], [0.17, 1.08, -0.68], [-0.17, 1.08, -0.68], [0, 1.45, 0.78], [0, 1.52, -0.92], [0, 0, 0]];
const HUMANS = {
  bandit: { coat: '#5e4c34', pants: '#4a3c28', boots: '#2e2216', hat: 'hood', hatC: '#3a3024', belt: '#22180e', mask: '#2e2822', cuff: '#4a3c28' },
  soldier: { coat: '#a82a24', pants: '#d8d2c2', facing: '#26387a', cuff: '#26387a', hat: 'tricorn', lace: '#e8e2d0', cross: true, buttons: true, gaiters: '#1a1616', R: { t: 'sword', col: '#c8d0d8' } },
  ally: { coat: '#2a52a8', pants: '#d8d2c2', facing: '#a82a24', cuff: '#a82a24', hat: 'tricorn', lace: '#d8b040', buttons: true, tallBoots: true, R: { t: 'sword', col: '#c8d0d8' } },
  guard: { coat: '#2a6a48', pants: '#c8c0ac', facing: '#d8b040', hat: 'morion', tallBoots: true, buttons: true, R: { t: 'sword', col: '#c8d0d8' }, L: { t: 'shield', id: 'buckler' } },
  pikeman: { coat: '#9a2622', pants: '#d8d2c2', facing: '#26387a', cuff: '#26387a', hat: 'morion', cross: true, gaiters: '#1a1616', R: { t: 'pike' } },
  musketeer: { coat: '#a82a24', pants: '#d8d2c2', facing: '#26387a', cuff: '#26387a', hat: 'tricorn', lace: '#e8e2d0', cross: true, buttons: true, gaiters: '#1a1616', R: { t: 'musket' } },
  archer: { coat: '#8e3226', pants: '#6e6248', hat: 'hood', hatC: '#3e4a24', straps: true, L: { t: 'bow' } },
  vampire: { coat: '#1e1426', pants: '#18101e', boots: '#0c080e', skin: '#d8d6e4', hair: '#0e0c12', eye: '#ff2a2a', eyeEm: true, cape: '#24102e', capeIn: '#8a1424', collar: true, buttons: true },
  witch: { robe: '#4a2266', coat: '#3e1c58', skin: '#7aa852', hair: '#b8b8c0', eye: '#ffe040', eyeEm: true, hat: 'witch', hatC: '#2e143e', broom: true },
  merchant: { coat: '#2e6a3e', pants: '#4a3c28', apron: '#d8ccb0', hat: 'cap', hatC: '#5a3e22', pack: true, buttons: true }
};
const ARMOR_LOOK = {
  tunic: { coat: '#c8bca0', pants: '#7a6c50', boots: '#3a2818', hat: null, belt: '#8a6a40' },
  gambeson: { coat: '#b8945e', pants: '#6a5c40', boots: '#2e2014', quilt: true, belt: '#5a4028' },
  leather: { coat: '#7a4e28', pants: '#4a3824', boots: '#24180e', straps: true, tallBoots: true, belt: '#2a1c10' },
  chainmail: { coat: '#8a949e', mail: true, pants: '#5a6068', boots: '#24201c', hat: 'coif', tallBoots: true, belt: '#3a2a1a' },
  halfplate: { coat: '#8a949e', mail: true, plate: '#b8c4ce', pants: '#5a6068', boots: '#24201c', hat: 'sallet', crest: '#2f5fc0', tallBoots: true, pauldron: true },
  fullplate: { coat: '#c4ced8', plate: '#d4dee8', plateArms: true, pants: '#b4bec8', boots: '#7a848e', greaves: true, hat: 'great', crest: '#b02828', pauldron: true }
};
const GIANTS = {
  giant: { skin: '#a88a6a', hair: '#4a3420', beard: '#4a3420', fur: '#6a5034', belt: '#3a2816', club: '#5a4028', eye: '#ff3a1a' },
  frostgiant: { skin: '#9cb8d0', hair: '#e8f0f8', beard: '#e0ecf8', fur: '#e8eef4', belt: '#5a6a7a', club: '#a8c8e0', eye: '#5ad0ff', frost: true }
};
function itemSpec(id) {
  if (!id) return null; const it = ITEMS[id]; if (!it) return null;
  return it.type === 'sword' ? { t: 'sword', col: it.col, tier: it.tier } : it.type === 'sword2' ? { t: 'claymore' } : it.type === 'bow' ? { t: 'bow' } : it.type === 'shield' ? { t: 'shield', id } : it.type === 'torch' ? { t: 'torch' } : it.type === 'gun' ? { t: 'pistol' } : null;
}
// build a held item in the arm's rest frame (arm hangs along -y from the shoulder); hand at h
function buildItem(mb, it, side) {
  const hx = side * 0.25, hy = 0.8, hz = 0.03;
  mb.push().tr(hx, hy, hz);
  switch (it.t) {
    case 'sword': case 'claymore': {
      const big = it.t === 'claymore', L = big ? 1.25 : 0.86, bc = hexC(it.col || '#c8d0d8');
      mb.rx(0.33);
      mb.bc(0, 0.05, 0, 0.05, 0.18, 0.05, '#3a2614');                 // grip
      mb.bc(0, 0.17, 0, 0.07, 0.07, 0.07, '#b89a40');                  // pommel
      mb.bc(0, -0.05, 0, big ? 0.34 : 0.26, 0.04, 0.06, '#9a8a50');    // crossguard
      mb.box(-0.035, -0.07 - L, -0.012, 0.035, -0.07, 0.012, bc);       // blade
      mb.box(-0.012, -0.07 - L, -0.016, 0.012, -0.07, 0.016, bc.map(v => Math.min(1, v * 1.18)));
      mb.tri([-0.035, -0.07 - L, 0], [0.035, -0.07 - L, 0], [0, -0.16 - L, 0], bc);
      if (it.tier >= 4) { const e = mb.em; mb.em = 0.6; mb.box(-0.02, -0.07 - L, -0.017, 0.02, -0.07, 0.017, '#ffe080'); mb.em = e; }
      break;
    }
    case 'pike':
      mb.beam([0, 0.9, 0], [0, -2.9, 0], 0.05, '#7a5a34');
      mb.tri([-0.05, -2.9, 0], [0.05, -2.9, 0], [0, -3.25, 0], '#c8d0d8'); mb.tri([0, -2.9, -0.05], [0, -2.9, 0.05], [0, -3.25, 0], '#a8b0b8');
      break;
    case 'musket':
      mb.box(-0.035, -1.25, -0.05, 0.035, 0.25, 0.04, '#5a3a1e'); mb.box(-0.02, -1.45, -0.07, 0.02, -0.2, -0.035, '#3a3a40');
      mb.box(-0.008, -1.75, -0.06, 0.008, -1.45, -0.045, '#d0d8e0'); // bayonet
      break;
    case 'pistol':
      mb.box(-0.03, -0.32, 0.0, 0.03, 0.02, 0.06, '#3a3a40'); mb.box(-0.03, -0.02, -0.02, 0.03, 0.1, 0.08, '#5a3a1e');
      break;
    case 'torch': {
      mb.rx(-0.25);
      mb.beam([0, -0.25, 0.0], [0, -0.25, 0.62], 0.055, '#5a3a1c');
      mb.bc(0, -0.25, 0.62, 0.09, 0.09, 0.09, '#2a1a0c');
      const e = mb.em, m = mb.mask; mb.em = 1; mb.mask = 0;
      mb.push().tr(0, -0.25, 0.66).rx(Math.PI / 2);
      mb.cyl(0, 0, 0, 0.09, 0, 0.32, 5, '#ff7a20'); mb.cyl(0, 0.02, 0, 0.055, 0, 0.24, 5, '#ffd060');
      mb.pop(); mb.em = e; mb.mask = m;
      break;
    }
    case 'bow': {
      const c = '#6a4422', N = 7;
      let prev = null;
      for (let i = 0; i <= N; i++) { const t = i / N * 2 - 1, p = [0, -0.06 + Math.abs(t) * -0.0 - (1 - t * t) * 0.18, t * 0.72]; if (prev) mb.beam(prev, p, 0.04, c); prev = p; }
      const m = mb.mask; mb.mask = 0.4; mb.beam([0, -0.07, -0.72], [0, -0.07, 0.72], 0.012, '#e8e0c8'); mb.mask = m;
      break;
    }
    case 'shield': {
      const id = it.id;
      mb.tr(side * 0.07, 0.12, 0.05);
      if (id === 'buckler') { mb.push().rz(side * Math.PI / 2).cyl(0, 0, 0, 0.24, 0.24, 0.05, 8, '#7a5028', '#9a6a38').pop(); mb.bc(side * 0.04, 0, 0, 0.05, 0.08, 0.08, '#c8ccd0'); }
      else {
        const tower = id === 'tower_shield', w = tower ? 0.34 : 0.27, top = tower ? 0.5 : 0.36, bot = tower ? -0.62 : -0.5;
        const fc = tower ? '#28386a' : '#2a56b0', x = side * 0.035;
        const pts = tower ? [[top, -w], [top, w], [bot, w], [bot, -w]] : [[top, -w], [top, w], [-0.05, w], [bot, 0], [-0.05, -w]];
        for (const xx of [x, x - side * 0.05]) {
          const col = xx === x ? fc : '#4a3018';
          for (let i = 1; i < pts.length - 1; i++) mb.tri([xx, pts[0][0], pts[0][1]], [xx, pts[i][0], pts[i][1]], [xx, pts[i + 1][0], pts[i + 1][1]], col);
        }
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; mb.beam([x - side * 0.025, a[0], a[1]], [x - side * 0.025, b[0], b[1]], 0.05, '#b8bec4'); }
        mb.bc(x + side * 0.005, (top + bot) * 0.4, 0, 0.012, 0.06, w * 1.3, '#e0b840'); mb.bc(x + side * 0.005, 0.0, 0, 0.012, (top - bot) * 0.7, 0.06, '#e0b840');
      }
      break;
    }
  }
  mb.pop();
}
// humanoid (also giants at scale); spec keys: coat pants boots skin hair hat ... ; side items L / R
function buildHuman(spec) {
  const mb = new MB(91), s = spec, giant = !!s.giant;
  const skin = s.skin || '#d8a882', coat = s.coat || '#8a7a5a', pants = s.pants || '#5a4a32', boots = s.boots || '#2a1e14';
  mb.mask = 0.62;
  // legs
  for (const side of [1, -1]) {
    mb.bone = side > 0 ? BN.legL : BN.legR;
    const x = side * 0.1;
    mb.bc(x, 0.6, 0, 0.15, 0.62, 0.17, s.robe || pants);
    if (s.greaves) mb.bc(x, 0.42, 0.015, 0.16, 0.38, 0.16, '#d4dee8');
    if (s.gaiters) mb.bc(x, 0.32, 0.005, 0.165, 0.36, 0.18, s.gaiters);
    mb.bc(x, s.tallBoots ? 0.2 : 0.1, 0.02, 0.17, s.tallBoots ? 0.4 : 0.2, 0.2, boots);
    mb.bc(x, 0.05, 0.08, 0.16, 0.1, 0.12, boots);
  }
  // hips / skirt
  mb.bone = BN.hips;
  if (s.robe) { mb.cyl(0, 0.05, 0, 0.36, 0.24, 0.9, 7, s.robe); }
  else if (!giant) { mb.bc(0, 0.82, -0.01, 0.42, 0.24, 0.26, coat); if (!s.mail && !s.plate && s.coat) mb.bc(0, 0.68, -0.06, 0.4, 0.2, 0.18, coat); }
  if (giant) { mb.bc(0, 0.8, 0, 0.5, 0.34, 0.32, s.fur); for (let i = 0; i < 6; i++) mb.bc(-0.22 + i * 0.09, 0.6, 0.0, 0.08, 0.14, 0.33, s.fur); mb.bc(0, 0.95, 0, 0.52, 0.07, 0.34, s.belt); }
  if (s.apron) mb.bc(0, 0.72, 0.13, 0.32, 0.42, 0.02, s.apron);
  // torso
  mb.bone = BN.torso;
  const tw = giant ? 0.5 : 0.42, td = giant ? 0.32 : 0.25;
  mb.bc(0, 1.2, 0, tw, 0.52, td, giant ? skin : coat);
  if (giant) { mb.bc(0, 1.3, 0.13, 0.44, 0.2, 0.06, skin); mb.bc(0, 1.08, 0.12, 0.38, 0.16, 0.06, skin); mb.beam([0.2, 1.45, 0.17], [-0.2, 0.98, 0.17], 0.06, s.fur); }
  if (s.quilt) for (let i = 0; i < 4; i++) mb.bc(0, 1.0 + i * 0.13, 0.126, tw * 0.96, 0.02, 0.01, '#8a6c40');
  if (s.mail) for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) mb.bc(-0.15 + j * 0.1, 0.98 + i * 0.1, 0.127, 0.07, 0.05, 0.01, '#5a646e');
  if (s.plate) { mb.bc(0, 1.24, 0.03, tw + 0.04, 0.44, td + 0.02, s.plate); mb.bc(0, 1.3, 0.145, 0.16, 0.24, 0.02, '#f0f6fc'); }
  if (s.pauldron) for (const side of [1, -1]) mb.bc(side * 0.25, 1.43, 0, 0.17, 0.1, 0.24, s.plate || '#b8c4ce');
  if (s.facing) { mb.bc(0.11, 1.25, 0.127, 0.09, 0.42, 0.01, s.facing); mb.bc(-0.11, 1.25, 0.127, 0.09, 0.42, 0.01, s.facing); }
  if (s.cross) { mb.beam([0.2, 1.45, 0.13], [-0.2, 0.96, 0.13], 0.045, '#ece6d8'); mb.beam([-0.2, 1.45, 0.135], [0.2, 0.96, 0.135], 0.045, '#ece6d8'); }
  if (s.straps) { mb.beam([0.18, 1.45, 0.13], [-0.18, 0.96, 0.13], 0.04, '#3a2414'); mb.beam([0.18, 1.45, -0.13], [-0.18, 0.96, -0.13], 0.04, '#3a2414'); }
  if (s.buttons) for (let i = 0; i < 4; i++) mb.bc(0, 1.04 + i * 0.1, 0.128, 0.03, 0.03, 0.01, '#e0c060');
  if (s.belt || s.cross) mb.bc(0, 0.98, 0, tw + 0.02, 0.07, td + 0.02, s.belt || '#2a1c10');
  if (s.collar) { mb.bc(0.15, 1.5, -0.04, 0.1, 0.22, 0.2, s.cape); mb.bc(-0.15, 1.5, -0.04, 0.1, 0.22, 0.2, s.cape); }
  if (s.pack) mb.bc(0, 1.2, -0.2, 0.32, 0.4, 0.16, '#6a4a28');
  // head
  mb.bone = BN.head;
  const hs = giant ? 1.25 : 1;
  mb.bc(0, 1.53, 0, 0.1, 0.08, 0.1, skin);
  mb.bc(0, 1.66 * 1, 0, 0.24 * hs, 0.26, 0.24 * hs, skin);
  const eye = s.eye || '#1a1410'; { const e = mb.em, m = mb.mask; if (s.eyeEm) { mb.em = 1; mb.mask = 0; } mb.bc(0.055, 1.69, 0.122 * hs, 0.04, 0.03, 0.01, eye); mb.bc(-0.055, 1.69, 0.122 * hs, 0.04, 0.03, 0.01, eye); mb.em = e; mb.mask = m; }
  mb.bc(0, 1.64, 0.13 * hs, 0.035, 0.05, 0.03, skin);
  if (s.beard) { mb.bc(0, 1.55, 0.1, 0.26, 0.2, 0.12, s.beard); mb.bc(0, 1.42, 0.12, 0.18, 0.14, 0.08, s.beard); }
  const hair = s.hair || '#3a2414';
  if (s.hat !== 'great' && s.hat !== 'sallet' && s.hat !== 'coif') mb.bc(0, 1.76, -0.02, 0.26 * hs, 0.08, 0.26 * hs, hair), mb.bc(0, 1.66, -0.1 * hs, 0.25 * hs, 0.18, 0.06, hair);
  switch (s.hat) {
    case 'tricorn': {
      const c = '#1a1614', l = s.lace || '#d8d0b8';
      for (let k = 0; k < 3; k++) { mb.push().tr(0, 1.81, 0).ry(k * TAU / 3 + Math.PI).beam([-0.2, 0, 0.12], [0.2, 0, 0.12], 0.08, c).beam([-0.2, 0.04, 0.16], [0.2, 0.04, 0.16], 0.02, l).pop(); }
      mb.bc(0, 1.86, 0, 0.24, 0.1, 0.24, c); break;
    }
    case 'hood': mb.bc(0, 1.7, -0.02, 0.3, 0.34, 0.3, s.hatC || '#3a3024'); mb.bc(0, 1.66, -0.18, 0.2, 0.3, 0.06, s.hatC || '#3a3024'); if (s.mask) mb.bc(0, 1.6, 0.13, 0.24, 0.1, 0.02, s.mask); break;
    case 'morion': mb.cyl(0, 1.78, 0, 0.2, 0.12, 0.12, 7, '#c0c8d0'); mb.cyl(0, 1.77, 0, 0.27, 0.27, 0.025, 8, '#a8b0b8'); mb.bc(0, 1.93, 0, 0.03, 0.08, 0.28, '#d0d8e0'); break;
    case 'coif': mb.bc(0, 1.7, -0.01, 0.29, 0.34, 0.29, '#8a949e'); mb.bc(0, 1.6, 0, 0.32, 0.12, 0.3, '#8a949e'); mb.bc(0, 1.67, 0.146, 0.16, 0.14, 0.01, skin); break;
    case 'sallet': mb.bc(0, 1.71, -0.01, 0.3, 0.32, 0.31, '#c8d2dc'); mb.bc(0, 1.66, -0.15, 0.3, 0.1, 0.1, '#c8d2dc'); mb.bc(0, 1.7, 0.157, 0.24, 0.035, 0.01, '#1a1a1e'); if (s.crest) mb.bc(0, 1.9, -0.02, 0.04, 0.1, 0.26, s.crest); break;
    case 'great': mb.bc(0, 1.7, 0, 0.3, 0.38, 0.3, '#dce6f0'); mb.bc(0, 1.71, 0.152, 0.24, 0.03, 0.01, '#141418'); mb.bc(0, 1.62, 0.152, 0.02, 0.12, 0.01, '#141418'); if (s.crest) { mb.bc(0, 1.94, 0, 0.05, 0.12, 0.2, s.crest); mb.bc(0, 1.98, -0.12, 0.05, 0.16, 0.08, s.crest); } break;
    case 'cap': mb.bc(0, 1.82, 0, 0.27, 0.08, 0.27, s.hatC); mb.bc(0, 1.79, 0.15, 0.2, 0.025, 0.08, s.hatC); break;
    case 'witch': mb.cyl(0, 1.79, 0, 0.36, 0.36, 0.025, 9, s.hatC); mb.push().tr(0, 1.8, 0).rx(-0.18).cyl(0, 0, 0, 0.16, 0.0, 0.55, 6, s.hatC).pop(); mb.cyl(0, 1.8, 0, 0.165, 0.15, 0.06, 6, '#a07a28'); break;
  }
  if (s.hair && s.hat === 'witch') { mb.bc(0, 1.55, -0.12, 0.3, 0.42, 0.08, s.hair); }
  // arms
  for (const side of [1, -1]) {
    mb.bone = side > 0 ? BN.armL : BN.armR;
    const x = side * (giant ? 0.31 : 0.25), aw = giant ? 0.17 : 0.12;
    const sleeve = giant ? skin : s.plateArms ? '#d4dee8' : s.robe ? s.coat : coat;
    mb.bc(x, 1.18, 0, aw, 0.52, aw + 0.01, sleeve);
    if (s.cuff) mb.bc(x, 0.95, 0, aw + 0.02, 0.07, aw + 0.03, s.cuff);
    mb.bc(x, 0.85, 0.01, aw - 0.01, 0.12, aw - 0.01, s.plateArms ? '#b4bec8' : skin);
    if (giant && side < 0) { // spiked club
      mb.push().tr(x, 0.8, 0.03).rx(0.25);
      mb.cyl(0, -0.1, 0, 0.06, 0.09, 0.3, 6, s.club); mb.cyl(0, -0.85, 0, 0.17, 0.09, 0.75, 7, s.club);
      mb.ico(0, -0.85, 0, 0.2, 0.22, 0.2, s.club, 0.15, 0, 3);
      for (let k = 0; k < 6; k++) { const a = k * 0.9, y = -0.35 - k * 0.09; mb.beam([Math.cos(a) * 0.12, y, Math.sin(a) * 0.12], [Math.cos(a) * 0.24, y - 0.03, Math.sin(a) * 0.24], 0.04, '#d0c8b8'); }
      mb.pop();
    }
    const it = side > 0 ? s.L : s.R;
    if (it) buildItem(mb, it, side);
  }
  // cape
  if (s.cape) {
    mb.bone = BN.cape; mb.mask = 0.55;
    mb.box(-0.19, 0.6, -0.17, 0.19, 1.44, -0.15, s.cape); mb.box(-0.18, 0.62, -0.15, 0.18, 1.42, -0.135, s.capeIn || s.cape); mb.bc(0, 1.44, -0.1, 0.4, 0.06, 0.12, s.cape);
    mb.mask = 0.62;
  }
  if (s.broom) {
    mb.bone = BN.root;
    mb.beam([0, 0.55, 0.9], [0, 0.55, -0.7], 0.05, '#6a4a2a');
    mb.mask = 0.3; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; mb.beam([0, 0.55, -0.6], [Math.cos(a) * 0.14, 0.55 + Math.sin(a) * 0.14, -1.05], 0.035, '#b89a50'); }
    mb.bc(0, 0.55, -0.62, 0.1, 0.1, 0.06, '#6a3a1a');
  }
  if (giant) { // whole mesh scaled about the feet
    const k = s.scale || 3.0;
    for (let i = 0; i < mb.d.length; i += 14) { mb.d[i] *= k; mb.d[i + 1] *= k; mb.d[i + 2] *= k; }
    if (s.frost) for (let i = 0; i < mb.d.length; i += 14) if (mb.d[i + 1] > 4.6 && mb.d[i + 4] > 0.5) { mb.d[i + 6] = 0.92; mb.d[i + 7] = 0.96; mb.d[i + 8] = 1; }
  }
  return mb;
}
function buildHorse(o) {
  const mb = new MB(33); mb.mask = 0.6;
  const coat = o.coat || '#7a4e2c', dark = o.dark || '#1e140c', cloth = o.cloth || '#2a4ea0';
  mb.bone = BN.hbody;
  mb.bc(0, 1.25, 0, 0.5, 0.56, 1.7, coat); mb.bc(0, 1.27, 0, 0.56, 0.44, 1.4, coat);
  mb.bc(0, 1.38, -0.72, 0.5, 0.42, 0.34, coat);
  if (o.saddle) { mb.bc(0, 1.56, -0.02, 0.62, 0.05, 0.75, cloth); mb.bc(0, 1.6, -0.05, 0.44, 0.1, 0.5, '#4a2e18'); mb.bc(0, 1.67, -0.27, 0.36, 0.1, 0.08, '#4a2e18'); mb.bc(0.32, 1.25, 0, 0.02, 0.4, 0.04, '#2a1c10'); mb.bc(-0.32, 1.25, 0, 0.02, 0.4, 0.04, '#2a1c10'); }
  for (const [b, x, z] of [[BN.hFL, 0.17, 0.62], [BN.hFR, -0.17, 0.62], [BN.hBL, 0.17, -0.68], [BN.hBR, -0.17, -0.68]]) {
    mb.bone = b;
    mb.bc(x, 0.82, z, 0.14, 0.42, 0.18, coat); mb.bc(x, 0.36, z, 0.1, 0.52, 0.11, o.stockings ? '#e8e0d0' : coat); mb.bc(x, 0.05, z + 0.01, 0.13, 0.1, 0.15, dark);
  }
  mb.bone = BN.hneck;
  mb.beam([0, 1.3, 0.7], [0, 1.95, 1.08], 0.3, coat);
  mb.push().tr(0, 1.98, 1.12).rx(0.75).bc(0, 0, 0.22, 0.22, 0.24, 0.48, coat).bc(0, -0.02, 0.44, 0.2, 0.2, 0.12, dark).pop();
  mb.bc(0.07, 2.13, 1.02, 0.04, 0.12, 0.05, coat); mb.bc(-0.07, 2.13, 1.02, 0.04, 0.12, 0.05, coat);
  mb.beam([0, 1.55, 0.6], [0, 2.1, 1.02], 0.11, dark);
  if (o.blaze) mb.push().tr(0, 1.98, 1.12).rx(0.75).bc(0, 0.11, 0.24, 0.06, 0.02, 0.36, '#e8e0d0').pop();
  if (o.saddle) { mb.beam([0.12, 1.85, 1.35], [0.15, 1.6, 0.4], 0.02, '#1a120a'); mb.beam([-0.12, 1.85, 1.35], [-0.15, 1.6, 0.4], 0.02, '#1a120a'); }
  mb.bone = BN.htail;
  mb.beam([0, 1.5, -0.88], [0, 0.75, -1.12], 0.12, dark); mb.beam([0, 1.45, -0.9], [0, 0.9, -1.2], 0.08, dark);
  return mb;
}

// ---------- scenery (one mesh per static type, drawn instanced) ----------
const STATIC_BUILD = {
  pine: () => mkPineM(false), snowpine: () => mkPineM(true),
  oak: () => { const mb = new MB(5); mb.cyl(0, 0, 0, 0.28, 0.16, 2.5, 6, '#3a2a1a'); for (const a of [0.4, 2.3, 4.2]) mb.beam([0, 1.7, 0], [Math.cos(a) * 0.9, 2.6, Math.sin(a) * 0.9], 0.11, '#3a2a1a');
    mb.mask = 0.3; mb.wind = 0.5; mb.jit = 0.22; const R = mulberry(17), g = ['#243e1e', '#2e4c24', '#203819', '#38582a', '#2a4620'];
    for (let k = 0; k < 13; k++) { const a = R() * TAU, d = Math.sqrt(R()) * 1.3, y = 2.5 + R() * 1.7 - d * 0.35, r = 0.56 + R() * 0.38; mb.ico(Math.cos(a) * d, y, Math.sin(a) * d, r, r * 0.85, r, g[k % 5], 0.25, 0, 10 + k); }
    return mb; },
  deadtree: () => { const mb = new MB(6); const c = '#4e443a'; mb.cyl(0, 0, 0, 0.22, 0.08, 3.4, 5, c); const R = mulberry(9);
    const br = (p, a, el, L, w, d) => { const q = [p[0] + Math.cos(a) * Math.cos(el) * L, p[1] + Math.sin(el) * L, p[2] + Math.sin(a) * Math.cos(el) * L]; mb.beam(p, q, w, c); if (d) { br(q, a + 0.6, el + 0.1, L * 0.6, w * 0.7, d - 1); br(q, a - 0.6, el - 0.1, L * 0.6, w * 0.7, d - 1); } };
    for (let k = 0; k < 4; k++) br([0, 1.6 + k * 0.45, 0], k * 1.9 + R(), 0.5, 1.1 - k * 0.15, 0.1, 2); return mb; },
  palm: () => { const mb = new MB(8); let x = 0; for (let i = 0; i < 9; i++) { const nx = Math.sin(i * 0.35) * 0.35; mb.beam([x, i * 0.5, 0], [nx, (i + 1) * 0.5, 0], 0.2, i % 2 ? '#7a6040' : '#6a5236'); x = nx; }
    mb.mask = 0.3; mb.wind = 0.8; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; let p = [x, 4.5, 0]; for (let s = 1; s <= 4; s++) { const q = [x + Math.cos(a) * s * 0.55, 4.6 + Math.sin(s * 0.7) * 0.5 - s * s * 0.1, Math.sin(a) * s * 0.55]; mb.beam(p, q, 0.22 - s * 0.03, k % 2 ? '#3a6a2c' : '#2e5a24'); p = q; } } return mb; },
  bush: () => { const mb = new MB(11); mb.mask = 0.3; mb.wind = 0.3; mb.jit = 0.22; const R = mulberry(4); for (let k = 0; k < 8; k++) mb.ico((R() - 0.5) * 0.9, 0.3 + R() * 0.35, (R() - 0.5) * 0.9, 0.3 + R() * 0.15, 0.27, 0.3 + R() * 0.15, k % 2 ? '#26421e' : '#30522a', 0.25, 0, k + 2);
    for (let k = 0; k < 6; k++) { const a = k * 1.1; mb.bc(Math.cos(a) * 0.45, 0.55 + (k % 3) * 0.12, Math.sin(a) * 0.45, 0.07, 0.07, 0.07, '#8a2028'); } return mb; },
  rock: () => mkRockM(0), rocksnow: () => mkRockM(1), rocksand: () => mkRockM(2), pebble: () => mkRockM(0), pebblesnow: () => mkRockM(1), pebblesand: () => mkRockM(2),
  menhir: () => { const mb = new MB(12); mb.ico(0, 1.4, 0, 0.45, 1.55, 0.32, '#6e6a62', 0.12, 0, 4); mb.mask = 1; mb.bc(0, 1.5, 0.3, 0.06, 0.8, 0.01, '#3a3832'); mb.bc(0, 1.7, 0.3, 0.3, 0.06, 0.01, '#3a3832'); return mb; },
  house: () => mkHouseM(''), housesnow: () => mkHouseM('snow'), housesand: () => mkHouseM('sand'),
  ruin: () => { const mb = new MB(13), st = '#6a665c', st2 = '#5a564e', moss = '#3e5a2e';
    const wall = (x0, z0, x1, z1, h) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.8); for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, hh = h * (0.4 + 0.6 * hash2(i * 7 + x0 * 3, z0 * 5)); mb.box(Math.min(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) - 0.2, 0, Math.min(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) - 0.2, Math.max(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1) + 0.2, hh, Math.max(z0 + (z1 - z0) * t0, z0 + (z1 - z0) * t1) + 0.2, i % 2 ? st : st2, moss); } };
    wall(-4, -3, 4, -3, 4.5); wall(-4, -3, -4, 3, 3.2); wall(4, -3, 4, 1, 2.6);
    mb.box(-1.6, 0, 2.6, -0.8, 4.2, 3.4, st); mb.box(0.8, 0, 2.6, 1.6, 4.2, 3.4, st); mb.box(-1.8, 4.2, 2.5, 1.8, 4.9, 3.5, st2, moss);
    for (let k = 0; k < 7; k++) mb.ico(-3 + k, 0.2, 0.5 + hash2(k, 3) * 2, 0.4, 0.3, 0.4, st2, 0.2, 0, k);
    return mb; },
  well: () => { const mb = new MB(14); mb.cyl(0, 0, 0, 0.85, 0.85, 0.85, 10, '#7a766c', '#5a564e'); mb.mask = 0.8; mb.cyl(0, 0.8, 0, 0.66, 0.66, 0.02, 10, '#1a3040'); mb.mask = 1;
    mb.box(-0.8, 0, -0.08, -0.65, 2.1, 0.08, '#4a3420'); mb.box(0.65, 0, -0.08, 0.8, 2.1, 0.08, '#4a3420'); mb.beam([-0.8, 1.7, 0], [0.8, 1.7, 0], 0.07, '#4a3420');
    mb.push().ry(Math.PI / 2).roof(0.5, 1.9, 2.05, 0.55, '#7a3424', 0.25).pop(); mb.bc(0.2, 1.3, 0, 0.18, 0.2, 0.18, '#5a3a20'); return mb; },
  fire: () => { const mb = new MB(15); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; mb.ico(Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62, 0.2, 0.15, 0.2, '#5a5650', 0.2, 0, k); }
    mb.beam([-0.5, 0.12, -0.2], [0.5, 0.2, 0.2], 0.14, '#3a2414'); mb.beam([-0.4, 0.2, 0.35], [0.4, 0.12, -0.35], 0.14, '#3a2414');
    mb.em = 1; mb.mask = 0; mb.cyl(0, 0.15, 0, 0.36, 0, 0.9, 6, '#ff6a1a'); mb.cyl(0.05, 0.15, 0, 0.22, 0, 1.25, 5, '#ffb030'); mb.cyl(-0.08, 0.15, 0.05, 0.12, 0, 0.75, 5, '#fff0a0'); return mb; },
  chest: () => mkChestM(false), chestopen: () => mkChestM(true)
};
// far LODs: same silhouettes, a fraction of the triangles
const STATIC_FAR = {
  oak: () => { const mb = new MB(5); mb.cyl(0, 0, 0, 0.28, 0.16, 2.5, 4, '#3a2a1a'); mb.mask = 0.3; mb.jit = 0.22; const g = ['#243e1e', '#2e4c24', '#38582a', '#2a4620'];
    [[0, 3.4, 0, 1.4], [0.9, 2.8, 0.4, 0.9], [-0.8, 2.9, -0.5, 0.95], [0.2, 2.7, -1.0, 0.85]].forEach((c, i) => mb.ico(c[0], c[1], c[2], c[3], c[3] * 0.85, c[3], g[i], 0.2, 0, 30 + i)); return mb; },
  pine: () => mkPineM(false, true), snowpine: () => mkPineM(true, true),
  deadtree: () => { const mb = new MB(6); const c = '#4e443a'; mb.cyl(0, 0, 0, 0.22, 0.08, 3.4, 4, c); for (let k = 0; k < 4; k++) mb.beam([0, 1.6 + k * 0.45, 0], [Math.cos(k * 1.9) * 1.1, 2.3 + k * 0.45, Math.sin(k * 1.9) * 1.1], 0.1, c); return mb; },
  palm: () => { const mb = new MB(8); mb.beam([0, 0, 0], [0.3, 4.5, 0], 0.22, '#6a5236'); mb.mask = 0.3; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; mb.beam([0.3, 4.5, 0], [0.3 + Math.cos(a) * 1.9, 3.9, Math.sin(a) * 1.9], 0.2, '#2e5a24'); } return mb; },
  bush: () => { const mb = new MB(11); mb.mask = 0.3; mb.jit = 0.2; mb.ico(0, 0.45, 0, 0.7, 0.5, 0.7, '#2c4c24', 0.2, 0, 2); return mb; },
  house: () => mkHouseM(''), housesnow: () => mkHouseM('snow'), housesand: () => mkHouseM('sand')
};
function mkPineM(snow, far) {
  const mb = new MB(3); mb.jit = 0.14; mb.cyl(0, 0, 0, 0.2, 0.12, 1.6, 6, '#3a281a');
  mb.mask = 0.34; mb.wind = 0.35;
  const g = snow ? ['#24402e', '#2a4a34'] : ['#1e3a24', '#25452a'];
  const nt = far ? 3 : 5, sg = far ? 5 : 7;
  for (let t = 0; t < nt; t++) {
    const tt = far ? t * 1.6 : t, r = 1.7 - tt * 0.3, y = 0.9 + tt * 1.0, h = (1.7 - tt * 0.1) * (far ? 1.35 : 1);
    mb.cyl(0, y, 0, r, 0, h, sg, g[t % 2]);
    if (snow) { mb.mask = 0.5; mb.cyl(0, y + h * 0.42, 0, r * 0.62, 0, h * 0.6, sg, '#c4ccd8'); mb.mask = 0.34; }
  }
  return mb;
}
function mkRockM(k) {
  const mb = new MB(21 + k); const base = k === 2 ? '#9a8462' : '#6e6a62';
  mb.ico(0, 0.35, 0, 0.75, 0.62, 0.68, k === 1 ? (n => n[1] > 0.45 ? '#e4eaf2' : base) : base, 0.22, 1, 5 + k);
  mb.ico(0.45, 0.2, 0.3, 0.4, 0.32, 0.38, k === 1 ? (n => n[1] > 0.5 ? '#e4eaf2' : '#625e56') : '#625e56', 0.2, 0, 8);
  return mb;
}
function mkHouseM(v) {
  const mb = new MB(31), snow = v === 'snow', sand = v === 'sand';
  const wall = sand ? '#a08460' : '#b4a88c', timber = '#3a2a1c', roofC = snow ? '#dce4ee' : sand ? '#8a7050' : '#6e2e22';
  const W = 4.2, D = 3.4, H = 2.5;
  mb.box(-W / 2, 0, -D / 2, W / 2, H, D / 2, wall);
  mb.box(-W / 2 - 0.08, 0, -D / 2 - 0.08, W / 2 + 0.08, 0.35, D / 2 + 0.08, '#5a564e');
  if (!sand) {
    for (const x of [-W / 2, -W / 6, W / 6, W / 2]) for (const z of [-D / 2 - 0.03, D / 2 + 0.03]) mb.bc(x, H / 2, z, 0.14, H, 0.06, timber);
    for (const z of [-D / 2, D / 2]) for (const x of [-W / 2, W / 2]) mb.bc(x + (x > 0 ? 0.03 : -0.03), H / 2, z * 0.5, 0.06, H, 0.12, timber);
    for (const z of [-D / 2 - 0.035, D / 2 + 0.035]) { mb.bc(0, H - 0.07, z, W, 0.14, 0.06, timber); mb.bc(0, 1.15, z, W, 0.1, 0.06, timber); mb.beam([-W / 2, 0.35, z], [-W / 6, 1.15, z], 0.08, timber); mb.beam([W / 2, 0.35, z], [W / 6, 1.15, z], 0.08, timber); }
    mb.push().ry(Math.PI / 2).roof(D, W, H, 1.7, roofC, 0.35).pop();
    mb.tri([-W / 2, H, -D / 2], [-W / 2, H, D / 2], [-W / 2, H + 1.7, 0], wall); mb.tri([W / 2, H, -D / 2], [W / 2, H, D / 2], [W / 2, H + 1.7, 0], wall);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) mb.push().tr(0, H + 0.34 * i + 0.05, s * (D / 2 + 0.35 - i * 0.43)).bc(0, 0, 0, W + 0.7, 0.04, 0.05, '#4a1e16').pop();
    mb.box(W / 2 - 1.0, H, -0.7, W / 2 - 0.5, H + 2.3, -0.2, '#6a665c');
  } else { mb.box(-W / 2 - 0.1, H, -D / 2 - 0.1, W / 2 + 0.1, H + 0.25, D / 2 + 0.1, roofC); for (let i = -2; i <= 2; i++) mb.bc(i * 0.9, H - 0.2, D / 2 + 0.2, 0.1, 0.1, 0.4, timber); }
  // door (front = +z)
  mb.box(-0.42, 0.3, D / 2 + 0.01, 0.42, 1.75, D / 2 + 0.05, '#2a1c12'); mb.box(-0.5, 1.72, D / 2 + 0.01, 0.5, 1.82, D / 2 + 0.07, timber);
  // windows glow at night
  mb.em = 1; mb.mask = 0.15;
  for (const [x, z, r] of [[-1.35, D / 2 + 0.04, 0], [1.35, D / 2 + 0.04, 0], [-1.0, -D / 2 - 0.04, 0], [1.0, -D / 2 - 0.04, 0], [W / 2 + 0.04, 0, 1], [-W / 2 - 0.04, 0, 1]]) {
    if (r) mb.box(x - 0.02, 1.25, z - 0.32, x + 0.02, 1.85, z + 0.32, '#ffb84a'); else mb.box(x - 0.32, 1.25, z - 0.02, x + 0.32, 1.85, z + 0.02, '#ffb84a');
  }
  mb.em = 0; mb.mask = 1;
  for (const [x, z, r] of [[-1.35, D / 2 + 0.06, 0], [1.35, D / 2 + 0.06, 0], [-1.0, -D / 2 - 0.06, 0], [1.0, -D / 2 - 0.06, 0]]) { mb.bc(x, 1.55, z, 0.04, 0.6, 0.03, timber); mb.bc(x, 1.55, z, 0.64, 0.04, 0.03, timber); }
  return mb;
}
function mkChestM(open) {
  const mb = new MB(41); mb.box(-0.45, 0, -0.3, 0.45, 0.45, 0.3, '#6a4220');
  for (const x of [-0.3, 0.3]) mb.bc(x, 0.23, 0, 0.06, 0.47, 0.62, '#8a8a90');
  if (open) { mb.push().tr(0, 0.45, -0.3).rx(-1.9).box(-0.45, 0, 0, 0.45, 0.06, 0.6, '#7a4a24').pop(); mb.em = 0.7; mb.mask = 0; mb.bc(0, 0.42, 0, 0.7, 0.04, 0.45, '#e8c050'); mb.em = 0; }
  else { mb.box(-0.47, 0.45, -0.32, 0.47, 0.62, 0.32, '#7a4a24'); mb.bc(0, 0.5, 0.33, 0.12, 0.14, 0.03, '#d8b040'); }
  mb.mask = 1;
  return mb;
}
// small item meshes lying on the ground (drops)
function mkLootM(id) {
  const mb = new MB(51); const it = ITEMS[id];
  if (!it) { mb.ico(0, 0.1, 0, 0.12, 0.08, 0.12, '#e8c050', 0, 0, 1); return mb; }
  mb.mask = 0.5;
  switch (it.type) {
    case 'potion': mb.cyl(0, 0, 0, 0.12, 0.12, 0.2, 6, '#b8203a'); mb.cyl(0, 0.2, 0, 0.05, 0.05, 0.1, 5, '#d8d0c0'); break;
    case 'ammo': for (let k = -2; k <= 2; k++) mb.beam([k * 0.04, 0.05, -0.35], [k * 0.04, 0.05, 0.35], 0.025, '#8a6a40'); mb.bc(0, 0.05, 0.3, 0.2, 0.06, 0.08, '#e8e0d0'); break;
    case 'armor': mb.bc(0, 0.08, 0, 0.6, 0.12, 0.45, it.color); mb.bc(0, 0.16, 0.12, 0.5, 0.06, 0.2, it.dark); break;
    default: { const s = itemSpec(id); if (s) { mb.push().tr(0, 0.12, 0).rz(Math.PI / 2).tr(-0.25, -0.8, 0); buildItem(mb, s, 1); mb.pop(); } }
  }
  return mb;
}
function mkCoinsM() { const mb = new MB(52); mb.mask = 0.3; for (let k = 0; k < 6; k++) mb.cyl(Math.cos(k * 2.1) * 0.12, k * 0.025, Math.sin(k * 2.1) * 0.12, 0.08, 0.08, 0.025, 7, '#e8c050'); return mb; }
function mkArrowM() { const mb = new MB(53); mb.mask = 0.4; mb.beam([0, 0, -0.45], [0, 0, 0.45], 0.03, '#8a6a40'); mb.tri([-0.05, 0, 0.45], [0.05, 0, 0.45], [0, 0, 0.6], '#c8d0d8'); mb.tri([0, -0.06, -0.45], [0, 0.06, -0.45], [0, 0, -0.3], '#e8e0d0'); return mb; }
function mkBallM(k) { const mb = new MB(54); if (k === 'pball') { mb.em = 1; mb.mask = 0; } mb.ico(0, 0, 0, 0.09, 0.09, 0.09, k === 'pball' ? '#ffe080' : '#3a3a40', 0, 0, 2); return mb; }
function mkFireballM() { const mb = new MB(55); mb.em = 1; mb.mask = 0; mb.ico(0, 0, 0, 0.32, 0.32, 0.32, '#ff6a1a', 0.2, 0, 3); mb.ico(0, 0, 0, 0.2, 0.2, 0.2, '#ffe080', 0, 0, 4); return mb; }
function mkBoulderM(frost) { const mb = new MB(56); mb.ico(0, 0, 0, 0.6, 0.55, 0.6, frost ? '#bcd8ec' : '#7a7468', 0.22, 1, frost ? 9 : 7); return mb; }
function mkMountainsM() {
  const mb = new MB(61); mb.jit = 0.05; mb.mask = 0.95;
  for (const [R, hmin, hmax, col, seed] of [[300, 40, 120, '#262c38', 5], [255, 22, 80, '#2e3440', 3], [210, 8, 40, '#363c46', 11]]) {
    const N = 120, pts = [];
    for (let i = 0; i <= N; i++) { const a = i / N * TAU, n = vnoise(i * 0.22 + seed, seed) * 0.65 + vnoise(i * 0.9 + seed * 3, 1) * 0.35; pts.push([Math.cos(a) * R, hmin + (hmax - hmin) * n * n * 1.2, Math.sin(a) * R]); }
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[i + 1], m = [(p[0] + q[0]) / 2 * 0.985, Math.max(p[1], q[1]) * (1.05 + hash2(i, seed) * 0.25), (p[2] + q[2]) / 2 * 0.985];
      const b0 = [p[0], -8, p[2]], b1 = [q[0], -8, q[2]];
      const cf = (n, c) => c[1] > hmax * 0.72 && n[1] > 0.1 ? '#c8d0dc' : col;
      mb.quad(b0, b1, q, p, cf); mb.tri(p, q, m, cf);
    }
  }
  return mb;
}
