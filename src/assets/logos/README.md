# Brand logos (marquee)

These SVGs are **normalized** so their color is 100% CSS-driven (`currentColor`,
with white knockouts mapped to `var(--surface-canvas)`). They render as inline
React components (`?react`) in `LogoMarquee`, so `color`/theme controls them.

## To add a brand

1. Drop the official wordmark SVG into `raw/` (any messy name is fine).
2. Run `npm run logos:normalize`.
3. Add it to the `LOGOS` array in `src/components/LogoMarquee.tsx` with a
   `scale` factor (optical cap-height normalization — start at `1`, tune from a
   screenshot; wide/padded marks need `>1`, tall marks `<1`).

## What the normalizer does (`scripts/normalize-logos.mjs`, zero-dependency)

- `url(#gradient)` fills → `currentColor`; strips `<defs>`/`<style>` and dead
  `class`/`clip-path`.
- Maps color fills/strokes → `currentColor`; keeps `fill="none"`.
- Strips root `width`/`height` (keeps `viewBox`, synthesizing one from
  width/height when absent); sets root `fill="currentColor"`.
- **White rule (logged per file):** a file with *both* white and non-white
  fills → white is a knockout → `var(--surface-canvas, #000)`. A file whose
  fills are *entirely* white (a dark-mode variant) → white *is* the mark →
  `currentColor`.
- Regenerates `manifest.json` (brand, viewBox, aspect) from every normalized
  SVG in this folder.

`raw/` holds the original downloads and is the source of truth for the pipeline;
`manifest.json` is generated — don't edit either normalized output or the
manifest by hand.
