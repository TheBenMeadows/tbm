// Computes one piece's traits and the CIELAB travel of its three colour intervals.
// The Intervals script is loaded from the artist's site at run time, unmodified; the functions
// below stand in for the few p5 1.9.0 colour and math calls its setup() uses.
const RGB = 'rgb', HSB = 'hsb';
const MAXES = { rgb: [255, 255, 255, 255], hsb: [360, 100, 100, 1] };
let colorModeNow = RGB;
function hsbaToRGBA(e) {
  let t, r, o, n, s, i = 6 * e[0], a = e[1], l = e[2];
  if (a === 0) return [l, l, l, e[3]];
  r = l * (1 - a); t = Math.floor(i); o = l * (1 - a * (i - t)); a = l * (1 - a * (1 + t - i));
  if (t === 1) { n = o; s = l; i = r; } else if (t === 2) { n = r; s = l; i = a; } else if (t === 3) { n = r; s = o; i = l; }
  else if (t === 4) { n = a; s = r; i = l; } else if (t === 5) { n = l; s = r; i = o; } else { n = l; s = a; i = r; }
  return [n, s, i, e[3]];
}
class Color {
  constructor(args) {
    const a = MAXES[colorModeNow];
    const l = [args[0] / a[0], args[1] / a[1], args[2] / a[2], typeof args[3] === 'number' ? args[3] / a[3] : 1];
    for (let n = l.length - 1; n >= 0; --n) { const u = l[n]; if (u < 0) l[n] = 0; else if (u > 1) l[n] = 1; }
    this._array = colorModeNow === HSB ? hsbaToRGBA(l) : l;
  }
}
const pick = (args, better) => { const arr = Array.isArray(args[0]) ? args[0] : args; let t = arr[0]; for (const a of arr) if (better(a, t)) t = a; return t; };
Object.assign(self, {
  window: self, RGB, HSB, PI: Math.PI, windowWidth: 850, windowHeight: 700,
  createCanvas() {}, noStroke() {}, noFill() {},
  colorMode(m) { colorModeNow = m; },
  color(...args) { if (args[0] instanceof Color) return args[0]; return new Color(Array.isArray(args[0]) ? args[0] : args); },
  red: c => c._array[0] * 255, green: c => c._array[1] * 255, blue: c => c._array[2] * 255,
  degrees: x => x * (180 / Math.PI), radians: x => x * (Math.PI / 180),
  dist: (...t) => (t.length === 4 ? Math.hypot(t[2] - t[0], t[3] - t[1]) : Math.hypot(t[3] - t[0], t[4] - t[1], t[5] - t[2])),
  abs: Math.abs, sqrt: Math.sqrt, sq: x => x * x, pow: Math.pow, floor: Math.floor,
  atan2: Math.atan2, cos: Math.cos, sin: Math.sin,
  round: (e, t) => (t ? ((t = Math.pow(10, t)), Math.round(e * t) / t) : Math.round(e)),
  min: (...a) => pick(a, (x, y) => x < y), max: (...a) => pick(a, (x, y) => x > y),
});

let loaded = false;
self.onmessage = e => {
  const { id, hash, src } = e.data;
  if (!loaded) {
    try { importScripts(src); loaded = true; } catch (err) { self.postMessage({ id, ok: false, phase: 'load', error: String(err) }); return; }
  }
  try {
    lmin = 5; dmin = 10; plot = false; // setup() adjusts these while it retries; start each piece from the script's own defaults
    self.tokenData = { hash, tokenId: '6999999' };
    setup();
    if (!Array.isArray(c) || c.length !== 6 || !Array.isArray(bw) || bw.length !== 3 || !self.$features) throw new Error('unexpected script state');
    const labs = c.map(x => rgbToLab(x.col));
    const spans = [0, 1, 2].map(j => Math.hypot(labs[2 * j][0] - labs[2 * j + 1][0], labs[2 * j][1] - labs[2 * j + 1][1], labs[2 * j][2] - labs[2 * j + 1][2]));
    const lo = Math.min(...bw);
    const ratio = bw.map(x => Math.round(x / lo)).sort((a, b) => a - b).join(':');
    self.postMessage({ id, ok: true, spans, ratio, features: { ...self.$features } });
  } catch (err) {
    self.postMessage({ id, ok: false, phase: 'run', error: String(err) });
  }
};
