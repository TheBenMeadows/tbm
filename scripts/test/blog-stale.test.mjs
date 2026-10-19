/* A post that is renamed or deleted must not stay published. The Codeberg and
 * sourcehut builders keep their checkout between runs, and generated post
 * folders are gitignored, so `git reset --hard` never removes them.
 *
 * Runs the real build-blog.mjs twice on a scratch site in the repo root (so
 * the build finds node_modules), with a post removed between the runs. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const post = (title) => `---\ntitle: "${title}"\ndate: 2026-10-18\ndescription: "A post for the stale test."\n---\n\nBody.\n`;

test("a deleted post's folder is gone after the next build, and nothing else is touched", () => {
    const site = mkdtempSync(join(ROOT, ".test-site-"));
    try {
        cpSync(join(ROOT, "scripts"), join(site, "scripts"), {
            recursive: true,
            filter: (src) => !src.includes(`${join("scripts", "test")}`),
        });
        mkdirSync(join(site, "blog", "posts"), { recursive: true });
        mkdirSync(join(site, "blog", "media"), { recursive: true });
        writeFileSync(join(site, "blog", "media", "keep.txt"), "a media file");
        cpSync(join(ROOT, "blog", "authors.json"), join(site, "blog", "authors.json"));
        writeFileSync(join(site, "blog", "posts", "kept-post.md"), post("Kept"));
        writeFileSync(join(site, "blog", "posts", "old-post.md"), post("Old"));
        const build = () => spawnSync(process.execPath, [join(site, "scripts", "build-blog.mjs")], { encoding: "utf8" });

        let run = build();
        assert.equal(run.status, 0, run.stderr);
        assert.ok(existsSync(join(site, "blog", "old-post", "index.html")), "the first build did not write the post");

        rmSync(join(site, "blog", "posts", "old-post.md"));
        run = build();
        assert.equal(run.status, 0, run.stderr);
        assert.ok(!existsSync(join(site, "blog", "old-post")), "the deleted post is still published");
        assert.ok(existsSync(join(site, "blog", "kept-post", "index.html")), "a current post went missing");
        assert.ok(existsSync(join(site, "blog", "media", "keep.txt")), "blog/media was touched");
        assert.ok(existsSync(join(site, "blog", "posts", "kept-post.md")), "blog/posts was touched");
    } finally {
        rmSync(site, { recursive: true, force: true });
    }
});
