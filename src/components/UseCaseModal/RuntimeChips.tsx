import "./RuntimeChips.css";

export interface RuntimeChipsProps {
  runtimes: string[];
  /** Labels the row for assistive tech (e.g. "Game UI runtimes"). */
  label: string;
}

/** Platform coverage for the use case — spec §4.6. */
export function RuntimeChips({ runtimes, label }: RuntimeChipsProps) {
  if (runtimes.length === 0) return null;

  return (
    <div className="runtime-chips">
      <span className="runtime-chips__label" id={`runtimes-${label}`}>
        Runs on
      </span>
      <ul className="runtime-chips__list" aria-labelledby={`runtimes-${label}`}>
        {runtimes.map((runtime) => (
          <li key={runtime} className="runtime-chips__chip">
            {runtime}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RuntimeChips;
