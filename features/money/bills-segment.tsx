import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { avatarTint, EntityRow } from "@features/money/entity-row";
import { billCadenceLabel, initialOf } from "@features/money/labels";
import { monthlyTotal } from "@features/money/monthly";
import { type Bill } from "@features/planning/api";
import { useBillsQuery } from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatCurrency, formatDate, formatInteger } from "@shared/lib/format";
import { ActionSheet, type ActionSheetOption } from "@shared/ui/action-sheet";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type BillSort = "amount" | "name" | "dueDay" | "category";

const SORT_OPTIONS: ActionSheetOption<BillSort>[] = [
  { key: "amount", label: "Amount" },
  { key: "name", label: "Name" },
  { key: "dueDay", label: "Due day" },
  { key: "category", label: "Category" },
];

function categoryName(bill: Bill) {
  return bill.bill_category?.name ?? "Uncategorized";
}

function sortBills(bills: Bill[], sort: BillSort) {
  const sorted = [...bills];

  switch (sort) {
    case "amount":
      return sorted.sort((a, b) => Number(b.amount) - Number(a.amount));
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "dueDay":
      // Rules without a day of the month have no place in that order, so they
      // sort to the end rather than pretending to be the 1st.
      return sorted.sort((a, b) => (a.due_day ?? 32) - (b.due_day ?? 32));
    case "category":
      return sorted.sort(
        (a, b) =>
          categoryName(a).localeCompare(categoryName(b)) ||
          a.name.localeCompare(b.name),
      );
  }
}

export function BillsSegment() {
  const router = useRouter();
  const { user } = useAuth();
  const planningRevision = usePlanningRevision();
  const billsQuery = useBillsQuery({
    revision: planningRevision,
    userId: user?.id,
  });
  const [sort, setSort] = useState<BillSort>("amount");
  const [sortOpen, setSortOpen] = useState(false);

  useRefetchStaleOnFocus(billsQuery);

  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const regularBills = useMemo(
    () => bills.filter((bill) => bill.kind !== "planned_expense"),
    [bills],
  );
  const plannedExpenses = useMemo(
    () =>
      bills
        .filter((bill) => bill.kind === "planned_expense")
        .sort((left, right) => left.start_date.localeCompare(right.start_date)),
    [bills],
  );
  const rows = useMemo(
    () => sortBills(regularBills, sort),
    [regularBills, sort],
  );
  const monthly = useMemo(
    () =>
      monthlyTotal(
        regularBills.filter((bill) => bill.is_active),
        (bill) => ({
          amount: bill.amount,
          frequency: bill.frequency,
          intervalValue: bill.interval_value,
        }),
      ),
    [regularBills],
  );

  if (billsQuery.isPending && !bills.length) {
    return <LoadingState label="Loading the bills you owe each month." />;
  }

  if (billsQuery.error) {
    return (
      <ErrorState
        body={getApiErrorMessage(billsQuery.error)}
        onRetry={() => {
          void billsQuery.refetch();
        }}
        title="Bills unavailable"
      />
    );
  }

  if (!bills.length) {
    return (
      <EmptyState
        body="Add the bills you pay on a schedule and they will show up here, with what they cost you in a typical month."
        title="No bills yet"
      />
    );
  }

  return (
    <>
      <SurfaceCard style={styles.summary}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>
            {`${formatInteger(regularBills.length)} ${regularBills.length === 1 ? "bill" : "bills"} · ${formatCurrency(monthly)} a month`}
          </Text>
          <Pressable
            hitSlop={10}
            onPress={() => {
              setSortOpen(true);
            }}
            style={({ pressed }) => (pressed ? styles.sortPressed : null)}
          >
            <Text style={styles.sort}>Sort</Text>
          </Pressable>
        </View>
        <Text style={styles.summaryBody}>
          This is the list of bills you owe every month. What&apos;s due next
          lives on Home.
        </Text>
      </SurfaceCard>

      <View style={styles.rows}>
        {rows.map((bill) => (
          <EntityRow
            key={String(bill.id)}
            dimmed={!bill.is_active}
            initial={initialOf(bill.name)}
            onPress={() => {
              router.push(`/bills/${bill.id}`);
            }}
            subtitle={`${categoryName(bill)} · ${billCadenceLabel(bill)}${bill.is_active ? "" : " · paused"}`}
            tint={avatarTint(bill.bill_category?.color)}
            title={bill.name}
            value={formatCurrency(bill.amount)}
          />
        ))}
      </View>

      {plannedExpenses.length ? (
        <View style={styles.plannedSection}>
          <View style={styles.plannedHeader}>
            <Text style={styles.plannedTitle}>Planned purchases</Text>
            <Text style={styles.plannedCount}>
              {formatInteger(plannedExpenses.length)}
            </Text>
          </View>
          <Text style={styles.plannedBody}>
            One-time purchases you checked before adding them to the plan.
          </Text>
          <View style={styles.rows}>
            {plannedExpenses.map((bill) => (
              <EntityRow
                key={String(bill.id)}
                dimmed={!bill.is_active}
                initial={initialOf(bill.name)}
                onPress={() => {
                  router.push(`/bills/${bill.id}`);
                }}
                subtitle={`Planned for ${formatDate(bill.start_date)}${bill.is_active ? "" : " · paused"}`}
                tint={theme.colors.primarySoft}
                title={bill.name}
                value={formatCurrency(bill.amount)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <ActionSheet
        onClose={() => {
          setSortOpen(false);
        }}
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
  summary: {
    gap: theme.spacing.sm,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "baseline",
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
  plannedHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  plannedTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  plannedCount: {
    color: theme.colors.primaryStrong,
    fontSize: 14,
    fontWeight: "800",
  },
  plannedBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
