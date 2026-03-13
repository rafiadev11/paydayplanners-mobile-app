import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { BillingBanner } from "@features/billing/components";
import {
  fetchBillCategories,
  fetchBillOccurrences,
  fetchBills,
  fetchSavingsGoals,
  type Bill,
  type BillCategory,
  type BillOccurrence,
  type SavingsGoal,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDateWithYear,
  formatFrequency,
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
import { theme } from "@shared/ui/theme";

function occurrenceTone(status: string) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "overdue":
      return "danger" as const;
    case "skipped":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function activeGoals(goals: SavingsGoal[]) {
  return goals.filter((goal) => goal.is_active);
}

function goalSubtitle(goal: SavingsGoal) {
  if (goal.target_date) {
    return `Target ${formatDateWithYear(goal.target_date)}`;
  }

  if (goal.contribution_amount) {
    return `Open-ended · ${formatCurrency(goal.contribution_amount)} per paycheck`;
  }

  return "Open-ended goal";
}

export default function BillsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [categories, setCategories] = useState<BillCategory[]>([]);
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [nextBills, nextCategories, nextOccurrences, nextGoals] =
          await Promise.all([
            fetchBills(),
            fetchBillCategories(),
            fetchBillOccurrences(user?.billing?.has_pro_access ? 365 : 90),
            fetchSavingsGoals(),
          ]);

        setBills(nextBills);
        setCategories(nextCategories);
        setOccurrences(nextOccurrences);
        setGoals(nextGoals);
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
      void load();
    }, [load]),
  );

  const dueSoon = occurrences.slice(0, 6);
  const canCreateBill =
    Boolean(user?.billing?.has_pro_access) || bills.length < 12;
  const canCreateSavingsGoal =
    Boolean(user?.billing?.has_pro_access) || goals.length < 1;

  return (
    <AppScreen
      refreshControl={
        <RefreshControl
          onRefresh={() => {
            void load(true);
          }}
          refreshing={refreshing}
          tintColor={theme.colors.primary}
        />
      }
    >
      <ScreenHeader
        eyebrow="Commitments"
        subtitle="Recurring bills, one-time expenses, categories, and savings goals all in the same operating view."
        title="Bills"
      />

      {loading ? (
        <LoadingState label="Loading bills, due dates, categories, and savings goals." />
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void load();
          }}
          title="Bills unavailable"
        />
      ) : (
        <>
          {bills.length > 0 || goals.length > 0 ? (
            <BillingBanner billing={user?.billing} compact />
          ) : null}

          <SurfaceCard tone="accent">
            <SectionTitle
              action={
                <PrimaryButton
                  icon={
                    canCreateBill
                      ? "receipt-text-plus-outline"
                      : "crown-outline"
                  }
                  label={canCreateBill ? "Add bill" : "Unlock Pro"}
                  onPress={() => {
                    router.push(canCreateBill ? "/bills/new" : "/billing");
                  }}
                />
              }
              subtitle="Use this area for recurring bills, subscriptions, and one-time expenses."
              title="Obligation overview"
            />
            <View style={styles.metricGrid}>
              <MetricTile
                label="Active bills"
                tone="dark"
                value={String(bills.filter((bill) => bill.is_active).length)}
              />
              <MetricTile
                label="Upcoming due dates"
                tone="warning"
                value={String(dueSoon.length)}
              />
              <MetricTile
                label="Goals"
                tone="success"
                value={String(activeGoals(goals).length)}
              />
            </View>
          </SurfaceCard>

          {categories.length ? (
            <SurfaceCard tone="accent">
              <SectionTitle
                subtitle="Categories help the app explain where each paycheck is being consumed."
                title="Categories"
              />
              <View style={styles.categoryWrap}>
                {categories.map((category) => (
                  <StatusBadge
                    key={String(category.id)}
                    label={category.name}
                    tone={category.is_default ? "primary" : "neutral"}
                  />
                ))}
              </View>
            </SurfaceCard>
          ) : null}

          <SectionTitle
            subtitle="Recurring obligations and one-time expenses from your backend."
            title="Bill library"
          />
          {bills.length ? (
            bills.map((bill) => (
              <SurfaceCard key={String(bill.id)}>
                <Row
                  badge={
                    bill.bill_category ? (
                      <StatusBadge
                        label={bill.bill_category.name}
                        tone="primary"
                      />
                    ) : undefined
                  }
                  subtitle={`${formatFrequency(bill.frequency)}${bill.is_subscription ? " subscription" : ""}`}
                  title={bill.name}
                  value={formatCurrency(bill.amount)}
                />
                <Row
                  badge={
                    <StatusBadge
                      label={bill.is_active ? "active" : "paused"}
                      tone={bill.is_active ? "success" : "warning"}
                    />
                  }
                  subtitle={
                    bill.frequency === "monthly"
                      ? `Due on day ${bill.due_day ?? "--"}`
                      : `Starts ${formatDateWithYear(bill.start_date)}`
                  }
                  title="Schedule"
                />
                <SecondaryButton
                  icon="pencil-outline"
                  label="Edit bill"
                  onPress={() => {
                    router.push(`/bills/${bill.id}`);
                  }}
                />
              </SurfaceCard>
            ))
          ) : (
            <EmptyState
              body="Create your first recurring or one-time bill to see how each paycheck gets reduced."
              title="No bills yet"
            />
          )}

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
                      canCreateSavingsGoal ? "/savings-goals/new" : "/billing",
                    );
                  }}
                />
              }
              subtitle="Next due items in the active planning window."
              title="Due soon"
            />
            {dueSoon.length ? (
              dueSoon.map((occurrence) => (
                <Row
                  key={String(occurrence.id)}
                  badge={
                    <StatusBadge
                      label={occurrence.status}
                      tone={occurrenceTone(occurrence.status)}
                    />
                  }
                  subtitle={`Due ${formatDateWithYear(occurrence.due_date)}`}
                  title={occurrence.bill?.name ?? "Bill occurrence"}
                  value={formatCurrency(
                    occurrence.effective_amount ?? occurrence.amount,
                  )}
                  valueTone={
                    occurrence.status === "overdue" ? "danger" : "default"
                  }
                />
              ))
            ) : (
              <EmptyState
                body="Once bills exist in the planning window, upcoming due dates will show here."
                title="Nothing due soon"
              />
            )}
          </SurfaceCard>

          <SurfaceCard tone="warning">
            <SectionTitle
              subtitle="Savings goals are first-class cashflow commitments, not an afterthought."
              title="Savings goals"
            />
            {goals.length ? (
              goals.map((goal) => (
                <SurfaceCard key={String(goal.id)} tone="light">
                  <Row
                    badge={
                      <StatusBadge label={`P${goal.priority}`} tone="accent" />
                    }
                    subtitle={goalSubtitle(goal)}
                    title={goal.name}
                    value={formatCurrency(goal.remaining_target)}
                  />
                  <SecondaryButton
                    icon="pencil-outline"
                    label="Edit goal"
                    onPress={() => {
                      router.push(`/savings-goals/${goal.id}`);
                    }}
                  />
                </SurfaceCard>
              ))
            ) : (
              <View style={styles.emptyGoalWrap}>
                <Text style={styles.emptyGoalTitle}>No savings goals yet</Text>
                <Text style={styles.emptyGoalBody}>
                  Add sinking funds for annual bills, travel, or larger
                  purchases so they show up alongside bills in the paycheck
                  plan.
                </Text>
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
              </View>
            )}
          </SurfaceCard>
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  emptyGoalWrap: {
    gap: theme.spacing.md,
  },
  emptyGoalTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  emptyGoalBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
