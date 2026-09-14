import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface CarouselEdgeFadeProps {
  side: "left" | "right";
  hidden: boolean;
  onClick: () => void;
}

export function CarouselEdgeFade({ side, hidden, onClick }: CarouselEdgeFadeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      tabIndex={hidden ? -1 : 0}
      className={cn(
        "absolute inset-y-0 z-10 flex w-16 items-center justify-center transition-opacity duration-300 sm:w-24",
        side === "left"
          ? "left-0 bg-gradient-to-r from-lagoon-950/25 via-lagoon-950/5 to-transparent"
          : "right-0 bg-gradient-to-l from-lagoon-950/25 via-lagoon-950/5 to-transparent",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      {side === "left" ? (
        <ChevronLeftIcon className="h-6 w-6 text-sand-50 drop-shadow-md" />
      ) : (
        <ChevronRightIcon className="h-6 w-6 text-sand-50 drop-shadow-md" />
      )}
    </button>
  );
}