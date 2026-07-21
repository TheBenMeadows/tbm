# thebenmeadows.com

Source for [thebenmeadows.com](https://thebenmeadows.com) — a personal link hub
pointing to Ben Meadows' sites, projects, and social profiles.

It is a small static site: hand-written HTML styled with Tailwind, plus two
supporting pages — [`/mirrors/`](https://thebenmeadows.com/mirrors/) and
[`/tech/`](https://thebenmeadows.com/tech/). The only build step compiles the
CSS; there is no framework or client-side rendering.

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
- **Netlify:** `netlify.toml` runs the same build (`npm run build:netlify`,
  which assembles a clean `dist/`), for use as a second host.

## Mirrors & availability

Availability is treated as two separate concerns, each handled independently —
the model borrowed from [Privacy Guides](https://www.privacyguides.org):

- **Serving (reachability).** The same static output is published to two
  independent hosts — **Cloudflare Pages** (primary) and **Netlify** (second),
  both building from this repo. If one provider is down, the other still serves.
- **Source (recoverability).** This repository is mirrored to **Codeberg**,
  **Gitea**, and **GitLab** alongside GitHub, kept in sync automatically. Each
  mirror holds the full history, so the source survives any single forge.
- **Archive.** The site is snapshotted by the Internet Archive's Wayback Machine.

The live index of every host, forge, and archive is at
[`/mirrors/`](https://thebenmeadows.com/mirrors/); the stack and the design
decisions behind it are at [`/tech/`](https://thebenmeadows.com/tech/).

## Layout

| Path | What it is |
|------|------------|
| `index.html` | the home page (link hub) |
| `mirrors/`, `tech/` | the mirror list and the tech-stack colophon |
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

## License

Code is [MIT](LICENSE). Personal images and brand assets — `me.png`,
`btm-logo.png`, and the `favicon/` set — are not covered by the license;
all rights reserved.
