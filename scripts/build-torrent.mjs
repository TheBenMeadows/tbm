// Publish the built site as a BitTorrent torrent with an HTTP webseed.
//
// Why BitTorrent when the site already has a dozen mirrors: it is the only one
// where READERS become mirrors. Every other copy is a host someone has to keep
// paying for. A torrent that anyone leaves seeding is distribution capacity
// this project did not provision and cannot lose access to.
//
// The webseed (BEP 19) is what makes it work with no swarm. A torrent with no
// peers is a dead file; a torrent with a webseed falls back to plain HTTP from
// this origin, so the worst case is an ordinary download and the best case is
// that peers carry it instead. That asymmetry is the whole reason to ship it.
//
// TRACKERLESS on purpose. Announcing to a public tracker would put a third
// party in the path of every discovery, which is the dependency the rest of
// /mirrors/ exists to remove. Peers find each other over DHT, and the webseed
// covers the case where nobody is there.
//
// DETERMINISM MATTERS HERE, for the same reason build-stamp.mjs uses the commit
// date rather than the build clock: Cloudflare, Netlify and vps1 each build the
// same commit at different moments. Anything derived from the wall clock, the
// filesystem's directory order, or the build host would give each of them a
// DIFFERENT infohash for identical bytes -- three torrents for one release,
// each with a swarm of one. So the file list is sorted, and the creation date
// is the commit's, or absent entirely when git is unavailable.
//
// No dependencies: bencode is about thirty lines and this has to run on hosts
// where only `npm run build:netlify` is guaranteed.

import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const DIST = "dist";
// A STABLE name, not one carrying the commit. It is the directory a client
// creates on disk, and it is the path segment the webseed URL is built from
// (see the /tbm/* rewrite in _redirects). A per-release name would need a new
// rewrite rule every release.
const NAME = "tbm";
const WEBSEED = "https://thebenmeadows.com/";
const PIECE_LENGTH = 262144; // 256 KiB
const OUT = join(DIST, "tbm.torrent");

/* ---------------------------------------------------------------- bencode */
// Byte strings are length-prefixed, so `pieces` (raw SHA-1 digests, not text)
// has to stay a Buffer the whole way down. Encoding it as a JS string would
// mangle every byte above 0x7f through UTF-8.
function bencode(value) {
    if (Buffer.isBuffer(value)) {
        return Buffer.concat([Buffer.from(`${value.length}:`), value]);
    }
    if (typeof value === "string") {
        return bencode(Buffer.from(value, "utf8"));
    }
    if (typeof value === "number") {
        if (!Number.isInteger(value)) throw new Error("bencode: non-integer number");
        return Buffer.from(`i${value}e`);
    }
    if (Array.isArray(value)) {
        return Buffer.concat([Buffer.from("l"), ...value.map(bencode), Buffer.from("e")]);
    }
    if (value && typeof value === "object") {
        // Dictionary keys MUST be sorted as raw byte strings. Every key here is
        // ASCII, where a lexicographic sort is the same order.
        const parts = [Buffer.from("d")];
        for (const key of Object.keys(value).sort()) {
            parts.push(bencode(key), bencode(value[key]));
        }
        parts.push(Buffer.from("e"));
        return Buffer.concat(parts);
    }
    throw new Error(`bencode: cannot encode ${typeof value}`);
}

/* ------------------------------------------------------------------ files */
function walk(dir, base) {
    const found = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) found.push(...walk(full, base));
        else if (entry.isFile()) found.push(relative(base, full));
    }
    return found;
}

// Sorted, so readdir order can never change the infohash. The torrent cannot
// contain itself, and manifest.json is deliberately kept IN: it is the file a
// recipient verifies the rest against, so a copy without it is unverifiable.
const files = walk(DIST, DIST)
    .filter((f) => !f.endsWith(".torrent"))
    .sort();

if (files.length === 0) {
    console.error("build-torrent: dist is empty, run the build first");
    process.exit(1);
}

/* ----------------------------------------------------------------- pieces */
// Pieces span the concatenation of every file in order, so a piece boundary
// usually falls inside a file. Carry the remainder across rather than padding.
const pieces = [];
let carry = Buffer.alloc(0);
let total = 0;

for (const file of files) {
    const data = readFileSync(join(DIST, file));
    total += data.length;
    let cursor = 0;

    if (carry.length > 0) {
        const need = PIECE_LENGTH - carry.length;
        const take = Math.min(need, data.length);
        carry = Buffer.concat([carry, data.subarray(0, take)]);
        cursor = take;
        if (carry.length === PIECE_LENGTH) {
            pieces.push(createHash("sha1").update(carry).digest());
            carry = Buffer.alloc(0);
        }
    }

    while (data.length - cursor >= PIECE_LENGTH) {
        pieces.push(createHash("sha1").update(data.subarray(cursor, cursor + PIECE_LENGTH)).digest());
        cursor += PIECE_LENGTH;
    }

    if (cursor < data.length) carry = Buffer.concat([carry, data.subarray(cursor)]);
}
if (carry.length > 0) pieces.push(createHash("sha1").update(carry).digest());

/* ---------------------------------------------------------------- torrent */
const info = {
    files: files.map((f) => ({
        length: statSync(join(DIST, f)).size,
        // Path components as a list; always POSIX separators in the torrent,
        // whatever the build host's filesystem uses.
        path: f.split(sep),
    })),
    name: NAME,
    "piece length": PIECE_LENGTH,
    pieces: Buffer.concat(pieces),
};

const torrent = {
    "created by": "thebenmeadows.com",
    info,
    // BEP 19. Trailing slash is required: the client appends `<name>/<path>`,
    // which the /tbm/* rewrite maps back onto the site root.
    "url-list": [WEBSEED],
};

// Commit time, never Date.now() -- see the determinism note at the top.
try {
    const ts = execSync("git log -1 --format=%ct", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    if (/^\d+$/.test(ts)) torrent["creation date"] = Number(ts);
} catch {
    // No git (shallow CI checkout): omit the field rather than invent a clock.
}

const encoded = bencode(torrent);
writeFileSync(OUT, encoded);

const infohash = createHash("sha1").update(bencode(info)).digest("hex");
const magnet =
    `magnet:?xt=urn:btih:${infohash}` +
    `&dn=${encodeURIComponent(NAME)}` +
    `&ws=${encodeURIComponent(WEBSEED)}`;

const mb = (total / 1024 / 1024).toFixed(1);
console.log(
    `build-torrent      ${files.length} files, ${mb} MB, ${pieces.length} pieces -> ${infohash.slice(0, 12)}`,
);
console.log(`magnet             ${magnet}`);
