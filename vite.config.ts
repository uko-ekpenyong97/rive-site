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
export default defineConfig({
  // svgr lets us import SVGs as inline React components (`?react`), so their
  // currentColor / var() fills are driven by CSS.
  plugins: [react(), svgr(), devZoneSnippet()],
  build: {
    // The existing dist/ folder holds generated token files (tokens.css,
    // tailwind.tokens.cjs). Vite empties its outDir on build, so send the
    // app bundle to a separate directory to avoid clobbering the tokens.
    outDir: "dist-app",
    emptyOutDir: true,
    // .riv files are fetched, cached and hover-preloaded BY URL, so one must
    // never be inlined as a base64 data: URL. Vite's default limit is 4096 B and
    // audience_glyphs.riv is 4299 B — a 203-byte margin, which is not a margin.
    // A re-export from the editor that shrank it would silently flip it to
    // base64: no warning, no build error, and only in `vite build` (the dev
    // server never inlines), so nothing downstream would catch it. Returning
    // `undefined` for every other asset preserves the default behaviour.
    assetsInlineLimit: (filePath) =>
      filePath.endsWith(".riv") ? false : undefined,
  },
  test: {
    // The SSR render checks are the bulk of the suite and need no DOM. The few
    // files that exercise browser behaviour opt in with `@vitest-environment
    // jsdom` at the top of the file.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
