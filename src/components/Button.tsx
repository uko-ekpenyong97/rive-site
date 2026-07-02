import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

interface CommonProps {
  variant?: ButtonVariant;
  /**
   * Forces a visual state. Used ONLY by the showcase to document the hover
   * appearance — omit in normal use and let :hover handle it.
   */
  state?: "default" | "hover";
}

export type ButtonProps =
  | (CommonProps &
      ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string });

function Button({ variant = "primary", state, children, ...rest }: ButtonProps) {
  // When an href is provided the button renders as a semantic anchor, so CTAs
  // can navigate without nesting interactive elements.
  if ("href" in rest && rest.href !== undefined) {
    const anchorProps = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a className="btn" data-variant={variant} data-state={state} {...anchorProps}>
        {children}
      </a>
    );
  }

  const buttonProps = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button className="btn" data-variant={variant} data-state={state} {...buttonProps}>
      {children}
    </button>
  );
}

export { Button };
export default Button;
