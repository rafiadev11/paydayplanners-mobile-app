import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { BillingBanner } from "@features/billing/components";
import {
  fetchBills,
  fetchDashboard,
  fetchPaySchedules,
  type BillOccurrence,
  type DashboardResponse,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  firstName,
  formatCurrency,
  formatDate,
  formatDateWithYear,
} from "@shared/lib/format";
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
  SecondaryButton,
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

function balanceTone(amount: string | number | null | undefined) {
  const numeric = Number(amount ?? 0);

  if (numeric < 0) return "warning" as const;
  if (numeric < 300) return "warning" as const;

  return "success" as const;
}

function goalSubtitle(
  targetDate: string | null | undefined,
  contributionAmount?: string | null,
) {
  if (targetDate) {
    return `Target ${formatDateWithYear(targetDate)}`;
  }

  if (contributionAmount) {
    return `Open-ended · ${formatCurrency(contributionAmount)} per paycheck`;
  }

  return "Open-ended goal";
}

function BillList({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: BillOccurrence[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (!items.length) {
    return <EmptyState body={emptyBody} title={emptyTitle} />;
  }

  return (
    <SurfaceCard>
      {items.slice(0, 4).map((item) => (
        <Row
          key={String(item.id)}
          badge={
            <StatusBadge
              label={item.status.replace("_", " ")}
              tone={statusTone(item.status)}
            />
          }
          subtitle={`Due ${formatDateWithYear(item.due_date)}`}
          title={item.bill?.name ?? "Bill occurrence"}
          value={formatCurrency(item.effective_amount ?? item.amount)}
          valueTone={item.status === "overdue" ? "danger" : "default"}
        />
      ))}
    </SurfaceCard>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [payScheduleCount, setPayScheduleCount] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCreateSavingsGoal =
    Boolean(user?.billing?.has_pro_access) ||
    (dashboard?.savings_goals.length ?? 0) < 1;
  const canCreatePaySchedule =
    Boolean(user?.billing?.has_pro_access) || payScheduleCount < 1;
  const canCreateBill =
    Boolean(user?.billing?.has_pro_access) || billCount < 12;

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [payload, schedules, bills] = await Promise.all([
          fetchDashboard(),
          fetchPaySchedules(),
          fetchBills(),
        ]);
        setDashboard(payload);
        setPayScheduleCount(schedules.length);
        setBillCount(bills.length);
        setError(null);
      } catch (nextError) {
        setError(getApiErrorMessage(nextError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void loadDashboard(true);
          }}
          refreshing={refreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <ScreenHeader
        eyebrow="Cashflow Command"
        right={
          <SecondaryButton
            icon="logout"
            label="Log out"
            onPress={() => {
              void signOut();
            }}
          />
        }
        subtitle="Every paycheck has a clear job before it lands."
        title={`Welcome back, ${firstName(user?.name)}`}
      />

      {loading ? (
        <LoadingState label="Building your current paycheck picture." />
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void loadDashboard();
          }}
          title="Dashboard unavailable"
        />
      ) : dashboard ? (
        <>
          <SurfaceCard tone="dark" style={styles.heroCard}>
            <StatusBadge
              label={`${formatDate(dashboard.window.start_date)} to ${formatDate(dashboard.window.end_date)}`}
              tone="accent"
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroLabel}>Left from your next paycheck</Text>
              <Text style={styles.heroValue}>
                {formatCurrency(
                  dashboard.next_paycheck?.remaining_amount ??
                    dashboard.summary.remaining_after_assigned,
                )}
              </Text>
              <Text style={styles.heroSubtle}>
                {dashboard.next_paycheck
                  ? `${dashboard.next_paycheck.pay_schedule?.name ?? "Upcoming paycheck"} lands ${formatDateWithYear(dashboard.next_paycheck.occurrence_date)}.`
                  : "Add a paycheck and a few bills to unlock a full forecast."}
              </Text>
            </View>

            <View style={styles.heroActions}>
              <PrimaryButton
                icon={canCreatePaySchedule ? "cash-plus" : "crown-outline"}
                label={canCreatePaySchedule ? "Add paycheck" : "Unlock Pro"}
                onPress={() => {
                  router.push(
                    canCreatePaySchedule ? "/pay-schedules/new" : "/billing",
                  );
                }}
              />
              <SecondaryButton
                icon={
                  canCreateBill ? "receipt-text-plus-outline" : "crown-outline"
                }
                label={canCreateBill ? "Add bill" : "Unlock Pro"}
                onPress={() => {
                  router.push(canCreateBill ? "/bills/new" : "/billing");
                }}
              />
            </View>

            {dashboard.next_paycheck ? (
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Assigned</Text>
                  <Text style={styles.heroStatValue}>
                    {formatCurrency(dashboard.next_paycheck.assigned_total)}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Savings</Text>
                  <Text style={styles.heroStatValue}>
                    {formatCurrency(dashboard.next_paycheck.savings_goal_total)}
                  </Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Paycheck</Text>
                  <Text style={styles.heroStatValue}>
                    {formatCurrency(
                      dashboard.next_paycheck.effective_amount ??
                        dashboard.next_paycheck.amount,
                    )}
                  </Text>
                </View>
              </View>
            ) : null}
          </SurfaceCard>

          {dashboard.next_paycheck &&
          (dashboard.next_paycheck_bill_occurrences.length > 0 ||
            dashboard.bills_due_before_next_paycheck.length > 0 ||
            dashboard.unassigned_bill_occurrences.length > 0 ||
            dashboard.savings_goals.length > 0) ? (
            <BillingBanner billing={user?.billing} compact />
          ) : null}

          <View style={styles.metricGrid}>
            <MetricTile
              label="Projected income"
              tone="dark"
              value={formatCurrency(dashboard.summary.projected_income)}
            />
            <MetricTile
              label="Assigned bills"
              value={formatCurrency(dashboard.summary.assigned_bills_total)}
            />
            <MetricTile
              label="Savings planned"
              tone="success"
              value={formatCurrency(
                dashboard.summary.savings_goal_contributions_total,
              )}
            />
            <MetricTile
              label="Unassigned"
              tone="warning"
              value={formatCurrency(dashboard.summary.unassigned_bills_total)}
            />
          </View>

          <SurfaceCard>
            <SectionTitle
              subtitle="The next income event and how much pressure it is carrying."
              title="Next paycheck"
            />
            {dashboard.next_paycheck ? (
              <>
                <Row
                  badge={
                    <StatusBadge
                      label={dashboard.next_paycheck.status}
                      tone={statusTone(dashboard.next_paycheck.status)}
                    />
                  }
                  subtitle={formatDateWithYear(
                    dashboard.next_paycheck.occurrence_date,
                  )}
                  title={
                    dashboard.next_paycheck.pay_schedule?.name ??
                    "Upcoming paycheck"
                  }
                  value={formatCurrency(
                    dashboard.next_paycheck.effective_amount ??
                      dashboard.next_paycheck.amount,
                  )}
                />
                <View style={styles.inlineMetrics}>
                  <MetricTile
                    label="Remaining"
                    tone={balanceTone(dashboard.next_paycheck.remaining_amount)}
                    value={formatCurrency(
                      dashboard.next_paycheck.remaining_amount,
                    )}
                  />
                  <MetricTile
                    label="Bill load"
                    value={formatCurrency(
                      dashboard.next_paycheck.assigned_total,
                    )}
                  />
                </View>
              </>
            ) : (
              <EmptyState
                body="Start by adding a paycheck so the planner can anchor every due date to real income."
                title="No paycheck scheduled yet"
              />
            )}
          </SurfaceCard>

          <SectionTitle
            subtitle="Bills that need coverage before the next payday lands."
            title="Due before next paycheck"
          />
          <BillList
            emptyBody="You are clear until the next income date."
            emptyTitle="Nothing due"
            items={dashboard.bills_due_before_next_paycheck}
          />

          <SectionTitle
            subtitle="Items that still do not have a paycheck covering them."
            title="Uncovered bills"
          />
          <BillList
            emptyBody="Everything visible in this forecast window has funding assigned."
            emptyTitle="All set"
            items={dashboard.unassigned_bill_occurrences}
          />

          <SurfaceCard tone="accent">
            <SectionTitle
              subtitle="Signals pulled directly from your latest forecast."
              title="Insights"
            />
            <Row
              subtitle={
                dashboard.insights.tightest_paycheck
                  ? `${dashboard.insights.tightest_paycheck.pay_schedule_name ?? "Paycheck"} on ${formatDateWithYear(dashboard.insights.tightest_paycheck.occurrence_date)}`
                  : "Add more schedule data to identify your tightest pay period."
              }
              title="Tightest paycheck"
              value={
                dashboard.insights.tightest_paycheck
                  ? formatCurrency(
                      dashboard.insights.tightest_paycheck.remaining_amount,
                    )
                  : undefined
              }
              valueTone={
                dashboard.insights.tightest_paycheck &&
                Number(dashboard.insights.tightest_paycheck.remaining_amount) <
                  0
                  ? "danger"
                  : "default"
              }
            />
            <Row
              subtitle={
                dashboard.insights.largest_expense
                  ? `Due ${formatDateWithYear(dashboard.insights.largest_expense.due_date)}`
                  : "Largest expense will appear once bills exist in the active window."
              }
              title={
                dashboard.insights.largest_expense?.name ?? "Largest expense"
              }
              value={
                dashboard.insights.largest_expense
                  ? formatCurrency(dashboard.insights.largest_expense.amount)
                  : undefined
              }
            />
          </SurfaceCard>

          {dashboard.savings_goals.length ? (
            <SurfaceCard>
              <SectionTitle
                action={
                  <SecondaryButton
                    icon={
                      canCreateSavingsGoal ? "bullseye-arrow" : "crown-outline"
                    }
                    label={canCreateSavingsGoal ? "Add goal" : "Unlock Pro"}
                    onPress={() => {
                      router.push(
                        canCreateSavingsGoal
                          ? "/savings-goals/new"
                          : "/billing",
                      );
                    }}
                  />
                }
                subtitle="Savings goals are treated as real commitments inside the forecast."
                title="Savings goals"
              />
              {dashboard.savings_goals.slice(0, 3).map((goal) => (
                <Row
                  key={String(goal.id)}
                  badge={
                    <StatusBadge label={`P${goal.priority}`} tone="primary" />
                  }
                  subtitle={goalSubtitle(
                    goal.target_date,
                    goal.contribution_amount,
                  )}
                  title={goal.name}
                  value={formatCurrency(goal.remaining_target)}
                />
              ))}
            </SurfaceCard>
          ) : (
            <SurfaceCard tone="warning">
              <View style={styles.goalCallout}>
                <MaterialCommunityIcons
                  color={theme.colors.warning}
                  name="piggy-bank-outline"
                  size={26}
                />
                <View style={styles.goalCalloutCopy}>
                  <Text style={styles.goalCalloutTitle}>
                    Add a savings goal
                  </Text>
                  <Text style={styles.goalCalloutBody}>
                    Build sinking funds for annual costs and bigger milestones
                    so they show up in the same paycheck plan as your bills.
                  </Text>
                </View>
              </View>
              <PrimaryButton
                icon={canCreateSavingsGoal ? "plus" : "crown-outline"}
                label={
                  canCreateSavingsGoal ? "Create savings goal" : "Unlock Pro"
                }
                onPress={() => {
                  router.push(
                    canCreateSavingsGoal ? "/savings-goals/new" : "/billing",
                  );
                }}
              />
            </SurfaceCard>
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: theme.spacing.lg,
  },
  heroCopy: {
    gap: theme.spacing.xs,
  },
  heroLabel: {
    color: withAlpha(theme.colors.white, 0.72),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroValue: {
    color: theme.colors.white,
    ...theme.typography.title,
    fontSize: 40,
  },
  heroSubtle: {
    color: withAlpha(theme.colors.white, 0.7),
    ...theme.typography.body,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    padding: theme.spacing.md,
  },
  heroStat: {
    flex: 1,
    gap: 4,
  },
  heroStatLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroStatValue: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  heroDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withAlpha(theme.colors.white, 0.12),
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  inlineMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  goalCallout: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "flex-start",
  },
  goalCalloutCopy: {
    flex: 1,
    gap: 4,
  },
  goalCalloutTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  goalCalloutBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
