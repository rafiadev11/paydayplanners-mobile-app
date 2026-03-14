import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
  formatInteger,
  formatLongWeekday,
} from "@shared/lib/format";
import {
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryButton,
  ScreenHeader,
  SectionTitle,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

type OccurrenceMonthGroup = {
  key: string;
  label: string;
  occurrences: PaycheckOccurrence[];
};

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

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(value: string) {
  return monthFormatter.format(new Date(`${monthKey(value)}-01T00:00:00`));
}

function dayDistanceLabel(value: string) {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(`${value}T00:00:00`);
  const distance = Math.round(
    (target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (distance <= 0) {
    return "Today";
  }

  if (distance === 1) {
    return "In 1 day";
  }

  return `In ${distance} days`;
}

function windowEndLabel(days: number) {
  const end = new Date();
  end.setDate(end.getDate() + days);

  return formatDateWithYear(end.toISOString().slice(0, 10));
}

function timingSummary(
  schedule: PaySchedule,
  nextOccurrence: PaycheckOccurrence | null,
) {
  if (schedule.frequency === "monthly") {
    return `Pays on day ${schedule.month_day ?? "--"}`;
  }

  if (schedule.frequency === "once") {
    return "One-time income";
  }

  return formatLongWeekday(
    nextOccurrence?.occurrence_date ?? schedule.start_date,
  );
}

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

function buildMonthGroups(occurrences: PaycheckOccurrence[]) {
  const groups: OccurrenceMonthGroup[] = [];
  let currentGroup: OccurrenceMonthGroup | null = null;

  for (const occurrence of occurrences) {
    const key = monthKey(occurrence.occurrence_date);

    if (!currentGroup || currentGroup.key !== key) {
      currentGroup = {
        key,
        label: monthLabel(occurrence.occurrence_date),
        occurrences: [],
      };
      groups.push(currentGroup);
    }

    currentGroup.occurrences.push(occurrence);
  }

  return groups;
}

function shouldExpandMonth(
  _index: number,
  override: boolean | undefined,
  _occurrencesCount: number,
) {
  if (override !== undefined) {
    return override;
  }

  return false;
}

function NextIncomeCard({
  nextPaycheck,
  activeSources,
  schedulesCount,
  canCreateSchedule,
  onAddPaycheck,
  onOpenBilling,
}: {
  nextPaycheck: PaycheckOccurrence | null;
  activeSources: number;
  schedulesCount: number;
  canCreateSchedule: boolean;
  onAddPaycheck: () => void;
  onOpenBilling: () => void;
}) {
  if (!nextPaycheck) {
    return (
      <SurfaceCard tone="dark" style={styles.nextCard}>
        <Text style={styles.nextCardEyebrow}>Next income</Text>
        <Text style={styles.nextCardTitle}>Add your first paycheck</Text>
        <Text style={styles.nextCardBody}>
          The first income source anchors the entire plan and unlocks forecasted
          paycheck dates.
        </Text>
        <View style={styles.nextCardActions}>
          <PrimaryButton
            icon={canCreateSchedule ? "cash-plus" : "crown-outline"}
            label={canCreateSchedule ? "Add paycheck" : "Unlock Pro"}
            onPress={canCreateSchedule ? onAddPaycheck : onOpenBilling}
          />
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard tone="dark" style={styles.nextCard}>
      <View style={styles.nextCardHeader}>
        <View style={styles.nextCardHeaderCopy}>
          <Text style={styles.nextCardEyebrow}>Next income</Text>
          <Text style={styles.nextCardTitle}>
            {nextPaycheck.pay_schedule?.name ?? "Upcoming paycheck"}
          </Text>
          <Text style={styles.nextCardBody}>
            {formatDateWithYear(nextPaycheck.occurrence_date)} ·{" "}
            {dayDistanceLabel(nextPaycheck.occurrence_date)}
          </Text>
        </View>
        <Text style={styles.nextCardAmount}>
          {formatCurrency(nextPaycheck.effective_amount ?? nextPaycheck.amount)}
        </Text>
      </View>

      <View style={styles.nextCardStats}>
        <View style={styles.nextCardStat}>
          <Text style={styles.nextCardStatLabel}>Active sources</Text>
          <Text style={styles.nextCardStatValue}>
            {formatInteger(activeSources)}
          </Text>
        </View>
        <View style={styles.nextCardDivider} />
        <View style={styles.nextCardStat}>
          <Text style={styles.nextCardStatLabel}>Total sources</Text>
          <Text style={styles.nextCardStatValue}>
            {formatInteger(schedulesCount)}
          </Text>
        </View>
        <View style={styles.nextCardDivider} />
        <View style={styles.nextCardStat}>
          <Text style={styles.nextCardStatLabel}>Cadence</Text>
          <Text style={styles.nextCardStatValue}>
            {nextPaycheck.pay_schedule
              ? formatFrequency(nextPaycheck.pay_schedule.frequency)
              : "Flexible"}
          </Text>
        </View>
      </View>

      <View style={styles.nextCardActions}>
        <PrimaryButton
          icon={canCreateSchedule ? "cash-plus" : "crown-outline"}
          label={canCreateSchedule ? "Add paycheck" : "Unlock Pro"}
          onPress={canCreateSchedule ? onAddPaycheck : onOpenBilling}
        />
      </View>
    </SurfaceCard>
  );
}

function IncomeSourceCard({
  schedule,
  nextOccurrence,
  onEdit,
}: {
  schedule: PaySchedule;
  nextOccurrence: PaycheckOccurrence | null;
  onEdit: () => void;
}) {
  return (
    <SurfaceCard style={styles.sourceCard}>
      <View style={styles.sourceHeader}>
        <View style={styles.sourceHeaderCopy}>
          <View style={styles.sourceTitleRow}>
            <Text style={styles.sourceTitle}>{schedule.name}</Text>
            <StatusBadge
              label={schedule.is_active ? "active" : "paused"}
              tone={schedule.is_active ? "success" : "warning"}
            />
          </View>
          <Text style={styles.sourceSubtitle}>
            {formatFrequency(schedule.frequency)}
            {schedule.is_one_time
              ? ""
              : ` starting ${formatDateWithYear(schedule.start_date)}`}
          </Text>
        </View>
        <Text style={styles.sourceAmount}>
          {formatCurrency(schedule.amount)}
        </Text>
      </View>

      <View style={styles.sourceMetaGrid}>
        <View style={styles.sourceMetaTile}>
          <Text style={styles.sourceMetaLabel}>Timing</Text>
          <Text style={styles.sourceMetaValue}>
            {timingSummary(schedule, nextOccurrence)}
          </Text>
        </View>
        <View style={styles.sourceMetaTile}>
          <Text style={styles.sourceMetaLabel}>Next pay date</Text>
          <Text style={styles.sourceMetaValue}>
            {nextOccurrence
              ? formatDateWithYear(nextOccurrence.occurrence_date)
              : "No generated date"}
          </Text>
        </View>
      </View>

      <SecondaryButton
        icon="pencil-outline"
        label="Edit paycheck"
        onPress={onEdit}
      />
    </SurfaceCard>
  );
}

function MonthSection({
  group,
  expanded,
  onToggle,
}: {
  group: OccurrenceMonthGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.monthSection}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          styles.monthHeader,
          pressed ? styles.monthHeaderPressed : null,
        ]}
      >
        <View style={styles.monthHeaderCopy}>
          <Text style={styles.monthTitle}>{group.label}</Text>
          <Text style={styles.monthSubtitle}>
            {group.occurrences.length === 1
              ? "1 paycheck date"
              : `${group.occurrences.length} paycheck dates`}
          </Text>
        </View>
        <MaterialCommunityIcons
          color={theme.colors.muted}
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
        />
      </Pressable>

      {expanded ? (
        <SurfaceCard>
          {group.occurrences.map((occurrence) => (
            <View key={String(occurrence.id)} style={styles.occurrenceRow}>
              <View style={styles.occurrenceCopy}>
                <View style={styles.occurrenceTitleRow}>
                  <Text style={styles.occurrenceDate}>
                    {formatDateWithYear(occurrence.occurrence_date)}
                  </Text>
                  <StatusBadge
                    label={occurrence.status}
                    tone={statusTone(occurrence.status)}
                  />
                </View>
                <Text style={styles.occurrenceSource}>
                  {occurrence.pay_schedule?.name ??
                    occurrence.pay_schedule?.frequency ??
                    "Pay schedule"}
                </Text>
              </View>
              <Text style={styles.occurrenceAmount}>
                {formatCurrency(
                  occurrence.effective_amount ?? occurrence.amount,
                )}
              </Text>
            </View>
          ))}
        </SurfaceCard>
      ) : null}
    </View>
  );
}

export default function PaychecksScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<PaySchedule[]>([]);
  const [occurrences, setOccurrences] = useState<PaycheckOccurrence[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<
    Record<string, boolean | undefined>
  >({});
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

  useEffect(() => {
    setExpandedMonths({});
  }, [occurrences.length]);

  const nextOccurrenceMap = buildNextOccurrenceMap(occurrences);
  const monthGroups = buildMonthGroups(occurrences);
  const nextPaycheck = occurrences[0] ?? null;
  const activeSchedules = schedules.filter((schedule) => schedule.is_active);
  const canCreateSchedule =
    Boolean(user?.billing?.has_pro_access) || schedules.length < 1;
  const hasProAccess = Boolean(user?.billing?.has_pro_access);
  const freeWindowEnd = windowEndLabel(90);

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
        subtitle="See when money lands next, manage your income sources, and keep future paycheck dates trustworthy."
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

          <NextIncomeCard
            activeSources={activeSchedules.length}
            canCreateSchedule={canCreateSchedule}
            nextPaycheck={nextPaycheck}
            onAddPaycheck={() => {
              router.push("/pay-schedules/new");
            }}
            onOpenBilling={() => {
              router.push("/billing");
            }}
            schedulesCount={schedules.length}
          />

          <SectionTitle
            action={
              schedules.length ? (
                <SecondaryButton
                  icon={canCreateSchedule ? "cash-plus" : "crown-outline"}
                  label={canCreateSchedule ? "Add source" : "Unlock Pro"}
                  onPress={() => {
                    router.push(
                      canCreateSchedule ? "/pay-schedules/new" : "/billing",
                    );
                  }}
                />
              ) : undefined
            }
            subtitle="Recurring and one-time income sources that currently feed the forecast."
            title="Income sources"
          />

          {schedules.length ? (
            <View style={styles.sourceStack}>
              {schedules.map((schedule) => (
                <IncomeSourceCard
                  key={String(schedule.id)}
                  nextOccurrence={
                    nextOccurrenceMap.get(String(schedule.id)) ?? null
                  }
                  onEdit={() => {
                    router.push(`/pay-schedules/${schedule.id}`);
                  }}
                  schedule={schedule}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              body="Add your first paycheck schedule so the planner can begin placing bills against real income."
              title="No pay schedules yet"
            />
          )}

          <SectionTitle
            subtitle="Generated paycheck dates grouped by month so you can scan the cadence without reading a long flat list."
            title="Upcoming paycheck dates"
          />

          {monthGroups.length ? (
            <View style={styles.monthStack}>
              {monthGroups.map((group, index) => (
                <MonthSection
                  expanded={shouldExpandMonth(
                    index,
                    expandedMonths[group.key],
                    group.occurrences.length,
                  )}
                  group={group}
                  key={group.key}
                  onToggle={() => {
                    setExpandedMonths((current) => ({
                      ...current,
                      [group.key]: !shouldExpandMonth(
                        index,
                        current[group.key],
                        group.occurrences.length,
                      ),
                    }));
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              body="Once a schedule exists, generated paycheck dates will appear here."
              title="Nothing upcoming"
            />
          )}

          {!hasProAccess && schedules.length > 0 ? (
            <SurfaceCard tone="accent" style={styles.freeWindowCard}>
              <Text style={styles.freeWindowEyebrow}>Free window</Text>
              <Text style={styles.freeWindowTitle}>
                Paycheck dates show through {freeWindowEnd}
              </Text>
              <Text style={styles.freeWindowBody}>
                Free includes the next 90 days of paycheck dates. Upgrade to Pro
                to keep scanning the rest of your 12-month income timeline.
              </Text>
              <View style={styles.freeWindowActions}>
                <PrimaryButton
                  icon="crown-outline"
                  label="Unlock Pro"
                  onPress={() => {
                    router.push("/billing");
                  }}
                />
              </View>
            </SurfaceCard>
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  nextCard: {
    gap: theme.spacing.lg,
  },
  nextCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  nextCardHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  nextCardEyebrow: {
    color: withAlpha(theme.colors.white, 0.72),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  nextCardTitle: {
    color: theme.colors.white,
    ...theme.typography.title,
  },
  nextCardBody: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  nextCardAmount: {
    color: theme.colors.white,
    ...theme.typography.metricCompact,
  },
  nextCardStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    padding: theme.spacing.md,
  },
  nextCardStat: {
    flex: 1,
    gap: 4,
  },
  nextCardStatLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  nextCardStatValue: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  nextCardDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withAlpha(theme.colors.white, 0.12),
  },
  nextCardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  sourceStack: {
    gap: theme.spacing.md,
  },
  sourceCard: {
    gap: theme.spacing.lg,
  },
  sourceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  sourceHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  sourceTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  sourceTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  sourceSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  sourceAmount: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  sourceMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  sourceMetaTile: {
    flex: 1,
    minWidth: 140,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.primarySoft, 0.44),
    padding: theme.spacing.md,
  },
  sourceMetaLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sourceMetaValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  monthStack: {
    gap: theme.spacing.lg,
  },
  freeWindowCard: {
    gap: theme.spacing.md,
  },
  freeWindowEyebrow: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  freeWindowTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  freeWindowBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  freeWindowActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  monthSection: {
    gap: theme.spacing.md,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  monthHeaderPressed: {
    opacity: 0.82,
  },
  monthHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  monthTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  monthSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  occurrenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  occurrenceCopy: {
    flex: 1,
    gap: 6,
  },
  occurrenceTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  occurrenceDate: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  occurrenceSource: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  occurrenceAmount: {
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
});
