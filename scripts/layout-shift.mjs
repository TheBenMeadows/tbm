// Layout shift: how far content moves after it first appears, as the browser's
// own layout-shift entries add it up (the CLS score; 0.1 is the usual line for
// "good"). A page that fills in late - figures drawn by script, lists loaded
// from data - pushes the text under it down while someone is reading.
//
// Loads each page in Chrome at a phone and a desktop width (PARALLEL pages at
// a time), waits for the
// network to go quiet plus SETTLE_MS, and reports any page whose score passes
// SHIFT_MAX. Shifts within 500ms of input are excluded, as in the metric.
//
// Shared by the checks of thebenmeadows.com, abx and EveryBadge; keep the
// copies identical.
export const SHIFT_MAX = 0.1, SETTLE_MS = 1500, PARALLEL = 6;
const SIZES = [[390, 844], [1440, 900]];

const watch = () => {
    window.__shift = { total: 0, worst: 0, what: "" };
    new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue;
            window.__shift.total += e.value;
            if (e.value > window.__shift.worst) {
                const n = e.sources && e.sources[0] && e.sources[0].node;
                const el = n && (n.nodeType === 1 ? n : n.parentElement);
                window.__shift.worst = e.value;
                window.__shift.what = el ? el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.split(" ")[0] : "") : "";
            }
        }
    }).observe({ type: "layout-shift", buffered: true });
};

// browser: a launched playwright Chromium. origin: base URL ending in "/".
// paths: page paths relative to origin. route: optional async (context) => {}
// to stub network data before pages load.
// Returns one string per problem; empty when every page holds.
export async function checkLayoutShift(browser, origin, paths, route) {
    const out = [];
    for (const [width, height] of SIZES) {
        const queue = [...paths];
        // One context per worker: pages that share a context take turns being
        // the visible one, and a page that is not visible reports no shifts.
        const one = async () => {
            const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
            if (route) await route(ctx);
            await ctx.addInitScript(watch);
            for (let path = queue.shift(); path !== undefined; path = queue.shift()) {
                let s = null;
                try {
                    const page = await ctx.newPage();
                    try { await page.goto(origin + path, { waitUntil: "networkidle", timeout: 30000 }); } catch {}
                    await page.waitForTimeout(SETTLE_MS);
                    s = await page.evaluate(() => window.__shift).catch(() => null);
                    await page.close();
                } catch (e) {
                    out.push(`/${path}: could not be measured at ${width}px (${String(e.message).split("\n")[0]})`);
                    continue;
                }
                if (s && s.total > SHIFT_MAX)
                    out.push(`/${path}: layout shift ${s.total.toFixed(2)} at ${width}px (max ${SHIFT_MAX})${s.what ? `, largest move: ${s.what}` : ""}`);
            }
            await ctx.close();
        };
        await Promise.all(Array.from({ length: Math.min(PARALLEL, paths.length) }, one));
    }
    return out.sort();
}
