/* Renders speaking/transcripts/*.md -- speaker-labeled transcripts of Ben's
 * podcasts, X Spaces, panels and classes -- into speaking/<slug>/index.html, the
 * speaking/ index, and speaking/pages.json for the search index.
 *
 * Same contract as scripts/build-blog.mjs: generated HTML is gitignored and
 * written beside the sources; output derives from file content only, never the
 * clock or directory order. The page vocabulary (head, running head, footer,
 * main classes) is copied from build-blog.mjs rather than imported, because that
 * file is a script with side effects, not a module.
 *
 * Each transcript's front matter is written by a generator, so its string values
 * are JSON-quoted and `speakers` is a JSON list. The reader here accepts exactly
 * that and nothing looser.
 *
 * Audio lives on IPFS (see speaking/registry.json), in one directory whose root
 * CID is announced by the nodes that pin it. Each page links the file by its
 * path under that root three ways: over plain HTTPS through the poap-mirror
 * Worker (any player can use it, seeking included), through inbrowser.link
 * (the browser fetches and verifies the bytes itself), and as an ipfs:// address
 * for a reader with their own node. The per-file CIDs are not linked: only the
 * root is announced, so a bare file CID cannot be found on the network.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "speaking", "transcripts");
const OUT = join(ROOT, "speaking");
const SITE = "https://thebenmeadows.com";
const AUDIO_HTTP = "https://poap-mirror.bemeadows.workers.dev/speaking/";
const AUDIO_SW = "https://inbrowser.link/ipfs/";
const SLUG = /^\d{4}-\d{2}-\d{2}_[a-z0-9-]{1,80}$/;
const CID = /^(bafy[a-z2-7]{50,60}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const LINK = "underline decoration-neutral-600 underline-offset-4 hover:text-white";

/* ------------------------------------------------------------------ */
/* front matter                                                        */
const KNOWN = new Set(["title", "date", "source", "speakers", "origin", "audio_cid", "minutes"]);
function frontMatter(text, file) {
    if (!text.startsWith("---\n")) throw new Error(`build-speaking: ${file} has no front matter`);
    const end = text.indexOf("\n---\n", 3);
    if (end === -1) throw new Error(`build-speaking: ${file} front matter is not closed`);
    const meta = {};
    for (const line of text.slice(4, end).split("\n")) {
        if (!line.trim()) continue;
        const i = line.indexOf(":");
        if (i === -1) throw new Error(`build-speaking: ${file} front-matter line is not key: value -- ${line}`);
        const key = line.slice(0, i).trim();
        const raw = line.slice(i + 1).trim();
        if (!KNOWN.has(key)) throw new Error(`build-speaking: ${file} has unknown front-matter key "${key}"`);
        if (key === "date" || key === "minutes") { meta[key] = raw; continue; }
        let value;
        try { value = JSON.parse(raw); } catch {
            throw new Error(`build-speaking: ${file} value for "${key}" is not JSON-quoted -- ${raw}`);
        }
        meta[key] = value;
    }
    for (const k of ["title", "date", "speakers"]) {
        if (!(k in meta)) throw new Error(`build-speaking: ${file} is missing "${k}"`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)
        || new Date(`${meta.date}T00:00:00Z`).toISOString().slice(0, 10) !== meta.date) {
        throw new Error(`build-speaking: ${file} date is not a real YYYY-MM-DD date`);
    }
    if ("minutes" in meta && !(Number(meta.minutes) > 0)) throw new Error(`build-speaking: ${file} minutes is not a positive number`);
    if ("audio_cid" in meta && !CID.test(meta.audio_cid)) throw new Error(`build-speaking: ${file} audio_cid is not a CID`);
    return { meta, body: text.slice(end + 5) };
}

/* ------------------------------------------------------------------ */
/* html                                                                */
function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
function longDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/* A transcript turn is emitted by the generator as
 *   **[hh:mm:ss] Name:** text        (a new speaker)
 *   **[hh:mm:ss]** text              (a later paragraph of the same speaker)
 * Rendered as a paragraph with the stamp in a <time> and the name in <b>, and
 * a raw <a name> anchor per stamp so a URL can point into a recording. */
/* Two turns can start in the same second; the second one gets "-2" so every
 * anchor on a page is unique. Reset per transcript. */
const STAMPS = new Map();
const RENDERER = {
    paragraph({ tokens }) {
        const raw = this.parser.parseInline(tokens);
        const m = raw.match(/^<strong>\[(\d\d:\d\d:\d\d)\]( ([^:<]+):)?<\/strong> /);
        if (!m) return `            <p>${raw}</p>\n`;
        const base = "t" + m[1].replace(/:/g, "");
        const seen = (STAMPS.get(base) ?? 0) + 1;
        STAMPS.set(base, seen);
        const id = seen === 1 ? base : `${base}-${seen}`;
        const who = m[3] ? `<b class="speaker">${m[3]}</b> ` : "";
        return `            <p id="${id}"><a class="stamp" href="#${id}"><time>${m[1]}</time></a> ${who}${raw.slice(m[0].length)}</p>\n`;
    },
    html({ text }) { throw new Error(`build-speaking: raw HTML in a transcript -- ${text.slice(0, 40)}`); },
    link({ href, tokens }) {
        if (!/^https:\/\//.test(href)) throw new Error(`build-speaking: a transcript link is not https -- ${href.slice(0, 60)}`);
        return `<a class="${LINK}" href="${esc(href)}" rel="noopener">${this.parser.parseInline(tokens)}</a>`;
    },
};
marked.use({ renderer: RENDERER, gfm: true, breaks: false, async: false });

const FOOTER = `        <footer class="site-footer">
            <nav class="footer-line">
                <a class="js-email" rel="nofollow" href="mailto:steam-gab-shape@duck.com">Email</a>
                <span aria-hidden="true">&middot;</span>
                <a href="https://x.com/thebenmeadows" target="_blank" rel="me noopener">X</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/profiles/">All profiles &rarr;</a>
            </nav>
            <nav class="footer-line">
                <a href="https://github.com/TheBenMeadows/tbm" target="_blank" rel="noopener">Source</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/mirrors/">Mirrors</a>
                <span aria-hidden="true">&middot;</span>
                <a href="/tech/">Tech&nbsp;Stack</a>
            </nav>
        </footer>
`;

function head({ title, description, url }) {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${esc(description)}" />
        <meta name="author" content="Ben Meadows" />
        <meta name="color-scheme" content="dark light" />
        <link rel="canonical" href="${SITE}${url}" />
        <title>${esc(title)}</title>
        <meta property="og:title" content="${esc(title)}" />
        <meta property="og:description" content="${esc(description)}" />
        <meta property="og:url" content="${SITE}${url}" />
        <meta property="og:image" content="${SITE}/og.png" />
        <link rel="stylesheet" href="/output.css" />
        <script src="/theme.js"></script>
        <script src="/search.js" defer></script>
    </head>
    <body id="top" class="bg-black">
        <header class="running-head">
            <span class="rh-left"><a href="/">Index</a>&nbsp;&middot;&nbsp;<a href="/speaking/">Speaking</a></span>
            <nav class="rh-right">
                <button id="search-open" type="button" aria-label="Search this site" title="Search (press / )">Search</button>
                <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
                <button id="theme-toggle" type="button" aria-label="Switch theme"></button>
            </nav>
        </header>
`;
}

function audioLine(t, root) {
    if (!t.audio_cid) return "";
    const file = `${t.slug}.opus`;
    const path = `${root}/audio/${file}`;
    return `                <p class="post-meta no-justify">Audio: <a class="${LINK}" href="${AUDIO_HTTP}${file}">listen</a>
                    &nbsp;&middot;&nbsp; <a class="${LINK}" href="${AUDIO_SW}${path}">via IPFS in your browser</a>
                    &nbsp;&middot;&nbsp; <code class="cid">ipfs://${path}</code></p>\n`;
}

function page(t, root) {
    const others = t.speakers.filter((s) => s !== "Ben");
    const meta = [`<time datetime="${t.date}">${longDate(t.date)}</time>`];
    if (t.minutes && Number(t.minutes) > 0) meta.push(`${Math.round(Number(t.minutes))} min`);
    if (t.source) meta.push(esc(t.source));
    /* Only a public https address is a link a reader can follow; anything else
     * (a note about where a file came from) is not shown. */
    const origin = t.origin && /^https:\/\//.test(t.origin)
        ? `                <p class="post-meta no-justify"><a class="${LINK}" href="${esc(t.origin)}" rel="noopener">Original recording</a></p>\n`
        : "";
    const who = `                <p class="post-meta no-justify">Speakers: Ben${others.length ? ", " + others.map(esc).join(", ") : ""}</p>\n`;
    return head({ title: `${t.title} · Transcript · TheBenMeadows`, description: t.description, url: t.url })
        + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed transcript">
            <header class="post-head">
                <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">${esc(t.title)}</h1>
                <p class="post-meta no-justify">${meta.join("&nbsp;&middot; ")}</p>
${who}${origin}${audioLine(t, root)}            </header>
${t.html}            <hr class="center-rule" style="margin-top: 2.6rem" />
            <p class="post-meta no-justify" style="text-align: center">
                <a class="${LINK}" href="/speaking/">All transcripts</a>
            </p>
        </main>
${FOOTER}
    </body>
</html>
`;
}

function indexPage(items, registry) {
    const rows = items.map((t) =>
        `                <li><a href="${esc(t.url)}">${esc(t.title)}<span class="who">${longDate(t.date)}${t.minutes ? ` &middot; ${Math.round(Number(t.minutes))} min` : ""}</span></a></li>`
    ).join("\n");
    const root = `            <p class="post-meta no-justify">The whole archive -- audio and these transcripts -- is one IPFS directory:
                <a class="${LINK}" href="${AUDIO_SW}${registry.root}/">browse</a> &nbsp;&middot;&nbsp; <code class="cid">ipfs://${registry.root}</code></p>\n`;
    return head({
        title: "Speaking · Transcripts · TheBenMeadows",
        description: "Speaker-labeled transcripts of Ben Meadows's podcasts, X Spaces, panels and classes, 2022 onward, with the audio on IPFS.",
        url: "/speaking/",
    }) + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <header class="post-head">
                <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">Speaking</h1>
                <p class="post-meta no-justify">Transcripts of talks, panels, podcasts and classes. Each one is diarized and speaker-labeled;
                    timestamps link into the page, and the audio is on IPFS. The list of appearances with context is on the
                    <a class="${LINK}" href="/blog/podcasts-public-speaking/">Podcasts &amp; Public Speaking</a> post.
                    These pages are not in the site search box (it would grow it twenty-fold); use this list or a search engine.</p>
${root}            </header>
            <ul class="toc">
${rows}
            </ul>
        </main>
${FOOTER}
    </body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
if (!existsSync(SRC)) throw new Error(`build-speaking: ${SRC} is missing`);
if (!existsSync(join(OUT, "registry.json"))) throw new Error("build-speaking: speaking/registry.json is missing");
const registry = JSON.parse(readFileSync(join(OUT, "registry.json"), "utf8"));
if (!CID.test(registry.root ?? "")) throw new Error("build-speaking: speaking/registry.json root is not a CID");

const items = [];
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".md")).sort()) {
    const slug = file.slice(0, -3);
    if (!SLUG.test(slug)) throw new Error(`build-speaking: ${file} name is not YYYY-MM-DD_lowercase-words`);
    const { meta, body } = frontMatter(readFileSync(join(SRC, file), "utf8"), file);
    STAMPS.clear();
    const html = marked.parse(body);
    const words = body.split(/\s+/).length;
    items.push({
        ...meta, slug, url: `/speaking/${slug}/`, html,
        description: `Transcript: ${meta.title} (${longDate(meta.date)}). ${meta.speakers.join(", ")}. About ${words.toLocaleString("en-US")} words.`,
    });
}
items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? -1 : 1));

/* Remove only what an earlier run generated, as listed in its pages.json, so a
 * page that is not a transcript can live under speaking/ without being deleted. */
if (existsSync(join(OUT, "pages.json"))) {
    for (const p of JSON.parse(readFileSync(join(OUT, "pages.json"), "utf8")).pages) {
        const slug = p.file.split("/")[1];
        if (SLUG.test(slug)) rmSync(join(OUT, slug), { recursive: true, force: true });
    }
}
for (const t of items) {
    mkdirSync(join(OUT, t.slug), { recursive: true });
    writeFileSync(join(OUT, t.slug, "index.html"), page(t, registry.root));
}
writeFileSync(join(OUT, "index.html"), indexPage(items, registry));
/* Same shape as blog/pages.json: the search index reads each page's HTML itself,
 * so this is a list of files and URLs, nothing more. */
writeFileSync(join(OUT, "pages.json"), JSON.stringify({
    pages: items.map((t) => ({ file: `speaking/${t.slug}/index.html`, url: t.url })),
}, null, 1) + "\n");
console.log(`build-speaking: ${items.length} transcripts`);
