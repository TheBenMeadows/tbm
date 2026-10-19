/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Emoji: an open laptop on the desk, set on the iso axes with its screen
 * facing +x: a thin base with a trackpad in its front half, and a lid hinged
 * a little in from the back edge, leaning back 15°, with a screen inset. On
 * the screen, one chat bubble with a tail at its lower left holds two lines
 * of text as flat bars; after the short second bar sits the blank box a
 * browser draws for a glyph it cannot show, hollow, the height of a line, and
 * it is the bright mark at rest. Pointing at the laptop pops a round face up
 * in the box's place, a flat disc the box's height with two smiling caps for
 * eyes and a mouth arc, while the box shrinks away under it. The pop
 * overshoots once, then the face gives one small hop and holds still; it
 * never turns or follows the pointer.
 * Leaving shrinks it back to nothing and the box is bright again. The slider
 * is the pop's overshoot, in percent.
 *
 * The pattern: one object, on or off. One spring for the pop, its damping
 * taken from the overshoot, and a lighter one for the hop, which starts as the
 * pop turns back from its overshoot. The hit test is the laptop's rest
 * outline, read once. Only the face and the box move, both on the bubble, so
 * the paint order is fixed: base, lid, bubble, box, face.
 */
const {
  Cam, circ, clamp, fillet, fit, hull, open, poly, prism, proj, rad, ringAt, rrect,
  spring, stepS, disposer, mk, pointer, put, register, solid,
} = HL;

const FACE = 0, LEAN = 15; // the laptop sits on the iso axes, its screen facing +x, like the set's other objects; the lid leans back from upright
const BW = 60, BD = 78, BT = 3.6, BR = 6; // base: half width, depth, thickness, corner radius
const SH = 80, ST = 2.2, SR = 6, HV = 6, LW = BW - 2; // lid: height, thickness, corner radius, hinge set in from the base's back edge, half width
const BX0 = -46, BX1 = 44, BY0 = 14, BY1 = 68, BP = 2; // the bubble on the screen, and its height above it
const LH = 19, BAR = 7, PX = 8, PY = 6, L1 = 74, L2 = 38; // a line's height, a bar's thickness, padding, the two bars
const BXW = 11, BXH = 15, BXG = 5; // the blank box: width, height, gap after the short bar
const R = BXH / 2, FT = 0.8, EX = 2.6, EY = 1.6, ER = 1.6, MY = 0.9, MR = 4.3; // the face: radius, height above the bubble, eyes, smile
const HOP = 3.5; // how high the face hops after it lands
const V1 = BY1 - PY - LH / 2, V2 = BY0 + PY + LH / 2, X0 = BX0 + PX; // the two lines' middles, where they start
const CU = X0 + L2 + BXG + BXW / 2; // the box's middle on line 2

/** The damping that gives a spring of k 100, m 1 the overshoot pct, in percent. */
const damp = (pct) => { const l = Math.log(pct / 100); return (20 * -l) / Math.hypot(Math.PI, l); };
/** A world point (u, v, w) along three axes from o. */
const at3 = (o, a, b, c) => (u, v, w) => [0, 1, 2].map((i) => o[i] + u * a[i] + v * b[i] + w * c[i]);

/** Whether a screen point is inside a closed outline. */
function inside(ring, [x, y]) {
  let ok = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [xa, ya] = ring[a], [xb, yb] = ring[b];
    if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
  }
  return ok;
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  const A = [Math.sin(rad(FACE)), -Math.cos(rad(FACE)), 0], N = [Math.cos(rad(FACE)), Math.sin(rad(FACE)), 0], Z = [0, 0, 1];
  const cl = Math.cos(rad(LEAN)), sl = Math.sin(rad(LEAN));
  const U = Z.map((z, i) => z * cl - N[i] * sl), F = N.map((n, i) => n * cl + Z[i] * sl); // up the lid, out of the screen
  const hinge = [N[0] * HV, N[1] * HV, BT], baseAt = at3([0, 0, 0], A, N, Z), lidAt = at3(hinge, A, U, F);

  const C = Cam(45, 0.5, 1.8), pts = [];
  for (const u of [-BW, BW]) for (const v of [0, BD]) pts.push(baseAt(u, v, 0));
  for (const u of [-LW, LW]) for (const w of [-ST, 0]) pts.push(lidAt(u, SH, w));
  fit(C, pts, 200, 166);
  const P = proj(C);

  // Toward the camera: the direction the projection flattens to a point, taken pointing up.
  const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((d) => { const p = P(...d), o = P(0, 0, 0); return [p[0] - o[0], p[1] - o[1]]; });
  const r1 = e.map((p) => p[0]), r2 = e.map((p) => p[1]);
  let V = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  if (V[2] < 0) V = V.map((x) => -x);
  /** A space on three axes: P for rings drawn in its (u, v) plane at depth w, and front, whether a ring sample's edge faces the camera. */
  const space = (o, a, b, c) => {
    const w = at3(o, a, b, c), n = at3([0, 0, 0], a, b, c);
    return { P: (u, v, z) => P(...w(u, v, z)), front: (q) => n(q.nu, q.nv, 0).reduce((s, x, i) => s + x * V[i], 0) > 0 };
  };
  const flat = (S, ring, w) => poly(ring.map((q) => S.P(q.u, q.v, w)));

  const g = mk("g", {}, svg);
  // The base, lying flat, with one trackpad in its front half.
  const B = space([0, 0, 0], A, N, Z), base = rrect(-BW, 0, BW, BD, BR, 6);
  put(solid(g), prism(B.P, B.front, base, rrect(-BW + 1.2, 1.2, BW - 1.2, BD - 1.2, BR - 1.2, 6), 0, BT));
  mk("path", { d: flat(B, rrect(-13, 46, 13, 66, 2.5, 4), BT), class: "nf lo" }, g);

  // The lid, hinged a little in from the base's back edge and leaning back: one outline, and its screen.
  const L = space(hinge, A, U, F), lid = rrect(-LW, 0, LW, SH, SR, 6);
  put(solid(g), { sil: prism(L.P, L.front, lid, rrect(-LW + 1.2, 1.2, LW - 1.2, SH - 1.2, SR - 1.2, 6), -ST, 0).sil, crease: "" });
  mk("path", { d: flat(L, rrect(-51, 7, 51, SH - 6, 3, 4), 0), class: "nf" }, g);

  // The bubble: one outline standing a little off the screen, with the two lines of text on it as bars.
  const bub = fillet([[BX0 - 4, BY0 - 6], [BX0 + 10, BY0], [BX1, BY0], [BX1, BY1], [BX0, BY1], [BX0, BY0 + 5]], [1.2, 4, 7, 7, 7, 4]);
  mk("path", { d: poly(bub.map(([u, v]) => L.P(u, v, BP))) }, g);
  const bar = (v, len) => flat(L, rrect(X0, v - BAR / 2, X0 + len, v + BAR / 2, BAR / 2, 4), BP);
  mk("path", { d: bar(V1, L1) + bar(V2, L2), class: "nf" }, g);

  // The blank box, and the face that takes its place.
  const box = mk("path", { class: "nf hi" }, g);
  const face = solid(g), eyes = mk("path", { class: "nf" }, face.g), mouth = mk("path", { class: "nf" }, face.g);
  const disc = circ(R, 64);
  let pop = spring(0, { c: damp(value), eps: 0.002 }), on = false, kicked = false, last = 0, ds = NaN, dh = NaN;
  const hop = spring(0);

  function draw() {
    const s = Math.max(0, pop.x), h = hop.x;
    if (s === ds && h === dh) return;
    ds = s; dh = h;
    // The box shrinks into its middle as the face grows out of it.
    const b = 1 - clamp(s, 0, 1), bw = (b * BXW) / 2, bh = (b * BXH) / 2;
    box.setAttribute("d", b < 0.02 ? "" : flat(L, rrect(CU - bw, V2 - bh, CU + bw, V2 + bh, 1.2 * b, 4), BP));
    if (s < 0.01) { put(face, { sil: "", crease: "" }); eyes.setAttribute("d", ""); mouth.setAttribute("d", ""); return; }
    const sc = (v) => v.map((x) => x * s);
    // The face is a flat disc the height of the box, drawn as one circle; its eyes are two small caps, smiling, and its mouth an arc.
    const D = space(lidAt(CU, V2 + h, BP), sc(A), sc(U), sc(F));
    put(face, { sil: poly(disc.map((q) => D.P(q.u, q.v, FT))), crease: "" });
    const cap = (du) => { const a = []; for (let k = 0; k <= 8; k++) { const t = rad(-55 + 13.75 * k); a.push(D.P(du + ER * Math.sin(t), EY + ER * Math.cos(t), FT)); } return open(a); };
    eyes.setAttribute("d", cap(-EX) + cap(EX));
    const arc = [];
    for (let k = 0; k <= 12; k++) { const t = rad(-60 + 10 * k); arc.push(D.P(MR * Math.sin(t), MY - MR * Math.cos(t), FT)); }
    mouth.setAttribute("d", open(arc));
  }

  const loop = register(stage, (dt) => {
    const a = stepS(pop, dt);
    // The hop starts once, as the pop turns back from its overshoot, and drops back from near its top.
    if (on && !kicked && pop.x > 1 && pop.x < last) { kicked = true; hop.t = HOP; }
    last = pop.x;
    if (hop.t > 0 && hop.x > HOP * 0.85) hop.t = 0;
    const b = stepS(hop, dt);
    draw();
    return a || b;
  });
  bag.add(loop.unregister);

  // Hit area: the laptop's rest outline, read once. Where the pointer is inside it only says on or off.
  const outline = hull([...ringAt(B.P, base, 0), ...ringAt(B.P, base, BT), ...ringAt(L.P, lid, -ST), ...ringAt(L.P, lid, 0)]);
  function aim(pt) {
    const now = pt !== null && inside(outline, pt);
    if (now === on) return;
    on = now; kicked = false;
    pop.t = on ? 1 : 0; hop.t = 0;
    box.classList.toggle("hi", !on);
    for (const el of [face.sil, eyes, mouth]) el.classList.toggle("hi", on);
    read.textContent = on ? "emoji on" : "rest";
    loop.wake();
  }

  read.textContent = "rest";
  draw();
  bag.add(pointer(stage, { move: (pt) => aim(pt), leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { const t = pop.t; pop = spring(pop.x, { c: damp(v), eps: 0.002 }); pop.t = t; loop.wake(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "emoji",
  means: "A chat on a laptop with a blank box where an emoji should be: point at it and the emoji appears, as Emoji Fix makes Brave show them.",
  rules: [1, 4, 5, 9, 10],
  range: [8, 15, 22],
  mount,
});
