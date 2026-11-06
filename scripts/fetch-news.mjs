/* Fetch the outside sources /news is built from and write news/sources.json.
 *
 * The build never touches the network: both hosts and every mirror have to produce
 * the same bytes from the same commit (see scripts/build-stamp.mjs), and two builds a
 * minute apart can see different GitHub releases. So the network pass lives here,
 * run once a day by .github/workflows/news-refresh.yml, and its result is committed.
 * Both hosts then build /news from that commit.
 *
 * It collects:
 *   - GitHub releases from every public, non-fork, non-archived repo in the two orgs
 *     (news/entries.json `skip` hides a repo from the page; it is still fetched here,
 *     so un-skipping it needs no refetch)
 *   - Zenodo records and versions under the credit name
 *   - the commit that first added each /experiments/<slug>/index.html
 *   - one line per finished week of merged pull requests for each repo in
 *     news/entries.json `sites`, written by a model (ANTHROPIC_API_KEY), or a stored
 *     "nothing to announce"; each week is asked once
 *
 * A failed request exits non-zero WITHOUT writing: the committed file is the last good
 * copy, and an outage must not empty the page.
 *
 *   GITHUB_TOKEN=... ANTHROPIC_API_KEY=... node scripts/fetch-news.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "news", "sources.json");
const ORGS = ["TheBenMeadows", "mdws-org"];
const ZENODO_CREATOR = "Meadows, Benjamin";

const headers = { Accept: "application/vnd.github+json", "User-Agent": "thebenmeadows.com news fetch" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function getJson(url, h = headers) {
    const res = await fetch(url, { headers: h });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.json();
}

/* Every page of a GitHub list endpoint. */
async function ghAll(path) {
    const out = [];
    for (let page = 1; ; page++) {
        const sep = path.includes("?") ? "&" : "?";
        const batch = await getJson(`https://api.github.com${path}${sep}per_page=100&page=${page}`);
        out.push(...batch);
        if (batch.length < 100) return out;
    }
}

async function releases() {
    const out = [];
    for (const org of ORGS) {
        const repos = (await ghAll(`/orgs/${org}/repos?type=public`).catch(() => ghAll(`/users/${org}/repos?type=owner`)))
            .filter((r) => !r.private && !r.fork && !r.archived);
        for (const repo of repos) {
            for (const r of await ghAll(`/repos/${repo.full_name}/releases`)) {
                if (r.draft || r.prerelease || !r.published_at) continue;
                out.push({
                    repo: repo.full_name,
                    tag: r.tag_name,
                    name: r.name || "",
                    date: r.published_at.slice(0, 10),
                    url: r.html_url,
                    notes: (r.body || "").slice(0, 1200),
                });
            }
        }
    }
    return out.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : `${a.repo}@${a.tag}` < `${b.repo}@${b.tag}` ? -1 : 1));
}

async function zenodo() {
    const q = encodeURIComponent(`creators.name:"${ZENODO_CREATOR}"`);
    /* Anonymous requests are capped at 25 a page; larger sizes return 400. */
    const hits = [];
    for (let page = 1; ; page++) {
        const data = await getJson(`https://zenodo.org/api/records?q=${q}&all_versions=true&size=25&page=${page}&sort=mostrecent`,
            { Accept: "application/json", "User-Agent": headers["User-Agent"] });
        hits.push(...data.hits.hits);
        if (data.hits.hits.length < 25) break;
    }
    return hits
        .map((h) => ({
            concept: String(h.conceptrecid),
            title: h.metadata.title,
            version: h.metadata.version || "",
            type: h.metadata.resource_type?.type || "",
            date: h.metadata.publication_date,
            url: h.doi_url || `https://doi.org/${h.doi}`,
        }))
        .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.url < b.url ? -1 : 1));
}

/* The date of the commit that added each experiment page. Needs full history, which
 * the workflow's checkout provides (fetch-depth: 0). */
function experiments() {
    const dir = join(ROOT, "experiments");
    return readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "index.html")))
        .map((d) => {
            const dates = execFileSync("git", ["log", "--diff-filter=A", "--follow", "--format=%as", "--", `experiments/${d.name}/index.html`],
                { cwd: ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
            return { slug: d.name, date: dates.at(-1) };
        })
        .filter((e) => e.date)
        .sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* site updates: one line per site per finished week, or nothing        */

/* Sites have no releases, so a week's merged pull requests stand in for one. Most
 * weeks are upkeep (CI, lint, tests), which a reader does not care about; telling
 * the two apart is a judgment call, so a model reads the week and either writes a
 * title and one sentence or declines. Each answer is stored in sources.json under
 * its repo and week and never asked again, so the page stays a function of committed
 * files. A week is asked only once it has ended (Monday-to-Sunday, UTC). */
const MODEL = "claude-opus-5-5";

const PROMPT = `You write entries for the News page of a personal website. Below are the pull requests merged into one of its sites during one week.

Decide whether the week changed anything a visitor to that site would notice or care about: new content, a new feature, a new section, a visible redesign, a fix to something a visitor could hit. Upkeep does not count: CI, linting, tests, dependency bumps, refactors, build tooling, internal docs, security hardening with no visible effect. Small polish does not count either: spacing, hover and tap states, wording tweaks, image crops or orientation, metadata a visitor never sees.

If nothing qualifies, return {"announce": false, "title": "", "summary": ""}.

If something qualifies, return announce true with:
- title: at most 8 words, sentence case, naming the change itself ("Compline and the Three Canons added"), not the week or the site.
- summary: one plain sentence under 160 characters saying what a visitor now finds. No first person, no second person, no hype, no em or en dashes, and no names of software tools, models or agents.

Cover the one or two changes that matter most; leave the rest out.`;

const SCHEMA = {
    type: "object",
    properties: {
        announce: { type: "boolean" },
        title: { type: "string" },
        summary: { type: "string" },
    },
    required: ["announce", "title", "summary"],
    additionalProperties: false,
};

function weekStart(date) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
}

async function mergedPulls(repo) {
    const pulls = await ghAll(`/repos/${repo}/pulls?state=closed&sort=updated&direction=desc`);
    return pulls
        .filter((p) => p.merged_at && p.base.ref === p.base.repo.default_branch)
        .map((p) => ({ date: p.merged_at.slice(0, 10), title: p.title, body: (p.body || "").slice(0, 1500) }));
}

async function askWeek(client, repo, project, pulls) {
    const list = pulls.map((p) => `## ${p.title}\n${p.body}`).join("\n\n");
    const res = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 2000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
        messages: [{ role: "user", content: `${PROMPT}\n\nSite: ${project} (${repo})\n\n${list}` }],
    });
    if (res.stop_reason === "refusal") return { announce: false, title: "", summary: "" };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
}

async function siteWeeks(sites, prevWeeks) {
    const done = new Map(prevWeeks.map((w) => [`${w.repo} ${w.week}`, w]));
    const thisWeek = weekStart(new Date().toISOString().slice(0, 10));
    let client = null;
    if (process.env.ANTHROPIC_API_KEY) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        client = new Anthropic();
    }
    const out = [];
    for (const [repo, site] of Object.entries(sites)) {
        const byWeek = new Map();
        for (const p of await mergedPulls(repo)) {
            const week = weekStart(p.date);
            if (week >= thisWeek || (site.since && p.date < site.since)) continue;
            if (!byWeek.has(week)) byWeek.set(week, []);
            byWeek.get(week).push(p);
        }
        for (const [week, pulls] of byWeek) {
            const key = `${repo} ${week}`;
            if (done.has(key)) { out.push(done.get(key)); continue; }
            if (!client) { console.warn(`news sources      ${key}: no ANTHROPIC_API_KEY, week left for a later run`); continue; }
            let a;
            try {
                a = await askWeek(client, repo, site.project, pulls);
            } catch (err) {
                console.warn(`news sources      ${key}: ${err.message}; left for a later run`);
                continue;
            }
            out.push({
                repo, week, date: pulls.map((p) => p.date).sort().at(-1),
                announce: Boolean(a.announce), title: a.announce ? a.title : "", summary: a.announce ? a.summary : "",
            });
        }
    }
    return out.sort((a, b) => (a.week !== b.week ? (a.week < b.week ? 1 : -1) : a.repo < b.repo ? -1 : 1));
}

const hand = JSON.parse(readFileSync(join(ROOT, "news", "entries.json"), "utf8"));
const prevSources = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

const sources = {
    _comment: "Written by scripts/fetch-news.mjs (daily, .github/workflows/news-refresh.yml). Do not edit by hand: hand-written entries, the skip list and text overrides live in news/entries.json.",
    releases: await releases(),
    zenodo: await zenodo(),
    experiments: experiments(),
    siteWeeks: await siteWeeks(hand.sites ?? {}, prevSources.siteWeeks ?? []),
};

const next = `${JSON.stringify(sources, null, 2)}\n`;
const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if (next === prev) {
    console.log("news sources      unchanged");
} else {
    writeFileSync(OUT, next, "utf8");
    console.log(`news sources      ${sources.releases.length} releases, ${sources.zenodo.length} zenodo, ${sources.experiments.length} experiments -> news/sources.json`);
}
