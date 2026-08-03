/* Builds search-index.json from the site's own HTML, at build time.
 *
 * Zero dependencies on purpose. The whole site is ~10 KB of text, so a real search
 * library would be larger than the corpus it indexes — and Pagefind, the usual pick,
 * runs on WebAssembly, which under this site's `script-src 'self'` CSP would mean
 * adding 'wasm-unsafe-eval'. Loosening the header on a site whose /tech/ page
 * advertises its CSP is not worth it to search six pages.
 *
 * Run by `npm run build`, so Cloudflare Pages picks it up with no dashboard change.
 * The output is gitignored, like output.css.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* One entry per page. Kept as an array so folding in another property later — the
 * blog, the art index — is a one-line change rather than a rewrite. */
const PAGES = [
    { file: 'index.html', url: '/' },
    { file: 'mirrors/index.html', url: '/mirrors/' },
    { file: 'tech/index.html', url: '/tech/' },
    { file: 'experiments/index.html', url: '/experiments/' },
    { file: 'infra/index.html', url: '/infra/' },
    { file: 'essentialism/index.html', url: '/essentialism/' },
    { file: 'experiments/pendulum/index.html', url: '/experiments/pendulum/' },
    { file: 'experiments/porcine/index.html', url: '/experiments/porcine/' },
    { file: 'experiments/etherhoo/index.html', url: '/experiments/etherhoo/' },
    { file: 'experiments/dls/index.html', url: '/experiments/dls/' },
    { file: 'experiments/prayers/index.html', url: '/experiments/prayers/' },
    { file: 'experiments/prayers/morning/index.html', url: '/experiments/prayers/morning/' },
];

const ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&times;': '×',
};

const decode = (s) =>
    s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? (
        /^&#\d+;$/.test(m) ? String.fromCodePoint(Number(m.slice(2, -1))) : m
    ));

const strip = (html) => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/* Chrome (header/footer nav) would otherwise make every page match "Mirrors",
 * "Tech Stack", "Experiments"… The <pre> on /essentialism/ is 8 KB of generator
 * source and is deliberately excluded — it would nearly double the index to match
 * on things like `}`. */
function bodyText(html) {
    let s = html
        .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
        .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
        .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<header\b[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer\b[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<pre\b[\s\S]*?<\/pre>/gi, ' ');
    return strip(s);
}

const titleOf = (html) => {
    const m = html.match(/<title>([\s\S]*?)<\/title>/i);
    return m ? strip(m[1]) : '';
};

const headingsOf = (html) =>
    [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
        .map((m) => strip(m[1]))
        .filter(Boolean);

/* The home page is a link hub: its own prose is 373 bytes, but each card points
 * somewhere. Index the cards individually so "dailymuse" or "ordinals" resolves to
 * the destination rather than just "the home page". */
function linkCards(html) {
    const out = [];
    /* `</a\s*>` matters: index.html closes these anchors as `</a\n            >`, and
     * a regex demanding a literal `</a>` skips past every card to the next real one. */
    const re = /<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi;
    let m;
    while ((m = re.exec(html))) {
        const attrs = m[1];
        if (!/bg-zinc-800/.test(attrs)) continue;
        const href = attrs.match(/href="([^"]+)"/);
        const label = strip(m[2]);
        if (href && label) out.push({ url: href[1], title: label, kind: 'link' });
    }
    return out;
}

const docs = [];

for (const { file, url } of PAGES) {
    const html = await readFile(join(ROOT, file), 'utf8');
    docs.push({
        url,
        title: titleOf(html),
        headings: headingsOf(html),
        text: bodyText(html),
        kind: 'page',
    });
    if (url === '/') {
        for (const card of linkCards(html)) docs.push({ ...card, from: '/' });
    }
}

const json = JSON.stringify({ built: docs.length, docs });
await writeFile(join(ROOT, 'search-index.json'), json, 'utf8');

const bytes = Buffer.byteLength(json);
const pages = docs.filter((d) => d.kind === 'page').length;
const links = docs.filter((d) => d.kind === 'link').length;
console.log(`search-index.json  ${pages} pages + ${links} links  ${(bytes / 1024).toFixed(1)} KB`);
