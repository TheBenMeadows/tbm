// Stamp every built page with the commit it was built from.
//
// The point is to make mirror drift visible to a person. Open the same page on
// two surfaces, compare the two stamps, and a stale mirror is obvious without
// hashing anything.
//
// The stamp deliberately uses the COMMIT date and sha, never the build clock.
// Every surface builds at a different moment -- Cloudflare and Netlify on push,
// vps1 on a ten minute timer -- so a build timestamp would make identical
// content look different everywhere and report drift that does not exist.
// Commit metadata is a property of the content, so the same commit produces
// byte identical output on every host, which also keeps the IPFS CID stable.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const PAGES = [
    "index.html",
    "mirrors/index.html",
    "tech/index.html",
    "experiments/index.html",
    "infra/index.html",
    "essentialism/index.html",
    "search/index.html",
];

function gitOut(args, fallback, extraEnv = {}) {
    try {
        return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, ...extraEnv } })
            .toString()
            .trim();
    } catch {
        return fallback;
    }
}

// CI checkouts are often shallow or detached, so prefer the host's own commit
// variable and fall back to git. Cloudflare Pages sets CF_PAGES_COMMIT_SHA and
// Netlify sets COMMIT_REF.
const sha = (
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    gitOut("rev-parse HEAD", "")
).trim();

const short = sha ? sha.slice(0, 7) : "unknown";

// Committer date, UTC, date only. If git is unavailable and the host supplied
// only a sha, show the sha alone rather than inventing a date.
// TZ=UTC is essential: git's format-local renders in the *builder's* timezone, so a
// machine west of UTC stamps the previous day and the build stops being
// reproducible. Cloudflare and Netlify build in UTC; a laptop in MST does not.
const date = gitOut('log -1 --format=%cd --date=format-local:%Y-%m-%d', "", { TZ: "UTC" });

const label = date ? `${short} &middot; ${date}` : short;
const marker = 'class="mt-3 text-xs text-neutral-600">Build ';
const stamp = `            <p ${marker}${label} &middot; <a class="hover:text-neutral-400" href="https://iheartrss.com/" target="_blank" rel="noopener">I &hearts; RSS</a></p>\n`;

let stamped = 0;
for (const page of PAGES) {
    const path = join(DIST, page);
    let html;
    try {
        html = readFileSync(path, "utf8");
    } catch {
        console.warn(`build-stamp: ${page} missing, skipped`);
        continue;
    }

    if (html.includes(marker)) {
        continue; // already stamped; keep the run idempotent
    }

    const replaced = html.replace(
        /(<\/nav>\s*)(<\/footer>)/,
        (_m, navClose, footerClose) => `${navClose}${stamp}        ${footerClose}`,
    );

    if (replaced === html) {
        console.warn(`build-stamp: no footer anchor in ${page}, skipped`);
        continue;
    }

    writeFileSync(path, replaced);
    stamped += 1;
}

console.log(
    `build-stamp        ${stamped}/${PAGES.length} pages -> ${short}${date ? ` (${date})` : ""}`,
);
