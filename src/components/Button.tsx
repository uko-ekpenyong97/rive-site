import type { ButtonHTMLAttributes } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * Forces a visual state. Used ONLY by the showcase to document the hover
   * appearance — omit in normal use and let :hover handle it.
   */
  state?: "default" | "hover";
}

function Button({
  variant = "primary",
  state,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className="btn"
      data-variant={variant}
      data-state={state}
      {...rest}
    >
      {children}
    </button>
  );
}

export { Button };
export default Button;
