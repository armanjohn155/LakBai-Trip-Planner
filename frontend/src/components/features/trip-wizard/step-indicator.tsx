import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const STEPS = [
  { step: 1, label: "Details" },
  { step: 2, label: "Itinerary" },
  { step: 3, label: "Review" },
];

interface StepIndicatorProps {
  current: number;
  maxStep: number;
  onSelect: (step: number) => void;
}

export function StepIndicator({ current, maxStep, onSelect }: StepIndicatorProps) {
  return (
    <nav aria-label="Trip wizard steps" className="flex items-center gap-2">
      {STEPS.map(({ step, label }, index) => {
        const state = step > current ? "future" : step === current ? "active" : "done";
        const reachable = step <= maxStep;
        return (
          <div key={step} className="flex items-center gap-2">
            {index > 0 ? (
              <span className={cn("h-0.5 w-5 rounded-full sm:w-8", current >= step ? "bg-surf-400" : "bg-line")} />
            ) : null}
            <button
              type="button"
              className="group flex items-center gap-2"
              onClick={() => reachable && onSelect(step)}
              disabled={!reachable}
              aria-current={state === "active" ? "step" : undefined}
              aria-label={`Step ${step}: ${label}`}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  state === "active" && "bg-surf-400 text-lagoon-950 ring-4 ring-surf-400/25",
                  state === "done" && "bg-sea-500 text-sand-50",
                  state === "future" && "bg-sand-100 text-ink-600 ring-1 ring-inset ring-line",
                  reachable && state !== "active" && "group-hover:ring-2 group-hover:ring-surf-400/50",
                )}
              >
                {state === "done" ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  <span className="font-display text-sm font-semibold">{step}</span>
                )}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-semibold sm:inline",
                  state === "active" ? "text-lagoon-900" : state === "done" ? "text-sea-600" : "text-ink-600",
                )}
              >
                {label}
              </span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}