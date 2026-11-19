# Public Sans

`publicsans-v2.woff2` is [Public Sans](https://github.com/uswds/public-sans) (SIL Open Font License 1.1), the one font file shared by thebenmeadows.com, art and dailymuse, abx, fs.abx, the find3r fork and benjaminmeadows.com.

It is cut from the full variable font by `scripts/build-font.py`:

- weight axis 400-700, the weights the sites use;
- the character set of the previous file plus typographic punctuation (200 characters);
- OpenType features kern, liga and tnum (tabular figures; lining figures are the default);
- the two kerning pairs between hyphen and space removed. Public Sans pulls the space after a hyphen in by 0.16em (and before it by 0.11em), so a spaced hyphen, " - ", read as "a -b".

`scripts/check-font.mjs` (CI: `npm run check:font`) renders the file in Chrome and fails if a space beside a hyphen is narrowed, if tabular figures are missing, or if the weight axis does not run 400 to 700. Every other width is identical to the previous file.

The name carries a version because `/fonts/*` is served immutable: a changed font gets a new name.
