import { type PaycheckOccurrence } from "@features/planning/api";

/**
 * Which paycheck will pay a bill due on a given date.
 *
 * The rule mirrors `AssignBillOccurrencesToPaychecksAction`: the most recent
 * non-skipped paycheck landing **on or before** the due date. Not the nearest
 * one — money that arrives the day after a bill is due cannot pay it.
 */
export type Coverage =
  | { kind: "covered"; paycheckDate: string }
  | { kind: "before-first"; firstPaycheckDate: string }
  | { kind: "no-income" };

/** Dates income actually lands on, ascending. Skipped paychecks pay nothing. */
export function activePaycheckDates(paychecks: PaycheckOccurrence[]) {
  return paychecks
    .filter((paycheck) => paycheck.status !== "skipped")
    .map((paycheck) => paycheck.occurrence_date)
    .sort((left, right) => left.localeCompare(right));
}

export function coverageForDueDate(
  dueDate: string,
  paychecks: PaycheckOccurrence[],
): Coverage {
  const dates = activePaycheckDates(paychecks);

  if (dates.length === 0) {
    return { kind: "no-income" };
  }

  let covering: string | null = null;

  for (const date of dates) {
    if (date <= dueDate) {
      covering = date;
      continue;
    }

    break;
  }

  if (covering) {
    return { kind: "covered", paycheckDate: covering };
  }

  return { kind: "before-first", firstPaycheckDate: dates[0] };
}
