import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FunctionComponent,
  type SVGProps,
} from "react";
import SectionHeader from "./SectionHeader";
import Spotify from "../assets/logos/spotify.svg?react";
import LinkedIn from "../assets/logos/linkedin.svg?react";
import Duolingo from "../assets/logos/duolingo.svg?react";
import Brilliant from "../assets/logos/brilliant.svg?react";
import spotifyPoster from "../assets/case-studies/spotify-poster.avif";
import linkedinPoster from "../assets/case-studies/linkedin-poster.avif";
import duolingoPoster from "../assets/case-studies/duolingo-poster.avif";
import brilliantPoster from "../assets/case-studies/brilliant-poster.avif";
import "./CaseStudies.css";

interface Stat {
  value: string;
  label: string;
}

interface Story {
  id: string;
  Svg: FunctionComponent<SVGProps<SVGSVGElement>>;
  /* Optical cap-height normalization for the ~18px row wordmark (see marquee). */
  scale: number;
  claim: string;
  stats: Stat[];
  poster: string;
  /**
   * Optional crop anchor for the poster. The slot is far wider than the 16:9
   * source, so `cover` trims top and bottom — set this (e.g. "center 30%") when
   * a poster's subject sits away from the middle. Left unset = center, which is
   * the CSS default; fixing a bad crop is meant to be a data edit, not a patch.
   */
  objectPosition?: string;
  url: string;
}

/* Every COLLAPSED row carries a complete, self-sufficient claim — the message
   lands with zero clicks; expansion is reward, not the only route. Spotify (the
   first story) ships expanded by default. */
const STORIES: Story[] = [
  {
    id: "spotify",
    Svg: Spotify,
    scale: 1,
    claim: "Spotify built Wrapped 2025 with Rive.",
    stats: [
      { value: "300M+", label: "users engaged" },
      { value: "630M+", label: "shares" },
      { value: "#1", label: "biggest subscriber day in Spotify history" },
    ],
    poster: spotifyPoster,
    url: "https://rive.app/blog/spotify-used-rive-for-spotify-wrapped-2025",
  },
  {
    id: "linkedin",
    Svg: LinkedIn,
    scale: 1,
    claim: "LinkedIn personalized its first Year in Review for millions with Rive.",
    stats: [
      { value: "207,360", label: "possible user journeys" },
      { value: "3", label: "languages" },
      { value: "1", label: "file, built entirely in Rive by BUCK" },
    ],
    poster: linkedinPoster,
    url: "https://rive.app/blog/linkedin-year-in-review-2025-built-with-rive",
  },
  {
    id: "duolingo",
    Svg: Duolingo,
    scale: 1,
    claim: "Duolingo turned Lily into an AI-powered conversation partner with Rive.",
    stats: [
      { value: "Real-time", label: "AI conversation" },
      { value: "<1MB", label: "full character file" },
      { value: "40+", label: "languages of lip sync at scale" },
    ],
    poster: duolingoPoster,
    url: "https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life",
  },
  {
    id: "brilliant",
    Svg: Brilliant,
    scale: 1,
    claim: "Brilliant motivates millions of learners with Rive.",
    stats: [
      { value: "Millions", label: "of learners" },
      { value: "1 file", label: "across iOS, Android & web" },
      { value: "Rive > Lottie", label: "in their engineering comparison" },
    ],
    poster: brilliantPoster,
    url: "https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations",
  },
];

interface StoryRowProps {
  story: Story;
  isOpen: boolean;
  isLast: boolean;
  onToggle: () => void;
}

function StoryRow({ story, isOpen, isLast, onToggle }: StoryRowProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Measure the panel's natural height for the max-height animation target.
  // The inner element keeps its layout box even while the panel is clipped to
  // 0 and visibility:hidden, so this stays accurate in both states and tracks
  // reflow (font load, viewport resize) via ResizeObserver.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const panelId = `case-study-panel-${story.id}`;
  const buttonId = `case-study-button-${story.id}`;
  const { Svg } = story;

  return (
    <div className="case-study" data-last={isLast || undefined}>
      <button
        type="button"
        id={buttonId}
        className="case-study__header"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span
          className="case-study__logo"
          style={{ "--logo-scale": story.scale } as CSSProperties}
        >
          <Svg className="case-study__svg" aria-hidden="true" focusable="false" />
        </span>
        <span className="case-study__claim">{story.claim}</span>
        <span className="case-study__toggle" aria-hidden="true">
          +
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className="case-study__panel"
        data-expanded={isOpen}
        style={{ maxHeight: isOpen ? contentHeight : 0 }}
      >
        <div className="case-study__panel-inner" ref={contentRef}>
          {/* Empty alt: the row's own claim already names the company in visible
              text, so a descriptive alt would announce the brand twice. */}
          <img
            className="case-study__poster"
            src={story.poster}
            alt=""
            loading="lazy"
            decoding="async"
            style={
              story.objectPosition
                ? { objectPosition: story.objectPosition }
                : undefined
            }
          />

          <div className="case-study__stats">
            {story.stats.map((stat) => (
              <div key={stat.label} className="case-study__stat">
                <span className="case-study__stat-value">{stat.value}</span>
                <span className="case-study__stat-label">{stat.label}</span>
              </div>
            ))}
          </div>

          <a
            className="text-link"
            href={story.url}
            target="_blank"
            rel="noopener"
          >
            Read the story →
          </a>
        </div>
      </div>
    </div>
  );
}

export function CaseStudies() {
  // Exclusive expand: one row open at a time. Clicking the open row's own
  // button collapses it (null). Spotify open on first paint.
  const [openId, setOpenId] = useState<string | null>(STORIES[0].id);

  return (
    <section className="case-studies">
      <SectionHeader eyebrow="CASE STUDIES" title="Milestones built in Rive" />

      <div className="case-studies__list">
        {STORIES.map((story, i) => (
          <StoryRow
            key={story.id}
            story={story}
            isOpen={openId === story.id}
            isLast={i === STORIES.length - 1}
            onToggle={() =>
              setOpenId((cur) => (cur === story.id ? null : story.id))
            }
          />
        ))}
      </div>
    </section>
  );
}

export default CaseStudies;
