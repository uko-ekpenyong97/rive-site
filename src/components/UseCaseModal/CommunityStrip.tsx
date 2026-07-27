import type { CommunityItem } from "./useCaseContent";
import "./CommunityStrip.css";

export interface CommunityStripProps {
  items: CommunityItem[];
  /** Completes the group label, e.g. "Game UI". */
  label: string;
}

/**
 * Marketplace files, credited and linked — spec §4.5.
 *
 * These links are deliberately allowed exits: sending someone to a community file
 * is conversion-adjacent, not a bounce, which is the opposite of the seven
 * outbound use-case links this whole system replaced.
 *
 * Every item is CC BY, so the credit is a licence obligation rather than a
 * courtesy. Thumbnails are committed locally instead of hot-linked: the strip
 * stays self-contained, and CC BY plus a rendered credit makes a local copy
 * legitimate.
 */
export function CommunityStrip({ items, label }: CommunityStripProps) {
  if (items.length === 0) return null;

  return (
    <section className="community-strip" aria-labelledby={`community-${label}`}>
      <h3 className="community-strip__label" id={`community-${label}`}>
        Built by the community
      </h3>

      <ul className="community-strip__grid">
        {items.map((item) => (
          <li key={item.href} className="community-strip__item">
            <a className="community-strip__link" href={item.href} target="_blank" rel="noreferrer">
              <img
                className="community-strip__thumb"
                src={item.thumb}
                /* The link text already names the file, so an alt would be read
                   twice. Empty alt keeps it out of the accessible name. */
                alt=""
                loading="lazy"
                decoding="async"
              />
              <span className="community-strip__title">{item.title}</span>
              <span className="community-strip__creator">by {item.creator}</span>
              {/* Appended to the name rather than replacing it with aria-label —
                  the visible title must stay in the accessible name (WCAG 2.5.3).
                  Carries the full contributor list where a file has several. */}
              <span className="community-strip__hint">
                {item.credits ? `— ${item.credits}` : ""} — {item.license}, on the
                Rive community
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default CommunityStrip;
