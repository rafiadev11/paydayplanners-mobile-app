import type { SavingsContribution, SavingsGoal } from "@features/planning/api";

type Payday = NonNullable<SavingsGoal["contributions"]>[number];

export function savingsPaydays(
  recent: Payday[],
  planned: Payday[],
  history: SavingsContribution[],
): Payday[] {
  const recorded = new Set(
    history.map((entry) => String(entry.paycheck_occurrence_id)),
  );
  const unique = new Map<string, Payday>();
  for (const payday of [...recent, ...planned]) {
    const id = String(payday.paycheck_occurrence_id);
    if (!recorded.has(id) && !unique.has(id)) unique.set(id, payday);
  }
  return [...unique.values()];
}

export function mergeContributionPage(
  current: SavingsContribution[],
  next: SavingsContribution[],
) {
  const rows = new Map(current.map((entry) => [entry.id, entry]));
  for (const entry of next) rows.set(entry.id, entry);
  return [...rows.values()];
}
