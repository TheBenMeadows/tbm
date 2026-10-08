/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Badges: round badges scattered on the desk beside an open archive box with
 * its lid ajar. Pointing at the desk swings the lid back and the badges lift,
 * cross over and drop into the box, the nearest first, stacking as they land;
 * once the last one lands the lid swings shut. Leaving opens it, the badges go
 * back to the desk top of the stack first, and the lid settles ajar again.
 * The read-out counts what the box holds. The slider is the stagger, in ms.
 *
 * The pattern: discrete items. One 700ms tween per badge along a lift, cross
 * and drop path; the stagger is the badge's rank by distance from the pointer,
 * and that rank is also its place in the stack. The hit test is the outline
 * of the REST desk, read once, so nothing in flight can change the choice.
 * The lid follows the stack, never a clock: shut only when every badge has
 * landed, open whenever one is in flight or about to be, ajar once all are home.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, rad, ringAt, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const BR = 9, BT = 2.4, NS = 32;
// the desk, by hand: where each badge lies at rest
const DESK = [[-46, 26, 0], [-18, 2, 0], [-12, 30, 0], [-6, 36, BT], [14, 16, 0], [-36, 56, 0], [8, 52, 0], [-8, 80, 0], [28, 70, 0], [30, 44, 0]];
const N = DESK.length;
const X0 = 46, X1 = 110, Y0 = -16, Y1 = 34, HB = 27, WT = 2.6, WR = 5;
const HTOP = HB + 13, AJAR = 30, OPEN = 106, SHUT = 0, RISE = 80, LT = 1.8;
// where each place in the stack sits inside the box: a slightly untidy column
const SLOT = (k) => [lerp(X0, X1, 0.5) + 2.4 * Math.sin(k * 2.1), lerp(Y0, Y1, 0.6) + 2.2 * Math.cos(k * 1.7), 0.8 + k * BT];

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));

/** A badge's place at progress s on its way from the desk (s 0) to its slot (s 1): lift, cross, drop. */
function path(b, s) {
  const [sx, sy, sz] = b.slot, mv = ss((s - 0.18) / 0.55);
  const z = lerp(b.z0, HTOP, ss(s / 0.3)) - (HTOP - sz) * ss((s - 0.72) / 0.28);
  return [lerp(b.x, sx, mv), lerp(b.y, sy, mv), z];
}

/** The open box, which never moves: `far` is painted behind what it holds, `near` in front. */
function box(P, front) {
  const outer = rrect(X0, Y0, X1, Y1, WR, 6), inner = rrect(X0 + WT, Y0 + WT, X1 - WT, Y1 - WT, WR - WT, 6);
  const LR = (pts) => (pts[0][0] <= pts[pts.length - 1][0] ? pts : pts.slice().reverse());
  const far = [
    [poly(hull(ringAt(P, outer, 0).concat(ringAt(P, outer, HB)))), "sil"],
    [poly(ringAt(P, inner, HB)), "nf"],
    [open(ringAt(P, run(inner, (q) => !front(q)), 1)), "nf lo"],
  ];
  const iF = LR(ringAt(P, run(inner, front), HB)), oT = LR(ringAt(P, run(outer, front), HB)), oB = LR(ringAt(P, run(outer, front), 0));
  // a hand hole cut into the side that faces the desk
  const hx = (X0 + X1) / 2, onSide = (ring) => ring.map((q) => P(q.u, Y1, q.v));
  const near = [
    [poly([...iF, oT[oT.length - 1], ...oB.slice().reverse(), oT[0]]), "fo"],
    [open(oT), "nf lo"],
    [open(iF), "nf"],
    [open([oT[0], ...oB, oT[oT.length - 1]]), "nf sil"],
    [poly(onSide(rrect(hx - 10, 15, hx + 10, 21, 3, 5))), "nf lo"],
  ];
  return { far, near };
}

/** The lid, hinged on the box's far top edge and opened by deg: a thin plate, its crease on whichever face the camera sees. */
function lid(P, deg, inSeen) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a), D = Y1 - Y0;
  const w = (u, v, t) => P(u, Y0 + v * c - t * s, HB + v * s + t * c);
  const o = rrect(X0, 0, X1, D, WR, 6), i = rrect(X0 + 2, 2, X1 - 2, D - 2, WR - 2, 6);
  return {
    sil: poly(hull(o.map((q) => w(q.u, q.v, 0)).concat(o.map((q) => w(q.u, q.v, LT))))),
    crease: poly(i.map((q) => w(q.u, q.v, inSeen ? 0 : LT))),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.85);
  const pts = [[X0, Y0, 0], [X1, Y1, 0], [X1, Y0, 0], [X0, Y1, 0], [X0, Y0 - 14, HB + Y1 - Y0], [X1, Y0 + 14, HB + Y1 - Y0]];
  DESK.forEach(([x, y]) => pts.push([x - BR, y - BR, 0], [x + BR, y + BR, HTOP + BT]));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const paths = box(P, front);
  const farG = mk("g", {}, g), lidS = solid(g), nearG = mk("g", {}, g);
  const boxSil = [];
  for (const [d, cls] of paths.far) boxSil.push(mk("path", { d, class: cls }, farG));
  for (const [d, cls] of paths.near) boxSil.push(mk("path", { d, class: cls }, nearG));
  const marks = boxSil.filter((el) => el.classList.contains("sil"));

  const ring0 = circ(BR, NS), inner0 = circ(BR - 1.2, NS), art0 = circ(BR - 3.6, NS);
  const badges = DESK.map(([x, y, z0], i) => {
    const el = solid(g);
    return { i, x, y, z0, el, art: mk("path", { class: "nf lo" }, el.g), s: tween(0), goal: 0, drawn: NaN, slot: SLOT(i), rank: i };
  });
  const go = (b, to, now, delay) => { b.goal = to; tset(b.s, to, now, delay); };
  const lidT = tween(AJAR), all = [farG, lidS.g, nearG, ...badges.map((b) => b.el.g)];
  let lidDrawn = NaN, order = "", act = -1, ret = false;
  // The lid's inner face is toward the camera past about 39 degrees; below that the lid covers what the box holds.
  const zf = Math.sqrt(1 - C.k * C.k), inSeen = (deg) => Math.cos(C.az) * zf * Math.sin(rad(deg)) - C.k * Math.cos(rad(deg)) > 0;

  // Hit area: the outline of the rest desk and the box, read once and never moved.
  const restHull = hull(badges.flatMap((b) => ringAt(P, at(circ(BR + 8, 12), b.x, b.y), 0))
    .concat(ringAt(P, rrect(X0, Y0, X1, Y1, WR, 2), 0), ringAt(P, rrect(X0, Y0, X1, Y1, WR, 2), HB)));
  const scr = badges.map((b) => P(b.x, b.y, 0));
  /** Whether a screen point is inside the rest outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }
  const inBox = (x, y) => x > X0 + WT + BR - 1 && x < X1 - WT - BR + 1 && y > Y0 + WT + BR - 1 && y < Y1 - WT - BR + 1;

  function draw(now) {
    const all1 = badges.every((b) => b.goal === 1 && tdone(b.s, now)), all0 = badges.every((b) => b.goal === 0 && tdone(b.s, now));
    tset(lidT, act >= 0 ? (all1 ? SHUT : OPEN) : all0 && !ret ? AJAR : OPEN, now, 0);
    const deg = tval(lidT, now), seen = inSeen(deg);
    let moving = !tdone(lidT, now), held = 0;
    // Going home waits for the lid to stand clear, so no badge rises into a lid still swinging open.
    if (ret && deg >= RISE) { ret = false; moving = true; badges.forEach((b) => go(b, 0, now, (N - 1 - b.rank) * stag)); }
    if (deg !== lidDrawn) { lidDrawn = deg; put(lidS, lid(P, deg, seen)); }
    lidS.sil.classList.toggle("hi", act >= 0 && all1 && tdone(lidT, now));
    for (const b of badges) {
      const s = tval(b.s, now);
      if (!tdone(b.s, now)) moving = true;
      if (s > 0.97) held++;
      if (s === b.drawn) continue;
      b.drawn = s;
      [b.px, b.py, b.pz] = path(b, s);
      const ring = at(ring0, b.px, b.py);
      put(b.el, prism(P, front, ring, at(inner0, b.px, b.py), b.pz, b.pz + BT));
      b.art.setAttribute("d", poly(ringAt(P, at(art0, b.px, b.py), b.pz + BT)));
    }
    // Paint order: the box's far half (behind it the lid, once past upright), the lid while it leans back
    // over the box, what the box holds, the box's near half, the lid once it covers the box, the badges
    // on the desk by depth, then the ones in the air.
    const held_ = [], desk = [], air = [];
    for (const b of badges) (b.pz >= HB ? air : inBox(b.px, b.py) ? held_ : desk).push(b);
    held_.sort((p, q) => p.pz - q.pz); desk.sort((p, q) => p.px + p.py - q.px - q.py); air.sort((p, q) => p.pz - q.pz);
    const seq = deg >= 90 ? [lidS.g, farG] : seen ? [farG, lidS.g] : [farG];
    seq.push(...held_.map((b) => b.el.g), nearG, ...(seen || deg >= 90 ? [] : [lidS.g]), ...desk.map((b) => b.el.g), ...air.map((b) => b.el.g));
    const key = seq.map((e) => all.indexOf(e)).join();
    if (key !== order) { order = key; for (const e of seq) g.append(e); }
    if (act >= 0) read.textContent = `${held} saved`;
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  // At rest the badge on top of the little pile is bright; once saving starts the box takes it.
  const TOPI = DESK.findIndex((d) => d[2] > 0);
  const hiOn = (on) => { marks.forEach((m) => m.classList.toggle("hi", on)); badges.forEach((b) => b.el.sil.classList.toggle("hi", !on && b.i === TOPI)); };
  /** Saves the desk into the box from the pointer outwards (-1 empties it again, the top of the stack first). */
  function setActive(on, pt) {
    if (on === act >= 0) return;
    const now = performance.now();
    if (on) {
      // Ranks only change while the stack is empty, so a badge never lands under one already there.
      if (badges.every((b) => b.goal === 0 && tdone(b.s, now) && tval(b.s, now) === 0)) {
        const d = badges.map((b, i) => Math.hypot(scr[i][0] - pt[0], scr[i][1] - pt[1]) - 8 * b.z0); // a badge leaves before the one it lies on
        badges.slice().sort((p, q) => d[p.i] - d[q.i]).forEach((b, k) => { b.rank = k; b.slot = SLOT(k); });
      }
      act = badges.find((b) => b.rank === 0).i;
      ret = false;
      badges.forEach((b) => go(b, 1, now, 120 + b.rank * stag));
      hiOn(true);
    } else {
      act = -1;
      ret = true; // draw() sends them home once the lid stands clear
      hiOn(false);
      read.textContent = "rest";
    }
    L.wake();
  }

  hiOn(false);
  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt), pt), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "badges",
  means: "Round badges scattered beside an open box: point at the desk and they drop into the box one by one, nearest first.",
  rules: [1, 2, 5, 6, 10],
  range: [25, 45, 65],
  mount,
});
