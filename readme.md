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
  independent web hosts — **Cloudflare Pages** (primary) and **Netlify** — and
  beyond the web: a **Tor onion** and an **I2P eepsite** on self-run hardware,
  **IPFS** from the site's own nodes (an IPNS name that ENS, Tezos, and Solana
  name records all point at), a permanent **Arweave** copy behind
  `ar://thebenmeadows`, a **Nostr nsite**, and **Gemini** and **gopher**
  mirrors. Different networks fail differently.
- **Source (recoverability).** This repository is mirrored to **Codeberg**,
  **Gitea**, **GitLab**, and **SourceHut** alongside GitHub, kept in sync
  automatically. Each mirror holds the full history, so the source survives any
  single forge. It is also published hostlessly twice: on **Radicle** as
  `rad:z3vBEjEJAvd3CjciS1JBiFzHda3KA`, where nodes replicate it between
  themselves, and on **Nostr** via [GRASP](https://ngit.dev/grasp/), where
  signed events are the authority and any compliant git server can carry it
  (`git clone nostr://npub1wldqfuy0yge4fvxukdm43gze2ral9dnp5avlps5a6t8q0vyv2nds84nq29/tbm`
  with the [ngit](https://ngit.dev/) plugin), and on **Tangled**, where the
  repository lives on an AT Protocol knot and carries its own DID.
  **Software Heritage** holds a permanent archival copy.
- **Archive.** A GitHub Action (`.github/workflows/wayback.yml`) requests a
  Wayback Machine snapshot after every deploy, so the archived copy tracks
  what actually shipped.
- **Provenance.** Every build emits `manifest.json` (SHA-256 of every shipped
  file). Each release's manifest hash is signed to Nostr under the key this
  domain attests at `/.well-known/nostr.json` and anchored in Bitcoin with
  OpenTimestamps; the proofs live in `commitments/`. Any mirror can be
  verified against the manifest — see
  [`/mirrors/`](https://thebenmeadows.com/mirrors/) for how.

## Git Mirrors

[![GitHub](https://img.shields.io/badge/GITHUB-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/TheBenMeadows/tbm)
[![Codeberg](https://img.shields.io/badge/CODEBERG-2185D0?style=for-the-badge&logo=codeberg&logoColor=white)](https://codeberg.org/thebenmeadows/tbm)
[![Gitea](https://img.shields.io/badge/GITEA-609926?style=for-the-badge&logo=gitea&logoColor=white)](https://gitea.com/thebenmeadows/tbm)
[![GitLab](https://img.shields.io/badge/GITLAB-FC6D26?style=for-the-badge&logo=gitlab&logoColor=white)](https://gitlab.com/TheBenMeadows/tbm)
[![SourceHut](https://img.shields.io/badge/SOURCEHUT-000000?style=for-the-badge&logo=sourcehut&logoColor=white)](https://git.sr.ht/~thebenmeadows/tbm)
[![Radicle](https://img.shields.io/badge/RADICLE-0A0D10?style=for-the-badge&logo=radicle&logoColor=white)](https://radicle.network/nodes/index.radicle.garden/rad:z3vBEjEJAvd3CjciS1JBiFzHda3KA)
[![Nostr](https://img.shields.io/badge/NOSTR-662482?style=for-the-badge&logoColor=white)](https://gitworkshop.dev/npub1wldqfuy0yge4fvxukdm43gze2ral9dnp5avlps5a6t8q0vyv2nds84nq29/relay.ngit.dev/tbm)
[![Tangled](https://img.shields.io/badge/TANGLED-1185FE?style=for-the-badge&logoColor=white)](https://tangled.org/thebenmeadows.com/tbm)

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
| `scripts/build-stamp.mjs` | stamps every page with the commit it was built from |
| `scripts/build-feed.mjs` | emits `feed.xml` (Atom) + `rss.xml` (RSS 2.0) from the release log |
| `scripts/build-manifest.mjs` | emits `manifest.json` — SHA-256 of every shipped file |
| `scripts/sign-release.sh` | signs the manifest to Nostr and anchors it with OpenTimestamps |
| `commitments/` | one OpenTimestamps proof per release, named for the hash it attests |
| `.nsite/` | nsyte config for the Nostr nsite deploy |
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
