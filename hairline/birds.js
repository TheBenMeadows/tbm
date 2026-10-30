/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Birds: five posts of uneven height on a board, one per sanctuary, a bird
 * perched on each. Pointing at the figure is an observation: every bird hops
 * at once and lands on a different post, spreading out from the post under
 * the pointer on the 700ms curve. Each reshuffle is a new layout; the
 * read-out counts them. The slider is the height of the hop.
 *
 * The pattern: discrete items, a stagger by distance, and a hit test on the
 * posts' rest centres, which never move, so a bird in flight cannot change
 * the choice.
 */
const {
  Cam, fit, facing, prism, proj, rings, ringAt, lerp, tdone, tset, tval, tween,
  disposer, mk, pointer, put, register, solid,
} = HL;

const GAP = 40;
// one post per sanctuary: height, and its offset across the board
const POSTS = [
  { h: 22, y: 5 }, { h: 32, y: -4 }, { h: 17, y: 3 }, { h: 27, y: -6 }, { h: 36, y: 2 },
];
// the birds: size, and which way they face (+1 head toward the viewer's right)
const BIRDS = [
  { s: 1.25, f: 1 }, { s: 1.1, f: -1 }, { s: 1.32, f: 1 }, { s: 1.16, f: 1 }, { s: 1.22, f: 1 },
];
const N = POSTS.length;
const px = (i) => i * GAP, py = (i) => POSTS[i].y;

/** A bird's three parts, as footprints about its own centre and heights above its feet. */
function parts(b) {
  const s = b.s, f = b.f;
  const box = (u0, u1, v, z0, z1, r, bb) => {
    const a = f > 0 ? [u0, u1] : [-u1, -u0];
    return { foot: rings(a[0] * s, -v * s, a[1] * s, v * s, r * s, bb), z0: z0 * s, z1: z1 * s, cx: (a[0] + a[1]) / 2 };
  };
  return [
    box(-15, -5, 1.8, 6.5, 8, 1.8, 0.5), // tail: a thin plate, narrower than the body
    box(-8, 7, 5, 1.5, 10, 5, 1.2), // body: round in plan
    box(3, 10, 3.4, 9, 15, 3.4, 0.9), // head: small, set up on top at the front
  ].sort((p, q) => p.cx - q.cx); // back to front along x
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hop = value;

  const C = Cam(45, 0.5, 1.9);
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push([px(i) - 8, py(i) - 8, 0], [px(i) + 8, py(i) + 8, POSTS[i].h + 18 + 34]);
  }
  pts.push([-16, -14, 0], [px(N - 1) + 16, 14, 0]);
  fit(C, pts, 200, 172);
  const P = proj(C), front = facing(C);

  // The board, then the posts back to front, then the birds.
  const ground = mk("g", {}, svg);
  const board = solid(ground);
  const [br, bi] = rings(-16, -14, px(N - 1) + 16, 14, 5, 1.6);
  put(board, prism(P, front, br, bi, 0, 4));
  const posts = POSTS.map((p, i) => {
    const el = solid(ground);
    const [r, inner] = rings(px(i) - 4.5, py(i) - 4.5, px(i) + 4.5, py(i) + 4.5, 2.4, 1);
    put(el, prism(P, front, r, inner, 4, 4 + p.h));
    return el;
  });

  const flock = mk("g", {}, svg);
  const birds = BIRDS.map((b, j) => {
    const g = mk("g", {}, flock);
    return { ...b, j, at: j, from: j, tw: tween(1), drawn: "", g, parts: parts(b).map((q) => ({ ...q, el: solid(g) })) };
  });

  /** Where bird b is at t of its hop, from its old post to its new one, and how high. */
  function pose(b, t) {
    const x = lerp(px(b.from), px(b.at), t), y = lerp(py(b.from), py(b.at), t);
    const z = 4 + lerp(POSTS[b.from].h, POSTS[b.at].h, t) + 4 * t * (1 - t) * hop;
    return [x, y, z];
  }

  function draw(now) {
    let moving = false;
    const order = [];
    for (const b of birds) {
      const t = tval(b.tw, now);
      if (!tdone(b.tw, now)) moving = true;
      const [x, y, z] = pose(b, t);
      order.push([x + y, b]);
      const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
      if (key === b.drawn) continue;
      b.drawn = key;
      for (const q of b.parts) {
        const ring = q.foot[0].map((s) => ({ ...s, u: s.u + x, v: s.v + y }));
        const inner = q.foot[1].map((s) => ({ ...s, u: s.u + x, v: s.v + y }));
        put(q.el, prism(P, front, ring, inner, z + q.z0, z + q.z1));
      }
    }
    // A bird nearer the viewer is painted after a farther one.
    order.sort((a, b) => a[0] - b[0]).forEach(([, b]) => flock.appendChild(b.g));
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  // Hit: the post whose rest centre is nearest the pointer's screen x. Posts never move.
  const centres = POSTS.map((p, i) => P(px(i), py(i), 4 + p.h)[0]);
  const hit = ([sx]) => centres.reduce((best, c, i) => (Math.abs(c - sx) < Math.abs(centres[best] - sx) ? i : best), 0);

  const REST = 4; // the tallest post's bird carries the rest mark
  let act = -1, layout = 1, step = 2;
  function mark(i) {
    posts.forEach((el, k) => el.sil.classList.toggle("hi", k === i));
    for (const b of birds) for (const q of b.parts) q.el.sil.classList.toggle("hi", i < 0 && b.at === REST);
  }

  /** Pointing reshuffles the whole flock once; moving between posts only moves the bright edge. */
  function setActive(a) {
    if (a === act) return;
    const wasRest = act < 0;
    act = a;
    if (a >= 0 && wasRest) {
      const now = performance.now();
      layout += 1;
      step = step === 2 ? 3 : 2;
      for (const b of birds) {
        b.from = b.at;
        b.at = (b.at * step + 1) % N;
        b.tw = tween(0);
        tset(b.tw, 1, now, Math.abs(b.from - a) * 45);
      }
      L.wake();
    }
    mark(a);
    read.textContent = a < 0 ? "rest" : `layout ${layout}`;
  }

  draw(performance.now());
  mark(-1);
  bag.add(pointer(stage, { move: (pt) => setActive(hit(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { hop = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "birds",
  means: "Five posts, a bird on each: point at them and every bird hops at once to a new post, the way each observation redraws the layout.",
  rules: [1, 2, 5, 6],
  range: [12, 26, 40],
  mount,
});
