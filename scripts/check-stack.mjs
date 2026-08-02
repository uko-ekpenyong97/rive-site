#!/usr/bin/env node
/**
 * WorkflowStack choreography — does the paper stack still behave?
 *
 *   npm run dev            # in another shell
 *   npm run check:stack
 *
 * WHAT THIS ANSWERS THAT STATIC GEOMETRY CANNOT: the card box is easy to
 * measure at rest and tells you almost nothing about the mechanic. The stack is
 * five sticky elements pinning at staggered offsets while the flow scrolls past
 * them, so the questions that matter are all about motion:
 *
 *   · PEEK — once card N+1 has pinned, exactly --stack-stagger of card N must
 *     remain visible above it. That is the stacked-paper read. If it collapses
 *     to 0 the cards look like one card; if it grows, they look detached.
 *   · DWELL — the scroll distance between consecutive cards pinning. This is
 *     the pacing of the whole sequence, and it is the thing that silently
 *     changes when card height changes and the flow gap does not.
 *   · STACK ORDER AT THE BOUNDARY — a card that has taken its beat must never
 *     sit above the one before it. (An earlier draft of this check flagged the
 *     background visible between a pinned card and the next one still climbing
 *     toward it. That is not a defect, it is what the section looks like at
 *     rest — the check was measuring normal layout and calling it a gap.)
 *   · The Loop canvas must stay pinned across the whole sequence, since it is
 *     the thing the beats drive.
 *
 * Measured by scrolling in real steps and reading live rects — the CSS says what
 * should happen, the scroll says what does.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const urlArg = args.indexOf("--url");
const URL_ = urlArg >= 0 ? args[urlArg + 1] : "http://localhost:5173/";
const WIDTHS = [1280, 1440, 1680];

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** How close a measured peek must sit to --stack-stagger. */
const PEEK_TOLERANCE = 1.5;
/** A later card may never sit above an earlier one by more than this. */
const GAP_TOLERANCE = 0.5;

let failures = 0;
const bad = (m) => {
  failures++;
  console.error(`    ✗ ${m}`);
};

const profile = mkdtempSync(join(tmpdir(), "check-stack-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const cleanup = () => {
  chrome.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
};

const GEOM = `(() => {
  const s = document.querySelector('.workflow-stack');
  if (!s) return { error: 'no .workflow-stack' };
  const cards = [...document.querySelectorAll('.workflow-stack__card')];
  if (cards.length !== 5) return { error: 'expected 5 cards, found ' + cards.length };
  const cs = getComputedStyle(s);
  const c0 = cards[0];
  const ccs = getComputedStyle(c0);
  const copy = c0.querySelector('.workflow-stack__copy');
  const cr = c0.getBoundingClientRect(), pr = copy.getBoundingClientRect();
  const px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
  return {
    stagger: px('--stack-stagger'),
    dwell: px('--stack-dwell'),
    scrub: px('--stack-scrub'),
    travel: parseFloat(getComputedStyle(cards[1]).marginTop),
    travelBind: parseFloat(getComputedStyle(cards[4]).marginTop),
    cardH: +cr.height.toFixed(1),
    cardW: +cr.width.toFixed(1),
    paddingLeft: ccs.paddingLeft,
    paddingTop: ccs.paddingTop,
    heights: cards.map((c) => +c.getBoundingClientRect().height.toFixed(1)),
    copyHeights: cards.map((c) =>
      +c.querySelector('.workflow-stack__copy').getBoundingClientRect().height.toFixed(1)),
    textInset: +(pr.left - cr.left).toFixed(1),
    /* Vertical centring, measured as the two bands rather than trusted from
       justify-content: center. */
    bandTop: +(pr.top - cr.top).toFixed(1),
    bandBottom: +(cr.bottom - pr.bottom).toFixed(1),
    sectionH: +s.getBoundingClientRect().height.toFixed(1),
    pinTops: cards.map((c) => parseFloat(getComputedStyle(c).top)),
    canvasInCard: !!document.querySelector('.workflow-stack__canvas')?.closest('.workflow-stack__card'),
    /* The band is the peek strip; its height must equal the stagger exactly or
       the label is sliced when the next card covers it. */
    bandH: +c0.querySelector('.workflow-stack__band').getBoundingClientRect().height.toFixed(2),
    labels: cards.map((c) => {
      const el = c.querySelector('.workflow-stack__card-eyebrow');
      const cr2 = c.getBoundingClientRect(), lr = el.getBoundingClientRect();
      const ecs = getComputedStyle(el);
      return {
        text: el.textContent.trim(),
        fromCardTop: +(lr.top - cr2.top).toFixed(2),
        bottomFromCardTop: +(lr.bottom - cr2.top).toFixed(2),
        inset: +(lr.left - cr2.left).toFixed(2),
        font: ecs.fontFamily.split(',')[0].replace(/"/g, ''),
        color: ecs.color,
      };
    }),
    /* Where the copy starts, per card — the consistency the top-align buys. */
    copyTops: cards.map((c) => {
      const cr2 = c.getBoundingClientRect();
      return +(c.querySelector('.workflow-stack__title').getBoundingClientRect().top - cr2.top).toFixed(2);
    }),
    canvasSize: (() => {
      const cv = document.querySelector('.workflow-stack__canvas');
      const r = cv.getBoundingClientRect();
      const inner = cv.querySelector('canvas');
      return {
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        backingW: inner ? inner.width : null, backingH: inner ? inner.height : null,
        cssW: inner ? +inner.getBoundingClientRect().width.toFixed(1) : null,
        dpr: devicePixelRatio,
      };
    })(),
    /* The composition the canvas is supposed to match. */
    compositionH: 4 * px('--stack-stagger') + parseFloat(getComputedStyle(cards[0]).minHeight),
  };
})()`;

const STATE = `(() => {
  const cards = [...document.querySelectorAll('.workflow-stack__card')];
  const canvas = document.querySelector('.workflow-stack__canvas');
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  return {
    y: Math.round(scrollY),
    tops: cards.map((c) => +c.getBoundingClientRect().top.toFixed(1)),
    bottoms: cards.map((c) => +c.getBoundingClientRect().bottom.toFixed(1)),
    /* STUCK: the card is sitting exactly on its pin offset.
       REACHED: its top has arrived at (or passed) that offset.
       These differ for the LAST card, whose sticky range is zero-length — its
       bottom coincides with the column's bottom, so it can never stick and
       simply scrolls on past. That is how this section already shipped, and the
       beat logic only needs top <= pin, so REACHED is the honest measure of
       when a card takes its beat. */
    pinned: cards.map((c) =>
      Math.abs(c.getBoundingClientRect().top - parseFloat(getComputedStyle(c).top)) < 1.5),
    reached: cards.map((c) =>
      c.getBoundingClientRect().top <= parseFloat(getComputedStyle(c).top) + 1.5),
    canvasTop: cr ? +cr.top.toFixed(1) : null,
    canvasBottom: cr ? +cr.bottom.toFixed(1) : null,
    canvasH: cr ? +cr.height.toFixed(1) : null,
    canvasW: cr ? +cr.width.toFixed(1) : null,
    /* Cropped = any edge outside the viewport. The canvas is the thing the
       beats drive, so a clipped one is a broken section, not a cosmetic issue. */
    canvasCropped: cr
      ? cr.top < -0.5 || cr.left < -0.5 ||
        cr.bottom > innerHeight + 0.5 || cr.right > innerWidth + 0.5
      : null,
    /* The visible stack: topmost peek strip's top, active card's bottom. */
    stackTop: Math.min(...cards.map((c) => c.getBoundingClientRect().top)),
    stackBottom: Math.max(...cards.map((c) => c.getBoundingClientRect().bottom)),
  };
})()`;

let ws;
try {
  let port;
  for (let i = 0; i < 80 && !port; i++) {
    try {
      port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
    } catch {
      await sleep(250);
    }
  }
  if (!port) throw new Error("Chrome never reported a DevTools port");
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  ws = new WebSocket(list.find((t) => t.type === "page").webSocketDebuggerUrl);
  await new Promise((ok, no) => {
    ws.onopen = ok;
    ws.onerror = () => no(new Error("could not attach to Chrome"));
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const ev = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description ?? "eval failed");
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  console.log(`workflow stack choreography → ${URL_}\n`);

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width, height: 900, deviceScaleFactor: 1, mobile: false,
    });
    await send("Page.navigate", { url: URL_ });
    await sleep(3000);
    await ev("document.fonts.ready");
    await sleep(300);

    const g = await ev(GEOM);
    if (!g || g.error) {
      bad(`${width}px — ${g?.error ?? "no geometry"}`);
      continue;
    }

    console.log(`━━ ${width}px ━━`);
    console.log(
      `  card ${g.cardW}×${g.cardH}  padding-left ${g.paddingLeft} / top ${g.paddingTop}  ` +
        `text inset ${g.textInset}px`,
    );
    console.log(
      `  copy blocks ${g.copyHeights.join(" / ")}  bands ${g.bandTop} above, ${g.bandBottom} below`,
    );
    console.log(
      `  stagger ${g.stagger}  dwell ${g.dwell} = ${g.cardH} + travel ${g.travel}  ` +
        `scrub ${g.scrub} = ${g.cardH} + bind ${g.travelBind}  section ${g.sectionH}`,
    );

    /* All five equal — "one variable, not per-card values". */
    if (new Set(g.heights).size !== 1)
      bad(`card heights differ: [${g.heights.join(", ")}] — the height is not one variable`);

    /* ── The band IS the peek ────────────────────────────────────────────────
       If these ever diverge the label is sliced by the covering card, and it
       looks like a rendering artefact rather than a geometry bug. */
    console.log(
      `  band ${g.bandH}px vs stagger ${g.stagger}px  ·  label "${g.labels[0].text}" ` +
        `${g.labels[0].font} ${g.labels[0].color} at inset ${g.labels[0].inset}px, ` +
        `y ${g.labels[0].fromCardTop}–${g.labels[0].bottomFromCardTop}`,
    );
    if (Math.abs(g.bandH - g.stagger) > 0.5)
      bad(`band is ${g.bandH}px but --stack-stagger is ${g.stagger}px — the label will be clipped in the peek`);
    for (const l of g.labels) {
      if (l.bottomFromCardTop > g.stagger + 0.5)
        bad(`label "${l.text}" runs to ${l.bottomFromCardTop}px, past the ${g.stagger}px peek strip — it would be cut`);
      if (l.fromCardTop < 0) bad(`label "${l.text}" sits above the card's top edge`);
      if (Math.abs(l.inset - (parseFloat(g.paddingLeft) + 1)) > 1.5)
        bad(`label "${l.text}" inset ${l.inset}px, expected ${parseFloat(g.paddingLeft) + 1}px (content inset)`);
    }
    /* House rule: eyebrow labels are the display face, not mono. */
    if (g.labels[0].font !== "Tomorrow")
      bad(`the band label renders in ${g.labels[0].font}; eyebrow labels are --font-display (Tomorrow)`);

    /* ── Consistent text position — the point of top-aligning ──────────────── */
    const copySpread = Math.max(...g.copyTops) - Math.min(...g.copyTops);
    console.log(`  title starts at ${g.copyTops[0]}px in every card (spread ${copySpread.toFixed(2)}px)`);
    if (copySpread > 0.5)
      bad(`title start varies by ${copySpread.toFixed(2)}px across cards — text position is not consistent`);

    /* ── Canvas matches the final composition ──────────────────────────────── */
    console.log(
      `  canvas ${g.canvasSize.w}×${g.canvasSize.h} vs composition ${g.compositionH}px  ` +
        `(4 × ${g.stagger} + ${g.cardH})  backing ${g.canvasSize.backingW}² @ dpr ${g.canvasSize.dpr}`,
    );
    if (Math.abs(g.canvasSize.h - g.compositionH) > 2)
      bad(`canvas is ${g.canvasSize.h}px but the final composition is ${g.compositionH}px`);
    if (Math.abs(g.canvasSize.w - g.canvasSize.h) > 1)
      bad(`canvas is not square: ${g.canvasSize.w}×${g.canvasSize.h}`);
    /* A backing store that did not follow the resize renders soft — invisible
       to every layout assertion above and to a screenshot at DPR 1. */
    if (g.canvasSize.backingW !== null) {
      const wantBacking = Math.round(g.canvasSize.cssW * g.canvasSize.dpr);
      if (Math.abs(g.canvasSize.backingW - wantBacking) > 2)
        bad(
          `canvas backing store is ${g.canvasSize.backingW}px for a ${g.canvasSize.cssW}px box ` +
            `at dpr ${g.canvasSize.dpr} — expected ~${wantBacking}px, so it would render blurred`,
        );
    }

    /* Derived travel must actually satisfy the invariant. */
    if (Math.abs(g.cardH + g.travel - g.dwell) > 1)
      bad(`dwell broken: ${g.cardH} + ${g.travel} ≠ ${g.dwell}`);
    if (Math.abs(g.cardH + g.travelBind - g.scrub) > 1)
      bad(`scrub broken: ${g.cardH} + ${g.travelBind} ≠ ${g.scrub}`);

    /* NOT a centring check any more. The copy is top-aligned on purpose, so the
       two bands are unequal by design and asserting symmetry here would fail the
       intended layout. What replaced it is the copyTops spread above: every
       card's title must start at the same y, which is the property top-aligning
       was chosen for. The bands are still printed, as information. */
    console.log(`  bands ${g.bandTop} above the copy, ${g.bandBottom} below (top-aligned, so unequal by design)`);

    /* The copy must fit inside the reduced box, or a card silently grows. */
    const tallest = Math.max(...g.copyHeights);
    const contentBox = g.cardH - parseFloat(g.paddingTop) * 2 - 2;
    if (contentBox < tallest)
      bad(`tallest copy block ${tallest}px exceeds the ${contentBox}px content box`);
    else
      console.log(`  tallest copy ${tallest}px in a ${contentBox}px content box — ${(contentBox - tallest).toFixed(1)}px slack`);

    if (g.canvasInCard) bad(`the Loop canvas is inside a card — it can be clipped by the height`);

    /* ── Scroll the sequence and watch the pins ─────────────────────────────── */
    const section = await ev(
      `(() => { const s = document.querySelector('.workflow-stack');
        const r = s.getBoundingClientRect();
        return { top: r.top + scrollY, height: r.height }; })()`,
    );

    const pinnedAt = new Array(5).fill(null);
    const everStuck = new Array(5).fill(false);
    let cropped = 0;
    let active = 0;
    const cropDetail = [];
    const align = { top: 0, bottom: 0, samples: 0, at: null };
    const peeks = [];
    let gapWorst = 0;
    let canvasUnpinned = 0;
    let samples = 0;

    const STEP = 40;
    const from = Math.max(0, Math.round(section.top) - 700);
    const to = Math.round(section.top + section.height) + 200;

    for (let y = from; y <= to; y += STEP) {
      await ev(`window.scrollTo(0, ${y})`);
      const st = await ev(STATE);
      samples++;

      for (let i = 0; i < 5; i++) {
        if (st.reached[i] && pinnedAt[i] === null) pinnedAt[i] = st.y;
        if (st.pinned[i]) everStuck[i] = true;
      }

      /* Peek: with card i+1 pinned, how much of card i shows above it. */
      for (let i = 0; i < 4; i++) {
        if (st.pinned[i] && st.pinned[i + 1]) {
          peeks.push(+(st.tops[i + 1] - st.tops[i]).toFixed(1));
        }
      }

      /* INVERSION, not "gap". Background between a pinned card and the next one
         still approaching is simply the section at rest — it is what the whole
         mechanic looks like, and flagging it measured normal layout as a defect.
         The real boundary glitch is ORDER: a card that has taken its beat must
         never sit ABOVE the one before it, or the stack reads upside down.
         Checked for cards 1-4, which stick; the last card is excluded because
         its zero-length sticky range means it legitimately travels on past. */
      for (let i = 0; i < 3; i++) {
        if (st.reached[i + 1]) {
          const inversion = st.tops[i] - st.tops[i + 1];
          if (inversion > gapWorst) gapWorst = inversion;
        }
      }

      if (st.canvasTop === null || st.canvasH < 20) canvasUnpinned++;
      /* Only while the section is ACTIVE. During entry and exit the canvas is
         legitimately part-way off screen like any other element — counting that
         as a crop measured normal scrolling and called it a defect. */
      if (st.pinned.some(Boolean)) {
        active++;
        if (st.canvasCropped) {
          cropped++;
          if (cropDetail.length < 4)
            cropDetail.push(`y=${st.y} canvas ${st.canvasTop}→${st.canvasBottom} (viewport 0→${900})`);
        }
      }

    }

    const uniquePeeks = [...new Set(peeks)];
    const peekMin = Math.min(...peeks), peekMax = Math.max(...peeks);
    console.log(
      `  scrolled ${from}→${to} in ${STEP}px steps (${samples} samples)\n` +
        `  peek while stacked: ${peekMin}–${peekMax}px across ${peeks.length} observations ` +
        `(want ${g.stagger}px)`,
    );
    if (!peeks.length) bad(`never observed two cards pinned together — no stack forms`);
    else if (Math.abs(peekMin - g.stagger) > PEEK_TOLERANCE || Math.abs(peekMax - g.stagger) > PEEK_TOLERANCE)
      bad(`peek ${peekMin}–${peekMax}px drifts from --stack-stagger ${g.stagger}px`);
    void uniquePeeks;

    const dwells = [];
    for (let i = 1; i < 5; i++) {
      if (pinnedAt[i] !== null && pinnedAt[i - 1] !== null)
        dwells.push(pinnedAt[i] - pinnedAt[i - 1]);
    }
    console.log(`  reached pin at scrollY ${pinnedAt.join(", ")}  → dwells ${dwells.join(", ")}px`);
    if (pinnedAt.some((p) => p === null))
      bad(`a card never reached its pin offset: [${pinnedAt.join(", ")}]`);
    /* Structural, and true before this change as well as after: only the first
       four cards actually STICK. Stated so a future reader does not read it as
       new breakage — and so it fails loudly if the first four ever stop. */
    console.log(`  actually stuck at their pin: cards [${everStuck.map((v,i)=>v?i+1:null).filter(Boolean).join(", ")}]` +
      ` — card 5's sticky range is zero-length by construction (last child), unchanged by this work`);
    for (let i = 0; i < 4; i++)
      if (!everStuck[i]) bad(`card ${i + 1} never stuck at its pin — the stack is not forming`);
    /* WHAT THE SCROLL DISTANCE BETWEEN TWO REACHES ACTUALLY IS.
       Each card pins --stack-stagger LOWER than the one before, so card N+1
       meets its own (lower) pin line earlier than a naive reading suggests: the
       measured gap is the flow distance minus one stagger.

           reach-to-reach = dwell - stagger

       This check compared against `dwell` alone until 2026-08-02. At stagger 24
       the 36px error hid inside a 41px sampling tolerance and the assertion
       passed; raising the stagger to 44 pushed it to 60px and exposed it. The
       cadence conclusions drawn earlier were still right — before/after numbers
       were compared like for like — but the expected value was wrong, and it
       was wrong in the direction that stays quiet. */
    const wantReach = g.dwell - g.stagger;
    const wantScrub = g.scrub - g.stagger;
    for (let i = 0; i < dwells.length - 1; i++) {
      if (Math.abs(dwells[i] - wantReach) > STEP + 1)
        bad(`reach ${i + 1}→${i + 2} is ${dwells[i]}px, expected ~${wantReach}px (dwell ${g.dwell} − stagger ${g.stagger})`);
    }
    const lastDwell = dwells[dwells.length - 1];
    if (lastDwell !== undefined && Math.abs(lastDwell - wantScrub) > STEP + 1)
      bad(`scrub zone is ${lastDwell}px, expected ~${wantScrub}px (scrub ${g.scrub} − stagger ${g.stagger})`);

    if (gapWorst > GAP_TOLERANCE)
      bad(`stack order inverted — a later card sat ${gapWorst.toFixed(1)}px ABOVE an earlier one`);
    else console.log(`  stack order held at every boundary (worst inversion ${gapWorst.toFixed(1)}px)`);

    if (canvasUnpinned) bad(`the Loop canvas lost its box on ${canvasUnpinned}/${samples} samples`);
    else console.log(`  Loop canvas held its box across all ${samples} samples`);

    if (cropped) bad(`the Loop canvas was cropped by the viewport on ${cropped}/${active} active samples: ${cropDetail.join(" | ")}`);
    else console.log(`  Loop canvas uncropped across all ${active} samples where the section is active`);

    /* THE FINAL BEAT IS A MOMENT, AND A 40px GRID CANNOT LAND ON IT.
       Card 5 arriving at its pin is a single scroll position; sampled coarsely,
       the nearest sample sits up to a step away and the composition is that much
       taller than the canvas — which reads as a 36px misalignment that is really
       just "we measured 36px early". So the moment is found, not stumbled on:
       step finely until card 5's top sits exactly on its pin, then compare. */
    if (pinnedAt[4] !== null) {
      for (let y = pinnedAt[4] - STEP; y <= pinnedAt[4] + 4; y += 2) {
        await ev(`window.scrollTo(0, ${y})`);
        const st = await ev(STATE);
        const card5Off = Math.abs(st.tops[4] - g.pinTops[4]);
        if (card5Off > 1.5) continue;
        if (!(st.pinned[0] && st.pinned[1] && st.pinned[2] && st.pinned[3])) continue;
        const dTop = Math.abs(st.canvasTop - st.stackTop);
        const dBottom = Math.abs(st.canvasBottom - st.stackBottom);
        if (!align.samples || dTop + dBottom < align.top + align.bottom) {
          align.top = dTop;
          align.bottom = dBottom;
          align.at = y;
        }
        align.samples++;
      }
    }

    if (!align.samples) bad(`never observed the final beat — cannot check canvas/stack alignment`);
    else if (align.top > 2 || align.bottom > 2)
      bad(
        `at the final beat the canvas is off the composition by ${align.top.toFixed(1)}px at the ` +
          `top and ${align.bottom.toFixed(1)}px at the bottom (tolerance 2px)`,
      );
    else
      console.log(
        `  final-beat alignment within ${Math.max(align.top, align.bottom).toFixed(1)}px ` +
          `(top ${align.top.toFixed(1)}, bottom ${align.bottom.toFixed(1)}) at scrollY ${align.at}`,
      );

    console.log("");
  }

  if (failures) {
    console.error(`✗ workflow stack: ${failures} problem(s)`);
    process.exitCode = 1;
  } else {
    console.log("✓ stack choreography holds at all three widths");
  }
} catch (err) {
  console.error(`\n✗ stack check could not run: ${err.message}`);
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* best effort */
  }
  cleanup();
}
