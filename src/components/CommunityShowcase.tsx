import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import SectionHeader from "./SectionHeader";
import "./CommunityShowcase.css";

import thumbInteractiveCharacterFollow from "../assets/community/28334-53514-interactive-character-follow.avif";
import thumbStudiorunACosmicGameByThelittlel from "../assets/community/26133-49002-studiorun-a-cosmic-game-by-thelittlelabs.avif";
import thumbInteractiveAquarium from "../assets/community/28158-53168-interactive-aquarium.avif";
import thumbYippee from "../assets/community/27915-52755-yippee.avif";
import thumbTreasureValleyInteractiveMap from "../assets/community/28363-53629-treasure-valley-interactive-map.avif";
import thumbBatterUpBunny from "../assets/community/28142-53149-batter-up-bunny.avif";
import thumbAudioPlayer from "../assets/community/28160-53178-audio-player.avif";
import thumbParticlesAndPhysicsFootball from "../assets/community/27290-51530-particles-and-physics-football.avif";
import thumbAPianoGame from "../assets/community/27375-51723-a-piano-game.avif";
import thumbADragToSpinRotaryPickerBuiltInRi from "../assets/community/28236-53335-a-drag-to-spin-rotary-picker-built-in-rive-scripting-da.avif";
import thumbVintageBike from "../assets/community/27842-52603-vintage-bike.avif";
import thumbAnimojis from "../assets/community/27832-52591-animojis.avif";
import thumbAutoWrappingPillMenu from "../assets/community/28124-53413-auto-wrapping-pill-menu.avif";
import thumbMaasaiInspiredEventHeroBannerCon from "../assets/community/27773-52471-maasai-inspired-event-hero-banner-concept.avif";
import thumbRumbleGolfChallengeMiniGame from "../assets/community/28184-53457-rumble-golf-challenge-mini-game.avif";
import thumbMessyFiles from "../assets/community/27239-51435-messy-files.avif";
import thumbSlotMachineGameWithScripting from "../assets/community/25759-48234-slot-machine-game-with-scripting.avif";
import thumbRoomDecorMiniGame from "../assets/community/25989-48561-room-decor-mini-game.avif";

const COMMUNITY_URL = "https://rive.app/community";

/**
 * A file on the wall. Every field is harvested from the live marketplace page by
 * scripts/fetch-community.mjs, which asserts CC BY before it will include one —
 * so a title or creator here cannot drift from the page it credits. Re-run that
 * script to refresh; never hand-edit.
 *
 * ATTRIBUTION IS THE LICENCE, NOT DECORATION. These are CC BY, so the credit is
 * an obligation we take on by showing the work. Title and creator are therefore
 * real text inside the link — revealed on hover, but present in the accessible
 * name at all times (the overlay hides with opacity, never display/visibility,
 * which would strip it from the accessibility tree along with the pixels).
 */
interface WallItem {
  title: string;
  creator: string;
  href: string;
  thumb: string;
}

/* Rive's own Featured tab, in wall order — three rows of six. */
const ROWS: WallItem[][] = [
  [
    {
      title: "Interactive Character Follow",
      creator: "alinazari",
      href: "https://rive.app/marketplace/28334-53514-interactive-character-follow/",
      thumb: thumbInteractiveCharacterFollow,
    },
    {
      title: "StudioRun - A Cosmic Game by TheLittleLabs",
      creator: "thelittlelabs",
      href: "https://rive.app/marketplace/26133-49002-studiorun-a-cosmic-game-by-thelittlelabs/",
      thumb: thumbStudiorunACosmicGameByThelittlel,
    },
    {
      title: "Interactive Aquarium",
      creator: "nickyinprogress",
      href: "https://rive.app/marketplace/28158-53168-interactive-aquarium/",
      thumb: thumbInteractiveAquarium,
    },
    {
      title: "Yippee",
      creator: "gianluigi.ranauro",
      href: "https://rive.app/marketplace/27915-52755-yippee/",
      thumb: thumbYippee,
    },
    {
      title: "Treasure Valley Interactive Map",
      creator: "yaroslavnaa",
      href: "https://rive.app/marketplace/28363-53629-treasure-valley-interactive-map/",
      thumb: thumbTreasureValleyInteractiveMap,
    },
    {
      title: "Batter up, Bunny!",
      creator: "MikkelBorris",
      href: "https://rive.app/marketplace/28142-53149-batter-up-bunny/",
      thumb: thumbBatterUpBunny,
    },
  ],
  [
    {
      title: "Audio Player",
      creator: "RiottersDesign",
      href: "https://rive.app/marketplace/28160-53178-audio-player/",
      thumb: thumbAudioPlayer,
    },
    {
      title: "Particles & physics - Football",
      creator: "Nclsvr",
      href: "https://rive.app/marketplace/27290-51530-particles-and-physics-football/",
      thumb: thumbParticlesAndPhysicsFootball,
    },
    {
      title: "A piano game",
      creator: "hiorey",
      href: "https://rive.app/marketplace/27375-51723-a-piano-game/",
      thumb: thumbAPianoGame,
    },
    {
      title: "A drag-to-spin rotary picker built in Rive (scripting + data binding)",
      creator: "onderk.",
      href: "https://rive.app/marketplace/28236-53335-a-drag-to-spin-rotary-picker-built-in-rive-scripting-da/",
      thumb: thumbADragToSpinRotaryPickerBuiltInRi,
    },
    {
      title: "Vintage Bike",
      creator: "fred-3374F",
      href: "https://rive.app/marketplace/27842-52603-vintage-bike/",
      thumb: thumbVintageBike,
    },
    {
      title: "Animojis",
      creator: "very_true_story",
      href: "https://rive.app/marketplace/27832-52591-animojis/",
      thumb: thumbAnimojis,
    },
  ],
  [
    {
      title: "Auto-wrapping pill menu",
      creator: "valshapova",
      href: "https://rive.app/marketplace/28124-53413-auto-wrapping-pill-menu/",
      thumb: thumbAutoWrappingPillMenu,
    },
    {
      title: "Maasai-Inspired Event Hero Banner Concept",
      creator: "novacraftcreatives",
      href: "https://rive.app/marketplace/27773-52471-maasai-inspired-event-hero-banner-concept/",
      thumb: thumbMaasaiInspiredEventHeroBannerCon,
    },
    {
      title: "Rumble Golf Challenge! [Mini-Game]",
      creator: "BradleyConners",
      href: "https://rive.app/marketplace/28184-53457-rumble-golf-challenge-mini-game/",
      thumb: thumbRumbleGolfChallengeMiniGame,
    },
    {
      title: "Messy Files",
      creator: "alexsmithdesigns.uk",
      href: "https://rive.app/marketplace/27239-51435-messy-files/",
      thumb: thumbMessyFiles,
    },
    {
      title: "Slot Machine Game with Scripting",
      creator: "TeamRive",
      href: "https://rive.app/marketplace/25759-48234-slot-machine-game-with-scripting/",
      thumb: thumbSlotMachineGameWithScripting,
    },
    {
      title: "Room Decor Mini Game",
      creator: "Fernandammarques",
      href: "https://rive.app/marketplace/25989-48561-room-decor-mini-game/",
      thumb: thumbRoomDecorMiniGame,
    },
  ],
];

/* Different negative delay per row so tile seams never align vertically across
   rows (fractions of --wall-duration: 0, ~1/3, ~2/3). */
const ROW_DELAYS = ["0s", "-25s", "-50s"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function Tile({ item, hidden }: { item: WallItem; hidden?: boolean }) {
  return (
    <a
      className="community-showcase__tile"
      href={item.href}
      target="_blank"
      rel="noopener"
      /* The seamless loop needs a second copy of every tile. Those copies are
         decorative duplicates: without this a keyboard user would tab through
         36 phantom links to cross an 18-file wall, and a screen reader would
         hear every credit twice. */
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
    >
      <img
        className="community-showcase__thumb"
        src={item.thumb}
        /* Empty alt on purpose: the title and creator below are real text in the
           same link, so describing the image too would say it all twice. */
        alt=""
        loading="lazy"
        width={280}
        height={184}
      />
      <span className="community-showcase__caption">
        <span className="community-showcase__title">{item.title}</span>
        <span className="community-showcase__creator">by {item.creator}</span>
      </span>
    </a>
  );
}

function Row({ items, delay }: { items: WallItem[]; delay: string }) {
  return (
    <div className="community-showcase__row">
      <div
        className="community-showcase__track"
        style={{ "--wall-delay": delay } as CSSProperties}
      >
        {/* Two back-to-back copies; translateX(-50%) advances exactly one. */}
        {items.map((item) => (
          <Tile key={item.href} item={item} />
        ))}
        {items.map((item) => (
          <Tile key={`dup-${item.href}`} item={item} hidden />
        ))}
      </div>
    </div>
  );
}

/**
 * The community work wall — the page's one deliberate full-bleed section. Three
 * counter-scrolling rows of real Featured marketplace files (middle row
 * reversed) that hard-cut at the viewport edges (no edge fade — that's what sets
 * it apart from LogoMarquee).
 *
 * Reduced motion is a render branch (not just a CSS media query): the moving
 * wall and the static grid are genuinely different DOM (36 tiles with duplicates
 * vs a contained 6-tile grid), so branching in JS keeps each markup honest
 * rather than shipping duplicate nodes to reduced-motion users.
 *
 * Hovering or focusing a row pauses that row — you cannot read a credit on a
 * moving tile, and the credit is the obligation.
 */
export function CommunityShowcase() {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <section className="community-showcase">
      <SectionHeader eyebrow="FROM THE COMMUNITY" title="Made with Rive" />

      {reduced ? (
        /* Static fallback: the first row, contained, with no duplicates. */
        <div className="community-showcase__grid">
          {ROWS[0].map((item) => (
            <Tile key={item.href} item={item} />
          ))}
        </div>
      ) : (
        <div
          className="community-showcase__wall"
          aria-label="Animations made with Rive by the community"
        >
          {ROWS.map((items, i) => (
            <Row key={i} items={items} delay={ROW_DELAYS[i]} />
          ))}
        </div>
      )}

      <a className="text-link" href={COMMUNITY_URL} target="_blank" rel="noopener">
        Explore the community →
      </a>
    </section>
  );
}

export default CommunityShowcase;
