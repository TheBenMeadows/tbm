/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Etherhoo: a chunky late-'90s CRT monitor on the desk, its screen facing +x
 * like the set's other objects: a deep round-cornered bezel with a tall chin,
 * the tube's back tapering away behind it, and a swivel foot under it. On the
 * screen, a web portal reduced to two things: a search bar, the bright mark
 * at rest, and under it two columns where the results go, empty at rest.
 * Pointing at the monitor types a query into the bar, a line growing from its
 * left with the caret ahead of it, and then the two columns fill with plain
 * lines row by row, left then right, down the page: blocks on the left,
 * transactions on the right. Leaving takes the rows back from the bottom and
 * clears the query. The read-out counts the results. The slider is the
 * stagger between rows, in ms.
 *
 * The pattern: one object, on or off, then a list in order. One 700ms tween
 * for the query and one per row, each row's delay its place in reading order
 * after the typing. The hit test is the monitor's rest outline, read once;
 * nothing moves but what is on the screen, so the paint order is fixed:
 * foot, neck, tube, bezel, screen.
 */
const {
  Cam, facing, fit, hull, poly, prism, proj, put, ringAt, rings, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, register, solid,
} = HL;

const BW = 64, BH = 108, BR = 12, BZ = 14, ZB = 13; // bezel: half width, height, corner radius, depth; the body's height off the desk
const DEEP = 92, KW = 38, KV0 = 7, KV1 = 80, KR = 12; // the tube's back: how far back, half width, bottom, top, corner radius
const SU = 54, SV0 = 26, SV1 = 100, SR = 9; // the screen opening
const BAR = 3.4, QU = -44, QW = 88, QV = 86, QH = 9, QL = 50; // the query's bar; the search bar and the query's length
const COL = [-44, 6], RV = [70, 61, 52, 43, 34]; // the columns' left edges, the rows' middles
const LEN = [[36, 26, 33, 22, 30], [34, 28, 21, 36, 25]]; // each row's line, by column
const TYPE = 380; // when the first row starts, after the typing

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value;
  const C = Cam(45, 0.5, 1.38), pts = [];
  for (const x of [-DEEP, 0]) for (const y of [-BW, BW]) for (const z of [0, ZB + BH]) pts.push([x, y, z]);
  fit(C, pts, 200, 170);
  const P = proj(C), front = facing(C);

  // Toward the camera: the direction the projection flattens to a point, taken pointing up.
  const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((d) => { const p = P(...d), o = P(0, 0, 0); return [p[0] - o[0], p[1] - o[1]]; });
  const r1 = e.map((p) => p[0]), r2 = e.map((p) => p[1]);
  let V = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  if (V[2] < 0) V = V.map((x) => -x);
  // The monitor's own space: u across the screen, v up it, w out of it. The screen faces +x.
  const A = [0, -1, 0], U = [0, 0, 1], N = [1, 0, 0], O = [0, 0, ZB];
  const W = (u, v, w) => [0, 1, 2].map((i) => O[i] + u * A[i] + v * U[i] + w * N[i]);
  const S = {
    P: (u, v, w) => P(...W(u, v, w)),
    front: (q) => [0, 1, 2].reduce((s, i) => s + (q.nu * A[i] + q.nv * U[i]) * V[i], 0) > 0,
  };
  const flat = (ring, w = 0) => poly(ring.map((q) => S.P(q.u, q.v, w)));
  const bar = (u0, v, len, h = BAR) => (len < 0.6 ? "" : flat(rrect(u0, v - h / 2, u0 + len, v + h / 2, Math.min(h / 2, len / 2), 4)));

  const g = mk("g", {}, svg);
  // The swivel foot and its neck, under the middle of the body.
  put(solid(g), prism(P, front, ...rings(-66, -42, -8, 42, 16, 1.6), 0, 3.4));
  put(solid(g), prism(P, front, ...rings(-52, -24, -20, 24, 9, 1.2), 3.4, ZB + 8));

  // The tube's back: the hull of the bezel's back and a smaller ring far behind it.
  const tf = rrect(-BW + 3, 3, BW - 3, BH - 3, BR, 6), tb = rrect(-KW, KV0, KW, KV1, KR, 6);
  mk("path", { d: poly(hull(ringAt(S.P, tf, -BZ).concat(ringAt(S.P, tb, -DEEP)))), class: "sil" }, g);

  // The bezel, deep and round-cornered, with a tall chin and the screen set into it.
  const bez = rrect(-BW, 0, BW, BH, BR, 6);
  put(solid(g), prism(S.P, S.front, bez, rrect(-BW + 1.6, 1.6, BW - 1.6, BH - 1.6, BR - 1.6, 6), -BZ, 0));
  mk("path", { d: flat(rrect(-SU, SV0, SU, SV1, SR, 6)), class: "nf" }, g);

  // The search bar, bright, and the query typed into it.
  mk("path", { d: flat(rrect(QU, QV - QH / 2, QU + QW, QV + QH / 2, QH / 2, 4)), class: "nf hi" }, g);
  const query = mk("path", { class: "nf hi" }, g);

  // The rows: one plain line each, drawn in from its left end.
  const rows = [];
  for (let r = 0; r < RV.length; r++) for (let c = 0; c < 2; c++) {
    rows.push({ rank: r * 2 + c, u: COL[c], v: RV[r], len: LEN[c][r], el: mk("path", { class: "nf" }, g), tw: tween(0), d: 0 });
  }

  let qd = NaN;
  function drawQuery(q) {
    const len = q * QL, cu = QU + 5 + len + (len > 0.6 ? 1.8 : 0);
    query.setAttribute("d", bar(QU + 5, QV, len) + seg(S.P(cu, QV - 2.8, 0), S.P(cu, QV + 2.8, 0)));
  }
  const qt = tween(0);

  const loop = register(stage, (_dt, now) => {
    let moving = !tdone(qt, now);
    const q = tval(qt, now);
    if (q !== qd) { qd = q; drawQuery(q); }
    for (const R of rows) {
      if (!tdone(R.tw, now)) moving = true;
      const v = tval(R.tw, now);
      if (v === R.d) continue;
      R.d = v;
      R.el.setAttribute("d", v * R.len < 0.5 ? "" : seg(S.P(R.u, R.v, 0), S.P(R.u + v * R.len, R.v, 0)));
    }
    return moving;
  });
  bag.add(loop.unregister);

  // Hit area: the monitor's rest outline, read once.
  const outline = hull([...ringAt(S.P, bez, 0), ...ringAt(S.P, bez, -BZ), ...ringAt(S.P, tb, -DEEP), ...ringAt(P, rings(-66, -42, -8, 42, 16, 1.6)[0], 0)]);
  const inside = ([x, y]) => {
    let ok = false;
    for (let a = 0, b = outline.length - 1; a < outline.length; b = a++) {
      const [xa, ya] = outline[a], [xb, yb] = outline[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  };
  let on = false;
  function aim(pt) {
    const now = pt !== null && inside(pt);
    if (now === on) return;
    on = now;
    const t = performance.now(), n = rows.length;
    tset(qt, on ? 1 : 0, t, on ? 0 : n * step * 0.5);
    for (const R of rows) tset(R.tw, on ? 1 : 0, t, on ? TYPE + R.rank * step : (n - 1 - R.rank) * step * 0.5);
    read.textContent = on ? `${n} results` : "rest";
    loop.wake();
  }

  read.textContent = "rest";
  drawQuery(0);
  bag.add(pointer(stage, { move: (pt) => aim(pt), leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { step = v; }, destroy: bag.dispose };
}

hairline({
  name: "etherhoo",
  means: "A late-'90s CRT showing a web portal: point at it and a query types into the search box, then blocks and transactions fill the columns.",
  rules: [1, 2, 4, 5, 10],
  range: [30, 50, 70],
  mount,
});
