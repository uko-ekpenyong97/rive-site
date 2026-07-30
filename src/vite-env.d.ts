/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

/**
 * The DeveloperZone sample, tokenized at build time by the `dev-zone-snippet`
 * plugin in vite.config.ts. `source` is the exact text shown and copied; `html`
 * is that same text wrapped in our own token classes.
 */
declare module "virtual:dev-zone-snippet" {
  export const html: string;
  export const source: string;
}
