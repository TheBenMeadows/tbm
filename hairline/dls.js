/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Dls: a ballot box with a slot in its lid and a small window in its front,
 * and one ballot held upright just above the slot, a paw print on its face
 * drawn in hairline: one pad and four small toe ovals. At rest the held
 * ballot's edge is bright and the window shows an empty box. Pointing at the
 * box casts the vote: the held ballot drops through the slot, then three more
 * come down from above and follow it one by one; each lands in the pile the
 * window shows, the count rises, and the box takes the bright edge. Leaving
 * brings them back out the slot, the last in first, and up out of sight,
 * until one ballot is held over the slot again. The slider is the stagger.
 *
 * The pattern: discrete items, as Badges. One 700ms tween per ballot along a
 * descend and drop path; the stagger is the ballot's turn in the queue. A
 * ballot below the lid is cut at the lid's plane, so it goes into the slot
 * without the box drawn over it. The hit test is the outline of the REST box
 * and the held ballot, read once.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, poly, prism, proj, ringAt, rings, rrect,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const BX = [-22, -15, 22, 15], BH = 32, LT = 2.4, LZ = BH, LO = 1.8, SX = 0, SY = 0;
const W = 20, D = 26, T = 1, N = 4, HOLD = 0.35;
const ZH = LZ + LT + D / 2 + 1.2, ZT = ZH + 12, ZE = LZ - D / 2 - 1;
// the paw, in the ballot's plane (u across, v up): one pad, four toes, as light outlines
const PAD = circ(1, 28).map((q) => [q.u * 4.2, -2.2 + q.v * (q.v > 0 ? 2.6 : 3.2)]);
const TOES = [[-5, 2.4], [-1.8, 5.2], [1.8, 5.2], [5, 2.4]].map(([u, v]) => circ(1, 14).map((q) => [u + q.u * 1.25, v + q.v * 1.5]));
// the window in the front face, and how each cast ballot lies in the pile behind it: [left, right, tilt]
const WIN = [-11, 4, 11, 17], PILE = [[-9.5, 8.5, 0.6], [-8.5, 9.5, -0.5], [-9.5, 9, 0.4], [-8.8, 9.6, -0.3]];

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
/** A ballot's centre height at progress s: down from above to the hold, then through the slot. */
const zAt = (s) => (s < HOLD ? lerp(ZT, ZH, ss(s / HOLD)) : lerp(ZH, ZE, ss((s - HOLD) / (1 - HOLD))));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 3.0);
  const pts = [[BX[0], BX[1], 0], [BX[2], BX[3], 0], [BX[2], BX[1], 0], [BX[0], BX[3], 0], [SX - W / 2, SY, ZT + D / 2], [SX + W / 2, SY, ZT + D / 2]];
  fit(C, pts, 200, 160);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // The box: a body, a lid a little proud of it, the slot, and the window with the pile behind it.
  const boxG = mk("g", {}, g), body = solid(boxG), lid = solid(boxG);
  put(body, prism(P, front, ...rings(...BX, 3, 1.2), 0, LZ));
  put(lid, prism(P, front, ...rings(BX[0] - LO, BX[1] - LO, BX[2] + LO, BX[3] + LO, 3.6, 1.2), LZ, LZ + LT));
  const slot = mk("path", { d: poly(ringAt(P, rrect(SX - 12, SY - 1.6, SX + 12, SY + 1.6, 1.6, 4), LZ + LT)), class: "nf" }, boxG);
  const onFront = (u, z) => P(u, BX[3], z);
  mk("path", { d: poly(rrect(...WIN, 2, 4).map((q) => onFront(q.u, q.v))), class: "nf" }, boxG);
  const pile = mk("path", { class: "nf lo" }, boxG);

  // A ballot is a thin plate standing in the plane y = SY, facing the viewer, centre at height z.
  const face = rrect(-W / 2, -D / 2, W / 2, D / 2, 1.8, 4), inner = rrect(-W / 2 + 1.1, -D / 2 + 1.1, W / 2 - 1.1, D / 2 - 1.1, 0.8, 4);
  const cut = LZ + LT;
  const Q = (z, u, v, w) => P(SX + u, SY + w, Math.max(z + v, cut));
  const ballots = Array.from({ length: N }, (_, k) => {
    const el = solid(g), paw = mk("path", { class: "nf lo" }, el.g), home = k ? 0 : HOLD;
    return { k, el, paw, home, s: tween(home), drawn: NaN };
  });
  let act = false, piled = -1;

  // Hit area: the outline of the rest box and the held ballot, read once and never moved.
  const restHull = hull(ringAt(P, rrect(...BX, 3, 2), 0).concat(ringAt(P, rrect(...BX, 3, 2), LZ + LT), face.map((q) => Q(ZH, q.u, q.v, 0))));
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }

  function draw(now) {
    let moving = false, cast = 0;
    for (const b of ballots) {
      const s = tval(b.s, now);
      if (!tdone(b.s, now)) moving = true;
      if (s > 0.97) cast++;
      if (s === b.drawn) continue;
      b.drawn = s;
      // not yet in the queue, or already in the box: nothing to draw
      if (s < 0.004 || s > 0.995) { b.el.sil.setAttribute("d", ""); b.el.cr.setAttribute("d", ""); b.paw.setAttribute("d", ""); continue; }
      const z = zAt(s);
      put(b.el, { sil: poly(hull(face.map((q) => Q(z, q.u, q.v, T / 2)).concat(face.map((q) => Q(z, q.u, q.v, -T / 2))))), crease: poly(inner.map((q) => Q(z, q.u, q.v, T / 2))) });
      const shown = [PAD, ...TOES].filter((sh) => sh.every(([u, v]) => z + v > cut + 0.3));
      b.paw.setAttribute("d", shown.map((sh) => poly(sh.map(([u, v]) => Q(z, u, v, T / 2)))).join(" "));
    }
    // The pile behind the window: one thin slab per ballot cast, bottom up.
    if (cast !== piled) {
      piled = cast;
      pile.setAttribute("d", PILE.slice(0, cast).map(([l, r, tl], j) => {
        const z = WIN[1] + 1.2 + j * 2.4;
        return poly([[l, z + tl], [r, z - tl], [r, z - tl + 1.1], [l, z + tl + 1.1]].map(([u, zz]) => onFront(u, zz)));
      }).join(" "));
    }
    // Paint order: the box, then the ballots, the latest in the queue last.
    // One highlight: the held ballot's edge at rest; the box once voting starts.
    ballots[0].el.sil.classList.toggle("hi", !act);
    for (const el of [body.sil, lid.sil, slot]) el.classList.toggle("hi", act);
    read.textContent = act ? `${cast} vote${cast === 1 ? "" : "s"}` : "rest";
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now)); bag.add(L.unregister);

  /** Casts the queue one by one, the held ballot first (false brings them back, the last in first). */
  function setActive(on) {
    if (on === act) return;
    const now = performance.now();
    act = on;
    ballots.forEach((b) => tset(b.s, on ? 1 : b.home, now, on ? 60 + b.k * stag : (N - 1 - b.k) * stag * 0.5));
    L.wake();
  }

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "dls",
  means: "A ballot box with a paw-printed ballot held over the slot: point at it and four ballots go in one by one.",
  rules: [1, 2, 5, 6, 10],
  range: [300, 400, 500],
  mount,
});
