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
 * Audio lives on IPFS (see speaking/registry.json): each page links the file's
 * CID through a public gateway and prints the bare CID beside it, so a reader
 * with their own node needs no gateway at all.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "speaking", "transcripts");
const OUT = join(ROOT, "speaking");
const SITE = "https://thebenmeadows.com";
const GATEWAY = "https://dweb.link/ipfs/";
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`build-speaking: ${file} date is not YYYY-MM-DD`);
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
const TURN = /^\*\*\[(\d\d:\d\d:\d\d)\]( ([^:*]+):)?\*\* /;
const RENDERER = {
    paragraph({ tokens }) {
        const raw = this.parser.parseInline(tokens);
        const m = raw.match(/^<strong>\[(\d\d:\d\d:\d\d)\]( ([^:<]+):)?<\/strong> /);
        if (!m) return `            <p>${raw}</p>\n`;
        const id = "t" + m[1].replace(/:/g, "");
        const who = m[3] ? `<b class="speaker">${m[3]}</b> ` : "";
        return `            <p id="${id}"><a class="stamp" href="#${id}"><time>${m[1]}</time></a> ${who}${raw.slice(m[0].length)}</p>\n`;
    },
    html({ text }) { throw new Error(`build-speaking: raw HTML in a transcript -- ${text.slice(0, 40)}`); },
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
        <script src="/email.js"></script>`;

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

function audioLine(cid) {
    if (!cid) return "";
    return `                <p class="post-meta no-justify">Audio on IPFS: <a class="${LINK}" href="${GATEWAY}${cid}">listen</a>
                    &nbsp;&middot;&nbsp; <code class="cid">${cid}</code></p>\n`;
}

function page(t) {
    const others = t.speakers.filter((s) => s !== "Ben");
    const meta = [`<time datetime="${t.date}">${longDate(t.date)}</time>`];
    if (t.minutes && Number(t.minutes) > 0) meta.push(`${Math.round(Number(t.minutes))} min`);
    if (t.source) meta.push(esc(t.source));
    const origin = t.origin
        ? `                <p class="post-meta no-justify"><a class="${LINK}" href="${esc(t.origin)}" rel="noopener">Original recording</a></p>\n`
        : "";
    const who = `                <p class="post-meta no-justify">Speakers: Ben${others.length ? ", " + others.map(esc).join(", ") : ""}</p>\n`;
    return head({ title: `${t.title} · Transcript · TheBenMeadows`, description: t.description, url: t.url })
        + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed transcript">
            <header class="post-head">
                <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">${esc(t.title)}</h1>
                <p class="post-meta no-justify">${meta.join("&nbsp;&middot; ")}</p>
${who}${origin}${audioLine(t.audio_cid)}            </header>
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
        `                <li><a href="${t.url}">${esc(t.title)}<span class="who">${longDate(t.date)}${t.minutes ? ` &middot; ${Math.round(Number(t.minutes))} min` : ""}</span></a></li>`
    ).join("\n");
    const root = registry && registry.root
        ? `            <p class="post-meta no-justify">The whole archive -- audio and these transcripts -- is one IPFS directory:
                <a class="${LINK}" href="${GATEWAY}${registry.root}/">browse</a> &nbsp;&middot;&nbsp; <code class="cid">${registry.root}</code></p>\n`
        : "";
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
const registry = existsSync(join(OUT, "registry.json"))
    ? JSON.parse(readFileSync(join(OUT, "registry.json"), "utf8"))
    : null;

const items = [];
for (const file of readdirSync(SRC).filter((f) => f.endsWith(".md")).sort()) {
    const slug = file.slice(0, -3);
    const { meta, body } = frontMatter(readFileSync(join(SRC, file), "utf8"), file);
    const html = marked.parse(body);
    const words = body.split(/\s+/).length;
    items.push({
        ...meta, slug, url: `/speaking/${slug}/`, html,
        description: `Transcript: ${meta.title} (${longDate(meta.date)}). ${meta.speakers.join(", ")}. About ${words.toLocaleString("en-US")} words.`,
    });
}
items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));

for (const dir of readdirSync(OUT, { withFileTypes: true })) {
    if (dir.isDirectory() && dir.name !== "transcripts" && existsSync(join(OUT, dir.name, "index.html"))) {
        rmSync(join(OUT, dir.name), { recursive: true });
    }
}
for (const t of items) {
    mkdirSync(join(OUT, t.slug), { recursive: true });
    writeFileSync(join(OUT, t.slug, "index.html"), page(t));
}
writeFileSync(join(OUT, "index.html"), indexPage(items, registry));
/* Same shape as blog/pages.json: the search index reads each page's HTML itself,
 * so this is a list of files and URLs, nothing more. */
writeFileSync(join(OUT, "pages.json"), JSON.stringify({
    pages: items.map((t) => ({ file: `speaking/${t.slug}/index.html`, url: t.url })),
}, null, 1) + "\n");
console.log(`build-speaking: ${items.length} transcripts`);
