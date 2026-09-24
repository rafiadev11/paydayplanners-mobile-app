/**
 * How many times a cadence lands in an average month. Weekly and biweekly use
 * the yearly count so a 5-payday month does not skew the figure.
 */
const MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 52 / 12,
  semimonthly: 2,
  monthly: 1,
  yearly: 1 / 12,
};

/**
 * A recurring amount expressed as its monthly equivalent. One-time and unknown
 * cadences contribute nothing — they are not part of a typical month.
 */
export function monthlyEquivalent(
  amount: string | number | null | undefined,
  frequency: string | null | undefined,
  intervalValue?: number | null,
) {
  const multiplier = frequency ? MONTHLY_MULTIPLIER[frequency] : undefined;

  if (typeof multiplier !== "number") {
    return 0;
  }

  // A weekly rule with `interval_value: 2` fires fortnightly, not weekly.
  // The server stores weekly intervals in weeks. For semimonthly income,
  // interval_value is the second payday, not a recurrence multiplier.
  const interval =
    frequency === "biweekly"
      ? Math.max(2, intervalValue ?? 2)
      : frequency === "weekly"
        ? Math.max(1, intervalValue ?? 1)
        : 1;

  return (Number(amount ?? 0) * multiplier) / interval;
}

export function monthlyTotal<T>(
  items: T[],
  toParts: (item: T) => {
    amount: string | number | null | undefined;
    frequency: string | null | undefined;
    intervalValue?: number | null;
  },
) {
  return items.reduce((total, item) => {
    const { amount, frequency, intervalValue } = toParts(item);

    return total + monthlyEquivalent(amount, frequency, intervalValue);
  }, 0);
}
