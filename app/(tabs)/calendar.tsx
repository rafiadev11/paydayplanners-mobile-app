import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import {
  buildDayMap,
  buildMonthSummary,
  hasAnyActivity,
  paycheckBounds,
  type CalendarDayMap,
} from "@features/calendar/calendar-data";
import { DayDetail } from "@features/calendar/day-detail";
import { MonthGrid } from "@features/calendar/month-grid";
import { MonthSummaryCard } from "@features/calendar/month-summary-card";
import { useForecastWindowQuery } from "@features/planning/queries";
import { forecastWindowForMonth } from "@features/planning/window";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  addMonths,
  compareMonths,
  monthKeyOf,
  monthLabel,
  startOfMonthIso,
} from "@shared/lib/month";
import { todayInAppTimezone } from "@shared/lib/timezone";
import {
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenHeader,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

/** How far back the calendar will look, so the fetched window cannot balloon. */
const HISTORY_LIMIT_MONTHS = 12;

export default function CalendarScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const planningRevision = usePlanningRevision();
  const scope = { revision: planningRevision, userId: user?.id };

  const today = todayInAppTimezone();
  const currentMonth = monthKeyOf(today);

  const [visibleMonth, setVisibleMonth] = useState(currentMonth);
  const [selectedDate, setSelectedDate] = useState(today);

  /**
   * The window starts at the earliest month being looked at — never later than
   * this month, so the days already gone by in the current month still render.
   * Paging forward inside the span costs no request; only stepping into the past
   * moves the anchor and refetches.
   */
  const anchorMonth =
    compareMonths(visibleMonth, currentMonth) < 0 ? visibleMonth : currentMonth;

  const forecastWindow = useMemo(
    () => forecastWindowForMonth(anchorMonth),
    [anchorMonth],
  );

  const forecastQuery = useForecastWindowQuery(scope, forecastWindow);
  useRefetchStaleOnFocus(forecastQuery);

  const forecast = forecastQuery.data;

  const days = useMemo<CalendarDayMap>(
    () => (forecast ? buildDayMap(forecast) : new Map()),
    [forecast],
  );

  const summary = useMemo(
    () => buildMonthSummary(days, visibleMonth),
    [days, visibleMonth],
  );

  const bounds = useMemo(
    () => (forecast ? paycheckBounds(forecast) : { first: null, last: null }),
    [forecast],
  );

  const historyFloor = addMonths(currentMonth, -HISTORY_LIMIT_MONTHS);
  const canGoBack = compareMonths(visibleMonth, historyFloor) > 0;

  // Keep the day detail inside the month on screen.
  const goToMonth = useCallback(
    (nextMonth: string) => {
      setVisibleMonth(nextMonth);
      setSelectedDate(
        nextMonth === currentMonth ? today : startOfMonthIso(nextMonth),
      );
    },
    [currentMonth, today],
  );

  const stepMonth = useCallback(
    (delta: number) => {
      goToMonth(addMonths(visibleMonth, delta));
    },
    [goToMonth, visibleMonth],
  );

  const jumpToToday = useCallback(() => {
    setVisibleMonth(currentMonth);
    setSelectedDate(today);
  }, [currentMonth, today]);

  // Tapping a leading/trailing cell follows it into its own month.
  const selectDate = useCallback(
    (date: string) => {
      const month = monthKeyOf(date);

      if (month !== visibleMonth) {
        setVisibleMonth(month);
      }

      setSelectedDate(date);
    },
    [visibleMonth],
  );

  const refresh = useCallback(() => {
    void forecastQuery.refetch();
  }, [forecastQuery]);

  const loading = forecastQuery.isPending && !forecast;
  const refreshing = forecastQuery.isRefetching && !forecastQuery.isPending;
  /**
   * Stepping into the past moves the window, and `keepPreviousData` holds the
   * old forecast on screen — which has no data for the month now being shown.
   * Fade it while the new window lands rather than implying the month is empty.
   */
  const settling = forecastQuery.isPlaceholderData && forecastQuery.isFetching;

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          onRefresh={refresh}
          refreshing={refreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <ScreenHeader
        subtitle="Every paycheck and bill, on the day it happens."
        title="Calendar"
      />

      {loading ? (
        <LoadingState label="Loading your calendar…" />
      ) : forecastQuery.isError ? (
        <ErrorState
          body={getApiErrorMessage(forecastQuery.error)}
          onRetry={refresh}
          title="We could not load your calendar"
        />
      ) : forecast && !hasAnyActivity(forecast) ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            body="Add the money coming in and the bills going out, and every date will fill in here."
            title="Nothing on the calendar yet"
          />
          <PrimaryButton
            label="Add income"
            onPress={() => {
              router.push("/pay-schedules/new");
            }}
          />
        </View>
      ) : forecast ? (
        <View
          style={[styles.content, settling ? styles.contentSettling : null]}
        >
          <MonthGrid
            canGoBack={canGoBack}
            days={days}
            monthKey={visibleMonth}
            onJumpToToday={jumpToToday}
            onSelectDate={selectDate}
            onStepMonth={stepMonth}
            selectedDate={selectedDate}
            today={today}
          />

          <DayDetail
            bounds={bounds}
            date={selectedDate}
            day={days.get(selectedDate)}
            days={days}
            onChanged={refresh}
            today={today}
          />

          <MonthSummaryCard
            summary={summary}
            title={
              visibleMonth === currentMonth
                ? "This month"
                : monthLabel(visibleMonth)
            }
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    gap: theme.spacing.md,
  },
  content: {
    gap: theme.spacing.lg,
  },
  contentSettling: {
    opacity: 0.45,
  },
});
