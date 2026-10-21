import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

interface ActivitiesListProps {
  activities: string[];
  variant?: "solid" | "outline";
}

export function ActivitiesList({ activities, variant = "solid" }: ActivitiesListProps) {
  return (
    <ul className="flex flex-wrap gap-2">
      {activities.map((activity) => (
        <li
          key={activity}
          className={cn(
            "rounded-full font-medium text-lagoon-900",
            variant === "outline"
              ? "inline-flex items-center gap-1.5 border border-line px-3 py-1.5 text-[13px]"
              : "bg-sand-100 px-3.5 py-1.5 text-sm ring-1 ring-inset ring-line",
          )}
        >
          {variant === "outline" ? <CheckIcon className="h-3.5 w-3.5 text-sea-600" /> : null}
          {activity}
        </li>
      ))}
    </ul>
  );
}
