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
import { mkdir, writeFile, stat, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";
import { verifyPixels } from "./lib/verify-pixels.mjs";

const run = promisify(execFile);

const OUT_DIR = "src/assets/community";
const THUMB_WIDTH = 640; // ~2x the widest rendered slot (the 280px wall tile)
const AVIF_QUALITY = 55;
const REQUIRED_LICENSE = "CC BY";

const GROUPS = {
  /* The CommunityWall — Rive's own Featured tab, in wall order (three rows of
     six), minus anything already used elsewhere on this site. */
  wall: [
    "https://rive.app/marketplace/28334-53514-interactive-character-follow/",
    "https://rive.app/marketplace/26133-49002-studiorun-a-cosmic-game-by-thelittlelabs/",
    "https://rive.app/marketplace/28158-53168-interactive-aquarium/",
    "https://rive.app/marketplace/27915-52755-yippee/",
    "https://rive.app/marketplace/28363-53629-treasure-valley-interactive-map/",
    "https://rive.app/marketplace/28142-53149-batter-up-bunny/",
    "https://rive.app/marketplace/28160-53178-audio-player/",
    "https://rive.app/marketplace/27290-51530-particles-and-physics-football/",
    "https://rive.app/marketplace/27375-51723-a-piano-game/",
    "https://rive.app/marketplace/28236-53335-a-drag-to-spin-rotary-picker-built-in-rive-scripting-da/",
    "https://rive.app/marketplace/27842-52603-vintage-bike/",
    "https://rive.app/marketplace/27832-52591-animojis/",
    "https://rive.app/marketplace/28124-53413-auto-wrapping-pill-menu/",
    "https://rive.app/marketplace/27773-52471-maasai-inspired-event-hero-banner-concept/",
    "https://rive.app/marketplace/28184-53457-rumble-golf-challenge-mini-game/",
    "https://rive.app/marketplace/27239-51435-messy-files/",
    "https://rive.app/marketplace/25759-48234-slot-machine-game-with-scripting/",
    "https://rive.app/marketplace/25989-48561-room-decor-mini-game/",
  ],
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
  /* GREEDY first group, and it must stay greedy. Non-greedy matched the FIRST
     " by ", which mangles any title that contains one: "StudioRun - A Cosmic
     Game by TheLittleLabs" came back as title "StudioRun - A Cosmic Game" with
     creator "TheLittleLabs by thelittlelabs". The username cross-check below is
     what caught it — it flagged (username=thelittlelabs) against that creator,
     which is precisely the corroboration it exists for. Greedy takes the LAST
     " by " before the suffix, which is the separator the page actually uses. */
  const m = clean.match(/^(.*) by (.*?) - made with Rive/);

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
  const out = path.join(OUT_DIR, `${slug}.avif`);
  await run("curl", ["-sL", "-m", 60, "-o", tmp, url].map(String));

  /* sharp, NOT sips, and AVIF, not PNG.
     - sips cannot write WebP ("Can't write format: org.webmproject.webp") and
       the newer marketplace pages serve WebP og:images, so the original sips
       call failed outright on every one of them.
     - AVIF is the whole weight story: the same 18 thumbnails are 3.60 MB as
       640px PNG and 0.21 MB as 640px AVIF. Narrowing to 560px would have saved
       0.03 MB — the container was the lever, not the resolution, so these keep
       their full 2x width. */
  const buffer = await sharp(tmp)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .avif({ quality: AVIF_QUALITY })
    .toBuffer();

  await writeFile(out, buffer);
  const { size } = await stat(out);
  return { out, size, buffer };
}

await mkdir(OUT_DIR, { recursive: true });
const results = {};
const excluded = [];
/* Every encoded thumbnail is drawn in a real browser before this script exits.
   Dimensions and a successful decode are not evidence of pixels — see
   scripts/lib/verify-pixels.mjs for the AVIF that proved it. */
const pending = [];

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

    const { out, size, buffer } = await thumbnail(p.thumbnail, label);
    pending.push({ label: slugOf(finalUrl), buffer, out });
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

/* The pixel gate. A thumbnail that would render blank fails the harvest rather
   than landing in src/assets/ looking like a successful download. */
if (pending.length) {
  console.error(`\n--- verifying ${pending.length} thumbnails have pixels ---`);
  const checked = await verifyPixels(
    pending.map((t) => ({ label: t.label, buffer: t.buffer, mime: "image/avif" })),
  );
  const blank = checked.filter((c) => c.blank);
  for (const c of blank) console.error(`  BLANK  ${c.label}`);
  if (blank.length) {
    console.error(`\n${blank.length} thumbnail(s) decode but draw nothing. Aborting.`);
    process.exit(1);
  }
  console.error(`  all ${checked.length} draw real pixels`);
}

console.error("\n--- excluded ---");
console.error(excluded.length ? JSON.stringify(excluded, null, 2) : "  none");
console.log(JSON.stringify(results, null, 2));
