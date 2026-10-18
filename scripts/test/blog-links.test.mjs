/* The blog build refuses a link whose scheme would run code where it is
 * clicked. Posts can be written by a guest or an agent, and the Tor, IPFS,
 * Arweave, torrent and ZIM copies of the site carry no CSP.
 *
 * Each case runs the real build-blog.mjs on a scratch site holding one post.
 * The scratch site sits in the repo root so the build finds node_modules. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function buildPost(body) {
    const site = mkdtempSync(join(ROOT, ".test-site-"));
    try {
        cpSync(join(ROOT, "scripts"), join(site, "scripts"), {
            recursive: true,
            filter: (src) => !src.includes(`${join("scripts", "test")}`),
        });
        mkdirSync(join(site, "blog", "posts"), { recursive: true });
        cpSync(join(ROOT, "blog", "authors.json"), join(site, "blog", "authors.json"));
        writeFileSync(
            join(site, "blog", "posts", "link-test.md"),
            `---\ntitle: "Link test"\ndate: 2026-10-18\ndescription: "A post for the link test."\n---\n\n${body}\n`,
        );
        const run = spawnSync(process.execPath, [join(site, "scripts", "build-blog.mjs")], { encoding: "utf8" });
        const page = join(site, "blog", "link-test", "index.html");
        return { status: run.status, stderr: run.stderr, html: existsSync(page) ? readFileSync(page, "utf8") : "" };
    } finally {
        rmSync(site, { recursive: true, force: true });
    }
}

const decode = (s) =>
    s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
        .replace(/&colon;/gi, ":")
        .replace(/&amp;/g, "&");

/* Every href in a page, as a browser would read the scheme: entities decoded,
 * tabs and newlines removed, leading spaces and control characters dropped. */
const schemes = (html) =>
    [...html.matchAll(/href="([^"]*)"/g)]
        .map((m) => decode(m[1]).replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+/, ""))
        .map((h) => (/^([a-z][a-z0-9+.-]*):/i.exec(h) || [])[1]?.toLowerCase())
        .filter(Boolean);

/* `mustFail`: the build stops. Without it, the link may build as long as no
 * browser would read it as that scheme (an entity left escaped is text). */
for (const [href, mustFail] of [
    ["javascript:alert(1)", true],
    ["JavaScript:alert(1)", true],
    ["data:text/html,hi", true],
    ["vbscript:msgbox(1)", true],
    ["javascript&#58;alert(1)", false],
]) {
    test(`a post linking ${href} does not build into a live link`, () => {
        const out = buildPost(`Click [here](${href}).`);
        const bad = schemes(out.html).filter((s) => !["http", "https", "mailto", "ipfs"].includes(s));
        assert.deepEqual(bad, [], `built with: ${bad.join(", ")}`);
        if (mustFail) assert.notEqual(out.status, 0, "the build accepted a link it cannot allow");
    });
}

test("the schemes posts use still build", () => {
    const out = buildPost(
        "[a](https://example.com/) [b](mailto:ben@example.com) [c](ipfs://QmRjYZ8KLagkNmmTAwqzWHbUkWyMKonvdBJLV9smhWTuGB/nft.gif) [d](/projects/) [e](#top)",
    );
    assert.equal(out.status, 0, out.stderr);
    for (const s of ["https", "mailto", "ipfs"]) assert.ok(schemes(out.html).includes(s), `${s} missing`);
});
