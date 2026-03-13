const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyPreciseFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dateYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

function parseDateValue(value: string) {
  const isoDate = isoDateFromInput(value);

  if (isoDate) {
    return new Date(`${isoDate}T00:00:00`);
  }

  return new Date(value);
}

export function formatCurrency(value: string | number | null | undefined) {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatCurrencyPrecise(
  value: string | number | null | undefined,
) {
  return currencyPreciseFormatter.format(Number(value ?? 0));
}

export function normalizeCurrencyInput(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");

  if (!cleaned) return "";

  const [integerPart = "", ...decimalParts] = cleaned.split(".");
  const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
  const normalizedDecimals = decimalParts.join("").slice(0, 2);

  if (!cleaned.includes(".")) {
    return normalizedInteger;
  }

  return `${normalizedInteger}.${normalizedDecimals}`;
}

export function parseCurrencyInput(value: string, minimum = 0) {
  const normalized = normalizeCurrencyInput(value);

  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < minimum) return null;

  return parsed.toFixed(2);
}

export function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(parseDateValue(value)) : "Not scheduled";
}

export function formatDateWithYear(value: string | null | undefined) {
  return value
    ? dateYearFormatter.format(parseDateValue(value))
    : "Not scheduled";
}

export function formatLongWeekday(value: string | null | undefined) {
  return value ? weekdayFormatter.format(parseDateValue(value)) : "Flexible";
}

export function formatFrequency(value: string | null | undefined) {
  if (!value) return "Flexible";

  switch (value) {
    case "biweekly":
      return "Biweekly";
    case "monthly":
      return "Monthly";
    case "weekly":
      return "Weekly";
    case "once":
      return "One-time";
    default:
      return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

export function firstName(fullName: string | null | undefined) {
  if (!fullName) return "there";

  return fullName.trim().split(/\s+/)[0] || "there";
}

export function formatInteger(value: string | number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function isoDateFromInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null;
}

export function weekdayFromIsoDate(value: string) {
  const normalized = isoDateFromInput(value);

  if (!normalized) return null;

  return new Date(`${normalized}T00:00:00`).getDay();
}

export function monthDayFromIsoDate(value: string) {
  const normalized = isoDateFromInput(value);

  if (!normalized) return null;

  return new Date(`${normalized}T00:00:00`).getDate();
}

export function dateFromIso(value: string | null | undefined) {
  const normalized = isoDateFromInput(value ?? "");

  if (!normalized) return null;

  return new Date(`${normalized}T00:00:00`);
}

export function isoDateFromDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
