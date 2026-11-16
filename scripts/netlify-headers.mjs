// Netlify build only: remove Cloudflare's header-detach lines from dist/_headers.
//
// A line of the form "  ! Header-Name" is Cloudflare Pages syntax for dropping
// a header inherited from a broader rule. Netlify does not know it and reports
// the rule as invalid. Netlify needs no detach: for one path it serves the most
// specific rule's value of a header, so the folder policy already replaces the
// site-wide one there. Cloudflare Pages runs this same build without NETLIFY
// set and keeps the file as written.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2] || "dist/_headers";
if (process.env.NETLIFY !== "true") {
    console.log("netlify-headers    not a Netlify build, _headers left as written");
} else {
    const lines = readFileSync(path, "utf8").split("\n");
    const kept = lines.filter((line) => !/^\s+!\s*\S/.test(line));
    writeFileSync(path, kept.join("\n"));
    console.log(`netlify-headers    removed ${lines.length - kept.length} detach line(s) from ${path}`);
}
