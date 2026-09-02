# Deploying

Vercel, driven by the **CLI** — not the GitHub integration. Auto-deploy on push
is a decision the owner has not made yet, so `.github/workflows/ci.yml`
deliberately carries no deploy step and only answers "is it correct?".

    npx vercel            # preview
    npx vercel --prod     # promote

Project: `rive-redesign-study`. The name is deliberate — the URL should read as
a redesign study, not as an official Rive property.

## Why `outputDirectory` is pinned

`dist/` holds the GENERATED TOKENS (`tokens.css`, `tailwind.tokens.cjs`) and is
committed. Vite is configured to build into `dist-app/` precisely so it cannot
empty `dist/` on every build — see `vite.config.ts`.

Vercel's Vite preset defaults `outputDirectory` to **`dist`**. Left to infer, it
would publish two token files and no `index.html`. `vercel.json` states
`dist-app` explicitly so the deploy is correct from the repo rather than from a
dashboard setting nobody can see in a diff.

## Why the SPA rewrite

`main.tsx` mounts a `BrowserRouter`; `/showcase` is a real client route. Without
`/(.*) → /index.html`, a hard refresh or a shared link to `/showcase` 404s. The
blanket source is safe on Vercel specifically: the filesystem is matched before
rewrites, so real files still win.

## Cache tiers, and why they are not uniform

Two classes of asset ship here, and treating them alike would be a bug.

**Content-addressed — `immutable`, one year:**
- `/assets/*` — Vite hashes these (`loop-BXdLgxBE.riv`, `index-BG47HS48.js`).
  A new build produces a new filename, so a stale cache is unreachable.
- `/rive/runtime/*.wasm` — the runtime version is IN the filename
  (`rive-2.39.1.wasm`), and `check:assets` fails if that version and the
  installed package ever disagree. Same guarantee by a different mechanism.

**Verbatim paths — one hour, `must-revalidate`:**
- `/rive/site/*.riv` and `/video/*` are copied out of `public/` unhashed, so the
  URL never changes when the bytes do. Marking these `immutable` would strand
  every future re-export behind a year-long cache — visitors would keep the old
  file and nothing would look broken enough to investigate.

That is not hypothetical. `loop.riv` was re-exported three times in two days
(46fa4b2 and the swaps before it), and `npm run beats:diff` exists specifically
because re-exports are routine here. The tier split is the difference between a
re-export reaching people and silently not.

`Content-Type` for `.wasm` is left to Vercel, which serves `application/wasm`
correctly — verified against the deployment rather than assumed.
