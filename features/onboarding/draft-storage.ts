import {
  ONBOARDING_VERSION,
  type OnboardingDraft,
} from "@features/onboarding/model";
import { onboardingDraftsStorage } from "@shared/storage/secure";

type DraftIndex = Record<string, OnboardingDraft>;
const PAY_FREQUENCIES = new Set([
  "weekly",
  "biweekly",
  "semimonthly",
  "monthly",
  "once",
]);
const BILL_FREQUENCIES = new Set([
  "weekly",
  "biweekly",
  "monthly",
  "yearly",
  "once",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOnboardingDraft(value: unknown): value is OnboardingDraft {
  if (!isRecord(value) || value.version !== ONBOARDING_VERSION) return false;
  if (value.step !== "paycheck" && value.step !== "bills") return false;
  if (!isRecord(value.paycheck) || !Array.isArray(value.bills)) return false;

  const paycheck = value.paycheck;
  const paycheckIsValid =
    typeof paycheck.name === "string" &&
    typeof paycheck.amount === "string" &&
    typeof paycheck.frequency === "string" &&
    PAY_FREQUENCIES.has(paycheck.frequency) &&
    typeof paycheck.startDate === "string" &&
    typeof paycheck.secondMonthDay === "number";

  const billsAreValid =
    value.bills.length <= 10 &&
    value.bills.every(
      (bill) =>
        isRecord(bill) &&
        typeof bill.id === "string" &&
        typeof bill.templateKey === "string" &&
        typeof bill.name === "string" &&
        typeof bill.amount === "string" &&
        typeof bill.frequency === "string" &&
        BILL_FREQUENCIES.has(bill.frequency) &&
        typeof bill.startDate === "string",
    );

  return paycheckIsValid && billsAreValid;
}

function parseDrafts(raw: string | null): DraftIndex {
  if (!raw) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as DraftIndex) : {};
  } catch {
    return {};
  }
}

export async function loadOnboardingDraft(userId: number | string) {
  const drafts = parseDrafts(await onboardingDraftsStorage.get());
  const draft = drafts[String(userId)];

  return isOnboardingDraft(draft) ? draft : null;
}

export async function saveOnboardingDraft(
  userId: number | string,
  draft: OnboardingDraft,
) {
  const drafts = parseDrafts(await onboardingDraftsStorage.get());
  drafts[String(userId)] = draft;
  await onboardingDraftsStorage.set(JSON.stringify(drafts));
}

export async function clearOnboardingDraft(userId: number | string) {
  const drafts = parseDrafts(await onboardingDraftsStorage.get());
  delete drafts[String(userId)];

  if (Object.keys(drafts).length === 0) {
    await onboardingDraftsStorage.clear();
    return;
  }

  await onboardingDraftsStorage.set(JSON.stringify(drafts));
}
