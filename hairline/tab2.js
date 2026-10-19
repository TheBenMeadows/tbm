/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Tab2: a coin hopper on the desk, the bowl on top of a squat body with a slot
 * low on its side, an open bill lying under the slot, and a handful of odd
 * tokens beside it: a disc, a square, a triangle, a hexagon, a thick chip.
 * Pointing at the desk pours every token into the bowl, nearest first, and
 * once the last has gone in, one round coin slides out of the slot onto the
 * bill. The read-out says `paid`, and `rest` at rest. The slider is the stagger.
 *
 * The pattern: discrete items, as Badges. One 700ms tween per token along a
 * lift, cross and drop path, staggered by rank from the pointer, then one for
 * the coin. The hit test is the outline of the REST desk, read once.
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, lerp, open, poly, prism, proj, rad, ringAt, rings, rrect, run, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const X0 = 30, X1 = 86, Y0 = -18, Y1 = 34, BH = 30;
const HX = 58, HY = 8, FR = 13, MR = 27, WT = 1.8, RIM = 58, HTOP = RIM + 10, SINK = RIM - 25;
const SC = 1, SZ = 4, CR = 9, CT = 2.6, ST = 1.2, LAND = 124, SL = [93, -16, 138, 16];

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
const spin = (ring, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return ring.map((q) => ({ u: q.u * c - q.v * s, v: q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};
/** A ring from a polygon traced counter-clockwise: each normal points out of the shape. */
function ringOf(pts) {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv) || 1;
    return { u: p[0], v: p[1], nu: dv / l, nv: -du / l };
  });
}
const ngon = (n, R, r, a0) => ringOf(fillet(Array.from({ length: n }, (_, k) => [R * Math.cos(a0 + (2 * Math.PI * k) / n), R * Math.sin(a0 + (2 * Math.PI * k) / n)]), Array(n).fill(r), 4));
const inset = (ring, b) => { const R = Math.max(...ring.map((q) => Math.hypot(q.u, q.v))); return ring.map((q) => ({ ...q, u: q.u * (1 - b / R), v: q.v * (1 - b / R) })); };

// the tokens the payer holds, by hand: no two alike; the hexagon lies on the square
const TOK = [
  { ring: circ(10, 32), t: 2.6, x: -6, y: 56, z0: 0 },
  { ring: spin(rrect(-9.5, -9.5, 9.5, 9.5, 2.4, 4), 24), t: 3.2, x: 26, y: 66, z0: 0 },
  { ring: ngon(3, 14, 2.6, 0.4), t: 2.8, x: -20, y: 84, z0: 0 },
  { ring: ngon(6, 10.5, 1.4, 0.25), t: 3.4, x: 22, y: 70, z0: 3.2 },
  { ring: circ(7.5, 28), t: 5, x: 8, y: 100, z0: 0 },
];
const N = TOK.length;

/** A token's place at progress s on its way from the desk (0) into the bowl (1): lift, cross, drop out of sight. */
function path(t, s) {
  const mv = ss((s - 0.18) / 0.5), z = lerp(t.z0, HTOP, ss(s / 0.3)) - (HTOP - t.end) * ss((s - 0.7) / 0.3);
  return [lerp(t.x, HX, mv), lerp(t.y, HY, mv), z];
}
/** The coin's place at progress s from inside the slot (0) to the bill (1). */
const coinAt = (s) => [lerp(X1 - CR - 0.6, LAND, ss(s / 0.85)), SC, SZ - (SZ - ST) * ss((s - 0.4) / 0.4)];

/** The bowl, which never moves: `far` is painted behind what falls in, `near` in front of it. */
function bowl(P, front) {
  const ring = (r, n) => at(circ(r, n), HX, HY), foot = ring(FR, 32), mouth = ring(MR, 48), lip = ring(MR - WT, 48);
  const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
  const mB = LR(ringAt(P, run(mouth, (q) => !front(q)), RIM)), fF = LR(ringAt(P, run(foot, front), BH));
  const mF = LR(ringAt(P, run(mouth, front), RIM)), lF = LR(ringAt(P, run(lip, front), RIM));
  const far = [[poly([mF[0], ...mB, mF[mF.length - 1], ...fF.slice().reverse()]), "sil"], [poly(ringAt(P, lip, RIM)), "nf"]];
  const near = [
    [poly([...lF, mF[mF.length - 1], ...fF.slice().reverse(), mF[0]]), "fo"],
    [open([mF[0], ...fF, mF[mF.length - 1]]), "nf sil"],
    [open(mF), "nf lo"],
    [open(lF), "nf"],
  ];
  return { far, near };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.72);
  const pts = [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [SL[0], SL[1], 0], [SL[2], SL[3], 0], [SL[2], SL[1], 0]];
  [[HX - MR, HY], [HX + MR, HY], [HX, HY - MR], [HX, HY + MR]].forEach(([x, y]) => pts.push([x, y, RIM]));
  TOK.forEach((t) => pts.push([t.x - 14, t.y - 14, 0], [t.x + 14, t.y + 14, 0], [lerp(t.x, HX, 0.3), lerp(t.y, HY, 0.3), HTOP + 5]));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg), farG = mk("g", {}, g), body = solid(farG), nearG = mk("g", {}, g);
  put(body, prism(P, front, ...rings(X0, Y0, X1, Y1, 9, 1.6), 0, BH));
  const paths = bowl(P, front);
  for (const [d, cls] of paths.far) mk("path", { d, class: cls }, farG);
  for (const [d, cls] of paths.near) mk("path", { d, class: cls }, nearG);

  // The bill under the slot, with its printed rows and the rule above the total.
  const billG = mk("g", {}, g), bill = solid(billG);
  put(bill, prism(P, front, ...rings(...SL, 3, 1.2), 0, ST));
  const rows = [[99, 6], [104, 3], [109, 10], [115, 16]].map(([x, l]) => seg(P(x, SL[1] + 6, ST), P(x, SL[1] + 6 + l + (x === 115 ? 6 : 0), ST)));
  mk("path", { d: rows.join(" "), class: "nf lo" }, billG);
  const coin = solid(g), art = mk("path", { class: "nf lo" }, coin.g);
  const cRing = circ(CR, 32), cIn = circ(CR - 1.2, 32), cArt = circ(CR - 3.4, 32), cT = tween(0);

  // The face round the slot: covers the coin while it is still inside the body, then the slot itself.
  const side = (u, v) => P(X1, u, v), slotG = mk("g", {}, g);
  mk("path", { d: poly([side(SC - 10, SZ), side(SC + 24, SZ), side(SC + 24, SZ + 19), side(SC - 10, SZ + 19)]), class: "fo" }, slotG);
  mk("path", { d: poly(rrect(SC - 10.5, SZ - 1, SC + 10.5, SZ + 5.5, 2.5, 4).map((q) => side(q.u, q.v))), class: "nf" }, slotG);

  const toks = TOK.map((t, i) => {
    const el = solid(g);
    return { ...t, i, el, inner: inset(t.ring, 1.2), s: tween(0), drawn: NaN, rank: i, end: SINK - i };
  });
  const all = [farG, nearG, billG, coin.g, slotG, ...toks.map((t) => t.el.g)];
  let order = "", act = false, cDrawn = NaN;

  // Hit area: the outline of the rest desk, the machine and the bill, read once and never moved.
  const restHull = hull(toks.flatMap((t) => ringAt(P, at(circ(16, 12), t.x, t.y), 0))
    .concat(ringAt(P, rrect(X0, Y0, X1, Y1, 9, 2), 0), ringAt(P, rrect(...SL, 3, 2), 0), ringAt(P, at(circ(MR, 16), HX, HY), RIM)));
  const scr = toks.map((t) => P(t.x, t.y, t.z0));
  /** Whether a screen point is inside the rest outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }
  const inBowl = (x, y) => Math.hypot(x - HX, y - HY) < MR - WT;

  function draw(now) {
    let moving = !tdone(cT, now);
    for (const t of toks) {
      const s = tval(t.s, now);
      if (!tdone(t.s, now)) moving = true;
      if (s === t.drawn) continue;
      t.drawn = s;
      [t.px, t.py, t.pz] = path(t, s);
      put(t.el, prism(P, front, at(t.ring, t.px, t.py), at(t.inner, t.px, t.py), t.pz, t.pz + t.t));
    }
    const c = tval(cT, now);
    if (c !== cDrawn) {
      cDrawn = c;
      const [x, y, z] = coinAt(c);
      put(coin, prism(P, front, at(cRing, x, y), at(cIn, x, y), z, z + CT));
      art.setAttribute("d", poly(ringAt(P, at(cArt, x, y), z + CT)));
    }
    // Paint order: the machine and the back of the bowl, what has fallen in, the bowl's near wall,
    // the bill, the coin, the face round the slot, the tokens on the desk by depth, then those in the air.
    const fell = [], desk = [], air = [];
    for (const t of toks) (t.pz >= RIM ? air : inBowl(t.px, t.py) ? fell : desk).push(t);
    fell.sort((p, q) => p.pz - q.pz); desk.sort((p, q) => p.px + p.py - q.px - q.py); air.sort((p, q) => p.pz - q.pz);
    const seq = [farG, ...fell.map((t) => t.el.g), nearG, billG, coin.g, slotG, ...desk.map((t) => t.el.g), ...air.map((t) => t.el.g)];
    const key = seq.map((e) => all.indexOf(e)).join();
    if (key !== order) { order = key; for (const e of seq) g.append(e); }
    // One highlight: the open bill, until the coin lies on it.
    const paid = c > 0.97;
    bill.sil.classList.toggle("hi", !paid);
    coin.sil.classList.toggle("hi", paid);
    read.textContent = act && paid ? "paid" : "rest";
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  /** Pours every token into the bowl from the pointer outwards, then pays out one coin; false takes it all back. */
  function setActive(on, pt) {
    if (on === act) return;
    const now = performance.now();
    act = on;
    if (on) {
      // Ranks only change while every token is home, so the order in the bowl stays what it was.
      if (toks.every((t) => tdone(t.s, now) && tval(t.s, now) === 0)) {
        const d = toks.map((t, i) => Math.hypot(scr[i][0] - pt[0], scr[i][1] - pt[1]) - 8 * t.z0);
        toks.slice().sort((p, q) => d[p.i] - d[q.i]).forEach((t, k) => { t.rank = k; t.end = SINK - k; });
      }
      toks.forEach((t) => tset(t.s, 1, now, 80 + t.rank * stag));
      tset(cT, 1, now, 80 + (N - 1) * stag + 300);
    } else {
      tset(cT, 0, now, 0);
      toks.forEach((t) => tset(t.s, 0, now, 300 + (N - 1 - t.rank) * stag));
    }
    L.wake();
  }

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt), pt), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "tab2",
  means: "Odd tokens beside a coin hopper: point at the desk and they all pour in, and one coin slides out onto the open bill.",
  rules: [1, 2, 5, 6, 10],
  range: [25, 45, 65],
  mount,
});
