import { type BillInput, type PayScheduleInput } from "@features/planning/api";
import {
  isoDateFromInput,
  monthDayFromIsoDate,
  parseCurrencyInput,
  weekdayFromIsoDate,
} from "@shared/lib/format";
import { todayInAppTimezone } from "@shared/lib/timezone";

export const ONBOARDING_VERSION = 1;
export const MAX_STARTER_BILLS = 10;
export const MAX_CURRENCY_AMOUNT = 99999999.99;

export type OnboardingStep = "paycheck" | "bills" | "reveal";

export type PaycheckDraft = {
  name: string;
  amount: string;
  frequency: PayScheduleInput["frequency"];
  startDate: string;
  secondMonthDay: number;
};

export type StarterBillDraft = {
  id: string;
  templateKey: string;
  name: string;
  amount: string;
  frequency: BillInput["frequency"];
  startDate: string;
};

export type OnboardingDraft = {
  version: typeof ONBOARDING_VERSION;
  step: Exclude<OnboardingStep, "reveal">;
  paycheck: PaycheckDraft;
  bills: StarterBillDraft[];
};

export type StarterBillTemplate = {
  key: string;
  label: string;
  icon:
    | "home-outline"
    | "lightning-bolt-outline"
    | "water-outline"
    | "cellphone"
    | "wifi"
    | "car-outline"
    | "shield-check-outline"
    | "credit-card-outline"
    | "television-play"
    | "dots-horizontal-circle-outline";
};

export const STARTER_BILL_TEMPLATES: StarterBillTemplate[] = [
  { key: "housing", label: "Housing", icon: "home-outline" },
  {
    key: "electricity",
    label: "Electricity",
    icon: "lightning-bolt-outline",
  },
  { key: "water", label: "Water", icon: "water-outline" },
  { key: "phone", label: "Phone", icon: "cellphone" },
  { key: "internet", label: "Internet", icon: "wifi" },
  { key: "car", label: "Car payment", icon: "car-outline" },
  {
    key: "insurance",
    label: "Insurance",
    icon: "shield-check-outline",
  },
  {
    key: "credit-card",
    label: "Credit card",
    icon: "credit-card-outline",
  },
  {
    key: "subscription",
    label: "Subscription",
    icon: "television-play",
  },
  {
    key: "other",
    label: "Other",
    icon: "dots-horizontal-circle-outline",
  },
];

export function emptyOnboardingDraft(): OnboardingDraft {
  return {
    version: ONBOARDING_VERSION,
    step: "paycheck",
    paycheck: {
      name: "Main paycheck",
      amount: "",
      frequency: "biweekly",
      startDate: "",
      secondMonthDay: 31,
    },
    bills: [],
  };
}

export function starterBillFromTemplate(
  template: StarterBillTemplate,
  id: string,
): StarterBillDraft {
  return {
    id,
    templateKey: template.key,
    name: template.label,
    amount: "",
    frequency: "monthly",
    startDate: "",
  };
}

export function paycheckDraftErrors(paycheck: PaycheckDraft) {
  const errors: { amount?: string; startDate?: string; secondDay?: string } =
    {};
  const amount = parseCurrencyInput(paycheck.amount, 0.01);
  const startDate = isoDateFromInput(paycheck.startDate);

  if (!amount) errors.amount = "Enter the amount that normally reaches you.";
  if (amount && Number(amount) > MAX_CURRENCY_AMOUNT) {
    errors.amount = "Enter an amount below $100 million.";
  }
  if (!startDate) errors.startDate = "Choose your next pay date.";
  if (startDate && startDate < todayInAppTimezone()) {
    errors.startDate = "Choose today or a future pay date.";
  }

  if (
    paycheck.frequency === "semimonthly" &&
    startDate &&
    monthDayFromIsoDate(startDate) === paycheck.secondMonthDay
  ) {
    errors.secondDay = "Choose a different second pay day.";
  }

  return errors;
}

export function starterBillDraftErrors(bill: StarterBillDraft) {
  const errors: { name?: string; amount?: string; startDate?: string } = {};

  if (!bill.name.trim()) errors.name = "Give this bill a name.";
  const amount = parseCurrencyInput(bill.amount, 0.01);

  if (!amount) {
    errors.amount = "Enter the amount you expect.";
  } else if (Number(amount) > MAX_CURRENCY_AMOUNT) {
    errors.amount = "Enter an amount below $100 million.";
  }
  if (!isoDateFromInput(bill.startDate)) {
    errors.startDate = "Choose the next due date.";
  } else if (bill.startDate < todayInAppTimezone()) {
    errors.startDate = "Choose today or a future due date.";
  }

  return errors;
}

export function buildOnboardingPayload(draft: OnboardingDraft): {
  version: typeof ONBOARDING_VERSION;
  pay_schedule: PayScheduleInput;
  bills: BillInput[];
} {
  const startDate = isoDateFromInput(draft.paycheck.startDate)!;
  const payAmount = parseCurrencyInput(draft.paycheck.amount, 0.01)!;
  const paySchedule: PayScheduleInput = {
    name: draft.paycheck.name.trim() || "Main paycheck",
    amount: payAmount,
    frequency: draft.paycheck.frequency,
    start_date: startDate,
    is_active: true,
  };

  if (
    draft.paycheck.frequency === "weekly" ||
    draft.paycheck.frequency === "biweekly"
  ) {
    paySchedule.weekday = weekdayFromIsoDate(startDate);
    paySchedule.interval_value = draft.paycheck.frequency === "weekly" ? 1 : 2;
  }

  if (
    draft.paycheck.frequency === "monthly" ||
    draft.paycheck.frequency === "semimonthly"
  ) {
    paySchedule.month_day = monthDayFromIsoDate(startDate);
  }

  if (draft.paycheck.frequency === "semimonthly") {
    paySchedule.interval_value = draft.paycheck.secondMonthDay;
  }

  const bills = draft.bills.map((bill): BillInput => {
    const billStartDate = isoDateFromInput(bill.startDate)!;
    const input: BillInput = {
      name: bill.name.trim(),
      amount: parseCurrencyInput(bill.amount, 0.01)!,
      frequency: bill.frequency,
      start_date: billStartDate,
      is_active: true,
    };

    if (bill.frequency === "weekly" || bill.frequency === "biweekly") {
      input.weekday = weekdayFromIsoDate(billStartDate);
      input.interval_value = bill.frequency === "weekly" ? 1 : 2;
    }

    if (bill.frequency === "monthly") {
      input.due_day = monthDayFromIsoDate(billStartDate);
    }

    return input;
  });

  return { version: ONBOARDING_VERSION, pay_schedule: paySchedule, bills };
}
