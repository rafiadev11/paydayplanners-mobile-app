import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { fetchSavingsGoals, type SavingsGoal } from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDateWithYear,
  formatInteger,
} from "@shared/lib/format";
import {
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  Row,
  ScreenHeader,
  SectionTitle,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

function goalSubtitle(goal: SavingsGoal) {
  if (goal.target_date) {
    return `Target ${formatDateWithYear(goal.target_date)}`;
  }

  if (goal.contribution_amount) {
    return `Open-ended · ${formatCurrency(goal.contribution_amount)} per paycheck`;
  }

  return "Open-ended goal";
}

function progressRatio(goal: SavingsGoal) {
  const target = Number(goal.target_amount);

  if (target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(goal.saved_amount) / target));
}

function GoalsSummaryCard({
  goals,
  onOpenNewGoal,
}: {
  goals: SavingsGoal[];
  onOpenNewGoal: () => void;
}) {
  const activeGoals = goals.filter((goal) => goal.is_active);
  const totalRemaining = activeGoals.reduce(
    (total, goal) => total + Number(goal.remaining_target),
    0,
  );
  const perPaycheckReserved = activeGoals.reduce(
    (total, goal) => total + Number(goal.contribution_amount ?? 0),
    0,
  );
  const highestPriority = activeGoals
    .slice()
    .sort((a, b) => a.priority - b.priority)[0];

  return (
    <SurfaceCard tone="accent" style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryHeaderCopy}>
          <Text style={styles.summaryTitle}>Goal progress</Text>
          <Text style={styles.summarySubtitle}>
            Savings goals turn future paychecks into visible progress instead of
            vague intent.
          </Text>
        </View>
        <PrimaryButton
          icon="bullseye-arrow"
          label="Add goal"
          onPress={onOpenNewGoal}
        />
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryTile, styles.summaryTileDark]}>
          <Text style={[styles.summaryTileLabel, styles.summaryTileLabelDark]}>
            Active goals
          </Text>
          <Text style={[styles.summaryTileValue, styles.summaryTileValueDark]}>
            {formatInteger(activeGoals.length)}
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Still to fund</Text>
          <Text style={styles.summaryTileValue}>
            {formatCurrency(totalRemaining)}
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Per paycheck</Text>
          <Text style={styles.summaryTileValue}>
            {formatCurrency(perPaycheckReserved)}
          </Text>
        </View>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Top priority</Text>
          <Text style={styles.summaryTileValue}>
            {highestPriority ? highestPriority.name : "None yet"}
          </Text>
          <Text style={styles.summaryTileMeta}>
            {highestPriority ? `P${highestPriority.priority}` : "Add a goal"}
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function GoalCard({ goal, onEdit }: { goal: SavingsGoal; onEdit: () => void }) {
  const ratio = progressRatio(goal);
  const completed = goal.is_completed;

  return (
    <SurfaceCard style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.goalHeaderCopy}>
          <View style={styles.goalTitleRow}>
            <Text style={styles.goalTitle}>{goal.name}</Text>
            <StatusBadge label={`P${goal.priority}`} tone="accent" />
            <StatusBadge
              label={
                completed ? "completed" : goal.is_active ? "active" : "paused"
              }
              tone={
                completed ? "success" : goal.is_active ? "success" : "warning"
              }
            />
          </View>
          <Text style={styles.goalSubtitle}>
            {completed && goal.completed_at
              ? `Completed ${formatDateWithYear(goal.completed_at)}`
              : goalSubtitle(goal)}
          </Text>
        </View>
        <Text style={styles.goalAmount}>
          {completed
            ? formatCurrency(goal.target_amount)
            : formatCurrency(goal.remaining_target)}
        </Text>
      </View>

      <View style={styles.goalMetaGrid}>
        <View style={styles.goalMetaTile}>
          <Text style={styles.goalMetaLabel}>Saved so far</Text>
          <Text style={styles.goalMetaValue}>
            {formatCurrency(goal.saved_amount)}
          </Text>
        </View>
        <View style={styles.goalMetaTile}>
          <Text style={styles.goalMetaLabel}>
            {completed ? "Reached" : "Target"}
          </Text>
          <Text style={styles.goalMetaValue}>
            {formatCurrency(goal.target_amount)}
          </Text>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: ratio === 0 ? "0%" : `${Math.max(8, ratio * 100)}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {completed ? "Goal reached" : `${Math.round(ratio * 100)}% funded`}
        </Text>
      </View>

      <SecondaryButton
        icon="pencil-outline"
        label="Edit goal"
        onPress={onEdit}
      />
    </SurfaceCard>
  );
}

export default function GoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const nextGoals = await fetchSavingsGoals();
      setGoals(nextGoals);
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeGoals = goals.filter(
    (goal) => goal.is_active && !goal.is_completed,
  );
  const completedGoals = goals.filter((goal) => goal.is_completed);
  const pausedGoals = goals.filter(
    (goal) => !goal.is_active && !goal.is_completed,
  );

  return (
    <AppScreen
      topInset={false}
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
        eyebrow="Progress"
        subtitle="Turn future paychecks into visible movement toward the things you care about funding."
        title="Goals"
      />

      {loading ? (
        <LoadingState label="Loading your savings goals." />
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void load();
          }}
          title="Goals unavailable"
        />
      ) : (
        <>
          <GoalsSummaryCard
            goals={goals}
            onOpenNewGoal={() => {
              router.push("/savings-goals/new");
            }}
          />

          {activeGoals.length ? (
            <>
              <SectionTitle
                subtitle="Active goals currently receiving attention inside the forecast."
                title="Active goals"
              />
              <View style={styles.goalStack}>
                {activeGoals.map((goal) => (
                  <GoalCard
                    goal={goal}
                    key={String(goal.id)}
                    onEdit={() => {
                      router.push(`/savings-goals/${goal.id}`);
                    }}
                  />
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              body="Create a savings goal so the planner can reserve money for it just like it does for bills."
              title="No active goals yet"
            />
          )}

          {pausedGoals.length ? (
            <SurfaceCard>
              <SectionTitle
                subtitle="Paused goals stay here so users can restart them without losing context."
                title="Paused goals"
              />
              {pausedGoals.map((goal) => (
                <Row
                  key={String(goal.id)}
                  badge={
                    <StatusBadge label={`P${goal.priority}`} tone="accent" />
                  }
                  subtitle={goalSubtitle(goal)}
                  title={goal.name}
                  value={formatCurrency(goal.remaining_target)}
                />
              ))}
            </SurfaceCard>
          ) : null}

          {completedGoals.length ? (
            <SurfaceCard tone="accent">
              <SectionTitle
                subtitle="Completed goals stay visible as proof of progress, but they no longer reserve money from future paychecks."
                title="Completed goals"
              />
              {completedGoals.map((goal) => (
                <GoalCard
                  goal={goal}
                  key={String(goal.id)}
                  onEdit={() => {
                    router.push(`/savings-goals/${goal.id}`);
                  }}
                />
              ))}
            </SurfaceCard>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    gap: theme.spacing.lg,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  summaryHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  summaryTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  summarySubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  summaryTile: {
    flex: 1,
    minWidth: 136,
    gap: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.md,
  },
  summaryTileDark: {
    backgroundColor: theme.colors.ink,
    borderColor: withAlpha(theme.colors.ink, 0.08),
  },
  summaryTileLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  summaryTileLabelDark: {
    color: withAlpha(theme.colors.white, 0.7),
  },
  summaryTileValue: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  summaryTileValueDark: {
    color: theme.colors.white,
  },
  summaryTileMeta: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
  },
  goalStack: {
    gap: theme.spacing.md,
  },
  goalCard: {
    gap: theme.spacing.lg,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  goalHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  goalTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  goalTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  goalSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  goalAmount: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  goalMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  goalMetaTile: {
    flex: 1,
    minWidth: 140,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.primarySoft, 0.44),
    padding: theme.spacing.md,
  },
  goalMetaLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  goalMetaValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  progressBlock: {
    gap: theme.spacing.xs,
  },
  progressTrack: {
    height: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: withAlpha(theme.colors.primary, 0.12),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  progressLabel: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "700",
  },
});
