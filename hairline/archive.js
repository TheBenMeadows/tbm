/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Archive: a library card catalogue, twelve small drawers four wide and three
 * high in a tight grid on a short plinth, each front a plate with a label
 * frame and a round pull. At rest one drawer stands part way out with its
 * cards fanned up, and its front is the bright mark. Pointing at the cabinet
 * slides the drawers out in a wave from the one under the pointer, the nearest
 * furthest; only the pointed drawer's cards rise, so the eye has one place to
 * go. Leaving slides them home, the farthest first, and the one drawer settles
 * part way out again. The read-out names the drawer and counts the open ones.
 * The slider is the stagger, in ms.
 *
 * The pattern: discrete items. One 700ms tween per drawer for how far it
 * stands out and one for its cards; the tray, the cards and the front all
 * follow from those. The hit test maps the pointer onto the cabinet's face at
 * rest, read once, so a drawer sliding out under the pointer cannot change the
 * choice. A drawer never stands out past half its width. Paint order runs
 * column by column from the left, each column bottom row up, tray then front;
 * the one drawer whose cards are up has its front group painted after the
 * drawer above it, since its cards stand nearer than that neighbour's front
 * can come (the wave opens a neighbour by half of what the pointed drawer
 * gets, and the cards sit at the front of the tray, leaning toward the eye).
 */
const {
  Cam, circ, clamp, facing, fillet, fit, hull, open, poly, prism, proj, rad, ringAt, rings, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const NC = 4, NR = 3, DW = 21, FH = 13, G = 3, M = 3, FT = 1.2, PR = 1.6, PZ = 4.5, PL = 1.6;
const PH = 7, D = 26, TW = 6, X1 = 2 * M + NC * DW + (NC - 1) * G, ZT = PH + 2 * M + NR * FH + (NR - 1) * G;
const OMAX = 14, OREST = 8, REACH = 1.6, SP = 2.5, LEAN = [16, 9, 2], RISE = [0.72, 0.86, 1];
const H = 10; // a card's height above the tray rim: it clears its front by a little
const REST = 1 * NR + 1; // second column, middle row

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const xAt = (c) => M + c * (DW + G), zAt = (r) => PH + M + r * (FH + G);
/** How far a drawer d cells from the pointer's drawer stands out: the nearest furthest, none past the reach. */
const wave = (d) => { const o = OMAX * (1 - d / REACH); return o < 3 ? 0 : o; };
/** How far cards can stand (0 to 1) and how far they fan, for a drawer out by `out`. */
const growOf = (out) => ss((out - 2) / 5);
const fanOf = (out) => growOf(out) * (0.55 + 0.45 * out / OMAX);

/** Drawer c·r's front with its back face at y, on the plane facing +y: the plate (one outline, too thin for a crease), its label frame, its pull. */
function drawerFront(P, c, r, y) {
  const x = xAt(c), z = zAt(r), cx = x + DW / 2, yf = y + FT, on = (ring, yy) => ring.map((q) => P(q.u, yy, q.v));
  const o = rrect(x, z, x + DW, z + FH, 0.9, 3), k = circ(PR, 20).map((q) => ({ ...q, u: q.u + cx, v: q.v + z + PZ }));
  return {
    plate: { sil: poly(hull(on(o, y).concat(on(o, yf)))), crease: "" },
    label: poly(on(rrect(cx - 4, z + FH - 3.8, cx + 4, z + FH - 1.8, 0.6, 3), yf)),
    pull: { sil: poly(hull(on(k, yf).concat(on(k, yf + PL)))), crease: "" },
  };
}

/** The part of drawer c·r's tray standing out of the cabinet: an open box from the face to the back of its front. */
function tray(P, seen, c, r, out) {
  if (out < 0.8) return { sil: "", crease: "" };
  const x = xAt(c) + 1, z = zAt(r), o = rrect(x, D, x + DW - 2, D + out, Math.min(1.2, out / 2), 3);
  const i = rrect(x + 1, D - 0.6, x + DW - 3, D + out - 0.6, 0.6, 3);
  return { sil: prism(P, seen, o, i, z + 0.5, z + TW).sil, crease: open(ringAt(P, run(i, (q) => q.nv > -0.5), z + TW)) };
}

/** Drawer c·r's three cards, back to front, standing at the front of its tray by `grow` (0 to 1) as it opens, the front one leaning toward the eye the most. */
function cards(P, c, r, out, grow) {
  const g = growOf(out) * grow, fan = fanOf(out), x = xAt(c) + 2.2, rim = zAt(r) + TW;
  return [2, 1, 0].map((k) => {
    if (g === 0) return "";
    const yb = D + Math.max(0.8, out - 1.3 - SP * k), h = g * H * RISE[k], s = Math.sin(rad(LEAN[k] * fan)), co = Math.cos(rad(LEAN[k] * fan));
    return poly(fillet([[0, 0], [DW - 4.4, 0], [DW - 4.4, h], [0, h]], [0.2, 0.2, 1.2, 1.2]).map(([u, v]) => P(x + u, yb + v * s, rim + v * co)));
  });
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // The camera is fitted to the cabinet with any drawer fully out, so nothing leaves the frame in any pose.
  const C = Cam(45, 0.5, 2.5), yMax = D + OMAX + FT + PL;
  fit(C, [[0, 0, ZT], [X1, 0, 0], [X1, D, 0], [0, yMax, zAt(0)], [X1 - M, yMax, zAt(0)], [0, D + OMAX + 2.2, zAt(NR - 1) + TW + H]], 200, 166);
  const P = proj(C), seen = facing(C);
  const g = mk("g", {}, svg);

  // The plinth and the carcass never move.
  const [pr, pi] = rings(2.5, 2.5, X1 - 2.5, D - 2.5, 2, 1), [cr, ci] = rings(0, 0, X1, D, 3, 1.4);
  put(solid(g), prism(P, seen, pr, pi, 0, PH));
  put(solid(g), prism(P, seen, cr, ci, PH, ZT));

  // Each drawer, in paint order: its tray, then a group holding its cards, its front, the label frame and the pull.
  const cells = [];
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) {
    const rest = c * NR + r === REST ? OREST : 0, tr = solid(g), fr = mk("g", {}, g);
    const cardEls = [0, 1, 2].map(() => mk("path", {}, fr));
    const plate = solid(fr), label = mk("path", { class: "nf" }, fr), pull = solid(fr);
    cells.push({ c, r, rest, o: tween(rest), cg: tween(rest ? 1 : 0), tr, fr, cardEls, plate, label, pull, out: NaN, grow: NaN, lifted: false });
  }

  /** Paints a drawer's front group after the drawer above it while its cards are up, and back after its own tray once they are down. */
  function place(cl, up) {
    if (up === cl.lifted || cl.r === NR - 1) return;
    cl.lifted = up;
    if (up) cells[cl.c * NR + cl.r + 1].fr.after(cl.fr);
    else cl.tr.g.after(cl.fr);
  }

  function drawCell(cl, out, grow) {
    if (out === cl.out && grow === cl.grow) return;
    if (out !== cl.out) {
      const f = drawerFront(P, cl.c, cl.r, D + out);
      put(cl.tr, tray(P, seen, cl.c, cl.r, out)); put(cl.plate, f.plate); put(cl.pull, f.pull);
      cl.label.setAttribute("d", f.label);
    }
    cl.out = out; cl.grow = grow;
    cards(P, cl.c, cl.r, out, grow).forEach((d, k) => cl.cardEls[k].setAttribute("d", d));
  }

  let act = -1;
  function frame(now) {
    let moving = false, n = 0;
    for (const cl of cells) {
      if (!tdone(cl.o, now) || !tdone(cl.cg, now)) moving = true;
      const out = tval(cl.o, now), grow = tval(cl.cg, now);
      drawCell(cl, out, grow);
      place(cl, grow > 0);
      if (out > 1) n++;
    }
    if (act >= 0) read.textContent = `drawer ${cells[act].c + 1}·${NR - cells[act].r} · ${n} open`;
    return moving;
  }
  const L = register(stage, (_dt, now) => frame(now));
  bag.add(L.unregister);

  // Hit areas, read once from the rest pose: the cabinet with the part-open drawer, and that drawer alone.
  // Elsewhere inside, the pointer is carried onto the plane of the face and picks the grid cell it lands in.
  const rc = cells[REST], slotAt = (y) => rrect(xAt(rc.c), zAt(rc.r), xAt(rc.c) + DW, zAt(rc.r) + FH, 0.9, 2).map((q) => P(q.u, y, q.v));
  const restDrawer = hull(slotAt(D).concat(slotAt(D + OREST + FT + PL))), restHull = hull(ringAt(P, cr, 0).concat(ringAt(P, cr, ZT), restDrawer));
  function inside(ring, [x, y]) {
    let ok = false;
    for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
      const [xa, ya] = ring[a], [xb, yb] = ring[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }
  const O = P(0, D, 0), ex = P(1, D, 0), ez = P(0, D, 1);
  const ax = [ex[0] - O[0], ex[1] - O[1]], az = [ez[0] - O[0], ez[1] - O[1]], det = ax[0] * az[1] - ax[1] * az[0];
  function pick(pt) {
    if (!inside(restHull, pt)) return -1;
    if (inside(restDrawer, pt)) return REST;
    const qx = pt[0] - O[0], qy = pt[1] - O[1], wx = (qx * az[1] - qy * az[0]) / det, wz = (ax[0] * qy - ax[1] * qx) / det;
    return clamp(Math.floor((wx - M + G / 2) / (DW + G)), 0, NC - 1) * NR + clamp(Math.floor((wz - PH - M + G / 2) / (FH + G)), 0, NR - 1);
  }

  // One bright outline: the part-open drawer's front at rest, the picked drawer's once the pointer chooses.
  const hiOn = (a) => cells.forEach((cl, i) => cl.plate.sil.classList.toggle("hi", i === (a < 0 ? REST : a)));
  /** Opens the cabinet in a wave from drawer a; -1 sends every drawer home from the far end back toward the last one. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), f = cells[a >= 0 ? a : act], lead = a >= 0 ? a : REST;
    const d = cells.map((cl) => Math.hypot(cl.c - f.c, cl.r - f.r)), far = Math.max(...d);
    cells.forEach((cl, i) => {
      const delay = (a >= 0 ? d[i] : far - d[i]) * stag;
      tset(cl.o, a >= 0 ? wave(d[i]) : cl.rest, now, delay);
      tset(cl.cg, i === lead ? 1 : 0, now, delay);
    });
    act = a;
    hiOn(a);
    if (a < 0) read.textContent = "rest";
    L.wake();
  }

  read.textContent = "rest";
  hiOn(-1);
  frame(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(pick(pt)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "archive",
  means: "A card catalogue for an archive of 197,577 badges: point at it to browse, and its drawers slide open in a wave from the pointer.",
  rules: [1, 2, 3, 5, 6],
  range: [25, 45, 65],
  mount,
});
