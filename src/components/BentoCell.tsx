import type { AnchorHTMLAttributes, ReactNode } from "react";
import "./BentoCell.css";

export type BentoCellSize = "small" | "wide" | "large";

export interface BentoCellProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "media"> {
  size?: BentoCellSize;
  featured?: boolean;
  eyebrow: string;
  title: string;
  description?: string;
  href: string;
  media?: ReactNode;
  /**
   * Forces a visual state. Used ONLY by the showcase to document the hover
   * appearance — omit in normal use and let :hover handle it.
   */
  state?: "default" | "hover";
}

function BentoCell({
  size = "small",
  featured,
  eyebrow,
  title,
  description,
  href,
  media,
  state,
  ...rest
}: BentoCellProps) {
  return (
    <a
      className="bento-cell"
      data-size={size}
      data-featured={featured || undefined}
      data-state={state}
      href={href}
      {...rest}
    >
      <div className="bento-cell__content">
        <span className="bento-cell__eyebrow">{eyebrow}</span>
        <span className="bento-cell__title">{title}</span>
        {description && (
          <span className="bento-cell__description">{description}</span>
        )}
        <span className="bento-cell__arrow">→</span>
      </div>
      <div className="bento-cell__media">
        {media ?? <span className="bento-cell__placeholder">MEDIA</span>}
      </div>
    </a>
  );
}

export { BentoCell };
export default BentoCell;
