// Fail if mirrors/index.html has fallen out of step with mirrors.json.
//
// mirrors.json is the signed list: it is embedded verbatim into dist/manifest.json,
// signed with a Nostr key and anchored into Bitcoin. mirrors/index.html is the page
// people actually read. The two carry the same addresses, and on 2026-08-28 they
// disagreed: the Netlify mirror moved to its own hostname in mirrors.json and the
// readme regenerated with it, but the page kept advertising the old address, because
// its host cards are hand-authored markup and nothing checked them.
//
// The page is NOT generated from mirrors.json, deliberately. Its value is the prose
// around each surface -- why Tor still works when the domain does not, which copies
// move only at a release -- and its cards carry display labels ("Cloudflare Pages ·
// primary") that have no place in a signed provenance document whose whole discipline
// is addresses and nothing else. Generating the cards would mean either inventing a
// label field in the signed data or keeping a second label map that drifts the same
// way. So the page stays hand-written and this check makes a disagreement unmergeable.
//
// Matching is host-aware rather than literal, because the two files legitimately spell
// the same surface differently: mirrors.json holds `ssh://text@text.thebenmeadows.com:2222`
// while the page shows the command a human types, `ssh -p 2222 text@text.thebenmeadows.com`.
// Comparing whole URIs would fail on every text protocol. For http(s) the host alone is
// too weak -- half the entries share thebenmeadows.com -- so those match on host+path.
//
// Name resolvers (eth.limo, sol.site, tez.page) appear on the page but never in
// mirrors.json, by the rule stated in its own _comment: they are pointers to these
// copies, not copies. The check is therefore one-directional, mirrors.json -> page.
//
//   node scripts/check-mirrors-page.mjs    exit 1 and name every address that is missing
import { readFileSync } from "node:fs";

const MIRRORS = "mirrors.json";
const PAGE = "mirrors/index.html";

// What each address must look like to count as present on the page.
function needle(address) {
    // Bare npub / non-URI tokens: match the token itself.
    if (!address.includes("://")) return address;

    const [scheme, rest] = address.split("://");
    const withoutScheme = rest.replace(/\/+$/, "");

    if (scheme === "http" || scheme === "https") {
        // host+path, so thebenmeadows.com/tbm.torrent is not satisfied by the apex card.
        return withoutScheme;
    }
    // ssh/telnet/finger/whois/qotd/ftp/gemini/ipns/ar: strip credentials and port, keep
    // the host, which is the part the page always shows however it is presented.
    return withoutScheme
        .split("/")[0]
        .replace(/^[^@]*@/, "")
        .replace(/:\d+$/, "");
}

const mirrors = JSON.parse(readFileSync(MIRRORS, "utf8")).mirrors;
const page = readFileSync(PAGE, "utf8");

const missing = mirrors.filter((m) => !page.includes(needle(m.address)));

if (missing.length > 0) {
    console.error(`mirrors page      ${missing.length} address(es) in ${MIRRORS} are absent from ${PAGE}:`);
    for (const m of missing) {
        console.error(`  ${m.address}`);
        console.error(`      looked for: ${needle(m.address)}`);
    }
    console.error(`\n${PAGE} is hand-written. Add or correct the card, then re-run.`);
    process.exit(1);
}

console.log(`mirrors page      all ${mirrors.length} addresses in ${MIRRORS} appear in ${PAGE}`);
