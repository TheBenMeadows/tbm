/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Prayers: an open prayer book lying on its cover, twenty-two leaves, one for
 * each section: morning prayers, the Hours, and the Psalter's twenty
 * kathismata. Moving the pointer across the book scrubs through it: x picks
 * the section, and every leaf between the old opening and the new one turns
 * over on the 700ms curve, staggered by its distance from where the book was
 * open, so the leaves go over in the order a hand would turn them. The leaves
 * either side of the opening stay fanned up, so the book is never flat. The
 * read-out names the section. The slider is the stagger, in ms.
 *
 * The pattern: scrub and pick. The pointer is read against the REST book's
 * outline and its screen x only, so a leaf turning under the pointer cannot
 * change the choice.
 */
const {
  Cam, clamp, facing, fit, hull, open, poly, prism, proj, put, rad, rings, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, register, solid,
} = HL;

// leaves, leaf width and height, cover thickness, paper per leaf, samples across a leaf
const N = 22, LW = 68, LH = 100, CT = 2.4, TK = 0.75, M = 14;
// the fan either side of the opening (degrees, share by distance), the droop of a leaf in the air, the opening at rest
const FAN = 26, FALL = [1, 0.5, 0.22, 0.08], DROOP = 16, REST_CUT = 12;
const S2 = Math.SQRT1_2, DEG = 1 / rad(1);
// the lines of type on a page: [v, last sample], a short line ends a paragraph
const TEXT = [[12, 12], [19, 12], [26, 12], [33, 7], [42, 12], [49, 12], [56, 12], [63, 9], [72, 12], [79, 12], [86, 5]];
const R = Array.from({ length: M + 1 }, (_, i) => (LW * i) / M);

const name = (s) => (s === 0 ? "morning" : s === 1 ? "the Hours" : `kathisma ${s - 1}`);

/** The book's own axes: u across the spread (screen right), v along the spine (towards the viewer). */
const W = (u, v) => [(v + u) * S2, (v - u) * S2];

/** A leaf lying on a stack h high: each sample's angle above the cover, seen from the spine. It rises out of the gutter, then lies flat. */
function lie(h) {
  const k = 1 - Math.exp(-LW / 9);
  return R.map((r) => Math.atan2((h * (1 - Math.exp(-Math.max(r, 1) / 9))) / k, Math.max(r, 1)) * DEG);
}

/** Leaf k's angle when the book is open at `cut`: turned (near 180) before it, unturned (near 0) from it, fanned near it. */
function target(k, cut) {
  return k < cut ? 180 - FAN * (FALL[cut - 1 - k] ?? 0) : FAN * (FALL[k - cut] ?? 0);
}

/** A leaf turned th degrees over the spine: its cross-section as [u, z], one point per sample. It sags while it is in the air. */
function profile(th, bR, bL) {
  const w = th / 180, d = DROOP * Math.sin(rad(2 * th));
  return R.map((r, i) => {
    const a = rad(bR[i] + w * (180 - bL[i] - bR[i]) - d * (r / LW) ** 2);
    return [r * Math.cos(a), CT + r * Math.sin(a)];
  });
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 2.1);
  const turn = (ring) => ring.map((q) => {
    const [x, y] = W(q.u, q.v);
    return { u: x, v: y, nu: (q.nv + q.nu) * S2, nv: (q.nv - q.nu) * S2 };
  });
  const [c0, c1] = rings(-LW - 4, -4, LW + 4, LH + 4, 5, 2);
  const cover = turn(c0), coverIn = turn(c1);

  // Fitted to a leaf standing straight up, the tallest any pose gets.
  const pts = cover.map((q) => [q.u, q.v, 0]);
  for (const v of [0, LH]) pts.push([...W(0, v), CT + LW]);
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);
  const Q = (u, v, z) => P(...W(u, v), z);

  const g = mk("g", {}, svg);
  put(solid(g), prism(P, front, cover, coverIn, 0, CT));
  const lg = mk("g", {}, g);
  const leaves = Array.from({ length: N }, (_, k) => {
    const el = mk("g", {}, lg);
    return {
      k, el, bR: lie((N - k) * TK), bL: lie((k + 1) * TK), th: tween(target(k, REST_CUT)), drawn: NaN, key: 0,
      face: mk("path", { class: "fo" }, el), text: mk("path", { class: "nf lo" }, el), edge: mk("path", { class: "nf" }, el),
    };
  });

  /** Writes leaf L at th degrees. Its key, how far its middle lies from upright, sets the paint order. */
  function drawLeaf(L, th) {
    const pr = profile(th, L.bR, L.bL);
    const head = pr.map(([u, z]) => Q(u, 0, z)), foot = pr.map(([u, z]) => Q(u, LH, z));
    const ring = head.concat(foot.slice().reverse());
    L.face.setAttribute("d", poly(ring));
    // the open outline, without the spine edge; where the leaf curls past upright, its fold is a silhouette too
    let e = open(ring);
    for (let i = 1; i < M; i++) if ((pr[i][0] - pr[i - 1][0]) * (pr[i + 1][0] - pr[i][0]) < 0) e += seg(head[i], foot[i]);
    L.edge.setAttribute("d", e);
    L.text.setAttribute("d", TEXT.map(([v, end]) => open(pr.slice(3, end + 1).map(([u, z]) => Q(u, v, z)))).join(""));
    const [um, zm] = pr[M >> 1];
    L.key = Math.abs(90 - Math.atan2(zm - CT, um) * DEG);
  }

  // A leaf nearer upright lies above every flatter leaf on its side: paint flattest first.
  function draw(now) {
    let moving = false, changed = false;
    for (const L of leaves) {
      const th = tval(L.th, now);
      if (!tdone(L.th, now)) moving = true;
      if (th !== L.drawn) { L.drawn = th; drawLeaf(L, th); changed = true; }
    }
    if (changed) {
      const o = leaves.slice().sort((a, b) => b.key - a.key);
      if (o.some((L, i) => lg.children[i] !== L.el)) lg.append(...o.map((L) => L.el));
    }
    return moving;
  }

  const B = register(stage, (_dt, now) => draw(now));
  bag.add(B.unregister);

  // The hit test reads the REST book once: its outline, and the screen x of its two outer edges. Nothing that moves is read.
  const restPts = cover.map((q) => P(q.u, q.v, 0));
  for (const L of leaves) for (const [u, z] of profile(target(L.k, REST_CUT), L.bR, L.bL)) restPts.push(Q(u, 0, z), Q(u, LH, z));
  const restHull = hull(restPts);
  const xa = Q(-LW, 0, CT)[0], xb = Q(LW, 0, CT)[0];
  /** Whether a screen point is inside the rest book's outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa2, ya] = restHull[a], [xb2, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb2 - xa2) * (y - ya)) / (yb - ya) + xa2) ok = !ok;
    }
    return ok;
  }
  /** The section under a screen point: its x across the spread, front matter on the left. */
  const hit = (pt) => (inside(pt) ? clamp(Math.floor(((pt[0] - xa) / (xb - xa)) * N), 0, N - 1) : -1);

  let act = -1, cut = REST_CUT;
  /** Opens the book at section a (-1 goes back to rest). The leaves nearest the old opening go over first. */
  function setActive(a) {
    if (a === act) return;
    const c = a < 0 ? REST_CUT : a, from = cut, now = performance.now();
    act = a;
    cut = c;
    for (const L of leaves) {
      tset(L.th, target(L.k, c), now, Math.abs(L.k - from) * stag);
      L.edge.classList.toggle("hi", L.k === c);
    }
    read.textContent = a < 0 ? "rest" : name(a);
    B.wake();
  }

  leaves[REST_CUT].edge.classList.add("hi");
  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(hit(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "prayers",
  means: "An open prayer book: move across it and the leaves turn to morning prayers, the Hours or a kathisma of the Psalter.",
  rules: [1, 2, 5, 6],
  range: [0, 40, 80],
  mount,
});
