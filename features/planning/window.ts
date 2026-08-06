import { type ForecastWindow } from "@features/planning/api";
import {
  addMonths,
  endOfMonthIso,
  monthKeyOf,
  startOfMonthIso,
} from "@shared/lib/month";
import { todayInAppTimezone } from "@shared/lib/timezone";

/** How far ahead a forecast window reaches from its anchor month. */
export const FORECAST_SPAN_MONTHS = 12;

/**
 * Anchoring at the start of a month — rather than at today, the way
 * `buildWindow` does — is what lets the calendar render the days already gone
 * by in the current month.
 */
export function forecastWindowForMonth(monthKey: string): ForecastWindow {
  const anchor = monthKeyOf(monthKey);

  return {
    start_date: startOfMonthIso(anchor),
    end_date: endOfMonthIso(addMonths(anchor, FORECAST_SPAN_MONTHS)),
  };
}

/**
 * The window anchored at the current month. Screens that only need "what does
 * my income look like from here" should use this: it produces the same query
 * key the Calendar tab uses, so the data is usually already cached.
 */
export function currentForecastWindow(): ForecastWindow {
  return forecastWindowForMonth(monthKeyOf(todayInAppTimezone()));
}
