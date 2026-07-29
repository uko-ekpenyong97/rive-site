/**
 * HERO RENDER SMOKE — ported from `.context/modal-smoke.mjs` (sections 4 through
 * Film/TV). Every assertion here encodes a real past bug or a deliberate design
 * decision; the labels are the originals verbatim so each guard stays greppable
 * by the name it was written under.
 *
 * The original wrapped each render in a `check()` that reported PASS/FAIL for the
 * render itself. Those survive as the `"… renders"` tests: the HTML is produced
 * once at module scope, so a render that throws fails this whole file rather than
 * one line — strictly louder than the original, never quieter.
 */
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { ModalHero } from "../components/UseCaseModal/ModalHero";
import { GhostCursor } from "../components/UseCaseModal/GhostCursor";
import { StateRail } from "../components/UseCaseModal/StateRail";
import {
  getUseCase,
  type UseCaseHero,
} from "../components/UseCaseModal/useCaseContent";
import { text, count } from "./helpers";

type RivHero = Extract<UseCaseHero, { type: "riv" }>;

/**
 * Narrow the hero union to its `riv` variant. Only that member carries
 * `artboard` / `rail` / `ghost` / `bytes`, so every data-model assertion below
 * needs the narrowing first. Each section still asserts `hero type is riv`
 * separately against the un-narrowed value, exactly as the original did.
 */
function asRiv(hero: UseCaseHero | undefined, slug: string): RivHero {
  if (!hero || hero.type !== "riv") {
    throw new Error(`expected a live .riv hero for "${slug}"`);
  }
  return hero;
}

/* ────────────────────────────────────────────────────────────────────────── */

describe("step 4: live hero + ghost", () => {
  const rawHero = getUseCase("game-ui")?.hero;
  const hero = asRiv(rawHero, "game-ui");

  it("hero type is riv", () => {
    expect(rawHero?.type).toBe("riv");
  });

  it("artboard healthBar", () => {
    expect(hero.artboard).toBe("healthBar");
  });

  it("state machine healthBar_SM", () => {
    expect(hero.stateMachine).toBe("healthBar_SM");
  });

  it("artboard dims 3000x1750", () => {
    expect(hero.width).toBe(3000);
    expect(hero.height).toBe(1750);
  });

  it(".riv src resolved by vite", () => {
    expect(typeof hero.src).toBe("string");
    expect(hero.src).toContain("health_bar_use_case");
  });

  it("credit file", () => {
    expect(hero.credit.file).toBe("Health Bar Use Case");
  });

  it("credit creator", () => {
    expect(hero.credit.creator).toBe("drawsgood");
  });

  it("credit href = marketplace page", () => {
    expect(hero.credit.href).toBe(
      "https://rive.app/marketplace/6510-12634-health-bar-use-case/",
    );
  });

  it("licence recorded (CC BY)", () => {
    expect(hero.credit.license).toBe("CC BY");
  });

  it("creator profile recorded", () => {
    expect(hero.credit.creatorUrl).toBe("https://rive.app/@drawsgood/");
  });

  it("ghost target inside the box", () => {
    expect(hero.ghost?.x).toBeGreaterThan(0);
    expect(hero.ghost?.x).toBeLessThan(1);
    expect(hero.ghost?.y).toBeGreaterThan(0);
    expect(hero.ghost?.y).toBeLessThan(1);
  });

  it("fallback label present (§8)", () => {
    expect(typeof hero.fallbackLabel).toBe("string");
    expect(hero.fallbackLabel.length).toBeGreaterThan(0);
  });

  // Credit chip renders the exact required string, linking to the marketplace.
  const creditHtml = renderToString(<ModalHero hero={hero} active={true} />);
  const creditText = text(creditHtml);
  const wantCredit = "Health Bar Use Case · by drawsgood · from the community";

  it("credit chip renders", () => {
    expect(creditHtml.length).toBeGreaterThan(0);
  });

  it(`chip text: "${wantCredit}"`, () => {
    expect(creditText).toContain(wantCredit);
  });

  it("chip links to the marketplace page", () => {
    expect(creditHtml).toContain(hero.credit.href);
  });

  // §8: a hero whose asset is missing must degrade to a labelled placeholder.
  const pendingHtml = renderToString(
    <ModalHero hero={{ type: "pending", label: "NO ASSET" }} />,
  );

  it("missing-asset fallback", () => {
    expect(pendingHtml.length).toBeGreaterThan(0);
  });

  it("absent asset → labelled placeholder, no canvas", () => {
    expect(pendingHtml).toContain("NO ASSET");
    expect(pendingHtml).not.toContain("<canvas");
  });

  // The ghost must never autoplay under prefers-reduced-motion.
  /* `paused` is required by GhostCursor today; the original script predates the
     prop and passed nothing, which read as falsy. `false` reproduces exactly the
     state the original assertions were written against. The paused-machine rule
     itself is guarded in the "regression guard" section below. */
  const ghostTarget = hero.ghost;
  if (!ghostTarget) throw new Error("game-ui hero lost its ghost target");
  const ghostArgs = {
    target: ghostTarget,
    surfaceRef: { current: null },
    idleDelay: 6000,
    ready: true,
    active: true,
    paused: false,
  };
  const reducedGhost = renderToString(
    <GhostCursor {...ghostArgs} reducedMotion={true} />,
  );
  const fullGhost = renderToString(
    <GhostCursor {...ghostArgs} reducedMotion={false} />,
  );

  it("ghost (reduced motion)", () => {
    expect(reducedGhost.length).toBeGreaterThan(0);
  });

  it("ghost (full motion)", () => {
    expect(fullGhost.length).toBeGreaterThan(0);
  });

  it("reduced motion → static hint, no ghost cursor", () => {
    expect(reducedGhost).toContain("ghost-hint");
    expect(reducedGhost).not.toContain("ghost-cursor");
  });

  it("full motion → ghost present, starts hidden (no autoplay on mount)", () => {
    expect(fullGhost).toContain("ghost-cursor");
    expect(fullGhost).toContain('data-phase="hidden"');
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("T1: Nosey hero + StateRail", () => {
  const rawHero = getUseCase("product-ui")?.hero;
  const nosey = asRiv(rawHero, "product-ui");
  const rail = nosey.rail;
  if (!rail) throw new Error("product-ui hero lost its state rail");

  it("hero type is riv", () => {
    expect(rawHero?.type).toBe("riv");
  });

  it("artboard NotionAI 2", () => {
    expect(nosey.artboard).toBe("NotionAI 2");
  });

  it("state machine Test", () => {
    expect(nosey.stateMachine).toBe("Test");
  });

  it("square artboard 1000x1000", () => {
    expect(nosey.width).toBe(1000);
    expect(nosey.height).toBe(1000);
  });

  it("canvas capped at 480px", () => {
    expect(nosey.maxWidth).toBe(480);
  });

  it(".riv src resolved by vite", () => {
    expect(typeof nosey.src).toBe("string");
    expect(nosey.src).toContain("nosey");
  });

  it("enum property agentStatus", () => {
    expect(rail.property).toBe("agentStatus");
  });

  it("9 states in the rail order", () => {
    expect(rail.order.length).toBe(9);
  });

  it("rail order is lifecycle-arc-first", () => {
    expect(rail.order.join(",")).toBe(
      "idle,thinking,searching,writing,completed,error,greeting,nerd,cool",
    );
  });

  it("auto-cycle walks the 4 sustained states", () => {
    expect(rail.autoCycle.join(",")).toBe("idle,thinking,searching,writing");
  });

  it("one-shots marked for auto-return", () => {
    expect(rail.oneShots.slice().sort().join(",")).toBe(
      "completed,error,greeting",
    );
  });

  it("rest state is idle", () => {
    expect(rail.rest).toBe("idle");
  });

  it("no ghost on this hero", () => {
    expect(nosey.ghost).toBeUndefined();
  });

  it("caption present", () => {
    expect(typeof nosey.caption).toBe("string");
    expect(nosey.caption).toContain("enum");
  });

  it("fallback label present (§8)", () => {
    expect(typeof nosey.fallbackLabel).toBe("string");
  });

  it("provenance is first-party", () => {
    expect(nosey.credit.provenance).toBe("first-party");
  });

  it("credit links to the project", () => {
    expect(nosey.credit.href).toBe("https://nosey-demo-pitch.vercel.app/pitch");
  });

  // Credit chip: first-party must NOT claim community provenance.
  const noseyHtml = renderToString(<ModalHero hero={nosey} active={true} />);
  const noseyText = text(noseyHtml);

  it("nosey hero renders", () => {
    expect(noseyHtml.length).toBeGreaterThan(0);
  });

  it('chip text is exactly "Nosey · by Uko Ekpenyong"', () => {
    expect(noseyText).toContain("Nosey · by Uko Ekpenyong");
  });

  it("chip does NOT claim 'from the community'", () => {
    expect(noseyText).not.toContain("from the community");
  });

  it("licence only in tooltip/aria, not visible copy", () => {
    expect(noseyText).not.toContain("Original work");
    expect(noseyHtml).toContain("Original work");
  });

  it("caption rendered", () => {
    expect(noseyText).toContain("Agent states as an enum");
  });

  it("rail rendered inside the hero", () => {
    expect(noseyHtml).toContain('role="radiogroup"');
  });

  it("canvas present when the asset is there", () => {
    expect(noseyHtml).toContain("<canvas");
  });

  it("rail populated on first paint (no empty-then-pop)", () => {
    expect(count(noseyHtml, /role="radio"/g)).toBe(rail.order.length);
  });

  // StateRail in isolation: one pill per state + radiogroup semantics.
  const railHtml = renderToString(
    <StateRail
      states={rail.order}
      active="thinking"
      onSelect={() => {}}
      label="Nosey agent state"
    />,
  );
  const pills = count(railHtml, /role="radio"/g);

  it("StateRail renders", () => {
    expect(railHtml.length).toBeGreaterThan(0);
  });

  it(`one pill per state (${rail.order.length})`, () => {
    expect(pills).toBe(rail.order.length);
  });

  it("radiogroup role present", () => {
    expect(railHtml).toContain('role="radiogroup"');
  });

  it("group is labelled", () => {
    expect(railHtml).toContain('aria-label="Nosey agent state"');
  });

  it("active pill announces aria-checked", () => {
    expect(railHtml).toContain('aria-checked="true"');
  });

  it("exactly one pill is checked", () => {
    expect(count(railHtml, /aria-checked="true"/g)).toBe(1);
  });

  it("roving tabindex: one tab stop", () => {
    expect(count(railHtml, /tabindex="0"/g)).toBe(1);
  });

  it("every state label present", () => {
    expect(rail.order.every((s) => railHtml.includes(`>${s}<`))).toBe(true);
  });

  // Reduced motion: no auto-cycle, but the rail stays usable.
  const reducedNosey = renderToString(
    <ModalHero hero={nosey} active={true} reducedMotion={true} />,
  );

  it("nosey hero (reduced motion)", () => {
    expect(reducedNosey.length).toBeGreaterThan(0);
  });

  it("rail still rendered under reduced motion", () => {
    expect(reducedNosey).toContain('role="radiogroup"');
  });

  it("no pill is disabled (clicks are user intent)", () => {
    expect(reducedNosey).not.toContain("disabled");
  });

  // §8 for the first-party path too: a missing asset must degrade, not break.
  const noseyMissing = renderToString(
    <ModalHero hero={{ type: "pending", label: nosey.fallbackLabel }} />,
  );

  it("nosey missing-asset fallback", () => {
    expect(noseyMissing.length).toBeGreaterThan(0);
  });

  it("absent asset → labelled placeholder, no canvas", () => {
    expect(noseyMissing).toContain(nosey.fallbackLabel);
    expect(noseyMissing).not.toContain("<canvas");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("Websites: promoted proof-visual → live first-party hero", () => {
  const websites = getUseCase("websites");
  const rawHero = websites?.hero;
  const uko = asRiv(rawHero, "websites");

  it("hero type is riv", () => {
    expect(rawHero?.type).toBe("riv");
  });

  it("artboard Avatar (not the Me composition)", () => {
    expect(uko.artboard).toBe("Avatar");
  });

  it("state machine State Machine 1", () => {
    expect(uko.stateMachine).toBe("State Machine 1");
  });

  it("square artboard 2083x2083", () => {
    expect(uko.width).toBe(2083);
    expect(uko.height).toBe(2083);
  });

  it("canvas capped at 420px", () => {
    expect(uko.maxWidth).toBe(420);
  });

  it(".riv src resolved by vite", () => {
    expect(typeof uko.src).toBe("string");
    expect(uko.src).toContain("character_animation");
  });

  it("listener-driven: no ghost config", () => {
    expect(uko.ghost).toBeUndefined();
  });

  it("listener-driven: no rail config", () => {
    expect(uko.rail).toBeUndefined();
  });

  it("provenance first-party", () => {
    expect(uko.credit.provenance).toBe("first-party");
  });

  it("href omitted (plain-text chip)", () => {
    expect(uko.credit.href).toBeUndefined();
  });

  it("caption ties character to marketing sites", () => {
    expect(uko.caption ?? "").toContain("marketing site");
  });

  it("fallback label present (§8)", () => {
    expect(typeof uko.fallbackLabel).toBe("string");
    expect(uko.fallbackLabel.length).toBeGreaterThan(0);
  });

  /* Structurally still Tier 2 — the promotion was the visual only. */
  it("tier is still lite", () => {
    expect(websites?.tier).toBe("lite");
  });

  it("still 2 proof lines", () => {
    expect(websites?.proof.length).toBe(2);
  });

  it("no pull quote", () => {
    expect(websites?.quote).toBeUndefined();
  });

  it("escape valve intact", () => {
    expect(websites?.pageHref).toBe("https://rive.app/use-cases/websites");
  });

  const ukoHtml = renderToString(<ModalHero hero={uko} active={true} />);
  const ukoText = text(ukoHtml);

  it("websites hero renders", () => {
    expect(ukoHtml.length).toBeGreaterThan(0);
  });

  it("canvas present when the asset is there", () => {
    expect(ukoHtml).toContain("<canvas");
  });

  it('chip text is exactly "Uko · by Uko Ekpenyong"', () => {
    expect(ukoText).toContain("Uko · by Uko Ekpenyong");
  });

  it("chip is plain text, not a link", () => {
    expect(/<a[^>]*class="modal-hero__credit"/.test(ukoHtml)).toBe(false);
  });

  it("chip does not claim community provenance", () => {
    expect(ukoText).not.toContain("from the community");
  });

  it("no rail on this hero", () => {
    expect(ukoHtml).not.toContain('role="radiogroup"');
  });

  it("no ghost cursor on this hero", () => {
    expect(ukoHtml).not.toContain("ghost-cursor");
  });

  it("reuses RiveHero (not a bespoke component)", () => {
    expect(ukoHtml).toContain("rive-hero");
  });

  const ukoMissing = renderToString(
    <ModalHero hero={{ type: "pending", label: uko.fallbackLabel }} />,
  );

  it("websites missing-asset fallback", () => {
    expect(ukoMissing.length).toBeGreaterThan(0);
  });

  it("absent asset → labelled placeholder, no canvas", () => {
    expect(ukoMissing).toContain(uko.fallbackLabel);
    expect(ukoMissing).not.toContain("<canvas");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("regression guard: Game UI / Health Bar path unchanged", () => {
  const gameHero = asRiv(getUseCase("game-ui")?.hero, "game-ui");
  const gameHtml = renderToString(<ModalHero hero={gameHero} active={true} />);
  const gameText = text(gameHtml);

  it("still community provenance", () => {
    expect(gameHero.credit.provenance).toBe("community");
  });

  it("still says 'from the community'", () => {
    expect(gameText).toContain("from the community");
  });

  it("still ghost-driven, no rail", () => {
    expect(gameHero.rail).toBeUndefined();
    expect(gameHero.ghost).toBeDefined();
  });

  it("no StateRail in the ghost hero", () => {
    expect(gameHtml).not.toContain('role="radiogroup"');
  });

  it("health bar artboard untouched", () => {
    expect(gameHero.artboard).toBe("healthBar");
  });

  /* The hint must never promise an interaction a paused machine cannot deliver. */
  const gameReduced = renderToString(
    <ModalHero hero={gameHero} active={true} reducedMotion={true} />,
  );
  const gameClosed = renderToString(
    <ModalHero hero={gameHero} active={false} />,
  );

  it("reduced motion (canvas paused) → no static invitation", () => {
    expect(gameReduced).not.toContain("ghost-hint");
  });

  it("reduced motion → no animated ghost either", () => {
    expect(gameReduced).not.toContain("ghost-cursor");
  });

  it("modal closed (canvas paused) → no static invitation", () => {
    expect(gameClosed).not.toContain("ghost-hint");
  });

  it("full motion + open → ghost still present", () => {
    expect(gameHtml).toContain("ghost-cursor");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("Automotive: promoted proof-visual → live community .riv", () => {
  const automotive = getUseCase("automotive");
  const rawHero = automotive?.hero;
  const drive = asRiv(rawHero, "automotive");

  it("hero type is riv", () => {
    expect(rawHero?.type).toBe("riv");
  });

  it('artboard "Artboard"', () => {
    expect(drive.artboard).toBe("Artboard");
  });

  it("state machine Startup-SM", () => {
    expect(drive.stateMachine).toBe("Startup-SM");
  });

  it("artboard 3534x1626", () => {
    expect(drive.width).toBe(3534);
    expect(drive.height).toBe(1626);
  });

  it("wide: no maxWidth cap (full sheet width)", () => {
    expect(drive.maxWidth).toBeUndefined();
  });

  it(".riv src resolved by vite", () => {
    expect(typeof drive.src).toBe("string");
    expect(drive.src).toContain("driving_ui_concept");
  });

  it("autoBind for the default DashboardVM", () => {
    expect(drive.autoBind).toBe(true);
  });

  it("NO ghost (self-announcing controls + click-gated launch)", () => {
    expect(drive.ghost).toBeUndefined();
  });

  it("no rail (third-party: we never drive it)", () => {
    expect(drive.rail).toBeUndefined();
  });

  it("provenance community", () => {
    expect(drive.credit.provenance).toBe("community");
  });

  it("licence CC BY recorded", () => {
    expect(drive.credit.license).toBe("CC BY");
  });

  it("creator profile recorded", () => {
    expect(drive.credit.creatorUrl).toBe("https://rive.app/@Noushin.Pourmirza");
  });

  it("caption invites the launch", () => {
    expect((drive.caption ?? "").toLowerCase()).toContain("press start");
  });

  it("fallback label present (§8)", () => {
    expect(typeof drive.fallbackLabel).toBe("string");
    expect(drive.fallbackLabel.length).toBeGreaterThan(0);
  });

  it("tier is still lite", () => {
    expect(automotive?.tier).toBe("lite");
  });

  it("still 2 proof lines", () => {
    expect(automotive?.proof.length).toBe(2);
  });

  it("no pull quote", () => {
    expect(automotive?.quote).toBeUndefined();
  });

  it("escape valve intact", () => {
    expect(automotive?.pageHref).toBe("https://rive.app/use-cases/automotive");
  });

  const driveHtml = renderToString(<ModalHero hero={drive} active={true} />);
  const driveText = text(driveHtml);
  const wantChip =
    "Futuristic Driving UI Concept · by Noushin.Pourmirza · from the community";

  it("automotive hero renders", () => {
    expect(driveHtml.length).toBeGreaterThan(0);
  });

  it("canvas present when the asset is there", () => {
    expect(driveHtml).toContain("<canvas");
  });

  /* Label truncated in the original at 44 chars; kept verbatim so the guard
     stays greppable by the name it has always had. */
  it('chip text exact: "Futuristic Driving UI Concept · by Noushin.P…"', () => {
    expect(driveText).toContain(wantChip);
  });

  it("chip links to the marketplace page", () => {
    expect(driveHtml).toContain(drive.credit.href);
  });

  it("licence in tooltip/aria only, not visible copy", () => {
    expect(driveText).not.toContain("CC BY");
    expect(driveHtml).toContain("CC BY");
  });

  it("no ghost cursor rendered", () => {
    expect(driveHtml).not.toContain("ghost-cursor");
  });

  it("no rail rendered", () => {
    expect(driveHtml).not.toContain('role="radiogroup"');
  });

  it("reuses RiveHero", () => {
    expect(driveHtml).toContain("rive-hero");
  });

  const driveMissing = renderToString(
    <ModalHero hero={{ type: "pending", label: drive.fallbackLabel }} />,
  );

  it("automotive missing-asset fallback", () => {
    expect(driveMissing.length).toBeGreaterThan(0);
  });

  it("absent asset → labelled placeholder, no canvas", () => {
    expect(driveMissing).toContain(drive.fallbackLabel);
    expect(driveMissing).not.toContain("<canvas");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */

describe("Film/TV & Broadcast: promoted proof-visual → live community .riv", () => {
  const filmTv = getUseCase("film-tv-broadcast");
  const rawHero = filmTv?.hero;
  const ret = asRiv(rawHero, "film-tv-broadcast");

  it("hero type is riv", () => {
    expect(rawHero?.type).toBe("riv");
  });

  it('artboard "Recticle" (file\'s own typo, kept faithfully)', () => {
    expect(ret.artboard).toBe("Recticle");
  });

  it("state machine State Machine 1", () => {
    expect(ret.stateMachine).toBe("State Machine 1");
  });

  it("square artboard 500x500", () => {
    expect(ret.width).toBe(500);
    expect(ret.height).toBe(500);
  });

  it("capped at 420 (Tier 2 precedent)", () => {
    expect(ret.maxWidth).toBe(420);
  });

  it(".riv src resolved by vite (corrected spelling)", () => {
    expect(typeof ret.src).toBe("string");
    expect(ret.src).toContain("sci_fi_reticle");
  });

  it("autoBind for RecticleViewModel.offOn", () => {
    expect(ret.autoBind).toBe(true);
  });

  it("NO ghost (tracks pointer already + click-gated)", () => {
    expect(ret.ghost).toBeUndefined();
  });

  it("no rail (third-party: we never drive it)", () => {
    expect(ret.rail).toBeUndefined();
  });

  it("provenance community", () => {
    expect(ret.credit.provenance).toBe("community");
  });

  it("licence CC BY recorded", () => {
    expect(ret.credit.license).toBe("CC BY");
  });

  it("creator profile recorded", () => {
    expect(ret.credit.creatorUrl).toBe("https://rive.app/@drawsgood/");
  });

  it("caption names both track + click", () => {
    expect(ret.caption ?? "").toContain("follows your cursor");
    expect(ret.caption ?? "").toContain("lock on");
  });

  it("fallback label present (§8)", () => {
    expect(typeof ret.fallbackLabel).toBe("string");
    expect(ret.fallbackLabel.length).toBeGreaterThan(0);
  });

  it("bytes recorded for the preload policy", () => {
    expect(ret.bytes).toBe(813_463);
  });

  it("tier is still lite", () => {
    expect(filmTv?.tier).toBe("lite");
  });

  it("still 3 proof lines (incl. folded-in broadcast)", () => {
    expect(filmTv?.proof.length).toBe(3);
  });

  it("no pull quote", () => {
    expect(filmTv?.quote).toBeUndefined();
  });

  it("escape valve intact", () => {
    expect(filmTv?.pageHref).toBe("https://rive.app/use-cases/film-tv");
  });

  const retHtml = renderToString(<ModalHero hero={ret} active={true} />);
  const retText = text(retHtml);
  const wantRetChip = "Sci-fi reticle · by drawsgood · from the community";

  it("reticle hero renders", () => {
    expect(retHtml.length).toBeGreaterThan(0);
  });

  it("canvas present when the asset is there", () => {
    expect(retHtml).toContain("<canvas");
  });

  it(`chip text exact: "${wantRetChip}"`, () => {
    expect(retText).toContain(wantRetChip);
  });

  it("chip links to the marketplace page", () => {
    expect(retHtml).toContain(ret.credit.href);
  });

  it("licence in tooltip/aria only", () => {
    expect(retText).not.toContain("CC BY");
    expect(retHtml).toContain("CC BY");
  });

  it("no ghost cursor rendered", () => {
    expect(retHtml).not.toContain("ghost-cursor");
  });

  it("no rail rendered", () => {
    expect(retHtml).not.toContain('role="radiogroup"');
  });

  it("reuses RiveHero", () => {
    expect(retHtml).toContain("rive-hero");
  });

  const retMissing = renderToString(
    <ModalHero hero={{ type: "pending", label: ret.fallbackLabel }} />,
  );

  it("reticle missing-asset fallback", () => {
    expect(retMissing.length).toBeGreaterThan(0);
  });

  it("absent asset → labelled placeholder, no canvas", () => {
    expect(retMissing).toContain(ret.fallbackLabel);
    expect(retMissing).not.toContain("<canvas");
  });
});
