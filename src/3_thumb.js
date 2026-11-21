// =====================================================================
//  ITEM THUMBNAILS — every item type rendered once from its real mesh (buildItem / loot meshes)
//  into a small offscreen WebGL target, read back into a 2D canvas (faceted toon light, 3/4 view,
//  dark outline). Used by the hotbar, inventory, shop, forge, pickup messages and quest rewards.
//  Falls back to a drawn glyph when WebGL is unavailable.
// =====================================================================
const THUMB_PX = 96, THUMB_RS = 192;
const THUMBS = new Map(), THUMB_URL = new Map();
let THUMB_GL = null, THUMB_FAIL = false, thumbN = 0;
const VS_ICON = `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
layout(location=2) in vec4 aCol;
layout(location=3) in vec4 aExt;
out vec3 vN; out vec4 vC; out float vE;
void main() { vN = aNrm; vC = aCol; vE = aExt.y; gl_Position = vec4(aPos, 1.0); }`;
const FS_ICON = `
in vec3 vN; in vec4 vC; in float vE;
out vec4 o;
void main() {
  vec3 n = normalize(vN); if (n.z < 0.0) n = -n;
  vec3 L = normalize(vec3(-0.45, 0.72, 0.62));
  float d = dot(n, L);
  float k = d > 0.62 ? 1.0 : d > 0.18 ? 0.8 : d > -0.2 ? 0.62 : 0.5;
  vec3 c = vC.rgb * (0.22 + 0.86 * k);
  c += vec3(1.0, 0.96, 0.86) * pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 18.0) * 0.28;
  c += vC.rgb * pow(1.0 - n.z, 3.0) * 0.22;
  c = mix(c, vC.rgb * 1.3 + vec3(0.1, 0.05, 0.0), clamp(vE, 0.0, 1.0));
  o = vec4(c, 1.0);
}`;
function thumbGL() {
  if (THUMB_GL || THUMB_FAIL) return THUMB_GL;
  if (!GLOK || !gl) { THUMB_FAIL = true; return null; }
  try {
    const pr = program(VS_ICON, FS_ICON);
    const tex = tex2D(THUMB_RS, THUMB_RS, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST);
    const dep = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, dep); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, THUMB_RS, THUMB_RS);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, dep);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (!ok) { THUMB_FAIL = true; return null; }
    THUMB_GL = { pr, tex, dep, fb, px: new Uint8Array(THUMB_RS * THUMB_RS * 4) };
  } catch (e) { THUMB_FAIL = true; return null; }
  return THUMB_GL;
}
// ---------- 3x3 rotations ----------
function r3axis(ax, a) {
  const [x, y, z] = ax, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
function r3mul(A, B) { const o = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return o; }
function r3v(M, v) { return [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; }
const r3x = a => r3axis([1, 0, 0], a), r3y = a => r3axis([0, 1, 0], a);
// rotation taking unit vector a onto unit vector b
function r3align(a, b) {
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  let ax = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; const l = Math.hypot(...ax);
  if (l < 1e-6) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : r3axis(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], Math.PI);
  ax = ax.map(v => v / l); return r3axis(ax, Math.atan2(l, c));
}
// ---------- the mesh and its framing for one item ----------
function iconSource(id) {
  const it = ITEMS[id]; if (!it) return null;
  const b = it.base || id, mb = new MB(77), sp = itemSpec(b);
  if (sp) { mb.tr(-HAND.x, -HAND.y, -HAND.z); buildItem(mb, sp, 1); return { mb, kind: it.type === 'shield' ? 'shield' : it.type === 'torch' ? 'torch' : 'long' }; }
  if (it.type === 'armor') { mkArmorIcon(mb, it); return { mb, kind: 'upright' }; }
  if (b === 'arrows') { // three arrows fanned toward the upper right
    for (let k = -1; k <= 1; k++) {
      mb.push().rz(-Math.PI / 4 + k * 0.16).tr(k * 0.05, 0, k * 0.02);
      mb.beam([0, -0.5, 0], [0, 0.42, 0], 0.035, '#c8945a');
      mb.tri([-0.07, 0.42, 0], [0.07, 0.42, 0], [0, 0.62, 0], '#e8eef4'); mb.tri([0, 0.42, -0.07], [0, 0.42, 0.07], [0, 0.62, 0], '#b8c0c8');
      mb.tri([0, -0.5, 0], [-0.09, -0.5, 0], [0, -0.3, 0], k ? '#f4f0e8' : '#ff6a4a'); mb.tri([0, -0.5, 0], [0.09, -0.5, 0], [0, -0.3, 0], k ? '#e8e0d0' : '#e85a3a');
      mb.pop();
    }
    return { mb, kind: 'upright' };
  }
  return { mb: mkLootM(b), kind: it.type === 'potion' ? 'potion' : it.type === 'ammo' ? 'ammo' : 'flat' };
}
function iconOrient(src) {
  const d = src.mb.d, n = d.length / 14;
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += d[i * 14]; cy += d[i * 14 + 1]; cz += d[i * 14 + 2]; }
  cx /= n; cy /= n; cz /= n;
  let R;
  if (src.kind === 'long' || src.kind === 'torch') {
    // main axis -> screen diagonal (tip up-right), then roll to show the widest face
    let ax = null;
    if (src.kind === 'torch') { let ex = 0, ey = 0, ez = 0, ne = 0; for (let i = 0; i < n; i++) if (d[i * 14 + 11] > 0.5) { ex += d[i * 14]; ey += d[i * 14 + 1]; ez += d[i * 14 + 2]; ne++; } if (ne) ax = [ex / ne - cx, ey / ne - cy, ez / ne - cz]; }
    if (!ax) { let bd = -1; for (let i = 0; i < n; i++) { const x = d[i * 14] - cx, y = d[i * 14 + 1] - cy, z = d[i * 14 + 2] - cz, q = x * x + y * y + z * z; if (q > bd) { bd = q; ax = [x, y, z]; } } }
    const l = Math.hypot(...ax) || 1; ax = ax.map(v => v / l);
    const t = [Math.SQRT1_2, Math.SQRT1_2, 0], A = r3align(ax, t);
    let best = -1, bestR = A;
    for (let k = 0; k < 16; k++) {
      const M = r3mul(r3axis(t, k / 16 * Math.PI), A); let area = 0;
      for (let i = 0; i < n; i += 3) {
        const p0 = r3v(M, [d[i * 14], d[i * 14 + 1], d[i * 14 + 2]]), p1 = r3v(M, [d[i * 14 + 14], d[i * 14 + 15], d[i * 14 + 16]]), p2 = r3v(M, [d[i * 14 + 28], d[i * 14 + 29], d[i * 14 + 30]]);
        area += Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]));
      }
      if (area > best * 1.02) { best = area; bestR = M; }
    }
    R = r3mul(r3axis(t, 0.42), bestR);
    R = r3mul(r3x(0.18), R);
  } else if (src.kind === 'shield') R = r3mul(r3x(0.16), r3mul(r3y(0.5), r3y(-Math.PI / 2)));
  else if (src.kind === 'upright') R = r3mul(r3x(0.14), r3y(0.5));
  else if (src.kind === 'potion') R = r3mul(r3x(0.32), r3y(0.6));
  else if (src.kind === 'ammo') R = r3mul(r3x(0.7), r3y(0.85));
  else R = r3mul(r3x(0.62), r3y(0.6));
  // project, fit the square with a margin, map depth into clip space
  const P2 = new Float32Array(n * 3);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < n; i++) {
    const p = r3v(R, [d[i * 14] - cx, d[i * 14 + 1] - cy, d[i * 14 + 2] - cz]);
    P2[i * 3] = p[0]; P2[i * 3 + 1] = p[1]; P2[i * 3 + 2] = p[2];
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
  }
  const s = 1.68 / Math.max(x1 - x0, y1 - y0, 1e-3), mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2, zr = Math.max(1e-3, (z1 - z0) / 2) * 1.1;
  const out = d.slice();
  for (let i = 0; i < n; i++) {
    const o = i * 14;
    out[o] = (P2[i * 3] - mx) * s; out[o + 1] = (P2[i * 3 + 1] - my) * s; out[o + 2] = -(P2[i * 3 + 2] - mz) / zr * 0.9;
    const nn = r3v(R, [d[o + 3], d[o + 4], d[o + 5]]); out[o + 3] = nn[0]; out[o + 4] = nn[1]; out[o + 5] = nn[2];
    out[o + 9] = 0;
  }
  return out;
}
function renderThumbGL(id) {
  const T = thumbGL(); if (!T) return null;
  const src = iconSource(id); if (!src || !src.mb.d.length) return null;
  const mesh = gpuMesh({ d: iconOrient(src) });
  gl.bindFramebuffer(gl.FRAMEBUFFER, T.fb); gl.viewport(0, 0, THUMB_RS, THUMB_RS);
  gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
  gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(T.pr.p); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  gl.readPixels(0, 0, THUMB_RS, THUMB_RS, gl.RGBA, gl.UNSIGNED_BYTE, T.px);
  gl.bindVertexArray(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteBuffer(mesh.vbo); gl.deleteVertexArray(mesh.vao);
  const big = mkCanvas(THUMB_RS, THUMB_RS), bx = big.getContext('2d'), im = bx.createImageData(THUMB_RS, THUMB_RS);
  for (let y = 0; y < THUMB_RS; y++) im.data.set(T.px.subarray((THUMB_RS - 1 - y) * THUMB_RS * 4, (THUMB_RS - y) * THUMB_RS * 4), y * THUMB_RS * 4);
  bx.putImageData(im, 0, 0);
  return big;
}
// fallback: the old pixel icon, or the item's glyph on a tinted disc
function renderThumbGlyph(id) {
  const it = ITEMS[id], c = mkCanvas(THUMB_RS, THUMB_RS), x = c.getContext('2d');
  const nm = typeof itemIcon === 'function' ? itemIcon(it) : 'fist', rows = typeof ICONS !== 'undefined' ? ICONS[nm] : null;
  if (rows && it && it.type !== 'mat' && it.type !== 'potion' && it.type !== 'ammo') {
    const s = Math.floor(THUMB_RS * 0.8 / Math.max(rows.length, rows[0].length)), w = rows[0].length * s, h = rows.length * s;
    for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].length; k++) { const ch = rows[r][k]; if (ch === '.') continue; x.fillStyle = (it.type === 'armor' && ch === 'A' ? it.color : ICOL[ch]) || '#ccc'; x.fillRect((THUMB_RS - w) / 2 + k * s, (THUMB_RS - h) / 2 + r * s, s, s); }
  } else {
    x.fillStyle = it ? (it.col || (it.type === 'potion' ? '#e8304a' : '#c8b898')).replace('!', '') : '#888';
    x.beginPath(); x.arc(THUMB_RS / 2, THUMB_RS / 2, THUMB_RS * 0.34, 0, TAU); x.fill();
    x.fillStyle = '#1a120a'; x.font = 'bold ' + Math.round(THUMB_RS * 0.42) + 'px ui-monospace,monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(it ? it.glyph : '?', THUMB_RS / 2, THUMB_RS / 2 + 4);
  }
  return c;
}
function thumbFinish(big) {
  const S2 = THUMB_PX, c = mkCanvas(S2, S2), x = c.getContext('2d');
  if (!x || typeof x.drawImage !== 'function') return c;
  const sil = mkCanvas(S2, S2), sx = sil.getContext('2d');
  sx.imageSmoothingEnabled = true; sx.drawImage(big, 0, 0, S2, S2);
  sx.globalCompositeOperation = 'source-in'; sx.fillStyle = 'rgba(14,9,5,0.92)'; sx.fillRect(0, 0, S2, S2);
  for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1.4, 1.4], [-1.4, 1.4], [1.4, -1.4], [-1.4, -1.4]]) x.drawImage(sil, dx, dy);
  x.imageSmoothingEnabled = true; x.drawImage(big, 0, 0, S2, S2);
  return c;
}
// the thumbnail canvas for any item id (variants share their base item's picture)
function thumbCanvas(id) {
  const b = baseId(id); let c = THUMBS.get(b); if (c) return c;
  let big = null;
  try { big = renderThumbGL(b); } catch (e) { big = null; THUMB_FAIL = true; }
  if (!big) big = renderThumbGlyph(b);
  c = thumbFinish(big); c.gl = !!(THUMB_GL && !THUMB_FAIL); THUMBS.set(b, c); thumbN++;
  return c;
}
function thumbURL(id) {
  const b = baseId(id); let u = THUMB_URL.get(b); if (u !== undefined) return u;
  const c = thumbCanvas(b); u = ''; try { u = c.toDataURL ? c.toDataURL('image/png') : ''; } catch (e) { u = ''; }
  THUMB_URL.set(b, u); return u;
}
function thumbsInit() { for (const k in ITEM_DEFS) thumbCanvas(k); }
