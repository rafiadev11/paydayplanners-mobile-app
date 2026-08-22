import { parseCurrencyInput } from "@shared/lib/format";

import { type BillOccurrenceStatus } from "./api";

export type BillOccurrenceAdjustmentDraft = {
  amount: string;
  dueDate: string;
  status: BillOccurrenceStatus;
};

export type BillOccurrenceAdjustmentErrors = {
  amount?: string;
  dueDate?: string;
};

export function validateBillOccurrenceAdjustment(
  draft: BillOccurrenceAdjustmentDraft,
): BillOccurrenceAdjustmentErrors {
  const errors: BillOccurrenceAdjustmentErrors = {};

  if (parseCurrencyInput(draft.amount) === null) {
    errors.amount = "Enter a valid payment amount.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) {
    errors.dueDate = "Choose a valid due date.";
  }

  return errors;
}

export function billOccurrenceAdjustmentSignature(
  draft: BillOccurrenceAdjustmentDraft,
  planningRevision: number,
) {
  return [
    parseCurrencyInput(draft.amount) ?? "invalid",
    draft.dueDate,
    draft.status,
    planningRevision,
  ].join("|");
}

export function billOccurrenceDraftIsAdjusted(
  draft: BillOccurrenceAdjustmentDraft,
  scheduledAmount: string,
  scheduledDueDate: string,
) {
  return (
    Number(parseCurrencyInput(draft.amount) ?? 0) !== Number(scheduledAmount) ||
    draft.dueDate !== scheduledDueDate
  );
}

export function billOccurrenceDraftHasChanges(
  draft: BillOccurrenceAdjustmentDraft,
  effectiveAmount: string,
  effectiveDueDate: string,
  currentStatus: BillOccurrenceStatus,
) {
  return (
    Number(parseCurrencyInput(draft.amount) ?? 0) !== Number(effectiveAmount) ||
    draft.dueDate !== effectiveDueDate ||
    draft.status !== currentStatus
  );
}
