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
  },
});
