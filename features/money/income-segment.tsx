import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { EntityRow } from "@features/money/entity-row";
import { incomeCadenceLabel, initialOf } from "@features/money/labels";
import { monthlyTotal } from "@features/money/monthly";
import { type PaycheckOccurrence } from "@features/planning/api";
import {
  usePaycheckOccurrencesQuery,
  usePaySchedulesQuery,
} from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatCurrency, formatWeekdayDate } from "@shared/lib/format";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

/** Occurrences arrive date-ordered, so the first hit per schedule is the next one. */
function buildNextOccurrenceMap(occurrences: PaycheckOccurrence[]) {
  const nextBySchedule = new Map<string, PaycheckOccurrence>();

  for (const occurrence of occurrences) {
    const scheduleId = String(
      occurrence.pay_schedule?.id ?? occurrence.pay_schedule_id ?? "",
    );

    if (scheduleId !== "" && !nextBySchedule.has(scheduleId)) {
      nextBySchedule.set(scheduleId, occurrence);
    }
  }

  return nextBySchedule;
}

export function IncomeSegment() {
  const router = useRouter();
  const { user } = useAuth();
  const planningRevision = usePlanningRevision();
  const scope = { revision: planningRevision, userId: user?.id };
  const schedulesQuery = usePaySchedulesQuery(scope);
  const occurrencesQuery = usePaycheckOccurrencesQuery(scope);

  useRefetchStaleOnFocus(schedulesQuery, occurrencesQuery);

  const schedules = useMemo(
    () => schedulesQuery.data ?? [],
    [schedulesQuery.data],
  );
  const occurrences = useMemo(
    () => occurrencesQuery.data ?? [],
    [occurrencesQuery.data],
  );
  const nextBySchedule = useMemo(
    () => buildNextOccurrenceMap(occurrences),
    [occurrences],
  );

  const activeSchedules = schedules.filter((schedule) => schedule.is_active);
  const typicalMonth = monthlyTotal(activeSchedules, (schedule) => ({
    amount: schedule.amount,
    frequency: schedule.frequency,
    intervalValue: schedule.interval_value,
  }));
  const nextDeposit = occurrences[0] ?? null;
  const error = schedulesQuery.error ?? occurrencesQuery.error;

  if (schedulesQuery.isPending && !schedules.length) {
    return <LoadingState label="Loading the income you count on." />;
  }

  if (error) {
    return (
      <ErrorState
        body={getApiErrorMessage(error)}
        onRetry={() => {
          void schedulesQuery.refetch();
          void occurrencesQuery.refetch();
        }}
        title="Income unavailable"
      />
    );
  }

  if (!schedules.length) {
    return (
      <EmptyState
        body="Add the paychecks and other income you expect, and a typical month adds itself up here."
        title="No income sources yet"
      />
    );
  }

  return (
    <>
      <SurfaceCard tone="dark" style={styles.summary}>
        <Text style={styles.summaryEyebrow}>Typical month</Text>
        <Text style={styles.summaryValue}>{formatCurrency(typicalMonth)}</Text>
        <Text style={styles.summaryBody}>
          {`Across ${activeSchedules.length} active ${activeSchedules.length === 1 ? "source" : "sources"}.`}
          {nextDeposit
            ? ` Next deposit ${formatWeekdayDate(nextDeposit.occurrence_date)}.`
            : ""}
        </Text>
      </SurfaceCard>

      <View style={styles.rows}>
        {schedules.map((schedule) => (
          <EntityRow
            key={String(schedule.id)}
            dimmed={!schedule.is_active}
            initial={initialOf(schedule.name)}
            onPress={() => {
              router.push(`/pay-schedules/${schedule.id}`);
            }}
            subtitle={`${incomeCadenceLabel(schedule, nextBySchedule.get(String(schedule.id)))}${schedule.is_active ? "" : " · paused"}`}
            tint={theme.colors.primarySoft}
            title={schedule.name}
            value={`+${formatCurrency(schedule.amount)}`}
            valueTone="income"
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: theme.spacing.xs,
  },
  summaryEyebrow: {
    color: withAlpha(theme.colors.white, 0.66),
    ...theme.typography.eyebrow,
  },
  summaryValue: {
    color: theme.colors.white,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  summaryBody: {
    color: withAlpha(theme.colors.white, 0.78),
    ...theme.typography.body,
  },
  rows: {
    gap: theme.spacing.sm,
  },
});
