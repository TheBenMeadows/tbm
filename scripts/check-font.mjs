// Checks a Public Sans woff2 the way a browser sets it:
//   1. a space next to a hyphen keeps its full width (" - " = " " + "-" + " "),
//      so a spaced hyphen never reads as "a -b";
//   2. tabular figures exist: with font-variant-numeric: tabular-nums, "1" and "0"
//      are the same width;
//   3. the weight axis covers 400-700 (600 is lighter than 700, heavier than 400).
//   4. with a site directory as second argument: every publicsans-*.woff2 a page
//      or stylesheet in it names is this file (a stale preload downloads a font
//      nothing uses).
// usage: node check-font.mjs <font.woff2> [site dir]   (prints PASS/FAIL lines, exits 1 on a failure)
// needs playwright-core and Chrome or Brave (CHROME_PATH). Built by scripts/build-font.py.
import { createRequire } from "node:module";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
const require = createRequire(import.meta.url);
const pw = require("playwright-core");
const file = resolve(process.argv[2]);
const b64 = readFileSync(file).toString("base64");
const exe = [process.env.CHROME_PATH, "/Applications/Brave Origin Beta.app/Contents/MacOS/Brave Origin Beta", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome"].find((p) => p && existsSync(p));
const browser = await pw.chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage();
await page.setContent(`<style>@font-face{font-family:T;src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:100 900}
body{font:400 100px T}</style><span id=s></span>`);
const r = await page.evaluate(async () => {
    await document.fonts.load("400 100px T"); await document.fonts.load("700 100px T");
    const s = document.getElementById("s");
    const w = (t, css = "") => { s.style.cssText = "white-space:pre;" + css; s.textContent = t; return s.getBoundingClientRect().width; };
    const sp = w(" "), hy = w("-");
    return {
        afterHyphen: w("- ") - (hy + sp), beforeHyphen: w(" -") - (sp + hy), spaced: w("a - b") - (w("a") + w("b") + 2 * sp + hy),
        tnum: w("1", "font-variant-numeric:tabular-nums") - w("0", "font-variant-numeric:tabular-nums"),
        w400: w("Hamburg", "font-weight:400"), w600: w("Hamburg", "font-weight:600"), w700: w("Hamburg", "font-weight:700"),
    };
});
await browser.close();
let failed = 0;
const say = (ok, msg) => { console.log(`${ok ? "PASS" : "FAIL"} ${msg}`); if (!ok) failed++; };
say(Math.abs(r.afterHyphen) < 0.5 && Math.abs(r.beforeHyphen) < 0.5 && Math.abs(r.spaced) < 1, `spaced hyphen keeps full spaces (kerning at 100px: after ${r.afterHyphen.toFixed(1)}px, before ${r.beforeHyphen.toFixed(1)}px)`);
say(Math.abs(r.tnum) < 0.5, `tabular figures ("1" vs "0" with tabular-nums: ${r.tnum.toFixed(1)}px apart)`);
say(r.w400 < r.w600 && r.w600 < r.w700, `weight axis 400 < 600 < 700 (${r.w400.toFixed(0)} / ${r.w600.toFixed(0)} / ${r.w700.toFixed(0)}px)`);
if (process.argv[3]) {
    const want = basename(file);
    const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.(html|css)$/.test(n) ? [p] : []; });
    const stale = walk(process.argv[3]).flatMap((p) => (readFileSync(p, "utf8").match(/publicsans-[\w.]+\.woff2/g) || []).filter((m) => m !== want).map((m) => `${p} names ${m}`));
    say(!stale.length, `every page and stylesheet names ${want}${stale.length ? `: ${stale.slice(0, 3).join("; ")}` : ""}`);
}
process.exit(failed ? 1 : 0);
