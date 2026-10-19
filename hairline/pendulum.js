/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Pendulum: a Y-string pendulum harmonograph on the desk. A bob with a pen in
 * its tip hangs from a gantry by a Y of string over a plate, and the pen's
 * trace on the plate is the one bright stroke. Across the bar the whole Y
 * swings; along it only the string below the knot does, so where the knot sits
 * is the frequency ratio. The pointer's x picks a ratio: the knot slides to
 * its height and the pen draws the damped figure afresh, on the 700ms curve,
 * settling inwards to the centre. The read-out names the ratio, `3:2`; at rest
 * the plate already holds a 3:2 figure. The slider is the damping per swing.
 *
 * The pattern: one of many, with the many laid out along x as static bands
 * read from the rest outline, so nothing that moves can change the choice.
 */
const {
  Cam, clamp, facing, fit, hull, open, prism, proj, rings, rrect, seg, ringAt,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// The ratios, fast swing : slow swing, left to right. REST is the one on the plate at rest.
const RATIOS = [[1, 1], [4, 3], [3, 2], [2, 1], [3, 1]], REST = 2;
const CX = 50, CY = 50, PZ = 8, BOB = 8, BZ0 = 14, BZ1 = 23, BAR = 100, A = 38, KNOT = 22;
const L = BAR - BZ1, TURNS = 3, PHASE = Math.PI / 2, DETUNE = 0.003;

/** The knot's height for ratio p:q. A swing's rate goes as 1/√length, so the lower string is L·q²/p² long. */
const knotZ = ([p, q]) => BZ1 + (L * q * q) / (p * p);

/** The pen's path for ratio p:q, damped by d per slow swing: world points on the plate, from the first swing to the settled centre. */
function figure([p, q], d) {
  const n = TURNS * 34 * p, out = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TURNS * 2 * Math.PI, e = A * Math.exp((-d * t) / (2 * Math.PI));
    out.push([CX + e * Math.sin(p * t + PHASE), CY + e * Math.sin(q * (1 + DETUNE) * t)]);
  }
  return out;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let damp = value;

  const C = Cam(45, 0.5, 1.62);
  const base = rings(-16, 2, 116, 98, 6, 1.6);
  const plate = rings(6, 6, 94, 94, 3, 1.2);
  const post = (x) => rings(x - 3.2, CY - 3.2, x + 3.2, CY + 3.2, 3.2, 0.8);
  const posts = [post(-10), post(110)];
  const bar = rings(-14, CY - 3.4, 114, CY + 3.4, 3.4, 0.9);

  const pts = [];
  for (const [r, z0, z1] of [[base[0], 0, 6], [plate[0], 6, PZ], [bar[0], BAR, BAR + 6]]) r.forEach((s) => pts.push([s.u, s.v, z0], [s.u, s.v, z1]));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);

  // Paint order, far to near: base, far post, plate, trace, pen, bob, strings, near post, bar.
  const g = mk("g", {}, svg);
  const baseEl = solid(g), farPost = solid(g), plateEl = solid(g);
  const trace = mk("path", { class: "nf hi" }, g);
  const pen = mk("path", { class: "nf sil" }, g);
  const bob = solid(g);
  const strings = mk("path", { class: "nf" }, g);
  const nearPost = solid(g), barEl = solid(g);
  put(baseEl, prism(P, front, base[0], base[1], 0, 6));
  put(farPost, prism(P, front, posts[0][0], posts[0][1], 6, BAR));
  put(plateEl, prism(P, front, plate[0], plate[1], 6, PZ));
  put(nearPost, prism(P, front, posts[1][0], posts[1][1], 6, BAR));
  put(barEl, prism(P, front, bar[0], bar[1], BAR, BAR + 6));

  // Every ratio's figure, worked out once per damping: world points and their screen points on the plate.
  let figs = [];
  const build = () => { figs = RATIOS.map((r) => { const w = figure(r, damp); return { w, s: w.map(([x, y]) => P(x, y, PZ)) }; }); };
  build();

  let cur = REST, prog = tween(1), knot = tween(knotZ(RATIOS[REST])), drawn = "";

  /** The pen at its head, the bob over it, and the Y: across the bar the whole Y leans with the bob, along it only the lower string does. */
  function hang([hx, hy], kz) {
    const lean = (BAR - kz) / L, kx = CX, ky = CY + (hy - CY) * lean;
    pen.setAttribute("d", seg(P(hx, hy, PZ), P(hx, hy, BZ0)));
    const r0 = rrect(hx - BOB, hy - BOB, hx + BOB, hy + BOB, BOB, 14);
    const r1 = rrect(hx - BOB + 1.4, hy - BOB + 1.4, hx + BOB - 1.4, hy + BOB - 1.4, BOB - 1.4, 14);
    put(bob, prism(P, front, r0, r1, BZ0, BZ1));
    const k = P(kx, ky, kz), lower = seg(k, P(hx, hy, BZ1));
    strings.setAttribute("d", kz < BAR - 0.5 ? `${lower}${seg(P(CX - KNOT, CY, BAR), k)}${seg(P(CX + KNOT, CY, BAR), k)}` : lower);
  }

  function draw(now) {
    const pr = clamp(tval(prog, now), 0, 1), kz = tval(knot, now), f = figs[cur];
    // The pen runs on the cube of the 700ms curve: the curve's fast start would otherwise lay down every big swing in its first tenth.
    const i = Math.max(1, Math.round(pr ** 3 * (f.w.length - 1))), key = `${cur}|${i}|${kz.toFixed(2)}`;
    if (key !== drawn) {
      drawn = key;
      trace.setAttribute("d", open(f.s.slice(0, i + 1)));
      hang(f.w[i], kz);
    }
    return !tdone(prog, now) || !tdone(knot, now);
  }

  const Lp = register(stage, (_dt, now) => draw(now));
  bag.add(Lp.unregister);

  // Hit bands, read once from the rest outline and never moved: inside it, the pointer's x picks the ratio.
  const outline = hull([base, plate, bar, ...posts].flatMap(([r]) => ringAt(P, r, 0).concat(ringAt(P, r, BAR + 6))));
  const xs = outline.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
  /** Whether a screen point is inside the rest outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
      const [xa, ya] = outline[a], [xb, yb] = outline[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }
  const hit = (pt) => (inside(pt) ? clamp(Math.floor(((pt[0] - x0) / (x1 - x0)) * RATIOS.length), 0, RATIOS.length - 1) : -1);

  let act = -1;
  /** Picks ratio a (-1 for rest): the knot slides to its height and the pen draws the new figure from its first swing. */
  function setActive(a) {
    if (a === act) return;
    act = a;
    const now = performance.now();
    cur = a < 0 ? REST : a;
    prog = tween(0);
    tset(prog, 1, now, 0);
    tset(knot, knotZ(RATIOS[cur]), now, 0);
    read.textContent = a < 0 ? "rest" : RATIOS[a].join(":");
    Lp.wake();
  }

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(hit(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { damp = v; build(); drawn = ""; draw(performance.now()); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "pendulum",
  means: "A Y-string pendulum over a plate: the pointer picks the swing ratio, the knot slides to it, and the pen draws the damped figure.",
  rules: [1, 4, 5, 7],
  range: [0.08, 0.18, 0.32],
  mount,
});
