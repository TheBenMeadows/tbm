// art/essentialism/essentialism.js is not source. It is a copy of the generator
// stored on Tezos as bootloader svg-js/407, and /art/essentialism fetches those
// bytes at runtime and diffs them against the function it just ran, printing
// "Verified" or "Mismatch" to the reader. So the file has a correctness
// condition no linter, formatter, or house-style pass can be trusted with:
// every byte between the wrapper braces belongs to the chain.
//
// It has already been broken once. The em-dash pass (#85) rewrote six comment
// dashes in the ink library, reasoning that comments sit outside the compared
// body. They do not. The page showed "Mismatch" to every visitor for eight
// days, which is the failure the page was built to detect and exactly the
// wrong thing for a page arguing provenance to be saying about itself.
//
// This asserts offline, against a pinned digest, so a deploy never depends on
// an indexer being up. Run with --chain to check the pin itself against the
// contract; that is the check you want after updating the generator on-chain,
// not on every build.
//
// Updating the generator is therefore two deliberate acts: regenerate the file
// from the contract's stored bytes, then repin BODY_SHA256 below. Editing one
// without the other fails here.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const FILE = "art/essentialism/essentialism.js";
const SHIPPED = "dist/art/essentialism/essentialism.js";
const OPEN = "window.ESSENTIALISM = function (BTLDR) {\n";
const CLOSE = "\n};";

// sha256 of the generator body as stored on-chain, generator v6.
// Verify with: node scripts/check-onchain-code.mjs --chain
const BODY_SHA256 = "33d85a12cf2a8404bccda1e31d6b3fd72c361673f995cc58b0857eabb6d5c248";
const BIGMAP = "https://api.tzkt.io/v1/bigmaps/771404/keys/407";

const fail = (msg) => {
    console.error(`check-onchain-code: ${msg}`);
    process.exit(1);
};

const body = (text, where) => {
    const i = text.indexOf(OPEN);
    const j = text.lastIndexOf(CLOSE);
    if (i === -1 || j <= i) fail(`${where}: could not find the generator wrapper`);
    return text.slice(i + OPEN.length, j);
};

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

const source = body(readFileSync(FILE, "utf8"), FILE);
const got = sha(source);
if (got !== BODY_SHA256) {
    fail(
        `${FILE} no longer matches the on-chain generator.\n` +
        `  expected ${BODY_SHA256}\n` +
        `       got ${got}\n` +
        `  Every byte inside the wrapper is chain bytes, comments included, and\n` +
        `  /art/essentialism diffs them against the contract in the reader's browser.\n` +
        `  If you were restyling prose, revert this file. If the generator really\n` +
        `  changed on-chain, regenerate the body from the contract and repin\n` +
        `  BODY_SHA256 in scripts/check-onchain-code.mjs.`
    );
}

// The build copies the file into dist unchanged. Assert that it stayed that way.
if (existsSync(SHIPPED)) {
    const shipped = sha(body(readFileSync(SHIPPED, "utf8"), SHIPPED));
    if (shipped !== BODY_SHA256) fail(`${SHIPPED} differs from ${FILE}; the build transformed it`);
}

if (process.argv.includes("--chain")) {
    const res = await fetch(BIGMAP, { signal: AbortSignal.timeout(25000) }).catch((e) =>
        fail(`could not reach the TzKT indexer: ${e.message}`)
    );
    if (!res.ok) fail(`TzKT returned ${res.status}`);
    const { value } = await res.json();
    const onchain = decodeURIComponent(Buffer.from(value.code, "hex").toString("utf8")).replace(/\n+$/, "");
    if (sha(onchain) !== BODY_SHA256) {
        fail(
            `the pin is stale: generator v${value.version} on Tezos hashes to ${sha(onchain)}.\n` +
            `  Regenerate ${FILE} from the contract, then repin BODY_SHA256.`
        );
    }
    console.log(`check-onchain-code: pin matches generator v${value.version} on Tezos`);
}

console.log(`check-onchain-code: ${FILE} is byte-for-byte the on-chain generator`);
