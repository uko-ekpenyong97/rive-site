/**
 * The Rive logotype, as vector outlines.
 *
 * SOURCE: extracted 2026-07-29 from rive.app's own homepage — the inline SVG
 * symbol `id="svg708989497_1859"`, viewBox 0 0 275 50, a single filled path.
 * Nothing in this repo had letterform geometry: src/assets/logos holds only the
 * customer brand marks from the marquee, and both Nav and Footer render "RIVE"
 * as text in Tomorrow.
 *
 * NOT PUT THROUGH scripts/normalize-logos.mjs, deliberately. That pipeline maps
 * fills to currentColor for FILLED brand wordmarks; this treatment is the
 * opposite — `fill: none` with layered strokes — so normalising would fight the
 * effect it exists to enable. The data lives here as a constant instead.
 *
 * Rive's logotype, used in a disclaimed redesign study; replace if this codebase
 * is ever repurposed.
 */

/** All four letters. One path, four subpaths. */
export const RIVE_WORDMARK_PATH =
  "M1.949 0h27.948c3.16 0 5.954.662 8.379 1.985 2.468 1.28 4.395 3.051 5.78 5.313 1.386 2.262 2.079 4.887 2.079 7.875 0 3.5-.996 6.53-2.988 9.09-1.992 2.519-4.633 4.247-7.924 5.186l11.172 17.606c.563.854.67 1.558.324 2.113-.303.555-.952.832-1.948.832-.477 0-.845-.085-1.104-.256a6.121 6.121 0 0 1-.65-.768l-11.95-18.822H17.49c-1.076 0-1.948-.86-1.948-1.921 0-1.06.872-1.92 1.948-1.92h12.406c2.425 0 4.547-.47 6.365-1.409 1.862-.982 3.313-2.305 4.352-3.97 1.082-1.664 1.624-3.584 1.624-5.761 0-2.22-.542-4.183-1.624-5.89-1.04-1.707-2.49-3.03-4.352-3.97-1.818-.981-3.94-1.472-6.365-1.472H1.949c-.52 0-.975-.192-1.364-.576C.195 2.881 0 2.433 0 1.921 0 1.366.195.896.585.512.975.171 1.429 0 1.949 0Zm95.833 50c-.562 0-1.039-.17-1.428-.512-.347-.384-.52-.854-.52-1.409V1.921c0-.555.173-1.003.52-1.345.39-.384.866-.576 1.428-.576.563 0 1.018.192 1.365.576.39.342.584.79.584 1.345v46.158c0 .555-.195 1.025-.584 1.409-.347.341-.802.512-1.365.512Zm72.067 0c-.823 0-1.408-.406-1.754-1.216L148.61 3.137c-.433-.982-.455-1.75-.065-2.305.433-.555 1.017-.832 1.753-.832.823 0 1.451.448 1.884 1.344l17.732 41.87L187.451 1.6c.432-1.066 1.147-1.6 2.143-1.6.779 0 1.299.32 1.559.96.26.64.216 1.366-.13 2.177l-19.421 45.647c-.216.47-.498.79-.844.96-.303.17-.606.256-.909.256Zm71.961 0c-.563 0-1.039-.17-1.429-.512-.346-.384-.52-.854-.52-1.409V1.921c0-.555.174-1.003.52-1.345.39-.384.866-.576 1.429-.576h31.241c.52 0 .975.192 1.364.576.39.342.585.79.585 1.345 0 .512-.195.96-.585 1.344-.389.384-.844.576-1.364.576h-29.293v19.206h21.499c.563 0 1.018.192 1.364.577.39.341.585.79.585 1.344a1.9 1.9 0 0 1-.585 1.408c-.346.385-.801.577-1.364.577h-21.499v19.206h29.293c.52 0 .975.192 1.364.576.39.384.585.832.585 1.344 0 .555-.195 1.025-.585 1.409a2.003 2.003 0 0 1-1.364.512H241.81Z";

/**
 * The R alone — the subpath the payload dot travels.
 *
 * GEOMETRY PICKED THIS, not preference. This subpath opens with an ABSOLUTE
 * `M1.949 0`, so it stands on its own. The other three open with a relative
 * `m`, meaning each letter's position depends on where the previous one ended;
 * lifting any of them out would mean rewriting coordinates. The R was already
 * the only letter that could leave the group intact.
 */
export const RIVE_WORDMARK_R_PATH =
  "M1.949 0h27.948c3.16 0 5.954.662 8.379 1.985 2.468 1.28 4.395 3.051 5.78 5.313 1.386 2.262 2.079 4.887 2.079 7.875 0 3.5-.996 6.53-2.988 9.09-1.992 2.519-4.633 4.247-7.924 5.186l11.172 17.606c.563.854.67 1.558.324 2.113-.303.555-.952.832-1.948.832-.477 0-.845-.085-1.104-.256a6.121 6.121 0 0 1-.65-.768l-11.95-18.822H17.49c-1.076 0-1.948-.86-1.948-1.921 0-1.06.872-1.92 1.948-1.92h12.406c2.425 0 4.547-.47 6.365-1.409 1.862-.982 3.313-2.305 4.352-3.97 1.082-1.664 1.624-3.584 1.624-5.761 0-2.22-.542-4.183-1.624-5.89-1.04-1.707-2.49-3.03-4.352-3.97-1.818-.981-3.94-1.472-6.365-1.472H1.949c-.52 0-.975-.192-1.364-.576C.195 2.881 0 2.433 0 1.921 0 1.366.195.896.585.512.975.171 1.429 0 1.949 0Z";

/** The logotype's own coordinate system. */
export const RIVE_WORDMARK_VIEWBOX = "0 0 275 50";
