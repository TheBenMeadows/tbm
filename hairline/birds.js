/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Birds: five posts of uneven height on a board, one per sanctuary, a bird
 * perched on each. The birds are cut-outs in profile, like wooden decoys:
 * a thin plate turned square to the viewer, so the shape reads whole. Pointing
 * at the figure is an observation: every bird hops at once and lands on a
 * different post, spreading out from the post under the pointer on the 700ms
 * curve. The read-out counts layouts. The slider is the height of the hop.
 *
 * The pattern: discrete items, a stagger by distance, and a hit test on the
 * posts' rest centres, which never move, so a bird in flight cannot change
 * the choice.
 */
const {
  Cam, fit, facing, fillet, lerp, mk, open, place, poly, prism, proj, rings,
  tdone, tset, tval, tween, disposer, pointer, put, register, solid,
} = HL;

const GAP = 46;
// one post per sanctuary: height, and its offset across the board
const POSTS = [
  { h: 20, y: 5 }, { h: 31, y: -4 }, { h: 14, y: 3 }, { h: 25, y: -6 }, { h: 36, y: 2 },
];
// the birds: size, and which way they face (+1 looks to the viewer's right)
const BIRDS = [
  { s: 1.0, f: 1 }, { s: 0.86, f: -1 }, { s: 1.08, f: 1 }, { s: 0.92, f: 1 }, { s: 0.98, f: -1 },
];
const N = POSTS.length;
const px = (i) => i * GAP, py = (i) => POSTS[i].y;

// A songbird in profile, facing +u, feet at the origin: [u, w, corner radius].
const PROFILE = [
  [-13, 12, 0.6], [-6, 11, 2], [-1, 14.5, 5], [4, 16, 3], [6, 20, 3], [10, 21.5, 3],
  [13, 20, 1.5], [17, 18.6, 0.4], [13, 17.4, 0.6], [12, 15, 2], [11.5, 9.5, 5],
  [7, 3.4, 5], [0, 2.6, 5], [-6, 5.5, 3], [-13, 10.4, 0.6],
];
const EYE = [10.4, 19.2];
const LEGS = [[[1, 3], [0, 0]], [[4, 3.2], [3.4, 0]]];
const TH = 1.4; // the plate's thickness
const R2 = Math.SQRT1_2;

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let hop = value;

  const C = Cam(45, 0.5, 1.95);
  const pts = [];
  for (let i = 0; i < N; i++) {
    pts.push([px(i) - 18, py(i) + 18, 0], [px(i) + 18, py(i) - 18, POSTS[i].h + 4 + 20 + 40]);
  }
  pts.push([-14, -14, 0], [px(N - 1) + 14, 14, 0]);
  fit(C, pts, 200, 172);
  const P = proj(C), front = facing(C);

  // The board, then the posts back to front, then the flock.
  const ground = mk("g", {}, svg);
  const [br, bi] = rings(-14, -14, px(N - 1) + 14, 14, 5, 1.6);
  put(solid(ground), prism(P, front, br, bi, 0, 4));
  const posts = POSTS.map((p, i) => {
    const el = solid(ground);
    const [r, inner] = rings(px(i) - 3.4, py(i) - 3.4, px(i) + 3.4, py(i) + 3.4, 1.8, 0.8);
    put(el, prism(P, front, r, inner, 4, 4 + p.h));
    return el;
  });

  const flock = mk("g", {}, svg);
  const birds = BIRDS.map((b, j) => {
    const g = mk("g", {}, flock);
    const legs = mk("path", { class: "nf lo" }, g);
    const back = mk("path", { class: "lo" }, g);
    const face = mk("path", { class: "sil" }, g);
    const eye = mk("circle", { r: 1.1, class: "dot m" }, g);
    const outline = fillet(PROFILE.map(([u, w]) => [u * b.s, w * b.s]), PROFILE.map((q) => q[2] * b.s), 4);
    return { ...b, j, at: j, from: j, tw: tween(1), drawn: "", g, legs, back, face, eye, outline };
  });

  /** Screen point of profile point (u, w) for a bird standing at (x, y, z), t across its thickness. */
  function world(b, x, y, z, u, w, t) {
    const du = u * b.f;
    return P(x + du * R2 + t * R2, y - du * R2 + t * R2, z + w);
  }

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
      const s = b.s;
      b.back.setAttribute("d", poly(b.outline.map(([u, w]) => world(b, x, y, z, u, w, -TH / 2))));
      b.face.setAttribute("d", poly(b.outline.map(([u, w]) => world(b, x, y, z, u, w, TH / 2))));
      b.legs.setAttribute("d", LEGS.map((l) => open(l.map(([u, w]) => world(b, x, y, z, u * s, w * s, 0)))).join(""));
      place(b.eye, world(b, x, y, z, EYE[0] * s, EYE[1] * s, TH / 2));
    }
    // A bird nearer the viewer is painted after a farther one.
    order.sort((a, c) => a[0] - c[0]).forEach(([, b]) => flock.appendChild(b.g));
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  // Hit: the post whose rest centre is nearest the pointer's screen x. Posts never move.
  const centres = POSTS.map((p, i) => P(px(i), py(i), 4 + p.h)[0]);
  const hit = ([sx]) => centres.reduce((best, c, i) => (Math.abs(c - sx) < Math.abs(centres[best] - sx) ? i : best), 0);

  const REST = 4; // the bird on the tallest post carries the rest mark
  let act = -1, layout = 1, step = 2;
  function mark(i) {
    posts.forEach((el, k) => el.sil.classList.toggle("hi", k === i));
    for (const b of birds) b.face.classList.toggle("hi", i < 0 && b.at === REST);
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
