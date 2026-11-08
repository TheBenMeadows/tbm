// Line length is the one typographic number that drifts without anyone
// deciding it: a page gets a wider container or a smaller font and its body
// copy quietly runs to 95 characters a line. This renders every page of the
// built site in a headless browser and asserts what src/input.css promises:
//
//   desktop (1440px): body copy that wraps to 3+ lines sets at 16px or more,
//                     a page's median line is at most 75 characters, and no
//                     paragraph's average line passes 85;
//   phone (390px):    no body copy is justified.
//
// "Body copy" is the same set input.css styles as body copy: direct <p> and
// <li> children of <main> and of a post's .e-content. Card text, labels and
// metadata are nested deeper and are not measured; data-measure-skip marks a
// direct child that is not prose (a block of wallet addresses).
//
// Runs from dist/ after build:netlify. Chrome comes from CHROME_PATH, or the
// copy GitHub's ubuntu runners ship at /usr/bin/google-chrome.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const DIST = process.argv[2] || "dist";
const MEDIAN_MAX = 75, LINE_MAX = 85, BODY_MIN = 16;

// Self-contained apps with their own stylesheets, and the generative art
// viewer: they set no body copy in the site's measure.
const SKIP = [
    /^experiments\/(birds|etherhoo|pendulum|poap-vault|porcine|dls)\//,
    /^projects\/poap-saver\//,
    /^essentialism\//,
    /^search\//,
];

function pages(dir, base = "") {
    const out = [];
    for (const name of readdirSync(join(dir, base))) {
        const rel = base ? `${base}/${name}` : name;
        if (statSync(join(dir, rel)).isDirectory()) out.push(...pages(dir, rel));
        else if (name === "index.html") out.push(rel.slice(0, -"index.html".length));
    }
    return out.filter((p) => !SKIP.some((re) => re.test(p))).sort();
}

const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
    ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp",
    ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    try {
        const body = readFileSync(join(DIST, p));
        res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
        res.end(body);
    } catch {
        res.writeHead(404); res.end();
    }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}/`;

const measure = () => {
    const sel = "main > p, main > ul > li, main > ol > li, main > .e-content > p, main > .e-content > ul > li, main > .e-content > ol > li";
    return [...document.querySelectorAll(sel)].flatMap((el) => {
        const cs = getComputedStyle(el);
        if (el.hasAttribute("data-measure-skip")) return [];
        if (cs.display === "none" || cs.visibility === "hidden" || el.getBoundingClientRect().width < 5) return [];
        const text = el.innerText.replace(/\s+/g, " ").trim();
        const range = document.createRange();
        range.selectNodeContents(el);
        const tops = new Set();
        for (const r of range.getClientRects()) if (r.width > 2) tops.add(Math.round(r.top / 4));
        return [{ text: text.slice(0, 40), lines: tops.size, cpl: text.length / Math.max(1, tops.size),
            size: parseFloat(cs.fontSize), align: cs.textAlign, mono: cs.fontFamily.includes("mono") }];
    });
};

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome" });
const failures = [];
try {
    for (const [width, height] of [[1440, 900], [390, 844]]) {
        const ctx = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
        const page = await ctx.newPage();
        for (const path of pages(DIST)) {
            await page.goto(origin + path, { waitUntil: "load" });
            const blocks = (await page.evaluate(measure)).filter((b) => b.lines >= 3 && !b.mono);
            if (!blocks.length) continue;
            if (width === 1440) {
                const cpl = blocks.map((b) => b.cpl).sort((a, b) => a - b);
                const median = cpl[Math.floor(cpl.length / 2)];
                if (median > MEDIAN_MAX) failures.push(`/${path}: median ${Math.round(median)} characters a line at 1440px (max ${MEDIAN_MAX})`);
                for (const b of blocks) {
                    if (b.cpl > LINE_MAX) failures.push(`/${path}: "${b.text}" runs ${Math.round(b.cpl)} characters a line at 1440px (max ${LINE_MAX})`);
                    if (b.size < BODY_MIN) failures.push(`/${path}: "${b.text}" is ${b.size}px body copy (min ${BODY_MIN})`);
                }
            } else {
                for (const b of blocks) if (b.align === "justify") failures.push(`/${path}: "${b.text}" is justified at 390px`);
            }
        }
        await ctx.close();
    }
} finally {
    await browser.close();
    server.close();
}

if (failures.length) {
    console.error(`check-measure: ${failures.length} problem(s)\n  ` + failures.join("\n  "));
    process.exit(1);
}
console.log(`check-measure      ${pages(DIST).length} pages within ${MEDIAN_MAX}/${LINE_MAX} characters a line, ${BODY_MIN}px body, flush left on the phone`);
