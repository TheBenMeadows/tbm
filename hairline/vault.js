/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Vault: a row of round badges standing in the groove of a low rail, each
 * leaning back a little, each face blank but for a dashed ring where its
 * picture should be. A thin cable runs from each badge's top back to its own
 * socket on a dead server, a rack tower standing behind the row. Pointing at
 * the row cuts the cables and fills the faces in from the saved copies, in a
 * wave out from the badge under the pointer: each cable lets go and is pulled
 * back into its socket, then the dashed ring turns solid and a plain shape
 * (a star, a triangle, a square) grows out from the middle. Leaving puts the cables back and blanks the faces, the farthest
 * first. The read-out counts the restored faces. The slider is the stagger.
 *
 * The pattern: discrete items. One 700ms tween per badge carries both the
 * snap (its first third) and the face (the rest); the stagger is the badge's
 * distance in the row from the one under the pointer. The hit test is the
 * outline of the rest pose, read once, and the pick is the badge whose rest
 * centre is nearest the pointer's screen x.
 */
const {
  Cam, circ, clamp, facing, fit, hull, lerp, open, poly, prism, proj, rad, rings, rrect,
  tdone, tset, tval, tween, disposer, mk, pointer, put, register, solid,
} = HL;

// each badge: x along the rail, radius, lean back in degrees, which picture it had
const B = [[10, 11, 9, 0], [35, 9.5, 15, 1], [61, 12.5, 5, 2], [87, 10, 12, 0], [112, 11.5, 7, 1]];
const N = B.length, Y = 44, T = 2.4, RZ = 6, REST = 2;
const SX0 = 64, SX1 = 90, SY0 = -42, SY1 = -18, SH = 74; // the server: a tower
const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const ngon = (n, r, rot = 90) => Array.from({ length: n }, (_, k) => [r * Math.cos(rad(rot + (360 * k) / n)), r * Math.sin(rad(rot + (360 * k) / n))]);
const star = (r) => ngon(10, r).map(([u, v], k) => (k % 2 ? [u * 0.42, v * 0.42] : [u, v]));
// the pictures, as closed (1) or open (0) outlines in the face's own units, r its radius
const ART = [
  (r) => [[star(r * 0.95), 1]],
  (r) => [[ngon(3, r * 0.95), 1]],
  (r) => [[ngon(4, r * 0.95, 0), 1]],
];

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 2.1);
  const pts = [[SX0, SY0, 0], [SX1, SY1, 0], [SX0, SY1, SH], [SX1, SY0, SH], [-4, Y + 7, 0], [126, Y - 7, 0], [126, Y + 7, 0]];
  B.forEach(([x, r]) => pts.push([x, Y, RZ + 2 * r]));
  fit(C, pts, 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // The server: a tower of rack units, a socket for each cable near its top.
  const [sr, si] = rings(SX0, SY0, SX1, SY1, 3, 1.4);
  const server = solid(g);
  put(server, prism(P, front, sr, si, 0, SH));
  const face = (x, z) => P(x, SY1, z);
  [12, 24, 36, 48, 59].forEach((z) => mk("path", { class: "nf lo", d: open([face(SX0 + 2.5, z), face(SX1 - 2.5, z)]) }, g));
  const port = (i) => [SX0 + 3.5 + i * 4.75, SY1, SH - 7];
  B.forEach((_, i) => { const [x, , z] = port(i); mk("path", { class: "nf", d: poly(rrect(x - 1.6, z - 1.2, x + 1.6, z + 1.2, 0.6, 2).map((q) => face(q.u, q.v))) }, g); });

  const badges = B.map(([x, R, lean, art], i) => {
    const sa = Math.sin(rad(lean)), ca = Math.cos(rad(lean)), cz = RZ - 1 + R * ca;
    const w = (u, v, t) => P(x + u, Y - v * sa + t * ca, cz + v * ca + t * sa);
    const wire = mk("path", { class: "nf lo" }, g);
    return { i, x, R, art, w, wire, top: [x, Y - R * sa, cz + R * ca], s: tween(0), drawn: NaN };
  });

  // The rail they stand in: a low bar with a groove along its top.
  const [rr, ri] = rings(-4, Y - 7, 126, Y + 7, 3, 1.2);
  put(solid(g), prism(P, front, rr, ri, 0, RZ));
  mk("path", { class: "nf lo", d: open([P(-1, Y + 1.6, RZ), P(123, Y + 1.6, RZ)]) }, g);

  for (const b of badges) {
    const r = b.R - 3, el = solid(g), at = (pts2, t) => pts2.map(([u, v]) => b.w(u, v, t));
    const ring = circ(b.R, 36), inner = circ(b.R - 1.3, 36);
    put(el, {
      sil: poly(hull(at(ring.map((q) => [q.u, q.v]), 0).concat(at(ring.map((q) => [q.u, q.v]), T)))),
      crease: poly(at(inner.map((q) => [q.u, q.v]), T)),
    });
    b.el = el;
    b.blank = mk("path", { class: "nf dash", d: poly(at(ngon(36, r), T)) }, el.g);
    b.edge = mk("path", { class: "nf lo" }, el.g);
    b.pic = mk("path", { class: "nf" }, el.g);
    b.face = (k) => {
      if (k <= 0) return "";
      return ART[b.art](r * k).map(([p, closed]) => (closed ? poly : open)(at(p, T + 0.05))).join("");
    };
    b.ringD = poly(at(ngon(36, r), T));
  }

  /** A cable from socket S to the badge's top A, one gentle arc; cut by e, it lets go of the badge and is pulled back into its socket. */
  function cable(b, e) {
    if (e >= 1) return "";
    const S = port(b.i), A = b.top, run = [];
    for (let k = 0; k <= 12; k++) {
      const t = ((1 - e) * k) / 12;
      run.push(P(lerp(S[0], A[0], t), lerp(S[1], A[1], t), lerp(S[2], A[2], t) - 3 * 4 * t * (1 - t)));
    }
    return open(run);
  }

  let act = -1;
  function frame(now) {
    let moving = false, n = 0;
    for (const b of badges) {
      if (!tdone(b.s, now)) moving = true;
      const s = tval(b.s, now);
      if (s > 0.97) n++;
      if (s === b.drawn) continue;
      b.drawn = s;
      const e = ss(s / 0.3), k = ss((s - 0.3) / 0.7);
      b.wire.setAttribute("d", cable(b, e));
      b.blank.setAttribute("d", k > 0 ? "" : b.ringD);
      b.edge.setAttribute("d", k > 0 ? b.ringD : "");
      b.pic.setAttribute("d", b.face(k));
    }
    if (act >= 0) read.textContent = `${n} restored`;
    return moving;
  }
  const L = register(stage, (_dt, now) => frame(now));
  bag.add(L.unregister);

  // Hit area: the outline of the rest pose, read once; the pick is the badge whose rest centre is nearest in x.
  const restHull = hull(ringAt0(rr, 0).concat(ringAt0(rr, RZ), ringAt0(sr, SH), badges.flatMap((b) => ngon(12, b.R + 4).map(([u, v]) => b.w(u, v, 0)))));
  function ringAt0(ring, z) { return ring.map((q) => P(q.u, q.v, z)); }
  const cx = badges.map((b) => b.w(0, 0, 0)[0]);
  function inside([x, y]) {
    let ok = false;
    for (let a = 0, c = restHull.length - 1; a < restHull.length; c = a++) {
      const [xa, ya] = restHull[a], [xc, yc] = restHull[c];
      if ((ya > y) !== (yc > y) && x < ((xc - xa) * (y - ya)) / (yc - ya) + xa) ok = !ok;
    }
    return ok;
  }
  const pick = (pt) => (inside(pt) ? cx.reduce((best, x, i) => (Math.abs(x - pt[0]) < Math.abs(cx[best] - pt[0]) ? i : best), 0) : -1);

  // One bright rim: the biggest blank badge at rest, the badge under the pointer once it chooses.
  const hiOn = (a) => badges.forEach((b) => b.el.sil.classList.toggle("hi", b.i === (a < 0 ? REST : a)));
  /** Restores the row in a wave from badge a; -1 blanks it again from the far end back. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), f = a >= 0 ? a : act;
    const d = badges.map((b) => Math.abs(b.i - f)), far = Math.max(...d);
    // Moving between badges re-centres the wave only for those not yet on their way.
    badges.forEach((b, i) => tset(b.s, a >= 0 ? 1 : 0, now, (a >= 0 ? d[i] : far - d[i]) * stag));
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
  name: "vault",
  means: "Badges with blank faces, each tied to a dead server: point at them and the cables snap as each face fills in from a saved copy.",
  rules: [1, 2, 4, 5, 10],
  range: [25, 45, 65],
  mount,
});
