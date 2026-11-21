const fs = require('fs'), vm = require('vm');
const code = fs.readFileSync(__dirname + '/game.js', 'utf8');
let draws = 0;
function makeCtx(cv) {
  const target = {
    canvas: cv, font: '', fillStyle: '', strokeStyle: '', textBaseline: '', textAlign: '', globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: true, lineWidth: 1,
    measureText(s) { return { width: 7.2 * String(s).length }; },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    drawImage() { draws++; }
  };
  return new Proxy(target, { get(t, k) { if (k in t) return t[k]; return () => {}; }, set(t, k, v) { t[k] = v; return true; } });
}
function canvasEl() { const cv = { width: 300, height: 150, style: {} }; const c = makeCtx(cv); cv.getContext = () => c; return cv; }
function el(id) {
  const cls = new Set();
  const e = { id, style: {}, dataset: {}, innerHTML: '', textContent: '', disabled: false,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), toggle: (c, on) => { if (on === undefined) on = !cls.has(c); on ? cls.add(c) : cls.delete(c); }, contains: c => cls.has(c) },
    addEventListener() {}, setPointerCapture() {} };
  const cv = canvasEl(); e.getContext = cv.getContext; e.width = 300; e.height = 150;
  return e;
}
const els = {};
const document = { readyState: 'complete', getElementById: id => els[id] || (els[id] = el(id)), createElement: () => canvasEl(), addEventListener() {}, body: el('body'), hidden: false };
const store = {};
const window = { innerWidth: +process.env.W || 1280, innerHeight: +process.env.H || 720, devicePixelRatio: +process.env.DPR || 1, addEventListener() {}, __NO_AUTOSTART: true };
const ctx = vm.createContext({ window, document, navigator: { maxTouchPoints: 0, vibrate() {} }, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  performance: { now: () => Date.now() }, requestAnimationFrame() {}, console, Math, Date, JSON, Set, Map, Float32Array, Int16Array, Uint8Array, Uint8ClampedArray, Array, Object, String, Number, setTimeout, Proxy });
vm.runInContext(code, ctx);
const run = s => vm.runInContext(s, ctx);
module.exports = { run, ctx, els, store, stats: () => draws };
