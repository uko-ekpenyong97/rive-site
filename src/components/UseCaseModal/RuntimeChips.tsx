import { platformHref, type PlatformRef } from "../platformDocs";
import "./RuntimeChips.css";

export interface RuntimeChipsProps {
  runtimes: PlatformRef[];
  /** Labels the row for assistive tech (e.g. "Game UI runtimes"). */
  label: string;
}

/**
 * Platform coverage for the use case — spec §4.6.
 *
 * TWO KINDS OF CHIP, AND THE DIFFERENCE HAS TO BE TOTAL ON INTERACTION.
 * Most chips link to their platform's docs. One — "Embedded devices" — names a
 * category with no canonical destination, so it is deliberately not a link.
 *
 * The rule that matters: a chip that cannot be followed must not behave like one
 * that can. No pointer cursor, no hover accent, and NOT IN THE TAB ORDER — a
 * keyboard user who tabs onto something that does nothing when activated has
 * been told it is interactive by the focus ring itself. At rest the two can look
 * nearly identical (they are the same family of thing, and the row would read as
 * broken if one chip shouted); the moment anyone reaches for one, they diverge
 * completely. `platform: null` carries that intent from the content table down
 * to here, so "no link" is a stated decision rather than a missing field.
 */
export function RuntimeChips({ runtimes, label }: RuntimeChipsProps) {
  if (runtimes.length === 0) return null;

  return (
    <div className="runtime-chips">
      <span className="runtime-chips__label" id={`runtimes-${label}`}>
        Runs on
      </span>
      <ul className="runtime-chips__list" aria-labelledby={`runtimes-${label}`}>
        {runtimes.map((ref) => {
          const href = platformHref(ref);
          return (
            <li key={ref.label} className="runtime-chips__item">
              {href ? (
                /* Opens in a new tab, so the modal stays open behind the visit —
                   following a chip is a side trip, not a way out of the sheet. */
                <a
                  className="runtime-chips__chip"
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ref.label}
                </a>
              ) : (
                <span className="runtime-chips__chip" data-static="true">
                  {ref.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default RuntimeChips;
