const currencyFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

export function formatDate(isoDate: string): string {
  return dateFormatter.format(new Date(isoDate));
}

const ORDINAL_SUFFIXES: Record<Intl.LDMLPluralRule, string> = {
  one: "st",
  two: "nd",
  few: "rd",
  other: "th",
  zero: "th",
  many: "th",
};

const ordinalRules = new Intl.PluralRules("en", { type: "ordinal" });

export function formatOrdinal(value: number): string {
  return `${value}${ORDINAL_SUFFIXES[ordinalRules.select(value)]}`;
}

export function formatEnrichment(providersTried: number): string {
  return `FullEnrich (waterfall, ${formatOrdinal(providersTried)} provider)`;
}
