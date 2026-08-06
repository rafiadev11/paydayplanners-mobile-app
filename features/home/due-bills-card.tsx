import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  updateBillOccurrenceStatus,
  type BillOccurrence,
  type BillOccurrenceStatus,
  type DashboardResponse,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDateChipParts,
  formatWeekdayDate,
} from "@shared/lib/format";
import { SecondaryButton, SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

const COLLAPSED_ROW_COUNT = 6;

type DueBillRow = {
  id: string;
  name: string;
  dueDate: string;
  amount: string;
  status: string;
  unfunded: number;
  coveredBy: string | null;
};

function toRow(
  occurrence: BillOccurrence,
  fallbackCoveredBy: string | null,
  hasFundingData: boolean,
): DueBillRow {
  const unfunded = hasFundingData ? Number(occurrence.unfunded_amount ?? 0) : 0;
  const assignedDate = occurrence.assigned_paycheck_occurrence?.occurrence_date;

  return {
    id: String(occurrence.id),
    name: occurrence.bill?.name ?? "Bill",
    dueDate: occurrence.due_date,
    amount: occurrence.effective_amount ?? occurrence.amount,
    status: occurrence.status,
    unfunded,
    coveredBy:
      unfunded > 0
        ? null
        : assignedDate
          ? formatWeekdayDate(assignedDate)
          : fallbackCoveredBy,
  };
}

/**
 * The two dashboard lists overlap: a bill due exactly on payday appears in
 * both. Only `bills_due_before_next_paycheck` carries funding attributes, so it
 * wins on conflict — items from `next_paycheck_bill_occurrences` are covered by
 * definition and must not be read for `unfunded_amount`.
 */
export function buildDueBillRows(dashboard: DashboardResponse): DueBillRow[] {
  const paydayLabel = dashboard.next_paycheck
    ? formatWeekdayDate(dashboard.next_paycheck.occurrence_date)
    : null;
  const rows = new Map<string, DueBillRow>();

  for (const occurrence of dashboard.next_paycheck_bill_occurrences ?? []) {
    const row = toRow(occurrence, paydayLabel, false);
    rows.set(row.id, row);
  }

  for (const occurrence of dashboard.bills_due_before_next_paycheck ?? []) {
    const row = toRow(occurrence, paydayLabel, true);
    rows.set(row.id, row);
  }

  return [...rows.values()]
    .filter((row) => row.status !== "skipped")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function DateChip({
  dueDate,
  tone,
}: {
  dueDate: string;
  tone: "neutral" | "short" | "paid";
}) {
  const { month, day } = formatDateChipParts(dueDate);

  if (tone === "paid") {
    return (
      <View style={[styles.chip, styles.chipPaid]}>
        <MaterialCommunityIcons
          color={theme.colors.success}
          name="check"
          size={24}
        />
      </View>
    );
  }

  return (
    <View style={[styles.chip, tone === "short" ? styles.chipShort : null]}>
      <Text
        style={[
          styles.chipMonth,
          tone === "short" ? styles.chipTextShort : null,
        ]}
      >
        {month}
      </Text>
      <Text
        style={[styles.chipDay, tone === "short" ? styles.chipTextShort : null]}
      >
        {day}
      </Text>
    </View>
  );
}

function BillRow({
  row,
  pending,
  onToggle,
}: {
  row: DueBillRow;
  pending: boolean;
  onToggle: (row: DueBillRow) => void;
}) {
  const paid = row.status === "paid";
  const short = !paid && row.unfunded > 0;
  const subtitle = paid
    ? "Paid"
    : short
      ? `Short ${formatCurrency(row.unfunded)} — no paycheck covers this yet`
      : row.coveredBy
        ? `Covered by ${row.coveredBy} paycheck`
        : "Not covered by a paycheck yet";

  return (
    <SurfaceCard style={[styles.row, paid ? styles.rowPaid : null]}>
      <DateChip
        dueDate={row.dueDate}
        tone={paid ? "paid" : short ? "short" : "neutral"}
      />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, paid ? styles.rowTitlePaid : null]}>
          {row.name}
        </Text>
        <Text
          style={[styles.rowSubtitle, short ? styles.rowSubtitleShort : null]}
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <Text style={[styles.rowAmount, paid ? styles.rowAmountPaid : null]}>
          {formatCurrency(row.amount)}
        </Text>
        <SecondaryButton
          disabled={pending}
          label={pending ? "Saving…" : paid ? "Undo" : "Mark paid"}
          onPress={() => {
            onToggle(row);
          }}
          size="sm"
        />
      </View>
    </SurfaceCard>
  );
}

export function DueBillsCard({ dashboard }: { dashboard: DashboardResponse }) {
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<
    Record<string, BillOccurrenceStatus>
  >({});
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serverRows = useMemo(() => buildDueBillRows(dashboard), [dashboard]);

  // Once the refetched dashboard agrees with an optimistic flip, stop overriding.
  useEffect(() => {
    setOptimistic((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([id, status]) => {
          const row = serverRows.find((candidate) => candidate.id === id);

          return row !== undefined && row.status !== status;
        }),
      );

      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [serverRows]);

  const rows = useMemo(
    () =>
      serverRows.map((row) =>
        optimistic[row.id] ? { ...row, status: optimistic[row.id] } : row,
      ),
    [optimistic, serverRows],
  );

  const toggle = useCallback(async (row: DueBillRow) => {
    const nextStatus: BillOccurrenceStatus =
      row.status === "paid" ? "projected" : "paid";

    setError(null);
    setOptimistic((current) => ({ ...current, [row.id]: nextStatus }));
    setPendingIds((current) => new Set(current).add(row.id));

    try {
      await updateBillOccurrenceStatus(row.id, nextStatus);
    } catch (nextError) {
      setOptimistic((current) => {
        const { [row.id]: _discarded, ...rest } = current;

        return rest;
      });
      setError(getApiErrorMessage(nextError));
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(row.id);

        return next;
      });
    }
  }, []);

  if (!rows.length) {
    return null;
  }

  const paidCount = rows.filter((row) => row.status === "paid").length;
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROW_COUNT);
  const hiddenCount = rows.length - visible.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>This paycheck&apos;s bills</Text>
        <Text style={styles.counter}>
          {`${rows.length - paidCount} left · ${paidCount} paid`}
        </Text>
      </View>

      {visible.map((row) => (
        <BillRow
          key={row.id}
          onToggle={(target) => {
            void toggle(target);
          }}
          pending={pendingIds.has(row.id)}
          row={row}
        />
      ))}

      {hiddenCount > 0 || expanded ? (
        <Pressable
          onPress={() => {
            setExpanded((current) => !current);
          }}
          style={({ pressed }) => [
            styles.expander,
            pressed ? styles.expanderPressed : null,
          ]}
        >
          <Text style={styles.expanderLabel}>
            {expanded ? "Show less" : `Show all ${rows.length}`}
          </Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  counter: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  rowPaid: {
    opacity: 0.7,
  },
  chip: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  chipShort: {
    backgroundColor: theme.colors.dangerSoft,
  },
  chipPaid: {
    backgroundColor: theme.colors.successSoft,
  },
  chipMonth: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  chipDay: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  chipTextShort: {
    color: theme.colors.danger,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  rowTitlePaid: {
    color: theme.colors.muted,
  },
  rowSubtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  rowSubtitleShort: {
    color: theme.colors.danger,
  },
  rowActions: {
    alignItems: "flex-end",
    gap: theme.spacing.sm,
  },
  rowAmount: {
    color: theme.colors.ink,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  rowAmountPaid: {
    color: theme.colors.muted,
    textDecorationLine: "line-through",
  },
  expander: {
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  expanderPressed: {
    opacity: 0.7,
  },
  expanderLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
  },
});
