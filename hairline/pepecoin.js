/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Purse: a kiss-lock coin purse sitting on the desk, a soft pouch under a
 * metal frame of two arched jaws, each jaw topped with a ball clasp on a
 * short stem. At rest the clasp stands open, the jaws leaning apart over an
 * open mouth, and a few coins lie on the desk beside it, one on top of
 * another; that top coin is the bright mark. Pointing at the desk sends the
 * coins hopping in through the mouth one by one, the nearest first, and the
 * pouch swells a little as it fills; once the last is in, the jaws swing
 * together and the balls pass each other and lock, and the shut clasp takes
 * the bright mark. Leaving opens the clasp and the coins hop back out to the
 * desk, the last in first. The read-out counts the coins in, then says
 * `shut`. The slider is the stagger, in ms.
 *
 * The pattern: discrete items, as Badges. One 700ms tween per coin along a
 * lift, cross and drop path, staggered by rank from the pointer, and one for
 * the clasp, which follows the coins, never a clock: shut only when every
 * coin is in, open whenever one is on its way. The pouch is the hull of a few
 * rounded sections and both jaws, so it follows the clasp and the swell. The
 * hit test is the outline of the rest desk, read once.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, rad, ringAt, rrect,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const FW = 22, ZH = 25, A = 10, ST = 3.2, BR = 3, OPEN = 46, SHUT = 0;
const CR = 5.5, CT = 1.6, HTOP = ZH + A + 14, MZ = ZH - 2, LIP = ZH + 6;
// the coins on the desk, in the purse's own frame: x along the clasp, y toward the eye
const DESK = [[-15, 22, 0], [2, 28, 0], [18, 21, 0], [29, 11, 0], [19.5, 19.5, CT]];
const N = DESK.length, TOPI = 4;
const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const at = (ring, x, y) => ring.map((q) => ({ ...q, u: q.u + x, v: q.v + y }));
// the jaw's arch: height above the hinge at x, flat on top and steep at the ends
const arch = (x) => A * Math.sqrt(Math.max(0, 1 - (Math.abs(x) / FW) ** 4));
const XS = Array.from({ length: 25 }, (_, k) => -FW + (2 * FW * k) / 24);

/** A coin's place at progress s from the desk (s 0) into the mouth (s 1): lift, cross, drop. */
function path(c, s) {
  const mv = ss((s - 0.15) / 0.55), z = lerp(c.z0, HTOP, ss(s / 0.3)) - (HTOP - MZ) * ss((s - 0.72) / 0.28);
  return [lerp(c.x, 0, mv), lerp(c.y, 0, mv), z, mv];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // The purse is turned 45 degrees to face the eye: its own x runs level across the screen, its y toward the viewer.
  const C = Cam(45, 0.5, 3.7), R2 = Math.SQRT1_2, toW = ([a, b, z]) => [(a + b) * R2, (b - a) * R2, z];
  const pts = [[-FW - 3, -16, 0], [FW + 3, 16, 0], [-FW - 3, 16, 0], [FW + 3, -16, 0], [0, 0, ZH + A + ST + 2 * BR], [0, -14, ZH + A]];
  DESK.forEach(([x, y]) => pts.push([x - CR, y - CR, 0], [x + CR, y + CR, 0], [lerp(x, 0, 0.3), lerp(y, 0, 0.3), HTOP + CT]));
  fit(C, pts.map(toW), 200, 166);
  const PW = proj(C), fw = facing(C), P = (a, b, z) => PW(...toW([a, b, z]));
  const front = (q) => fw({ ...q, nu: (q.nu + q.nv) * R2, nv: (q.nv - q.nu) * R2 });

  /** A point on a jaw: x along it, h above the hinge, the jaw leaning by deg toward +y (side 1) or -y (side -1). */
  const jaw = (x, h, deg, side, dy = 0) => P(x, side * h * Math.sin(rad(deg)) + dy, ZH + h * Math.cos(rad(deg)));
  const jawLine = (deg, side, dh = 0) => XS.map((x) => jaw(x, Math.max(0, arch(x) - dh), deg, side));
  /** A ball: a circle round its centre, the radius it has across the screen. */
  const ball = ([x, y, z]) => { const [cx, cy] = P(x, y, z), r = P(x + BR, y, z)[0] - cx; return poly(circ(r, 28).map((q) => [cx + q.u, cy + q.v])); };
  const ballAt = (deg, side) => {
    const h = A + ST, lean = deg > 4 ? 0 : side * 0.9;
    return [-side * 1.7, side * h * Math.sin(rad(deg)) + lean, ZH + h * Math.cos(rad(deg))];
  };

  const g = mk("g", {}, svg);
  const body = solid(g), backJaw = mk("path", { class: "nf" }, g), mouth = mk("path", { class: "lo" }, g);
  const innerG = mk("g", {}, g);
  const frontJaw = mk("path", { class: "nf sil" }, g), frontLip = mk("path", { class: "nf lo" }, g);
  const stems = mk("path", { class: "nf" }, g), backBall = mk("path", { class: "sil" }, g), frontBall = mk("path", { class: "sil" }, g);
  const outerG = mk("g", {}, g);

  /** The pouch for clasp angle deg and fill f (0 to 1): sections from the desk up to the hinge, closed over by both jaws. */
  function drawPurse(deg, f) {
    // a rounded bottom (a quarter turn up from the desk to the belly), then a taper up to the hinge
    const T = lerp(9, 12, f), wB = FW + 1 + 1.5 * f, sec = [0, 22, 45, 68, 90].map((d) => [ZH * 0.32 * (1 - Math.cos(rad(d))), wB - 8 + 8 * Math.sin(rad(d)), T * (0.6 + 0.4 * Math.sin(rad(d)))]);
    sec.push([ZH * 0.62, FW + 0.4, T * 0.8], [ZH * 0.9, FW, T * 0.4]);
    const ring = sec.flatMap(([z, w, t]) => ringAt(P, rrect(-w, -t, w, t, Math.min(w, t) * 0.95, 4), z));
    const fj = jawLine(deg, 1), bj = jawLine(deg, -1);
    put(body, { sil: poly(hull(ring.concat(fj, bj))), crease: "" });
    backJaw.setAttribute("d", open(bj));
    mouth.setAttribute("d", deg > 3 ? poly(fj.concat(bj.slice().reverse())) : "");
    frontJaw.setAttribute("d", open(fj));
    frontLip.setAttribute("d", open(jawLine(deg, 1, 1.4)));
    const fb = ballAt(deg, 1), bb = ballAt(deg, -1);
    stems.setAttribute("d", open([jaw(-1.7, A, deg, 1), P(...fb)]) + open([jaw(1.7, A, deg, -1), P(...bb)]));
    frontBall.setAttribute("d", ball(fb));
    backBall.setAttribute("d", ball(bb));
  }

  const ring0 = circ(CR, 28), inner0 = circ(CR - 1, 28);
  const coins = DESK.map(([x, y, z0], i) => {
    const el = solid(g), art = ["nf lo", "lo", "nf lo", "dot m"].map((cls) => mk("path", { class: cls }, el.g));
    return { i, x, y, z0, el, art, s: tween(0), goal: 0, rank: i, drawn: NaN, mv: 0, pz: z0 };
  });
  /** A plain frog glyph on a coin's top face, its head toward the far edge: a wide head, two eye bumps on its brow, pupils, a smile. */
  function frog(x, y, z) {
    const p = (u, v) => P(x + u, y + v, z), eyes = (r) => [-1.75, 1.75].map((u) => poly(circ(r, 16).map((q) => p(u + q.u, -1.4 + q.v)))).join("");
    const smile = [-2.4, -1.2, 0, 1.2, 2.4].map((u) => p(u, 0.9 + 0.9 * (1 - (u / 2.4) ** 2)));
    return [poly(rrect(-3.5, -1.3, 3.5, 2.9, 1.9, 3).map((q) => p(q.u, q.v))), eyes(1.2), open(smile), eyes(0.42)];
  }
  const go = (c, to, now, delay) => { c.goal = to; tset(c.s, to, now, delay); };
  const clasp = tween(OPEN);
  let act = false, ret = false, last = "", lastF = NaN;

  function draw(now) {
    const all1 = coins.every((c) => c.goal === 1 && tdone(c.s, now)), all0 = coins.every((c) => c.goal === 0 && tdone(c.s, now));
    tset(clasp, act && all1 ? SHUT : OPEN, now, 0);
    const deg = tval(clasp, now);
    let moving = !tdone(clasp, now), n = 0, f = 0;
    // Going home waits for the clasp to stand open, so no coin rises through closed jaws.
    if (ret && deg >= OPEN - 4) { ret = false; moving = true; coins.forEach((c) => go(c, 0, now, (N - 1 - c.rank) * stag)); }
    for (const c of coins) {
      const s = tval(c.s, now);
      if (!tdone(c.s, now)) moving = true;
      if (s > 0.97) n++;
      f += ss((s - 0.85) / 0.15) / N;
      if (s === c.drawn) continue;
      c.drawn = s;
      let x, y;
      [x, y, c.pz, c.mv] = path(c, s);
      // past the front lip a coin is inside the purse, out of sight
      const gone = s > 0.97 || (c.mv > 0.95 && c.pz < LIP), art = gone ? ["", "", "", ""] : frog(x, y, c.pz + CT);
      put(c.el, gone ? { sil: "", crease: "" } : prism(P, front, at(ring0, x, y), at(inner0, x, y), c.pz, c.pz + CT));
      c.art.forEach((el, k) => el.setAttribute("d", art[k]));
    }
    const key = `${deg}|${f}`;
    if (key !== `${last}|${lastF}`) { last = deg; lastF = f; drawPurse(deg, f); }
    // Paint order: a coin over the mouth goes behind the front jaw, one still out over the desk in front of the purse.
    const inner = coins.filter((c) => c.mv > 0.6).sort((p, q) => p.pz - q.pz);
    const outer = coins.filter((c) => c.mv <= 0.6).sort((p, q) => p.y + p.pz - q.y - q.pz);
    inner.forEach((c) => innerG.append(c.el.g));
    outer.forEach((c) => outerG.append(c.el.g));
    const shut = act && all1 && tdone(clasp, now);
    [frontJaw, frontBall, backBall].forEach((el) => el.classList.toggle("hi", shut));
    if (act) read.textContent = shut ? "shut" : `${n} in`;
    else read.textContent = "rest";
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  // Hit area: the outline of the rest desk and the open purse, read once and never moved.
  const restHull = hull(coins.flatMap((c) => ringAt(P, at(circ(CR + 6, 12), c.x, c.y), 0))
    .concat(ringAt(P, rrect(-FW - 2, -12, FW + 2, 12, 8, 2), 0), jawLine(OPEN, 1), jawLine(OPEN, -1)));
  const scr = coins.map((c) => P(c.x, c.y, 0));
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }

  const hiCoin = (on) => coins.forEach((c) => c.el.sil.classList.toggle("hi", on && c.i === TOPI));
  /** Fills the purse from the pointer outwards; leaving empties it, the last coin in first out. */
  function setActive(on, pt) {
    if (on === act) return;
    const now = performance.now();
    act = on;
    if (on) {
      // Ranks only change while every coin is home, so the order out is the order in, reversed.
      if (coins.every((c) => c.goal === 0 && tdone(c.s, now))) {
        const d = coins.map((c, i) => Math.hypot(scr[i][0] - pt[0], scr[i][1] - pt[1]) - 8 * c.z0);
        coins.slice().sort((p, q) => d[p.i] - d[q.i]).forEach((c, k) => { c.rank = k; });
      }
      ret = false;
      coins.forEach((c) => go(c, 1, now, 120 + c.rank * stag));
    } else {
      ret = true; // draw() sends them home once the clasp stands open
    }
    hiCoin(!on);
    L.wake();
  }

  hiCoin(true);
  read.textContent = "rest";
  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt), pt), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "pepecoin",
  means: "A kiss-lock coin purse standing open beside a few coins: point at the desk and they hop in, then the clasp snaps shut.",
  rules: [1, 2, 4, 5, 6],
  range: [70, 110, 150],
  mount,
});
