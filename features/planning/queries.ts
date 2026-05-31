import {
  keepPreviousData,
  type QueryClient,
  useQuery,
} from "@tanstack/react-query";

import {
  fetchBillOccurrences,
  fetchBills,
  fetchDashboard,
  fetchForecast,
  fetchPaycheckOccurrences,
  fetchPaySchedules,
  fetchSavingsGoals,
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
  forecast: (scope: PlanningScope, days = DEFAULT_WINDOW_DAYS) =>
    [...scopeKey(scope), "forecast", days] as const,
  bills: (scope: PlanningScope) => [...scopeKey(scope), "bills"] as const,
  billOccurrences: (scope: PlanningScope, days = DEFAULT_WINDOW_DAYS) =>
    [...scopeKey(scope), "bill-occurrences", days] as const,
  paySchedules: (scope: PlanningScope) =>
    [...scopeKey(scope), "pay-schedules"] as const,
  paycheckOccurrences: (scope: PlanningScope, days = DEFAULT_WINDOW_DAYS) =>
    [...scopeKey(scope), "paycheck-occurrences", days] as const,
  savingsGoals: (scope: PlanningScope) =>
    [...scopeKey(scope), "savings-goals"] as const,
};

function enabled(scope: PlanningScope) {
  return Boolean(scope.userId);
}

export function useDashboardQuery(scope: PlanningScope) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: fetchDashboard,
    queryKey: planningKeys.dashboard(scope),
  });
}

export function useForecastQuery(
  scope: PlanningScope,
  days = DEFAULT_WINDOW_DAYS,
) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: () => fetchForecast(days),
    queryKey: planningKeys.forecast(scope, days),
  });
}

export function useBillsQuery(scope: PlanningScope) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: fetchBills,
    queryKey: planningKeys.bills(scope),
  });
}

export function useBillOccurrencesQuery(
  scope: PlanningScope,
  days = DEFAULT_WINDOW_DAYS,
) {
  return useQuery({
    enabled: enabled(scope),
    placeholderData: keepPreviousData,
    queryFn: () => fetchBillOccurrences(days),
    queryKey: planningKeys.billOccurrences(scope, days),
  });
}

export function usePaySchedulesQuery(scope: PlanningScope) {
  return useQuery({
    enabled: enabled(scope),
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
