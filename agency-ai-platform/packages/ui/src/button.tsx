import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { tokens } from "./tokens";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "ghost";
};

export function Button({
  children,
  variant = "primary",
  style,
  ...rest
}: ButtonProps) {
  const base: CSSProperties = {
    fontFamily: tokens.font.sans,
    fontWeight: 600,
    fontSize: "0.95rem",
    borderRadius: tokens.radius.md,
    padding: "0.65rem 1.1rem",
    border: "1px solid transparent",
    cursor: rest.disabled ? "not-allowed" : "pointer",
    transition: "background-color 160ms ease, color 160ms ease, border-color 160ms ease",
  };

  const variants: Record<NonNullable<ButtonProps["variant"]>, CSSProperties> = {
    primary: {
      background: tokens.color.accent,
      color: "#ffffff",
    },
    ghost: {
      background: "transparent",
      color: tokens.color.ink,
      borderColor: tokens.color.border,
    },
  };

  return (
    <button type="button" style={{ ...base, ...variants[variant], ...style }} {...rest}>
      {children}
    </button>
  );
}
