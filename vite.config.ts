/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  // svgr lets us import SVGs as inline React components (`?react`), so their
  // currentColor / var() fills are driven by CSS.
  plugins: [react(), svgr()],
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
