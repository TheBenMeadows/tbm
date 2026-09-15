/* Fetch every link in ai/wins.json and report what came back.
 *
 * Deliberately NOT part of `npm run build`. A rate limit, a bot challenge or a
 * venue that is down for an hour would fail a deploy while saying nothing about
 * whether the entry is true, so this runs on demand:
 *
 *   node scripts/check-ai-links.mjs        report every link
 *   node scripts/check-ai-links.mjs --ci   exit 1 if any link returned 404 or 410
 *
 * Only 404 and 410 are treated as failures even with --ci. They are the codes that
 * mean the page is gone. A 403 or 429 is the venue declining to answer a script and
 * is reported as UNKNOWN, to be opened in a browser rather than acted on.
 */
import { readFileSync } from "node:fs";

const FILE = "ai/wins.json";
const CI = process.argv.includes("--ci");
const TIMEOUT_MS = 15000;

const data = JSON.parse(readFileSync(FILE, "utf8"));
const links = [
    ...data.wins.flatMap((win) => (win.links ?? []).map((link) => ({ ...link, id: win.id }))),
    ...(data.quotes ?? []).map((q, i) => ({ label: q.who, url: q.url, id: `quote-${i + 1}` })),
];

async function probe(url) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        // HEAD first: some hosts answer it and it costs nothing. GitHub answers HEAD
        // on issue and pull pages; venues that do not are retried with GET.
        let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: control.signal });
        if (response.status === 405 || response.status === 501) {
            response = await fetch(url, { method: "GET", redirect: "follow", signal: control.signal });
        }
        return { status: response.status, final: response.url };
    } catch (error) {
        return { status: 0, final: url, error: error.name === "AbortError" ? `no answer in ${TIMEOUT_MS / 1000}s` : error.message };
    } finally {
        clearTimeout(timer);
    }
}

let gone = 0;
let unknown = 0;

for (const link of links) {
    const { status, final, error } = await probe(link.url);
    /* fetch() never sends the fragment, so response.url comes back without it. Comparing
     * whole URLs would report every deep link into an issue thread as a redirect. */
    const asked = link.url.split("#")[0];
    const moved = final && final !== asked ? `  -> ${final}` : "";

    if (status >= 200 && status < 300) {
        console.log(`  OK      ${status}  ${link.id}  ${link.url}${moved}`);
    } else if (status === 404 || status === 410) {
        gone += 1;
        console.error(`  GONE    ${status}  ${link.id}  ${link.url}`);
    } else {
        unknown += 1;
        console.error(`  UNKNOWN ${status || "--"}  ${link.id}  ${link.url}${error ? `  (${error})` : ""}  open it in a browser before changing the entry`);
    }
}

console.log(`ai links          ${links.length} link(s): ${links.length - gone - unknown} ok, ${gone} gone, ${unknown} unknown`);

if (CI && gone > 0) process.exit(1);
