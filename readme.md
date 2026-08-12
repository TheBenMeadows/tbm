<div align="center">
  <a href="https://thebenmeadows.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="readme-header-dark.png">
      <img alt="thebenmeadows.com" width="460" src="readme-header-light.png">
    </picture>
  </a>

  <p><a href="https://github.com/TheBenMeadows/tbm/releases/latest">
    <img alt="Last release" src="https://img.shields.io/github/release-date/TheBenMeadows/tbm?label=last%20release"></a>
  <a href="https://github.com/TheBenMeadows/tbm/compare/main">
    <img alt="Commits since last release" src="https://img.shields.io/github/commits-since/TheBenMeadows/tbm/latest?label=commits%20since"></a></p>
</div>

# thebenmeadows.com

Source for [thebenmeadows.com](https://thebenmeadows.com) — a personal link hub
pointing to Ben Meadows' sites, projects, and social profiles.


It is a small static site: hand-written HTML styled with Tailwind, plus
supporting pages — [`/mirrors/`](https://thebenmeadows.com/mirrors/),
[`/tech/`](https://thebenmeadows.com/tech/), `/experiments/`, `/infra/` and
`/essentialism/`. The build compiles the CSS and the search index; there is no
framework or client-side rendering.

Search is dependency-free on purpose. The corpus is about 29 KB across 14 pages
and the index built from it about 37 KB — small enough to match in the browser
without a search library. The usual pick, Pagefind, runs on WebAssembly, which
under this site's `script-src 'self'` CSP would mean adding `'wasm-unsafe-eval'`.
Instead `scripts/build-search-index.mjs` emits a JSON index at build time and
`search.js` matches against it in the browser; the index is fetched only when
search is first opened.

## Build

```sh
npm install
npm run build      # compiles src/input.css -> output.css (minified), then builds
                   # search-index.json and the feeds, and refreshes the address
                   # tables in this file from mirrors.json
```

`output.css` and `search-index.json` are generated and git-ignored. Open `index.html` directly, or serve
the folder with any static server, after building.

### Page weight

[512kb.club](https://512kb.club/) measures one URL — the home page — **uncompressed**,
and its green team requires that page to stay under 100 KB. The site is on the green
team, [added by PR #17](https://codeberg.org/btxx/512kb-club/pulls/17). The club
re-measures on its own schedule, so the size it lists lags this repo.
New subpages are not measured, but three home-page assets are shared with every other
page and do count:

- `output.css` is a single Tailwind build over the content list in `tailwind.config.js`.
  A new page that uses utility classes not already present grows it, and the home page
  pays for that.
- `theme.js` and `search.js` are shared but fixed in size.

`search-index.json` grows with every page in `scripts/build-search-index.mjs`, but
`search.js` fetches it on first search rather than on load, so it stays out of the
measurement. It is 37 KB — over a third of the budget — so it must stay lazy.

The home page currently measures about 72 KB. `scripts/build-manifest.mjs` enforces the
budget on every build and fails over it, so the number cannot drift unnoticed; to check
it independently, run a
[DebugBear page-weight scan](https://www.debugbear.com/test/page-size-checker).

## Deploy

- **Primary:** Cloudflare Pages, connected to this repo's `main`. Each push runs
  `npm run build` and publishes the folder.
- **Netlify:** `netlify.toml` runs the same build (`npm run build:netlify`,
  which assembles a clean `dist/`), for use as a second host.

## Releasing

Deploying and releasing are different things here, and the mirror list below only
makes sense once that split is clear.

Most surfaces are **continuous**: Cloudflare Pages, Netlify, the onion, and the
eepsite rebuild themselves from `main`, so a merged PR is live within a minute
and nothing else has to happen. The rest are **release-pinned**: the Arweave
copy, the IPNS name, and the Nostr nsite hold one specific build and only move
when a release is cut. That is deliberate — those surfaces are permanent,
paid for, or signed, and none of those are things to do automatically on every
merge.

A release therefore lags `main` by design. `scripts/build-manifest.mjs` and the
proofs in `commitments/` are what make the lag measurable rather than a guess.

Cutting one builds from a clean checkout of `main` and then, in order: uploads
to Arweave and moves the ArNS record for `ar://thebenmeadows`; signs the
manifest's SHA-256 to Nostr under the key this domain attests at
`/.well-known/nostr.json`; anchors that hash in Bitcoin with OpenTimestamps and
commits the proof to `commitments/`; and tags the commit `YYYY.MM.DD` (plus the
short SHA if a day carries more than one). The tag is annotated with the Arweave
transaction and the manifest hash, and signed when a signing key is available.
Tags replicate to every git mirror, so the record of what shipped survives the
loss of any one forge — including this one.

To check a release rather than trust it, fetch `/manifest.json` from any surface
and compare its hashes against the bytes that surface serves;
[`/mirrors/`](https://thebenmeadows.com/mirrors/) walks through it.

## Mirrors & availability

Availability is treated as two separate concerns, each handled independently —
the model borrowed from [Privacy Guides](https://github.com/privacyguides/privacyguides.org):

- **Serving (reachability).** The same static output is published to two
  independent web hosts — **Cloudflare Pages** (primary) and **Netlify** — and
  beyond the web: a **Tor onion** and an **I2P eepsite** on self-run hardware,
  **IPFS** from the site's own nodes (an IPNS name that ENS, Tezos, and Solana
  name records all point at, and that a **DNSLink** record on the domain itself
  also carries), a permanent **Arweave** copy behind `ar://thebenmeadows`, a
  **Nostr nsite**, a **BitTorrent** download naming this origin as a webseed,
  a **4EVERLAND** host serving each release from IPFS, and **Gemini**,
  **gopher**, **SSH**, **telnet** and **FTP** mirrors. Each release also
  attaches the whole site as one **ZIM** file, which opens offline in Kiwix.
  Different networks fail differently.
- **Currency.** Every push changes the site's IPFS hash. One machine builds,
  pins, publishes the IPNS name, and writes the new hash to a file it serves
  and to the DNSLink record; the other nodes poll that and pin what it says.
  None of them resolves the IPNS name itself, because IPNS records stay valid
  for a year and the network returns months-old ones.
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
  what actually shipped. **archive.today** holds a second copy under a
  different operator, and **Software Heritage** archives the source.
- **Provenance.** Every build emits `manifest.json` (SHA-256 of every shipped
  file). Each release's manifest hash is signed to Nostr under the key this
  domain attests at `/.well-known/nostr.json` and anchored in Bitcoin with
  OpenTimestamps; the proofs live in `commitments/`. Any mirror can be
  verified against the manifest — see
  [`/mirrors/`](https://thebenmeadows.com/mirrors/) for how.

### Addresses

[`/mirrors/`](https://thebenmeadows.com/mirrors/) is the canonical index, but it
is served *by* the site: if the domain is unreachable, so is the page listing the
alternatives to the domain. This README is mirrored to seven forges and Software
Heritage, so it still resolves when nothing else does. The tables below are
generated from `mirrors.json` by `scripts/sync-readme-mirrors.mjs` — the same
file the build signs into `manifest.json`, so the README, the site, and the
manifest cannot disagree.

<!-- mirrors:start -->

**Serving** — the same build, reachable by different means:

| Network | Address |
|---------|---------|
| Web (primary) | `https://thebenmeadows.com/` |
| Web | `https://thebenmeadows.netlify.app/` |
| Web | `https://tbm-linktree.pages.dev/` |
| Tor | `http://meadowsvn6ah25czpa3mv735fizgdz6xp7vlzeqxpydfwnnsygtcleyd.onion/` |
| I2P | `http://d24ftl3svuczr2neg7dhlys7hgj4oinz3u3d5rwd2t4rbkbwt4wa.b32.i2p/` |
| IPFS | `ipns://k51qzi5uqu5dkx54ehvkna983zjtfn04eu4sklgx2ag1tozh9js5p9cn5jwqmy` |
| Arweave | `ar://thebenmeadows` |
| Nostr (nsite) | `npub1wldqfuy0yge4fvxukdm43gze2ral9dnp5avlps5a6t8q0vyv2nds84nq29` |
| 4EVERLAND | `https://thebenmeadows-cbvr.ipfs.4everland.app/` |
| BitTorrent | `https://thebenmeadows.com/tbm.torrent` |
| ZIM (offline) | `https://github.com/TheBenMeadows/tbm/releases/latest` |
| Gemini | `gemini://gemini.thebenmeadows.com/` |
| Gopher | `gopher://gopher.thebenmeadows.com/` |
| SSH | `ssh://text@text.thebenmeadows.com:2222` |
| Telnet | `telnet://text.thebenmeadows.com` |
| FTP | `ftp://text.thebenmeadows.com/` |

**Source** — copies whose identity is not tied to one forge:

| Network | Address |
|---------|---------|
| Radicle | `rad:z3vBEjEJAvd3CjciS1JBiFzHda3KA` |
| Tangled (ATProto) | `https://tangled.org/thebenmeadows.com/tbm` |
| Nostr (GRASP) | `nostr://npub1wldqfuy0yge4fvxukdm43gze2ral9dnp5avlps5a6t8q0vyv2nds84nq29/tbm` |

**Archive** — third-party copies, not under this project's control:

| Network | Address |
|---------|---------|
| Software Heritage | `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=https://github.com/TheBenMeadows/tbm` |
| Wayback Machine | `https://web.archive.org/web/2/https://thebenmeadows.com/` |
| archive.today | `https://archive.ph/newest/https://thebenmeadows.com/` |

<!-- mirrors:end -->

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
| `profiles/` | every profile, one page — the footer's "All profiles" target |
| `experiments/`, `infra/` | experiments gallery and the network/ASN colophon |
| `search/` | the search page (`/search/?q=…`) |
| `404.html` | not-found page (self-contained, inline styles) |
| `src/input.css`, `tailwind.config.js` | Tailwind source + config |
| `icons/` | social SVGs — repo-only since the typographic redesign; the site ships no icons |
| `svgo.config.mjs` | optimizer settings for `icons/` — run `npm run optimize:icons` after adding one |
| `favicon/`, `me.png` | icons and profile image |
| `readme-header-*.png` | the header above — keyed out of `og.png` by `scripts/make-readme-header.py`, one variant per theme; repo-only, never shipped |
| `email.js` | assembles the contact address at runtime to cut scraping |
| `theme.js` | three-state theme control (system / light / dark) |
| `search.js` | search overlay + `/search/` page; fetches the index on first use |
| `scripts/build-search-index.mjs` | builds `search-index.json` from the pages at build time |
| `scripts/version-css.mjs` | content-hashes the stylesheet's `dist/` filename and repoints every page at it, so a deploy can never serve new HTML with a cached old stylesheet |
| `scripts/build-stamp.mjs` | stamps every page with the commit it was built from |
| `scripts/build-feed.mjs` | emits `feed.xml` (Atom) + `rss.xml` (RSS 2.0) from the release log |
| `scripts/build-manifest.mjs` | emits `manifest.json` — SHA-256 of every shipped file |
| `scripts/check-figures.mjs` | asserts every KB figure in this file and `/tech/` against what the tree measures; an unregistered figure fails the build |
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
