#!/usr/bin/env python3
"""Derive the README header images from og.png.

og.png is a social card: 1200x630 with the background baked in. Dropped into a
README it renders as a black slab, because the artwork is only 843x147 and the
other 83% of the canvas is empty background. Privacy Guides' header floats
because theirs is a transparent mark with no canvas at all.

So: key the background out and crop to the artwork. og.png is light type on a
solid dark field, which keys cleanly on luminance -- and keying beats
re-typesetting, because it keeps whatever og.png actually says without needing
Public Sans installed or the text re-rendered.

Two variants, because a transparent image inherits the viewer's background and
GitHub has both themes: light type vanishes on the light theme. The README picks
between them with <picture media="(prefers-color-scheme: dark)">, which is the
one place that media query works on GitHub.

Run by hand when og.png changes -- deliberately NOT in `npm run build`. These are
repo-only assets; adding them to the build would put them in dist/ and on the
page-weight budget for no reason.

    python3 scripts/make-readme-header.py
"""

import numpy as np
from PIL import Image

SRC = "og.png"
PAD = 28  # breathing room around the artwork, in source pixels
FLOOR = 0.08  # luminance below this is background, not type

src = Image.open(SRC).convert("RGB")
rgb = np.asarray(src).astype(np.float32)
lum = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0

ys, xs = np.where(lum > FLOOR)
if xs.size == 0:
    raise SystemExit(f"{SRC}: no artwork above the luminance floor -- is it still light-on-dark?")
x0, x1 = max(int(xs.min()) - PAD, 0), min(int(xs.max()) + PAD + 1, src.width)
y0, y1 = max(int(ys.min()) - PAD, 0), min(int(ys.max()) + PAD + 1, src.height)

# Alpha IS the luminance. That preserves antialiased edges exactly, and it keeps
# the subtitle reading as a lighter tone rather than flattening it to solid --
# the same relationship the card has, minus the canvas.
alpha = np.clip(lum[y0:y1, x0:x1], 0.0, 1.0)
h, w = alpha.shape


def variant(path, ink):
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = ink
    out[..., 3] = (alpha * 255).round().astype(np.uint8)
    Image.fromarray(out, "RGBA").save(path, optimize=True)
    print(f"{path}  {w}x{h}")


# Dark theme keeps the original ink so it looks identical to the card it came
# from; light theme swaps to near-black, which the same alpha map then renders as
# solid type with the subtitle a mid grey.
variant("readme-header-dark.png", (255, 255, 255))
variant("readme-header-light.png", (17, 17, 17))
