# thebenmeadows.com

Source for [thebenmeadows.com](https://thebenmeadows.com) — a personal link hub
pointing to Ben Meadows' sites, projects, and social profiles.

It is a small static site: hand-written HTML styled with Tailwind, plus
supporting pages — [`/mirrors/`](https://thebenmeadows.com/mirrors/),
[`/tech/`](https://thebenmeadows.com/tech/), `/experiments/`, `/infra/` and
`/essentialism/`. The build compiles the CSS and the search index; there is no
framework or client-side rendering.

Search is dependency-free on purpose. The whole corpus is about 11 KB, so a
search library would outweigh what it indexes — and the usual pick, Pagefind,
runs on WebAssembly, which under this site's `script-src 'self'` CSP would mean
adding `'wasm-unsafe-eval'`. Instead `scripts/build-search-index.mjs` emits a
small JSON index at build time and `search.js` matches against it in the
browser; the index is fetched only when search is first opened.

## Build

```sh
npm install
npm run build      # compiles src/input.css -> output.css (minified),
                   # then builds search-index.json from the pages
```

`output.css` and `search-index.json` are generated and git-ignored. Open `index.html` directly, or serve
the folder with any static server, after building.

## Deploy

- **Primary:** Cloudflare Pages, connected to this repo's `main`. Each push runs
  `npm run build` and publishes the folder.
- **Netlify:** `netlify.toml` runs the same build (`npm run build:netlify`,
  which assembles a clean `dist/`), for use as a second host.

## Mirrors & availability

Availability is treated as two separate concerns, each handled independently —
the model borrowed from [Privacy Guides](https://github.com/privacyguides/privacyguides.org):

- **Serving (reachability).** The same static output is published to two
  independent hosts — **Cloudflare Pages** (primary) and **Netlify** (second),
  both building from this repo. If one provider is down, the other still serves.
- **Source (recoverability).** This repository is mirrored to **Codeberg**,
  **Gitea**, and **GitLab** alongside GitHub, kept in sync automatically. Each
  mirror holds the full history, so the source survives any single forge.
- **Archive.** A GitHub Action (`.github/workflows/wayback.yml`) requests a
  Wayback Machine snapshot after every deploy, so the archived copy tracks
  what actually shipped.

The live index of every host, forge, and archive is at
[`/mirrors/`](https://thebenmeadows.com/mirrors/); the stack and the design
decisions behind it are at [`/tech/`](https://thebenmeadows.com/tech/).

## Layout

| Path | What it is |
|------|------------|
| `index.html` | the home page (link hub) |
| `mirrors/`, `tech/` | the mirror list and the tech-stack colophon |
| `experiments/`, `infra/` | experiments gallery and the network/ASN colophon |
| `search/` | the search page (`/search/?q=…`) |
| `404.html` | not-found page (self-contained, inline styles) |
| `src/input.css`, `tailwind.config.js` | Tailwind source + config |
| `icons/` | self-hosted social SVGs (no external CDN at runtime) |
| `favicon/`, `me.png` | icons and profile image |
| `email.js` | assembles the contact address at runtime to cut scraping |
| `theme.js` | three-state theme control (system / light / dark) |
| `search.js` | search overlay + `/search/` page; fetches the index on first use |
| `scripts/build-search-index.mjs` | builds `search-index.json` from the pages at build time |
| `_headers` | security headers + cache and CORS rules (Cloudflare/Netlify) |
| `.well-known/` | identity + payment endpoints (see below) |

## `.well-known/` endpoints

These serve live identity and payment lookups. Keep them in place, and served
correctly, on every host that runs the site:

- `nostr.json` — Nostr [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md) name verification (needs `Access-Control-Allow-Origin: *`).
- `lnurlp/ben` — Lightning [LNURL-pay](https://github.com/lnurl/luds) address (needs CORS + `application/json`).
- `keybase.txt` — Keybase account proof.

DNS verification records (Keybase, Tezos) live at the domain and must survive any
DNS change.

## License

Code is [MIT](LICENSE). Personal images and brand assets — `me.png`,
`btm-logo.png`, and the `favicon/` set — are not covered by the license;
all rights reserved.
