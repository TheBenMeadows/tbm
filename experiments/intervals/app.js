const GEN = 'https://heftgallery.com';
const NAMES = { none: 'No variant', analogous: 'Analogous', saturated: 'Saturated', tinted: 'Tinted', complementary: 'Complementary', monochromatic: 'Monochromatic', achromatic: 'Achromatic' };
const VARS = Object.keys(NAMES);
const THUMB = { none: 3806, analogous: 938, saturated: 422, tinted: 192, complementary: 2713, monochromatic: 42299, achromatic: 16798 };
const SVGNS = 'http://www.w3.org/2000/svg';
const fmt = n => n.toLocaleString('en-US');
const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';
const oneIn = r => fmt(Math.round(1 / r));
const clamp01 = x => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;
const $ = id => document.getElementById(id);

let D;
try {
  const r = await fetch('data/site.json');
  if (!r.ok) throw new Error('HTTP ' + r.status);
  D = await r.json();
} catch (err) {
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = `The data file for this page did not load (${err.message}). Reload to try again.`;
  document.querySelector('main').prepend(p);
  throw err;
}

const S = D.statics, V = D.variants, C = D.counts10, n10 = D.n10;
const staticsAll = Object.values(S).reduce((a, b) => a + b, 0);
const under = (v, cut) => D.spanmax_hist10[v].slice(0, Math.round(cut * 10)).reduce((a, b) => a + b, 0);
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five'];

// ---- numbers in the prose
const fill = {
  staticsAll: fmt(staticsAll),
  monoShare: pct(S.monochromatic / staticsAll, 1),
  mono1in: oneIn(S.monochromatic / V.monochromatic),
  monoMedian: String(D.travel10.monochromatic.median_capped20),
  noneFar: pct(1 - D.travel10.none.under20 / D.travel10.none.of, 1),
  noneStatics: WORDS[S.none] ?? fmt(S.none),
  noneAll: fmt(V.none),
  barsMid: pct(C.bars['36'] / n10, 1),
  vertShare: pct(D.orientation10['0'] / n10),
  evenShare: pct(D.widths10['0'] / n10, 1),
  lastPos: fmt(D.n - 1),
  manifest: D.manifest_sha256.slice(0, 12) + '…',
};
document.querySelectorAll('[data-k]').forEach(e => { e.textContent = fill[e.dataset.k]; });
document.querySelector('.big [data-k="noneStatics"]').textContent = fmt(S.none);

// ---- saved renders
const traitLine = f => `${f.Bars} bars, ${f['Bar Orientation'].toLowerCase()}, ${f['Bar Width'].toLowerCase()} widths, ${f['Color Variant'] === 'None' ? 'no variant' : f['Color Variant']}`;
document.querySelectorAll('img[data-art]').forEach(img => {
  const id = img.dataset.art, f = D.art[id];
  img.alt = `Intervals, position ${fmt(+id)}: ${traitLine(f)}`;
  img.decoding = 'async';
});
document.querySelectorAll('[data-cap]').forEach(e => { e.textContent = `Position ${fmt(+e.dataset.cap)}: ${traitLine(D.art[e.dataset.cap])}`; });
document.querySelectorAll('[data-tag]').forEach(e => { e.textContent = `${D.art[e.dataset.tag].Bars} bars`; });
document.querySelectorAll('[data-hash]').forEach(e => { e.textContent = D.art[e.dataset.hash].hash; });
// start and end color of each interval, with the distance between them
document.querySelectorAll('[data-sw]').forEach(e => {
  const rec = D.intervals[e.dataset.sw];
  rec.pairs.forEach((pair, k) => {
    const cell = document.createElement('span'), chip = document.createElement('i');
    for (const hex of pair) { const half = document.createElement('b'); half.style.background = '#' + hex; chip.appendChild(half); }
    cell.append(chip, rec.spans[k].toFixed(1));
    e.appendChild(cell);
  });
  e.setAttribute('aria-label', `Interval distances: ${rec.spans.map(x => x.toFixed(1)).join(', ')} CIELAB units`);
});

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

// ---- chart: seven fixed rows; every state gives each row a value, and the dots are drawn
// at a blend of two neighboring states so they follow the scroll position exactly
const cutInput = $('cut');
const share = v => V[v] / D.n, rate = v => S[v] / V[v];
const cap100 = `${fmt(D.n)} hashes, positions 0 to ${fmt(D.n - 1)}.`;
const STATES = {
  shares: {
    title: () => 'Share of pieces by color variant',
    note: () => `Ring: the weight written into the script. Dot: observed in ${cap100}`,
    scale: { log: false, min: 0, max: 0.6, ticks: [0, 0.2, 0.4, 0.6], tf: t => Math.round(t * 100) + '%' },
    val: share, text: v => pct(share(v)), ring: v => D.odds[v] / 100, r: 4,
  },
  counts: {
    title: () => 'No-blend pieces, by variant',
    note: () => `Log scale. ${cap100}`,
    scale: { log: true, min: 0.5, max: 3e5, ticks: [1, 100, 1e4], tf: fmt },
    val: v => S[v], text: v => fmt(S[v]), hot: true, r: 6,
  },
  rates: {
    title: () => 'How often each variant fails to blend',
    note: () => `No-blend pieces as a share of each variant, log scale. ${cap100}`,
    scale: { log: true, min: 1e-8, max: 0.1, ticks: [1e-7, 1e-5, 1e-3, 1e-1], tf: t => '1 in ' + fmt(Math.round(1 / t)) },
    val: rate, text: v => (v === 'none' ? `${fmt(S.none)} in ${fmt(V.none)}` : '1 in ' + oneIn(rate(v))), hot: true, r: 6,
    lit: ['monochromatic', 'none'],
  },
  cut: {
    title: () => `Pieces with every interval under ${+cutInput.value} units`,
    note: () => `Log scale. First ${fmt(n10)} hashes only: they hold position ${fmt(D.none_static[0].index)} but not ${fmt(D.none_static[1].index)}.`,
    scale: { log: true, min: 0.5, max: 2e6, ticks: [1, 100, 1e4, 1e6], tf: fmt },
    val: v => under(v, +cutInput.value), text: v => fmt(under(v, +cutInput.value)), hot: true, r: 6,
  },
};
const chart = (() => {
  const host = $('chart'), title = $('chartTitle'), note = $('chartNote');
  let W = 0, H = 0, x0 = 0, x1 = 0, rows = {}, axes = {}, svg = null, shown = null;
  const sx = (sc, v) => {
    const f = sc.log ? (Math.log10(Math.max(v, sc.min)) - Math.log10(sc.min)) / (Math.log10(sc.max) - Math.log10(sc.min)) : (v - sc.min) / (sc.max - sc.min);
    return x0 + f * (x1 - x0);
  };
  function build() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (svg && w === W && h === H)) return;
    W = w; H = h;
    host.replaceChildren();
    svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    const narrow = W < 480, tiny = W < 340, top = 22, rowH = Math.max(14, Math.min(58, (H - top) / VARS.length));
    const thumbW = tiny ? 0 : narrow ? 20 : 44, thumbH = Math.max(0, Math.min(rowH - 8, narrow ? 18 : 30)), labelW = thumbW + (tiny ? 100 : narrow ? 116 : 132), valW = narrow ? 104 : 132;
    svg.classList.toggle('narrow', narrow);
    x0 = labelW; x1 = W - valW;
    for (const [name, st] of Object.entries(STATES)) {
      const g = el('g', { opacity: 0 }, svg), sc = st.scale;
      let lastEnd = -Infinity;
      for (const t of sc.ticks) {
        const x = sx(sc, t), half = sc.tf(t).length * 3.7;
        el('line', { x1: x, x2: x, y1: top - 4, y2: top + rowH * VARS.length, class: 'grid' }, g);
        if (x - half < lastEnd + 8 || x + half > W) continue;
        el('text', { x, y: 12, 'text-anchor': 'middle' }, g).textContent = sc.tf(t);
        lastEnd = x + half;
      }
      axes[name] = g;
    }
    el('line', { x1: x0, x2: x0, y1: top - 4, y2: top + rowH * VARS.length, class: 'base' }, svg);
    VARS.forEach((v, i) => {
      const y = top + i * rowH + rowH / 2, g = el('g', {}, svg);
      if (thumbW) el('image', { href: `art/${THUMB[v]}-s.webp`, x: 0, y: y - thumbH / 2, width: thumbW, height: thumbH, preserveAspectRatio: 'xMidYMid slice' }, g);
      el('text', { x: thumbW ? thumbW + 8 : 0, y: y + 5, class: 'lab' }, g).textContent = NAMES[v];
      const ring = el('circle', { r: 9, cy: y, class: 'ring' }, g);
      const dot = el('circle', { cy: y, class: 'dot' }, g);
      const val = el('text', { x: W, y: y + 4, 'text-anchor': 'end', class: 'val' }, g);
      rows[v] = { g, ring, dot, val };
    });
    shown = null;
  }
  // a and b are state names (b may equal a); t in 0..1 is how far the scroll has moved from a to b
  function draw(a, b, t) {
    if (!svg) build();
    if (!svg) return;
    const A = STATES[a], B = STATES[b], near = t < 0.5 ? A : B, nearName = t < 0.5 ? a : b;
    const dip = a === b ? 1 : Math.abs(1 - 2 * t);
    const out = a === b ? 1 : clamp01(1 - t / 0.45), inn = clamp01((t - 0.55) / 0.45);
    for (const name of Object.keys(axes)) axes[name].setAttribute('opacity', name === a ? out : name === b ? inn : 0);
    for (const v of VARS) {
      const r = rows[v];
      r.dot.setAttribute('cx', lerp(sx(A.scale, A.val(v)), sx(B.scale, B.val(v)), t));
      r.dot.setAttribute('r', lerp(A.r, B.r, t));
      r.dot.setAttribute('class', 'dot' + (near.hot && v === 'none' ? ' hot' : ''));
      const ringNow = near.ring ? near : null;
      r.ring.setAttribute('opacity', lerp(A.ring ? 1 : 0, B.ring ? 1 : 0, t));
      if (ringNow) r.ring.setAttribute('cx', sx(ringNow.scale, ringNow.ring(v)));
      const txt = near.text(v);
      if (r.val.textContent !== txt) r.val.textContent = txt;
      r.val.setAttribute('opacity', dip);
      const litA = !A.lit || A.lit.includes(v) ? 1 : 0.28, litB = !B.lit || B.lit.includes(v) ? 1 : 0.28;
      r.g.setAttribute('opacity', lerp(litA, litB, t));
    }
    const key = nearName + '|' + (nearName === 'cut' ? cutInput.value : '');
    if (key !== shown) {
      shown = key;
      title.textContent = near.title(); note.textContent = near.note();
      svg.setAttribute('aria-label', near.title() + ': ' + VARS.map(v => `${NAMES[v]} ${near.text(v)}`).join(', '));
    }
    title.style.opacity = note.style.opacity = dip;
  }
  return { build, draw };
})();

// ---- scroll engine: one continuous position p (step index plus progress) drives everything
const steps = [...document.querySelectorAll('#story .step')];
const scenes = Object.fromEntries([...document.querySelectorAll('.scene')].map(e => [e.dataset.scene, e]));
const cutctl = $('cutctl');
const wide = matchMedia('(min-width: 62rem)'), calm = matchMedia('(prefers-reduced-motion: reduce)');
const heroCap = $('heroCap');
let centers = [], raf = 0;
function measure() {
  centers = steps.map(s => { const r = s.getBoundingClientRect(); return r.top + scrollY + (s.classList.contains('lead') ? r.height * 0.5 : Math.min(r.height / 2, innerHeight * 0.25)); });
}
function position() {
  const anchor = scrollY + innerHeight * (wide.matches ? 0.5 : 0.8);
  if (anchor <= centers[0]) return 0;
  for (let i = 0; i < centers.length - 1; i++) {
    if (anchor < centers[i + 1]) {
      const gap = centers[i + 1] - centers[i];
      if (!(gap > 0)) return i;
      const f = (anchor - centers[i]) / gap;
      const t = wide.matches ? clamp01((f - 0.3) / 0.5) : clamp01((f - 0.5) / 0.45);
      return i + t * t * (3 - 2 * t);
    }
  }
  return centers.length - 1;
}
function render() {
  raf = 0;
  const p = position(), i = Math.floor(p), t = p - i, j = Math.min(i + 1, steps.length - 1);
  const w = {};
  w[steps[i].dataset.scene] = 1 - t;
  w[steps[j].dataset.scene] = (w[steps[j].dataset.scene] ?? 0) + t;
  for (const [name, e] of Object.entries(scenes)) {
    const o = w[name] ?? 0;
    e.style.opacity = o;
    e.style.visibility = o > 0.01 ? 'visible' : 'hidden';
    e.style.transform = !calm.matches && o > 0.01 && o < 1 ? `translateY(${(1 - o) * 14}px)` : '';
  }
  const ca = steps[i].dataset.chart, cb = steps[j].dataset.chart;
  if (ca || cb) chart.draw(ca ?? cb, cb ?? ca, ca && cb ? t : 0);
  const cutOn = (ca === 'cut' ? 1 - t : 0) + (cb === 'cut' && j !== i ? t : 0);
  cutctl.style.opacity = cutOn;
  cutctl.classList.toggle('on', cutOn > 0.6);
  cutctl.inert = cutOn <= 0.6;
  heroCap.style.opacity = clamp01(p);
  if (wide.matches && !calm.matches) steps.forEach((s, k) => s.style.setProperty('--f', (0.3 + 0.7 * clamp01(1 - Math.abs(p - k))).toFixed(2)));
  else if (steps[0].style.getPropertyValue('--f')) steps.forEach(s => s.style.removeProperty('--f'));
}
const queue = () => { if (!raf) raf = requestAnimationFrame(render); };
const relayout = () => { measure(); chart.build(); queue(); };
addEventListener('scroll', queue, { passive: true });
addEventListener('resize', relayout);
wide.addEventListener('change', relayout);
calm.addEventListener('change', queue);
new ResizeObserver(relayout).observe($('box'));
document.fonts?.ready.then(relayout);
cutInput.addEventListener('input', () => { $('cutVal').textContent = +cutInput.value; queue(); });
$('cutVal').textContent = +cutInput.value;
relayout();

// ---- tables
function table(caption, head, rows) {
  const t = document.createElement('table');
  const cap = t.createCaption(); cap.textContent = caption;
  const hr = t.createTHead().insertRow();
  head.forEach(c => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = c; hr.appendChild(th); });
  const body = t.createTBody();
  rows.forEach(r => { const tr = body.insertRow(); r.forEach((c, i) => { const td = i ? tr.insertCell() : tr.appendChild(Object.assign(document.createElement('th'), { scope: 'row' })); td.textContent = c; }); });
  $('t-all').appendChild(t);
}
table(`Color variant, ${fmt(D.n)} hashes`, ['Variant', 'Script weight', 'Pieces', 'Share', 'No-blend', 'Rate'],
  VARS.map(v => [NAMES[v], D.odds[v] + '%', fmt(V[v]), pct(share(v), 3), fmt(S[v]), `1 in ${oneIn(rate(v))}`]));
table(`Every interval under the cut-off, first ${fmt(n10)} hashes`, ['Variant', '2 units', '3 units', '4 units', '5 units'],
  VARS.map(v => [NAMES[v], ...[2, 3, 4, 5].map(c => fmt(under(v, c)))]));
const barsK = Object.keys(C.bars).map(Number).sort((a, b) => a - b);
table(`Bar count, first ${fmt(n10)} hashes`, ['Bars', 'Pieces', 'Share'], barsK.map(b => [b, fmt(C.bars[b]), pct(C.bars[b] / n10)]));
const ratK = Object.keys(C.ratio).sort((a, b) => C.ratio[b] - C.ratio[a]);
table(`Width ratio, first ${fmt(n10)} hashes`, ['Ratio', 'Pieces', 'Share'], ratK.map(r => [r, fmt(C.ratio[r]), pct(C.ratio[r] / n10)]));
table(`Orientation, first ${fmt(n10)} hashes`, ['Orientation', 'Pieces', 'Share'],
  [['Vertical', D.orientation10['0']], ['Horizontal', D.orientation10['1']]].map(([l, c]) => [l, fmt(c), pct(c / n10)]));

// ---- check a hash
const frame = $('frame'), frameMsg = $('frameMsg'), traits = $('traits').tBodies[0], spanOut = $('spanOut'), qHash = $('qHash');
const SCRIPT = `${GEN}/art/intervals/intervals.js`;
let worker = null, req = 0, slowTimer = 0, workTimer = 0;
function startWorker() {
  try { worker = new Worker('spans-worker.js'); } catch { worker = null; return; }
  worker.onmessage = onWorker;
  worker.onerror = () => { if (workTimer) { clearTimeout(workTimer); workTimer = 0; setSpans('The blend distances could not be computed in this browser.'); } };
}
async function hashAt(i) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('intervals-r3:' + i));
  return '0x' + [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function showTraits(f, ratio) {
  const variant = String(f['Color Variant'] ?? '').toLowerCase(), bars = String(f.Bars), horiz = f['Bar Orientation'] === 'Horizontal', varied = f['Bar Width'] === 'Varied';
  const rowsOut = [
    ['Color variant', NAMES[variant] ?? f['Color Variant'], V[variant] !== undefined ? `${pct(V[variant] / D.n)} of ${fmt(D.n)}` : ''],
    ['Bars', bars, C.bars[bars] !== undefined ? `${pct(C.bars[bars] / n10, 1)} of the first ${fmt(n10)}` : ''],
    ['Orientation', f['Bar Orientation'], `${pct(D.orientation10[horiz ? '1' : '0'] / n10)} of the first ${fmt(n10)}`],
    ['Bar width', ratio ? `${f['Bar Width']} (${ratio})` : f['Bar Width'], ratio && C.ratio[ratio] !== undefined ? `${pct(C.ratio[ratio] / n10, 1)} of the first ${fmt(n10)}` : `${pct(D.widths10[varied ? '1' : '0'] / n10, 1)} of the first ${fmt(n10)}`],
  ];
  traits.replaceChildren();
  for (const r of rowsOut) { const tr = traits.insertRow(); r.forEach((c, i) => { const td = i ? tr.insertCell() : tr.appendChild(Object.assign(document.createElement('th'), { scope: 'row' })); td.textContent = c; }); }
  return variant;
}
function setSpans(text, strong) {
  spanOut.replaceChildren();
  if (strong) { const b = document.createElement('b'); b.textContent = strong; spanOut.append(b, ' '); }
  spanOut.append(text);
}
function clearResult(message) {
  req++;
  clearTimeout(slowTimer); clearTimeout(workTimer); workTimer = 0;
  qHash.textContent = ''; traits.replaceChildren(); frameMsg.hidden = true;
  delete frame.dataset.hash;
  try { frame.contentWindow.location.replace('about:blank'); } catch { frame.removeAttribute('src'); }
  setSpans(message);
}
async function lookup(raw) {
  const q = raw.trim();
  let hash;
  if (/^(0x)?[0-9a-f]{64}$/i.test(q)) hash = '0x' + q.toLowerCase().replace(/^0x/, '');
  else if (/^\d{1,15}$/.test(q)) {
    if (!globalThis.crypto?.subtle) { clearResult('Positions need a secure (https) page to be turned into hashes. Paste the full hash instead.'); return; }
    const mine = ++req;
    try { hash = await hashAt(+q); } catch { clearResult('That position could not be turned into a hash in this browser.'); return; }
    if (mine !== req) return;
  } else { clearResult('Enter a hash (64 hexadecimal characters, with or without 0x) or a whole-number position.'); return; }
  const id = ++req;
  qHash.textContent = hash;
  traits.replaceChildren(); setSpans('Working…');
  frameMsg.hidden = true;
  const url = `${GEN}/art/intervals/generator.html?hash=${hash}&tokenId=6999999`;
  frame.dataset.hash = hash;
  try { frame.contentWindow.location.replace(url); } catch { frame.src = url; }
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    if (id !== req) return;
    frameMsg.replaceChildren('The generator at heftgallery.com has not answered. ');
    frameMsg.append(Object.assign(document.createElement('a'), { href: url, textContent: 'Open this piece there' }), '.');
    frameMsg.hidden = false;
  }, 8000);
  clearTimeout(workTimer); workTimer = 0;
  if (!worker) startWorker();
  if (!worker) { setSpans('Blend distances are not available in this browser. The piece and its traits come from the generator.'); return; }
  worker.postMessage({ id, hash, src: SCRIPT });
  // a worker stuck loading the script cannot be told to stop; replace it
  workTimer = setTimeout(() => {
    workTimer = 0;
    if (id !== req) return;
    worker.terminate(); worker = null;
    setSpans('The artist\'s script at heftgallery.com did not load in time, so blend distances are not available right now.');
  }, 15000);
}
function onWorker(e) {
  const m = e.data;
  if (m.id !== req) return;
  clearTimeout(workTimer); workTimer = 0;
  if (!m.ok) {
    console.warn('spans-worker:', m.phase, m.error);
    setSpans(m.phase === 'load'
      ? 'The artist\'s script did not load from heftgallery.com, so blend distances are not available right now.'
      : 'The script at heftgallery.com no longer matches what this page expects, so blend distances are not shown.');
    return;
  }
  const variant = showTraits(m.features, m.ratio);
  const sp = [...m.spans].sort((a, b) => a - b).map(x => x.toFixed(2));
  const flat = m.spans.every(x => x < 2);
  const oneOfTwo = D.none_static.some(r => r.hash === frame.dataset.hash);
  const tail = oneOfTwo ? ` This is one of the ${WORDS[S.none] ?? S.none} no-variant pieces in ${fmt(D.n)} that do not visibly change.`
    : S[variant] !== undefined ? ` Among ${NAMES[variant]} pieces, ${fmt(S[variant])} of ${fmt(V[variant])} screened are no-blend.` : '';
  setSpans(`Its three intervals travel ${sp.join(', ')} CIELAB units.${tail}`, flat ? 'Does not visibly change.' : 'Blends.');
}
// the frame loading at all means the generator answered; its message adds the traits
frame.addEventListener('load', () => { if (frame.dataset.hash) { clearTimeout(slowTimer); frameMsg.hidden = true; } });
addEventListener('message', e => {
  if (e.origin !== GEN || e.data?.type !== 'intervals:ready' || e.data.hash !== frame.dataset.hash) return;
  clearTimeout(slowTimer); frameMsg.hidden = true;
  if (!traits.rows.length && e.data.features) showTraits(e.data.features, null);
});
$('lookupForm').addEventListener('submit', e => { e.preventDefault(); lookup($('q').value); });
$('qRandom').addEventListener('click', () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  $('q').value = '0x' + [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
  lookup($('q').value);
});
new IntersectionObserver((es, io) => { if (es.some(e => e.isIntersecting)) { io.disconnect(); lookup($('q').value); } }, { rootMargin: '600px' }).observe($('lookup'));
