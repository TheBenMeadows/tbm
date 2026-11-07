/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * NNW: a feed reader's window standing on the desk, its face toward +x like
 * the set's other objects: a deep slab with round corners, so its top and
 * side read, a slim sidebar of feeds as quiet lines, and a large article pane
 * with a title and two paragraphs of solid bars, set hard ragged right. The
 * article opens with a small ring, the "O" of "O Lord" that opens the morning
 * prayers, and it is the bright mark at rest. Pointing at the window sets the
 * article as a book page: the ring grows into a drop cap four lines deep and
 * the first four lines step aside for it, the lines go out to one right edge
 * one after another down the page, each paragraph's last line left short, the
 * title moves to the middle, and a short rule draws out from the middle under
 * it. Leaving sets it plain again. The read-out says which. The slider is the
 * stagger between lines, in ms.
 *
 * The pattern: one object, on or off, then a list in order. 700ms tweens: one
 * for the cap, one for the rule, one per line, each line's delay its place
 * down the page. The hit test is the window's rest outline, read once; only
 * what is on the pane moves, so the paint order is fixed.
 */
const {
  Cam, circ, fit, hull, lerp, poly, prism, proj, put, ringAt, rrect, seg,
  tdone, tset, tval, tween, disposer, mk, pointer, register, solid,
} = HL;

const WW = 72, WH = 96, WR = 7, WT = 14; // the window: half width, height, corner radius, depth
const SB = -46, U0 = -39, U1 = 65, MID = (U0 + U1) / 2; // the sidebar's edge; the article's measure and its middle
const TV = 84, TL = 50, RV = 77, RL = 26, L0 = 69, LP = 6.4, BAR = 2.6; // the title and its length, the rule, the first line, the pitch, a line's thickness
const RAG = [0.6, 0.92, 0.4, 0.86, 0.64, 0.36, 0.9, 0.44, 0.8, 0.3], LAST = [5, 9]; // each line's ragged length, as a share of the measure; the paragraphs' last lines
const R0 = 3.6, R1 = (3 * LP + 6) / 2, IND = 2 * R1 + 3.5, CAPL = 4; // the ring at rest and as a drop cap, the indent beside it, its depth in lines

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value;
  const C = Cam(45, 0.5, 1.7), pts = [];
  for (const x of [-WT, 0]) for (const y of [-WW, WW]) for (const z of [0, WH]) pts.push([x, y, z]);
  fit(C, pts, 200, 166);
  const P = proj(C);

  // Toward the camera: the direction the projection flattens to a point, taken pointing up.
  const e = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((d) => { const p = P(...d), o = P(0, 0, 0); return [p[0] - o[0], p[1] - o[1]]; });
  const r1 = e.map((p) => p[0]), r2 = e.map((p) => p[1]);
  let V = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
  if (V[2] < 0) V = V.map((x) => -x);
  // The window's own space: u across it, v up it, w out of it. It faces +x.
  const A = [0, -1, 0], U = [0, 0, 1];
  const W = (u, v, w) => [w, -u, v];
  const S = {
    P: (u, v, w) => P(...W(u, v, w)),
    front: (q) => [0, 1, 2].reduce((s, i) => s + (q.nu * A[i] + q.nv * U[i]) * V[i], 0) > 0,
  };
  const flat = (ring) => poly(ring.map((q) => S.P(q.u, q.v, 0)));
  const bar = (u0, u1, v, h) => flat(rrect(u0, v - h / 2, u1, v + h / 2, h / 2, 4));
  const line = (u0, u1, v) => seg(S.P(u0, v, 0), S.P(u1, v, 0));
  const g = mk("g", {}, svg);

  // The window: a deep slab, so its top and side read, and the sidebar's edge.
  const win = rrect(-WW, 0, WW, WH, WR, 6);
  put(solid(g), prism(S.P, S.front, win, rrect(-WW + 1.4, 1.4, WW - 1.4, WH - 1.4, WR - 1.4, 6), -WT, 0));

  // The sidebar: the feeds, as quiet lines.
  let feeds = seg(S.P(SB, WH - 6, 0), S.P(SB, 6, 0));
  [16, 12, 19, 10, 15, 11, 17, 13].forEach((l, i) => { feeds += line(-WW + 7, -WW + 7 + l, TV - i * 9); });
  mk("path", { d: feeds, class: "nf lo" }, g);

  // The article: its title, the rule that draws in under it, the lines, and the ring that opens it.
  const title = mk("path", { class: "nf" }, g);
  const rule = mk("path", { class: "nf" }, g);
  const lines = RAG.map((len, i) => ({ i, len, el: mk("path", { class: "nf" }, g), tw: tween(0), d: NaN }));
  const cap = mk("path", { class: "nf hi" }, g), O = circ(1, 40);
  const capT = tween(0), ruleT = tween(0);
  let cd = NaN, rd = NaN;

  function drawLine(L, j, s) {
    const v = L0 - L.i * LP, ind = L.i < CAPL ? (L.i === 0 ? lerp(2 * R0 + 2.4, IND, s) : IND * s) : 0;
    const rag = U0 + L.len * (U1 - U0), end = LAST.includes(L.i) ? rag : lerp(rag, U1, j);
    L.el.setAttribute("d", bar(U0 + ind, Math.max(U0 + ind + 4, end), v, BAR));
  }
  function drawCap(s) {
    const r = lerp(R0, R1, s), cu = U0 + r, cv = lerp(L0, L0 - 1.5 * LP, s), k = lerp(0.5, 0.7, s);
    cap.setAttribute("d", [r, r * k].map((R) => poly(O.map((q) => S.P(cu + q.u * R, cv + q.v * R, 0)))).join(""));
  }

  const loop = register(stage, (_dt, now) => {
    let moving = !tdone(capT, now) || !tdone(ruleT, now);
    const s = tval(capT, now), r = tval(ruleT, now);
    if (s !== cd) { cd = s; drawCap(s); const t0 = lerp(U0, MID - TL / 2, s); title.setAttribute("d", bar(t0, t0 + TL, TV, 5)); }
    if (r !== rd) { rd = r; rule.setAttribute("d", r * RL < 0.5 ? "" : line(MID - (r * RL) / 2, MID + (r * RL) / 2, RV)); }
    for (const L of lines) {
      if (!tdone(L.tw, now)) moving = true;
      const j = tval(L.tw, now), key = j + 10 * s;
      if (key === L.d) continue;
      L.d = key;
      drawLine(L, j, s);
    }
    return moving;
  });
  bag.add(loop.unregister);

  // Hit area: the window's rest outline, read once.
  const outline = hull([...ringAt(S.P, win, 0), ...ringAt(S.P, win, -WT)]);
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
    const t = performance.now(), n = lines.length;
    tset(capT, on ? 1 : 0, t, 0);
    tset(ruleT, on ? 1 : 0, t, on ? 120 : 0);
    for (const L of lines) tset(L.tw, on ? 1 : 0, t, (on ? L.i : n - 1 - L.i) * step);
    read.textContent = on ? "set" : "rest";
    loop.wake();
  }

  read.textContent = "rest";
  drawCap(0);
  title.setAttribute("d", bar(U0, U0 + TL, TV, 5));
  for (const L of lines) drawLine(L, 0, 0);
  bag.add(pointer(stage, { move: (pt) => aim(pt), leave: () => aim(null) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { step = v; }, destroy: bag.dispose };
}

hairline({
  name: "nnw",
  means: "A feed reader showing a plain article: point at it and it sets like a prayer book page, with a drop cap and justified lines.",
  rules: [1, 2, 4, 5, 10],
  range: [20, 40, 60],
  mount,
});
