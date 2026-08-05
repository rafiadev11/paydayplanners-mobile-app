import {
  keepPreviousData,
  type QueryClient,
  useQuery,
} from "@tanstack/react-query";

import {
  fetchBills,
  fetchDashboard,
  fetchForecastWindow,
  fetchPaycheckOccurrences,
  fetchPaySchedules,
  fetchSavingsGoals,
  type ForecastWindow,
} from "@features/planning/api";
import { API_BASE_URL } from "@shared/lib/env";
import { getAppTimezone, todayInAppTimezone } from "@shared/lib/timezone";

const DEFAULT_WINDOW_DAYS = 365;

type PlanningScope = {
  revision: number;
  userId?: number | string | null;
};

function scopeKey({ revision, userId }: PlanningScope) {
  return [
    "planning",
    API_BASE_URL,
    getAppTimezone(),
    String(userId ?? "guest"),
    revision,
    todayInAppTimezone(),
  ] as const;
}

export const planningKeys = {
  all: (scope: PlanningScope) => scopeKey(scope),
  dashboard: (scope: PlanningScope) =>
    [...scopeKey(scope), "dashboard"] as const,
  forecastWindow: (scope: PlanningScope, window: ForecastWindow) =>
    [
      ...scopeKey(scope),
      "forecast-window",
      window.start_date,
      window.end_date,
    ] as const,
  bills: (scope: PlanningScope) => [...scopeKey(scope), "bills"] as const,
  paySchedules: (scope: PlanningScope) =>
    [...scopeKey(scope), "pay-schedules"] as const,
  paycheckOccurrences: (scope: PlanningScope, days = DEFAULT_WINDOW_DAYS) =>
    [...scopeKey(scope), "paycheck-occurrences", days] as const,
  savingsGoals: (scope: PlanningScope) =>
    [...scopeKey(scope), "savings-goals"] as const,
};

type QueryGate = {
  enabled?: boolean;
};

function enabled(scope: PlanningScope, gate?: QueryGate) {
  return Boolean(scope.userId) && gate?.enabled !== false;
}

export function useDashboardQuery(scope: PlanningScope) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: fetchDashboard,
    queryKey: planningKeys.dashboard(scope),
  });
}

export function useForecastWindowQuery(
  scope: PlanningScope,
  window: ForecastWindow,
) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: () => fetchForecastWindow(window),
    queryKey: planningKeys.forecastWindow(scope, window),
  });
}

export function useBillsQuery(scope: PlanningScope, gate?: QueryGate) {
  return useQuery({
    enabled: enabled(scope, gate),
    placeholderData: keepPreviousData,
    queryFn: fetchBills,
    queryKey: planningKeys.bills(scope),
  });
}

export function usePaySchedulesQuery(scope: PlanningScope, gate?: QueryGate) {
  return useQuery({
    enabled: enabled(scope, gate),
    placeholderData: keepPreviousData,
    queryFn: fetchPaySchedules,
    queryKey: planningKeys.paySchedules(scope),
  });
}

export function usePaycheckOccurrencesQuery(
  scope: PlanningScope,
  days = DEFAULT_WINDOW_DAYS,
) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: () => fetchPaycheckOccurrences(days),
    queryKey: planningKeys.paycheckOccurrences(scope, days),
  });
}

export function useSavingsGoalsQuery(scope: PlanningScope) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: fetchSavingsGoals,
    queryKey: planningKeys.savingsGoals(scope),
  });
}

export function prefetchPlanningQueries(
  queryClient: QueryClient,
  scope: PlanningScope,
) {
  if (!enabled(scope)) return Promise.resolve();

  return Promise.allSettled([
    queryClient.prefetchQuery({
      queryFn: fetchDashboard,
      queryKey: planningKeys.dashboard(scope),
    }),
  ]).then(() => undefined);
}
