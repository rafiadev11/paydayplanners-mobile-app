import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { GoalProgressBlock } from "@features/goals/goal-progress";
import { type SavingsGoal } from "@features/planning/api";
import {
  useDashboardQuery,
  useSavingsGoalsQuery,
} from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

function goalRank(goal: SavingsGoal) {
  if (goal.is_completed) return 2;

  return goal.is_active ? 0 : 1;
}

export function GoalsSegment() {
  const router = useRouter();
  const { user } = useAuth();
  const planningRevision = usePlanningRevision();
  const scope = { revision: planningRevision, userId: user?.id };
  const goalsQuery = useSavingsGoalsQuery(scope);
  // The goals endpoint is the only one that returns paused and completed goals,
  // but only the dashboard plans contributions — which is what dates the pace
  // line. It is almost always already cached from Home.
  const dashboardQuery = useDashboardQuery(scope);

  useRefetchStaleOnFocus(goalsQuery, dashboardQuery);

  const goals = useMemo(() => goalsQuery.data ?? [], [goalsQuery.data]);
  const dashboard = dashboardQuery.data ?? null;

  const plannedById = useMemo(() => {
    const planned = new Map<string, SavingsGoal>();

    for (const goal of dashboard?.savings_goals ?? []) {
      planned.set(String(goal.id), goal);
    }

    return planned;
  }, [dashboard]);

  const context = {
    nextPaydayDate: dashboard?.next_paycheck?.occurrence_date,
    payFrequency: dashboard?.next_paycheck?.pay_schedule?.frequency,
  };

  const rows = useMemo(
    () =>
      [...goals]
        .sort((a, b) => goalRank(a) - goalRank(b))
        .map((goal) => {
          const planned = plannedById.get(String(goal.id));

          return planned
            ? { ...goal, contributions: planned.contributions }
            : goal;
        }),
    [goals, plannedById],
  );

  if (goalsQuery.isPending && !goals.length) {
    return <LoadingState label="Loading what you are saving toward." />;
  }

  if (goalsQuery.error) {
    return (
      <ErrorState
        body={getApiErrorMessage(goalsQuery.error)}
        onRetry={() => {
          void goalsQuery.refetch();
        }}
        title="Goals unavailable"
      />
    );
  }

  if (!goals.length) {
    return (
      <EmptyState
        body="Set aside a little each payday toward something real, and watch it fill up here."
        title="No savings goals yet"
      />
    );
  }

  return (
    <View style={styles.rows}>
      {rows.map((goal) => (
        <Pressable
          accessibilityRole="button"
          key={String(goal.id)}
          onPress={() => {
            router.push(`/savings-goals/${goal.id}`);
          }}
          style={({ pressed }) => [
            goal.is_active ? null : styles.cardDimmed,
            pressed ? styles.cardPressed : null,
          ]}
        >
          <SurfaceCard>
            <GoalProgressBlock context={context} goal={goal} />
          </SurfaceCard>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: theme.spacing.md,
  },
  cardDimmed: {
    opacity: 0.6,
  },
  cardPressed: {
    opacity: 0.84,
  },
});
