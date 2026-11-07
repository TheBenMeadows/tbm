/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * FreeWallet: a bifold wallet lying open on the desk, its back leaf laid back
 * almost flat; its front leaf holds three stepped card pockets and a coin pouch.
 * Against its near edge lie one asset card, square to it, and a coin, the bright
 * mark. Pointing at the figure slides them into the wallet, nearest first: each
 * lifts, crosses to the mouth of its pocket and slides in until only its edge
 * shows; once both are in, the back leaf folds all the way over and the shut
 * wallet takes the bright mark. Leaving opens it back out flat, then takes
 * them out, the last one in first. The read-out counts what it holds.
 *
 * The pattern: discrete items, as Badges. One 700ms tween per item along a
 * lift, cross, drop and slide path, staggered by rank from the pointer. Pocket
 * faces are opaque plates painted over the card they hold, so a card going in
 * is covered by its pocket and never clipped. The hit test is the outline of
 * the REST desk and wallet, read once.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, rad, ringAt, rings, rrect, run,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

const WX = 70, WY = 90, BD = WY, LT = 2.4, WR = 6, FT = 0.9, SZ = LT, HT = LT + 14;
const OPEN = 170, SHUT = 0, CW = 17, CH = 27, CR = 10, CT = 2.2;
const MOUTH = [60, 52, 44], PY0 = 4, PY1 = 62, CY = (PY0 + PY1) / 2, PO = 5, D = 30;
const COIN = { mouth: 46, y0: 64, y1: 88 };
// the desk, by hand: one card laid square against the wallet's near edge, the coin beside it
const DESK = [
  { card: true, x: WX + CW + 1, y: 30, rot: 0, z0: 0 },
  { card: false, x: WX + CR + 1, y: 74, rot: 0, z0: 0 },
];
const N = DESK.length;

const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const tr = (ring, deg, x, y) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return ring.map((q) => ({ u: x + q.u * c - q.v * s, v: y + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

/** An item's place at progress s from the desk (0) into its pocket (1): lift, cross to the mouth, drop, slide in. */
function path(it, s) {
  const mv = ss((s - 0.12) / 0.46), sl = ss((s - 0.7) / 0.3);
  const z = lerp(it.z0, HT, ss(s / 0.3)) - (HT - SZ) * ss((s - 0.5) / 0.2);
  return [lerp(lerp(it.x, it.fx + it.d, mv), it.fx, sl), lerp(it.y, it.fy, mv), z, it.rot * (1 - mv)];
}

/** The back leaf, hinged on the far edge and opened by deg: a thin plate, its crease on the face the camera sees. */
function leaf(P, deg, inSeen) {
  const a = rad(deg), c = Math.cos(a), s = Math.sin(a);
  const w = (u, v, t) => P(u, v * c - t * s, LT + v * s + t * c), t0 = inSeen ? 0 : LT;
  const o = rrect(0, 0, WX, BD, WR, 6), i = rrect(1.4, 1.4, WX - 1.4, BD - 1.4, WR - 1.4, 6);
  return {
    sil: poly(hull(o.map((q) => w(q.u, q.v, 0)).concat(o.map((q) => w(q.u, q.v, LT))))),
    crease: poly(i.map((q) => w(q.u, q.v, t0))),
    out: o.map((q) => w(q.u, q.v, 0)),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.5);
  const pts = [[0, 0, 0], [WX, WY, 0], [WX, 0, 0], [0, WY, 0], [WX + D + 5, PY0, HT]];
  for (const a of [OPEN, SHUT]) pts.push([0, BD * Math.cos(rad(a)), LT + BD * Math.sin(rad(a))], [WX, BD * Math.cos(rad(a)), LT + BD * Math.sin(rad(a))]);
  DESK.forEach((d) => pts.push([d.x - CW, d.y - CH, 0], [d.x + CW, d.y + CH, 0]));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const back = solid(g), base = solid(g);
  put(base, prism(P, front, ...rings(0, 0, WX, WY, WR, 1.4), 0, LT));
  // the pockets: one opaque face each, open toward the viewer; a coin pouch beside them
  const faces = MOUTH.map((m) => { const f = solid(g); put(f, { sil: prism(P, front, ...rings(3, PY0, m, PY1, 3, 1), SZ, SZ + FT).sil, crease: "" }); return f; });
  const pouch = solid(g);
  put(pouch, { sil: prism(P, front, ...rings(3, COIN.y0, COIN.mouth, COIN.y1, 4, 1), SZ, SZ + FT).sil, crease: "" });

  const card0 = rrect(-CW, -CH, CW, CH, 3, 4), card1 = rrect(-CW + 1, -CH + 1, CW - 1, CH - 1, 2, 4), chip = rrect(-11, -18, -4, -11, 1.2, 3);
  const coin0 = circ(CR, 32), coin1 = circ(CR - 1.2, 32), coinArt = circ(CR - 3.4, 32);
  let k = 0;
  const items = DESK.map((d, i) => {
    const el = solid(g), art = mk("path", { class: "nf lo" }, el.g);
    return { ...d, i, el, art, s: tween(0), drawn: NaN, rank: i, lane: d.card ? k++ : -1 };
  });
  /** Gives the item its pocket: cards by arrival order, the coin its pouch. */
  const home = (it) => {
    if (it.card) Object.assign(it, { fx: MOUTH[it.lane] + PO - CW, fy: CY, d: D });
    else Object.assign(it, { fx: COIN.mouth + 2, fy: (COIN.y0 + COIN.y1) / 2, d: 22 });
  };
  items.forEach(home);
  const backT = tween(OPEN);
  const all = [back.g, base.g, ...faces.map((f) => f.g), pouch.g, ...items.map((it) => it.el.g)];
  let backDrawn = NaN, order = "", act = false, ret = false;
  const zf = Math.sqrt(1 - C.k * C.k), inSeen = (deg) => Math.cos(C.az) * zf * Math.sin(rad(deg)) - C.k * Math.cos(rad(deg)) > 0;

  // Hit area: the outline of the rest desk and the open wallet, read once and never moved.
  const restHull = hull(items.flatMap((it) => ringAt(P, tr(rrect(-CW - 6, -CH - 6, CW + 6, CH + 6, 6, 2), it.rot, it.x, it.y), 0))
    .concat(ringAt(P, rrect(0, 0, WX, WY, WR, 2), 0), leaf(P, OPEN, true).out));
  const scr = items.map((it) => P(it.x, it.y, it.z0));
  /** Whether a screen point is inside the rest outline. */
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, b = restHull.length - 1; a < restHull.length; b = a++) {
      const [xa, ya] = restHull[a], [xb, yb] = restHull[b];
      if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) ok = !ok;
    }
    return ok;
  }

  function draw(now) {
    const full = items.every((it) => tval(it.s, now) === 1);
    tset(backT, act && full ? SHUT : OPEN, now, 0);
    const deg = tval(backT, now);
    let moving = !tdone(backT, now), held = 0;
    // Emptying waits for the wallet to lie open again, so nothing comes out through a shut leaf.
    if (ret && deg >= OPEN - 30) { ret = false; moving = true; items.forEach((it) => tset(it.s, 0, now, (N - 1 - it.rank) * stag)); }
    const shut = act && deg === SHUT && !moving;
    back.sil.classList.toggle("hi", shut); base.sil.classList.toggle("hi", shut);
    items.forEach((it) => it.el.sil.classList.toggle("hi", !act && !it.card));
    if (deg !== backDrawn) {
      backDrawn = deg;
      put(back, leaf(P, deg, inSeen(deg)));
    }
    for (const it of items) {
      const s = tval(it.s, now);
      if (!tdone(it.s, now)) moving = true;
      if (s > 0.97) held++;
      if (s === it.drawn) continue;
      it.drawn = s;
      const [x, y, z, rot] = path(it, s);
      it.pz = z;
      if (it.card) {
        put(it.el, { sil: prism(P, front, tr(card0, rot, x, y), tr(card1, rot, x, y), z, z + FT).sil, crease: "" });
        it.art.setAttribute("d", poly(ringAt(P, tr(chip, rot, x, y), z + FT)));
      } else {
        put(it.el, prism(P, front, tr(coin0, 0, x, y), tr(coin1, 0, x, y), z, z + CT));
        it.art.setAttribute("d", poly(ringAt(P, tr(coinArt, 0, x, y), z + CT)));
      }
    }
    // Paint order: the back leaf while it leans back, the front leaf, each pocket after the card sliding into it,
    // the coin then its pouch, the back leaf once it is over the front, what lies on the desk, then the air.
    const desk = [], air = [], st = (it) => tval(it.s, now);
    for (const it of items) (st(it) === 0 ? desk : st(it) >= 0.7 ? null : air)?.push(it);
    desk.sort((p, q) => p.z0 - q.z0 || p.x + p.y - q.x - q.y); air.sort((p, q) => p.pz - q.pz);
    const inLane = (j) => items.filter((it) => it.lane === j && st(it) >= 0.7).map((it) => it.el.g);
    const coin = items.find((it) => !it.card);
    const over = deg < 90, seq = over ? [base.g] : [back.g, base.g];
    faces.forEach((f, j) => seq.push(...inLane(j), f.g));
    if (st(coin) >= 0.7) seq.push(coin.el.g);
    seq.push(pouch.g, ...(over ? [back.g] : []), ...desk.map((it) => it.el.g), ...air.map((it) => it.el.g));
    const key = seq.map((e) => all.indexOf(e)).join();
    if (key !== order) { order = key; for (const e of seq) g.append(e); }
    if (act) read.textContent = `${held} held`;
    return moving;
  }

  const L = register(stage, (_dt, now) => draw(now));
  bag.add(L.unregister);

  /** Fills the wallet from the pointer outwards; false empties it, the last one in first. */
  function setActive(on, pt) {
    if (on === act) return;
    const now = performance.now();
    act = on;
    if (on) {
      // Ranks only change while everything is on the desk, so a card never slides under one already in.
      if (items.every((it) => tdone(it.s, now) && tval(it.s, now) === 0)) {
        const d = items.map((it, i) => Math.hypot(scr[i][0] - pt[0], scr[i][1] - pt[1]) - 30 * it.z0);
        let lane = 0;
        items.slice().sort((p, q) => d[p.i] - d[q.i]).forEach((it, r) => { it.rank = r; if (it.card) it.lane = lane++; home(it); });
      }
      ret = false;
      items.forEach((it) => tset(it.s, 1, now, 80 + it.rank * stag));
    } else {
      ret = true; // draw() takes them out once the wallet lies open; the coin is bright at rest, the shut wallet when full
      read.textContent = "rest";
    }
    L.wake();
  }

  draw(performance.now());
  bag.add(pointer(stage, { move: (pt) => setActive(inside(pt), pt), leave: () => setActive(false) }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "freewallet",
  means: "A bifold wallet lying open beside a coin and an asset card: point at it and they slide into its pockets, nearest first.",
  rules: [1, 2, 5, 6, 10],
  range: [40, 60, 80],
  mount,
});
