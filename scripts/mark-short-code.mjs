// Marks short inline code so it never breaks across lines. A token such as
// `script-src 'self'` split at its own hyphen reads as two broken words, but a
// blanket white-space: nowrap would push hashes, URLs and commands past the
// edge of a phone column. So the rule in src/input.css (main code.nb) applies
// only to the code this script marks: no markup inside, 30 characters or fewer,
// not a CID.
//
// Runs over dist/ in build:netlify, before version-css and the manifest, so
// the hashes those record include the change.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv[2] || "dist";
const MAX = 30;

function htmlFiles(dir) {
    return readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? htmlFiles(p) : n.endsWith(".html") ? [p] : [];
    });
}

// <code> with no attributes or only a class, holding plain text (entities count as one character).
const CODE = /<code(?: class="([^"]*)")?>([^<]*)<\/code>/g;
let marked = 0;
for (const file of htmlFiles(DIST)) {
    const html = readFileSync(file, "utf8");
    const out = html.replace(CODE, (whole, cls = "", text) => {
        const len = text.replace(/&[#a-z0-9]+;/gi, "x").length;
        if (len > MAX || /\bcid\b|\bnb\b/.test(cls) || text.includes("\n")) return whole;
        marked++;
        return `<code class="${cls ? cls + " " : ""}nb">${text}</code>`;
    });
    if (out !== html) writeFileSync(file, out);
}
console.log(`mark-short-code    ${marked} inline code spans kept whole`);
