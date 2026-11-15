const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export const formatMoney = (value: number | string | null | undefined): string => {
  const amount = typeof value === "string" ? Number(value) : value;
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return peso.format(0);
  }
  return peso.format(amount);
};

export const toNumber = (value: number | string | null | undefined): number => {
  const amount = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(amount) ? (amount as number) : 0;
};

export const pluralise = (count: number, singular: string, plural?: string): string =>
  `${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

/** Short, human-friendly age for the last GPS ping shown in the party list. */
export const relativeTime = (iso: string | null): string => {
  if (iso === null) return "No ping yet";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "No ping yet";
  if (ms < 15_000) return "just now";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1_000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
};

const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

export const formatCompactNumber = (value: number): string => compact.format(value);