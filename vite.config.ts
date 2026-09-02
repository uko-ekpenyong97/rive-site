/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const SNIPPET = fileURLToPath(
  new URL("./src/components/dev-zone/snippet.tsx", import.meta.url),
);

/**
 * The DeveloperZone sample, tokenized at BUILD time.
 *
 * WHY A TOKENIZER AND NOT shiki's HTML EMITTER: `codeToHtml` writes inline
 * `style="color:#f97583"` on every span, which would plant a rainbow of
 * hardcoded hex in the markup of a dark-only, single-accent site. `codeToTokens`
 * hands back TextMate scopes instead, so the scopes can be mapped onto the three
 * classes DeveloperZone.css already owns — keywords, strings, comments — and the
 * accent discipline is enforced by construction rather than by review.
 *
 * shiki runs here, in Node, during transform. Nothing reaches a visitor chunk
 * but the resulting markup: no highlighter, no grammars, no themes.
 *
 * DISPLAY RULE: everything from the first `import` onward. The file opens with a
 * note to whoever edits it, which belongs in the repo and not on the marketing
 * page. Both the markup and the copy button derive from that same slice, so what
 * is shown, what is copied, and what CI typechecks cannot drift apart.
 */
function devZoneSnippet(): Plugin {
  const VIRTUAL = "virtual:dev-zone-snippet";
  const RESOLVED = `\0${VIRTUAL}`;

  const classFor = (scopes: string[]): string | null => {
    if (scopes.some((s) => s.startsWith("comment"))) return "dz-com";
    if (scopes.some((s) => s.startsWith("string"))) return "dz-str";
    if (scopes.some((s) => s.startsWith("keyword") || s.startsWith("storage")))
      return "dz-kw";
    return null;
  };

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return {
    name: "dev-zone-snippet",
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      this.addWatchFile(SNIPPET);

      const file = readFileSync(SNIPPET, "utf8");
      const source = file.slice(file.indexOf("import ")).trimEnd();

      const { codeToTokens } = await import("shiki");
      const { tokens } = await codeToTokens(source, {
        lang: "tsx",
        theme: "github-dark",
        includeExplanation: true,
      });

      const html = tokens
        .map((line) => {
          const inner = line
            .map((token) => {
              const scopes = (token.explanation ?? []).flatMap((e) =>
                e.scopes.map((s) => s.scopeName),
              );
              const cls = classFor(scopes);
              const text = escape(token.content);
              return cls ? `<span class="${cls}">${text}</span>` : text;
            })
            .join("");
          /* One element per line so a CSS counter can draw the gutter — the
             numbers are then generated content, which no text selection or
             clipboard copy can pick up. */
          return `<span class="dz-line">${inner}</span>`;
        })
        .join("\n");

      return [
        `export const html = ${JSON.stringify(html)};`,
        `export const source = ${JSON.stringify(source)};`,
      ].join("\n");
    },
  };
}

// https://vite.dev/config/
/**
 * Strips remote `@import url(https://…)` from DEPENDENCY CSS.
 *
 * THE HOLE THIS CLOSES: `dialkit/dist/styles.css` carries
 * `@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@100..900')`.
 * Vite cannot inline a remote @import, so it survives into the Showcase chunk and
 * /showcase fetches a nine-weight family from Google at runtime — measured on the
 * first deployment: `/` made 4 Google requests, `/showcase` made 7.
 *
 * That is a third-party dependency reintroduced BY a dependency, in a project
 * that self-hosts its wasm and its webfonts precisely so no third party can empty
 * the page. The alternative was allow-listing Geist Mono in check:offline; it was
 * rejected. An allow-list is a documented hole, and the reason this guard exists
 * at all is that the last one had an exception shaped exactly like that.
 *
 * Geist Mono dresses DialKit's tuning panel, which DialRoot hides in production.
 * Losing it costs a dev-only surface its preferred mono and nothing else.
 *
 * FAILS THE BUILD ON ZERO MATCHES. If dialkit drops or renames the import, a
 * plugin that silently matched nothing would sit in this config looking like
 * protection while the gap reopened on the next dependency bump. A guard that
 * cannot tell "nothing to do" from "no longer working" is not a guard. Lower
 * `expect` deliberately, with a note, if the import genuinely goes away.
 */
function stripRemoteCssImports(expect = 1): Plugin {
  const REMOTE_IMPORT =
    /@import\s+(?:url\(\s*)?['"]?(https?:\/\/[^'")\s]+)['"]?\s*\)?\s*;?/g;
  const stripped: { url: string; from: string }[] = [];

  return {
    name: "strip-remote-css-imports",
    enforce: "pre",
    apply: "build",

    transform(code: string, id: string) {
      if (!id.endsWith(".css")) return null;
      /* Dependency CSS only. Our own stylesheets are ours to police in review;
         silently rewriting them would hide a mistake rather than surface it. */
      if (!id.includes("node_modules")) return null;
      REMOTE_IMPORT.lastIndex = 0;
      if (!REMOTE_IMPORT.test(code)) return null;
      REMOTE_IMPORT.lastIndex = 0;

      const out = code.replace(REMOTE_IMPORT, (_m: string, url: string) => {
        stripped.push({ url, from: id.split("node_modules/")[1] ?? id });
        return `/* remote @import removed by strip-remote-css-imports: ${url} */`;
      });
      return { code: out, map: null };
    },

    buildEnd(this: { info: (m: string) => void; error: (m: string) => never }) {
      for (const s of stripped)
        this.info(`stripped remote @import  ${s.url}  (from ${s.from})`);
      if (stripped.length < expect) {
        this.error(
          `strip-remote-css-imports expected at least ${expect} remote @import(s) in ` +
            `dependency CSS and found ${stripped.length}. Either a dependency dropped ` +
            `the import — lower \`expect\` on purpose, with a note — or this plugin has ` +
            `stopped matching and the third-party font request is back. Failing rather ` +
            `than passing silently, because a no-op guard is how the gap reopens.`,
        );
      }
    },
  };
}

export default defineConfig({
  // svgr lets us import SVGs as inline React components (`?react`), so their
  // currentColor / var() fills are driven by CSS.
  plugins: [react(), svgr(), devZoneSnippet(), stripRemoteCssImports(1)],
  build: {
    // The existing dist/ folder holds generated token files (tokens.css,
    // tailwind.tokens.cjs). Vite empties its outDir on build, so send the
    // app bundle to a separate directory to avoid clobbering the tokens.
    outDir: "dist-app",
    emptyOutDir: true,
    // Never inline a .riv or an .avif.
    //
    // .riv files are fetched, cached and hover-preloaded BY URL. Vite's default
    // limit is 4096 B and audience_glyphs.riv is 4299 B — a 203-byte margin,
    // which is not a margin. A re-export from the editor that shrank it would
    // silently flip it to base64: no warning, no build error, and only in
    // `vite build` (the dev server never inlines).
    //
    // .avif joined the list once the community thumbnails were converted:
    // 5 of the 27 landed under 4096 B and were inlined, adding 24 kB to the
    // entry chunk. An inlined image cannot be lazy — `loading="lazy"` has
    // nothing to defer — so those five below-the-fold thumbnails were being
    // downloaded by every visitor before first paint, which is exactly what the
    // conversion to AVIF was meant to stop.
    //
    // `undefined` for every other asset preserves the default behaviour.
    assetsInlineLimit: (filePath) =>
      /\.(riv|avif)$/.test(filePath) ? false : undefined,
  },
  test: {
    // The SSR render checks are the bulk of the suite and need no DOM. The few
    // files that exercise browser behaviour opt in with `@vitest-environment
    // jsdom` at the top of the file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
