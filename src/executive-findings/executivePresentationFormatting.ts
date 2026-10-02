export function formatWeight(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(parsed * 100)}%` : value;
}

export function formatContribution(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : value;
}
