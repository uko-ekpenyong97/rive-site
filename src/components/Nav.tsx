import { RiveButton } from "./RiveButton";
import { GET_STARTED_CAT } from "./riveSiteAssets";
import { RIVE_MARK_PATH, RIVE_MARK_VIEWBOX } from "./riveWordmark";
import "./Nav.css";

const LINKS = ["Product", "Use cases", "Developers", "Community", "Pricing"];

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav__left">
        {/* The R mark, not the word — the same trade rive.app's own nav makes.
            The link carries the name; the drawing is decorative, so it is hidden
            from the accessibility tree rather than announced twice. */}
        <a className="nav__wordmark" href="/" aria-label="Rive — home">
          <svg
            className="nav__mark"
            viewBox={RIVE_MARK_VIEWBOX}
            fill="currentColor"
            aria-hidden="true"
          >
            <path fillRule="evenodd" clipRule="evenodd" d={RIVE_MARK_PATH} />
          </svg>
        </a>
        <ul className="nav__links">
          {LINKS.map((label) => (
            <li key={label}>
              <a className="nav__link" href="#">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="nav__right">
        <a className="nav__talk" href="#">
          Talk to us
        </a>
        {/* The cat leans toward the cursor across five zones — the live site's
            nav CTA, carried forward. Its 269×150 artboard sits mostly in the
            overflow above this button, so the nav row reserves no extra height
            for it (see RiveButton). */}
        <RiveButton
          asset={GET_STARTED_CAT}
          label="Get started"
          href="https://editor.rive.app"
          variant="primary"
          className="nav__cta"
        />
      </div>
    </nav>
  );
}

export default Nav;
