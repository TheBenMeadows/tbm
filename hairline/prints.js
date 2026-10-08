/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Prints: a loose stack of six photo prints, each as thick as its file is
 * heavy. Pointing at the stack thins every print to its squinted weight with
 * its picture untouched, starting at the print under the pointer and spreading
 * outwards on the 700ms curve. The read-out is what the whole stack saved.
 * The slider is the stagger, in ms.
 *
 * The pattern: discrete items. Tweens, a stagger by distance with a clamped
 * reach, and a hit test on static bands read from the REST stack, so a print
 * thinning out from under the pointer cannot change the choice.
 */
const {
  Cam, circ, extremes, facing, fit, hull, open, poly, prism, proj, rad, ringAt, rings, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const W = 104, H = 78, R = 5, B = 2.2;
// bottom to top: rest thickness, share kept once squinted, turn in degrees, offset on the desk
const STACK = [
  { t: 11, keep: 0.34, turn: -5, dx: 0, dy: 2 },
  { t: 7, keep: 0.43, turn: 3, dx: 6, dy: -3 },
  { t: 14, keep: 0.27, turn: -2, dx: -5, dy: 4 },
  { t: 6, keep: 0.52, turn: 6, dx: 7, dy: 1 },
  { t: 10, keep: 0.31, turn: -3.5, dx: -2, dy: -4 },
  { t: 8, keep: 0.38, turn: 1.5, dx: 3, dy: 2 },
];
const N = STACK.length, MIN = 1.6;

/** A ring of samples turned by deg about (cx, cy) and moved by (dx, dy): normals turn with it. */
function turn(ring, deg, cx, cy, dx, dy) {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return ring.map((q) => ({
    u: cx + dx + (q.u - cx) * c - (q.v - cy) * s, v: cy + dy + (q.u - cx) * s + (q.v - cy) * c,
    nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c,
  }));
}

/** The picture on print i's face, in its own flat coordinates: a ridge of hills and a sun, different on each print. */
function picture(i) {
  const ph = i * 0.9, ridge = [];
  for (let k = 0; k <= 16; k++) {
    const u = 9 + k * 5.4, s = (u - 9) / 86;
    ridge.push([u, 54 - 9 * Math.sin(Math.PI * s * 1.6 + ph) ** 2 - 6 * Math.sin(Math.PI * s)]);
  }
  const sun = circ(6.5, 20).map((q) => [q.u + 24 + i * 9, q.v + 21]);
  return { ridge, sun };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.72);
  const prints = STACK.map((p, i) => {
    const [ring0, inner0] = rings(0, 0, W, H, R, B);
    const at = (q) => turn([{ u: q[0], v: q[1], nu: 0, nv: 0 }], p.turn, W / 2, H / 2, p.dx, p.dy)[0];
    return {
      ...p, i,
      ring: turn(ring0, p.turn, W / 2, H / 2, p.dx, p.dy),
      inner: turn(inner0, p.turn, W / 2, H / 2, p.dx, p.dy),
      pic: { ridge: picture(i).ridge.map(at), sun: picture(i).sun.map(at) },
      th: tween(p.t), drawn: NaN,
    };
  });
  const restTop = [];
  prints.reduce((z, p) => (restTop.push(z + p.t), z + p.t), 0);

  // Fitted to the rest stack, its tallest pose: squinting only ever lowers it.
  const pts = [];
  prints.forEach((p, i) => p.ring.forEach((q) => { pts.push([q.u, q.v, 0], [q.u, q.v, restTop[i]]); }));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);

  // Back to front is bottom to top: each print lies on the one below it.
  const g = mk("g", {}, svg);
  for (const p of prints) {
    p.el = solid(g);
    p.ridge = mk("path", { class: "nf lo" }, p.el.g);
    p.sun = mk("path", { class: "nf lo" }, p.el.g);
  }

  // Hit bands, read once from the rest stack and never moved: a print owns the
  // screen rows down to the bottom of its nearest corner at rest.
  const restHull = hull(prints.flatMap((p, i) => ringAt(P, p.ring, 0).concat(ringAt(P, p.ring, restTop[i]))));
  const bandBottom = prints.map((p, i) => {
    const n = extremes(P, p.ring)[2];
    return P(n.u, n.v, restTop[i] - p.t)[1];
  });
  /** Whether a screen point is inside the rest stack's outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }
  /** The print under a screen point: from the top down, the first whose rest band reaches it. */
  function hit(pt) {
    if (!inside(pt)) return -1;
    for (let i = N - 1; i >= 0; i--) if (pt[1] <= bandBottom[i]) return i;
    return 0;
  }

  function draw(now) {
    let z = 0, moving = false, changed = false;
    for (const p of prints) {
      const t = Math.max(MIN, tval(p.th, now));
      if (!tdone(p.th, now)) moving = true;
      if (t !== p.drawn || changed) {
        changed = true;
        p.drawn = t;
        put(p.el, prism(P, front, p.ring, p.inner, z, z + t));
        p.ridge.setAttribute("d", open(p.pic.ridge.map((q) => P(q.u, q.v, z + t))));
        p.sun.setAttribute("d", poly(p.pic.sun.map((q) => P(q.u, q.v, z + t))));
      }
      z += t;
    }
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  let act = -1;
  const saved = Math.round(100 * prints.reduce((s, p) => s + p.t * (1 - p.keep), 0) / prints.reduce((s, p) => s + p.t, 0));
  const caption = (a) => (a < 0 ? "rest" : `stack −${saved}%`);
  /** Squints the whole stack (-1 lets it go back). The stagger spreads out from the print touched, or the one let go. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act;
    const wasRest = act < 0;
    act = a;
    prints.forEach((p, i) => {
      const d = Math.abs(i - (a < 0 ? from : a));
      // Moving between prints only moves the bright edge; the stack is already squinted.
      if (a >= 0 && !wasRest) return p.el.sil.classList.toggle("hi", i === a);
      tset(p.th, a < 0 ? p.t : p.t * p.keep, now, d * stag);
      p.el.sil.classList.toggle("hi", a < 0 ? i === N - 1 : i === a);
    });
    read.textContent = caption(a);
    L.wake();
  }

  prints[N - 1].el.sil.classList.add("hi");
  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(hit(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "prints",
  means: "A stack of photo prints: point at it and every print thins to its squinted weight, the picture untouched.",
  rules: [1, 2, 6, 10],
  range: [0, 45, 90],
  mount,
});
