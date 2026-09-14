import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Tone = "surf" | "mango" | "sea" | "neutral";

const toneClasses: Record<Tone, string> = {
  surf: "bg-surf-400/15 text-sea-600",
  mango: "bg-mango-400/20 text-lagoon-900",
  sea: "bg-sea-500/10 text-sea-600",
  neutral: "bg-sand-100 text-ink-600",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ tone = "neutral", className, children, ...props }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClasses[tone], className)} {...props}>
      {children}
    </span>
  );
}