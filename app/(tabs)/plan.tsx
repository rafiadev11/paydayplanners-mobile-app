import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { BillingBanner } from "@features/billing/components";
import {
  fetchForecast,
  type ForecastPaycheck,
  type ForecastResponse,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatCurrency, formatDateWithYear } from "@shared/lib/format";
import {
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricTile,
  PrimaryButton,
  Row,
  ScreenHeader,
  SectionTitle,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

function statusTone(status: string) {
  switch (status) {
    case "paid":
    case "received":
      return "success" as const;
    case "overdue":
      return "danger" as const;
    case "skipped":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function paycheckTone(paycheck: ForecastPaycheck) {
  const remaining = Number(paycheck.remaining_amount);

  if (remaining < 0) return "warning" as const;
  if (remaining < 300) return "accent" as const;

  return "light" as const;
}

function forecastLabel(hasProAccess: boolean | undefined) {
  return hasProAccess ? "12-month forecast" : "90-day forecast";
}

export default function PlanScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeForecastLabel = forecastLabel(user?.billing?.has_pro_access);

  const loadForecast = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const payload = await fetchForecast(
          user?.billing?.has_pro_access ? 365 : 90,
        );
        setForecast(payload);
        setError(null);
      } catch (nextError) {
        setError(getApiErrorMessage(nextError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.billing?.has_pro_access],
  );

  useFocusEffect(
    useCallback(() => {
      void loadForecast();
    }, [loadForecast]),
  );

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void loadForecast(true);
          }}
          refreshing={refreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <ScreenHeader
        eyebrow="Forecast"
        subtitle={`A paycheck-by-paycheck timeline across your ${activeForecastLabel}, showing what gets covered, what stays free, and where risk builds.`}
        title="Plan"
      />

      {loading ? (
        <LoadingState label="Mapping bills and savings across upcoming pay periods." />
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void loadForecast();
          }}
          title="Forecast unavailable"
        />
      ) : forecast ? (
        <>
          {forecast.paychecks.length > 0 &&
          (forecast.bill_occurrences.length > 0 ||
            forecast.savings_goals.length > 0) ? (
            <BillingBanner billing={user?.billing} compact />
          ) : null}

          <SurfaceCard tone="accent">
            <SectionTitle
              subtitle={`${formatDateWithYear(forecast.window.start_date)} to ${formatDateWithYear(forecast.window.end_date)}`}
              title={activeForecastLabel}
            />
            <View style={styles.metricGrid}>
              <MetricTile
                label="Projected income"
                tone="dark"
                value={formatCurrency(forecast.summary.projected_income)}
              />
              <MetricTile
                label="Assigned"
                value={formatCurrency(forecast.summary.assigned_expenses_total)}
              />
              <MetricTile
                label="Savings"
                tone="success"
                value={formatCurrency(
                  forecast.summary.savings_goal_contributions_total,
                )}
              />
              <MetricTile
                label="Remaining"
                tone={
                  Number(forecast.summary.remaining_after_assigned) < 300
                    ? "warning"
                    : "light"
                }
                value={formatCurrency(
                  forecast.summary.remaining_after_assigned,
                )}
              />
            </View>
          </SurfaceCard>

          <SectionTitle
            action={
              <PrimaryButton
                icon="receipt-text-plus-outline"
                label="Add bill"
                onPress={() => {
                  router.push("/bills/new");
                }}
              />
            }
            subtitle="Each card shows how much of that paycheck is already spoken for."
            title="Paycheck timeline"
          />

          {forecast.paychecks.length ? (
            forecast.paychecks.map((paycheck) => (
              <SurfaceCard
                key={String(paycheck.id)}
                style={styles.paycheckCard}
                tone={paycheckTone(paycheck)}
              >
                <View style={styles.paycheckHeader}>
                  <View style={styles.paycheckHeaderCopy}>
                    <Text style={styles.paycheckName}>
                      {paycheck.pay_schedule?.name ?? "Paycheck"}
                    </Text>
                    <Text style={styles.paycheckDate}>
                      {formatDateWithYear(paycheck.occurrence_date)}
                    </Text>
                  </View>
                  <StatusBadge
                    label={paycheck.status}
                    tone={statusTone(paycheck.status)}
                  />
                </View>

                <Text style={styles.paycheckAmount}>
                  {formatCurrency(paycheck.effective_amount ?? paycheck.amount)}
                </Text>

                <View style={styles.paycheckMetrics}>
                  <View style={styles.paycheckMetric}>
                    <Text style={styles.paycheckMetricLabel}>Bill load</Text>
                    <Text style={styles.paycheckMetricValue}>
                      {formatCurrency(paycheck.assigned_total)}
                    </Text>
                  </View>
                  <View style={styles.paycheckMetric}>
                    <Text style={styles.paycheckMetricLabel}>Savings</Text>
                    <Text style={styles.paycheckMetricValue}>
                      {formatCurrency(paycheck.savings_goal_total)}
                    </Text>
                  </View>
                  <View style={styles.paycheckMetric}>
                    <Text style={styles.paycheckMetricLabel}>Left over</Text>
                    <Text style={styles.paycheckMetricValue}>
                      {formatCurrency(paycheck.remaining_amount)}
                    </Text>
                  </View>
                </View>

                {paycheck.assigned_bill_occurrences.length ? (
                  <View style={styles.assignmentList}>
                    {paycheck.assigned_bill_occurrences
                      .slice(0, 4)
                      .map((assignment) => (
                        <Row
                          key={String(assignment.allocation_id)}
                          badge={
                            <StatusBadge
                              label={
                                assignment.bill_occurrence.bill?.frequency ??
                                "bill"
                              }
                              tone="primary"
                            />
                          }
                          subtitle={`Due ${formatDateWithYear(assignment.bill_occurrence.due_date)}`}
                          title={
                            assignment.bill_occurrence.bill?.name ??
                            "Bill occurrence"
                          }
                          value={formatCurrency(assignment.allocation_amount)}
                        />
                      ))}
                    {paycheck.assigned_bill_occurrences.length > 4 ? (
                      <Text style={styles.moreLabel}>
                        +{paycheck.assigned_bill_occurrences.length - 4} more
                        allocations on this paycheck
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </SurfaceCard>
            ))
          ) : (
            <EmptyState
              body="Add a paycheck to see how the planner distributes your bills across the forecast window."
              title="No paychecks in range"
            />
          )}

          <SurfaceCard>
            <SectionTitle
              subtitle="Anything here still needs a paycheck assignment or manual split."
              title="Unfunded items"
            />
            {forecast.unassigned_bill_occurrences.length ? (
              forecast.unassigned_bill_occurrences
                .slice(0, 6)
                .map((bill) => (
                  <Row
                    key={String(bill.id)}
                    badge={<StatusBadge label={bill.status} tone="danger" />}
                    subtitle={`Due ${formatDateWithYear(bill.due_date)}`}
                    title={bill.bill?.name ?? "Bill occurrence"}
                    value={formatCurrency(bill.unfunded_amount ?? bill.amount)}
                    valueTone="danger"
                  />
                ))
            ) : (
              <EmptyState
                body="Every visible bill in this window is already backed by income."
                title="Nothing uncovered"
              />
            )}
          </SurfaceCard>
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  paycheckCard: {
    gap: theme.spacing.lg,
  },
  paycheckHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  paycheckHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  paycheckName: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  paycheckDate: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  paycheckAmount: {
    color: theme.colors.ink,
    ...theme.typography.metric,
  },
  paycheckMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.42),
    padding: theme.spacing.md,
  },
  paycheckMetric: {
    flex: 1,
    minWidth: 88,
    gap: 4,
  },
  paycheckMetricLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  paycheckMetricValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  assignmentList: {
    gap: theme.spacing.md,
  },
  moreLabel: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
