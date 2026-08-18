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
const KNOWN = new Set(["title", "subtitle", "date", "updated", "tags", "description", "image", "image_alt",
                       "author", "pin", "related"]);

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
        if (key === "tags" || key === "related") {
            meta[key] = value.replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean);
            continue;
        }
        if (key === "pin") {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1) {
                throw new Error(`build-blog: ${file} pin must be a whole number from 1 up, got "${value}"`);
            }
            meta.pin = n;
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
/* authors                                                             */

/* Read from blog/authors.json rather than hardcoded here: adding a writer is
 * adding data, not editing a build script. An unknown key fails the build --
 * quietly falling back to the site owner is how a guest post or an agent post
 * ends up under the wrong name, which is the exact failure this file exists to
 * prevent. */
const AUTHORS = JSON.parse(readFileSync(join(OUT, "authors.json"), "utf8"));

function authorOf(key, file) {
    const id = key || "ben";
    const a = AUTHORS[id];
    if (!a || id.startsWith("_")) {
        throw new Error(
            `build-blog: ${file} names author "${id}", which is not in blog/authors.json ` +
            `(known: ${Object.keys(AUTHORS).filter((k) => !k.startsWith("_")).join(", ")})`
        );
    }
    if (!a.name || !a.kind) throw new Error(`build-blog: author "${id}" needs a name and a kind`);
    return { id, ...a };
}

/* What the byline says. An agent is named as an agent and its operator is named
 * with it, because "Orrery" alone reads like a person to anyone who has not met
 * this site before. A guest is marked so the reader knows the writing does not
 * usually live here.
 *
 * The name links to the author's own page, but only when that page is somewhere
 * else. Ben's url is this site, and a byline link that lands on the page you are
 * already reading is a link a reader learns to stop trusting. Off-site is where
 * the link earns its place: it is how a reader checks who Orrery or a guest
 * actually is, which is the whole reason the field exists.
 *
 * rel="author" rather than the site's usual link styling -- a byline is not body
 * copy, and this stays in the quiet type of the rest of the line. */
function authorNameHtml(a) {
    const name = esc(a.name);
    if (!a.url || a.url.startsWith(SITE)) return name;
    return `<a class="post-author-link" href="${esc(a.url)}" rel="author noopener" target="_blank">${name}</a>`;
}

/* The byline carries the NAME only. What kind of author it is goes on its own
 * line below, because the qualifier is a sentence and the byline is a row of
 * short uppercase fields: setting "AUTONOMOUS AGENT, OPERATED BY BEN MEADOWS" in
 * that type pushed the line to two, and the second one opened with an orphaned
 * separator. The disclosure is not weaker for being a sentence -- it is easier
 * to read, and it is still directly under the title. */
function authorLine(a) {
    return authorNameHtml(a);
}

function authorNote(a) {
    if (a.kind === "agent") {
        return a.operator
            ? `Autonomous agent, operated by ${esc(a.operator)}`
            : "Autonomous agent";
    }
    return a.guest ? "Guest post" : "";
}

/* The name to use where only a name fits -- a feed entry, <meta name="author">.
 * Plenty of readers show the author and nothing else, and a bare "Orrery" in
 * that position reads as a person's name. The qualifier travels with it. */
function authorName(a) {
    return a.kind === "agent" ? `${a.name} (autonomous agent)` : a.name;
}

/* Atom's <uri> is the author's OWN page. An agent's operator is not that, and
 * putting the operator's homepage here would let a reader conclude the agent and
 * the site owner are the same author -- the confusion this whole field exists to
 * remove. An author with no page of their own simply has no <uri>. */
function authorUri(a) {
    return a.url || "";
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

    /* Not .center-rule. That class exists to sit tight under a page title, so it
     * carries no top margin at all -- which made a divider inside a post hug the
     * paragraph above it and read as an underline rather than a break. */
    hr() {
        return `<hr class="post-rule" />\n`;
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

function head({ title, description, url, image, imageAlt, author, extraLinks = "" }) {
    const img = image ? SITE + image : `${SITE}/og.png`;
    const alt = imageAlt || "TheBenMeadows · thebenmeadows.com";
    /* The index has no single author; a post does, and it is whoever wrote that
     * post rather than whoever owns the domain. */
    const by = author ? authorName(author) : "Ben Meadows";
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${esc(description)}" />
        <meta name="author" content="${esc(by)}" />
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
    /* Author leads the byline. It is the first thing that has to be true about a
     * post, and it used to be absent entirely -- a post Orrery wrote carried the
     * site owner's name in every machine-readable field on the page.
     *
     * Separators are bound to the word BEFORE them with a non-breaking space, so
     * a wrap can never start a line with a stray middot. Tags get their own line
     * rather than trailing the dates: together they overran the measure, and the
     * break landed between "TECHNOLOGY" and the separator in front of it. */
    const SEP = "&nbsp;&middot; ";
    const meta = [`<span class="post-author">${authorLine(post.author)}</span>`,
                  `<time datetime="${post.date}">${longDate(post.date)}</time>`];
    if (post.updated) meta.push(`updated ${longDate(post.updated)}`);

    /* A subtitle belongs to the title, not to the body. Set as its own line in
     * the header rather than as a first paragraph, which is where it landed
     * before and left it reading as an opening sentence. */
    const subLine = post.subtitle
        ? `                <p class="post-subtitle no-justify">${esc(post.subtitle)}</p>\n`
        : "";

    const note = authorNote(post.author);
    const noteLine = note ? `                <p class="post-note no-justify">${note}</p>\n` : "";
    const tagLine = post.tags.length
        ? `                <p class="post-meta post-tags no-justify">${post.tags.join(SEP)}</p>\n`
        : "";

    const lead = post.image
        ? `            <img class="post-image" src="${post.image}" alt="${esc(post.image_alt || "")}" width="${post.imageSize.w}" height="${post.imageSize.h}" decoding="async" />\n`
        : "";

    const seeAlso = post.seeAlso.length
        ? `            <h2 class="section-label" style="margin-top: 2.6rem">See also</h2>
            <ul class="toc">
${post.seeAlso.map((r) =>
    `                <li><a href="${r.url}">${esc(r.title)}<span class="who">${esc(r.who)}</span></a></li>`
).join("\n")}
            </ul>
`
        : "";

    return head({
        title: `${post.title} · TheBenMeadows`,
        description: post.description,
        url: post.url,
        image: post.image,
        imageAlt: post.image_alt,
        author: post.author,
        extraLinks: `        <meta property="og:type" content="article" />
        <meta property="article:published_time" content="${post.date}" />`,
    }) + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <header class="post-head">
                <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">${esc(post.title)}</h1>
${subLine}                <p class="post-meta no-justify">${meta.join(SEP)}</p>
${noteLine}${tagLine}            </header>
${lead}${post.html}            <hr class="center-rule" style="margin-top: 2.6rem" />
${seeAlso}            <p class="post-meta no-justify" style="text-align: center">
                <a class="${LINK}" href="/blog/">All posts</a>
            </p>
        </main>

${FOOTER}
    </body>
</html>
`;
}

function indexPage(posts) {
    /* A row says who wrote it only when that is not the obvious answer. Printing
     * "Ben Meadows" beside every entry on Ben's own site is noise; printing it
     * beside the two that someone else wrote is the whole point. */
    const row = (p) => {
        const who = p.author.id === "ben"
            ? longDate(p.date)
            : `${esc(p.author.name)} &middot; ${longDate(p.date)}`;
        return `                <li><a href="${p.url}">${esc(p.title)}<span class="who">${who}</span></a></li>`;
    };

    const pinned = posts.filter((p) => p.pin).sort((a, b) => a.pin - b.pin);
    const rest = posts.filter((p) => !p.pin);

    /* Pinned posts are not repeated below. At this length the list fits on one
     * screen and showing a post twice reads as a mistake rather than emphasis;
     * revisit if the archive ever outgrows a single view. */
    const group = (label, list, first) => !list.length ? "" :
        `            <h2 class="section-label" style="margin-top: ${first ? "2.6rem" : "3rem"}">${label}</h2>
            <ul class="toc">
${list.map(row).join("\n")}
            </ul>
`;

    return head({
        title: "Blog · TheBenMeadows",
        description: "Longer writing about art and technology, by Ben Meadows.",
        url: "/blog/",
    }) + `        <main class="text-neutral-400 max-w-screen-md mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <h1 class="text-white text-3xl font-bold text-center" style="letter-spacing: -0.025em">Blog</h1>
            <p class="mt-4">
                Longer writing about art and technology. These
                posts moved here from a subdomain that ran a separate content
                system; they are plain markdown in the same repository as the rest
                of the site now, so they ride to every mirror with everything else.
                The <a class="${LINK}" href="/blog/feed.xml">feed</a> is Atom, and
                it stays in date order whatever this page does.
            </p>
            <hr class="center-rule" style="margin-top: 2.2rem; margin-bottom: 0" />

${group("Start here", pinned, true)}${group(pinned.length ? "More posts" : "Posts", rest, !pinned.length)}        </main>

${FOOTER}
    </body>
</html>
`;
}

/* The release feed in build-feed.mjs and this one are deliberately separate:
 * one announces that the site was published, the other announces that something
 * was written. A reader who wants one rarely wants the other.
 *
 * ORDER HERE IS ALWAYS BY DATE, never by pin. Pinning is a decision about a page
 * a reader chooses to open; a feed is pushed at people who have already read what
 * came before, and re-ordering it re-surfaces old entries as if they were new.
 * The index may promote a post. The feed may not.
 *
 * Every entry carries its own author. Atom lets an entry-level author override
 * the feed-level one (RFC 4287 §4.2.1), which is what makes a guest post or an
 * agent post readable as such in a reader that shows bylines. */
function feed(posts) {
    const byDate = [...posts].sort((a, b) =>
        a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date));
    const latest = byDate[0];

    const authorTag = (a) => {
        const uri = authorUri(a);
        return `        <author><name>${esc(authorName(a))}</name>` +
               (uri ? `<uri>${esc(uri)}</uri>` : "") +
               `</author>`;
    };

    const entries = byDate.map((p) => `    <entry>
        <title>${esc(p.title)}</title>
        <link rel="alternate" type="text/html" href="${SITE}${p.url}" />
        <id>${SITE}${p.url}</id>
${authorTag(p.author)}
        <updated>${p.updated || p.date}T00:00:00Z</updated>
        <published>${p.date}T00:00:00Z</published>
        <summary>${esc(p.description)}</summary>
    </entry>`).join("\n");

    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <title>TheBenMeadows — Blog</title>
    <subtitle>Longer writing about art and technology.</subtitle>
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
        related: meta.related ?? [],
        author: authorOf(meta.author, file),
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

/* ---- related, and the backlinks that come free with it ---------------
 *
 * `related:` takes post slugs and site paths. A slug gets a link both ways: if
 * this post names that one, that one names this one back, without anyone having
 * to remember to edit both files. A site path (/art/essentialism/) links one way
 * only -- the hand-written pages are not generated here, so nothing can be
 * inserted into them -- and its title is read out of the page it points at
 * rather than typed here, where it would drift.
 *
 * Everything resolves at build time. A slug or path that does not exist fails
 * the build rather than shipping a dead "see also". */
const bySlug = new Map(posts.map((p) => [p.slug, p]));

function sitePageTitle(path) {
    const file = join(ROOT, path.replace(/^\//, ""), "index.html");
    if (!existsSync(file)) throw new Error(`build-blog: related page not found: ${path}`);
    const m = readFileSync(file, "utf8").match(/<title>([\s\S]*?)<\/title>/i);
    if (!m) throw new Error(`build-blog: related page has no <title>: ${path}`);
    return m[1].replace(/\s*·\s*TheBenMeadows\s*$/, "").trim();
}

const backlinks = new Map(posts.map((p) => [p.slug, new Set()]));
for (const p of posts) {
    for (const ref of p.related) {
        if (ref.startsWith("/")) continue;
        if (!bySlug.has(ref)) {
            throw new Error(`build-blog: ${p.slug} lists related post "${ref}", which does not exist`);
        }
        if (ref === p.slug) throw new Error(`build-blog: ${p.slug} lists itself as related`);
        backlinks.get(ref).add(p.slug);
    }
}

for (const p of posts) {
    const seen = new Set();
    p.seeAlso = [];
    for (const ref of [...p.related, ...backlinks.get(p.slug)]) {
        if (seen.has(ref)) continue;
        seen.add(ref);
        if (ref.startsWith("/")) {
            p.seeAlso.push({ url: ref, title: sitePageTitle(ref), who: ref });
        } else {
            const t = bySlug.get(ref);
            p.seeAlso.push({
                url: t.url,
                title: t.title,
                who: t.author.id === "ben" ? longDate(t.date) : `${t.author.name} · ${longDate(t.date)}`,
            });
        }
    }
}

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
