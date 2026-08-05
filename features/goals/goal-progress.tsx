import { StyleSheet, Text, View } from "react-native";

import { type SavingsGoal } from "@features/planning/api";
import { formatCurrency, formatMonthYear } from "@shared/lib/format";
import { addDaysToIsoDate } from "@shared/lib/timezone";
import { theme, withAlpha } from "@shared/ui/theme";

/** Fallback payday spacing when a goal has no planned contributions to read. */
const CADENCE_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  semimonthly: 15,
  monthly: 30,
};

/**
 * Everything the pace line needs that does not live on the goal itself. Only
 * the dashboard and forecast endpoints plan contributions, so `GET
 * /savings-goals` callers pass whatever they can and the projection is skipped.
 */
export type GoalPaceContext = {
  nextPaydayDate?: string | null;
  payFrequency?: string | null;
};

export function progressRatio(goal: SavingsGoal) {
  const target = Number(goal.target_amount);

  if (target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, Number(goal.saved_amount) / target));
}

/**
 * What actually lands on each payday: the user's own per-paycheck amount when
 * they set one, otherwise the amount the forecast decided to spread.
 */
export function perPaydayAmount(goal: SavingsGoal) {
  return Number(
    goal.contribution_amount ?? goal.contributions?.[0]?.amount ?? 0,
  );
}

function daysBetweenIsoDates(from: string, to: string) {
  const span =
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
    86_400_000;

  return Number.isFinite(span) && span > 0 ? Math.round(span) : null;
}

function paydayCadence(goal: SavingsGoal, context: GoalPaceContext) {
  const contributions = goal.contributions ?? [];

  if (contributions.length >= 2) {
    return daysBetweenIsoDates(
      contributions[0].occurrence_date,
      contributions[1].occurrence_date,
    );
  }

  return context.payFrequency
    ? (CADENCE_DAYS[context.payFrequency] ?? null)
    : null;
}

/**
 * Open-ended goals have no finish line from the API — the plan only spreads
 * contributions across the forecast window — so project one from the pace.
 */
function projectedCompletion(goal: SavingsGoal, context: GoalPaceContext) {
  const perPayday = perPaydayAmount(goal);
  const remaining = Number(goal.remaining_target);
  const firstPayday =
    goal.contributions?.[0]?.occurrence_date ?? context.nextPaydayDate;
  const cadence = paydayCadence(goal, context);

  if (perPayday <= 0 || remaining <= 0 || !firstPayday || !cadence) {
    return null;
  }

  const paydaysLeft = Math.ceil(remaining / perPayday);

  return addDaysToIsoDate(firstPayday, (paydaysLeft - 1) * cadence);
}

export function goalPace(goal: SavingsGoal, context: GoalPaceContext) {
  if (goal.is_completed) {
    return "Goal reached";
  }

  const perPayday = perPaydayAmount(goal);
  const perPaydayLabel = perPayday > 0 ? formatCurrency(perPayday) : null;

  if (!goal.is_active) {
    return perPaydayLabel
      ? `Paused · ${perPaydayLabel} a payday when you resume`
      : "Paused";
  }

  if (goal.target_date) {
    return perPaydayLabel
      ? `${perPaydayLabel} each payday · needed by ${formatMonthYear(goal.target_date)}`
      : `Needed by ${formatMonthYear(goal.target_date)}`;
  }

  if (!perPaydayLabel) {
    return `${formatCurrency(goal.saved_amount)} saved so far`;
  }

  const projected = projectedCompletion(goal, context);

  return projected
    ? `${perPaydayLabel} set aside each payday · on track for ${formatMonthYear(projected)}`
    : `${perPaydayLabel} set aside each payday`;
}

/** Name, saved-of-target, progress bar, and pace line — the goal in four lines. */
export function GoalProgressBlock({
  goal,
  context,
}: {
  goal: SavingsGoal;
  context: GoalPaceContext;
}) {
  const ratio = progressRatio(goal);

  return (
    <View style={styles.goal}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalName}>{goal.name}</Text>
        <Text style={styles.goalAmount}>
          {`${formatCurrency(goal.saved_amount)} of ${formatCurrency(goal.target_amount)}`}
        </Text>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: ratio === 0 ? "0%" : `${Math.max(6, ratio * 100)}%` },
          ]}
        />
      </View>

      <Text style={styles.goalPace}>{goalPace(goal, context)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  goal: {
    gap: theme.spacing.sm,
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  goalName: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  goalAmount: {
    color: theme.colors.muted,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  progressTrack: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: withAlpha(theme.colors.borderStrong, 0.35),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  goalPace: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});
