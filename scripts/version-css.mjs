// Content-hash the stylesheet's filename so it can never go stale under new
// HTML. The 2026-08-04 deploy served the redesigned pages with an hour-cached
// old output.css (max-age=3600) and the site half-rendered until a manual edge
// purge — a versioned filename makes that class of failure impossible: the
// pages and the stylesheet they name change atomically, and _headers can cache
// /output-*.css for a year, immutable, like the font.
//
// Runs against dist/ only (after the cp steps, before build-stamp). Local dev
// keeps plain output.css and needs none of this.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, renameSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

const css = readFileSync(join(DIST, "output.css"));
const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
const versioned = `output-${hash}.css`;
renameSync(join(DIST, "output.css"), join(DIST, versioned));

function* htmlFiles(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* htmlFiles(p);
        else if (name.endsWith(".html")) yield p;
    }
}

let rewritten = 0;
for (const p of htmlFiles(DIST)) {
    const html = readFileSync(p, "utf8");
    if (!html.includes('href="/output.css"')) continue;
    writeFileSync(p, html.replaceAll('href="/output.css"', `href="/${versioned}"`));
    rewritten += 1;
}

if (rewritten === 0) {
    throw new Error("version-css: no page references /output.css — the link pattern drifted, fix this script");
}
console.log(`version-css        ${versioned} (${rewritten} pages rewritten)`);
