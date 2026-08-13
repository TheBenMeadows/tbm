#!/usr/bin/env python3
"""Re-encode PNGs that use 256 or fewer colours as indexed-colour, losslessly.

The favicons and og.png are flat artwork -- generated from Public Sans with no
gradients or shading, deliberately -- so each uses far fewer than 256 distinct
colours while being stored as truecolour RGB/RGBA. Indexing them stores one
byte per pixel plus a small palette instead of three or four bytes per pixel.

This is a container change, not a visual one. The palette holds exactly the
colours already present, in the order found, so no quantisation, dithering or
colour approximation happens at any point. Every output is decoded and compared
pixel-for-pixel against its input, and a file is only replaced when the
comparison is exact AND the result is smaller. Anything else is left alone.

me.png is deliberately not in the list: it is already a 4-bit palette image of
ten colours, and every re-encode tried made it larger.

Run from the repo root:  python3 scripts/optimize-pngs.py [--check]

--check reports what would change and writes nothing, which is what a build or
a CI step should use.
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("optimize-pngs: Pillow is not installed (pip install pillow)")

TARGETS = [
    "og.png",
    "favicon/android-chrome-512x512.png",
    "favicon/android-chrome-192x192.png",
    "favicon/apple-touch-icon.png",
    "favicon/favicon-32x32.png",
    "favicon/favicon-16x16.png",
]

CHECK = "--check" in sys.argv


def rgba_pixels(im):
    """Pixels as 4-byte RGBA tuples.

    Via tobytes() rather than getdata(): getdata() is deprecated for removal in
    Pillow 14 and its replacement is not available in every version this may
    run under, while tobytes() is stable in all of them.
    """
    raw = im.tobytes()
    return [raw[i:i + 4] for i in range(0, len(raw), 4)]


def repack(path: Path):
    """Return (new_bytes, colour_count) or None when indexing cannot help."""
    src = Image.open(path).convert("RGBA")
    pixels = rgba_pixels(src)
    palette = sorted(set(pixels))
    if len(palette) > 256:
        return None, len(palette)

    index = {colour: i for i, colour in enumerate(palette)}
    out = Image.new("P", src.size)
    out.putdata([index[p] for p in pixels])

    flat = []
    for entry in palette:
        flat.extend(entry[:3])
    out.putpalette(flat)

    kwargs = {"format": "PNG", "optimize": True}
    alphas = bytes(entry[3] for entry in palette)
    if any(a != 255 for a in alphas):
        kwargs["transparency"] = alphas

    import io
    buf = io.BytesIO()
    out.save(buf, **kwargs)
    data = buf.getvalue()

    # Decode what we just produced and require it to be pixel-identical. A
    # size win that changes a single pixel is not a win.
    buf.seek(0)
    if rgba_pixels(Image.open(buf).convert("RGBA")) != pixels:
        return None, len(palette)

    return data, len(palette)


saved_total = 0
changed = 0
for name in TARGETS:
    path = Path(name)
    if not path.exists():
        print("%-42s missing, skipped" % name)
        continue

    before = path.stat().st_size
    data, colours = repack(path)
    if data is None:
        print("%-42s %6d B  %3d colours, not indexable" % (name, before, colours))
        continue

    after = len(data)
    if after >= before:
        print("%-42s %6d B  already optimal" % (name, before))
        continue

    saved = before - after
    saved_total += saved
    changed += 1
    print("%-42s %6d -> %6d B  saved %5d  (%d colours)%s"
          % (name, before, after, saved, colours, "  [check]" if CHECK else ""))
    if not CHECK:
        path.write_bytes(data)

verb = "would save" if CHECK else "saved"
print("optimize-pngs: %s %d bytes across %d files" % (verb, saved_total, changed))
