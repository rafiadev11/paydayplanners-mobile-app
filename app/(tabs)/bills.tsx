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

import { useAuth } from "@features/auth/auth-context";
import { BillingBanner } from "@features/billing/components";
import {
  fetchBillOccurrences,
  fetchBills,
  type Bill,
  type BillOccurrence,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDateWithYear,
  formatFrequency,
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

type BillFilter = "all" | "dueSoon" | "recurring" | "oneTime" | "paused";

function outstandingOccurrences(occurrences: BillOccurrence[]) {
  return occurrences.filter(
    (occurrence) =>
      occurrence.status !== "paid" && occurrence.status !== "skipped",
  );
}

function daysUntil(value: string) {
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const target = new Date(`${value}T00:00:00`);

  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

function monthlyRecurringLoad(bills: Bill[]) {
  return bills
    .filter((bill) => bill.is_active && bill.frequency === "monthly")
    .reduce((total, bill) => total + Number(bill.amount), 0);
}

function buildNextOccurrenceMap(occurrences: BillOccurrence[]) {
  const nextByBill = new Map<string, BillOccurrence>();

  for (const occurrence of occurrences) {
    const billId = String(occurrence.bill?.id ?? occurrence.bill_id ?? "");

    if (billId !== "" && !nextByBill.has(billId)) {
      nextByBill.set(billId, occurrence);
    }
  }

  return nextByBill;
}

function occurrenceState(occurrence: BillOccurrence) {
  if (occurrence.status === "overdue") {
    return {
      label: "overdue",
      tone: "danger" as const,
    };
  }

  if (Number(occurrence.unfunded_amount ?? 0) > 0) {
    return {
      label: "needs funding",
      tone: "warning" as const,
    };
  }

  return {
    label: "upcoming",
    tone: "primary" as const,
  };
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

function BillsSummaryCard({
  nextDue,
  dueIn14Days,
  uncoveredCount,
  monthlyLoad,
  canCreateBill,
  onAddBill,
  onOpenBilling,
}: {
  nextDue: BillOccurrence | null;
  dueIn14Days: number;
  uncoveredCount: number;
  monthlyLoad: number;
  canCreateBill: boolean;
  onAddBill: () => void;
  onOpenBilling: () => void;
}) {
  return (
    <SurfaceCard tone="dark" style={styles.summaryCard}>
      <View style={styles.summaryHeader}>
        <View style={styles.summaryHeaderCopy}>
          <Text style={styles.summaryEyebrow}>Due next</Text>
          <Text style={styles.summaryTitle}>
            {nextDue?.bill?.name ?? "No bill due right now"}
          </Text>
          <Text style={styles.summaryBody}>
            {nextDue
              ? `Due ${formatDateWithYear(nextDue.due_date)}`
              : "Everything in the current window is covered and on track."}
          </Text>
        </View>
        <Text style={styles.summaryAmount}>
          {formatCurrency(nextDue?.effective_amount ?? nextDue?.amount ?? 0)}
        </Text>
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Due in 14 days</Text>
          <Text style={styles.summaryStatValue}>
            {formatInteger(dueIn14Days)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Needs funding</Text>
          <Text style={styles.summaryStatValue}>
            {formatInteger(uncoveredCount)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Text style={styles.summaryStatLabel}>Monthly recurring</Text>
          <Text style={styles.summaryStatValue}>
            {formatCurrency(monthlyLoad)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryActions}>
        <PrimaryButton
          icon={canCreateBill ? "receipt-text-plus-outline" : "crown-outline"}
          label={canCreateBill ? "Add bill" : "Unlock Pro"}
          onPress={canCreateBill ? onAddBill : onOpenBilling}
        />
      </View>
    </SurfaceCard>
  );
}

function BillCard({
  bill,
  nextOccurrence,
  onEdit,
}: {
  bill: Bill;
  nextOccurrence: BillOccurrence | null;
  onEdit: () => void;
}) {
  return (
    <SurfaceCard style={styles.billCard}>
      <View style={styles.billHeader}>
        <View style={styles.billHeaderCopy}>
          <View style={styles.billTitleRow}>
            <Text style={styles.billTitle}>{bill.name}</Text>
            <StatusBadge
              label={bill.is_active ? "active" : "paused"}
              tone={bill.is_active ? "success" : "warning"}
            />
          </View>
          <Text style={styles.billSubtitle}>
            {formatFrequency(bill.frequency)}
            {bill.is_subscription ? " subscription" : ""}
          </Text>
        </View>
        <Text style={styles.billAmount}>{formatCurrency(bill.amount)}</Text>
      </View>

      <View style={styles.billMetaGrid}>
        <View style={styles.billMetaTile}>
          <Text style={styles.billMetaLabel}>Next due</Text>
          <Text style={styles.billMetaValue}>
            {nextOccurrence
              ? formatDateWithYear(nextOccurrence.due_date)
              : "No due date in window"}
          </Text>
        </View>
        <View style={styles.billMetaTile}>
          <Text style={styles.billMetaLabel}>Cadence</Text>
          <Text style={styles.billMetaValue}>
            {bill.frequency === "monthly"
              ? `Day ${bill.due_day ?? "--"}`
              : formatFrequency(bill.frequency)}
          </Text>
        </View>
      </View>

      {bill.bill_category ? (
        <View style={styles.categoryRow}>
          <StatusBadge label={bill.bill_category.name} tone="primary" />
        </View>
      ) : null}

      <SecondaryButton
        icon="pencil-outline"
        label="Edit bill"
        onPress={onEdit}
      />
    </SurfaceCard>
  );
}

export default function BillsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<BillFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [nextBills, nextOccurrences] = await Promise.all([
          fetchBills(),
          fetchBillOccurrences(user?.billing?.has_pro_access ? 365 : 90),
        ]);

        setBills(nextBills);
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
    setSelectedFilter("all");
  }, [bills.length]);

  const outstanding = outstandingOccurrences(occurrences);
  const nextOccurrenceMap = buildNextOccurrenceMap(outstanding);
  const nextDue = outstanding[0] ?? null;
  const dueSoon = outstanding.filter((occurrence) => {
    const days = daysUntil(occurrence.due_date);

    return days >= 0 && days <= 30;
  });
  const dueIn14Days = outstanding.filter((occurrence) => {
    const days = daysUntil(occurrence.due_date);

    return days >= 0 && days <= 14;
  }).length;
  const needsAttention = outstanding.filter(
    (occurrence) =>
      occurrence.status === "overdue" ||
      Number(occurrence.unfunded_amount ?? 0) > 0,
  );
  const canCreateBill =
    Boolean(user?.billing?.has_pro_access) || bills.length < 12;

  const filteredBills =
    selectedFilter === "all"
      ? bills
      : selectedFilter === "dueSoon"
        ? bills.filter((bill) => {
            const occurrence = nextOccurrenceMap.get(String(bill.id));

            return occurrence ? daysUntil(occurrence.due_date) <= 30 : false;
          })
        : selectedFilter === "recurring"
          ? bills.filter((bill) => bill.frequency !== "once")
          : selectedFilter === "oneTime"
            ? bills.filter((bill) => bill.frequency === "once")
            : bills.filter((bill) => !bill.is_active);

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
        subtitle="See what is due next, what still needs coverage, and the bill rules driving your plan."
        title="Bills"
      />

      {loading ? (
        <LoadingState label="Loading bills and upcoming due dates." />
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
          {bills.length > 0 ? (
            <BillingBanner billing={user?.billing} compact />
          ) : null}

          <BillsSummaryCard
            canCreateBill={canCreateBill}
            dueIn14Days={dueIn14Days}
            monthlyLoad={monthlyRecurringLoad(bills)}
            nextDue={nextDue}
            onAddBill={() => {
              router.push("/bills/new");
            }}
            onOpenBilling={() => {
              router.push("/billing");
            }}
            uncoveredCount={
              needsAttention.filter(
                (occurrence) => Number(occurrence.unfunded_amount ?? 0) > 0,
              ).length
            }
          />

          {needsAttention.length ? (
            <>
              <SectionTitle
                subtitle="These items are overdue or not fully backed by income yet."
                title="Needs attention"
              />
              <SurfaceCard>
                {needsAttention.slice(0, 5).map((occurrence) => {
                  const state = occurrenceState(occurrence);

                  return (
                    <Row
                      key={String(occurrence.id)}
                      badge={
                        <StatusBadge label={state.label} tone={state.tone} />
                      }
                      subtitle={`Due ${formatDateWithYear(occurrence.due_date)}`}
                      title={occurrence.bill?.name ?? "Bill occurrence"}
                      value={formatCurrency(
                        occurrence.unfunded_amount ?? occurrence.amount,
                      )}
                      valueTone="danger"
                    />
                  );
                })}
              </SurfaceCard>
            </>
          ) : (
            <SurfaceCard tone="accent">
              <SectionTitle
                subtitle="All current bills in the planning window are covered and on time."
                title="Nothing urgent"
              />
            </SurfaceCard>
          )}

          <SectionTitle
            subtitle="The next upcoming due dates in the visible planning window."
            title="Due soon"
          />
          {dueSoon.length ? (
            <SurfaceCard>
              {dueSoon.slice(0, 6).map((occurrence) => {
                const state = occurrenceState(occurrence);

                return (
                  <Row
                    key={String(occurrence.id)}
                    badge={
                      <StatusBadge label={state.label} tone={state.tone} />
                    }
                    subtitle={`Due ${formatDateWithYear(occurrence.due_date)}`}
                    title={occurrence.bill?.name ?? "Bill occurrence"}
                    value={formatCurrency(
                      occurrence.effective_amount ?? occurrence.amount,
                    )}
                    valueTone={state.tone === "danger" ? "danger" : "default"}
                  />
                );
              })}
            </SurfaceCard>
          ) : (
            <EmptyState
              body="Once bills exist in the planning window, upcoming due dates will show here."
              title="Nothing due soon"
            />
          )}

          <SectionTitle
            action={
              <SecondaryButton
                icon={
                  canCreateBill ? "receipt-text-plus-outline" : "crown-outline"
                }
                label={canCreateBill ? "Add bill" : "Unlock Pro"}
                onPress={() => {
                  router.push(canCreateBill ? "/bills/new" : "/billing");
                }}
              />
            }
            subtitle="Filter your bill rules by urgency and type, then jump into edits quickly."
            title="Your bills"
          />

          <ScrollView
            contentContainerStyle={styles.filterRow}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <FilterChip
              label="All"
              onPress={() => {
                setSelectedFilter("all");
              }}
              selected={selectedFilter === "all"}
            />
            <FilterChip
              label="Due soon"
              onPress={() => {
                setSelectedFilter("dueSoon");
              }}
              selected={selectedFilter === "dueSoon"}
            />
            <FilterChip
              label="Recurring"
              onPress={() => {
                setSelectedFilter("recurring");
              }}
              selected={selectedFilter === "recurring"}
            />
            <FilterChip
              label="One-time"
              onPress={() => {
                setSelectedFilter("oneTime");
              }}
              selected={selectedFilter === "oneTime"}
            />
            <FilterChip
              label="Paused"
              onPress={() => {
                setSelectedFilter("paused");
              }}
              selected={selectedFilter === "paused"}
            />
          </ScrollView>

          {filteredBills.length ? (
            <View style={styles.billStack}>
              {filteredBills.map((bill) => (
                <BillCard
                  bill={bill}
                  key={String(bill.id)}
                  nextOccurrence={
                    nextOccurrenceMap.get(String(bill.id)) ?? null
                  }
                  onEdit={() => {
                    router.push(`/bills/${bill.id}`);
                  }}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              body={
                selectedFilter === "all"
                  ? "Create your first recurring or one-time bill to see how each paycheck gets reduced."
                  : "No bills match this filter right now."
              }
              title={selectedFilter === "all" ? "No bills yet" : "Nothing here"}
            />
          )}
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
  summaryEyebrow: {
    color: withAlpha(theme.colors.white, 0.72),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  summaryTitle: {
    color: theme.colors.white,
    ...theme.typography.title,
  },
  summaryBody: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  summaryAmount: {
    color: theme.colors.white,
    ...theme.typography.metricCompact,
  },
  summaryStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    padding: theme.spacing.md,
  },
  summaryStat: {
    flex: 1,
    gap: 4,
  },
  summaryStatLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  summaryStatValue: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  summaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withAlpha(theme.colors.white, 0.12),
  },
  summaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
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
  billStack: {
    gap: theme.spacing.md,
  },
  billCard: {
    gap: theme.spacing.lg,
  },
  billHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  billHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  billTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  billTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  billSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  billAmount: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  billMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  billMetaTile: {
    flex: 1,
    minWidth: 140,
    gap: 4,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.primarySoft, 0.44),
    padding: theme.spacing.md,
  },
  billMetaLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  billMetaValue: {
    color: theme.colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
