import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useAuth } from "@features/auth/auth-context";
import { avatarTint, EntityRow } from "@features/money/entity-row";
import { initialOf } from "@features/money/labels";
import {
  buildBillGroups,
  changedBillGroups,
  categoryName,
  billListScheduleLabel,
  type BillGroupKey,
  type BillSort,
} from "@features/money/bill-groups";
import type { Bill } from "@features/planning/api";
import { useBillsQuery } from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatCurrencyPrecise as money } from "@shared/lib/format";
import { ActionSheet, type ActionSheetOption } from "@shared/ui/action-sheet";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

const SORT_OPTIONS: ActionSheetOption<BillSort>[] = [
  { key: "amount", label: "Amount" },
  { key: "name", label: "Name" },
  { key: "schedule", label: "Schedule (calendar order)" },
  { key: "category", label: "Category" },
];
export function BillsSegment() {
  const router = useRouter();
  const { fontScale, width } = useWindowDimensions();
  const largeLayout = fontScale >= 1.3 || width < 360;
  const { user } = useAuth();
  const planningRevision = usePlanningRevision();
  const billsQuery = useBillsQuery({
    revision: planningRevision,
    userId: user?.id,
  });
  const [sort, setSort] = useState<BillSort>("amount");
  const [sortOpen, setSortOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<BillGroupKey>>(new Set());
  const previous = useRef<Bill[] | undefined>(undefined);
  useRefetchStaleOnFocus(billsQuery);
  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const groups = useMemo(() => buildBillGroups(bills, sort), [bills, sort]);
  useEffect(() => {
    if (!billsQuery.data) return;
    if (previous.current) {
      const changed = changedBillGroups(previous.current, bills);
      if (changed.size)
        setCollapsed(
          (current) => new Set([...current].filter((key) => !changed.has(key))),
        );
    }
    previous.current = bills;
  }, [bills, billsQuery.data]);
  const recurring = groups.filter((group) =>
    ["monthly", "yearly", "other", "unknown"].includes(group.key),
  );
  const activeCount = recurring.reduce(
    (sum, group) => sum + group.activeCount,
    0,
  );
  const excluded =
    groups.find((group) => group.key === "unknown")?.activeCount ?? 0;
  const monthly = recurring.reduce((sum, group) => sum + group.monthly, 0);
  if (billsQuery.isPending && !bills.length)
    return <LoadingState label="Loading your bills." />;
  if (billsQuery.error)
    return (
      <ErrorState
        body={getApiErrorMessage(billsQuery.error)}
        onRetry={() => {
          void billsQuery.refetch();
        }}
        title="Bills unavailable"
      />
    );
  if (!bills.length)
    return (
      <EmptyState
        body="Add a bill and it will appear here, grouped by how often you pay it."
        title="No bills yet"
      />
    );
  return (
    <>
      <SurfaceCard style={styles.summary}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <Text
              style={activeCount ? styles.summaryValue : styles.summaryTitle}
            >
              {activeCount
                ? money(monthly)
                : recurring.length
                  ? "No active recurring bills"
                  : "No recurring bills"}
            </Text>
            <View style={styles.summaryCaption}>
              {activeCount ? (
                <Text style={styles.summaryLabel}>
                  {excluded ? "Known monthly equivalent" : "Monthly equivalent"}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="About monthly equivalent"
                onPress={() =>
                  Alert.alert(
                    "Monthly equivalent",
                    "Enabled recurring bills averaged per month, including yearly bills divided by 12. One-time bills and paused bills are excluded. This is an average, not the amount due this month. What’s due next lives on Home.",
                  )
                }
                style={styles.infoButton}
              >
                <Text style={styles.infoGlyph}>ⓘ</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sort bills"
            hitSlop={10}
            onPress={() => setSortOpen(true)}
            style={({ pressed }) => (pressed ? styles.sortPressed : null)}
          >
            <Text style={styles.sort}>Sort</Text>
          </Pressable>
        </View>
        {excluded ? (
          <Text style={styles.summaryBody}>
            {excluded}{" "}
            {excluded === 1
              ? "bill has an unrecognised schedule and is"
              : "bills have unrecognised schedules and are"}{" "}
            excluded from this estimate.
          </Text>
        ) : null}
      </SurfaceCard>
      {groups.map((group) => {
        const expanded = !collapsed.has(group.key);
        const count = `${group.activeCount} active${group.pausedCount ? ` · ${group.pausedCount} paused` : ""}`;
        const total = !group.activeCount
          ? "No active bills"
          : group.key === "monthly"
            ? `${money(group.total)}/month`
            : group.key === "yearly"
              ? `${money(group.total)}/year`
              : group.key === "other"
                ? `Average ${money(group.monthly)}/month`
                : group.key === "unknown"
                  ? "Monthly equivalent unavailable"
                  : `${money(group.total)} total`;
        return (
          <View key={group.key} style={styles.plannedSection}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${group.title}, ${count}, ${total}`}
              accessibilityHint="Show or hide bills in this section"
              onPress={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(group.key)) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                })
              }
              style={styles.sectionButton}
            >
              <View style={styles.sectionHeading}>
                <View
                  style={[
                    styles.headingContent,
                    largeLayout && styles.headingStacked,
                  ]}
                >
                  <Text accessibilityRole="header" style={styles.plannedTitle}>
                    {group.title}
                  </Text>
                  {group.key !== "planned" ? (
                    <Text style={styles.sectionTotal}>{total}</Text>
                  ) : null}
                </View>
                <Text style={styles.chevron}>{expanded ? "−" : "+"}</Text>
              </View>
              <Text style={styles.plannedCount}>{count}</Text>
              {group.key === "yearly" && group.activeCount > 0 ? (
                <Text style={styles.plannedBody}>
                  Equivalent to {money(group.monthly)}/month
                </Text>
              ) : null}
            </Pressable>
            {group.key === "planned" ? (
              <Text style={styles.plannedBody}>
                One-time purchases you checked before adding them to the plan.
              </Text>
            ) : null}
            {expanded ? (
              <View style={styles.rows}>
                {group.rows.map((bill) => (
                  <EntityRow
                    key={String(bill.id)}
                    adaptive
                    dimmed={!bill.is_active}
                    initial={initialOf(bill.name)}
                    title={bill.name}
                    value={money(bill.amount)}
                    subtitle={`${billListScheduleLabel(bill)}${bill.is_active ? "" : " · Paused"}\n${categoryName(bill)}`}
                    tint={avatarTint(bill.bill_category?.color)}
                    onPress={() => router.push(`/bills/${bill.id}`)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      <ActionSheet
        onClose={() => setSortOpen(false)}
        onSelect={setSort}
        options={SORT_OPTIONS}
        title="Sort bills by"
        value={sort}
        visible={sortOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  summaryCopy: { flex: 1 },
  summaryValue: {
    color: theme.colors.ink,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  summaryCaption: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  summaryLabel: { color: theme.colors.muted, fontSize: 14, flexShrink: 1 },
  infoButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  infoGlyph: { color: theme.colors.primaryStrong, fontSize: 19 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  headingContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  headingStacked: { flexDirection: "column", alignItems: "flex-start" },
  sectionTotal: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  chevron: { color: theme.colors.primaryStrong, fontSize: 20 },
  sectionButton: { gap: theme.spacing.xs, paddingVertical: theme.spacing.sm },
  summary: {
    gap: theme.spacing.sm,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  summaryTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sort: {
    color: theme.colors.primaryStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  sortPressed: {
    opacity: 0.7,
  },
  summaryBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  rows: {
    gap: theme.spacing.sm,
  },
  plannedSection: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  plannedTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  plannedCount: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  plannedBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
