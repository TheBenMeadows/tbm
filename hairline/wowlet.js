/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Wowlet: a shell game. Three identical upturned cups stand in a row on a low
 * board, the left one drawn back, and a coin lies in the open in front of it,
 * the bright mark. Pointing at the board brings that cup forward over the
 * coin, then the cups shuffle: three swaps, each two cups trading places on
 * arcs, one passing in front of the other, until they settle in a row again.
 * Nothing is bright at the end, and no cup can be told from another. Leaving
 * plays the shuffle backwards and the cup draws back off the coin. The
 * read-out says `1 of 3`. The slider is the gap between the moves, in ms.
 *
 * The pattern: a sequence on the discrete clock. One 700ms tween per move,
 * each started a gap after the one before; a cup's place is its rest place
 * plus the displacement of every move it takes part in, so overlapping moves
 * add up and nothing jumps. Painting is by depth, the coin always first, since
 * it lies under whatever covers it. The hit test is the board's footprint.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, ringAt, rings, run, unproj,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const L = 26, BACK = 21, B = 13, LIFT = 10, PT = 3, CR = 6, CT = 1.6;
const FOOT = 12.5, SH = 10, TOP = 6, H = 20, BA = 46, BB = 34;
const RA = (-30 * Math.PI) / 180; // the row runs a little off the screen's axis, so the board shows its depth
const U = [Math.cos(RA), Math.sin(RA)], V = [-Math.sin(RA), Math.cos(RA)]; // along the row, and toward the viewer
const W = (a, b) => [a * U[0] + b * V[0], a * U[1] + b * V[1]];
const SLOT = [-1, 0, 1].map((k) => W(k * L, 0));
const SWAPS = [[0, 1], [1, 2], [0, 1]];

/** A ring turned to lie along the row. */
const turn = (ring) => ring.map((q) => {
  const [u, v] = W(q.u, q.v), [nu, nv] = W(q.nu, q.nv);
  return { u, v, nu, nv };
});
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let gap = value;

  const C = Cam(45, 0.5, 2.9);
  const pts = [[-BA, -BB], [BA, -BB], [BA, BB], [-BA, BB]].map(([a, b]) => [...W(a, b), 0]);
  SLOT.forEach(([x, y]) => pts.push([x, y, PT + H + LIFT]));
  fit(C, pts, 200, 172);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg), board = solid(g);
  const [bo, bi] = rings(-BA, -BB, BA, BB, 6, 1.6);
  put(board, prism(P, front, turn(bo), turn(bi), 0, PT));
  const coin = solid(g), coinArt = mk("path", { class: "nf lo" }, coin.g);
  const foot = circ(FOOT, 28), sh = circ(SH, 24), top = circ(TOP, 20), inner = circ(TOP - 1.2, 20), rim = circ(FOOT - 1.4, 28);

  // The moves: the cover (cup 0 comes forward), then each swap; each cup's part in each move.
  const moves = [{ t: tween(0), parts: [{ cup: 0, from: W(-L, -BACK), to: SLOT[0], side: 0, lift: 1 }] }];
  const where = [0, 1, 2]; // which cup stands at each slot
  for (const [a, b] of SWAPS) {
    const ca = where[a], cb = where[b];
    moves.push({ t: tween(0), parts: [{ cup: ca, from: SLOT[a], to: SLOT[b], side: 1, lift: 0 }, { cup: cb, from: SLOT[b], to: SLOT[a], side: -1, lift: 0 }] });
    where[a] = cb; where[b] = ca;
  }
  const cups = [0, 1, 2].map((i) => {
    const el = solid(g);
    return { i, el, rimEl: mk("path", { class: "nf lo" }, el.g), rest: i === 0 ? W(-L, -BACK) : SLOT[i], x: 0, y: 0, z: 0, drawn: "" };
  });
  let order = "", act = false, coinDrawn = "";

  /** Where a part of a move has carried its cup by progress p: an arc, the front cup bulging toward the viewer. */
  const disp = (m, p) => {
    const s = Math.sin(Math.PI * p);
    return [lerp(m.from[0], m.to[0], p) - m.from[0] + V[0] * m.side * B * s, lerp(m.from[1], m.to[1], p) - m.from[1] + V[1] * m.side * B * s, m.lift * LIFT * s];
  };

  function draw(now) {
    let moving = false;
    for (const c of cups) { [c.x, c.y] = c.rest; c.z = 0; }
    for (const mv of moves) {
      const p = tval(mv.t, now);
      if (!tdone(mv.t, now)) moving = true;
      for (const m of mv.parts) { const [dx, dy, dz] = disp(m, p); const c = cups[m.cup]; c.x += dx; c.y += dy; c.z += dz; }
    }
    // The coin lies under cup 0 once it has come forward, and goes where that cup goes.
    const pc = tval(moves[0].t, now), k = cups[0];
    const cx = k.x - (1 - pc) * (W(-L, -BACK)[0] - SLOT[0][0]), cy = k.y - (1 - pc) * (W(-L, -BACK)[1] - SLOT[0][1]);
    const ck = `${cx},${cy}`;
    if (ck !== coinDrawn) {
      coinDrawn = ck;
      put(coin, prism(P, front, at(circ(CR, 24), cx, cy), at(circ(CR - 1, 24), cx, cy), PT, PT + CT));
      coinArt.setAttribute("d", poly(ringAt(P, at(circ(CR - 2.8, 20), cx, cy), PT + CT)));
    }
    for (const c of cups) {
      const key = `${c.x},${c.y},${c.z}`;
      if (key === c.drawn) continue;
      c.drawn = key;
      const z0 = PT + c.z, ring = (r) => at(r, c.x, c.y);
      const sil = poly(hull(ringAt(P, ring(foot), z0).concat(ringAt(P, ring(sh), z0 + H - 5), ringAt(P, ring(top), z0 + H))));
      put(c.el, { sil, crease: open(ringAt(P, run(ring(inner), front), z0 + H)) });
      c.rimEl.setAttribute("d", open(ringAt(P, run(ring(rim), front), z0 + 2.2)));
    }
    // Paint order: the board, the coin (it lies under whatever covers it), then the cups from far to near.
    const seq = [board.g, coin.g, ...cups.slice().sort((p, q) => p.x + p.y - q.x - q.y).map((c) => c.el.g)];
    const key = seq.map((e) => e === board.g ? "b" : e === coin.g ? "c" : cups.findIndex((c) => c.el.g === e)).join();
    if (key !== order) { order = key; for (const e of seq) g.append(e); }
    coin.sil.classList.toggle("hi", !act && pc < 0.5);
    return moving;
  }

  const Lp = register(stage, (_dt, now) => draw(now));
  bag.add(Lp.unregister);

  /** Covers the coin and shuffles (true), or plays the shuffle backwards and uncovers it (false). */
  function setActive(on) {
    if (on === act) return;
    act = on;
    const now = performance.now(), n = moves.length;
    moves.forEach((mv, i) => tset(mv.t, on ? 1 : 0, now, (on ? i : n - 1 - i) * gap));
    read.textContent = on ? "1 of 3" : "rest";
    Lp.wake();
  }

  // Hit area: the board's footprint on the ground plane, which never moves.
  const over = ([sx, sy]) => {
    const [x, y] = unproj(C, sx, sy, 0), a = x * U[0] + y * U[1], b = x * V[0] + y * V[1];
    return Math.abs(a) < BA + 4 && clamp(b, -BB - 30, BB + 4) === b;
  };

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(over(pt)), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { gap = v; }, destroy: bag.dispose };
}

hairline({
  name: "wowlet",
  means: "A shell game: point at the board and a cup covers the coin, then the three cups shuffle until no one can say which holds it.",
  rules: [2, 4, 5, 6, 8, 10],
  range: [380, 480, 580],
  mount,
});
