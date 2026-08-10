#!/usr/bin/env python3
"""Package the built site as a ZIM archive: one file that holds the whole site
and opens offline in Kiwix.

Why, when the site already has a dozen mirrors: every one of them answers "can I
still REACH it". None answers "can I HOLD it". A ZIM is the copy someone keeps
on a phone or a USB stick and reads with no network at all, which is a different
failure than any host going down. It is also the format the archival world
already has readers for, so it needs no cooperation from this project to stay
openable.

NOT zimit. zimit is a CRAWLER: it drives headless Chromium in Docker to
discover a site over HTTP. This site's dist/ is already the complete rendered
output on disk, so crawling it would be re-deriving what the build just
produced, and it would need the Docker this fleet does not run. Writing
straight from the directory needs neither a browser nor a container, and its
memory ceiling is the compression cluster (single-digit MB) rather than a
gigabyte of Chromium.

Deliberately NOT part of `npm run build:netlify`: the output is roughly the size
of the site, and shipping a ~35 MB file in every deploy to every mirror would
cost more than it buys. This runs at RELEASE time, and the artifact is attached
to the GitHub release.

    python3 scripts/build-zim.py [dist-dir] [out.zim]

Needs the libzim bindings, which are a wheel and not a system package:

    python3 -m venv .zimvenv && .zimvenv/bin/pip install libzim
    .zimvenv/bin/python scripts/build-zim.py
"""

import mimetypes
import os
import subprocess
import sys

try:
    from libzim.writer import Creator, Item, FileProvider, Hint
except ImportError:
    sys.exit(
        "build-zim: the libzim bindings are missing.\n"
        "  python3 -m venv .zimvenv && .zimvenv/bin/pip install libzim\n"
        "  .zimvenv/bin/python scripts/build-zim.py"
    )

DIST = sys.argv[1] if len(sys.argv) > 1 else "dist"
MAIN = "index.html"

# Types the build ships that the stdlib does not know or gets wrong. A wrong
# MIME in a ZIM is not cosmetic: readers dispatch on it, so a mislabelled
# stylesheet renders the page unstyled inside Kiwix while looking fine on the web.
EXTRA_TYPES = {
    ".webp": "image/webp",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
    ".ots": "application/octet-stream",
    ".torrent": "application/x-bittorrent",
    ".md": "text/markdown",
    ".txt": "text/plain",
}


def mime_for(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in EXTRA_TYPES:
        return EXTRA_TYPES[ext]
    guessed, _ = mimetypes.guess_type(path)
    return guessed or "application/octet-stream"


class FileItem(Item):
    """One file from dist/, kept at the same path it has on the web so that
    every relative link inside the pages resolves unchanged inside the reader."""

    def __init__(self, root, rel):
        super().__init__()
        self.abs = os.path.join(root, rel)
        self.rel = rel

    def get_path(self):
        return self.rel

    def get_title(self):
        return self.rel if self.rel.endswith(".html") else ""

    def get_mimetype(self):
        return mime_for(self.rel)

    def get_contentprovider(self):
        return FileProvider(self.abs)

    def get_hints(self):
        # FRONT_ARTICLE marks what a reader lists as content rather than as an
        # asset. Only pages qualify; listing 714 images as articles would bury
        # the fourteen things a person actually wants to open.
        return {Hint.FRONT_ARTICLE: self.rel.endswith(".html")}


def git(args, fallback=""):
    try:
        return subprocess.run(
            ["git"] + args, capture_output=True, text=True, check=True
        ).stdout.strip()
    except Exception:
        return fallback


def main():
    if not os.path.isfile(os.path.join(DIST, MAIN)):
        sys.exit(f"build-zim: {DIST}/{MAIN} not found. Run the build first.")

    commit = git(["rev-parse", "--short", "HEAD"], "unknown")
    date = git(["log", "-1", "--format=%cd", "--date=format-local:%Y-%m-%d"], "")

    out = sys.argv[2] if len(sys.argv) > 2 else f"tbm-{date or commit}.zim"

    files = []
    for dirpath, _dirnames, filenames in os.walk(DIST):
        for name in filenames:
            rel = os.path.relpath(os.path.join(dirpath, name), DIST)
            # The torrent describes dist/ from outside it; carrying it inside an
            # offline copy of dist/ is dead weight to a reader with no network.
            if rel.endswith(".torrent"):
                continue
            files.append(rel)
    files.sort()

    total = sum(os.path.getsize(os.path.join(DIST, f)) for f in files)

    with Creator(out).config_indexing(True, "eng") as creator:
        creator.set_mainpath(MAIN)
        for key, value in {
            "Name": "thebenmeadows.com",
            "Title": "TheBenMeadows",
            "Creator": "Ben Meadows",
            "Publisher": "Ben Meadows",
            "Description": "Art and tech: projects, experiments and a colophon.",
            "Language": "eng",
            "Date": date or "1970-01-01",
            # The commit is the only thing that makes two ZIMs comparable, the
            # same reason build-stamp.mjs stamps pages with it.
            "Source": f"https://thebenmeadows.com/ @ {commit}",
            "Scraper": "scripts/build-zim.py",
        }.items():
            creator.add_metadata(key, value)

        for rel in files:
            creator.add_item(FileItem(DIST, rel))

    size = os.path.getsize(out)
    print(
        f"build-zim          {len(files)} files, {total / 1048576:.1f} MB in "
        f"-> {out} ({size / 1048576:.1f} MB) @ {commit}"
    )


if __name__ == "__main__":
    main()
