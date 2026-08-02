/**
 * ONE platform→docs map, shared by every surface that names a platform.
 *
 * WHY SHARED: the DeveloperZone runtime chips and the UseCaseBento modals'
 * "Runs on" chips overlap on six platforms (web, apple, android, flutter, unity,
 * unreal). Two lists would drift the moment Rive reorganises a docs section —
 * one surface would be fixed and the other quietly left pointing at a 404. This
 * is the same call as `BEATS` in LoopCanvas: where two places need the same
 * facts, one of them owns them.
 *
 * KEYED BY CANONICAL ID, NOT BY DISPLAY LABEL. The two surfaces spell the same
 * platform differently on purpose — DeveloperZone sets its chips in uppercase
 * mono (`WEB`, `IOS`), the modals in sentence case (`Web`, `iOS`) — so keying on
 * the visible text would have forced one of them to change its typography to
 * satisfy a data structure. The id is the join; the label stays a presentation
 * decision belonging to each surface.
 *
 * SOURCE: read off rive.app/docs/runtimes/getting-started and the game-runtimes
 * index, verified 2026-08-01. Do not extend this map by pattern-matching a path
 * — four of the twelve do not follow the shape their name suggests:
 *
 *   · apple    — Rive publishes the iOS runtime as "Apple", not "ios"
 *   · unity    ┐ both game runtimes live under /docs/game-runtimes/,
 *   · unreal   ┘ not /docs/runtimes/
 *   · defold   — likewise; and the page itself defers to Defold's own docs,
 *                since that integration is maintained by the Defold team. Still
 *                the correct target: it is Rive's canonical entry point for it.
 *   · cpp      — has no docs subpage at all; the repository IS the reference
 *
 * TWO OF THESE ARE EDITOR INTEGRATIONS, NOT RUNTIMES, which is why they sit in a
 * different docs section and not under /runtimes/:
 *   · framer   — /docs/editor/embed-urls/…, because it is an embed, not a build
 *   · webflow  — canonically documented on WEBFLOW's help centre rather than
 *                rive.app: Webflow's native Rive support is Webflow's feature,
 *                so Webflow documents it. The one entry here that points off
 *                rive.app for a reason other than being a source repo.
 */

export const PLATFORM_DOCS = {
  web: "https://rive.app/docs/runtimes/web",
  react: "https://rive.app/docs/runtimes/react",
  "react-native": "https://rive.app/docs/runtimes/react-native",
  apple: "https://rive.app/docs/runtimes/apple",
  android: "https://rive.app/docs/runtimes/android",
  flutter: "https://rive.app/docs/runtimes/flutter",
  unity: "https://rive.app/docs/game-runtimes/unity",
  unreal: "https://rive.app/docs/game-runtimes/unreal",
  defold: "https://rive.app/docs/game-runtimes/defold",
  cpp: "https://github.com/rive-app/rive-cpp",
  framer: "https://rive.app/docs/editor/embed-urls/framer-and-rive",
  webflow:
    "https://help.webflow.com/hc/en-us/articles/33961216978451-Embed-Rive-animations",
} as const;

export type PlatformId = keyof typeof PLATFORM_DOCS;

/**
 * A platform as a surface names it: the text to show, and which doc it goes to.
 *
 * `platform: null` IS A DECISION, NOT A GAP. Some chips name a category rather
 * than a product — "Embedded devices" is the live one — and no canonical page
 * exists for it. Pointing it somewhere plausible would half-keep the label's
 * promise, which is worse than not making one. The null case is modelled
 * explicitly so a reader can tell "deliberately not linked" from "nobody got
 * round to it", and so `RuntimeChips` can render it as visibly non-interactive
 * rather than as a link that goes nowhere.
 */
export interface PlatformRef {
  label: string;
  platform: PlatformId | null;
}

/** The docs URL for a ref, or null when it is deliberately link-less. */
export function platformHref(ref: PlatformRef): string | null {
  return ref.platform ? PLATFORM_DOCS[ref.platform] : null;
}
