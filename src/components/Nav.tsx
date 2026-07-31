import { RiveButton } from "./RiveButton";
import { GET_STARTED_CAT } from "./riveSiteAssets";
import "./Nav.css";

const LINKS = ["Product", "Use cases", "Developers", "Community", "Pricing"];

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav__left">
        <a className="nav__wordmark" href="/">
          RIVE
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
