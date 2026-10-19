// Compile a standalone Tailwind stylesheet for each ported experiment page.
//
// These pages arrived from mdws.me as single files leaning on the Tailwind
// Play CDN. The site serves no external origins (see the CSP in _headers), so
// each page gets its own compiled stylesheet, built ONLY from its own class
// names. The outputs are committed: the pages are frozen experiments, and a
// committed artifact cannot drift between build hosts the way a rebuild can.
// This script is therefore NOT part of `npm run build` -- rerun it by hand
// (`npm run build:experiments`) only if a page's markup changes.
//
// The main site stylesheet (output.css) is untouched: sharing it would impose
// the site theme on pages whose whole point is to look like themselves.

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const PAGES = {
    pendulum: ["index.html", "app.js"],
    porcine: ["index.html", "app.js"],
    dls: ["index.html"],
    // etherhoo uses no Tailwind -- its styling is entirely its own <style> block.
};

// Tailwind 4 takes its sources from the stylesheet, not the command line, so each
// page gets a throwaway input next to the shared one: the shared input plus one
// @source line per file of that page. It sits in scripts/ so the relative paths
// in the shared input still resolve.
const shared = readFileSync("./scripts/experiments-input.css", "utf8");

for (const [page, files] of Object.entries(PAGES)) {
    const input = `./scripts/.experiments-${page}.css`;
    const sources = files.map((f) => `@source "../experiments/${page}/${f}";`).join("\n");
    writeFileSync(input, `${shared}\n${sources}\n`);
    try {
        execFileSync(
            "npx",
            ["@tailwindcss/cli", "-i", input, "-o", `./experiments/${page}/style.css`, "--minify"],
            { stdio: "inherit" },
        );
    } finally {
        rmSync(input, { force: true });
    }
    console.log(`built experiments/${page}/style.css`);
}
