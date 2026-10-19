/* The URL schemes a post may link to. A post can be written by a guest or an
 * agent, and the Tor, IPFS, Arweave, torrent and ZIM copies of the site carry
 * no CSP, so a javascript: or data: link would run wherever it is clicked.
 * ipfs: is here because a post links an ipfs:// file. A link with no scheme
 * (a site path, a fragment, a relative file) is always allowed. */
export const LINK_SCHEMES = ["http", "https", "mailto", "ipfs"];

/* The scheme as a browser reads it: tabs and newlines removed anywhere,
 * leading spaces and control characters dropped, case folded. */
export function linkScheme(href) {
    const s = String(href).replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+/, "");
    const m = /^([a-z][a-z0-9+.-]*):/i.exec(s);
    return m ? m[1].toLowerCase() : null;
}

/* Return `href`, or stop the build when its scheme is not allowed. */
export function checkHref(href, where) {
    const scheme = linkScheme(href);
    if (scheme && !LINK_SCHEMES.includes(scheme)) {
        throw new Error(`${where}: a link to "${scheme}:" is not allowed (${href})`);
    }
    return href;
}
