/* Render /ai from ai/wins.json.
 *
 * The page is generated rather than hand-written because every card carries the same
 * four facts in the same order, and because the checks that make an entry publishable
 * -- a real date, a known kind, absolute links, no tool names in the prose -- belong in
 * scripts/check-ai-wins.mjs where they run every build, not in a reviewer's attention.
 * /mirrors is hand-written for the opposite reason: its value is the prose around each
 * surface, which no data file carries.
 *
 * Runs before Tailwind in `npm run build`, like scripts/build-blog.mjs: the utilities
 * used below have to exist on disk before the scan, or the stylesheet ships without
 * them. The output is gitignored, as generated HTML is everywhere else on this site.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "https://thebenmeadows.com";
const OUT = "ai";
const TITLE = "AI · TheBenMeadows";
const DESCRIPTION = "Work done with AI assistance that someone else accepted: merged changes, competition results, published audits, released tools.";

/* Dates render as the ISO string from the data file, never through a Date object:
 * parsing "2026-09-14" and formatting it back runs through the builder's timezone, and
 * a machine west of UTC renders the previous day, which would show as mirror drift. */
const esc = (s) => s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const data = JSON.parse(readFileSync(`${OUT}/wins.json`, "utf8"));

/* Newest first, and ties broken by id so two entries sharing a date keep the same
 * order on every host. A build that reordered cards would report mirror drift that
 * does not exist. */
const wins = [...data.wins].sort((a, b) => (b.date.localeCompare(a.date) || a.id.localeCompare(b.id)));

function linkRow(links) {
    if (links.length === 0) return "";
    const anchors = links.map((l) =>
        `                        <a class="text-neutral-400 hover:text-white transition-colors" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
    ).join("\n");
    return `\n                    <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs">\n${anchors}\n                    </div>`;
}

function card(win) {
    const primary = win.links[0];
    const title = primary
        ? `<a href="${esc(primary.url)}" target="_blank" rel="noopener">${esc(win.title)}</a>`
        : esc(win.title);

    return `                <div class="hairline-card p-6">
                    <div class="flex items-center justify-between font-mono text-xs">
                        <span class="uppercase tracking-widest text-neutral-500">${esc(data.kinds[win.kind])}</span>
                        <span class="text-neutral-600">${esc(win.date)}</span>
                    </div>
                    <h2 class="card-title mt-3 text-xl font-bold text-white">${title}</h2>
                    <p class="mt-2 text-sm text-neutral-400">${esc(win.summary)}</p>
                    <div class="mt-3 font-mono text-xs uppercase tracking-widest text-neutral-500">${esc(win.where)}</div>${linkRow(win.links)}
                </div>`;
}

const cards = wins.length > 0
    ? `\n            <div class="mt-8 grid gap-4 sm:grid-cols-2">\n${wins.map(card).join("\n\n")}\n            </div>\n`
    : `\n            <p class="mt-8 text-sm text-neutral-500">Nothing to show yet.</p>\n`;

const page = `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${esc(DESCRIPTION)}" />
        <meta name="color-scheme" content="dark light" />
        <link rel="canonical" href="${SITE}/ai/" />
        <link rel="alternate" type="application/atom+xml" title="Site releases" href="/feed.xml" />
        <link rel="alternate" type="application/rss+xml" title="Site releases (RSS)" href="/rss.xml" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TheBenMeadows" />
        <meta property="og:title" content="${esc(TITLE)}" />
        <meta property="og:description" content="${esc(DESCRIPTION)}" />
        <meta property="og:url" content="${SITE}/ai/" />
        <meta property="og:image" content="${SITE}/og.png" />
        <meta property="og:image:type" content="image/png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="TheBenMeadows · thebenmeadows.com" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${esc(TITLE)}" />
        <meta name="twitter:description" content="${esc(DESCRIPTION)}" />
        <meta name="twitter:image" content="${SITE}/og.png" />

        <title>${esc(TITLE)}</title>
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />

        <link rel="icon" href="/favicon/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/favicon/site.webmanifest" />

        <link
            rel="preload"
            href="/fonts/publicsans-v1.woff2"
            as="font"
            type="font/woff2"
            crossorigin
        />
        <link rel="stylesheet" href="/output.css" />
        <script src="/theme.js"></script>
        <script src="/search.js" defer></script>
    </head>
    <body id="top" class="bg-black">
        <header class="running-head">
            <span class="rh-left"><a href="/">Index</a></span>
            <nav class="rh-right">
                <button id="search-open" type="button" aria-label="Search this site" title="Search (press / )">Search</button>
                <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
                <button id="theme-toggle" type="button" aria-label="Switch theme"></button>
            </nav>
        </header>
        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">AI</h1>
            <p class="mt-4">
                Ben builds with AI. This page lists the results other people accepted:
                fixes merged into projects he does not own, a bug bounty won, audits
                posted in public, tools you can open. Each card links to the proof, or
                gives the date and the place when the venue keeps none.
            </p>
            <p class="mt-4">
                Artwork stays under <a class="underline decoration-neutral-600 underline-offset-4 hover:text-white transition-colors" href="/art/">Art</a>
                whatever the process behind it, and reaches this page only by winning
                something outside.
            </p>
            <hr class="center-rule" style="margin-top: 2.2rem; margin-bottom: 0" />
${cards}        </main>

        <footer class="site-footer">
            <nav class="footer-line">
                <a class="js-email" rel="nofollow" href="mailto:steam-gab-shape@duck.com">Email</a>
                <span aria-hidden="true">&middot;</span>
                <a href="https://x.com/thebenmeadows" target="_blank" rel="me noopener">X</a>
                <span aria-hidden="true">&middot;</span>
                <a href="https://primal.net/p/npub1wldqfuy0yge4fvxukdm43gze2ral9dnp5avlps5a6t8q0vyv2nds84nq29" target="_blank" rel="me noopener">Nostr</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/profiles/">All profiles &rarr;</a>
            </nav>
            <nav class="footer-line">
                <a href="https://github.com/TheBenMeadows/tbm" target="_blank" rel="noopener">Source</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/mirrors/">Mirrors</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/tech/">Tech&nbsp;Stack</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/infra/">Infra</a>
            </nav>
        </footer>
        <script src="/email.js"></script>
    </body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/index.html`, page, "utf8");
console.log(`ai page           ${wins.length} entr${wins.length === 1 ? "y" : "ies"} -> ${OUT}/index.html`);
