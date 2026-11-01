/* Send webmentions from blog posts to the pages they link to (W3C Webmention,
 * https://www.w3.org/TR/webmention/). Send-only: this site has no receiving
 * endpoint and advertises none.
 *
 * Deliberately NOT part of any build. A webmention is a request to someone
 * else's server, and a deploy that fires them would repeat that on every host
 * that builds this tree. It runs by hand, after a build, against the built
 * posts:
 *
 *   npm run build
 *   node scripts/send-webmentions.mjs                 dry run: discover, print, send nothing
 *   node scripts/send-webmentions.mjs --send          send, and record each success
 *   node scripts/send-webmentions.mjs --source <url>  only the post at that URL (either mode)
 *   node scripts/send-webmentions.mjs --json <file>   also write the run's results as JSON
 *   node scripts/send-webmentions.mjs --discover <url>  print one page's endpoint and stop
 *
 * The dry run still fetches every target page once, because discovering the
 * endpoint is the only way to know whether there is anything to send. It never
 * POSTs.
 *
 * Each (source, target) pair is sent ONCE. A success is recorded in
 * webmentions/sent.json, which is committed, so a later run -- on this machine
 * or any other -- skips it. A failure is not recorded and is tried again next
 * run.
 *
 * Skipped without a request: links to this site and its mirrors, site-relative
 * links, mailto: and every other non-http(s) scheme, and links in unlisted
 * posts (those are superseded versions the current post links to).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://thebenmeadows.com";
const STATE = join(ROOT, "webmentions", "sent.json");
const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;
const MAX_BYTES = 1024 * 1024;
const UA = "thebenmeadows.com webmention sender (+https://thebenmeadows.com/)";

/* ------------------------------------------------------------------ */
/* arguments                                                            */

function parseArgs(argv) {
    const args = { send: false, source: null, json: null, discover: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--send") args.send = true;
        else if (a === "--source") args.source = argv[++i];
        else if (a === "--json") args.json = argv[++i];
        else if (a === "--discover") args.discover.push(argv[++i]);
        else throw new Error(`send-webmentions: unknown argument ${a}`);
    }
    if (args.source === undefined || args.json === undefined || args.discover.includes(undefined)) {
        throw new Error("send-webmentions: a flag is missing its value");
    }
    if (args.send && args.discover.length) throw new Error("send-webmentions: --discover never sends; drop --send");
    return args;
}

/* ------------------------------------------------------------------ */
/* which hosts are this site                                            */

/* The site's own host and every subdomain, plus each mirror that serves the
 * whole site at its root. A forge or an archive listed in mirrors.json is
 * someone else's site that happens to hold a copy, so it is not on this list. */
function ownHosts() {
    const hosts = new Set(["thebenmeadows.com"]);
    const mirrors = JSON.parse(readFileSync(join(ROOT, "mirrors.json"), "utf8")).mirrors;
    for (const url of JSON.stringify(mirrors).match(/https?:\/\/[^"\s]+/g) ?? []) {
        const u = new URL(url);
        if (u.pathname === "/") hosts.add(u.hostname.toLowerCase());
    }
    return hosts;
}

function isOwn(url, hosts) {
    const h = url.hostname.toLowerCase();
    return hosts.has(h) || h.endsWith(".thebenmeadows.com");
}

/* ------------------------------------------------------------------ */
/* reading the built posts                                              */

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e]);

/* The attributes of one start tag, names lower-cased, values decoded. */
function attrs(tag) {
    const out = {};
    const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
    const body = tag.replace(/^<[a-z0-9]+/i, "").replace(/\/?>$/, "");
    for (const m of body.matchAll(re)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
    return out;
}

/* The inner HTML of the post's e-content element. build-blog.mjs writes it as
 * a single <div class="e-content">, and a post body can contain divs of its
 * own (a table's scroller), so the end is found by counting div depth. */
function eContent(html, file) {
    const open = html.match(/<div class="e-content">/);
    if (!open) throw new Error(`send-webmentions: ${file} has no e-content -- build the site first`);
    const start = open.index + open[0].length;
    const re = /<\/?div\b[^>]*>/gi;
    re.lastIndex = start;
    let depth = 1;
    for (let m; (m = re.exec(html));) {
        depth += m[0][1] === "/" ? -1 : 1;
        if (depth === 0) return html.slice(start, m.index);
    }
    throw new Error(`send-webmentions: ${file} e-content is not closed`);
}

/* Every outbound http(s) link in the post body, in document order, once each. */
function outboundLinks(content, hosts) {
    const seen = new Set();
    const out = [];
    for (const m of content.matchAll(/<a\b[^>]*>/gi)) {
        const href = attrs(m[0]).href;
        if (!href || !/^https?:\/\//i.test(href)) continue;
        let url;
        try { url = new URL(href); } catch { continue; }
        if (isOwn(url, hosts)) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        out.push(href);
    }
    return out;
}

function readPosts(hosts, only) {
    const list = join(ROOT, "blog", "pages.json");
    if (!existsSync(list)) throw new Error("send-webmentions: blog/pages.json not found -- run npm run build first");
    const pages = JSON.parse(readFileSync(list, "utf8")).pages
        .filter((p) => p.url !== "/blog/" && !p.unlisted);
    const posts = [];
    for (const p of pages) {
        const source = SITE + p.url;
        if (only && only !== source) continue;
        const html = readFileSync(join(ROOT, p.file), "utf8");
        posts.push({ source, targets: outboundLinks(eContent(html, p.file), hosts) });
    }
    if (only && !posts.length) throw new Error(`send-webmentions: no listed post at ${only}`);
    return posts;
}

/* ------------------------------------------------------------------ */
/* endpoint discovery (W3C Webmention §3.1.2)                           */

/* rel values from a Link header, per RFC 8288: comma-separated links, each a
 * <uri> followed by ;-separated parameters, rel quoted or bare, space-separated. */
function linkHeaderEndpoint(header) {
    if (!header) return null;
    for (const m of header.matchAll(/<([^>]*)>([^,<]*(?:"[^"]*"[^,<]*)*)/g)) {
        const rel = m[2].match(/;\s*rel\s*=\s*(?:"([^"]*)"|([^\s;,]+))/i);
        if (!rel) continue;
        if ((rel[1] ?? rel[2]).toLowerCase().split(/\s+/).includes("webmention")) return m[1];
    }
    return null;
}

/* The first <link> or <a> in document order with rel containing "webmention"
 * and an href. An empty href is valid and means the page itself. */
function htmlEndpoint(html) {
    const clean = html.replace(/<!--[\s\S]*?-->/g, "");
    for (const m of clean.matchAll(/<(?:link|a)\b[^>]*>/gi)) {
        const a = attrs(m[0]);
        if (a.href === undefined || !a.rel) continue;
        if (a.rel.toLowerCase().split(/\s+/).includes("webmention")) return a.href;
    }
    return null;
}

async function readCapped(response) {
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) { await reader.cancel(); break; }
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function timed(url, init) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { ...init, signal: control.signal, headers: { "User-Agent": UA, ...init.headers } });
    } finally {
        clearTimeout(timer);
    }
}

async function discover(target) {
    const response = await timed(target, { method: "GET", redirect: "follow", headers: { Accept: "text/html" } });
    const base = response.url || target;
    let href = linkHeaderEndpoint(response.headers.get("link"));
    if (href === null && /html/i.test(response.headers.get("content-type") ?? "")) {
        href = htmlEndpoint(await readCapped(response));
    } else {
        await response.body?.cancel().catch(() => {});
    }
    if (href === null) return { status: response.status, endpoint: null };
    /* Relative to the final URL after redirects; the query string is kept. */
    return { status: response.status, endpoint: new URL(href, base).href };
}

/* The spec's one security requirement on senders: do not post to an endpoint
 * on a loopback or private address, which would let a page aim this script at
 * the machine running it or its LAN. Checked on the resolved address. */
function privateAddress(ip) {
    if (isIP(ip) === 6) {
        const v = ip.toLowerCase();
        if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
        return v === "::1" || v === "::" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v);
    }
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function endpointIsPublic(endpoint) {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addrs.length > 0 && !addrs.some((a) => privateAddress(a.address));
}

/* ------------------------------------------------------------------ */
/* sending                                                              */

async function post(endpoint, source, target) {
    const response = await timed(endpoint, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ source, target }).toString(),
    });
    await response.body?.cancel().catch(() => {});
    return { status: response.status, location: response.headers.get("location") };
}

/* ------------------------------------------------------------------ */
/* state                                                                */

function loadState() {
    if (!existsSync(STATE)) return { sent: {} };
    const s = JSON.parse(readFileSync(STATE, "utf8"));
    s.sent ??= {};
    return s;
}

/* Keys sorted so the committed file diffs cleanly whatever order sends finish in. */
function saveState(state) {
    const sorted = {};
    for (const source of Object.keys(state.sent).sort()) {
        sorted[source] = {};
        for (const target of Object.keys(state.sent[source]).sort()) sorted[source][target] = state.sent[source][target];
    }
    mkdirSync(dirname(STATE), { recursive: true });
    writeFileSync(STATE, JSON.stringify({ ...state, sent: sorted }, null, 2) + "\n", "utf8");
}

/* ------------------------------------------------------------------ */
/* run                                                                  */

async function pool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
}

function describeError(e) {
    return e.name === "AbortError" ? `no answer in ${TIMEOUT_MS / 1000}s` : (e.cause?.code ?? e.message);
}

async function handle(pair, args, state) {
    const { source, target } = pair;
    if (state.sent[source]?.[target]) return { ...pair, result: "already-sent" };
    let found;
    try {
        found = await discover(target);
    } catch (e) {
        return { ...pair, result: "fetch-failed", detail: describeError(e) };
    }
    if (!found.endpoint) return { ...pair, result: "no-endpoint", detail: `HTTP ${found.status}` };
    const endpoint = found.endpoint;
    try {
        if (!(await endpointIsPublic(endpoint))) return { ...pair, endpoint, result: "endpoint-refused", detail: "private or non-http address" };
    } catch (e) {
        return { ...pair, endpoint, result: "endpoint-refused", detail: describeError(e) };
    }
    if (!args.send) return { ...pair, endpoint, result: "would-send" };
    try {
        const r = await post(endpoint, source, target);
        if (r.status >= 200 && r.status < 300) {
            (state.sent[source] ??= {})[target] = {
                endpoint, status: r.status, date: new Date().toISOString(), ...(r.location ? { location: r.location } : {}),
            };
            saveState(state);
            return { ...pair, endpoint, result: "sent", detail: `HTTP ${r.status}` };
        }
        return { ...pair, endpoint, result: "send-failed", detail: `HTTP ${r.status}` };
    } catch (e) {
        return { ...pair, endpoint, result: "send-failed", detail: describeError(e) };
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.discover.length) {
        const found = await pool(args.discover, CONCURRENCY, (url) =>
            discover(url).then((r) => r.endpoint ?? "(none)", (e) => `(failed: ${describeError(e)})`));
        args.discover.forEach((url, i) => console.log(`${url}  ->  ${found[i]}`));
        return;
    }
    const posts = readPosts(ownHosts(), args.source);
    const state = loadState();
    const pairs = posts.flatMap((p) => p.targets.map((target) => ({ source: p.source, target })));

    console.log(`send-webmentions  ${args.send ? "SEND" : "dry run (nothing is sent; pass --send to send)"}`);
    console.log(`                  ${posts.length} posts, ${pairs.length} outbound links\n`);

    const results = await pool(pairs, CONCURRENCY, (pair) => handle(pair, args, state));

    let current = null;
    for (const r of results) {
        if (r.source !== current) { current = r.source; console.log(r.source); }
        const tail = [r.endpoint && `-> ${r.endpoint}`, r.detail && `(${r.detail})`].filter(Boolean).join(" ");
        console.log(`  ${r.result.padEnd(16)} ${r.target}${tail ? "  " + tail : ""}`);
    }

    const counts = {};
    for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
    console.log("\n" + Object.entries(counts).sort().map(([k, v]) => `${k}: ${v}`).join(", "));

    if (args.json) writeFileSync(args.json, JSON.stringify({ send: args.send, counts, results }, null, 2) + "\n", "utf8");
    if (results.some((r) => r.result === "send-failed")) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
