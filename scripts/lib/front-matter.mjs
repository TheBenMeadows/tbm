/* Front matter for blog/posts/*.md, shared by scripts/build-blog.mjs and
 * scripts/build-news.mjs so both read a post the same way. */

/* A deliberately small reader rather than a YAML dependency: the front matter is
 * a fixed set of scalar keys plus one bracketed list, and a real YAML parser
 * would accept far more than this build knows how to render. If a post needs a
 * key that is not here, the build should fail loudly rather than drop it. */
const KNOWN = new Set(["title", "subtitle", "date", "updated", "tags", "description", "image", "image_alt",
                       "author", "pin", "related", "unlisted", "list_title"]);

export function frontMatter(text, file) {
    if (!text.startsWith("---\n")) throw new Error(`build-blog: ${file} has no front matter`);
    const end = text.indexOf("\n---\n", 3);
    if (end === -1) throw new Error(`build-blog: ${file} front matter is not closed`);
    const meta = {};
    for (const line of text.slice(4, end).split("\n")) {
        if (!line.trim()) continue;
        const i = line.indexOf(":");
        if (i === -1) throw new Error(`build-blog: ${file} front-matter line is not key: value -- ${line}`);
        const key = line.slice(0, i).trim();
        let value = line.slice(i + 1).trim();
        if (!KNOWN.has(key)) throw new Error(`build-blog: ${file} has unknown front-matter key "${key}"`);
        if (key === "tags" || key === "related") {
            meta[key] = value.replace(/^\[|\]$/g, "").split(",").map((t) => t.trim()).filter(Boolean);
            continue;
        }
        if (key === "pin") {
            const n = Number(value);
            if (!Number.isInteger(n) || n < 1) {
                throw new Error(`build-blog: ${file} pin must be a whole number from 1 up, got "${value}"`);
            }
            meta.pin = n;
            continue;
        }
        /* An unlisted post is built at its URL and stamped, but kept out of the
         * blog index, the feed and site search, and told to search engines as
         * noindex. It exists for a superseded version of a post that the current
         * one links to, so the old text stays readable at a stable address without
         * competing with the new one anywhere the site lists posts. */
        if (key === "unlisted") {
            if (value !== "true" && value !== "false") {
                throw new Error(`build-blog: ${file} unlisted must be true or false, got "${value}"`);
            }
            meta.unlisted = value === "true";
            continue;
        }
        if (value.startsWith('"')) value = JSON.parse(value);
        meta[key] = value;
    }
    for (const need of ["title", "date", "description"]) {
        if (!meta[need]) throw new Error(`build-blog: ${file} is missing front-matter "${need}"`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`build-blog: ${file} date must be YYYY-MM-DD`);
    /* `updated` had no check at all, while it reaches both longDate() and the
     * Atom <updated> element raw -- a malformed value injects markup into the
     * page or invalid XML into the feed. */
    if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) {
        throw new Error(`build-blog: ${file} updated must be YYYY-MM-DD`);
    }
    return { meta, body: text.slice(end + 5) };
}
