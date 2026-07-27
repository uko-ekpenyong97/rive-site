/**
 * Harvest CommunityStrip data from Rive community/marketplace pages.
 *
 * Repeatable and side-effect-visible: for each curated URL it reads the page,
 * extracts title / primary creator / full credits / thumbnail, ASSERTS the file
 * is CC BY, then downloads and downscales the thumbnail into src/assets/community/.
 *
 * A file that is not CC BY is excluded rather than silently included — we render
 * credits, so the licence has to be one we can actually honour.
 *
 * Usage:  node scripts/fetch-community.mjs
 * Output: a TypeScript data block on stdout, to paste into useCaseContent.ts.
 *
 * Parsing notes (learned from the real pages, do not "simplify" these away):
 * - <title> is `"{title}<!-- --> by <!-- -->{creator}<!-- --> - made with Rive"`.
 *   Those React comment separators must be stripped before matching.
 * - og:title is the BARE title — it does not carry the creator at all.
 * - Full multi-contributor credits live in the description meta, not the title.
 * - Some marketplace URLs redirect to /community/files/; we record the final URL.
 */
import { execFile } from "node:child_process";
import { mkdir, writeFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);

const OUT_DIR = "src/assets/community";
const THUMB_WIDTH = 640; // ~2x the rendered slot; see the preload size discipline
const REQUIRED_LICENSE = "CC BY";

const GROUPS = {
  "game-ui": [
    "https://rive.app/community/files/6511-12637-game-hudscope-demo/",
    "https://rive.app/community/files/5432-10752-ability-wheel-in-the-legend-of-zelda-tears-of-the-kingdom-totk/",
    "https://rive.app/community/files/5708-11153-sophia-iii-hud/",
    "https://rive.app/marketplace/27565-52075-character-selection-menu/",
  ],
  "product-ui": [
    "https://rive.app/marketplace/2233-4412-pull-to-refresh-animation-example/",
    "https://rive.app/marketplace/25691-49048-interactive-icon-set/",
    "https://rive.app/marketplace/27639-52202-mood-interaction/",
    "https://rive.app/marketplace/24966-46592-cloudy-walk/",
    "https://rive.app/marketplace/19349-43859-sketch-to-illustration/",
  ],
};

const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const meta = (html, key) => {
  const m = html.match(
    new RegExp(`<meta[^>]*(?:name|property)="${key}"[^>]*content="([^"]*)"`, "i"),
  );
  return m ? decode(m[1]) : null;
};

async function fetchPage(url) {
  const { stdout } = await run("curl", [
    "-sL", "-m", "30", "--write-out", "\n@@FINAL@@%{url_effective}", url,
  ], { maxBuffer: 20 * 1024 * 1024 });
  const i = stdout.lastIndexOf("\n@@FINAL@@");
  return { html: stdout.slice(0, i), finalUrl: stdout.slice(i + 10).trim() };
}

function parse(html) {
  const rawTitle = html.match(/<title[^>]*>(.*?)<\/title>/s)?.[1] ?? "";
  /* Strip the React comment separators before matching. */
  const clean = decode(rawTitle).replace(/<!--\s*-->/g, "");
  const m = clean.match(/^(.*?) by (.*?) - made with Rive/);

  const title = m?.[1]?.trim() ?? meta(html, "og:title")?.trim() ?? null;
  const creator = m?.[2]?.trim() ?? null;
  /* Independent corroboration: the embedded JSON carries the owner's username. */
  const username = html.match(/"username\\?":\\?"([A-Za-z0-9._-]{1,40})/)?.[1] ?? null;

  return {
    title,
    creator,
    username,
    credits: meta(html, "description"),
    thumbnail: meta(html, "og:image") ?? meta(html, "twitter:image"),
    /* The page states the licence in the body; we require CC BY explicitly. */
    license: /CC[\s-]?BY/i.test(html) ? "CC BY" : null,
  };
}

const slugOf = (url) =>
  url.replace(/\/+$/, "").split("/").pop().replace(/[^a-z0-9-]/gi, "");

async function thumbnail(url, slug) {
  const ext = path.extname(new URL(url).pathname) || ".png";
  const tmp = `/tmp/community-${slug}${ext}`;
  const out = path.join(OUT_DIR, `${slug}.png`);
  await run("curl", ["-sL", "-m", 60, "-o", tmp, url].map(String));
  /* Downscale locally: the source thumbnails are 1920x1080 (~1.6 MB each) for a
     slot a few hundred px wide. sips is macOS-native, so no new dependency. */
  await run("sips", ["--resampleWidth", String(THUMB_WIDTH), tmp, "--out", out]);
  const { size } = await stat(out);
  return { out, size };
}

await mkdir(OUT_DIR, { recursive: true });
const results = {};
const excluded = [];

for (const [group, urls] of Object.entries(GROUPS)) {
  results[group] = [];
  for (const url of urls) {
    const { html, finalUrl } = await fetchPage(url);
    const p = parse(html);
    const label = slugOf(finalUrl);

    if (!p.title || !p.creator || !p.thumbnail) {
      excluded.push({ url, why: "could not parse title/creator/thumbnail" });
      console.error(`  EXCLUDED ${label}: unparseable`);
      continue;
    }
    if (p.license !== REQUIRED_LICENSE) {
      excluded.push({ url, why: `licence is not ${REQUIRED_LICENSE}` });
      console.error(`  EXCLUDED ${label}: licence not ${REQUIRED_LICENSE}`);
      continue;
    }

    const { out, size } = await thumbnail(p.thumbnail, label);
    const mismatch =
      p.username && p.username.toLowerCase() !== p.creator.toLowerCase()
        ? ` (username=${p.username})`
        : "";
    console.error(
      `  ok  ${label}\n      "${p.title}" by ${p.creator}${mismatch} · ${(size / 1024).toFixed(0)} kB`,
    );
    results[group].push({
      slug: label,
      title: p.title,
      creator: p.creator,
      href: finalUrl,
      license: p.license,
      credits: p.credits,
      thumb: out,
      redirected: finalUrl !== url,
    });
  }
}

console.error("\n--- excluded ---");
console.error(excluded.length ? JSON.stringify(excluded, null, 2) : "  none");
console.log(JSON.stringify(results, null, 2));
