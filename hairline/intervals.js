/**
 * Intervals: a striped piece standing up as eighteen slats on a plinth. The
 * slats belong to three interleaved runs, and each run steps in height from
 * one end to the other: the blend, drawn as a ramp. Bring the pointer over
 * the piece and every run levels out to the height it started at, spreading
 * from the slat nearest the pointer, so the stripes still alternate but
 * nothing changes along the piece. Leaving lets the ramps come back. The
 * slider is the stagger, in ms.
 *
 * The pattern: discrete items on tweens, staggered by distance, picked against
 * the rest pose so a slat sinking under the pointer cannot drop the hover.
 */
const {
  Cam, clamp, facing, fit, lerp, prism, proj, rings,
  tdone, tset, tval, tween, disposer, mk, pointer, put, reflect, register, rrect, solid,
} = HL;

const N = 18, STEPS = N / 3, G = 9.4, SW = 5.6, D0 = 0, D1 = 36;
// each run: the height it starts at and the height it ends at
const RUNS = [[20, 54], [47, 27], [33, 41]];
const PX0 = -7, PX1 = (N - 1) * G + SW + 7, PY0 = -7, PY1 = D1 + 7, PZ = -5;

const run = (i) => i % 3, step = (i) => Math.floor(i / 3);
const restH = (i) => lerp(RUNS[run(i)][0], RUNS[run(i)][1], step(i) / (STEPS - 1));
const stillH = (i) => RUNS[run(i)][0];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.5);
  fit(C, [[PX0, PY0, PZ], [PX1, PY1, PZ], [PX1, PY0, PZ], [PX0, PY1, PZ], [PX0, PY0, 54], [PX1, PY0, 54], [PX1, PY1, 54]], 200, 170);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const plinthRing = rrect(PX0, PY0, PX1, PY1, 6, 6);
  reflect(svg, g, P, front, plinthRing, PZ, 12);
  const [pr, pi] = rings(PX0, PY0, PX1, PY1, 6, 1.8);
  put(solid(g), prism(P, front, pr, pi, PZ, 0));

  // slats, far to near: x ascends toward the viewer
  const slats = [];
  for (let i = 0; i < N; i++) {
    const x0 = i * G, [ring, inner] = rings(x0, D0, x0 + SW, D1, 1.6, 0.9);
    const s = solid(g);
    slats.push({ s, ring, inner, h: tween(restH(i)), drawn: -1, cx: P(x0 + SW / 2, (D0 + D1) / 2, restH(i) / 2)[0] });
  }
  const MARK = N - 3; // the last slat of the first run: the far end of the tallest ramp
  slats[MARK].s.sil.classList.add("hi");

  // the hit region is the rest pose's box on screen; it never moves
  const corners = [];
  for (const x of [PX0, PX1]) for (const y of [PY0, PY1]) for (const z of [PZ, 56]) corners.push(P(x, y, z));
  const bx0 = Math.min(...corners.map((c) => c[0])), bx1 = Math.max(...corners.map((c) => c[0]));
  const by0 = Math.min(...corners.map((c) => c[1])), by1 = Math.max(...corners.map((c) => c[1]));

  /** The slat whose rest centre is nearest the pointer, or -1 outside the piece. */
  function hit([x, y]) {
    if (x < bx0 || x > bx1 || y < by0 || y > by1) return -1;
    let best = 0, bd = Infinity;
    slats.forEach((sl, i) => { const d = Math.abs(sl.cx - x); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    slats.forEach((sl) => {
      const h = clamp(tval(sl.h, now), 8, 58);
      if (Math.abs(h - sl.drawn) > 0.01) { put(sl.s, prism(P, front, sl.ring, sl.inner, 0, h)); sl.drawn = h; }
      if (!tdone(sl.h, now)) moving = true;
    });
    return moving;
  });
  bag.add(B.unregister);

  let act = -1;
  /** Levels every run, spreading from slat a; -1 lets the ramps return from the slat last touched. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a >= 0 ? a : act, was = act;
    act = a;
    if (a < 0 || was < 0) {
      slats.forEach((sl, i) => tset(sl.h, a < 0 ? restH(i) : stillH(i), now, Math.abs(i - from) * stag));
    }
    slats.forEach((sl, i) => sl.s.sil.classList.toggle("hi", a < 0 ? i === MARK : i === a));
    read.textContent = a < 0 ? "rest" : "still";
    B.wake();
  }

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  B.wake();

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "intervals",
  means: "Eighteen slats in three interleaved runs, each stepping in height. Under the pointer every run levels out and stands still.",
  rules: [1, 2, 5, 8],
  range: [0, 32, 80],
  mount,
});
