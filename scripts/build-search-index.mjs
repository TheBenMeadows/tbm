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
    { file: 'profiles/index.html', url: '/profiles/' },
    { file: 'mirrors/index.html', url: '/mirrors/' },
    { file: 'tech/index.html', url: '/tech/' },
    { file: 'experiments/index.html', url: '/experiments/' },
    { file: 'projects/index.html', url: '/projects/' },
    { file: 'infra/index.html', url: '/infra/' },
    { file: 'essentialism/index.html', url: '/essentialism/' },
    { file: 'experiments/pendulum/index.html', url: '/experiments/pendulum/' },
    { file: 'experiments/porcine/index.html', url: '/experiments/porcine/' },
    { file: 'experiments/etherhoo/index.html', url: '/experiments/etherhoo/' },
    { file: 'experiments/dls/index.html', url: '/experiments/dls/' },
    { file: 'experiments/poap-vault/index.html', url: '/experiments/poap-vault/' },
    { file: 'projects/poap-saver/index.html', url: '/projects/poap-saver/' },
];

const ENTITIES = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
    '&nbsp;': ' ', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…', '&times;': '×',
};

const decode = (s) =>
    s.replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m] ?? (
        /^&#\d+;$/.test(m) ? String.fromCodePoint(Number(m.slice(2, -1))) : m
    ));

/* Comments must go before tags do. The tag pattern below stops at the first ">",
 * so a comment that mentions markup — index.html's note about <img> and <picture>
 * — is only half-consumed and its remaining prose lands in the corpus. That text
 * then rides search-index.json into site search and into the Gemini capsule and
 * gopher hole, which vps1 generates from this file rather than from the HTML. */
const decomment = (html) => html.replace(/<!--[\s\S]*?-->/g, ' ');

const strip = (html) => decode(decomment(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

/* Chrome (header/footer nav) would otherwise make every page match "Mirrors",
 * "Tech Stack", "Experiments"… The <pre> on /essentialism/ is 8 KB of generator
 * source and is deliberately excluded — it would nearly double the index to match
 * on things like `}`. */
function bodyText(html) {
    /* Comments go first here too: these section removals run before strip(), and a
     * commented-out </head> or <pre> would otherwise cut the wrong span. */
    let s = decomment(html)
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

/* The home page is a link hub: its own prose is tiny, but each entry points
 * somewhere. Index the entries individually so "dailymuse" or "ordinals" resolves
 * to the destination rather than just "the home page". An entry row is the only
 * anchor that carries a <span class="who"> annotation, so that span is the
 * detector — and its text joins the title, because it holds exactly the words
 * (generative, blog post) people search for. */
function linkCards(html) {
    const out = [];
    const re = /<a\b([^>]*?)>([\s\S]*?)<\/a\s*>/gi;
    let m;
    while ((m = re.exec(html))) {
        const attrs = m[1];
        const inner = m[2];
        const whoM = inner.match(/<span class="who">([\s\S]*?)<\/span>/i);
        if (!whoM) continue;
        const href = attrs.match(/href="([^"]+)"/);
        const label = strip(inner.replace(/<span class="who">[\s\S]*?<\/span>/i, ' '));
        const who = strip(whoM[1]);
        if (href && label) {
            out.push({ url: href[1], title: who ? `${label} · ${who}` : label, kind: 'link' });
        }
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
