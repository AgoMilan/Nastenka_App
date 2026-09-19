import * as React from "react";
import { cn } from "@/shared/utils/cn";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => {
    const variantStyles = {
      primary: "bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm",
      secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
      outline: "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
    }[variant];

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantStyles,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
