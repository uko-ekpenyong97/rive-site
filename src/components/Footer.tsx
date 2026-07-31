import FooterMark from "./FooterMark";
import "./Footer.css";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

const COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Editor", href: "https://editor.rive.app" },
      { label: "Pricing", href: "#" },
      { label: "Downloads", href: "#" },
      { label: "What's new", href: "#" },
    ],
  },
  {
    title: "Use cases",
    links: [
      { label: "Product UI", href: "#" },
      { label: "Game UI", href: "#" },
      { label: "Automotive", href: "#" },
      { label: "Campaigns", href: "#" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "https://rive.app/docs" },
      { label: "Runtimes", href: "#" },
      { label: "GitHub", href: "https://github.com/rive-app" },
      { label: "Scripting", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Community", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div className="footer__brand">
          <span className="footer__wordmark">RIVE</span>
          <span className="footer__tagline">
            The interactive graphics engine.
          </span>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} className="footer__col">
            <span className="footer__col-title">{col.title}</span>
            {col.links.map((link) => (
              <a key={link.label} className="footer__link" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        ))}
      </div>

      <div className="footer__attribution">
        © 2026 — A redesign study by Uko Ekpenyong. Not affiliated with Rive.
      </div>

      {/* Last thing on the page. */}
      <FooterMark />
    </footer>
  );
}

export default Footer;
