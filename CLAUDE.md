# Rive Redesign — Project Rules

Rules for building components and translating Figma designs into code in this repo. These are conventions the whole project follows; apply them to every UI change without being re-asked.

## What this project is

A redesign of Rive's marketing site. It is also a **design system**: Figma is the source of truth for tokens and components; code mirrors it. Stack: **Vite + React + TypeScript + Tailwind CSS v3**.

---

## Design tokens (read this first)

The token system is two-tier and flows **Figma → code**. Never invent values.

- **Primitives** — raw values: `--neutral-*`, `--amber-*`, `--expressive-*`, `--radius-*`, `--space-*`, `--font-size-*`, `--font-*`.
- **Semantic** — roles that alias primitives. These are what components use:
  - Surfaces: `--surface-canvas`, `--surface-default`, `--surface-raised`, `--surface-overlay`
  - Text: `--text-primary`, `--text-heading`, `--text-secondary`, `--text-muted`, `--text-accent`
  - Borders: `--border-subtle`, `--border-default`
  - Accent: `--accent-default`, `--accent-hover`, `--accent-on-accent`
  - Focus: `--focus-ring`

**Rules:**
- IMPORTANT: Never hardcode colors, radii, spacing, or font sizes. Always reference tokens.
- IMPORTANT: Components use **semantic** tokens only (`var(--surface-default)`, `var(--text-primary)`). Do not reference primitives (`--neutral-850`) or raw hex directly in components.
- The brand accent is amber `--accent-default` (#FFA41C). It is intentionally identical across token modes — do not "fix" this.
- `--expressive-*` (mint/sky/coral/magenta) are for illustration and per-use-case category accents only. Never for core UI (buttons, body text, primary surfaces).
- You may use either raw `var(--token)` in a component CSS file (see `Button.css`) or the matching Tailwind classes (`bg-surface-default`, `text-text-primary`, `rounded-md`) — both resolve to the same tokens. Prefer whichever keeps the component readable; never bypass tokens either way.
- Canvas/JS surfaces (e.g. `DotField`) read token values at runtime (resolve an actual CSS `color` property, not raw `var()` parsing) — never hardcode a hex in canvas code either.

## The token pipeline

- Source of truth for token *values*: Figma Variables in the `Rive-ReDesign` file (fileKey `7IP95CwE2b9sYNvHzG3O1b`), two collections — `Primitives` and `Semantic` (with `Dark` + `Light` modes).
- Exported to `tokens/rive-tokens.json` (W3C DTCG format).
- `build-tokens.mjs` reads that JSON and generates `dist/tokens.css` and `dist/tailwind.tokens.cjs`.
- Run with `npm run build:tokens`. `prebuild` runs it automatically before every production build.
- To change a token: edit it in Figma → re-export to `tokens/rive-tokens.json` → run `npm run build:tokens`. Do not hand-edit generated files.

- IMPORTANT: **`dist/` is sacred — it holds the generated token files, not the app bundle.** Never write app output there.
- IMPORTANT: Vite's build output is intentionally routed to `dist-app/` (see `vite.config.ts`), because Vite empties its `outDir` on each build and would otherwise wipe the tokens. Never change Vite's output back to `dist/`.

## Typography

- `--font-display` = **Tomorrow** — headings and eyebrow labels. Set UPPERCASE.
- `--font-body` = **Inter** — body and UI text.
- `--font-mono` = **JetBrains Mono** — code and developer surfaces.
- Weights: 400 (regular), 500 (medium, the display/label default), 700 (bold, for numerics/emphasis).
- Sizes come from `--font-size-*` (`h1`, `h2`, `stat`, `eyebrow`, `body`, `body-sm`, `caption`, `code`).

## Theming — DARK-ONLY SITE (policy)

- **Dark is the only shipped theme.** Rive's brand has no light mode anywhere (site or editor). The site never offers a theme toggle and no visitor-facing surface is styled or verified for light mode.
- The Semantic token collection retains its **Light mode as a design-system capability only** — it demonstrates the aliased, themable architecture. It is exercised **only on `/showcase`** via the existing toggle (the showcase is design-system documentation; mode-switching is part of what it documents). It is not a brand proposal.
- IMPORTANT: For all component/section work: **build and verify DARK ONLY.** Do not add light-mode checks, screenshots, or fixes for Home/site sections. No `data-theme` control may be reachable from any site page. Incidental light-mode token gaps may be noted but are not blockers.

---

## Components

- Location: `src/components/`. One folder-free set per component: `ComponentName.tsx`, `ComponentName.css`, `ComponentName.figma.tsx`.
- Naming: components are `PascalCase`. Provide a **named export** (`export { Button }`) so Code Connect mappings can import them; a default export may also exist.
- IMPORTANT: Before creating a new component, check `src/components/` for an existing one and reuse it. Do not duplicate. Shared pieces in use: `SectionHeader`, `Button`, `BentoCell`, `DemoSlot`, `Nav`, and the `.text-link` pattern.
- Variants are driven by props typed as unions (e.g. `variant: 'primary' | 'secondary' | 'ghost'`), styled via `data-variant` / `data-state` attributes in the component's CSS (see `Button.tsx` / `Button.css` as the reference pattern).
- Every component gets a slot in the showcase page (`/showcase`) showing all its variants/states — this doubles as living documentation.

## The component recipe (every new component follows this)

1. **Figma** — build it as a component (with variant properties) bound to the **Semantic** Variables. Never raw hex in Figma either.
2. **Code** — mirror it in React under `src/components/`, styled with the semantic CSS variables.
3. **Showcase** — add it to `/showcase` showing every variant/state.
4. **Code Connect** — write `ComponentName.figma.tsx` mapping the Figma variant properties to the React props.

---

## Figma → code (agent-driven)

This project is on a Figma **Professional** plan, so live Code Connect in Dev Mode is not available. Design-to-code is agent-mediated — follow this flow:

1. Use the Figma MCP to fetch the node's design context (and a screenshot when available) for the exact node being implemented.
2. Treat the MCP's raw output as a representation of design and behavior, **not** final code.
3. IMPORTANT: Map any Figma component instances to the existing React components in `src/components/`, using the prop mappings recorded in the corresponding `*.figma.tsx` files. Do not regenerate a button from scratch when `<Button>` exists.
4. Map Figma colors/spacing/type to this project's **semantic** CSS variables — never hardcode.
5. Reuse the theming, routing, and state patterns already in the repo.
6. Validate against the Figma design for 1:1 look (dark theme).

## Code Connect

- Mappings live in `src/components/*.figma.tsx` using `figma.connect()`. Config is `figma.config.json` (react parser).
- These files are CLI-only and excluded from the app build (`tsconfig.app.json` excludes `**/*.figma.tsx`). Never import them from app code.
- IMPORTANT: **Do not publish** (`npm run connect:publish`) on the current plan — custom Code Connect requires a Figma Organization/Enterprise seat. Publishing needs a `FIGMA_ACCESS_TOKEN` env var with the Code Connect scope; IMPORTANT: never commit that token.
- `npm run connect:parse` validates mappings locally without auth.

## Assets

- **Brand logos** live in `src/assets/logos/` and are consumed as inline SVG React components (via `vite-plugin-svgr` `?react` imports) so `currentColor` works. Never render them via `<img>`.
- IMPORTANT: Logo pipeline — to add a brand: drop the official wordmark SVG into `src/assets/logos/raw/`, run `npm run logos:normalize`, then add it to the `LOGOS` array in `LogoMarquee.tsx` with an optical scale factor. The normalizer maps fills to `currentColor` (two-case white rule: mixed fills = knockout → `var(--surface-canvas)`; all-white file = the mark → `currentColor`), strips defs/dimensions, and regenerates `manifest.json`. Do not hand-edit normalized outputs.
- Prefer assets served by the Figma MCP; if it returns a localhost source, use it directly and do not create placeholders.
- Do not install new icon packages without reason — check what's already in the payload/repo first.

## Motion

- Motion values are tuning knobs, exposed as CSS custom properties or config objects at the top of the owning file (e.g. `--marquee-duration`, `--logo-gap`, `--stack-stagger`, `--stack-travel`, `DotField`'s `CONFIG`). Calibrate by feel, then bake the defaults.
- IMPORTANT: Every animation must have intentional purpose connected to the message — no decorative motion. Respect `prefers-reduced-motion` in every animated component (static or final-state render, no autoplay).
- Non-drawable motion (canvas effects, scroll mechanics, marquees) is documented via annotation cards in the Figma file — keep those annotations truthful when values change.

---

## Commands

- `npm run dev` — dev server.
- `npm run build` — runs `prebuild` (regenerates tokens) then builds to `dist-app/`.
- `npm run build:tokens` — regenerate token CSS from `tokens/rive-tokens.json`.
- `npm run logos:normalize` — normalize raw logo SVGs into the token-driven set.
- `npm run connect:parse` — validate Code Connect mappings.

## Conventions & gotchas

- IMPORTANT: PostCSS and Tailwind config files use the `.cjs` extension (`postcss.config.cjs`, `tailwind.config.cjs`) because the project is `"type": "module"`. Keep them `.cjs`.
- Keep the token pipeline (`build-tokens.mjs`, `tokens/`, `dist/`, the `build:tokens` and `prebuild` scripts) intact when making changes.
- Version-control the rule and token files; update this file when conventions change.
