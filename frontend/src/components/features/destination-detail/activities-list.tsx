import { cn } from "@/lib/cn";

interface ActivitiesListProps {
  activities: string[];
}

export function ActivitiesList({ activities }: ActivitiesListProps) {
  return (
    <ul className="flex flex-wrap gap-2">
      {activities.map((activity) => (
        <li
          key={activity}
          className={cn(
            "rounded-full bg-sand-100 px-3.5 py-1.5 text-sm font-medium text-lagoon-900 ring-1 ring-inset ring-line",
          )}
        >
          {activity}
        </li>
      ))}
    </ul>
  );
}