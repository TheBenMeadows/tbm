// Regenerate the address tables in readme.md from mirrors.json.
//
// Why the README carries the addresses at all: /mirrors/ is the canonical list,
// but it lives ON the site. If thebenmeadows.com is unreachable, so is the page
// that lists the alternatives to thebenmeadows.com. This README is mirrored to
// seven forges and Software Heritage, so it still resolves when the site does
// not -- which makes it the recovery path, and makes a stale address here worse
// than no address at all.
//
// Hence generated, never hand-edited. Privacy Guides maintains its onion address
// in prose; ours comes from the same file the build signs into manifest.json, so
// the README, the site and the manifest cannot disagree.
//
//   node scripts/sync-readme-mirrors.mjs            rewrite the block in place
//   node scripts/sync-readme-mirrors.mjs --check    exit 1 if it is out of date
import { readFileSync, writeFileSync } from "node:fs";

const README = "readme.md";
const MIRRORS = "mirrors.json";
const START = "<!-- mirrors:start -->";
const END = "<!-- mirrors:end -->";

// kind+network -> label. Keyed on the pair because `nostr` means two different
// things: a published site (nsite) under serving, a git remote (GRASP) under
// source. An unmapped pair is a hard error rather than a guessed label -- a new
// network is a deliberate addition, and silently printing a raw slug in the one
// document people fall back to is exactly the failure this file exists to stop.
const LABELS = {
    "serving/https": "Web",
    "serving/tor": "Tor",
    "serving/i2p": "I2P",
    "serving/ipfs": "IPFS",
    "serving/arweave": "Arweave",
    "serving/nostr": "Nostr (nsite)",
    "serving/bittorrent": "BitTorrent",
    "serving/gemini": "Gemini",
    "serving/gopher": "Gopher",
    "serving/ssh": "SSH",
    "serving/telnet": "Telnet",
    "serving/finger": "Finger",
    "serving/ftp": "FTP",
    "source/https": "Forge",
    "source/radicle": "Radicle",
    "source/nostr": "Nostr (GRASP)",
    "source/atproto": "Tangled (ATProto)",
    "archive/https": "Archive",
};

// An entry may carry its own `label`, which wins. The kind+network pair cannot
// tell three archives apart -- Software Heritage keeps the source, the Wayback
// Machine and archive.today keep the pages -- and three rows all reading
// "Archive" is useless in the one document someone reads while the site is
// down. An explicit label is still explicit, so this does not weaken the rule
// below that an unmapped pair is an error rather than a guess.
const label = (m) => {
    if (m.label) return m.label;
    const key = `${m.kind}/${m.network}`;
    const found = LABELS[key];
    if (!found) throw new Error(`sync-readme-mirrors: no label for "${key}" — add one to LABELS`);
    return found;
};

// GitHub renders bare onion/i2p/gemini/gopher/ar:// as plain text anyway, and a
// half-linked table reads as though the unlinked rows are broken. Code spans
// are uniform, copyable, and identical on every forge that mirrors this file.
const rows = (list) =>
    list.map((m) => `| ${label(m)}${m.primary ? " (primary)" : ""} | \`${m.address}\` |`).join("\n");

const table = (heading, list) =>
    list.length === 0 ? "" : `${heading}\n\n| Network | Address |\n|---------|---------|\n${rows(list)}\n`;

const { mirrors } = JSON.parse(readFileSync(MIRRORS, "utf8"));
if (!Array.isArray(mirrors) || mirrors.length === 0) {
    throw new Error(`sync-readme-mirrors: ${MIRRORS} has no mirrors[] entries`);
}

const serving = mirrors.filter((m) => m.kind === "serving");
// The five https forges already appear above as badges; repeating them here
// would pad the table without adding a recovery path. The hostless ones have no
// badge that carries their actual address, so they are the ones worth printing.
const source = mirrors.filter((m) => m.kind === "source" && m.network !== "https");
const archive = mirrors.filter((m) => m.kind === "archive");

const block = [
    START,
    "",
    table("**Serving** — the same build, reachable by different means:", serving),
    table("**Source** — copies whose identity is not tied to one forge:", source),
    table("**Archive** — third-party copies, not under this project's control:", archive),
    END,
].join("\n");

const readme = readFileSync(README, "utf8");
const from = readme.indexOf(START);
const to = readme.indexOf(END);
if (from === -1 || to === -1) {
    throw new Error(`sync-readme-mirrors: ${README} is missing the ${START} / ${END} markers`);
}
const next = readme.slice(0, from) + block + readme.slice(to + END.length);

if (process.argv.includes("--check")) {
    if (next !== readme) {
        console.error(
            `sync-readme-mirrors: ${README} is out of date with ${MIRRORS}. ` +
                `Run: node scripts/sync-readme-mirrors.mjs`,
        );
        process.exit(1);
    }
    console.log(`readme mirrors     in sync with ${MIRRORS}`);
} else if (next === readme) {
    console.log(`readme mirrors     already in sync (${mirrors.length} entries)`);
} else {
    writeFileSync(README, next);
    console.log(`readme mirrors     rewrote ${README} from ${MIRRORS} (${mirrors.length} entries)`);
}
