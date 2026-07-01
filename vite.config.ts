import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The existing dist/ folder holds generated token files (tokens.css,
    // tailwind.tokens.cjs). Vite empties its outDir on build, so send the
    // app bundle to a separate directory to avoid clobbering the tokens.
    outDir: "dist-app",
    emptyOutDir: true,
  },
});
