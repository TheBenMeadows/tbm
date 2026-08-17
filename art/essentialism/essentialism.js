// The generator published on-chain as bootloader svg-js/407, byte-for-byte.
// Body below is identical to the code stored on Tezos; only this wrapper differs.
// Contract: KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt
//
// Everything from the line below to the closing brace is chain bytes, comments
// included, and /art/essentialism compares it against the contract in the browser.
// A house style applied to a comment down there is a mismatch on the live page.
// Edit only by regenerating from the contract, then repin scripts/check-onchain-code.mjs.

window.ESSENTIALISM = function (BTLDR) {
// essentialism
//
// in november 2022 i made a p5.js sketch called "365 days of tbm" by
// working through andy haskell's tutorial "convert images to mosaics
// in p5.js", january 2022. the column-of-dots structure is his. i
// changed what feeds it. this is that sketch, rewritten to run
// entirely on-chain.
//
// it remembers two of my photographs, reduced to the 28x38 grids of
// grey below (TREE, SKY), one character per cell. both are minted on
// ethereum. TREE is "blue tree", 2023; the tree itself was removed by
// a storm that december, so the picture outlived its subject. SKY is
// "natural gradient", 2023, unedited, its full resolution permanent
// on arweave. each edition samples its grid at lower strength than
// the one before: edition 1 is nearly the photograph, edition 44 is
// mostly grain. the memory percentage is written into every token.
// the originals are permanent, unlike the memories.

const { svg, rnd, iterationNumber, isPreview } = BTLDR;

const W = 750, H = 1000, GW = 28, GH = 38;
svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
if (isPreview) svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');

const TREE = '7777777777777777777777777777777777777777777777777777777777777777777788778777777777778877778888767766888888888888888888888886565667888888888888888888887545447677778888888888888887544554566765688888888888787776555336665678888888888888776566433665678988889989999766445423355477899999999999865533433225557689999999999988624245413335669999999999999853312430033557999999999999a8453132201334369a9999999999a84421233421242589a999aaaaaaa7102112354103369aaaaaaaaaaaa500211013333648aaaaaaaaaaaaa520100120234999aaaaaaaaaaaab541100110235a99baaaaabaaabbb8920010000229bbbaaaaabbbbbaabb40100000228abbbbbbbbbbbba7bc421001214389bbbbbbbbbbbbb98b622102227586bbbbbbbcccccc967733213304557bcbbbbbccccca558865643015649ccccccccccccb74696663223a95accccccccccccc95555445453699bcccccccccccccc9643244553689cdcccccccdddddca54443477389addddccccdddddda85323338757a9cbcddddddddddd984114546337b8bbacddddddddecb93113544257a6cb8bddddddddecc8432233336796c88bddddeeeeeeb7513512034877cacdeeeeeeeeeeeb627500035756cdeeeeeeeeeeeeeeadd731269bbceeeeeeeeeeeeeeefffeea65ceeffeeeeeeeeeeeeffffffffe7afffffeeeeeeee';
const SKY = '7777777778888999aaabbccddeff77777777777888999aabbccddeff666666666777788899aabbccdeff6655566666677788899aabbcddff5555555556666778889aaabccdef55555555555666778889aabbcdef444444444555666778899aabcdde4444444444555666778899abbcde4433334444455566778899aabcde3333333444445566677889aabcde3333333344445556677889aabccd33223333344445566778899abbcd22222233334445556677889aabcd222222233334445566778899abcd222222223333444556678899abcd111122222333444556677899abcd111112222233344456677889abbc111111222233334455667889aabc111111122223334455667889aabc1111111122223334455677899abc0001111112223334455677899abc0000011112223334455677899abc0000011111222334455677899abc0000001111222334455667899abc0000000111222334445667889abc0000000111222334445667889abc0000000111122334455667889abc0000000111122334455667899abc0000000111122334455667899abc000000011112233445566789abbd000000011112233445566789abcd000000011122233445567789abcd000000111122333445667899abcd00000111122233445567789aabcd00000111222333445567889abcde00001111222334455667899abcde0000111222333445667789aabcde0001111222334455667889abccdf';

const NS = 'http://www.w3.org/2000/svg';
const R = (a, b) => a + rnd() * (b - a);
const pick = t => { let r = rnd() * t.reduce((s, e) => s + e[1], 0); for (const e of t) { r -= e[1]; if (r <= 0) return e[0]; } return t[0][0]; };
const put = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
const sub = (p, n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };

// value noise. noise(50, 100) finally does what 2022 meant it to.
const G = Array.from({ length: 256 }, () => rnd());
const sm = t => t * t * (3 - 2 * t);
const vn = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), u = sm(x - xi), v = sm(y - yi);
  const g = (i, j) => G[(j & 15) * 16 + (i & 15)];
  return g(xi, yi) * (1 - u) * (1 - v) + g(xi + 1, yi) * u * (1 - v) + g(xi, yi + 1) * (1 - u) * v + g(xi + 1, yi + 1) * u * v;
};
const fbm = (x, y) => vn(x, y) * .65 + vn(x * 2.7 + 11.3, y * 2.7 + 7.1) * .35;

// ink library — on-chain color palette.txt
const LIB = [
  '#dd68a4', // ink 1 — pink from "together"
  '#85dad9', // ink 2 — tiffany blue from "together"
  '#6a93c9', // ink 3 — background blue from "overhead"
  '#36597d', // ink 4 — dark blue from "overhead"
  '#87c2e4', // ink 5 — background from "mr. blue sky"
];
const BONE = '#f3e7d4', CARBON = '#1c161c'; // svg noise workprints
const EMBER = '#e0521b'; // test output 4
const lum = h => parseInt(h.slice(1, 3), 16) * .299 + parseInt(h.slice(3, 5), 16) * .587 + parseInt(h.slice(5, 7), 16) * .114;

const nInks = pick([[2, 56], [3, 30], [4, 10], [1, 4]]);
const density = pick([['air', 50], ['field', 38], ['full', 12]]);
const paper = pick([['#f6ecf2', 28], ['#f0c9d3', 20], ['#f3e7d4', 22], ['#f2f0f6', 12], ['#8cadd7', 10], [CARBON, 8]]);
const night = paper == CARBON;

const deck = [...LIB];
for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
const inks = deck.slice(0, nInks).sort((a, b) => lum(b) - lum(a)); // light to dark

// which photograph this edition remembers, and how much of it is left
const source = rnd() < .13 ? 'natural gradient' : 'blue tree';
const PH = source == 'blue tree' ? TREE : SKY;
const it = Math.max(1, Number(iterationNumber) || 1);
const f = isPreview ? 1 : Math.max(.12, 1 - .88 * (Math.min(it, 44) - 1) / 43);
const px = (i, j) => parseInt(PH[Math.min(GH - 1, Math.max(0, j)) * GW + Math.min(GW - 1, Math.max(0, i))], 16) / 15;
const P = (x, y) => {
  const u = x / W * GW - .5, v = y / H * GH - .5;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  return px(i, j) * (1 - a) * (1 - b) + px(i + 1, j) * a * (1 - b) + px(i, j + 1) * (1 - a) * b + px(i + 1, j + 1) * a * b;
};
// the memory field: photograph fading into weather
const D = (x, y) => (1 - P(x, y)) * f + fbm(x / W * 3.1 + 5.2, y / H * 3.1) * (1 - f) * .85;

put('rect', { x: 0, y: 0, width: W, height: H, fill: paper });

const defs = put('defs', {});
const fl = sub(defs, 'filter', { id: 'l' });
sub(fl, 'feTurbulence', { type: 'fractalNoise', baseFrequency: '.012 .4', numOctaves: 2 });
sub(fl, 'feColorMatrix', { type: 'matrix', values: night ? '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0' : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .05 0' });
const fg = sub(defs, 'filter', { id: 'g' });
sub(fg, 'feTurbulence', { type: 'fractalNoise', baseFrequency: .9, numOctaves: 2 });
sub(fg, 'feColorMatrix', { type: 'matrix', values: night ? '0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .045 0' : '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .055 0' });
const fw = sub(defs, 'filter', { id: 'w', x: '-5%', y: '-5%', width: '110%', height: '110%' });
sub(fw, 'feTurbulence', { type: 'fractalNoise', baseFrequency: .015, numOctaves: 1, result: 'n' });
sub(fw, 'feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: 6, xChannelSelector: 'R', yChannelSelector: 'G' });

put('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#l)' });

const dotRadius = density == 'air' ? R(26, 36) : density == 'field' ? R(11, 16) : R(7, 10);
const columnWidth = dotRadius * 3; // unchanged since nov 2022
const mx = density == 'air' ? 96 : density == 'field' ? 64 : 46;
const mtop = mx * 1.1, mbot = mx * 1.25;
const cols = Math.floor((W - 2 * mx) / columnWidth);
const x0 = (W - cols * columnWidth) / 2;
const span = H - mtop - mbot;

// strands persist where the memory is dark; paper where it is light
const pres = [...Array(cols)].map((_, c) => fbm(c * .37 + 3.7, .5));
const thr = density == 'air' ? .52 : density == 'field' ? .33 : -1;
const inc = pres.map(p => density == 'full' ? rnd() >= .04 : p >= thr);
[...pres.keys()].sort((a, b) => pres[b] - pres[a]).slice(0, density == 'air' ? 2 : 3).forEach(i => inc[i] = true);

const SG = put('g', { filter: 'url(#w)' });
const dots = [];
for (let c = 0; c < cols; c++) {
  if (!inc[c]) continue;
  const offsetX = x0 + c * columnWidth;
  const colDark = D(offsetX + columnWidth / 2, mtop + span * .55);
  let topY = mtop + Math.floor(rnd() * 10);
  if (rnd() < .13) topY += R(.1, .35) * span;
  const maxY = mtop + span * (density == 'full' ? 1 : Math.min(1, .4 + Math.max(pres[c], colDark) * .7));
  let y = topY, prev = null, prevD = 0;
  while (true) {
    const t = (y - mtop) / span;
    const sc = D(offsetX + columnWidth / 2, y);
    const r = dotRadius * (.72 + .56 * fbm(c * .37, t * 3.1)) * (.8 + .5 * sc);
    if (y + 2 * r > maxY) break;
    const centerX = Math.floor(R(offsetX + r, offsetX + columnWidth - r));
    const centerY = y + r;
    const d = D(centerX, centerY);
    // a photograph\'s neighbors resemble each other; so must a memory\'s.
    // runs break where the picture changes its mind.
    let fill;
    if (prev && Math.abs(d - prevD) < .3 && rnd() < .58) fill = prev;
    else {
      const q = rnd();
      fill = d < .1 && q < .7 ? BONE
        : d > .88 && q < .8 ? (night ? BONE : CARBON)
        : inks[Math.max(0, Math.min(nInks - 1, Math.floor((night ? 1 - d : d) * nInks)))];
    }
    sub(SG, 'circle', { cx: centerX, cy: centerY, r: r.toFixed(1), fill, 'fill-opacity': .92 });
    dots.push([centerX, centerY, r]);
    prev = fill; prevD = d;
    y += 2 * r + 3;
  }
}

// one ember, if the run allows it
let ember = false;
if (dots.length && rnd() < .55) {
  const [cx, cy, r] = dots[Math.floor(rnd() * dots.length)];
  sub(SG, 'circle', { cx, cy, r: r.toFixed(1), fill: EMBER, 'fill-opacity': .95 });
  ember = true;
}

put('rect', { x: 0, y: 0, width: W, height: H, filter: 'url(#g)' });

put('desc', {}).textContent = `essentialism · ${density} · ${nInks} ink${nInks > 1 ? 's' : ''} · source: ${source} · memory ${Math.round(f * 100)}%${night ? ' · night' : ''}${ember ? ' · ember' : ''} · ed. ${it}`;
};
