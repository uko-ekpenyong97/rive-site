#!/usr/bin/env node
/**
 * Headless render check for the AudienceRails glyphs.
 *
 * WHY: the probe proves each .riv contains the artboard its config asks for, and
 * the Vitest suite proves the config is internally consistent — but both run
 * against a mocked or static world. Neither can answer "did three canvases
 * actually come up on the page". When this section shipped broken, that question
 * was never asked: rendering nothing looks exactly like rendering nothing on
 * purpose, so the absence went unobserved rather than unnoticed.
 *
 * This asks it. Run against the DEV server, not preview — the component's
 * load-failure warning is stripped from production builds, and catching that
 * warning is half the value here.
 *
 *   npm run dev            # in another shell
 *   node scripts/render-check.mjs --url http://localhost:5173
 *
 * Not wired into CI: it needs a real Chrome and a running server. It is the
 * local gate before shipping a change to any Rive surface.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173";

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const profile = mkdtempSync(join(tmpdir(), "rive-render-check-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    // Rive needs WebGL2; headless has no GPU, so run it on SwiftShader.
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
};

async function devtoolsPort() {
  for (let i = 0; i < 60; i++) {
    try {
      const raw = readFileSync(join(profile, "DevToolsActivePort"), "utf8");
      const port = raw.split("\n")[0].trim();
      if (port) return port;
    } catch {
      /* not written yet */
    }
    await sleep(250);
  }
  throw new Error("Chrome never reported a DevTools port");
}

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const good = (m) => console.log(`  ✓ ${m}`);

try {
  const port = await devtoolsPort();
  const target = await (
    await fetch(
      `http://127.0.0.1:${port}/json/new?${encodeURIComponent(URL_)}`,
      { method: "PUT" },
    )
  ).json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.onopen = ok;
    ws.onerror = () => no(new Error("could not attach to the page"));
  });

  let id = 0;
  const pending = new Map();
  const consoleWarnings = [];

  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      return;
    }
    if (m.method === "Runtime.consoleAPICalled") {
      const txt = (m.params.args ?? [])
        .map((a) => a.value ?? a.description ?? "")
        .join(" ");
      if (["warning", "error"].includes(m.params.type)) consoleWarnings.push(txt);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      ws.send(JSON.stringify({ id: i, method, params }));
    });

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    }
    return r.result.value;
  };

  await send("Runtime.enable");

  // The section is below the fold and the glyphs are gated on approach, so
  // scroll it into view and give the observer + fetch + first frame time to land.
  console.log(`Loading ${URL_}\n`);
  for (let i = 0; i < 60; i++) {
    if (await evaluate("!!document.querySelector('.audience-rails')")) break;
    await sleep(500);
  }
  await evaluate(
    "document.querySelector('.audience-rails')?.scrollIntoView({block:'center'})",
  );
  await sleep(3000);

  const seen = await evaluate(`(() => {
    const hosts = [...document.querySelectorAll('.audience-glyph')];
    return {
      rails: document.querySelectorAll('.audience-rails__rail').length,
      hosts: hosts.length,
      canvases: hosts.map(h => {
        const c = h.querySelector('canvas');
        return c ? { w: c.width, h: c.height, hidden: h.getAttribute('aria-hidden') } : null;
      }),
    };
  })()`);

  seen.rails === 3
    ? good(`3 rails on the page`)
    : bad(`expected 3 rails, found ${seen.rails}`);

  /* The failure path removes the host entirely, so a missing host IS the bug
     that shipped — three hosts is the assertion that it did not recur. */
  seen.hosts === 3
    ? good(`3 glyph hosts present (none removed by the failure path)`)
    : bad(`expected 3 glyph hosts, found ${seen.hosts} — a glyph failed to load`);

  seen.canvases.forEach((c, i) => {
    if (!c) return bad(`glyph ${i + 1}: no canvas element`);
    if (c.w > 0 && c.h > 0) good(`glyph ${i + 1}: backing store ${c.w}x${c.h}`);
    else bad(`glyph ${i + 1}: empty backing store (${c.w}x${c.h})`);
    if (c.hidden !== "true") bad(`glyph ${i + 1}: host is not aria-hidden`);
  });

  const loadFailures = consoleWarnings.filter((w) =>
    w.includes("[AudienceGlyph]"),
  );
  loadFailures.length === 0
    ? good("no glyph load failures reported")
    : loadFailures.forEach((w) => bad(w));

  /* ── StatsBand digit roll ───────────────────────────────────────────────
     The digit animations run on the Web Animations API, so their in-flight
     values never touch the style attribute and a unit test cannot see them.
     What a unit test also cannot see is whether they SETTLED — a spring that
     overshoots and never returns, or a fill that leaves a digit at opacity 0,
     would look exactly like a passing test suite. Only a real browser can say.

     This deliberately asserts the settled state and nothing mid-flight. */
  console.log("");
  await evaluate(
    "document.querySelector('.stats-band')?.scrollIntoView({block:'center'})",
  );
  /* The count runs ~1200ms for the two big stats, then the last roll needs its
     150ms. Waiting well past that is the point: this asserts the SETTLED state,
     and a spring that never returns or a fill that strands a digit at opacity 0
     would look exactly like a passing unit suite. */
  await sleep(2500);

  const stats = await evaluate(`(() => {
    const chars = [...document.querySelectorAll('.stats-band__char')];
    return {
      slots: document.querySelectorAll('.stats-band__slot').length,
      chars: chars.length,
      // Only the visible layer of each slot — leaving layers are aria-hidden.
      values: [...document.querySelectorAll('.stats-band__digits')]
        .map((d) => [...d.querySelectorAll('.stats-band__slot')]
          .map((s) => {
            const layers = s.querySelectorAll('.stats-band__char');
            return layers[layers.length - 1]?.textContent ?? '';
          }).join('')),
      suffixes: [...document.querySelectorAll('.stats-band__slot--suffix')]
        .map((s) => {
          const layers = s.querySelectorAll('.stats-band__char');
          return layers[layers.length - 1]?.textContent ?? '';
        }),
      unsettled: chars
        .map((c, i) => {
          const s = getComputedStyle(c);
          const opacity = Number(s.opacity);
          const blurred = s.filter !== 'none' && !/blur\\(0px\\)/.test(s.filter);
          return { i, text: c.textContent, opacity, filter: s.filter, blurred };
        })
        .filter((c) => c.opacity < 0.99 || c.blurred),
      // Sizers are aria-hidden and intentionally invisible; exclude them.
      clipped: [...document.querySelectorAll('.stats-band__slot')]
        .filter((s) => getComputedStyle(s).overflow !== 'visible').length,
      value: document.querySelector('.stats-band__value')?.textContent ?? '',
    };
  })()`);

  stats.chars > 0
    ? good(`StatsBand: ${stats.chars} character slots rendered`)
    : bad("StatsBand: no character slots found");

  /* Off-by-one in a tick schedule is the classic failure here: the count runs,
     it looks right, and it stops on 119. Assert the exact landings. */
  const WANT = ["4", "90", "2", "120"];
  const WANT_SUFFIX = ["×", "%", "×", "fps"];
  JSON.stringify(stats.values) === JSON.stringify(WANT)
    ? good(`StatsBand: counts landed exactly on ${WANT.join(", ")}`)
    : bad(
        `StatsBand: counts landed on [${stats.values.join(", ")}], wanted [${WANT.join(", ")}]`,
      );
  JSON.stringify(stats.suffixes) === JSON.stringify(WANT_SUFFIX)
    ? good("StatsBand: suffixes intact")
    : bad(`StatsBand: suffixes are [${stats.suffixes.join(", ")}]`);

  stats.unsettled.length === 0
    ? good("StatsBand: every digit settled (opacity 1, no blur)")
    : stats.unsettled.forEach((c) =>
        bad(
          `StatsBand: digit ${c.i} ("${c.text}") unsettled — opacity ${c.opacity}, filter ${c.filter}`,
        ),
      );

  /* The blur has to breathe past the cell; a clipped slot turns the roll into
     a hard-edged wipe. */
  stats.clipped === 0
    ? good("StatsBand: no slot clips its blur")
    : bad(`StatsBand: ${stats.clipped} slot(s) have overflow != visible`);

  /* ── DeveloperZone code window ──────────────────────────────────────────
     The sample scrolls rather than wraps, so the thing to verify is that the
     scroll stays INSIDE the panel: a code block that pushes the page sideways
     is the failure mode this trades against. Checked at 375px, narrower than
     the section's 1024px single-column breakpoint. */
  console.log("");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 375,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(
    "document.querySelector('.developer-zone')?.scrollIntoView({block:'center'})",
  );
  await sleep(600);

  const dev = await evaluate(`(() => {
    const panel = document.querySelector('.developer-zone__panel');
    const pre = document.querySelector('.developer-zone__code');
    const btn = document.querySelector('.developer-zone__clipboard');
    if (!panel || !pre) return null;
    /* Scoped to the panel's own right edge, NOT the page's scrollWidth. At
       375px this page already overflows for reasons that predate the code
       window — the nav does not collapse below ~640px, DotField sizes past the
       viewport, and the logo marquee is deliberately wider than its clip. A
       page-wide assertion here would fail for someone else's bug and teach
       whoever hits it to ignore this check. */
    const vw = document.documentElement.clientWidth;
    return {
      panelRightEdge: Math.round(panel.getBoundingClientRect().right),
      viewport: vw,
      panelOverflow: panel.scrollWidth - panel.clientWidth,
      preScrolls: pre.scrollWidth > pre.clientWidth,
      lines: pre.querySelectorAll('.dz-line').length,
      hasGutter: getComputedStyle(pre.querySelector('.dz-line'), '::before').content !== 'none',
      /* Vertical rhythm. The advance is the real distance between consecutive
         line boxes; if it drifts above the line-height, something is adding a
         row per line — which is exactly how this window once grew to 1110px
         (block lines plus the preserved newline between them, ratio 2.02).
         No backticks in here: this whole block is inside a template literal. */
      lineHeight: parseFloat(getComputedStyle(pre).lineHeight),
      advance: (() => {
        const l = [...pre.querySelectorAll('.dz-line')];
        if (l.length < 3) return null;
        return l[2].getBoundingClientRect().top - l[1].getBoundingClientRect().top;
      })(),
      contentHeight: pre.scrollHeight
        - parseFloat(getComputedStyle(pre).paddingTop)
        - parseFloat(getComputedStyle(pre).paddingBottom),
      button: btn ? btn.getAttribute('aria-label') : null,
      text: pre.textContent.includes('autoBind') && pre.textContent.includes('viewModelInstance'),
    };
  })()`);

  if (!dev) {
    bad("DeveloperZone: code window not found");
  } else {
    dev.text
      ? good(`DeveloperZone: sample rendered, ${dev.lines} lines`)
      : bad("DeveloperZone: sample text missing autoBind/viewModelInstance");

    dev.panelRightEdge <= dev.viewport + 1
      ? good(`DeveloperZone: panel stays inside the 375px viewport`)
      : bad(
          `DeveloperZone: panel right edge ${dev.panelRightEdge}px exceeds the ${dev.viewport}px viewport`,
        );

    dev.panelOverflow <= 0
      ? good("DeveloperZone: the panel contains its own scroll")
      : bad(`DeveloperZone: panel overflows by ${dev.panelOverflow}px`);

    dev.preScrolls
      ? good("DeveloperZone: long lines scroll inside the window (not wrapped)")
      : good("DeveloperZone: sample fits without scrolling at this width");

    dev.hasGutter
      ? good("DeveloperZone: line-number gutter is generated content")
      : bad("DeveloperZone: no gutter — numbers would be copyable text");

    dev.button === "Copy code sample"
      ? good("DeveloperZone: copy button has an accessible name")
      : bad(`DeveloperZone: copy button aria-label is ${dev.button}`);

    /* One row per source line, and no more. */
    if (dev.advance !== null) {
      const ratio = dev.advance / dev.lineHeight;
      ratio <= 1.05
        ? good(
            `DeveloperZone: one row per line (advance ${dev.advance.toFixed(1)}px / line-height ${dev.lineHeight}px = ${ratio.toFixed(2)})`,
          )
        : bad(
            `DeveloperZone: ${ratio.toFixed(2)} rows per line — something adds a row per line (advance ${dev.advance.toFixed(1)}px vs line-height ${dev.lineHeight}px)`,
          );
    }

    /* lines x line-height should account for the content box. A per-line margin
       would show up here even if the advance check somehow passed. */
    const expected = dev.lines * dev.lineHeight;
    const drift = Math.abs(dev.contentHeight - expected);
    drift <= dev.lineHeight
      ? good(
          `DeveloperZone: ${dev.lines} lines x ${dev.lineHeight}px accounts for the ${Math.round(dev.contentHeight)}px content box`,
        )
      : bad(
          `DeveloperZone: content box ${Math.round(dev.contentHeight)}px vs ${Math.round(expected)}px expected — ${Math.round(drift)}px of unexplained spacing`,
        );
  }
  await send("Emulation.clearDeviceMetricsOverride");

  /* ── CommunityWall ──────────────────────────────────────────────────────
     18 CC BY files. The credit is a licence obligation, so the checks below are
     about it surviving: real decoded pixels, and a static state under reduced
     motion where the wall stops rather than scrolling credits past the reader. */
  console.log("");
  await evaluate(
    "document.querySelector('.community-showcase')?.scrollIntoView({block:'center'})",
  );
  await sleep(1200);

  const wall = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.community-showcase__row')];
    const tiles = [...document.querySelectorAll('.community-showcase__tile')];
    const imgs = [...document.querySelectorAll('.community-showcase__thumb')];
    const first = tiles[0] ? tiles[0].getBoundingClientRect() : null;
    return {
      rows: rows.length,
      tiles: tiles.length,
      tileSize: first ? Math.round(first.width) + 'x' + Math.round(first.height) : null,
      loaded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      /* complete but zero-width = fetched and failed. That is the real failure;
         "not yet loaded" is loading="lazy" doing its job. */
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      images: imgs.length,
      /* The overlay must hide with opacity, not display/visibility — otherwise
         the credit leaves the accessibility tree with the pixels. */
      captionHidden: (() => {
        const c = document.querySelector('.community-showcase__caption');
        if (!c) return null;
        const s = getComputedStyle(c);
        return s.display !== 'none' && s.visibility !== 'hidden';
      })(),
      moving: rows.length
        ? getComputedStyle(rows[0].querySelector('.community-showcase__track')).animationName !== 'none'
        : false,
    };
  })()`);

  wall.rows === 3
    ? good(`CommunityWall: 3 rows, ${wall.tiles} tiles`)
    : bad(`CommunityWall: expected 3 rows, found ${wall.rows}`);

  wall.tileSize === "280x184"
    ? good("CommunityWall: tiles at 280x184")
    : bad(`CommunityWall: tile is ${wall.tileSize}, expected 280x184`);

  /* Decoded pixels, not just an <img> with a src — but NOT "all of them".
     These are loading="lazy" and the rows run wider than the viewport, so most
     tiles legitimately have not fetched yet. Demanding all 36 would have been
     asserting against a feature this section deliberately uses. What matters is
     that nothing which DID fetch came back empty. */
  wall.broken === 0 && wall.loaded > 0
    ? good(
        `CommunityWall: ${wall.loaded} of ${wall.images} thumbnails decoded so far, 0 broken (rest are lazy)`,
      )
    : bad(
        `CommunityWall: ${wall.broken} thumbnail(s) fetched and failed to decode`,
      );

  wall.captionHidden
    ? good("CommunityWall: credit hides with opacity, stays in the a11y tree")
    : bad("CommunityWall: credit is display/visibility hidden — leaves the a11y tree");

  wall.moving
    ? good("CommunityWall: rows are scrolling")
    : bad("CommunityWall: rows are not animating");

  /* Reduced motion is a RENDER BRANCH here, not a paused animation: the static
     grid is different DOM, so duplicated tiles should not ship at all. */
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await evaluate("location.reload()");
  await sleep(2500);
  await evaluate(
    "document.querySelector('.community-showcase')?.scrollIntoView({block:'center'})",
  );
  await sleep(800);

  const reduced = await evaluate(`(() => ({
    grid: !!document.querySelector('.community-showcase__grid'),
    wall: !!document.querySelector('.community-showcase__wall'),
    tiles: document.querySelectorAll('.community-showcase__tile').length,
    hidden: document.querySelectorAll('.community-showcase__tile[aria-hidden]').length,
  }))()`);

  reduced.grid && !reduced.wall
    ? good("CommunityWall: reduced motion renders the static grid, not the wall")
    : bad(
        `CommunityWall: reduced motion still rendered the wall (grid=${reduced.grid} wall=${reduced.wall})`,
      );

  reduced.tiles === 6 && reduced.hidden === 0
    ? good("CommunityWall: reduced motion ships 6 tiles and no duplicates")
    : bad(
        `CommunityWall: reduced motion has ${reduced.tiles} tiles, ${reduced.hidden} duplicated`,
      );

  await send("Emulation.setEmulatedMedia", { features: [] });

  /* ── ExpertsStrip ───────────────────────────────────────────────────────
     Nine real people's public listings. The checks are that nobody's card is
     mislaid and that the taglines truncate rather than blowing the grid open. */
  console.log("");
  /* Pin the viewport: an earlier check narrows it to 375px and a stale override
     silently turned this into a 2-column assertion that could never have caught
     a broken desktop layout. */
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate("location.reload()");
  await sleep(2000);
  await evaluate(
    "document.querySelector('.experts-strip')?.scrollIntoView({block:'center'})",
  );
  await sleep(600);

  const experts = await evaluate(`(() => {
    const section = document.querySelector('.experts-strip');
    if (!section) return null;
    const cards = [...section.querySelectorAll('.experts-strip__card')];
    const overflowing = cards.filter((c) => c.scrollWidth > c.clientWidth + 1);
    const grid = section.querySelector('.experts-strip__grid');
    return {
      cards: cards.length,
      images: section.querySelectorAll('img').length,
      /* A tagline whose track grew to fit it never engages the ellipsis. */
      cardOverflow: overflowing.length,
      /* The section must not push past its own column. */
      sectionOverflow: Math.max(0, Math.round(section.scrollWidth - section.clientWidth)),
      columns: grid
        ? getComputedStyle(grid).gridTemplateColumns.split(' ').length
        : 0,
      truncates: [...section.querySelectorAll('.experts-strip__tagline')]
        .filter((t) => getComputedStyle(t).textOverflow === 'ellipsis').length,
      viewport: document.documentElement.clientWidth,
    };
  })()`);

  if (!experts) {
    bad("ExpertsStrip: section not found");
  } else {
    experts.cards === 9
      ? good(`ExpertsStrip: 9 cards`)
      : bad(`ExpertsStrip: expected 9 cards, found ${experts.cards}`);

    /* Nine into 3x3 with no ragged last row is the whole reason this is a grid
       and not a scrolling row. */
    experts.columns === 3
      ? good("ExpertsStrip: 3 columns at desktop, so 3 even rows")
      : bad(
          `ExpertsStrip: ${experts.columns} columns at 1440px, expected 3 (viewport ${experts.viewport}px)`,
        );

    experts.images === 0
      ? good("ExpertsStrip: no photographs, monograms only")
      : bad(`ExpertsStrip: ${experts.images} image(s) — the no-photos rule broke`);

    experts.sectionOverflow === 0 && experts.cardOverflow === 0
      ? good("ExpertsStrip: nothing overflows its container")
      : bad(
          `ExpertsStrip: section overflow ${experts.sectionOverflow}px, ${experts.cardOverflow} card(s) overflowing`,
        );

    experts.truncates === 9
      ? good("ExpertsStrip: every tagline is set to truncate")
      : bad(`ExpertsStrip: ${experts.truncates} of 9 taglines truncate`);
  }
  await send("Emulation.clearDeviceMetricsOverride");

  /* ── FooterMark ─────────────────────────────────────────────────────────
     The layered wordmark that closes the page. Its whole effect is four
     hairlines at different weights, which is exactly the kind of thing that
     survives a unit test and dies in a browser — non-scaling-stroke is a
     rendering behaviour, and the ghost layers can composite away to nothing
     without any assertion noticing. */
  console.log("");
  await evaluate("window.scrollTo(0, document.body.scrollHeight)");
  await sleep(1200);

  const mark = await evaluate(`(() => {
    const svg = document.querySelector('.footer-mark');
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const layers = [...svg.querySelectorAll('.footer-mark__layer')];
    const dot = svg.querySelector('.footer-mark__dot');
    const doc = document.documentElement;
    return {
      width: Math.round(r.width),
      parentWidth: Math.round(svg.parentElement.getBoundingClientRect().width),
      layers: layers.length,
      nonScaling: layers.filter(
        (l) => getComputedStyle(l).vectorEffect === 'non-scaling-stroke',
      ).length,
      /* Resolved, so a token that composites to nothing is visible here. */
      strokes: layers.map((l) => {
        const cs = getComputedStyle(l);
        return cs.stroke + ' @' + cs.strokeOpacity + ' w' + cs.strokeWidth;
      }),
      dot: !!dot,
      dotAnimations: dot ? dot.getAnimations().length : 0,
      dotOffsetPath: dot ? getComputedStyle(dot).offsetPath.slice(0, 12) : null,
      /* An SVG clips to its viewBox, and these letterforms fill theirs exactly,
         so anything riding the path gets cut in half wherever the path meets an
         edge. Walk the whole lap and report the tightest clearance rather than
         trusting whichever frame a screenshot happened to catch. */
      dotClearance: (() => {
        if (!dot) return null;
        const b = svg.getBoundingClientRect();
        const before = dot.style.offsetDistance;
        const anims = dot.getAnimations();
        anims.forEach((a) => a.pause());
        let tightest = Infinity;
        for (let p = 0; p <= 100; p += 2) {
          dot.style.offsetDistance = p + '%';
          const d = dot.getBoundingClientRect();
          tightest = Math.min(
            tightest,
            d.top - b.top, b.bottom - d.bottom, d.left - b.left,
          );
        }
        dot.style.offsetDistance = before;
        anims.forEach((a) => a.play());
        return Math.round(tightest * 10) / 10;
      })(),
      /* The mark IS the bottom edge. */
      gapBelow: Math.round(doc.scrollHeight - (r.bottom + window.scrollY)),
      /* Scoped to the MARK, not the page. This page has deliberately full-bleed
         sections (the community wall is 100vw by design), so a page-wide
         overflow assertion here would fail for someone else's layout and teach
         whoever hits it to ignore this check — the same trap the DeveloperZone
         block above already documents. */
      selfOverflow: Math.max(0, Math.round(svg.scrollWidth - svg.clientWidth)),
      escapesRight: Math.max(0, Math.round(r.right - doc.clientWidth)),
    };
  })()`);

  if (!mark) {
    bad("FooterMark: not found");
  } else {
    mark.layers === 4
      ? good("FooterMark: 4 stacked outline layers")
      : bad(`FooterMark: ${mark.layers} layers, expected 4`);

    mark.nonScaling === 4
      ? good("FooterMark: non-scaling-stroke on every layer")
      : bad(
          `FooterMark: ${mark.nonScaling} of 4 layers keep non-scaling-stroke — hairlines will fatten with the viewport`,
        );

    mark.width === mark.parentWidth
      ? good(`FooterMark: spans the full content width (${mark.width}px)`)
      : bad(`FooterMark: ${mark.width}px inside a ${mark.parentWidth}px column`);

    mark.gapBelow === 0
      ? good("FooterMark: flush to the bottom of the page")
      : bad(`FooterMark: ${mark.gapBelow}px of page below the mark`);

    mark.selfOverflow === 0 && mark.escapesRight === 0
      ? good("FooterMark: stays inside the viewport, scrolls nothing")
      : bad(
          `FooterMark: overflows itself by ${mark.selfOverflow}px, escapes right by ${mark.escapesRight}px`,
        );

    mark.dot && mark.dotAnimations === 1 && mark.dotOffsetPath?.startsWith("path")
      ? good("FooterMark: payload dot riding one motion-path animation")
      : bad(
          `FooterMark: dot=${mark.dot} animations=${mark.dotAnimations} offsetPath=${mark.dotOffsetPath}`,
        );

    mark.dotClearance !== null && mark.dotClearance > 0
      ? good(
          `FooterMark: dot stays inside the viewBox all lap (tightest ${mark.dotClearance}px)`,
        )
      : bad(
          `FooterMark: dot is clipped by the viewBox (clearance ${mark.dotClearance}px) — the letterforms fill their box, so the mark needs padding`,
        );

    console.log("        layers:", mark.strokes.join("  |  "));
  }
} catch (err) {
  bad(err.message);
} finally {
  cleanup();
}

console.log(
  failures === 0
    ? "\n✓ glyphs rendered and stat digits settled"
    : `\n✗ ${failures} problem(s)`,
);
process.exit(failures === 0 ? 0 : 1);
