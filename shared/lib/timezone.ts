const fallbackTimezone = "UTC";

let appTimezone = resolveDeviceTimezone();
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function resolveDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || fallbackTimezone;
}

function formatterFor(
  locale: string,
  options: Intl.DateTimeFormatOptions,
  timeZone = appTimezone,
) {
  const key = JSON.stringify({ locale, timeZone, options });

  let formatter = formatterCache.get(key);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      ...options,
      timeZone,
    });
    formatterCache.set(key, formatter);
  }

  return formatter;
}

function partsForTimezone(value: Date, timeZone = appTimezone) {
  return formatterFor(
    "en-CA",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    },
    timeZone,
  )
    .formatToParts(value)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }

      return parts;
    }, {});
}

export function getDeviceTimezone() {
  return resolveDeviceTimezone();
}

export function getAppTimezone() {
  return appTimezone;
}

export function setAppTimezone(timezone: string | null | undefined) {
  appTimezone = timezone || resolveDeviceTimezone();
}

export function formatInAppTimezone(
  value: Date,
  options: Intl.DateTimeFormatOptions,
) {
  return formatterFor("en-US", options).format(value);
}

export function formatWithTimezone(
  value: Date,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
) {
  return formatterFor("en-US", options, timeZone).format(value);
}

export function isoDateInAppTimezone(value: Date) {
  const parts = partsForTimezone(value);

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayInAppTimezone() {
  return isoDateInAppTimezone(new Date());
}

export function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function timeZoneOffsetMinutes(value: Date, timeZone = appTimezone) {
  const parts = partsForTimezone(value, timeZone);
  const utcTimestamp = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return (utcTimestamp - value.getTime()) / 60_000;
}

export function dateFromIsoInAppTimezone(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const utcGuess = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
  const offset = timeZoneOffsetMinutes(utcGuess);

  return new Date(utcGuess.getTime() - offset * 60_000);
}

export function dateAtTimeInAppTimezone(
  value: string | null | undefined,
  hour: number,
  minute = 0,
  offsetDays = 0,
) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const utcGuess = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day) + offsetDays,
      hour,
      minute,
      0,
    ),
  );
  const offset = timeZoneOffsetMinutes(utcGuess);

  return new Date(utcGuess.getTime() - offset * 60_000);
}
