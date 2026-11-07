/* Render /news: one dated list of what shipped, from six places.
 *
 *   news/sources.json   GitHub releases, Zenodo records, experiment first-commit dates
 *                       (fetched daily by scripts/fetch-news.mjs and committed)
 *   news/sources.json   also: one model-written line per site per finished week
 *   news/entries.json   hand-kept: site launches and redesigns, art, the site list,
 *                       the hide and skip lists, project names and text overrides
 *   blog/posts/*.md     listed posts
 *   ai/wins.json        the outcomes /ai shows
 *   experiments/<x>/    each page's own <title> and description
 *
 * Writes news/index.html, news/feed.xml (Atom), and up to three entries from the last
 * 30 days into the marked block on the home page.
 *
 * DETERMINISM IS THE CONTRACT, as in build-blog.mjs: output derives from tracked files
 * only, never the clock or the network, so both hosts and every mirror serve the same
 * bytes. Dates stay the ISO strings they arrive as and are never put through a Date
 * object in local time.
 *
 * Runs before Tailwind in `npm run build`, so the utilities below exist on disk when
 * the stylesheet is scanned.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { frontMatter } from "./lib/front-matter.mjs";
import { NAME_PATTERN } from "./lib/names.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://thebenmeadows.com";
const TITLE = "News · TheBenMeadows";
const DESCRIPTION = "What shipped, newest first: releases, site launches, papers, posts, experiments and outside results.";
const HOME_COUNT = 3;
const HOME_DAYS = 30;
const FEED_COUNT = 50;

const read = (p) => readFileSync(join(ROOT, p), "utf8");
/* XML 1.0 forbids C0 controls other than tab, newline and carriage return; one in a
 * release note would make the whole feed unparseable, so they are dropped here. */
const esc = (s) => String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const KINDS = {
    release: "Release",
    site: "Site",
    art: "Art",
    paper: "Paper",
    data: "Data",
    post: "Post",
    experiment: "Experiment",
    win: "Result",
    outside: "Contribution",
};

/* ------------------------------------------------------------------ */
/* validation of the hand-kept file                                     */

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const realDate = (d) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? "")) return false;
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === d;
};

function checkEntry(e, i, seen, fail) {
    const where = `news/entries.json entries[${i}]${e?.id ? ` (${e.id})` : ""}`;
    if (!ID_PATTERN.test(e?.id ?? "")) fail(where, "`id` must be lower-case kebab-case");
    else if (seen.has(e.id)) fail(where, `duplicate id "${e.id}"`);
    else seen.add(e.id);
    if (!realDate(e?.date)) fail(where, "`date` must be a real YYYY-MM-DD");
    if (e?.kind !== "site" && e?.kind !== "art") fail(where, '`kind` must be "site" or "art"');
    for (const f of ["project", "title", "summary"]) {
        if (typeof e?.[f] !== "string" || !e[f].trim()) fail(where, `\`${f}\` is required`);
    }
    if (typeof e?.url !== "string" || !e.url.startsWith("https://")) fail(where, "`url` must be an absolute https URL");
    const named = `${e?.title ?? ""} ${e?.summary ?? ""}`.match(NAME_PATTERN);
    if (named) fail(where, `names a tool or agent ("${named[0]}")`);
}

function validate(hand) {
    const errors = [];
    const fail = (where, msg) => errors.push(`${where}: ${msg}`);
    if (!Array.isArray(hand.entries)) fail("news/entries.json", "`entries` must be an array");
    if (!Array.isArray(hand.skip)) fail("news/entries.json", "`skip` must be an array of owner/repo");
    if (!Array.isArray(hand.hide ?? [])) fail("news/entries.json", "`hide` must be an array of entry ids");
    for (const [repo, site] of Object.entries(hand.sites ?? {})) {
        const where = `news/entries.json sites["${repo}"]`;
        if (!site?.project || !site?.url?.startsWith("https://")) fail(where, "needs `project` and an absolute https `url`");
        if (site?.since && !realDate(site.since)) fail(where, "`since` must be a real YYYY-MM-DD");
    }
    const seen = new Set();
    (hand.entries ?? []).forEach((e, i) => checkEntry(e, i, seen, fail));
    for (const [key, text] of Object.entries(hand.overrides ?? {})) {
        if (!/^[^/@\s]+\/[^/@\s]+@\S+$/.test(key)) fail(`news/entries.json overrides["${key}"]`, "key must be owner/repo@tag");
        const named = String(text).match(NAME_PATTERN);
        if (named) fail(`news/entries.json overrides["${key}"]`, `names a tool or agent ("${named[0]}")`);
    }
    if (errors.length) {
        console.error(`news              ${errors.length} problem(s):`);
        for (const e of errors) console.error(`  ${e}`);
        process.exit(1);
    }
}

/* ------------------------------------------------------------------ */
/* the one-line summary of a release                                    */

const plain = (s) => s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]+/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

const SKIP_LINE = /^(#|\||<!--|>|full changelog|what's changed|\*\*full changelog)/i;
const ABBREV = /\b(?:e\.g|i\.e|etc|vs|approx|no|st|mr|mrs|dr)\.$/i;

/* Prose lines only: fenced code and the inside of multi-line HTML comments are skipped,
 * so an install command or a hidden note is never published as the summary. */
function proseLines(notes) {
    const out = [];
    let fence = false, comment = false;
    for (const raw of (notes ?? "").split("\n")) {
        const l = raw.trim();
        if (l.startsWith("```")) { fence = !fence; continue; }
        if (fence) continue;
        if (comment) { if (l.includes("-->")) comment = false; continue; }
        if (l.startsWith("<!--") && !l.includes("-->")) { comment = true; continue; }
        out.push(l);
    }
    return out;
}

function firstSentence(text) {
    const re = /[.!?](?=\s+[A-Z(]|$)/g;
    for (let m; (m = re.exec(text)); ) {
        if (!ABBREV.test(text.slice(0, m.index + 1))) return text.slice(0, m.index + 1);
    }
    return text;
}

/* The first sentence of the first prose line, cut at a word near 220 characters. */
function firstLine(notes) {
    const line = proseLines(notes).find((l) => l && !SKIP_LINE.test(l) && plain(l).length > 12);
    if (!line) return "";
    const text = plain(line);
    const sentence = firstSentence(text);
    if (sentence.length <= 220) return sentence;
    return `${sentence.slice(0, 220).replace(/\s+\S*$/, "")}…`;
}

/* ------------------------------------------------------------------ */
/* grouping: one entry per project per ISO week                         */

function isoWeek(date) {
    const d = new Date(`${date}T00:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - day + 3);
    const year = d.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
    return `${year}-W${String(week).padStart(2, "0")}`;
}

/* Versions compare chunk by chunk, digits as numbers and the rest by code unit, so the
 * order cannot depend on the ICU data of whichever host builds; localeCompare could. */
function versionCompare(a, b) {
    const ca = String(a).match(/\d+|\D+/g) ?? [];
    const cb = String(b).match(/\d+|\D+/g) ?? [];
    for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
        const x = ca[i] ?? "", y = cb[i] ?? "";
        if (x === y) continue;
        const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
        if (nx && ny && Number(x) !== Number(y)) return Number(x) - Number(y);
        return x < y ? -1 : 1;
    }
    return 0;
}
const byNewest = (a, b) => {
    const ta = a.published ?? a.date, tb = b.published ?? b.date;
    if (ta !== tb) return ta < tb ? 1 : -1;
    return versionCompare(b.tag, a.tag) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
};

function groupBy(items, key) {
    const groups = new Map();
    for (const it of items) {
        const k = key(it);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(it);
    }
    return [...groups.values()];
}

/* Ids name what an entry IS (a repo's week, a record's week), not its newest member,
 * so a second release in the same week updates the entry instead of replacing it in
 * every feed reader. */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const version = (tag) => tag.replace(/^v(?=\d)/, "");

function releaseEntries(sources, hand) {
    const skip = new Set(hand.skip);
    const kept = sources.releases.filter((r) => !skip.has(r.repo));
    return groupBy(kept, (r) => `${r.repo} ${isoWeek(r.date)}`).map((group) => {
        const list = [...group].sort(byNewest);
        const newest = list[0];
        const oldest = list.at(-1);
        const project = hand.projects?.[newest.repo] ?? { name: newest.repo.split("/")[1], url: `https://github.com/${newest.repo}` };
        const span = list.length === 1 ? version(newest.tag) : `${version(oldest.tag)} to ${version(newest.tag)}`;
        let summary = hand.overrides?.[`${newest.repo}@${newest.tag}`] ?? firstLine(newest.notes);
        const named = summary.match(NAME_PATTERN);
        if (named) {
            console.warn(`news              ${newest.repo}@${newest.tag}: release line names "${named[0]}"; left out (add an override)`);
            summary = "";
        }
        return {
            id: `release-${slug(newest.repo)}-${isoWeek(newest.date).toLowerCase()}`,
            date: newest.date,
            kind: "release",
            project: project.name,
            projectUrl: project.url,
            title: `${project.name} ${span}`,
            url: newest.url,
            summary,
        };
    });
}

/* Zenodo accepts partial dates ("2026", "2026-11"); the week and month math needs a
 * full day, so such a record waits until it has one rather than breaking the build. */
function zenodoEntries(sources) {
    const dated = sources.zenodo.filter((z) => {
        if (realDate(z.date)) return true;
        console.warn(`news              zenodo ${z.url}: date "${z.date}" is not YYYY-MM-DD; left out`);
        return false;
    });
    return groupBy(dated, (z) => `${z.concept} ${isoWeek(z.date)}`).map((group) => {
        const list = [...group].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1)
            : versionCompare(b.version, a.version) || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0)));
        const newest = list[0];
        const versions = list.map((z) => z.version).filter(Boolean);
        const summary = versions.length === 0 ? "Published on Zenodo."
            : versions.length === 1 ? `Version ${versions[0]} on Zenodo.`
            : `Versions ${versions.at(-1)} to ${versions[0]} on Zenodo.`;
        return {
            id: `zenodo-${slug(newest.concept)}-${isoWeek(newest.date).toLowerCase()}`,
            date: newest.date,
            kind: newest.type === "publication" ? "paper" : "data",
            project: "Zenodo",
            projectUrl: "https://zenodo.org/search?q=creators.name%3A%22Meadows%2C%20Benjamin%22",
            title: newest.title,
            url: newest.url,
            summary,
        };
    });
}

function postEntries() {
    const dir = join(ROOT, "blog", "posts");
    return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().flatMap((file) => {
        const { meta } = frontMatter(readFileSync(join(dir, file), "utf8"), file);
        if (meta.unlisted) return [];
        const slug = file.replace(/\.md$/, "");
        return [{
            id: `post-${slug}`,
            date: meta.date,
            kind: "post",
            project: "Blog",
            projectUrl: `${SITE}/blog/`,
            title: meta.title,
            url: `${SITE}/blog/${slug}/`,
            summary: firstLine(meta.description),
        }];
    });
}

/* A GitHub pull request or issue URL reduced to the item itself (no fragment, query,
 * trailing slash or /files-style subpage), so /ai links and search results compare. */
function itemUrl(url) {
    const u = String(url).split(/[#?]/)[0].replace(/\/+$/, "");
    const m = u.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+\/(?:pull|issues)\/\d+)/);
    return m ? m[1] : u;
}

/* Every GitHub item an /ai result links to. */
function winLinks() {
    const data = JSON.parse(read("ai/wins.json"));
    return new Set(data.wins.flatMap((w) => (w.links ?? []).map((l) => itemUrl(l.url))));
}

function winEntries() {
    const data = JSON.parse(read("ai/wins.json"));
    return data.wins.map((w) => ({
        id: `win-${w.id}`,
        date: w.date,
        kind: "win",
        project: w.where,
        projectUrl: `${SITE}/ai/`,
        title: w.title,
        url: `${SITE}/ai/#${w.id}`,
        summary: firstLine(w.summary),
    }));
}

/* An experiment page's own title and description, so the entry cannot drift from
 * the page. The site suffix is stripped however the page spells its separator. */
function pageMeta(file) {
    const html = read(file);
    const title = (html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "")
        .replace(/\s*(?:·|&middot;|\||-)\s*TheBenMeadows\s*$/i, "")
        .replace(/&amp;/g, "&")
        .trim();
    const description = (html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1] ?? "")
        .replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    return { title, description };
}

function experimentEntries(sources) {
    return sources.experiments
        .filter((x) => existsSync(join(ROOT, "experiments", x.slug, "index.html")))
        .map((x) => {
            const { title, description } = pageMeta(`experiments/${x.slug}/index.html`);
            return {
                id: `experiment-${x.slug}`,
                date: x.date,
                kind: "experiment",
                project: "Experiments",
                projectUrl: `${SITE}/experiments/`,
                title: title || x.slug,
                url: `${SITE}/experiments/${x.slug}/`,
                summary: description,
            };
        });
}

/* A site's finished week, as the model wrote it in scripts/fetch-news.mjs. A line
 * that still names a tool or agent is dropped, as an automatic release line is. */
function siteWeekEntries(sources, hand) {
    return (sources.siteWeeks ?? []).filter((w) => w.announce).flatMap((w) => {
        const site = hand.sites?.[w.repo];
        if (!site) return [];
        const named = `${w.title} ${w.summary}`.match(NAME_PATTERN);
        if (named) {
            console.warn(`news              ${w.repo} week ${w.week}: names "${named[0]}"; left out`);
            return [];
        }
        return [{
            id: `site-${slug(w.repo)}-${w.week}`,
            date: w.date,
            kind: "site",
            project: site.project,
            projectUrl: site.url,
            title: w.title,
            url: site.url,
            summary: w.summary,
        }];
    });
}

/* Work merged or fixed in other people's projects, one entry per project per week.
 * An item an /ai result already links to is left to that result, so the same work
 * does not appear twice. The project is named; who did the work is not. */
const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const count = (n, one, many) => `${NUMBERS[n] ?? n} ${n === 1 ? one : many}`;
/* An upstream title as a sentence: no "fix(scope):" or "[Bug]" prefix, capitalised,
 * cut at a word near 160 characters. */
const cleanTitle = (t) => {
    let s = plain(t).replace(/^(\[[^\]]*\]\s*)+/, "")
        .replace(/^(?:fix|feat|perf|refactor|chore|docs|test|tests|build|ci|style|revert)(\([^)]*\))?!?:\s*/i, "");
    if (s.length > 160) s = `${s.slice(0, 160).replace(/\s+\S*$/, "")}…`;
    return s.charAt(0).toUpperCase() + s.slice(1);
};

function outsideEntries(sources, winLinks) {
    const o = sources.outside ?? {};
    const items = [
        ...(o.pulls ?? []).filter((x) => x.accepted !== false).map((x) => ({ ...x, type: "pull" })),
        ...(o.issues ?? []).filter((x) => x.fixed).map((x) => ({ ...x, type: "issue" })),
    ].filter((x) => !winLinks.has(itemUrl(x.url)) && realDate(x.date));
    /* A merged pull request usually closes the issue it fixes, on the same day: that is
     * one piece of work, counted once, as the change. */
    const pullDays = new Set(items.filter((x) => x.type === "pull").map((x) => `${x.repo} ${x.date}`));
    const counted = items.filter((x) => x.type === "pull" || !pullDays.has(`${x.repo} ${x.date}`));
    return groupBy(counted, (x) => `${x.repo} ${isoWeek(x.date)}`).map((group) => {
        const list = [...group].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.number - a.number));
        const newest = list[0];
        const nPulls = list.filter((x) => x.type === "pull").length;
        const nIssues = list.length - nPulls;
        const parts = [];
        if (nPulls) parts.push(`${count(nPulls, "change", "changes")} merged`);
        if (nIssues) parts.push(`${parts.length ? count(nIssues, "reported issue", "reported issues").toLowerCase() : count(nIssues, "reported issue", "reported issues")} resolved`);
        let summary = cleanTitle(newest.title);
        if (summary && list.length > 1) summary = `${summary.replace(/[.!?]$/, "")}, and ${list.length - 1} more.`;
        else if (summary && !/[.!?]$/.test(summary)) summary = `${summary}.`;
        if (NAME_PATTERN.test(summary)) summary = "";
        return {
            id: `outside-${slug(newest.repo)}-${isoWeek(newest.date).toLowerCase()}`,
            date: newest.date,
            kind: "outside",
            project: newest.repo.split("/")[1],
            projectUrl: `https://github.com/${newest.repo}`,
            title: parts.join(", "),
            url: newest.url,
            summary,
        };
    });
}

function handEntries(hand) {
    return hand.entries.map((e) => ({
        id: e.id,
        date: e.date,
        kind: e.kind,
        project: e.project,
        projectUrl: e.url,
        title: e.title,
        url: e.url,
        summary: e.summary,
    }));
}

/* ------------------------------------------------------------------ */
/* rendering                                                            */

const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const shortDate = (iso) => `${MONTHS[Number(iso.slice(5, 7)) - 1].slice(0, 3)} ${Number(iso.slice(8, 10))}`;
const ext = (url) => (url.startsWith(SITE) ? "" : ' target="_blank" rel="noopener"');
const local = (url) => (url.startsWith(SITE) ? url.slice(SITE.length) || "/" : url);

/* Entries are set ragged with no hyphenation (.no-justify is the site's opt-out):
 * justified, a short title or a mono meta line spreads across a phone-width column. */
function item(e) {
    const summary = e.summary ? `\n                    <p class="mt-1 text-sm text-neutral-400">${esc(e.summary)}</p>` : "";
    return `                <li id="${esc(e.id)}" class="no-justify py-4" style="border-bottom: 1px solid var(--rule); hyphens: manual">
                    <div class="font-mono text-xs uppercase tracking-widest text-neutral-500">
                        <time datetime="${e.date}">${shortDate(e.date)}</time> &middot; ${esc(KINDS[e.kind])} &middot;
                        <a class="hover:text-white transition-colors" href="${esc(local(e.projectUrl))}"${ext(e.projectUrl)}>${esc(e.project)}</a>
                    </div>
                    <h3 class="mt-2 text-lg font-bold text-white"><a class="hover:opacity-70 transition-opacity" href="${esc(local(e.url))}"${ext(e.url)}>${esc(e.title)}</a></h3>${summary}
                </li>`;
}

function body(all) {
    return groupBy(all, (e) => e.date.slice(0, 7)).map((month) => `
            <h2 class="mt-10 font-mono text-xs uppercase tracking-widest text-neutral-500">${monthOf(month[0].date)}</h2>
            <ul class="mt-2">
${month.map(item).join("\n")}
            </ul>`).join("\n");
}

function page(all) {
    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content="${esc(DESCRIPTION)}" />
        <meta name="color-scheme" content="dark light" />
        <link rel="canonical" href="${SITE}/news/" />
        <link rel="alternate" type="application/atom+xml" title="News" href="/news/feed.xml" />

        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="TheBenMeadows" />
        <meta property="og:title" content="${esc(TITLE)}" />
        <meta property="og:description" content="${esc(DESCRIPTION)}" />
        <meta property="og:url" content="${SITE}/news/" />
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
        <main class="text-neutral-400 max-w-(--breakpoint-md) mx-auto px-6 pt-8 pb-12 leading-relaxed">
            <h1 class="text-white text-3xl font-bold" style="letter-spacing: -0.025em">News</h1>
            <p class="mt-4">
                What shipped, newest first: software releases, site launches, papers,
                posts, experiments and the outside results listed under
                <a class="underline decoration-neutral-600 underline-offset-4 hover:text-white transition-colors" href="/ai/">AI &amp; Agents</a>.
                Releases from the same project in the same week share one entry.
                The <a class="underline decoration-neutral-600 underline-offset-4 hover:text-white transition-colors" href="/news/feed.xml">feed</a> is Atom.
            </p>
            <hr class="center-rule" style="margin-top: 2.2rem; margin-bottom: 0" />
${body(all)}
        </main>

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
    </body>
</html>
`;
}

/* Atom. Entry ids are tag URIs built from the entry id, so an entry keeps its id
 * when its text changes and a reader does not show it twice. */
function feed(all) {
    const entries = all.slice(0, FEED_COUNT).map((e) => `  <entry>
    <id>tag:thebenmeadows.com,2026:news/${esc(e.id)}</id>
    <title>${esc(`${e.title}`)}</title>
    <link rel="alternate" type="text/html" href="${esc(e.url)}" />
    <updated>${e.date}T00:00:00Z</updated>
    <category term="${e.kind}" label="${esc(KINDS[e.kind])}" />
    <summary>${esc(`${KINDS[e.kind]} · ${e.project}${e.summary ? `. ${e.summary}` : ""}`)}</summary>
  </entry>`).join("\n");
    return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${SITE}/news/</id>
  <title>TheBenMeadows · News</title>
  <subtitle>${esc(DESCRIPTION)}</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE}/news/feed.xml" />
  <link rel="alternate" type="text/html" href="${SITE}/news/" />
  <link rel="hub" href="https://pubsubhubbub.appspot.com/" />
  <updated>${all[0].date}T00:00:00Z</updated>
  <author>
    <name>Benjamin Meadows</name>
    <uri>${SITE}/</uri>
  </author>
${entries}
</feed>
`;
}

/* The newest entries on the home page, between two markers in index.html. The block
 * is rewritten in place, so the committed home page and the served one match once a
 * build has run and its result is committed.
 *
 * The block shows at most HOME_COUNT entries from the HOME_DAYS days up to its as-of
 * date, so a quiet month hides the section instead of leaving old news on the home
 * page; /news stays linked from the Writing section below it. The
 * as-of date lives in the start marker, which keeps the build clock-free: hosts and
 * local builds reuse the committed date and rebuild the same bytes. Only the daily
 * refresh passes today's date (NEWS_AS_OF), and the marker moves only when that changes
 * which rows show, so most days produce no diff. A marker without a date means no
 * window. */
const HOME_START_RE = /<!-- news:start(?: as-of=(\d{4}-\d{2}-\d{2}))? -->/;
const HOME_END = "<!-- news:end -->";

const daysBefore = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

function homeRows(all, asOf) {
    /* The home page leads with this site's own work; contributions to other projects
     * stay on /news and in the feed. */
    const from = asOf ? daysBefore(asOf, HOME_DAYS) : "";
    return all.filter((e) => e.kind !== "outside" && e.date > from).slice(0, HOME_COUNT).map((e) =>
        `                <li class="no-justify"><a href="${esc(local(e.url))}"${ext(e.url)}><span class="lede">${esc(e.title)}<span class="marks">${esc(KINDS[e.kind])} &middot; ${shortDate(e.date)}</span></span><span class="who">${esc(e.project)}</span></a></li>`);
}

function homeBlock(rows, asOf) {
    const start = `<!-- news:start${asOf ? ` as-of=${asOf}` : ""} -->`;
    if (rows.length === 0) return `${start}
            ${HOME_END}`;
    return `${start}
            <h2 class="section-label">News</h2>
            <ul class="toc">
${[...rows, `                <li><a href="/news/">All news<span class="who">releases, launches &amp; papers</span></a></li>`].join("\n")}
            </ul>
            ${HOME_END}`;
}

function writeHome(all) {
    const html = read("index.html");
    const m = HOME_START_RE.exec(html);
    const b = html.indexOf(HOME_END);
    if (!m || b < m.index) throw new Error("build-news: index.html has no <!-- news:start --> ... <!-- news:end --> block");
    const committed = m[1];
    const today = process.env.NEWS_AS_OF;
    if (today && !realDate(today)) throw new Error("build-news: NEWS_AS_OF must be a real YYYY-MM-DD");
    let asOf = committed;
    let rows = homeRows(all, committed);
    if (today && today > (committed ?? "")) {
        const fresh = homeRows(all, today);
        if (fresh.join("\n") !== rows.join("\n")) [asOf, rows] = [today, fresh];
    }
    const next = html.slice(0, m.index) + homeBlock(rows, asOf) + html.slice(b + HOME_END.length);
    if (next !== html) writeFileSync(join(ROOT, "index.html"), next, "utf8");
}

/* ------------------------------------------------------------------ */
/* run                                                                  */

const hand = JSON.parse(read("news/entries.json"));
validate(hand);
const sources = JSON.parse(read("news/sources.json"));

const all = [
    ...releaseEntries(sources, hand),
    ...zenodoEntries(sources),
    ...postEntries(),
    ...winEntries(),
    ...experimentEntries(sources),
    ...siteWeekEntries(sources, hand),
    ...outsideEntries(sources, winLinks()),
    ...handEntries(hand),
].filter((e) => !(hand.hide ?? []).includes(e.id)).sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? -1 : 1));

if (all.length === 0) throw new Error("build-news: no entries at all; refusing to write an empty page and feed");

const ids = new Set();
for (const e of all) {
    if (ids.has(e.id)) throw new Error(`build-news: two entries share the id "${e.id}"`);
    ids.add(e.id);
}

writeFileSync(join(ROOT, "news", "index.html"), page(all), "utf8");
writeFileSync(join(ROOT, "news", "feed.xml"), feed(all), "utf8");
writeHome(all);
console.log(`news page         ${all.length} entries -> news/index.html, news/feed.xml, index.html`);
