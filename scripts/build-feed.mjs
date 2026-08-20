// Build an Atom feed of site releases from git history.
//
// The site has no blog; what changes is the site itself, so the feed is the
// release log: one entry per commit on main. That also keeps the feed
// deterministic -- built from commit metadata only, never the build clock, so
// the same commit yields identical bytes on every host and the manifest and
// signature still hold. All dates are forced to UTC; git's format-local
// renders in the builder's timezone and already broke reproducibility once.
//
// One entry: the current release. Cloudflare Pages clones at depth 1, so any
// deeper history diverges between hosts -- the first deploy proved it, one
// entry on Cloudflare against fifteen on Netlify, caught by the manifest
// comparison. Depth 1 is the only count every builder is guaranteed to have.
// Subscribers still accumulate a release log, one entry per poll cycle.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

function git(args) {
    return execSync(`git ${args}`, {
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, TZ: "UTC" },
    }).toString().trim();
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// No fallback. An empty feed is a valid-looking artifact that the manifest
// then hashes, sign-release signs and OpenTimestamps anchors -- the chain would
// certify the degraded file faithfully. Every host that builds this site has
// git, so the old warn-and-continue protected nothing and hid the one case it
// was written for.
const lines = git('log -1 --format=%H%x09%cd%x09%s --date=format-local:%Y-%m-%dT%H:%M:%SZ')
    .split("\n").filter(Boolean);
if (!lines.length) {
    throw new Error("build-feed: git log returned nothing; refusing to write an empty feed");
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

const feedUpdated = lines[0].split("\t")[1];

// WebSub: readers that speak it get pushed updates instead of polling. The
// wayback workflow pings the hub after each deploy.
const HUB = "https://pubsubhubbub.appspot.com/";

const rssItems = lines.map((l) => {
    const [sha, date, subject] = l.split("\t");
    return `    <item>
      <guid isPermaLink="false">tag:thebenmeadows.com,2026:release/${sha}</guid>
      <title>${esc(subject)}</title>
      <pubDate>${new Date(date).toUTCString()}</pubDate>
      <link>https://thebenmeadows.com/</link>
      <description>Site release ${sha.slice(0, 7)}: ${esc(subject)}. Every build ships a signed manifest; see /mirrors/ for verification.</description>
    </item>`;
}).join("\n");

const rss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>TheBenMeadows — site releases</title>
    <link>https://thebenmeadows.com/</link>
    <description>Changes to thebenmeadows.com, one entry per release.</description>
    <lastBuildDate>${new Date(feedUpdated).toUTCString()}</lastBuildDate>
    <atom:link rel="self" href="https://thebenmeadows.com/rss.xml" type="application/rss+xml" />
    <atom:link rel="hub" href="${HUB}" />
${rssItems}
  </channel>
</rss>
`;
writeFileSync("rss.xml", rss);

const feed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>https://thebenmeadows.com/feed.xml</id>
  <title>TheBenMeadows — site releases</title>
  <subtitle>Changes to thebenmeadows.com, one entry per release.</subtitle>
  <updated>${feedUpdated}</updated>
  <link href="https://thebenmeadows.com/" />
  <link rel="self" href="https://thebenmeadows.com/feed.xml" />
  <link rel="hub" href="${HUB}" />
  <author><name>Ben Meadows</name><uri>https://thebenmeadows.com/</uri></author>
${entries}
</feed>
`;
writeFileSync("feed.xml", feed);
console.log(`build-feed         ${lines.length} entries (atom + rss), updated ${feedUpdated}`);
