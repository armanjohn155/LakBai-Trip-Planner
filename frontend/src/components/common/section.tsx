import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/cn";

interface SectionProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  headline?: string;
  intro?: string;
}

export function Section({ className, headline, intro, children, ...props }: SectionProps) {
  return (
    <section className={cn("mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20", className)} {...props}>
      {headline ? (
        <header className="mb-10 max-w-2xl">
          <h2 className="font-display text-3xl font-medium tracking-tight text-lagoon-900 sm:text-4xl">{headline}</h2>
          {intro ? <p className="mt-3 text-base leading-relaxed text-ink-600 sm:text-lg">{intro}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}