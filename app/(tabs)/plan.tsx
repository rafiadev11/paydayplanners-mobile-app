import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  fetchForecast,
  type ForecastPaycheck,
  type ForecastResponse,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDate,
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
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const RISK_THRESHOLD = 300;

type PlanFilter = "next3" | "attention" | "all" | "uncovered";

type PaycheckMonthGroup = {
  key: string;
  label: string;
  paychecks: ForecastPaycheck[];
  billLoadTotal: number;
  hasAttention: boolean;
};

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
  if (remaining < RISK_THRESHOLD) return "accent" as const;

  return "light" as const;
}

function forecastLabel() {
  return "12-month forecast";
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(value: string) {
  return monthFormatter.format(new Date(`${monthKey(value)}-01T00:00:00`));
}

function sectionCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isAttentionPaycheck(paycheck: ForecastPaycheck) {
  if (Number(paycheck.remaining_amount) < RISK_THRESHOLD) {
    return true;
  }

  if (paycheck.status === "overdue") {
    return true;
  }

  return paycheck.assigned_bill_occurrences.some(
    (assignment) => assignment.bill_occurrence.status === "overdue",
  );
}

function buildMonthGroups(paychecks: ForecastPaycheck[]) {
  const groups: PaycheckMonthGroup[] = [];
  let currentGroup: PaycheckMonthGroup | null = null;

  for (const paycheck of paychecks) {
    const key = monthKey(paycheck.occurrence_date);

    if (!currentGroup || currentGroup.key !== key) {
      currentGroup = {
        key,
        label: monthLabel(paycheck.occurrence_date),
        paychecks: [],
        billLoadTotal: 0,
        hasAttention: false,
      };
      groups.push(currentGroup);
    }

    currentGroup.paychecks.push(paycheck);
    currentGroup.billLoadTotal += Number(paycheck.assigned_total);
    currentGroup.hasAttention ||= isAttentionPaycheck(paycheck);
  }

  return groups;
}

function shouldExpandMonth(
  filter: PlanFilter,
  index: number,
  override: boolean | undefined,
) {
  if (override !== undefined) {
    return override;
  }

  if (filter === "all") {
    return index < 2;
  }

  return true;
}

function dueSoonCount(forecast: ForecastResponse) {
  const today = new Date(`${forecast.window.start_date}T00:00:00`);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);

  return forecast.bill_occurrences.filter((bill) => {
    if (bill.status === "skipped") {
      return false;
    }

    const dueDate = new Date(`${bill.due_date}T00:00:00`);

    return dueDate >= today && dueDate <= soon;
  }).length;
}

function ForecastSummaryCard({
  forecast,
  activeForecastLabel,
  attentionCount,
  onJumpToProblem,
}: {
  forecast: ForecastResponse;
  activeForecastLabel: string;
  attentionCount: number;
  onJumpToProblem: () => void;
}) {
  const uncoveredCount = forecast.unassigned_bill_occurrences.length;
  const soonCount = dueSoonCount(forecast);
  const tightestPaycheck = forecast.insights.tightest_paycheck;
  const largestExpense = forecast.insights.largest_expense;

  return (
    <SurfaceCard tone="accent" style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryHeaderCopy}>
          <Text style={styles.summaryTitle}>{activeForecastLabel}</Text>
          <Text style={styles.summarySubtitle}>
            {formatDateWithYear(forecast.window.start_date)} to{" "}
            {formatDateWithYear(forecast.window.end_date)}
          </Text>
        </View>
        {uncoveredCount > 0 || attentionCount > 0 ? (
          <PrimaryButton
            icon="alert-circle-outline"
            label="Jump to first problem"
            onPress={onJumpToProblem}
          />
        ) : null}
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.summaryTile, styles.summaryTileDark]}>
          <Text style={[styles.summaryTileLabel, styles.summaryTileLabelDark]}>
            Needs funding
          </Text>
          <Text style={[styles.summaryTileValue, styles.summaryTileValueDark]}>
            {formatInteger(uncoveredCount)}
          </Text>
        </View>

        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Bills due soon</Text>
          <Text style={styles.summaryTileValue}>
            {formatInteger(soonCount)}
          </Text>
        </View>

        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Tightest paycheck</Text>
          <Text style={styles.summaryTileValue}>
            {tightestPaycheck
              ? formatCurrency(tightestPaycheck.remaining_amount)
              : formatCurrency(0)}
          </Text>
          <Text style={styles.summaryTileMeta}>
            {tightestPaycheck
              ? formatDate(tightestPaycheck.occurrence_date)
              : "No paychecks"}
          </Text>
        </View>

        <View style={styles.summaryTile}>
          <Text style={styles.summaryTileLabel}>Largest bill ahead</Text>
          <Text style={styles.summaryTileValue}>
            {largestExpense
              ? formatCurrency(largestExpense.amount)
              : formatCurrency(0)}
          </Text>
          <Text style={styles.summaryTileMeta}>
            {largestExpense ? formatDate(largestExpense.due_date) : "None"}
          </Text>
        </View>
      </View>
    </SurfaceCard>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected ? styles.filterChipSelected : null,
        pressed ? styles.filterChipPressed : null,
      ]}
    >
      <Text
        style={[
          styles.filterChipLabel,
          selected ? styles.filterChipLabelSelected : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MonthSection({
  group,
  expanded,
  onToggle,
}: {
  group: PaycheckMonthGroup;
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
            {sectionCountLabel(group.paychecks.length, "paycheck", "paychecks")}{" "}
            · {formatCurrency(group.billLoadTotal)} bills queued
          </Text>
        </View>
        <View style={styles.monthHeaderMeta}>
          {group.hasAttention ? (
            <StatusBadge label="Needs attention" tone="warning" />
          ) : null}
          <MaterialCommunityIcons
            color={theme.colors.muted}
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
          />
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.monthCardStack}>
          {group.paychecks.map((paycheck) => (
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
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function PlanScreen() {
  const router = useRouter();
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<PlanFilter>("next3");
  const [expandedMonths, setExpandedMonths] = useState<
    Record<string, boolean | undefined>
  >({});
  const activeForecastLabel = forecastLabel();

  const loadForecast = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const payload = await fetchForecast(365);
      setForecast(payload);
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
      void loadForecast();
    }, [loadForecast]),
  );

  useEffect(() => {
    setExpandedMonths({});
  }, [forecast?.window.end_date, forecast?.window.start_date, selectedFilter]);

  const paychecks = forecast?.paychecks ?? [];
  const attentionPaychecks = paychecks.filter(isAttentionPaycheck);
  const nextThreePaychecks = paychecks.slice(0, 3);

  const filteredPaychecks =
    selectedFilter === "all"
      ? paychecks
      : selectedFilter === "attention"
        ? attentionPaychecks
        : selectedFilter === "next3"
          ? nextThreePaychecks
          : [];

  const monthGroups = buildMonthGroups(filteredPaychecks);
  const showUnfundedSection =
    (forecast?.unassigned_bill_occurrences.length ?? 0) > 0 ||
    selectedFilter === "uncovered";

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
        subtitle="See the next paychecks, pressure points, and anything still waiting for coverage."
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
          <ForecastSummaryCard
            activeForecastLabel={activeForecastLabel}
            attentionCount={attentionPaychecks.length}
            forecast={forecast}
            onJumpToProblem={() => {
              setSelectedFilter(
                forecast.unassigned_bill_occurrences.length > 0
                  ? "uncovered"
                  : "attention",
              );
            }}
          />

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
            subtitle="Start with the next few paychecks or switch to the pressure points that need action."
            title="Paycheck timeline"
          />

          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <FilterChip
              label="Next 3 paychecks"
              onPress={() => {
                setSelectedFilter("next3");
              }}
              selected={selectedFilter === "next3"}
            />
            <FilterChip
              label="Needs attention"
              onPress={() => {
                setSelectedFilter("attention");
              }}
              selected={selectedFilter === "attention"}
            />
            <FilterChip
              label="All"
              onPress={() => {
                setSelectedFilter("all");
              }}
              selected={selectedFilter === "all"}
            />
            <FilterChip
              label="Needs funding only"
              onPress={() => {
                setSelectedFilter("uncovered");
              }}
              selected={selectedFilter === "uncovered"}
            />
          </ScrollView>

          {selectedFilter === "uncovered" ? null : monthGroups.length ? (
            <View style={styles.timelineStack}>
              {monthGroups.map((group, index) => (
                <MonthSection
                  expanded={shouldExpandMonth(
                    selectedFilter,
                    index,
                    expandedMonths[group.key],
                  )}
                  group={group}
                  key={group.key}
                  onToggle={() => {
                    setExpandedMonths((current) => ({
                      ...current,
                      [group.key]: !shouldExpandMonth(
                        selectedFilter,
                        index,
                        current[group.key],
                      ),
                    }));
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              body={
                selectedFilter === "attention"
                  ? "Nothing in this forecast needs attention right now. Switch to all paychecks or the next three to keep scanning the plan."
                  : "Add a paycheck to see how the planner distributes your bills across this forecast."
              }
              title={
                selectedFilter === "attention"
                  ? "No pressure points"
                  : "No paychecks in range"
              }
            />
          )}

          {showUnfundedSection ? (
            <SurfaceCard>
              <SectionTitle
                subtitle="Anything here still needs a paycheck assignment or manual split."
                title="Unfunded items"
              />
              {forecast.unassigned_bill_occurrences.length ? (
                forecast.unassigned_bill_occurrences
                  .slice(0, 8)
                  .map((bill) => (
                    <Row
                      key={String(bill.id)}
                      badge={<StatusBadge label={bill.status} tone="danger" />}
                      subtitle={`Due ${formatDateWithYear(bill.due_date)}`}
                      title={bill.bill?.name ?? "Bill occurrence"}
                      value={formatCurrency(
                        bill.unfunded_amount ?? bill.amount,
                      )}
                      valueTone="danger"
                    />
                  ))
              ) : (
                <EmptyState
                  body="Every visible bill in this forecast already has a paycheck behind it."
                  title="Nothing missing"
                />
              )}
            </SurfaceCard>
          ) : null}
        </>
      ) : null}
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
  filterRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
  },
  filterChip: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: withAlpha(theme.colors.white, 0.82),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  filterChipSelected: {
    borderColor: withAlpha(theme.colors.ink, 0.08),
    backgroundColor: theme.colors.ink,
  },
  filterChipPressed: {
    opacity: 0.86,
  },
  filterChipLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  filterChipLabelSelected: {
    color: theme.colors.white,
  },
  timelineStack: {
    gap: theme.spacing.lg,
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
  monthHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  monthCardStack: {
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
