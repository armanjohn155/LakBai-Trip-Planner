import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "sand" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-surf-400 text-lagoon-950 hover:bg-surf-300 active:bg-surf-400",
  secondary: "bg-transparent text-sea-500 ring-1 ring-inset ring-line hover:bg-sand-100",
  ghost: "bg-transparent text-sand-50 hover:bg-white/10",
  sand: "bg-sand-50 text-lagoon-900 hover:bg-white",
  dark: "bg-lagoon-900 text-sand-50 hover:bg-lagoon-800 active:bg-lagoon-900",
  danger: "bg-transparent text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}