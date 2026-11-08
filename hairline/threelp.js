/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Threelp: three identical pitched-roof houses in a row on a short test bench,
 * and at the far end the wolf: a profile cut-out on a small stand, like a
 * wooden decoy, a thin plate turned square to the viewer so the shape reads
 * whole. It sits in the howling pose: haunches down, front legs straight, tail
 * along the ground, neck stretched up and muzzle raised. It never follows the
 * pointer. The houses differ only in their walls: straw (wavy courses),
 * sticks (upright stick lines) and brick (mortar courses, staggered joints).
 * The brick house carries the one bright edge throughout. Pointing at the
 * bench: it holds the howl, the jaw opens a little wider, and the huff
 * leaves the raised muzzle as hairline arcs that curve down the bench,
 * two for each house; the straw house leans downwind and folds flat, its roof
 * dropping onto its walls, then the stick house does the same; brick holds.
 * Leaving closes the jaw and stands the houses back up. The read-out counts what
 * stands. The slider is the stagger between houses, in ms.
 *
 * The pattern: discrete items, as Riffle. One 700ms tween per house fold, per
 * huff and one for the jaw; the stagger is the house's distance from the mouth.
 * The hit test is the outline of the REST bench, houses and wolf, read once.
 */
const {
  Cam, clamp, facing, fillet, fit, hull, lerp, open, place, poly, prism, proj, rad, ringAt, rings, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// The bench runs across the picture: u along it (world (1, -1)), v across it (world (1, 1)).
const BZ = 3, HW = 20, HD = 18, WH = 18, RH = 12, EV = 2.2, LEAN = 6, R2 = Math.SQRT1_2;
const HU = [-24, 8, 40], BD = [-96, -22, 58, 22], WU = -66, WZ = BZ + 2.4, TH = 1.4;
// The wolf, sitting, in profile, facing the houses, drawn with its head lowered: [u, w, corner radius].
// Points HEAD[0]..HEAD[1] are the head, turned about NECK; the one after the mouth corner is the lower jaw.
const WOLF = [[15, 0, 0.8], [13.5, 15, 3], [15.5, 22, 6], [12.5, 30, 4],
  [17, 31.5, 2], [25, 32.6, 0.8], [18, 34.2, 0.4], [26.8, 34.6, 0.8], [26.8, 36.8, 1], [16, 38.5, 3], [10, 40, 1.5], [1.5, 46, 0.7], [3, 38.5, 2], [1, 35, 4],
  [-6, 26, 6], [-14, 12, 6], [-13, 5, 2], [-16, 4, 1.5], [-25, 6.5, 4], [-33, 5, 2], [-34.5, 1.5, 1.5], [-28, 0.2, 2], [-16, 0, 1.5], [4, 0, 1], [4.5, 2.6, 1.5],
  [7.5, 5, 2], [9.5, 0, 0.8]];
const HEAD = [4, 13], JP = 6, NECK = [6, 30], EYE = [14.5, 36.6], WS = 0.78, HOWL = 58, MOUTH = [10.4, 38.6];
const W2 = (u, v) => [(u + v) * R2, (v - u) * R2];
const spin = (ring) => ring.map((q) => ({ u: (q.u + q.v) * R2, v: (q.v - q.u) * R2, nu: (q.nu + q.nv) * R2, nv: (q.nv - q.nu) * R2 }));

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

/** One wall texture, in the plane of a face: f(u, t) gives the world point at u along the face and t up it. */
function texture(kind, len, h, f) {
  const out = [], rows = Math.max(2, Math.round(h / 5.2));
  if (kind === 0) for (let j = 1; j < 4; j++) out.push(open(Array.from({ length: 25 }, (_, i) => f(1.5 + ((len - 3) * i) / 24, j / 4 + 0.035 * Math.sin(i * 1.3 + j)))));
  if (kind === 1) for (let u = 3; u < len - 2; u += 4.2) out.push(seg(f(u, 0.03), f(u, 0.97)));
  if (kind === 2) for (let j = 0; j < rows; j++) {
    if (j) out.push(seg(f(1.5, j / rows), f(len - 1.5, j / rows)));
    for (let u = 3.5 + (j % 2) * 3.4; u < len - 2; u += 6.8) out.push(seg(f(u, j / rows), f(u, (j + 1) / rows)));
  }
  return out.join(" ");
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 2.2);
  const pts = [[BD[0], BD[1]], [BD[2], BD[3]], [BD[2], BD[1]], [BD[0], BD[3]]].map(([u, v]) => [...W2(u, v), 0]);
  HU.forEach((u) => pts.push([...W2(u, 0), BZ + WH + RH]));
  pts.push([...W2(WU, 0), WZ + 42]);
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // The bench, the wolf's stand, and the wolf: a plate seen square, its back edge dim, its face the silhouette.
  const fixG = mk("g", {}, g);
  put(solid(fixG), prism(P, front, ...rings(...BD, 6, 1.6).map(spin), 0, BZ));
  const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y })), [WX, WY] = W2(WU, 0);
  put(solid(fixG), prism(P, front, ...rings(-26, -4, 13, 4, 1.6, 1).map((r) => at(spin(r), WX, WY)), BZ, WZ));
  const WP = (u, w, t) => { const [x, y] = W2(WU + u, 0); return P(x + t * R2, y + t * R2, WZ + w); };
  const back = mk("path", { class: "lo" }, fixG), face = mk("path", { class: "sil" }, fixG), eye = mk("circle", { r: 1.2, class: "dot m" }, fixG);
  const huffG = mk("g", {}, g), huffs = [0, 1, 2, 3].map((i) => ({ i, el: mk("path", { class: "nf lo" }, huffG), p: tween(0), drawn: NaN }));
  const turn = ([u, w], [cu, cw], deg) => { const c = Math.cos(rad(deg)), sn = Math.sin(rad(deg)); return [cu + (u - cu) * c - (w - cw) * sn, cw + (u - cu) * sn + (w - cw) * c]; };
  /** The wolf with its head turned up by deg about the neck and its jaw open by jaw degrees. */
  function wolf(deg, jaw) {
    const head = (q) => turn(q, NECK, deg).map((c) => c * WS);
    const pts2 = WOLF.map(([u, w], i) => (i === JP + 1 ? turn([u, w], WOLF[JP], -jaw) : [u, w])).map((q, i) => (i >= HEAD[0] && i <= HEAD[1] ? head(q) : q.map((c) => c * WS)));
    const out = fillet(pts2, WOLF.map((q) => q[2] * WS), 4);
    back.setAttribute("d", poly(out.map(([u, w]) => WP(u, w, -TH / 2))));
    face.setAttribute("d", poly(out.map(([u, w]) => WP(u, w, TH / 2))));
    place(eye, WP(...head(EYE), TH / 2));
  }
  /** One huff at progress p: two arcs leaving the mouth; the later two travel on, over the fallen straw, to the sticks. */
  function huff(H, p) {
    if (p < 0.002 || p > 0.995) return "";
    const [m, c, e] = H.i > 1 ? [MOUTH, [34, 44], [52, 16]] : [MOUTH, [17, 36], [21, 16]];
    const at2 = (t) => [0, 1].map((k) => (1 - t) * (1 - t) * m[k] + 2 * (1 - t) * t * c[k] + t * t * e[k]);
    const [cu, cw] = at2(p), [nu, nw] = at2(Math.min(1, p + 0.02)), th = Math.atan2(nw - cw, nu - cu) || 0, r = lerp(2.5, 6.5, p);
    return [r, r - 2.6].filter((rr) => rr > 1).map((rr) => open(Array.from({ length: 9 }, (_, j) => { const a = th + rad(-40 + j * 10); return WP(cu + rr * Math.cos(a), cw + rr * Math.sin(a), TH / 2); }))).join(" ");
  }
  const jawT = tween(0);
  let jawDrawn = NaN;

  const houses = HU.map((u, k) => {
    const [cx, cy] = W2(u, 0), x0 = cx - HW / 2;
    const hg = mk("g", {}, g), wall = solid(hg), tex = mk("path", { class: "nf lo" }, hg);
    const door = mk("path", { class: "" }, hg), roof = solid(hg);
    return { k, x0, cy, wall, tex, door, roof, f: tween(0), drawn: NaN };
  });
  g.append(huffG);
  let act = false;

  /** Draws a house folded by f: the walls squash and lean downwind, the roof flattens and rides down on them. */
  function house(H, f) {
    const h = lerp(WH, 3.2, ss(f)), rh = lerp(RH, 3.4, ss(f)), x0 = H.x0, x1 = x0 + HW, Y0 = H.cy - HD / 2, Y1 = H.cy + HD / 2;
    const dx = LEAN * R2 * Math.sin(Math.PI * Math.min(f, 0.5)) * (1 - 0.4 * f), dy = -dx;
    const foot = rings(x0, Y0, x1, Y1, 1.6, 1)[0], zt = BZ + h;
    put(H.wall, { sil: poly(hull(ringAt(P, foot, BZ).concat(ringAt(P, at(foot, dx, dy), zt)))), crease: "" });
    const W = (x, y, t) => P(x + dx * t, y + dy * t, BZ + h * t);
    H.tex.setAttribute("d", texture(H.k, HW, h, (u, t) => W(x0 + u, Y1, t)) + " " + texture(H.k, HD, h, (u, t) => W(x1, Y1 - u, t)));
    const dw = (HW - 6) / 2;
    H.door.setAttribute("d", poly([[dw, 0], [dw + 6, 0], [dw + 6, 0.6], [dw, 0.6]].map(([u, t]) => W(x0 + u, Y1, t))));
    const eave = [[x0 - EV, Y0 - EV], [x1 + EV, Y0 - EV], [x1 + EV, Y1 + EV], [x0 - EV, Y1 + EV]].map(([x, y]) => P(x + dx, y + dy, zt));
    const ridge = [P(x0 - EV + dx, H.cy + dy, zt + rh), P(x1 + EV + dx, H.cy + dy, zt + rh)];
    put(H.roof, { sil: poly(hull(eave.concat(ridge))), crease: open([ridge[0], ridge[1], eave[2]]) });
  }

  // Hit area: the outline of the rest bench and the houses' roofs, read once and never moved.
  const board = spin(rrect(...BD, 6, 2));
  const restHull = hull(ringAt(P, board, 0).concat(ringAt(P, board, BZ), houses.flatMap((H) => [P(H.x0, H.cy, BZ + WH + RH), P(H.x0 + HW, H.cy, BZ + WH + RH)]), [WP(0, 46, 0), WP(-26, 3, 0), WP(20, 28, 0)]));
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }

  function draw(now) {
    let moving = !tdone(jawT, now), standing = 3;
    const j = tval(jawT, now);
    if (j !== jawDrawn) { jawDrawn = j; wolf(HOWL, lerp(3, 9, j)); }
    for (const H of huffs) {
      const p = tval(H.p, now);
      if (!tdone(H.p, now)) moving = true;
      if (p !== H.drawn) { H.drawn = p; H.el.setAttribute("d", huff(H, p)); }
    }
    for (const H of houses) {
      const f = tval(H.f, now);
      if (!tdone(H.f, now)) moving = true;
      if (f > 0.5) standing--;
      if (f === H.drawn) continue;
      H.drawn = f;
      house(H, f);
    }
    // One highlight, throughout: the brick house, the one that holds.
    for (const s of [houses[2].wall.sil, houses[2].roof.sil]) s.classList.add("hi");
    read.textContent = act ? `${standing} of 3 standing` : "rest";
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now)); bag.add(L.unregister);

  /** The wolf huffs (true): two huffs then a fold per house, the nearest first; the brick one never folds. */
  function setActive(on) {
    if (on === act) return;
    const now = performance.now();
    act = on;
    tset(jawT, on ? 1 : 0, now, 0);
    huffs.forEach((H) => { H.p = tween(0); H.drawn = NaN; if (on) tset(H.p, 1, now, 60 + [0, 0.3, 1.2, 1.5][H.i] * stag); });
    [0, 1].forEach((k) => tset(houses[k].f, on ? 1 : 0, now, on ? 60 + (k ? 1.75 : 0.55) * stag : (1 - k) * stag * 0.5));
    L.wake();
  }

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "threelp",
  means: "A howling wolf cut-out before straw, stick and brick houses: point and it huffs; two houses fold flat and brick holds.",
  rules: [1, 2, 5, 6, 10],
  range: [350, 500, 650],
  mount,
});
