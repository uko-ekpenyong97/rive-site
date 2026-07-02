import Button from "./Button";
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
        <Button variant="primary" href="https://editor.rive.app">
          Open editor
        </Button>
      </div>
    </nav>
  );
}

export default Nav;
