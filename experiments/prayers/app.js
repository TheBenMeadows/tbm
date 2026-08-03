// Theme cycling + measured drop cap. ES module, deferred by default.
import { prepare, layout } from "./vendor/pretext.js";

/* ---- Theme: one button cycling auto -> day -> night -> auto ---------- */
// U+FE0E (VARIATION SELECTOR-15) forces text presentation -- without it
// iOS renders the sun as a full-color emoji, which clashes with the design.
const ICONS = { auto: "\u25D0\uFE0E", day: "\u2600\uFE0E", night: "\u263D\uFE0E" };
const LABEL = {
    auto: "Theme: follow system",
    day: "Theme: day (parchment)",
    night: "Theme: night (vigil)",
};
const ORDER = ["auto", "day", "night"];

function currentTheme() {
    const t = document.documentElement.dataset.theme;
    return t === "day" || t === "night" ? t : "auto";
}
function applyTheme(t) {
    if (t === "auto") {
        delete document.documentElement.dataset.theme;
        try { localStorage.removeItem("prayers-theme"); } catch (e) {}
    } else {
        document.documentElement.dataset.theme = t;
        try { localStorage.setItem("prayers-theme", t); } catch (e) {}
    }
    const btn = document.getElementById("theme");
    btn.textContent = ICONS[t];
    btn.setAttribute("aria-label", LABEL[t]);
    btn.title = LABEL[t];
}
const themeBtn = document.getElementById("theme");
if (themeBtn) {
    applyTheme(currentTheme());
    themeBtn.addEventListener("click", () => {
        const next = ORDER[(ORDER.indexOf(currentTheme()) + 1) % ORDER.length];
        applyTheme(next);
    });
}

/* ---- Drop cap: size the cap to span whole lines exactly -------------- */
// The CSS ::first-letter float is the no-JS baseline. Here we measure the
// real loaded font (canvas metrics for the cap glyph; Pretext layout() for
// the paragraph) and set --cap-size/--cap-pad so the cap's height equals an
// exact number of text lines: 3 when the opening paragraph runs at least 3
// lines beside the cap, 2 otherwise (narrow screens). Pretext's layout() is
// what answers "how many lines will this paragraph occupy at this width"
// without touching the DOM.
function fitDropCap() {
    const p = document.querySelector(".prayer p.opening");
    if (!p) return;
    const cs = getComputedStyle(p);
    const fontPx = parseFloat(cs.fontSize);
    const lineH = parseFloat(cs.lineHeight);
    const family = cs.fontFamily;
    const font = `${cs.fontWeight} ${fontPx}px ${family}`;

    const text = p.textContent;
    const capChar = text.trimStart().charAt(0);

    // Cap glyph metrics at a probe size.
    const ctx = document.createElement("canvas").getContext("2d");
    const PROBE = 100;
    ctx.font = `500 ${PROBE}px ${family}`;
    const m = ctx.measureText(capChar);
    const capHeightAtProbe =
        (m.actualBoundingBoxAscent || PROBE * 0.7) +
        (m.actualBoundingBoxDescent || 0);

    // Body cap height (an "O" of the text) — the cap's top should align with
    // the first line's cap top, its bottom with the Nth baseline.
    ctx.font = font;
    const bm = ctx.measureText("O");
    const bodyCapH = bm.actualBoundingBoxAscent || fontPx * 0.7;

    const width = p.getBoundingClientRect().width;
    let lines = 3;
    // Ask Pretext how many lines the paragraph runs beside a 3-line cap; if
    // fewer, drop to a 2-line cap. (Cap width estimated at target size.)
    try {
        const targetH3 = (3 - 1) * lineH + bodyCapH;
        const capW3 = m.width * (targetH3 / capHeightAtProbe);
        const prepared = prepare(text.slice(1), font);
        const beside = layout(prepared, Math.max(60, width - capW3 - 12), lineH);
        if (beside.lineCount < 3) lines = 2;
    } catch (e) { /* keep 3-line default */ }

    const targetH = (lines - 1) * lineH + bodyCapH;
    const capPx = PROBE * (targetH / capHeightAtProbe);
    p.style.setProperty("--cap-size", (capPx / fontPx).toFixed(3) + "em");
    p.style.setProperty("--cap-pad", "0.02em 0.14em 0 0");
}

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitDropCap);
} else {
    fitDropCap();
}
let resizeT;
addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(fitDropCap, 150);
});

/* ---- Masthead: daily-rotating ornament bar ---------------------------- */
// A small curated subset of Orthodox Illustration Project bars. The pick is
// seeded by the calendar day (plus a per-page offset from data-rotate), so
// every visitor sees the same bar on a given day, pages differ from each
// other, and the ornament turns over at midnight. The static src in the HTML
// is the no-JS fallback.
const BARS = [
    ["bar2", 2816, 477],
    ["bar8", 2741, 418],
    ["bar12", 4371, 718],
    ["bar13", 5087, 647],
    ["bar19", 2243, 479],
    ["bar20", 2556, 565],
];
const masthead = document.querySelector(".ornament[data-rotate]");
if (masthead) {
    const day = Math.floor(Date.now() / 864e5);
    const offset = parseInt(masthead.dataset.rotate, 10) || 0;
    const [name, w, h] = BARS[(day + offset) % BARS.length];
    masthead.src = "/experiments/prayers/art/bars/" + name + ".svg";
    masthead.width = w;
    masthead.height = h;
}

/* ---- PWA ------------------------------------------------------------- */
if ("serviceWorker" in navigator) {
    // Absolute path: this module is loaded from subpages too, and a relative
    // "./sw.js" would resolve against the page URL, not this file's.
    navigator.serviceWorker.register("/experiments/prayers/sw.js").catch(() => {});
}
