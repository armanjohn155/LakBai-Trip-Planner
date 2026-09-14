interface TipsListProps {
  tips: string[];
}

export function TipsList({ tips }: TipsListProps) {
  return (
    <ol className="space-y-2.5">
      {tips.map((tip, index) => (
        <li key={index} className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surf-400/15 text-xs font-bold text-sea-600">
            {index + 1}
          </span>
          <p className="text-sm leading-relaxed text-ink-900">{tip}</p>
        </li>
      ))}
    </ol>
  );
}