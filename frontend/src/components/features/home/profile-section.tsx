import { Button } from "@/components/ui/button";

interface ProfileSectionProps {
  loggedIn: boolean;
  tripCount: number;
  onAction: () => void;
}

export function ProfileSection({ loggedIn, tripCount, onAction }: ProfileSectionProps) {
  return (
    <section className="bg-mango-400/70">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-lagoon-950 sm:text-4xl">
            Keep the budget in view while the days fill themselves in.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-lagoon-900/80">
            Pin spots from the map, set number of days and party size, and Suroy tallies an estimated cost per person as
            you go — grouped by beach days, food, and transport.
          </p>
        </div>

        <div className="shrink-0 text-left lg:text-right">
          <p className="text-sm font-semibold text-lagoon-900/70">
            {loggedIn ? "You have a planner waiting." : "Your trips live at /app — sign in first."}
          </p>
          <Button className="mt-3" onClick={onAction}>
            {loggedIn ? (tripCount ? `Open your ${tripCount} trip${tripCount === 1 ? "" : "s"}` : "Start your first trip") : "Create an account"}
          </Button>
        </div>
      </div>
    </section>
  );
}