#!/opt/homebrew/bin/uv run --script
# /// script
# dependencies = ["fonttools", "brotli"]
# ///
"""Build the shared Public Sans for the thebenmeadows.com family.

usage: build-font.py <source woff2 (full Public Sans, wght 100-900)> <reference woff2 (character set)> <out woff2>

- weight axis cut to 400-700, the weights the sites use;
- characters: the reference file's set plus typographic punctuation;
- features: kern, liga, tnum (lining figures are the default);
- the kerning pairs between hyphen and space are removed: Public Sans pulls the
  space after a hyphen in by 0.16em, so a spaced hyphen (" - ") read as "a -b".
"""
import sys
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def drop_hyphen_space_kerning(font):
    cmap = font.getBestCmap()
    pair = {cmap[0x2D], cmap[0x20]}
    removed = 0
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            t = st.ExtSubTable if lookup.LookupType == 9 else st
            if getattr(t, "LookupType", lookup.LookupType) != 2 or t.Format != 1:
                continue
            for first, pairset in zip(t.Coverage.glyphs, t.PairSet):
                keep = [r for r in pairset.PairValueRecord if {first, r.SecondGlyph} != pair]
                removed += len(pairset.PairValueRecord) - len(keep)
                pairset.PairValueRecord = keep
                pairset.PairValueCount = len(keep)
    return removed


def main():
    src, ref, out = sys.argv[1:4]
    chars = set(TTFont(ref).getBestCmap()) | {ord(c) for c in "‘’“”…–—·×€£ "}
    font = instancer.instantiateVariableFont(TTFont(src), {"wght": (400, 700)})
    removed = drop_hyphen_space_kerning(font)
    opts = subset.Options()
    opts.layout_features = ["kern", "liga", "tnum"]
    opts.flavor = "woff2"
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=sorted(c for c in chars if c in font.getBestCmap()))
    s.subset(font)
    font.flavor = "woff2"
    font.save(out)
    g = TTFont(out)
    print(f"{out}: {len(g.getBestCmap())} characters, axis {[(a.axisTag, a.minValue, a.maxValue) for a in g['fvar'].axes]}, "
          f"GSUB {sorted({r.FeatureTag for r in g['GSUB'].table.FeatureList.FeatureRecord})}, hyphen-space pairs removed: {removed}")


main()
