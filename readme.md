# thebenmeadows.com

Source for [thebenmeadows.com](https://thebenmeadows.com) — a personal link hub
pointing to Ben Meadows' sites, projects, and social profiles.

It is a single static page: hand-written HTML styled with Tailwind. The only
build step compiles the CSS; there is no framework or client-side rendering.

## Build

```sh
npm install
npm run build      # compiles src/input.css -> output.css (minified)
```

`output.css` is generated and git-ignored. Open `index.html` directly, or serve
the folder with any static server, after building.

## Deploy

- **Primary:** Cloudflare Pages, connected to this repo's `main`. Each push runs
  `npm run build` and publishes the folder.
- **Netlify:** `netlify.toml` runs the same build, for use as a second host.

## Layout

| Path | What it is |
|------|------------|
| `index.html` | the page |
| `404.html` | not-found page (self-contained, inline styles) |
| `src/input.css`, `tailwind.config.js` | Tailwind source + config |
| `icons/` | self-hosted social SVGs (no external CDN at runtime) |
| `favicon/`, `me.png` | icons and profile image |
| `email.js` | assembles the contact address at runtime to cut scraping |
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
