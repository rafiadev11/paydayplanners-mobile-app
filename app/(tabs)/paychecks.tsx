import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { BillingBanner } from "@features/billing/components";
import {
  fetchPaySchedules,
  fetchPaycheckOccurrences,
  type PaySchedule,
  type PaycheckOccurrence,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDateWithYear,
  formatFrequency,
  formatLongWeekday,
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

function statusTone(status: string) {
  switch (status) {
    case "received":
      return "success" as const;
    case "adjusted":
      return "warning" as const;
    case "skipped":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function nextOccurrenceFor(
  schedule: PaySchedule,
  occurrences: PaycheckOccurrence[],
) {
  return occurrences.find(
    (occurrence) =>
      String(occurrence.pay_schedule?.id ?? occurrence.pay_schedule_id) ===
      String(schedule.id),
  );
}

export default function PaychecksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<PaySchedule[]>([]);
  const [occurrences, setOccurrences] = useState<PaycheckOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [nextSchedules, nextOccurrences] = await Promise.all([
          fetchPaySchedules(),
          fetchPaycheckOccurrences(user?.billing?.has_pro_access ? 365 : 90),
        ]);

        setSchedules(nextSchedules);
        setOccurrences(nextOccurrences);
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

  const nextPaycheck = occurrences[0] ?? null;
  const activeSchedules = schedules.filter((schedule) => schedule.is_active);
  const canCreateSchedule =
    Boolean(user?.billing?.has_pro_access) || schedules.length < 1;

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
        eyebrow="Income Sources"
        subtitle="Track recurring pay patterns, one-time income, and the exact paycheck dates feeding your forecast."
        title="Paychecks"
      />

      {loading ? (
        <LoadingState label="Pulling your income schedules and generated paycheck dates." />
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void load();
          }}
          title="Paycheck data unavailable"
        />
      ) : (
        <>
          {schedules.length > 0 && occurrences.length > 0 ? (
            <BillingBanner billing={user?.billing} compact />
          ) : null}

          <SurfaceCard tone="accent">
            <SectionTitle
              action={
                <PrimaryButton
                  icon={canCreateSchedule ? "cash-plus" : "crown-outline"}
                  label={canCreateSchedule ? "Add paycheck" : "Unlock Pro"}
                  onPress={() => {
                    router.push(
                      canCreateSchedule ? "/pay-schedules/new" : "/billing",
                    );
                  }}
                />
              }
              subtitle="Your next income event becomes the anchor for the whole plan."
              title="Income overview"
            />
            <View style={styles.metricGrid}>
              <MetricTile
                label="Active sources"
                tone="success"
                value={String(activeSchedules.length)}
              />
              <MetricTile
                label="Upcoming"
                tone="dark"
                value={
                  nextPaycheck
                    ? formatCurrency(
                        nextPaycheck.effective_amount ?? nextPaycheck.amount,
                      )
                    : "$0"
                }
              />
              <MetricTile
                label="Next date"
                value={
                  nextPaycheck
                    ? formatDateWithYear(nextPaycheck.occurrence_date)
                    : "Not set"
                }
              />
            </View>
          </SurfaceCard>

          <SectionTitle
            subtitle="Recurring and one-time income sources currently active in your account."
            title="Schedules"
          />
          {schedules.length ? (
            schedules.map((schedule) => {
              const nextOccurrence = nextOccurrenceFor(schedule, occurrences);

              return (
                <SurfaceCard key={String(schedule.id)}>
                  <Row
                    badge={
                      <StatusBadge
                        label={schedule.is_active ? "active" : "paused"}
                        tone={schedule.is_active ? "success" : "warning"}
                      />
                    }
                    subtitle={`${formatFrequency(schedule.frequency)}${schedule.is_one_time ? "" : ` starting ${formatDateWithYear(schedule.start_date)}`}`}
                    title={schedule.name}
                    value={formatCurrency(schedule.amount)}
                  />
                  <Row
                    subtitle={
                      schedule.frequency === "monthly"
                        ? `Pays on day ${schedule.month_day ?? "--"}`
                        : schedule.frequency === "once"
                          ? "One-time income"
                          : formatLongWeekday(schedule.start_date)
                    }
                    title="Timing"
                    value={
                      nextOccurrence
                        ? formatDateWithYear(nextOccurrence.occurrence_date)
                        : "No generated date"
                    }
                  />
                  <SecondaryButton
                    icon="pencil-outline"
                    label="Edit paycheck"
                    onPress={() => {
                      router.push(`/pay-schedules/${schedule.id}`);
                    }}
                  />
                </SurfaceCard>
              );
            })
          ) : (
            <EmptyState
              body="Add your first paycheck schedule so the planner can begin placing bills against real income."
              title="No pay schedules yet"
            />
          )}

          <SectionTitle
            subtitle="Generated paycheck dates within the active forecast horizon."
            title="Upcoming paycheck dates"
          />
          <SurfaceCard>
            {occurrences.length ? (
              occurrences
                .slice(0, 8)
                .map((occurrence) => (
                  <Row
                    key={String(occurrence.id)}
                    badge={
                      <StatusBadge
                        label={occurrence.status}
                        tone={statusTone(occurrence.status)}
                      />
                    }
                    subtitle={
                      occurrence.pay_schedule?.name ??
                      occurrence.pay_schedule?.frequency ??
                      "Pay schedule"
                    }
                    title={formatDateWithYear(occurrence.occurrence_date)}
                    value={formatCurrency(
                      occurrence.effective_amount ?? occurrence.amount,
                    )}
                  />
                ))
            ) : (
              <EmptyState
                body="Once a schedule exists, generated paycheck dates will appear here."
                title="Nothing upcoming"
              />
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
});
