import type { TransportOption } from "@/components/features/destination-detail/destination-facts";
import { Badge } from "@/components/ui/badge";

interface TransportListProps {
  options: TransportOption[];
}

export function TransportList({ options }: TransportListProps) {
  return (
    <ul className="divide-y divide-line">
      {options.map((option) => (
        <li key={`${option.mode}-${option.origin}`} className="grid gap-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <Badge className="w-fit shrink-0" tone="surf">
            {option.mode}
          </Badge>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-lagoon-900">{option.origin}</p>
            <p className="text-xs text-ink-600">{option.duration}</p>
          </div>
          <p className="text-sm font-semibold text-sea-600 sm:text-right">{option.price}</p>
        </li>
      ))}
    </ul>
  );
}