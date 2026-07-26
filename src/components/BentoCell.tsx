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
  /**
   * Opens the use-case modal instead of navigating (spec §3): the whole cell
   * becomes the trigger and the `+` signpost appears. `href` is kept as the
   * no-JS / middle-click fallback, and the real navigation to the use-case page
   * moves inside the modal as the escape valve.
   */
  onExpand?: () => void;
  /** Completes the trigger's label: "Explore {expandLabel}". */
  expandLabel?: string;
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
  onExpand,
  expandLabel,
  onClick,
  ...rest
}: BentoCellProps) {
  const expands = onExpand !== undefined;
  /* Only a real URL is worth escaping to. While the use-case pages are still
     placeholders (`#`), a modified or middle click would otherwise open a new
     tab of the page you are already on. */
  const hasDestination = href !== "" && !href.startsWith("#");

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (!expands || event.defaultPrevented) return;
    // Let modified clicks open the real page in a new tab/window, when there is one.
    if (
      hasDestination &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    ) {
      return;
    }
    event.preventDefault();
    onExpand();
  };

  /* Middle click fires auxclick, not click, so it bypasses handleClick and would
     natively open the href. Suppress it when there is nowhere real to go. */
  const handleAuxClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (expands && !hasDestination) event.preventDefault();
  };

  return (
    <a
      className="bento-cell"
      data-size={size}
      data-featured={featured || undefined}
      data-state={state}
      data-expands={expands || undefined}
      href={href}
      aria-haspopup={expands ? "dialog" : undefined}
      onClick={handleClick}
      onAuxClick={handleAuxClick}
      {...rest}
    >
      <div className="bento-cell__content">
        <span className="bento-cell__eyebrow">{eyebrow}</span>
        <span className="bento-cell__title">{title}</span>
        {description && (
          <span className="bento-cell__description">{description}</span>
        )}
        {/* The arrow reads as "navigates away", so expanding cells drop it —
            the `+` below is the signpost instead. */}
        {!expands && <span className="bento-cell__arrow">→</span>}
      </div>
      <div className="bento-cell__media">
        {media ?? (
          /* Dev placeholder — hidden from the accessible name, which would
             otherwise read "…MEDIA" out loud on every cell. */
          <span className="bento-cell__placeholder" aria-hidden="true">
            MEDIA
          </span>
        )}
      </div>
      {expands && (
        <>
          <span className="bento-cell__expand" aria-hidden="true">
            +
          </span>
          {/* Appended to the name computed from the cell's own text rather than
              replacing it with aria-label — the visible title and description
              must stay in the accessible name (WCAG 2.5.3 Label in Name). */}
          <span className="bento-cell__hint">
            — Explore {expandLabel ?? title}
          </span>
        </>
      )}
    </a>
  );
}

export { BentoCell };
export default BentoCell;
