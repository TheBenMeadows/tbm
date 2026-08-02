// Emit a manifest of every built file and its sha256, so a visitor on any
// mirror can prove they are reading the bytes that were published.
//
// This exists because a mirror can be stale, and because gateways rewrite
// content in transit. Both public IPFS gateways we tested inject a tracking
// beacon into the HTML: origin index.html is 18,004 bytes, dweb.link returns
// 18,341 and ipfs.io 18,275. Content addressing protects what IPFS *stores*,
// not what a gateway *hands you*. Hashing the built artifact is the only check
// that survives that.
//
// The manifest covers every file except itself and the detached signature, for
// the obvious reason that a file cannot contain its own hash.
//
// Determinism matters: the same commit must produce the same manifest on every
// host, or the signature is worthless. Entries are sorted by path and the build
// clock is never recorded -- see scripts/build-stamp.mjs for the same argument.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { execSync } from "node:child_process";

const DIST = "dist";
const MANIFEST = join(DIST, "manifest.json");
const MIRRORS = "mirrors.json";
const EXCLUDE = new Set(["manifest.json", "manifest.sig.json"]);

// The mirror list travels inside the signed manifest, so a visitor holding any
// single copy of this site can find every other copy and know the list itself
// was not altered. Read it here rather than hardcoding: one file to edit.
//
// Fail loudly if it is missing or malformed. Emitting a manifest with no
// mirrors would still sign cleanly and still verify -- it would just quietly
// stop being a recovery path, which is the whole reason the field exists.
function loadMirrors() {
    let raw;
    try {
        raw = readFileSync(MIRRORS, "utf8");
    } catch {
        throw new Error(`build-manifest: ${MIRRORS} is missing -- refusing to publish a manifest with no mirror list`);
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.mirrors) || parsed.mirrors.length === 0) {
        throw new Error(`build-manifest: ${MIRRORS} has no mirrors[] entries`);
    }
    for (const m of parsed.mirrors) {
        if (!m.kind || !m.network || !m.address) {
            throw new Error(`build-manifest: ${MIRRORS} entry missing kind/network/address: ${JSON.stringify(m)}`);
        }
    }
    return parsed.mirrors;
}

function gitOut(args, fallback, extraEnv = {}) {
    try {
        return execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, ...extraEnv } })
            .toString()
            .trim();
    } catch {
        return fallback;
    }
}

function walk(dir) {
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else out.push(full);
    }
    return out;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const commit = (
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.COMMIT_REF ||
    gitOut("rev-parse HEAD", "")
).trim();

const files = {};
for (const path of walk(DIST).sort()) {
    // Always use forward slashes so the manifest is identical on every platform.
    const key = relative(DIST, path).split(sep).join("/");
    if (EXCLUDE.has(key)) continue;
    files[key] = sha256(readFileSync(path));
}

const sortedKeys = Object.keys(files).sort();
const ordered = {};
for (const k of sortedKeys) ordered[k] = files[k];

// A single value covering the whole tree, so a verifier can compare one hash
// rather than several dozen. Format is "<sha256>  <path>" per line, sorted,
// which is reproducible by hand with sha256sum.
const treeLines = sortedKeys.map((k) => `${files[k]}  ${k}`).join("\n") + "\n";
const treeHash = sha256(Buffer.from(treeLines, "utf8"));

const manifest = {
    site: "thebenmeadows.com",
    commit,
    // TZ=UTC or the manifest differs per builder timezone and the signature is
    // worthless -- this shipped broken once and was caught by the signed hash not
    // matching the deployed one.
    commitDate: gitOut('log -1 --format=%cd --date=format-local:%Y-%m-%dT%H:%M:%SZ', "", { TZ: "UTC" }),
    fileCount: sortedKeys.length,
    treeSha256: treeHash,
    mirrors: loadMirrors(),
    files: ordered,
};

// Stable formatting: two-space indent and a trailing newline, so the bytes a
// verifier hashes are exactly the bytes written here.
const body = JSON.stringify(manifest, null, 2) + "\n";
writeFileSync(MANIFEST, body);

console.log(
    `build-manifest     ${sortedKeys.length} files, tree ${treeHash.slice(0, 12)}, manifest ${sha256(Buffer.from(body, "utf8")).slice(0, 12)}`,
);
