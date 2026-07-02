import "./SectionHeader.css";

export interface SectionHeaderProps {
  eyebrow: string;
  title: string;
}

export function SectionHeader({ eyebrow, title }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <span className="section-header__eyebrow">{eyebrow}</span>
      <h2 className="section-header__title">{title}</h2>
    </header>
  );
}

export default SectionHeader;
