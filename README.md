# Rive Redesign — design tokens

This is the seed of the site repo. Right now it holds the **token pipeline**: the small bit of
code that turns the design tokens (defined in Figma) into CSS your website can use.

## The loop (this is the whole idea)

```
Figma Variables  →  export to tokens/rive-tokens.json  →  run the build  →  dist/tokens.css  →  the website
```

Change a color in Figma, re-export the JSON, run the build, and the new color flows to the site.
Figma is the source of truth; code never holds raw hex values.

## How to run it

You need Node installed. No packages to install — the build has zero dependencies.

```bash
npm run build:tokens     # or: node build-tokens.mjs
```

This writes two files into `dist/`:

- **`tokens.css`** — the CSS variables the site reads. `:root` holds the dark theme (our default);
  `[data-theme="light"]` holds the few values that change in light mode. Import this file once in the app.
- **`tailwind.tokens.cjs`** — a Tailwind theme fragment, so utility classes like `bg-surface-default`
  and `text-accent-default` resolve to the tokens. Wire it up in `tailwind.config.js`:
  ```js
  module.exports = { theme: { extend: require("./dist/tailwind.tokens.cjs") } }
  ```

## Files

| File | What it is |
|---|---|
| `tokens/rive-tokens.json` | The tokens, exported from Figma (DTCG format). **The input.** |
| `build-tokens.mjs` | The build script. Reads the JSON, writes the CSS. Readable, commented. |
| `dist/` | Generated output. Never edit by hand. |

## Two layers, on purpose

- **Primitives** — the raw palette (`--neutral-1000`, `--amber-500`, …). The actual values.
- **Semantic** — roles that *point at* primitives (`--surface-canvas: var(--neutral-1000)`).
  Components only ever use semantic roles, so re-theming = swapping what the roles point at.

This mirrors the two Variable collections in the Figma file exactly.

## Later

When the system grows, this hand-rolled script can be swapped for **Style Dictionary** (the
industry-standard token build tool) without changing the tokens file or how the site consumes the CSS.
Starting simple on purpose.
