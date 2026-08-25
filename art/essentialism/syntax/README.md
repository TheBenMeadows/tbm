# Vendored: MicroLighter 2.1.0

    microlighter.min.js        copied from the package's dist/microlighter.min.js
    grammars/javascript.js     copied from the package's dist/grammars/javascript.js
    LICENSE                    the package's MIT licence, unchanged

These files draw the "highlight syntax" control on /art/essentialism/ and are
used nowhere else on the site.

They are vendored rather than installed because the site travels as bytes. The
Arweave snapshot, the IPNS root, the nsite copy, the ZIM and the torrent each
carry the files they serve, and none of them can resolve a package manager. A
file in this directory reaches every one of those surfaces unchanged.

## The directory layout is fixed

`microlighter.min.js` loads a grammar with `import("./grammars/<lang>.js")`,
resolved against its own URL. Move either file and the import breaks at
runtime without a console error, because the loader turns a failed grammar
fetch into a null and the block stays plain.

The JavaScript grammar does not reference another language's scope, so it pulls
in no further files. Every other language and every theme in the package was
dropped.

Importing `microlighter.min.js` highlights the page once as a side effect and
leaves a `syntax-highlight` event listener behind for re-runs. That suits this
page: the import happens on the first click of the control, so a visitor who
never clicks fetches neither file.

## Colours live in src/input.css

The package includes ten themes and none is used. The highlight colours are
the generator's own ink library, taken from `LIB` in `../essentialism.js`, so
the listing is painted in the inks the code paints with. They are defined as
`--syn-*` variables at the foot of `src/input.css` and follow the light/dark
control like the rest of the site.

## Updating

Copy both files from the new release, then confirm two things by hand, because
no test covers either one:

1. `microlighter.min.js` still resolves grammars against its own URL.
2. `grammars/javascript.js` still references no other language's scope.

Upstream: https://github.com/davatron5000/microlighter
