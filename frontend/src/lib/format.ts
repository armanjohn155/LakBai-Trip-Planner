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

const compact = new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 });

export const formatCompactNumber = (value: number): string => compact.format(value);