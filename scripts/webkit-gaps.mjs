// Justified text in Safari. Chrome and Safari break and stretch justified
// lines differently: `text-wrap: pretty` plus `text-align: justify` looks fine
// in Chrome and opens word spaces of 0.6em and more in Safari, so a check that
// only runs Chrome passes pages that look broken on every iPhone.
//
// This renders the given pages in WebKit at 1440px and measures every
// inter-word space inside justified prose. A page fails when more than
// GAP_SHARE of those spaces are wider than GAP_EM. Measured 2026-11-08 in
// WebKit: healthy justified pages on thebenmeadows.com have 4-5.5% of spaces
// over 0.5em; the art and dailymuse intros with `pretty` had 64-67%.
//
// Shared by the check-measure scripts of thebenmeadows.com, art, abx,
// benjaminmeadows.com and EveryBadge; keep the copies identical.
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const GAP_EM = 0.5, GAP_SHARE = 0.15;

// WEBKIT_PATH, else the build playwright-core expects, else the newest one
// Playwright has downloaded on this machine.
function webkitPath(webkit) {
    if (process.env.WEBKIT_PATH) return process.env.WEBKIT_PATH;
    try { const p = webkit.executablePath(); if (existsSync(p)) return p; } catch {}
    for (const cache of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]) {
        if (!existsSync(cache)) continue;
        const builds = readdirSync(cache).filter((n) => /^webkit-\d+$/.test(n)).sort((a, b) => +b.slice(7) - +a.slice(7));
        for (const b of builds) for (const exe of ["pw_run.sh", "minibrowser-gtk/MiniBrowser", "minibrowser-wpe/MiniBrowser"]) {
            const p = join(cache, b, exe);
            if (existsSync(p)) return p;
        }
    }
    return null;
}

const gaps = ([sel, maxEm]) => {
    let all = 0, wide = 0;
    for (const el of document.querySelectorAll(sel)) {
        const cs = getComputedStyle(el);
        if (cs.textAlign !== "justify" || cs.display === "none" || cs.visibility === "hidden") continue;
        const em = parseFloat(cs.fontSize);
        const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
            if (n.parentElement.closest("code, pre, kbd, samp")) continue;
            for (let i = 0; i < n.data.length; i++) {
                if (n.data[i] !== " ") continue;
                const r = document.createRange();
                r.setStart(n, i); r.setEnd(n, i + 1);
                const rects = r.getClientRects();
                if (rects.length !== 1 || rects[0].width <= 0) continue;
                all++;
                if (rects[0].width / em > maxEm) wide++;
            }
        }
    }
    return { all, wide };
};

// webkit: playwright-core's webkit export. origin: base URL ending in "/".
// paths: page paths relative to origin. selector: the prose this site justifies.
// Returns one string per problem; empty when every page holds.
export async function checkWebkitGaps(webkit, origin, paths, selector) {
    const exe = webkitPath(webkit);
    if (!exe) return ["WebKit is not installed: run `npx --prefix tools playwright-core install webkit` (or set WEBKIT_PATH)"];
    const browser = await webkit.launch({ headless: true, executablePath: exe });
    const out = [];
    try {
        const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const page = await ctx.newPage();
        for (const path of paths) {
            await page.goto(origin + path, { waitUntil: "load" });
            await page.evaluate(() => document.fonts.ready);
            const { all, wide } = await page.evaluate(gaps, [selector, GAP_EM]);
            if (all >= 20 && wide / all > GAP_SHARE)
                out.push(`/${path}: ${wide} of ${all} word spaces in justified text are wider than ${GAP_EM}em in WebKit (max ${Math.round(GAP_SHARE * 100)}%)`);
        }
        await ctx.close();
    } finally {
        await browser.close();
    }
    return out;
}
