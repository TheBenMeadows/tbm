/* Drawn on the Hairline kernel (MIT, Lucas Marques, https://github.com/lucasmarkes/hairline). */
/**
 * Wall: a gallery wall, a slab on the floor with eight frames hung four
 * across and two high, each on a wire from a hook. At rest the hang is in
 * progress: the frames sit a few degrees crooked on their hooks, five hold
 * art and three show only a dashed outline where art will go, and the newest
 * piece is the bright mark. Pointing at the wall finishes the hang in a wave
 * out from the frame under the pointer: each frame swings level and its art
 * appears. Leaving takes the wall back, the farthest first. The read-out
 * names the frame and counts what is hung. The slider is the stagger, in ms.
 *
 * The pattern: discrete items. Two 700ms tweens per frame, its tilt and how
 * far its plate has grown; a stagger by grid distance; a hit test on the
 * wall's front plane at rest, which never moves.
 */
const {
  Cam, clamp, facing, fit, open, poly, prism, proj, rad, rings, rrect, tdone, tset, tval, tween,
  disposer, mk, place, pointer, put, reflect, register, solid,
} = HL;

const NC = 4, NR = 2, FW = 27, FH = 21, GAP = 8, M = 9, WT = 7, FD = 2.6, BW = 2.8, PI = 4.4, HK = 5;
const WW = 2 * M + NC * FW + (NC - 1) * GAP, ZH = 2 * M + NR * FH + (NR - 1) * GAP + HK + 3;
const HUNG = [0, 2, 3, 5, 6], NEWEST = 6;
const TILT = [-5, 4, -2, 6, 3, -4, 0, -6];
const ART = [[0, 4, 8], [2, 4, 6], [1, 3, 5, 7], [0, 2, 6, 8], [4], [1, 4, 7], [3, 4, 5], [0, 8]];

const ux = (c) => M + c * (FW + GAP), vz = (r) => M + r * (FH + GAP + HK);
const isHung = (i) => HUNG.includes(i);

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  const C = Cam(45, 0.5, 1.82);
  fit(C, [[0, 0, 0], [WW, 0, 0], [0, WT + FD, 0], [WW, WT + FD, 0], [0, 0, ZH], [WW, WT + FD, ZH]], 200, 170);
  const P = proj(C), front = facing(C);
  const w = (u, v, out) => P(u, WT + out, v);

  const [outer, inner] = rings(0, 0, WW, WT, 2.4, 1.2);
  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, outer, 0, 16);
  put(solid(g), prism(P, front, outer, inner, 0, ZH));

  const frames = [];
  for (let r = NR - 1; r >= 0; r--) {
    for (let c = 0; c < NC; c++) {
      const i = (NR - 1 - r) * NC + c; // numbered from the top left, the order they were hung
      const u0 = ux(c), v0 = vz(r);
      const fg = mk("g", {}, g);
      const hook = mk("circle", { r: 0.9, class: "dot off" }, fg);
      place(hook, w(u0 + FW / 2, v0 + FH + HK, 0.4));
      const el = {};
      for (const [k, cls] of [["wire", "nf lo"], ["back", "lo"], ["face", "sil"], ["lip", "nf"], ["slot", "nf dash"], ["plate", ""]]) {
        el[k] = mk("path", { class: cls }, fg);
      }
      el.dots = ART[i].map(() => mk("circle", { r: 0, class: "dot m" }, fg));
      const t0 = isHung(i) ? TILT[i] : TILT[i];
      frames.push({ i, c, r, u0, v0, el, a: tween(t0), f: tween(isHung(i) ? 1 : 0), last: "" });
    }
  }
  frames.sort((x, y) => x.i - y.i);

  /** Frame fr tilted th degrees on its hook, plate grown to t: every path. */
  function draw(fr, th, t) {
    const key = th.toFixed(3) + ":" + t.toFixed(3);
    if (key === fr.last) return;
    fr.last = key;
    const hu = fr.u0 + FW / 2, hv = fr.v0 + FH + HK, s = Math.sin(rad(th)), co = Math.cos(rad(th));
    const at = (u, v, out) => w(hu + (u - hu) * co - (v - hv) * s, hv + (u - hu) * s + (v - hv) * co, out);
    const ring = (u0, v0, u1, v1, r, out) => poly(rrect(u0, v0, u1, v1, r, 4).map((q) => at(q.u, q.v, out)));
    const { u0, v0 } = fr, u1 = u0 + FW, v1 = v0 + FH, e = fr.el;
    e.wire.setAttribute("d", open([at(u0 + 5, v1 - 2, 0.3), at(hu, hv, 0.3), at(u1 - 5, v1 - 2, 0.3)]));
    e.back.setAttribute("d", ring(u0, v0, u1, v1, 2.2, 0));
    e.face.setAttribute("d", ring(u0, v0, u1, v1, 2.2, FD));
    e.lip.setAttribute("d", ring(u0 + BW, v0 + BW, u1 - BW, v1 - BW, 1.2, FD));
    e.slot.setAttribute("d", ring(u0 + PI, v0 + PI, u1 - PI, v1 - PI, 1, FD - 0.6));
    const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, hw = (FW / 2 - PI) * t, hh = (FH / 2 - PI) * t;
    e.plate.setAttribute("d", t < 0.02 ? "" : ring(cu - hw, cv - hh, cu + hw, cv + hh, Math.min(1, hw, hh), FD - 0.4));
    const sx = (FW - 2 * PI) / 4, sz = (FH - 2 * PI) / 4;
    ART[fr.i].forEach((k, j) => {
      place(e.dots[j], at(cu + ((k % 3) - 1) * sx * t, cv + (1 - Math.floor(k / 3)) * sz * t, FD - 0.2));
      e.dots[j].setAttribute("r", t < 0.5 ? 0 : (1.8 * (t - 0.5)).toFixed(2));
    });
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const fr of frames) {
      draw(fr, tval(fr.a, now), tval(fr.f, now));
      if (!tdone(fr.a, now) || !tdone(fr.f, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // the wall's front plane, solved once: screen point -> (u, v) on it
  const o = w(0, 0, FD), eu = w(1, 0, FD), ev = w(0, 1, FD);
  const a = [eu[0] - o[0], eu[1] - o[1]], b = [ev[0] - o[0], ev[1] - o[1]], det = a[0] * b[1] - a[1] * b[0];
  function hit([x, y]) {
    const qx = x - o[0], qy = y - o[1];
    const u = (qx * b[1] - qy * b[0]) / det, v = (a[0] * qy - a[1] * qx) / det;
    if (u < -4 || u > WW + 4 || v < -4 || v > ZH + 4) return -1;
    const c = clamp(Math.floor((u - M + GAP / 2) / (FW + GAP)), 0, NC - 1);
    const r = clamp(Math.floor((v - M + GAP / 2) / (FH + GAP + HK)), 0, NR - 1);
    return (NR - 1 - r) * NC + c;
  }

  let act = -1;
  const dist = (p, q) => Math.hypot(frames[p].c - frames[q].c, frames[p].r - frames[q].r);
  function setActive(n) {
    if (n === act) return;
    const now = performance.now(), from = n >= 0 ? n : act;
    act = n;
    for (const fr of frames) {
      const d = from >= 0 ? (n >= 0 ? dist(fr.i, from) : 3.2 - dist(fr.i, from)) * stag : 0;
      tset(fr.a, n >= 0 ? 0 : TILT[fr.i], now, Math.max(0, d));
      tset(fr.f, n >= 0 || isHung(fr.i) ? 1 : 0, now, Math.max(0, d));
      fr.el.plate.classList.toggle("hi", n >= 0 ? fr.i === n : fr.i === NEWEST);
    }
    read.textContent = n < 0 ? "rest" : `${String(n + 1).padStart(2, "0")} · ${NC * NR} hung`;
    B.wake();
  }
  frames[NEWEST].el.plate.classList.add("hi");
  read.textContent = "rest";

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());
  return { set: (v) => { stag = v; }, destroy: bag.dispose };
}

hairline({
  name: "abx",
  means: "A gallery wall mid-hang: point at it and every frame swings level and gets its art, in a wave from the pointer.",
  rules: [1, 2, 5, 10],
  range: [0, 45, 90],
  mount,
});
