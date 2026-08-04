/* SVG optimizer settings for icons/.
 *
 * The social icons are the single heaviest thing on the homepage after the font
 * -- 14 separate files, and 512kb.club measures UNCOMPRESSED bytes, so they count
 * at full weight against the <100KB green-team line.
 *
 * Two settings here are load-bearing and must not be "cleaned up":
 *
 * removeViewBox: false -- svgo's default preset strips viewBox whenever width and
 *   height are present, which it considers redundant. It is not redundant here.
 *   index.html renders these as <img width="30" height="30">, so the SVG needs a
 *   viewBox to scale into that box; without it the icon renders at its intrinsic
 *   canvas size and crops. The default silently broke lenster, linkedin and nostr.
 *
 * floatPrecision: 2 -- on a 24-unit viewBox this is 0.01 units, about 1/80th of a
 *   pixel at the 30px display size. Verified by rendering every icon before and
 *   after at 3x and diffing: the only changed pixels are antialiased curve edges.
 *   Precision 1 saves another ~2.8KB but visibly moves path landmarks -- don't.
 *
 * Not worth doing: combining these into a single <symbol> sprite. It removes 14
 * requests, but only ~550 uncompressed bytes once the <symbol> wrappers and the
 * longer <use> markup are counted, and external <use href> references bring their
 * own caching and CORS quirks. Measured, not assumed.
 *
 *     npm run optimize:icons
 */
export default {
  multipass: true,
  floatPrecision: 2,
  plugins: [
    { name: "preset-default", params: { overrides: { removeViewBox: false } } },
    // Intrinsic width/height are dead weight -- index.html sizes every icon.
    "removeDimensions",
  ],
};
