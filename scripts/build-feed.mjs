// Build an Atom feed of site releases from git history.
//
// The site has no blog; what changes is the site itself, so the feed is the
// release log: one entry per commit on main. That also keeps the feed
// deterministic -- built from commit metadata only, never the build clock, so
// the same commit yields identical bytes on every host and the manifest and
// signature still hold. All dates are forced to UTC; git's format-local
// renders in the builder's timezone and already broke reproducibility once.
//
// Entry count is capped at 15. If a host's shallow clone has fewer commits the
// feeds would diverge between hosts -- the manifest check will catch that, and
// the fallback is lowering the cap. (Verified after first deploy.)
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function git(args) {
    return execSync(`git ${args}`, {
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, TZ: "UTC" },
    }).toString().trim();
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

let lines = [];
try {
    lines = git('log -15 --format=%H%x09%cd%x09%s --date=format-local:%Y-%m-%dT%H:%M:%SZ')
        .split("\n").filter(Boolean);
} catch {
    console.warn("build-feed: git log unavailable, writing empty feed");
}

const entries = lines.map((l) => {
    const [sha, date, subject] = l.split("\t");
    return `  <entry>
    <id>tag:thebenmeadows.com,2026:release/${sha}</id>
    <title>${esc(subject)}</title>
    <updated>${date}</updated>
    <link href="https://thebenmeadows.com/" />
    <content type="text">Site release ${sha.slice(0, 7)}: ${esc(subject)}. Every build ships a signed manifest; see /mirrors/ for verification.</content>
  </entry>`;
}).join("\n");

const feedUpdated = lines.length ? lines[0].split("\t")[1] : "2026-01-01T00:00:00Z";

const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>https://thebenmeadows.com/feed.xml</id>
  <title>TheBenMeadows — site releases</title>
  <subtitle>Changes to thebenmeadows.com, one entry per release.</subtitle>
  <updated>${feedUpdated}</updated>
  <link href="https://thebenmeadows.com/" />
  <link rel="self" href="https://thebenmeadows.com/feed.xml" />
  <author><name>Ben Meadows</name><uri>https://thebenmeadows.com/</uri></author>
${entries}
</feed>
`;
writeFileSync("feed.xml", feed);
console.log(`build-feed         ${lines.length} entries, updated ${feedUpdated}`);
