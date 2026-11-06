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
 *
 * A failed request exits non-zero WITHOUT writing: the committed file is the last good
 * copy, and an outage must not empty the page.
 *
 *   GITHUB_TOKEN=... node scripts/fetch-news.mjs
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
                    notes: (r.body || "").slice(0, 4000),
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

const sources = {
    _comment: "Written by scripts/fetch-news.mjs (daily, .github/workflows/news-refresh.yml). Do not edit by hand: hand-written entries, the skip list and text overrides live in news/entries.json.",
    releases: await releases(),
    zenodo: await zenodo(),
    experiments: experiments(),
};

const next = `${JSON.stringify(sources, null, 2)}\n`;
const prev = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
if (next === prev) {
    console.log("news sources      unchanged");
} else {
    writeFileSync(OUT, next, "utf8");
    console.log(`news sources      ${sources.releases.length} releases, ${sources.zenodo.length} zenodo, ${sources.experiments.length} experiments -> news/sources.json`);
}
