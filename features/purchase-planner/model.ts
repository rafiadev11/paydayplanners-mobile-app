import {
  type PurchasePlanInput,
  type PurchasePlanPreview,
  type PurchasePlanVerdict,
} from "@features/planning/api";
import { isoDateFromInput, parseCurrencyInput } from "@shared/lib/format";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";

const MAX_PURCHASE_AMOUNT = 99_999_999.99;

export type PurchasePlanDraft = {
  name: string;
  amount: string;
  targetDate: string;
  minimumCushion: string;
};

export type PurchasePlanDraftErrors = Partial<
  Record<keyof PurchasePlanDraft, string>
>;

function validIsoCalendarDate(value: string) {
  const normalized = isoDateFromInput(value);

  if (!normalized) return null;

  const parsed = new Date(`${normalized}T00:00:00Z`);

  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : null;
}

function normalizedMoney(value: string, minimum: number) {
  if (value.trim().startsWith("-")) return null;

  const normalized = parseCurrencyInput(value, minimum);

  return normalized !== null && Number(normalized) <= MAX_PURCHASE_AMOUNT
    ? normalized
    : null;
}

export function normalizePurchasePlannerCushion(value: string) {
  return normalizedMoney(value || "0", 0);
}

export function validatePurchasePlanDraft(
  draft: PurchasePlanDraft,
): PurchasePlanDraftErrors {
  const errors: PurchasePlanDraftErrors = {};
  const amount = normalizedMoney(draft.amount, 0.01);
  const cushion = normalizePurchasePlannerCushion(draft.minimumCushion);
  const targetDate = validIsoCalendarDate(draft.targetDate);
  const today = todayInAppTimezone();

  if (!draft.name.trim()) errors.name = "Name what you are planning for.";
  if (draft.name.trim().length > 255) {
    errors.name = "Keep the purchase name under 256 characters.";
  }
  if (!amount) errors.amount = "Enter an amount greater than zero.";
  if (!targetDate) {
    errors.targetDate = "Choose a valid purchase date.";
  } else if (targetDate < today) {
    errors.targetDate = "Choose today or a future date.";
  } else if (targetDate > addDaysToIsoDate(today, 365)) {
    errors.targetDate = "Choose a date within the next year.";
  }
  if (draft.minimumCushion && cushion === null) {
    errors.minimumCushion = "Enter a valid cushion or use zero.";
  }

  return errors;
}

export function buildPurchasePlanInput(
  draft: PurchasePlanDraft,
  planningRevision: number,
): PurchasePlanInput | null {
  if (Object.keys(validatePurchasePlanDraft(draft)).length > 0) return null;

  const amount = normalizedMoney(draft.amount, 0.01);
  const cushion = normalizePurchasePlannerCushion(draft.minimumCushion);
  const targetDate = validIsoCalendarDate(draft.targetDate);

  if (!amount || cushion === null || !targetDate || planningRevision < 1) {
    return null;
  }

  return {
    name: draft.name.trim(),
    amount,
    target_date: targetDate,
    minimum_cushion: cushion,
    expected_planning_revision: planningRevision,
  };
}

export function purchasePlanSignature(
  input: PurchasePlanInput | null,
): string | null {
  if (!input) return null;

  return JSON.stringify([
    input.name,
    input.amount,
    input.target_date,
    input.minimum_cushion,
    input.expected_planning_revision,
  ]);
}

type VerdictContent = {
  eyebrow: string;
  title: string;
  body: string;
  tone: "accent" | "warning" | "dark";
};

const VERDICT_COPY: Record<PurchasePlanVerdict, VerdictContent> = {
  fits_comfortably: {
    eyebrow: "Fits comfortably",
    title: "This purchase fits your plan",
    body: "Your bills and current savings stay in place, with your chosen cushion still available.",
    tone: "accent",
  },
  fits_tight: {
    eyebrow: "Fits, but tight",
    title: "You can add it without going short",
    body: "The purchase keeps the paycheck non-negative, but it uses part of the cushion you wanted to protect.",
    tone: "warning",
  },
  save_across_paychecks: {
    eyebrow: "A savings path works",
    title: "Set it aside before purchase day",
    body: "A dated savings goal can reserve the amount while keeping each eligible paycheck above your cushion.",
    tone: "accent",
  },
  choose_later_date: {
    eyebrow: "Give it more time",
    title: "A later date fits better",
    body: "The requested date would push at least one paycheck below your cushion.",
    tone: "warning",
  },
  plan_needs_attention: {
    eyebrow: "Plan needs attention",
    title: "Fix the current plan first",
    body: "A paycheck or bill is already uncovered, so this preview cannot make a reliable recommendation yet.",
    tone: "warning",
  },
  add_income_first: {
    eyebrow: "Income needed",
    title: "Add an upcoming paycheck first",
    body: "Purchase Planner needs a future paycheck to show where this amount would land.",
    tone: "dark",
  },
};

export function purchaseVerdictContent(
  preview: Pick<PurchasePlanPreview, "verdict">,
) {
  return VERDICT_COPY[preview.verdict];
}

export function shouldShowPurchaseSavingPath(
  preview: Pick<PurchasePlanPreview, "verdict">,
  contributionCount: number,
) {
  return (
    contributionCount > 0 &&
    ["save_across_paychecks", "choose_later_date"].includes(preview.verdict)
  );
}
