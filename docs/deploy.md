# Deploying

Vercel, project `rive-redesign-study`. The name is deliberate: the URL should
read as a redesign study, not as an official Rive property.

    npx vercel            # preview
    npm run check:...     # gate the preview (see below)
    npx vercel --prod     # promote, once the gate is green

## CLI-ONLY. Do not reconnect the Git integration.

`.github/workflows/ci.yml` deliberately carries no deploy step — it answers "is
it correct?", nothing else. Deployment is driven by hand so that a preview can
be gated before anything reaches production.

**THE TRAP, AND IT COST US THE SEQUENCE ONCE.** `vercel --name <project>` on a
directory with a GitHub remote silently connects the Vercel project to that
repository. Nothing in the CLI output says so. From that moment every `git push`
to `main` deploys to **production**, which is how commits landed live during a
session whose entire point was preview-first with an explicit hold before
promotion. Two production deployments happened that nobody asked for, and they
were only noticed because `vercel ls` showed deployments carrying a
`githubCommitSha` that no local command had created.

Disconnected with `vercel git disconnect`, and **verified rather than assumed**:
a real commit was pushed to `main` and the deployment count was 6 before and 6
after a 75-second wait. If you ever see a deployment you did not run, check
`vercel ls` for a commit sha before looking anywhere else.

## Why `outputDirectory` is pinned

`dist/` holds the GENERATED TOKENS (`tokens.css`, `tailwind.tokens.cjs`) and is
committed. Vite builds into `dist-app/` precisely so it cannot empty `dist/` —
see `vite.config.ts`.

Vercel's Vite preset defaults `outputDirectory` to **`dist`**. Left to infer, it
would publish two token files and no `index.html`. `vercel.json` states
`dist-app` explicitly, so the deploy is correct from the repo rather than from a
dashboard setting nobody can see in a diff.

## Why the SPA rewrite

`main.tsx` mounts a `BrowserRouter` and `/showcase` is a real client route.
Without `/(.*) → /index.html`, a hard refresh or a shared link to `/showcase`
404s. The blanket source is safe on Vercel specifically: the filesystem is
matched before rewrites, so real files still win.

## Cache tiers, and why they are not uniform

**Content-addressed — `immutable`, one year:**
- `/assets/*` — Vite hashes these. A new build means a new filename, so a stale
  cache is unreachable.
- `/rive/runtime/*.wasm` — the runtime version is IN the filename, and
  `check:assets` fails if that version and the installed package disagree.

**Verbatim paths — one hour, `must-revalidate`:**
- `/rive/site/*.riv` and `/video/*` are copied out of `public/` unhashed, so the
  URL never changes when the bytes do. `immutable` would strand every future
  re-export behind a year-long cache, with nothing looking broken enough to
  investigate. `loop.riv` was re-exported three times in two days; `beats:diff`
  exists because re-exports are routine here.

`Content-Type` for `.wasm` is left to Vercel, which serves `application/wasm`
correctly — verified against the deployment rather than assumed.

## Gating a preview: the protection-bypass secret

Vercel guards preview deployments with Deployment Protection, so a headless
browser gets an HTML login page and every assertion below it measures Vercel's
auth screen instead of the site.

The way through is a **Protection Bypass for Automation** secret — Vercel
dashboard → Settings → Deployment Protection. It is NOT a project environment
variable and does not appear in `vercel env ls`.

Put it in `.env.local` at the repo root:

    VERCEL_AUTOMATION_BYPASS_SECRET=<secret>

`scripts/lib/preview-auth.mjs` reads it and returns an `x-vercel-protection-
bypass` header, which the six browser gates set via CDP `Network.
setExtraHTTPHeaders`. It returns `{}` when absent, so the gates run unchanged
against localhost and against unprotected production.

The secret is read **from the file, at the point of use** — never exported into
the shell, where every later command in the session would inherit it and one
stray `env` or crash dump would print it.

    npx vercel                                   # note the preview URL
    npm run check:offline -- --url <preview>/
    npm run check:render  -- --url <preview>/
    npm run check:links   -- --url <preview>/
    npm run check:rag     -- --url <preview>/
    npm run check:rails   -- --url <preview>/
    npm run check:stack   -- --url <preview>/
    npx vercel --prod                            # only when all six are green

### The .gitignore near-miss

`.gitignore` had **no env rule at all** when the bypass secret was first
requested. This repo commits with `git add -A`, so a secret written to
`.env.local` would have been staged and pushed to a public GitHub repo by the
next commit. Nothing leaked — no `.env*` was ever tracked and
`git log --all -S VERCEL_AUTOMATION_BYPASS_SECRET` is empty — but only because
the file had not been created yet. The rule (`.env`, `.env.*`,
`!.env.example`) went in as afb6476, **before** the file was created. If you add
another secret, check the rule still covers it first.

### The /json/new header-timing bug

`render-check.mjs` opened its tab with `/json/new?<URL>`, which **navigates as it
creates the tab** — before this process has a CDP connection to set headers on.
Against a protected preview the page was already Vercel's login screen by the
time anything could authenticate, and the check reported 15 failures describing
an empty document: no rails, no glyphs, no StatsBand, no FooterMark. It looked
exactly like a catastrophically broken deployment.

It now opens `about:blank`, sets the bypass header, then navigates explicitly.
If a browser gate ever reports that *everything* is missing, suspect the
transport before the site.

## Fonts: the trade, as measured

The webfonts are self-hosted (`public/fonts/`, 8 latin-subset woff2, 138 kB).
**This cost first paint. It was kept anyway, and the reasoning should not be
smoothed over by whoever reads this next.**

Measured on the deployment, 15 interleaved cold-cache samples per URL, both as
**deployment URLs** — an alias compared against a deployment URL can route
differently and produced a materially different number on the first attempt:

| build | FCP median | p75 | range |
|---|---|---|---|
| Google Fonts (`bdeo69i2j`) | **1136 ms** | 1160 ms | 812–1652 |
| self-hosted (`cbhm4lljj`) | **1552 ms** | 1644 ms | 1460–2092 |

**Self-hosting cost +416 ms median, +484 ms p75.** The prediction beforehand was
that it would SAVE roughly a second. That claim was wrong and is withdrawn.

It was wrong because it blamed the wrong thing. The resource timeline shows
every font landing by ~451 ms self-hosted and ~700 ms via Google, while first
paint does not happen until ~1500 ms in both: **FCP is bound by the 544 kB main
chunk mounting into an empty `<div id="root">`, not by typography.** The
original "1216 ms baseline" was a single sample from a distribution that spans
812–2092 ms, and an argument was built on it.

Kept regardless, on the argument that was never about speed: a third party
should not be able to empty this page's typography, which is the same reasoning
that put the Rive wasm in `public/rive/runtime/`. `check:offline` now blocks
`unpkg`, `jsdelivr`, `fonts.googleapis.com` and `fonts.gstatic.com`, and asserts
the faces are both loaded AND drawing — "zero Google requests" is satisfied just
as well by silently falling back to a system font.

The +416 ms is *attributed* to same-origin font/JS connection contention. That is
a **hypothesis and it is unverified** — verify it before optimizing against it.
The real FCP lever is prerendering the hero or splitting the main chunk; tracked
in `docs/TODO.md`.
