import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-2xl bg-white ring-1 ring-line shadow-[0_1px_2px_rgba(7,31,37,0.06)]", className)} {...props}>
      {children}
    </div>
  );
}