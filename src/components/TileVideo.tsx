import { useEffect, useRef } from "react";
import type { TileMedia } from "./UseCaseModal/useCaseContent";
import { usePrefersReducedMotion } from "./UseCaseModal/usePrefersReducedMotion";
import "./TileVideo.css";

/**
 * How far ahead of the viewport a tile starts fetching. A loading knob, not a
 * feel parameter — the bento sits far below the hero, so this buys a tile time
 * to have its first frame ready without ever competing with LCP.
 */
const PREROLL_MARGIN = "200px";

export interface TileVideoProps {
  media: TileMedia;
  /**
   * Forces the reduced-motion still. Used by the showcase to document that
   * state — omit in normal use and let the OS preference decide.
   */
  reducedMotion?: boolean;
}

/**
 * The autoplaying loop behind a CLOSED bento tile (BentoCell's `media` slot).
 *
 * THREE THINGS THIS IS BUILT AROUND:
 *
 * 1. NOTHING IS FETCHED OFF-SCREEN. The element is always rendered — so the
 *    markup is server-renderable and a no-JS visitor still gets the poster — but
 *    `src` is withheld until an IntersectionObserver says the tile is near the
 *    viewport, and assigned exactly once. A `<video>` with a poster and no src
 *    paints the poster and requests nothing. Scrolling away pauses it: no
 *    decode work for pixels nobody is looking at, the same idle rule the modal
 *    heroes follow.
 *
 * 2. REDUCED MOTION GETS NO VIDEO ELEMENT AT ALL, not a paused one. An `<img>`
 *    of the poster means the .mp4 is never even a candidate for fetching, which
 *    `preload` alone could not guarantee.
 *
 * 3. NO PLAY AFFORDANCE. Clicking the cell opens the modal; it never plays this
 *    video. A ▸ glyph would therefore promise an interaction that cannot happen
 *    — the same house rule that keeps a hover hint off a paused canvas. The
 *    still is marked with a quiet "MOTION PAUSED" label instead, which states
 *    what is true without offering a control.
 *
 * The whole thing is `aria-hidden`: the cell's accessible name comes from its
 * own eyebrow/title/description text, and this is the illustration behind it.
 * That is also load-bearing — the section suite asserts the bento markup carries
 * no `aria-label` anywhere, because one would override that computed name
 * (WCAG 2.5.3 Label in Name).
 */
export function TileVideo({ media, reducedMotion }: TileVideoProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const systemReduce = usePrefersReducedMotion();
  const reduce = reducedMotion ?? systemReduce;

  useEffect(() => {
    const box = boxRef.current;
    const video = videoRef.current;
    if (!box || !video || reduce) return;

    const load = () => {
      /* Assign once. The getter returns an absolute URL after the first set, so
         an empty string is an honest "never requested". */
      if (!video.src) video.src = media.src;
      void video.play().catch(() => {
        /* Autoplay refusal is not an error worth surfacing — the poster stands
           in, which is the same thing a reduced-motion visitor sees. */
      });
    };

    if (typeof IntersectionObserver === "undefined") {
      load();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) load();
          else video.pause();
        }
      },
      { rootMargin: PREROLL_MARGIN },
    );
    io.observe(box);
    return () => io.disconnect();
  }, [media.src, reduce]);

  /* Trims chrome burnt into a source frame (film-tv is a browser-window
     capture). Zoom to close the gap the trim opens, then shift so the surviving
     band re-centres: content point p lands at 0.5 + zoom·(p − 0.5) + shift, and
     the band we want to keep is centred on (top + 1 − bottom) / 2.
     The percentage is deliberate here, unlike the modal sheet's vh travel:
     translateY(%) resolves against the element's own height, and this element is
     locked to the media box, so the box IS the intended reference frame. */
  const zoom = media.crop
    ? 1 / (1 - media.crop.top - media.crop.bottom)
    : undefined;
  const shift =
    media.crop && zoom
      ? (zoom * (media.crop.bottom - media.crop.top)) / 2
      : undefined;

  const mediaStyle = {
    objectPosition: media.objectPosition,
    ...(zoom !== undefined && shift !== undefined
      ? {
          "--tile-zoom": zoom.toFixed(4),
          "--tile-shift": `${(shift * 100).toFixed(3)}%`,
        }
      : {}),
  } as React.CSSProperties;

  return (
    <div
      className="tile-video"
      data-motion={reduce ? "reduced" : "full"}
      ref={boxRef}
      aria-hidden="true"
    >
      {reduce ? (
        <>
          {/* Same style as the video: the poster is the same footage, so it
              needs the same crop and anchor — otherwise the still would be the
              one place the burnt-in chrome survives. */}
          <img
            className="tile-video__media"
            src={media.poster}
            style={mediaStyle}
            alt=""
          />
          <span className="tile-video__paused">MOTION PAUSED</span>
        </>
      ) : (
        <video
          ref={videoRef}
          className="tile-video__media"
          poster={media.poster}
          style={mediaStyle}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        />
      )}
    </div>
  );
}

export default TileVideo;
