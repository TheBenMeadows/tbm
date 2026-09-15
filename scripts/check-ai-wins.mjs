/* Validate ai/wins.json before scripts/build-ai.mjs renders it.
 *
 * The page makes one claim per entry -- that something happened outside this site
 * and a stranger can go and look at it -- so the fields that carry that claim are
 * required here rather than checked by eye. Two rules are less obvious:
 *
 * 1. No tool or agent names in the title or summary. The page reports outcomes, not
 *    which model, agent or product produced them. A linked page may name whatever it
 *    likes; that is its content, not a claim this site makes. NAMES below is matched on
 *    word boundaries so a venue called OpenAgents survives while a stray "agent" does
 *    not.
 *
 * 2. Links are optional and are NOT fetched. Some venues publish no permanent result
 *    page, and a build that fetches third-party URLs fails on a rate limit or a bot
 *    challenge, neither of which says anything about the entry. `npm run
 *    check:ai-links` does the network pass, on demand, away from the build.
 *
 *   node scripts/check-ai-wins.mjs     exit 1 and name every offending entry
 */
import { readFileSync } from "node:fs";

const FILE = "ai/wins.json";
const KIND_DESCRIPTIONS = {
    merged: "a change merged into a repository Ben does not own",
    placement: "a competition or bounty result",
    audit: "a published audit or verification verdict",
    release: "a released tool with a live address",
};

const NAMES = [
    "orrery", "lathe", "claude", "anthropic", "openai", "chatgpt", "gpt",
    "gemini", "deepseek", "devin", "codex", "copilot", "cursor", "llama",
    "kimi", "grok", "qwen", "sonnet", "opus", "haiku", "fable",
    "agent", "agents", "bot", "llm", "ai",
];
const NAME_PATTERN = new RegExp(`\\b(${NAMES.join("|")})\\b`, "i");

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const data = JSON.parse(readFileSync(FILE, "utf8"));

if (!Array.isArray(data.wins)) fail(FILE, "`wins` must be an array");
if (!data.kinds || typeof data.kinds !== "object") fail(FILE, "`kinds` must be an object of kind -> label");

for (const kind of Object.keys(KIND_DESCRIPTIONS)) {
    if (!data.kinds?.[kind]) fail(FILE, `\`kinds\` is missing "${kind}" (${KIND_DESCRIPTIONS[kind]})`);
}

const today = new Date().toISOString().slice(0, 10);
const seen = new Set();

for (const [i, win] of (data.wins ?? []).entries()) {
    const where = `${FILE} wins[${i}]${win?.id ? ` (${win.id})` : ""}`;

    if (!ID_PATTERN.test(win?.id ?? "")) fail(where, "`id` must be lower-case kebab-case");
    else if (seen.has(win.id)) fail(where, `duplicate id "${win.id}"`);
    else seen.add(win.id);

    if (!DATE_PATTERN.test(win?.date ?? "")) fail(where, "`date` must be YYYY-MM-DD");
    else if (Number.isNaN(Date.parse(`${win.date}T00:00:00Z`))) fail(where, `\`date\` "${win.date}" is not a real date`);
    else if (win.date > today) fail(where, `\`date\` "${win.date}" is in the future; an entry is added after the outcome, not before`);

    if (!data.kinds?.[win?.kind]) fail(where, `\`kind\` "${win?.kind}" is not one of: ${Object.keys(data.kinds ?? {}).join(", ")}`);

    for (const field of ["title", "where", "summary"]) {
        const value = win?.[field];
        if (typeof value !== "string" || value.trim() === "") fail(where, `\`${field}\` is required`);
    }

    if (!Array.isArray(win?.links)) {
        fail(where, "`links` must be an array, empty when the venue publishes no permanent page");
    } else {
        for (const [j, link] of win.links.entries()) {
            if (typeof link?.label !== "string" || link.label.trim() === "") fail(where, `links[${j}].label is required`);
            if (typeof link?.url !== "string" || !link.url.startsWith("https://")) fail(where, `links[${j}].url must be an absolute https URL`);
        }
    }

    /* `where` and link labels are exempt: they carry the name of the venue or the
     * upstream project, several of which contain a vendor's name, and that is a fact
     * about where the work landed rather than a claim about what produced it. */
    const prose = [win?.title, win?.summary].filter((s) => typeof s === "string").join(" ");
    const named = prose.match(NAME_PATTERN);
    if (named) fail(where, `names a tool or agent ("${named[0]}"). The entry states the outcome; the linked page can name what it likes.`);
}

/* Quotes are other people's words, copied from a public page. They may name whatever
 * their author named, so the NAMES check does not apply; what they must have is the
 * page they came from, or a reader cannot check that the words are real. */
if (!Array.isArray(data.quotes)) {
    fail(FILE, "`quotes` must be an array, empty if there is nothing to quote");
} else {
    for (const [i, q] of data.quotes.entries()) {
        const where = `${FILE} quotes[${i}]`;
        for (const field of ["quote", "who"]) {
            if (typeof q?.[field] !== "string" || q[field].trim() === "") fail(where, `\`${field}\` is required`);
        }
        if (!DATE_PATTERN.test(q?.date ?? "")) fail(where, "`date` must be YYYY-MM-DD");
        else if (q.date > today) fail(where, `\`date\` "${q.date}" is in the future`);
        if (typeof q?.url !== "string" || !q.url.startsWith("https://")) fail(where, "`url` must be the absolute https page the words were copied from");
    }
}

if (errors.length > 0) {
    console.error(`ai wins           ${errors.length} problem(s) in ${FILE}:`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
}

console.log(`ai wins           ${data.wins.length} entr${data.wins.length === 1 ? "y" : "ies"} in ${FILE} are well formed`);
