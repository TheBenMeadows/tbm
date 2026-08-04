// Prose figures drift silently. The colophon said "the corpus is about 11 KB"
// long after the corpus tripled, because a number written into a sentence has
// no build to fail it -- the page-weight budget caught its own drift, the prose
// never could. This script closes that gap the same way sync-readme-mirrors
// closes the address tables: the documents keep their prose, the build asserts
// it against what this tree actually measures.
//
// Deliberately ASSERTS rather than generates. A generated figure stays correct
// while the argument built around it goes stale -- "the corpus is small, so a
// search library would outweigh it" must be re-read by a person when the
// number moves, and a build failure is what forces that read. Each claim
// carries the tolerance its own wording promises: "about" buys slack,
// "under" buys a bound, an integer count buys nothing.
//
// The registry is CLOSED: any KB-shaped figure in a covered file that no claim
// accounts for fails the build. Without that, the next number written into
// prose drifts exactly like the last one did.
//
// Runs from dist/ (after version-css and build-manifest), so it measures what
// actually ships.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

// ---- measurements ---------------------------------------------------------

const index = JSON.parse(readFileSync(join(DIST, "search-index.json"), "utf8"));
const corpusKB = index.docs.reduce((n, d) => n + (d.text || "").length, 0) / 1024;
const pageCount = index.docs.filter((d) => d.kind === "page").length;
const indexKB = statSync(join(DIST, "search-index.json")).size / 1024;

// The same cold-visit set the page-weight budget in build-manifest.mjs
// measures. Kept in step with it by the shared failure mode: if the sets
// disagree, one of the two checks trips on the next real change.
const versionedCss = readdirSync(DIST).find((f) => /^output-[0-9a-f]{8}\.css$/.test(f));
if (!versionedCss) throw new Error("check-figures: no output-<hash>.css in dist");
const homepageKB =
    ["index.html", versionedCss, "theme.js", "search.js", "email.js",
     "fonts/publicsans-v1.woff2", "me.webp"]
        .reduce((n, f) => n + statSync(join(DIST, f)).size, 0) / 1024;

// ---- the registry ---------------------------------------------------------
// kind "about":  |measured - stated| <= tol * stated
// kind "under":  measured < stated
// kind "exact":  measured === stated
const CLAIMS = [
    { file: "readme.md", re: /corpus is about (\d+) KB/, kind: "about", tol: 0.25, measured: () => corpusKB, name: "corpus" },
    { file: "readme.md", re: /across (\d+) pages/, kind: "exact", measured: () => pageCount, name: "page count" },
    { file: "readme.md", re: /index built from it about (\d+) KB/, kind: "about", tol: 0.10, measured: () => indexKB, name: "index size" },
    { file: "readme.md", re: /It is (\d+) KB — a third of the budget/, kind: "about", tol: 0.10, measured: () => indexKB, name: "index size (budget note)" },
    { file: "readme.md", re: /green team requires that page to stay under (\d+) KB/, kind: "under", measured: () => homepageKB, name: "green-team bound" },
    { file: "readme.md", re: /measures about (\d+) KB/, kind: "about", tol: 0.10, measured: () => homepageKB, name: "home page weight" },
    { file: "tech/index.html", re: /corpus is about (\d+)&nbsp;KB/, kind: "about", tol: 0.25, measured: () => corpusKB, name: "corpus" },
    { file: "tech/index.html", re: /index about (\d+)&nbsp;KB/, kind: "about", tol: 0.10, measured: () => indexKB, name: "index size" },
    { file: "tech/index.html", re: /under (\d+)&nbsp;KB uncompressed/, kind: "under", measured: () => homepageKB, name: "weight bound" },
];

// ---- assert every claim ---------------------------------------------------

const failures = [];
const accounted = new Map(); // file -> array of [start, end) ranges

for (const c of CLAIMS) {
    const text = readFileSync(c.file, "utf8");
    const m = text.match(c.re);
    if (!m) {
        failures.push(`${c.file}: claim "${c.name}" not found (pattern ${c.re}) — if the wording changed, update the registry`);
        continue;
    }
    if (!accounted.has(c.file)) accounted.set(c.file, []);
    accounted.get(c.file).push([m.index, m.index + m[0].length]);

    const stated = Number(m[1]);
    const measured = c.measured();
    const ok =
        c.kind === "about" ? Math.abs(measured - stated) <= c.tol * stated
        : c.kind === "under" ? measured < stated
        : measured === stated;
    if (!ok) {
        failures.push(
            `${c.file}: "${c.name}" states ${stated}, tree measures ${measured.toFixed(1)} ` +
            `(${c.kind}${c.tol ? ` ±${c.tol * 100}%` : ""}) — re-read the sentence, not just the number`,
        );
    }
}

// ---- closed set: no unregistered KB figure in a covered file --------------

for (const file of new Set(CLAIMS.map((c) => c.file))) {
    const text = readFileSync(file, "utf8");
    const ranges = accounted.get(file) ?? [];
    for (const m of text.matchAll(/\b\d+(?:\.\d+)?(?: |&nbsp;)?KB\b/g)) {
        const inside = ranges.some(([a, b]) => m.index >= a && m.index < b);
        if (!inside) {
            const line = text.slice(0, m.index).split("\n").length;
            failures.push(
                `${file}:${line}: unregistered figure "${m[0]}" — every KB claim in this file ` +
                `must be asserted in scripts/check-figures.mjs (or reworded to a registered bound)`,
            );
        }
    }
}

if (failures.length) {
    for (const f of failures) console.error(`check-figures: ${f}`);
    process.exit(1);
}
console.log(
    `check-figures      ${CLAIMS.length} claims hold ` +
    `(corpus ${corpusKB.toFixed(1)} KB, index ${indexKB.toFixed(1)} KB, ` +
    `${pageCount} pages, home ${homepageKB.toFixed(1)} KB)`,
);
