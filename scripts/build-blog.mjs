/* Renders blog/posts/*.md into the same page vocabulary as the hand-written
 * pages: blog/<slug>/index.html, the blog/ index, and blog/feed.xml.
 *
 * Generated HTML is never committed. It is written into the working tree beside
 * the hand-written pages and gitignored, exactly like output.css and
 * search-index.json, because both hosts build from this tree and publish dist/.
 *
 * DETERMINISM IS THE CONTRACT. Output derives from file content and front-matter
 * only -- never the build clock, never a filesystem mtime, never directory order.
 * The same commit has to produce identical bytes on Cloudflare, on Netlify and on
 * the machine that pushes to Codeberg, or the signed manifest means nothing. See
 * scripts/build-stamp.mjs for the same argument at more length.
 *
 * Runs BEFORE build-search-index.mjs, which reads the page list this emits.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POSTS = join(ROOT, "blog", "posts");
const OUT = join(ROOT, "blog");
const SITE = "https://thebenmeadows.com";

/* ------------------------------------------------------------------ */
/* front matter                                                        */

/* A deliberately small reader rather than a YAML dependency: the front matter is
 * a fixed set of scalar keys plus one bracketed list, and a real YAML parser
 * would accept far more than this build knows how to render. If a post needs a
 * key that is not here, the build should fail loudly rather than drop it. */
const KNOWN = new Set(["title", "date", "updated", "tags", "description", "image", "image_alt"]);

function frontMatter(text, file) {
    if (!text.startsWith("---\n")) throw new Error(`build-blog: ${file} has no front matter`);
    const end = text.indexOf("\n---\n", 3);
    if (end === -1) throw new Error(`build-blog: ${file} front matter is not closed`);
    const meta = {};
    for (const line of text.slice(4, end).split("\n")) {
        if (!line.trim()) continue;
        const i = line.indexOf(":");
        if (i === -1) throw new Error(`build-blog: ${file} front-matter line is not key: value -- ${line}`);
        const key = line.slice(0, i).trim();
        let value = line.slice(i + 1).trim();
        if (!KNOWN.has(key)) throw new Error(`build-blog: ${file} has unknown front-matter key "${key}"`);
        if (key === "tags") {
            meta.tags = value.replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean);
            continue;
        }
        if (value.startsWith('"')) value = JSON.parse(value);
        meta[key] = value;
    }
    for (const need of ["title", "date", "description"]) {
        if (!meta[need]) throw new Error(`build-blog: ${file} is missing front-matter "${need}"`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`build-blog: ${file} date must be YYYY-MM-DD`);
    return { meta, body: text.slice(end + 5) };
}

/* ------------------------------------------------------------------ */
/* image dimensions                                                     */

/* Every hand-written page sets width and height on its images so the column does
 * not reflow as they load. Generated pages have to do the same, and the only
 * place the size exists is the file, so read it out of the header rather than
 * carrying a number in the markdown that can drift away from the bytes. */
function imageSize(sitePath) {
    const file = join(ROOT, sitePath.replace(/^\//, ""));
    if (!existsSync(file)) throw new Error(`build-blog: image not found: ${sitePath}`);
    const b = readFileSync(file);
    if (b.slice(0, 4).toString("latin1") === "RIFF" && b.slice(8, 12).toString("latin1") === "WEBP") {
        const chunk = b.slice(12, 16).toString("latin1");
        if (chunk === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
        if (chunk === "VP8L") {
            const bits = b.readUInt32LE(21);
            return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
        }
        if (chunk === "VP8X") {
            const rd24 = (o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
            return { w: rd24(24) + 1, h: rd24(27) + 1 };
        }
    }
    if (b.slice(0, 3).toString("latin1") === "GIF") return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
    throw new Error(`build-blog: cannot read dimensions of ${sitePath}`);
}

/* ------------------------------------------------------------------ */
/* markdown -> the site's markup                                        */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const LINK = "text-white underline underline-offset-4 decoration-neutral-600 transition-opacity hover:opacity-70";

/* Written as plain functions, not arrows: marked copies these onto its own
 * renderer and calls them with `this` bound to it, which is the only way to
 * reach the parser for nested inline tokens. */
const RENDERER = {
    /* Links keep the site's one link style, and anything leaving the site is
     * marked the way the hand-written pages mark it. */
    link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href) && !href.startsWith(SITE);
        const t = title ? ` title="${esc(title)}"` : "";
        const rel = external ? ' target="_blank" rel="noopener"' : "";
        return `<a class="${LINK}" href="${esc(href)}"${t}${rel}>${text}</a>`;
    },

    /* A post image is a block, full column width, lazy below the fold. */
    image({ href, text }) {
        const { w, h } = imageSize(href);
        return `<img class="post-image" src="${esc(href)}" alt="${esc(text || "")}" width="${w}" height="${h}" loading="lazy" decoding="async" />`;
    },

    /* marked wraps a lone image in a paragraph. main > p is justified body copy,
     * and a paragraph holding nothing but an image is not body copy, so unwrap it. */
    paragraph({ tokens }) {
        const inner = this.parser.parseInline(tokens).trim();
        if (/^<img class="post-image"[^>]*\/>$/.test(inner)) return inner + "\n";
        return `<p class="mt-4">${inner}</p>\n`;
    },

    /* The post title is the page's h1, so a body heading starts at h2 -- and it
     * starts there whether the markdown wrote # or ##, because a document that
     * skips from h1 to h3 reads as a missing level to anything walking the
     * outline. Deeper markdown levels keep their relative depth. */
    heading({ tokens, depth }) {
        const level = Math.min(Math.max(depth, 2), 6);
        return `<h${level} class="post-heading">${this.parser.parseInline(tokens)}</h${level}>\n`;
    },

    hr() {
        return `<hr class="center-rule" />\n`;
    },

    list(token) {
        const tag = token.ordered ? "ol" : "ul";
        const items = token.items.map((i) => this.listitem(i)).join("");
        return `<${tag} class="post-list">\n${items}</${tag}>\n`;
    },

    listitem(item) {
        return `<li>${this.parser.parseInline(item.tokens)}</li>\n`;
    },

    code({ text }) {
        return `<pre class="post-code"><code>${esc(text)}</code></pre>\n`;
    },

    codespan({ text }) {
        return `<code class="font-mono text-sm">${esc(text)}</code>`;
    },

    blockquote({ tokens }) {
        return `<blockquote class="post-quote">${this.parser.parse(tokens)}</blockquote>\n`;
    },

    /* Wrapped in its own scroller: a trait table is wider than a phone column,
     * and the alternative is the page body scrolling sideways. */
    table(token) {
        const cells = (row, tag) =>
            "<tr>" + row.map((c) =>
                `<${tag}${c.align ? ` style="text-align: ${c.align}"` : ""}>${this.parser.parseInline(c.tokens)}</${tag}>`
            ).join("") + "</tr>\n";
        const head = token.header.length ? `<thead>\n${cells(token.header, "th")}</thead>\n` : "";
        const body = token.rows.length ? `<tbody>\n${token.rows.map((r) => cells(r, "td")).join("")}</tbody>\n` : "";
        return `<div class="post-table-wrap">\n<table class="post-table">\n${head}${body}</table>\n</div>\n`;
    },
};

/* Stray markup in a post is escaped rather than passed through -- three of these
 * posts came out of a WYSIWYG editor -- which also keeps the CSP argument on
 * /tech/ honest.
 *
 * breaks: true, because a single newline inside a paragraph is always deliberate
 * here: nothing wraps prose in these files, so the only newlines a paragraph
 * contains are the ones that were <br> in the source. Several entries are a bold
 * title, a line break, then a date, and collapsing that to a space runs them
 * together. */
marked.use({ renderer: RENDERER, gfm: true, breaks: true, async: false });

/* ------------------------------------------------------------------ */
/* page templates                                                       */

const FOOTER = `        <footer class="site-footer">
            <nav class="footer-line">
                <a class="js-email" rel="nofollow" href="/">Email</a>
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
        <script src="/email.js"></script>`;

function head({ title, description, url, image, imageAlt, extraLinks = "" }) {
    const img = image ? SITE + image : `${SITE}/og.png`;
    const alt = imageAlt || "TheBenMeadows · thebenmeadows.com";
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${esc(description)}" />
        <meta name="author" content="Ben Meadows" />
        <meta name="color-scheme" content="dark light" />
        <meta http-equiv="content-language" content="en-us" />
        <link rel="canonical" href="${SITE}${url}" />
        <link rel="alternate" type="application/atom+xml" title="Blog" href="/blog/feed.xml" />
        <link rel="alternate" type="application/atom+xml" title="Site releases" href="/feed.xml" />
        <link rel="alternate" type="application/rss+xml" title="Site releases (RSS)" href="/rss.xml" />
${extraLinks}
        <meta property="og:site_name" content="TheBenMeadows" />
        <meta property="og:title" content="${esc(title)}" />
        <meta property="og:description" content="${esc(description)}" />
        <meta property="og:url" content="${SITE}${url}" />
        <meta property="og:image" content="${img}" />
        <meta property="og:image:alt" content="${esc(alt)}" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${esc(title)}" />
        <meta name="twitter:description" content="${esc(description)}" />
        <meta name="twitter:image" content="${img}" />
        <meta name="twitter:image:alt" content="${esc(alt)}" />

        <title>${esc(title)}</title>
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
            <span class="rh-left"><a href="/">Index</a>&nbsp;&middot;&nbsp;<a href="/blog/">Blog</a></span>
            <nav class="rh-right">
                <button id="search-open" type="button" aria-label="Search this site" title="Search (press / )">Search</button>
                <span aria-hidden="true">&nbsp;&middot;&nbsp;</span>
                <button id="theme-toggle" type="button"></button>
            </nav>
        </header>
`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];

/* Formatted from the front-matter string, never through a Date object: parsing
 * "2024-05-22" and formatting it back runs through the builder's timezone, and a
 * machine west of UTC renders the previous day. */
function longDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

function postPage(post) {
    const meta = [`<time datetime="${post.date}">${longDate(post.date)}</time>`];
    if (post.updated) meta.push(`updated ${longDate(post.updated)}`);
    if (post.tags.length) meta.push(post.tags.join(" &middot; "));

    const lead = post.image
        ? `            <img class="post-image" src="${post.image}" alt="${esc(post.image_alt || "")}" width="${post.imageSize.w}" height="${post.imageSize.h}" decoding="async" />\n`
        : "";

    return head({
        title: `${post.title} · TheBenMeadows`,
        description: post.description,
        url: post.url,
        image: post.image,
        imageAlt: post.image_alt,
        extraLinks: `        <meta property="og:type" content="article" />
        <meta property="article:published_time" content="${post.date}" />`,
    }) + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">${esc(post.title)}</h1>
            <p class="post-meta no-justify">${meta.join(" &middot; ")}</p>
${lead}${post.html}            <hr class="center-rule" style="margin-top: 2.6rem" />
            <p class="post-meta no-justify" style="text-align: center">
                <a class="${LINK}" href="/blog/">All posts</a>
            </p>
        </main>

${FOOTER}
    </body>
</html>
`;
}

function indexPage(posts) {
    const rows = posts.map((p) =>
        `                <li><a href="${p.url}">${esc(p.title)}<span class="who">${longDate(p.date)}</span></a></li>`
    ).join("\n");

    return head({
        title: "Blog · TheBenMeadows",
        description: "Writing on art, technology and what happens where they meet, by Ben Meadows.",
        url: "/blog/",
    }) + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <h1 class="text-white text-3xl font-bold text-center" style="letter-spacing: -0.025em">Blog</h1>
            <p class="mt-4">
                Longer writing, mostly about art and the machinery under it. These
                posts moved here from a subdomain that ran a separate content
                system; they are plain markdown in the same repository as the rest
                of the site now, so they ride to every mirror with everything else.
                The <a class="${LINK}" href="/blog/feed.xml">feed</a> is Atom.
            </p>
            <hr class="center-rule" style="margin-top: 2.2rem; margin-bottom: 0" />

            <h2 class="section-label" style="margin-top: 2.6rem">Posts</h2>
            <ul class="toc">
${rows}
            </ul>
        </main>

${FOOTER}
    </body>
</html>
`;
}

/* The release feed in build-feed.mjs and this one are deliberately separate:
 * one announces that the site was published, the other announces that something
 * was written. A reader who wants one rarely wants the other. */
function feed(posts) {
    const latest = posts[0];
    const entries = posts.map((p) => `    <entry>
        <title>${esc(p.title)}</title>
        <link rel="alternate" type="text/html" href="${SITE}${p.url}" />
        <id>${SITE}${p.url}</id>
        <updated>${p.updated || p.date}T00:00:00Z</updated>
        <published>${p.date}T00:00:00Z</published>
        <summary>${esc(p.description)}</summary>
    </entry>`).join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>TheBenMeadows — Blog</title>
    <subtitle>Writing on art, technology and what happens where they meet.</subtitle>
    <link rel="self" type="application/atom+xml" href="${SITE}/blog/feed.xml" />
    <link rel="alternate" type="text/html" href="${SITE}/blog/" />
    <id>${SITE}/blog/</id>
    <updated>${latest.updated || latest.date}T00:00:00Z</updated>
    <author><name>Ben Meadows</name></author>
${entries}
</feed>
`;
}

/* ------------------------------------------------------------------ */
/* run                                                                  */

const files = readdirSync(POSTS).filter((f) => f.endsWith(".md")).sort();
if (!files.length) throw new Error("build-blog: no posts in blog/posts/");

const posts = files.map((file) => {
    const { meta, body } = frontMatter(readFileSync(join(POSTS, file), "utf8"), file);
    const slug = file.replace(/\.md$/, "");
    return {
        ...meta,
        tags: meta.tags ?? [],
        slug,
        url: `/blog/${slug}/`,
        markdown: body,
        html: marked.parse(body).split("\n").map((l) => (l ? "            " + l : l)).join("\n"),
        imageSize: meta.image ? imageSize(meta.image) : null,
    };
});

/* Newest first, slug breaking ties, so two posts sharing a date cannot reorder
 * between hosts on directory-read order. */
posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));

for (const p of posts) {
    const dir = join(OUT, p.slug);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), postPage(p), "utf8");
}
writeFileSync(join(OUT, "index.html"), indexPage(posts), "utf8");
writeFileSync(join(OUT, "feed.xml"), feed(posts), "utf8");

/* The page list the other builders consume. build-search-index.mjs indexes what
 * is named here and build-stamp.mjs stamps it, so a new post joins search and
 * carries a build stamp without either script being edited. */
writeFileSync(
    join(OUT, "pages.json"),
    JSON.stringify({ pages: [{ file: "blog/index.html", url: "/blog/" },
                             ...posts.map((p) => ({ file: `blog/${p.slug}/index.html`, url: p.url }))] }, null, 2) + "\n",
    "utf8"
);

const words = posts.reduce((n, p) => n + p.markdown.split(/\s+/).length, 0);
console.log(`build-blog         ${posts.length} posts, ${words.toLocaleString("en-US")} words -> blog/`);
