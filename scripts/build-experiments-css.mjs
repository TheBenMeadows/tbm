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

import { execSync } from "node:child_process";

const PAGES = {
    pendulum: ["index.html", "app.js"],
    porcine: ["index.html", "app.js"],
    dls: ["index.html"],
    // etherhoo uses no Tailwind -- its styling is entirely its own <style> block.
};

for (const [page, files] of Object.entries(PAGES)) {
    const content = files.map((f) => `./experiments/${page}/${f}`).join(",");
    execSync(
        `npx tailwindcss -i ./scripts/experiments-input.css -o ./experiments/${page}/style.css --content "${content}" --minify`,
        { stdio: "inherit" },
    );
    console.log(`built experiments/${page}/style.css`);
}
