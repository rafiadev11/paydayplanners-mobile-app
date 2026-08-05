import { Pressable, StyleSheet, Text, View } from "react-native";

import { GoalProgressBlock } from "@features/goals/goal-progress";
import { type DashboardResponse } from "@features/planning/api";
import { SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

const VISIBLE_GOAL_COUNT = 2;

export function SavingTowardCard({
  dashboard,
  onOpenGoals,
}: {
  dashboard: DashboardResponse;
  onOpenGoals: () => void;
}) {
  const goals = dashboard.savings_goals.slice(0, VISIBLE_GOAL_COUNT);

  if (!goals.length) {
    return null;
  }

  const context = {
    nextPaydayDate: dashboard.next_paycheck?.occurrence_date,
    payFrequency: dashboard.next_paycheck?.pay_schedule?.frequency,
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Saving toward</Text>
        <Pressable
          hitSlop={10}
          onPress={onOpenGoals}
          style={({ pressed }) => (pressed ? styles.linkPressed : null)}
        >
          <Text style={styles.link}>All goals</Text>
        </Pressable>
      </View>

      <SurfaceCard style={styles.card}>
        {goals.map((goal) => (
          <GoalProgressBlock
            context={context}
            goal={goal}
            key={String(goal.id)}
          />
        ))}
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingBottom: 2,
  },
  title: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  link: {
    color: theme.colors.primaryStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  linkPressed: {
    opacity: 0.7,
  },
  card: {
    gap: theme.spacing.lg,
  },
});
