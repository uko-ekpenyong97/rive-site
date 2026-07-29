/**
 * Shared helpers for the render smoke suite.
 *
 * HISTORY: these assertions began life as `.context/modal-smoke.mjs`, an
 * untracked script run by hand in each session. It accumulated five sessions of
 * guards and was never committed, because `.context/` is gitignored — so the
 * project's entire verification layer lived outside version control and every
 * "N assertions passing" claim was unreproducible. This suite is that script,
 * ported to Vitest and tracked. The original ran its own Vite dev server and
 * called `ssrLoadModule`; Vitest already *is* the Vite pipeline, so the modules
 * are imported directly and that scaffolding is gone.
 */

/**
 * Approximate the text a user (or an accessible-name computation) would see:
 * strip tags, decode the entities React emits, collapse whitespace.
 *
 * Decodes a superset of what any single original check decoded. That is safe
 * because every assertion built on this is a substring test, and decoding can
 * only ever turn an entity back into the literal the source string already used.
 */
export function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&middot;|&#xB7;/g, "·")
    .replace(/\s+/g, " ")
    .trim();
}

/** Count non-overlapping occurrences of a pattern in a string. */
export function count(haystack: string, pattern: RegExp): number {
  return (haystack.match(pattern) || []).length;
}
