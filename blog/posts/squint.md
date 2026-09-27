---
title: "Squint 0.8.1"
date: 2026-09-26
tags: [Photography, Technology]
related: [/projects/]
image: /blog/media/squint/profile-split.webp
image_alt: "One photo split down the middle. Left: ICC color profile kept. Right: profile dropped."
description: "One 4032x3024 Display P3 photo through Squint and through ImageOptim: 401,879 bytes against 400,965 at the same SSIMULACRA2 score, and only one of the two files still has its color profile."
---

One 4032x3024 Display P3 photo, on an M1. ImageOptim in lossy mode at its author's default quality of 74.5 wrote 400,965 bytes, SSIMULACRA2 76.95. Squint in fast mode wrote 401,879 bytes, SSIMULACRA2 76.95. Same size, same score. The 914 extra bytes are the Display P3 profile, which ImageOptim's file no longer has.

Roof photos go into my reports and emails every day, and for years ImageOptim was what shrank them. Its interaction model is right and I copied it: drop files on a window, or right-click them in Finder, and they get smaller. Three things it does not do: it cannot write WebP or AVIF; it produces exactly one output per input, because its job model tracks a single result per file, so there is no "smaller copy beside the original"; and its quality is one fixed number applied to every image. One thing it does that I did not want: with strip-metadata on, it passes `-copy none` to jpegtran and `--strip-all` to jpegoptim, and both drop every marker, the ICC profile included. Those photos are Display P3 out of an iPhone, and every one of them came back flatter than it went in.

That profile is what the picture at the top of this post is about. An iPhone shoots in Display P3 and tags each photo with an ICC profile. ImageOptim's "strip metadata" option removes every marker in the file, including that one, and a viewer that finds no profile assumes sRGB and displays the colors pulled in toward the smaller gamut. The photo is one file split down the middle, profile kept on the left and dropped on the right; mean saturation (HSV, averaged over the frame) is 22% lower on the right. Location and camera data live in EXIF and XMP. The profile is a separate ICC segment. Squint removes the first and leaves the second, in every mode.

The other difference is the quality setting. Most optimizers apply one number to every image. Squint encodes each image at a candidate quality, scores it against the original with SSIMULACRA2, and narrows to the smallest file that still meets the target (default 80; 70 is general web, 90 is visually lossless). A flat screenshot and a noisy photograph end at different encoder settings. If no smaller file meets the target, the original is left as it is; nothing Squint writes is larger than what it read.

![Finder with a JPEG selected and the Services submenu open, showing the six Squint entries](/blog/media/squint/finder-services-menu.webp)

It is used from the right-click menu in Finder, six entries, each shown only when every selected file is a type that entry accepts. Shrink is one encode at a fixed quality, in place; the replacement goes through FileManager.replaceItemAt, so Finder tags and the creation date survive. Shrink to a Quality Target is the search above, in place. Shrink for Email and Shrink for Social write a copy beside the original at 2048 px or 1440 px on the long edge, as name-email.jpg or name-social.jpg; Nostr clients do not recompress uploads, so the social copy is the file that gets served. Remove Location Data strips EXIF, XMP and the other metadata segments without re-encoding, and takes HEIC, AVIF, WebP, TIFF, GIF and PDF as well. Convert to AVIF writes name.avif beside the original at full resolution, searched to the target; the encode goes through Image I/O because no pure-Rust AVIF encoder can embed an ICC profile.

![The Squint window after a run: a JPEG shrunk 70% in place, a PDF shrunk 81%, a HEIC and a PNG converted to AVIF with their scores, and a JPEG with its location data removed](/blog/media/squint/squint-window.webp)

0.8.1 is the version that went out today. It takes a PDF from those Finder entries: the image XObjects inside the document are decoded, re-encoded at the entry's setting, downscaled to 150 dpi where they exceed it, and written back, and the document is rewritten in place. Fax-coded, JPEG 2000 and CMYK images inside a PDF are left as they are. AVIF output reached Finder in the same release. Builds are signed with a Developer ID and notarized from 0.7.1 on. Apple silicon only, macOS 14 or later; there is no Intel build, and no lossy WebP, since the only pure-Rust WebP encoder is lossless and lossy would mean a C dependency. HDR gain maps survive Remove Location Data but not a re-encode.

Rust engine, SwiftUI shell, GPL-3, Sparkle for updates. [Source and README](https://github.com/mdws-org/squint), [download](https://github.com/mdws-org/squint/releases/latest), or `brew install mdws-org/tap/squint`. Bug reports and measurements go to the GitHub issues; a claim in the README is checked with the corpus runner in tools/ before it goes in, and a counter-measurement filed the same way gets the same treatment.
