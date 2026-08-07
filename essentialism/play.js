/* essentialism - live renderer for thebenmeadows.com/essentialism/
   Uses bootloader's exact on-chain seeding (splitmix64 -> sfc32). No eval: the
   generator is a real function loaded from essentialism.js (CSP script-src 'self').

   Note on minted editions: bootloader renders each token from a seed that is not
   currently derivable from the token's public on-chain seed value (reported as
   objkt-com/bootloader-monorepo#30). So minted editions below are shown using
   bootloader's own rendered image, never a local re-render. The playground is
   explicitly exploration, not a preview of anything minted. */

function splitmix64(f) { let n = f; return function () { let x = n = n + 0x9e3779b97f4a7c15n & 0xffffffffffffffffn; x = ((x = (x ^ x >> 30n) * 0xbf58476d1ce4e5b9n & 0xffffffffffffffffn) ^ x >> 27n) * 0x94d049bb133111ebn & 0xffffffffffffffffn; return Number(4294967295n & (x ^= x >> 31n)) >>> 0 } }
function sfc32(f, n, $, t) { return function () { $ |= 0; let e = ((f |= 0) + (n |= 0) | 0) + (t |= 0) | 0; return t = t + 1 | 0, f = n ^ n >>> 9, n = $ + ($ << 3) | 0, $ = ($ = $ << 21 | $ >>> 11) + e | 0, (e >>> 0) / 4294967296 } }

var NS = 'http://www.w3.org/2000/svg';
var EDITIONS = 44, W = 750, H = 1000;
var TZKT = 'https://api.tzkt.io/v1/bigmaps/771409/keys?value.generator_id=407&select=key,value&limit=60';
var META = 'https://api.tzkt.io/v1/tokens?contract=KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt&select=tokenId,metadata&tokenId.in=';
var GENERATOR = 'https://api.tzkt.io/v1/bigmaps/771404/keys/407';
var THUMB = 'https://media.bootloader.art/svg-js/v1/thumbnail/';
var TOKEN = 'https://bootloader.art/token/svg-js/';

/* TzKT hands back bytes as hex when they are not valid UTF-8 */
function asText(v) {
  if (typeof v !== 'string') return '';
  if (/^[0-9a-f]+$/i.test(v) && v.length > 64 && v.length % 2 === 0) {
    var s = '';
    for (var i = 0; i < v.length; i += 2) s += String.fromCharCode(parseInt(v.substr(i, 2), 16));
    return s;
  }
  return v;
}
/* the artifact states its own seed; pull it without decoding the whole thing */
function seedFromArtifact(artifactUri) {
  var m = asText(artifactUri).match(/SEED%3D([0-9]+)n%3B/);
  return m ? BigInt(m[1]) : null;
}

var METAS = {};

/* Per-edition detail. The trait line is not stored as text on-chain: the token's
   SVG creates it at runtime via put('desc', ...). So we read the seed the token's
   own artifact declares and run the same byte-identical code with it, which is
   what that artifact produces when it executes. */
function openModal(row) {
  var id = String(row.key), ed = +row.value.iteration_number;
  var meta = METAS[id] || {};
  var artifactSeed = seedFromArtifact(meta.artifactUri);

  var back = document.createElement('div');
  back.className = 'fixed inset-0 z-50 overflow-y-auto bg-black/90 p-6';
  back.setAttribute('role', 'dialog');
  back.setAttribute('aria-modal', 'true');
  back.setAttribute('aria-label', 'essentialism #' + ed + ' details');

  var box = document.createElement('div');
  box.className = 'mx-auto my-8 max-w-screen-md rounded-xl bg-zinc-800 p-6 text-neutral-400';
  box.addEventListener('click', function (e) { e.stopPropagation(); });

  var h = document.createElement('div');
  h.className = 'flex items-start justify-between gap-4';
  h.innerHTML = '<h3 class="text-white text-xl font-bold">essentialism #' + ed + '</h3>';
  var x = document.createElement('button');
  x.type = 'button'; x.textContent = 'close';
  x.className = 'rounded-lg bg-black px-3 py-1 font-mono text-xs text-neutral-400 transition-opacity hover:opacity-80';
  x.addEventListener('click', close);
  h.appendChild(x); box.appendChild(h);

  var img = document.createElement('img');
  img.src = THUMB + id; img.alt = 'essentialism #' + ed;
  img.className = 'mt-4 block w-full max-w-sm h-auto rounded-lg bg-black';
  box.appendChild(img);

  var tl = document.createElement('p');
  tl.className = 'mt-4 font-mono text-xs text-neutral-400 break-words';
  if (artifactSeed !== null) {
    tl.textContent = traitsOf(render(artifactSeed, ed));
  } else if (meta.artifactUri) {
    tl.textContent = 'This token was regenerated, and its stored artifact records the seed as raw bytes rather than a number, so its trait line cannot be computed from chain data. Reported as bootloader-monorepo#30.';
  } else {
    tl.textContent = 'Loading token metadata from the chain…';
  }
  box.appendChild(tl);

  var rows = [
    ['token', id],
    ['edition', ed + ' of ' + EDITIONS],
    ['memory', memoryPct(ed) + '%'],
    ['on-chain seed', row.value.seed],
    ['generator version', row.value.generator_version]
  ];
  var dl = document.createElement('dl');
  dl.className = 'mt-4 grid grid-cols-1 gap-1 font-mono text-xs sm:grid-cols-[10rem_1fr]';
  rows.forEach(function (r) {
    var dt = document.createElement('dt'); dt.className = 'text-neutral-500'; dt.textContent = r[0];
    var dd = document.createElement('dd'); dd.className = 'break-all text-neutral-400'; dd.textContent = r[1];
    dl.appendChild(dt); dl.appendChild(dd);
  });
  box.appendChild(dl);

  var links = document.createElement('p');
  links.className = 'mt-5 font-mono text-xs text-neutral-500';
  links.innerHTML =
    '<a class="hover:text-white transition-colors" target="_blank" rel="noopener" href="' + TOKEN + id + '">view on bootloader &#8599;</a>' +
    ' &nbsp;·&nbsp; ' +
    '<a class="hover:text-white transition-colors" target="_blank" rel="noopener" href="https://better-call.dev/mainnet/KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt/tokens">token storage &#8599;</a>';
  box.appendChild(links);

  var note = document.createElement('p');
  note.className = 'mt-4 text-xs leading-relaxed';
  note.textContent = 'The trait line is not stored as text on chain. Every token builds it while it runs, from the code and the seed. This reads the seed your token declares and runs the same code with it.';
  box.appendChild(note);

  back.appendChild(box);
  back.addEventListener('click', close);
  document.addEventListener('keydown', esc);
  document.body.appendChild(back);

  function close() { back.remove(); document.removeEventListener('keydown', esc); }
  function esc(e) { if (e.key === 'Escape') close(); }
}

function render(seed, iter) {
  var el = document.createElementNS(NS, 'svg');
  var sm = splitmix64(seed), a = sm(), b = sm(), c = sm(), d = sm();
  window.ESSENTIALISM({ rnd: sfc32(a, b, c, d), seed: seed, iterationNumber: iter, isPreview: false, svg: el });
  var desc = el.querySelector('desc');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', desc ? desc.textContent : 'essentialism output');
  el.setAttribute('class', 'block w-full h-auto rounded-lg');
  return el;
}
function traitsOf(el) { var d = el.querySelector('desc'); return d ? d.textContent : ''; }
function hex(s) { return '0x' + s.toString(16).padStart(16, '0'); }
function randSeed() { var s = 0n; for (var i = 0; i < 4; i++) s = s << 16n | BigInt(Math.random() * 65536 | 0); return s; }
function memoryPct(ed) { return Math.round(Math.max(0.12, 1 - 0.88 * (Math.min(ed, EDITIONS) - 1) / (EDITIONS - 1)) * 100); }

/* rasterise the live SVG at any scale, client-side */
function exportPNG(svgEl, scale, name) {
  var clone = svgEl.cloneNode(true);
  clone.setAttribute('width', W); clone.setAttribute('height', H);
  clone.setAttribute('xmlns', NS);
  var str = new XMLSerializer().serializeToString(clone);
  var img = new Image();
  img.onload = function () {
    var c = document.createElement('canvas');
    c.width = W * scale; c.height = H * scale;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    c.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '-' + c.width + 'x' + c.height + '.png';
      a.click(); URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.onerror = function () { alert('Export failed in this browser. The SVG download always works.'); };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
}

document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };

  /* the space - twelve seeds across the run */
  var gal = $('gallery');
  if (gal) {
    var picks = [[7211n, 1], [90210n, 3], [4242n, 8], [1007922n, 12],
                 [55123n, 17], [88881n, 22], [31337n, 26], [60221n, 31],
                 [12345n, 35], [777001n, 39], [5084434n, 42], [98765n, 44]];
    var frag = document.createDocumentFragment();
    picks.forEach(function (p) {
      var fig = document.createElement('figure'); fig.className = 'm-0';
      var el = render(p[0], p[1]);
      fig.appendChild(el);
      var cap = document.createElement('figcaption');
      cap.className = 'mt-2 font-mono text-xs text-neutral-500';
      cap.textContent = 'ed. ' + p[1] + ' · ' + traitsOf(el).split(' · ').slice(1, 3).join(' · ');
      fig.appendChild(cap);
      frag.appendChild(fig);
    });
    gal.appendChild(frag);
  }

  /* minted editions - bootloader's own renders, pulled from chain */
  var mints = $('mints');
  if (mints) {
    fetch(TZKT).then(function (r) { return r.json(); }).then(function (rows) {
      rows.sort(function (a, b) { return (+a.value.iteration_number) - (+b.value.iteration_number); });
      var status = $('mints-status');
      if (status) status.textContent = rows.length + ' of ' + EDITIONS + ' minted';
      var frag = document.createDocumentFragment();
      rows.forEach(function (row) {
        var ed = +row.value.iteration_number;
        var a = document.createElement('a');
        a.href = 'https://bootloader.art/token/svg-js/' + row.key;
        a.target = '_blank'; a.rel = 'noopener';
        a.className = 'block transition-opacity hover:opacity-80';
        var img = document.createElement('img');
        img.src = THUMB + row.key;
        img.alt = 'essentialism #' + ed;
        img.loading = 'lazy'; img.decoding = 'async';
        img.className = 'block w-full h-auto rounded-lg bg-black';
        a.appendChild(img);
        var cap = document.createElement('div');
        cap.className = 'mt-2 font-mono text-xs text-neutral-500';
        cap.textContent = '#' + ed + ' · memory ' + memoryPct(ed) + '%';
        a.appendChild(cap);
        a.addEventListener('click', function (ev) { ev.preventDefault(); openModal(row); });
        frag.appendChild(a);
      });
      mints.appendChild(frag);
      var ids = rows.map(function (r) { return r.key; }).join(',');
      fetch(META + ids).then(function (r) { return r.json(); }).then(function (metas) {
        metas.forEach(function (m) { METAS[String(m.tokenId)] = m.metadata || {}; });
      }).catch(function () {});
    }).catch(function () {
      var status = $('mints-status');
      if (status) status.textContent = 'Could not reach the chain indexer. See the collection on bootloader.';
    });
  }

  /* playground */
  var stage = $('stage');
  if (!stage) return;
  var seedIn = $('seed'), edIn = $('ed'), edOut = $('ed-out'), traits = $('traits'), memOut = $('mem-out');
  var cur = 1007922n;

  function draw(seed) {
    cur = seed;
    var iter = parseInt(edIn.value, 10) || 1;
    var el = render(seed, iter);
    stage.replaceChildren(el);
    seedIn.value = hex(seed);
    edOut.textContent = iter;
    if (memOut) memOut.textContent = memoryPct(iter) + '%';
    traits.textContent = traitsOf(el);
  }

  $('shuffle').addEventListener('click', function () { draw(randSeed()); });
  edIn.addEventListener('input', function () { draw(cur); });
  seedIn.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    try { draw(BigInt.asUintN(64, BigInt(seedIn.value.trim()))); }
    catch (err) { seedIn.value = hex(cur); }
  });
  $('dl-svg').addEventListener('click', function () {
    var el = stage.querySelector('svg'); if (!el) return;
    var blob = new Blob([new XMLSerializer().serializeToString(el)], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'essentialism-' + hex(cur) + '-ed' + edIn.value + '.svg';
    a.click(); URL.revokeObjectURL(a.href);
  });
  $('dl-png').addEventListener('click', function () {
    var el = stage.querySelector('svg'); if (!el) return;
    var scale = parseInt($('png-scale').value, 10) || 2;
    exportPNG(el, scale, 'essentialism-' + hex(cur) + '-ed' + edIn.value);
  });

  draw(cur);

  /* The code shown below is read from the contract, not from this server, and
     then checked against the source of the function this page actually ran. */
  var code = $('code'), codeStatus = $('code-status');
  if (code) {
    fetch(GENERATOR)
      .then(function (r) { return r.json(); })
      .then(function (row) {
        var hex = row.value.code, s = '';
        for (var i = 0; i < hex.length; i += 2) s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        var onchain = decodeURIComponent(s);
        code.textContent = onchain;

        // the running function's own source, minus the wrapper
        var running = window.ESSENTIALISM.toString();
        var body = running.slice(running.indexOf('{') + 1, running.lastIndexOf('}'));
        var norm = function (x) { return x.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, ''); };
        var match = norm(body) === norm(onchain);

        if (codeStatus) {
          codeStatus.textContent = match
            ? 'Verified: generator v' + row.value.version + ' on Tezos, and the code this page just ran, are identical.'
            : 'Mismatch: the code this page ran differs from generator v' + row.value.version + ' on Tezos. Trust the chain, not this page.';
          codeStatus.className = 'mt-3 font-mono text-xs ' + (match ? 'text-neutral-500' : 'text-red-400');
        }
      })
      .catch(function () {
        code.textContent = 'Could not reach the chain indexer. The generator is readable on Tezos at KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt.';
        if (codeStatus) codeStatus.textContent = '';
      });
  }
});
