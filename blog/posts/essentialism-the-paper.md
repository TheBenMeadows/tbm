---
title: "essentialism: the paper"
date: 2026-10-13
tags: [Art, Blockchain, Technology]
related: [essentialism-the-working-log, /art/essentialism/]
image: /blog/media/essentialism-the-paper/curve.webp
image_alt: "Correlation with the photograph by edition. The field stays near 1 until about edition 22 and falls steeply after edition 34; the drawn dots follow the same shape lower; the control stays near zero."
description: "Every essentialism token prints a memory percentage. I measured what that number leaves of the photograph across 44,000 renders and wrote it up as a paper, archived on Zenodo with a DOI."
---

Every token of [essentialism](/art/essentialism/) prints a "memory" percentage in its trait line: how strongly that edition samples the photograph embedded in the code. It is 100% on edition 1 and falls about two points per edition to 12% on edition 44. I had never checked what that number leaves of the photograph in the finished drawing, so I rendered 1,000 seeds at all 44 editions (44,000 renders) with a byte-identical copy of the generator stored on Tezos, and measured it in two places: the darkness field the dots sample, and the ink of the dots themselves.

**The curve**

The field loses 0.06 of its correlation with the tree over the first 22 editions and 0.43 between editions 34 and 44. That shape comes from the mix and says nothing about memory. The photograph's weight falls in a straight line while the noise weight rises, and a mix like that holds until the two contribute equal spread, which for the tree happens at edition 33.5. A formula with two measured variances reproduces the field curve to within 0.010 for the tree and 0.021 for the sky.

The dots follow the same shape, less sharply. The median rank correlation between a dot's ink and the photograph under it is 0.82 on edition 1 and 0.14 on edition 44 (tree). For a control I re-rendered every seed with the other photograph in its place; that control's median stays between 0.00 and 0.10. The decline is orderly only in the median. A random edition-44 render shows more of the tree than a random edition-34 render 26% of the time, so among the 44 tokens that actually get minted, a later one can show more of its photograph than an earlier one.

**The label**

A printed percentage and a measured correlation are different quantities, but the token invites the comparison. Read against the median of the dots, the label is too high through edition 11 and too low from edition 12 (the one exception is the sky at edition 42). On edition 44 the label says 12%, the dots measure 0.14 and the field 0.27.

Nine of the 44 are minted. The latest is edition 9, which prints 84%, and renders at that edition number have a median of 0.79 for the tree and 0.81 for the sky. The steep part of the curve is entirely in editions nobody has minted yet.

**The ledger**

The piece assumes the ledger keeps everything. It does, including something I would have chosen to forget: version 1 of the generator, published at 22:10 UTC on July 31, opened with a comment claiming the 2022 algorithm as mine, and edition 1 was minted under it four minutes later. Version 4, at 03:03 UTC on August 1, credited Andy Haskell; the [working log](/blog/essentialism-the-working-log/) covers how that happened. The contract can overwrite its current code, but TzKT still returns all six versions.

For each token the chain also stores its edition number and the entropy drawn at mint. With those and the code, anyone should be able to redraw any token. For edition 1 I could not: rendering from its stored entropy, from that entropy reduced modulo 2^32, and from the viewer seed I recorded in August gives three different pictures, and none of them is the platform's own image of the token. The memory value is still recoverable for every token, since it depends only on the edition number.

**Rebuilding it**

`make` in the repository rebuilds every number, table and figure in the paper from the chain copy of the generator, which is checked against a pinned SHA-256. The measurement takes under a minute on an Apple-silicon Mac. The full-resolution photographs are not included; the grids stored in the code are the authority.

Claude drafted the port, the measurement scripts and the text of the paper under my direction. Eight models reviewed the drafts, and every measurable defect they reported was reproduced or refuted by a script before it changed the paper; its last section names them.

The paper is [here as a PDF](/papers/essentialism/essentialism-preprint.pdf) and archived at [doi.org/10.5281/zenodo.23333266](https://doi.org/10.5281/zenodo.23333266), with the code and data at [github.com/TheBenMeadows/essentialism-preprint](https://github.com/TheBenMeadows/essentialism-preprint). Corrections go to that repository's issues.
