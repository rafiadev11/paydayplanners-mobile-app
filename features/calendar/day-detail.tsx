import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  billAmount,
  findNextEventAfter,
  isBillShort,
  paycheckAmount,
  unfundedAmount,
  type CalendarDay,
  type CalendarDayMap,
  type PaycheckBounds,
} from "@features/calendar/calendar-data";
import {
  updateBillOccurrenceStatus,
  type BillOccurrence,
  type BillOccurrenceStatus,
  type ForecastPaycheck,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  formatCurrency,
  formatDate,
  formatMonthDayLong,
  formatWeekdayDate,
} from "@shared/lib/format";
import {
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type RailTone = "income" | "bill" | "danger" | "success" | "quiet";

type DayDetailProps = {
  date: string;
  day: CalendarDay | undefined;
  days: CalendarDayMap;
  bounds: PaycheckBounds;
  today: string;
  onChanged: () => void;
};

const railColors: Record<RailTone, string> = {
  income: theme.colors.primary,
  bill: theme.colors.accent,
  danger: theme.colors.danger,
  success: theme.colors.success,
  quiet: theme.colors.borderStrong,
};

function EventCard({
  tone,
  title,
  subtitle,
  subtitleTone,
  detail,
  amount,
  amountTone,
  strikeAmount,
  action,
  onPress,
  accessibilityLabel,
}: {
  tone: RailTone;
  title: string;
  subtitle: string;
  subtitleTone?: "muted" | "danger";
  detail?: string;
  amount?: string;
  amountTone?: "ink" | "success" | "muted";
  strikeAmount?: boolean;
  action?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <SurfaceCard style={styles.card}>
      <View style={[styles.rail, { backgroundColor: railColors[tone] }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text
              style={[
                styles.cardSubtitle,
                subtitleTone === "danger" ? styles.cardSubtitleDanger : null,
              ]}
            >
              {subtitle}
            </Text>
          </View>
          {amount ? (
            <Text
              style={[
                styles.amount,
                amountTone === "success" ? styles.amountSuccess : null,
                amountTone === "muted" ? styles.amountMuted : null,
                strikeAmount ? styles.amountStruck : null,
              ]}
            >
              {amount}
            </Text>
          ) : null}
        </View>
        {detail ? <Text style={styles.cardDetail}>{detail}</Text> : null}
        {action ? <View style={styles.cardAction}>{action}</View> : null}
      </View>
    </SurfaceCard>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? styles.cardPressed : null)}
    >
      {body}
    </Pressable>
  );
}

function paycheckSubtitle(paycheck: ForecastPaycheck) {
  switch (paycheck.status) {
    case "received":
      return "Paycheck received";
    case "confirmed":
      return "Paycheck confirmed";
    case "skipped":
      return "Skipped — not counted";
    default:
      return "Paycheck lands";
  }
}

/** "Covers $1,128 in bills · $250 to savings · $762 yours" */
function paycheckDetail(paycheck: ForecastPaycheck) {
  if (paycheck.status === "skipped") {
    return undefined;
  }

  const assigned = Number(paycheck.assigned_total ?? 0);
  const savings = Number(paycheck.savings_goal_total ?? 0);
  const remaining = Number(paycheck.remaining_amount ?? 0);
  const parts: string[] = [];

  parts.push(
    assigned > 0
      ? `Covers ${formatCurrency(assigned)} in bills`
      : "No bills assigned yet",
  );

  if (savings > 0) {
    parts.push(`${formatCurrency(savings)} to savings`);
  }

  parts.push(
    remaining < 0
      ? `${formatCurrency(Math.abs(remaining))} short`
      : `${formatCurrency(remaining)} yours`,
  );

  return parts.join("  ·  ");
}

/**
 * Bills are paid from the most recent paycheck on or *before* the due date, so
 * "short" has three different causes. Naming which one it is matters more than
 * the shortfall figure — each points at a different fix.
 */
function billSubtitle(bill: BillOccurrence, bounds: PaycheckBounds) {
  if (bill.status === "paid") {
    return { text: "Paid", tone: "muted" as const };
  }

  if (bill.status === "skipped") {
    return { text: "Skipped — not counted", tone: "muted" as const };
  }

  const unfunded = unfundedAmount(bill);

  if (unfunded > 0) {
    const coveredBy = bill.assigned_paycheck_occurrence?.occurrence_date;

    // Partly funded: a paycheck is attached but does not cover the whole bill.
    if (coveredBy) {
      return {
        text: `Short ${formatCurrency(unfunded)} — the ${formatDate(coveredBy)} paycheck covers the rest`,
        tone: "danger" as const,
      };
    }

    if (bounds.first && bill.due_date < bounds.first) {
      return {
        text: `Due before your first paycheck on ${formatDate(bounds.first)}`,
        tone: "danger" as const,
      };
    }

    if (bounds.last && bill.due_date > bounds.last) {
      return {
        text: "No paycheck scheduled before this date yet",
        tone: "danger" as const,
      };
    }

    return {
      text: `Short ${formatCurrency(unfunded)} — no paycheck covers this yet`,
      tone: "danger" as const,
    };
  }

  if (bill.status === "overdue") {
    return { text: "Overdue", tone: "danger" as const };
  }

  const coveredBy = bill.assigned_paycheck_occurrence?.occurrence_date;

  return {
    text: coveredBy
      ? `Covered by ${formatWeekdayDate(coveredBy)} paycheck`
      : "Not covered by a paycheck yet",
    tone: "muted" as const,
  };
}

function billRailTone(bill: BillOccurrence): RailTone {
  if (bill.status === "paid") return "success";
  if (bill.status === "skipped") return "quiet";
  if (isBillShort(bill)) return "danger";

  return "bill";
}

export function DayDetail({
  date,
  day,
  days,
  bounds,
  today,
  onChanged,
}: DayDetailProps) {
  const router = useRouter();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<
    Record<string, BillOccurrenceStatus>
  >({});
  const [error, setError] = useState<string | null>(null);

  const serverBills = useMemo(() => day?.bills ?? [], [day]);

  // Once the refetched forecast agrees with an optimistic flip, stop overriding.
  useEffect(() => {
    setOptimistic((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([id, status]) => {
          const bill = serverBills.find(
            (candidate) => String(candidate.id) === id,
          );

          return bill !== undefined && bill.status !== status;
        }),
      );

      return Object.keys(next).length === Object.keys(current).length
        ? current
        : next;
    });
  }, [serverBills]);

  const bills = useMemo(
    () =>
      serverBills.map((bill) => {
        const override = optimistic[String(bill.id)];

        return override ? { ...bill, status: override } : bill;
      }),
    [optimistic, serverBills],
  );

  const toggle = useCallback(
    async (bill: BillOccurrence) => {
      const id = String(bill.id);
      const nextStatus: BillOccurrenceStatus =
        bill.status === "paid" ? "projected" : "paid";

      setError(null);
      setOptimistic((current) => ({ ...current, [id]: nextStatus }));
      setPendingIds((current) => new Set(current).add(id));

      try {
        await updateBillOccurrenceStatus(id, nextStatus);
        onChanged();
      } catch (nextError) {
        setOptimistic((current) => {
          const { [id]: _discarded, ...rest } = current;

          return rest;
        });
        setError(getApiErrorMessage(nextError));
      } finally {
        setPendingIds((current) => {
          const next = new Set(current);
          next.delete(id);

          return next;
        });
      }
    },
    [onChanged],
  );

  const paychecks = day?.paychecks ?? [];
  const activeBills = bills.filter((bill) => bill.status !== "skipped");
  const isToday = date === today;

  // Each call scans the whole 13-month day map, and the answer is only needed
  // when the day has nothing due — so both stay inside the lazy branch.
  const quietSubtitle = () => {
    const nextBill = findNextEventAfter(days, date, true);

    if (nextBill) {
      return `Next bill is ${formatDate(nextBill)}`;
    }

    const nextAnything = findNextEventAfter(days, date);

    return nextAnything
      ? `Next paycheck is ${formatDate(nextAnything)}`
      : "Nothing else scheduled ahead";
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text style={styles.headingTitle}>{formatMonthDayLong(date)}</Text>
        {isToday ? <StatusBadge label="Today" tone="primary" /> : null}
      </View>

      {paychecks.map((paycheck) => (
        <EventCard
          amount={`+${formatCurrency(paycheckAmount(paycheck))}`}
          amountTone={paycheck.status === "skipped" ? "muted" : "success"}
          detail={paycheckDetail(paycheck)}
          key={`paycheck-${paycheck.id}`}
          strikeAmount={paycheck.status === "skipped"}
          subtitle={paycheckSubtitle(paycheck)}
          title={paycheck.pay_schedule?.name ?? "Paycheck"}
          tone={paycheck.status === "skipped" ? "quiet" : "income"}
        />
      ))}

      {activeBills.length === 0 ? (
        <EventCard
          subtitle={quietSubtitle()}
          title={isToday ? "Nothing due today" : "Nothing due"}
          tone="quiet"
        />
      ) : null}

      {bills.map((bill) => {
        const id = String(bill.id);
        const subtitle = billSubtitle(bill, bounds);
        const paid = bill.status === "paid";
        const pending = pendingIds.has(id);

        return (
          <EventCard
            accessibilityLabel={`${bill.bill?.name ?? "Bill"}, ${formatCurrency(billAmount(bill))}, ${subtitle.text}. Opens bill details.`}
            action={
              bill.status === "skipped" ? undefined : (
                <SecondaryButton
                  disabled={pending}
                  label={pending ? "Saving…" : paid ? "Undo" : "Mark paid"}
                  onPress={() => {
                    void toggle(bill);
                  }}
                  size="sm"
                />
              )
            }
            amount={formatCurrency(billAmount(bill))}
            amountTone={paid || bill.status === "skipped" ? "muted" : "ink"}
            key={`bill-${id}`}
            onPress={
              bill.bill_id
                ? () => {
                    router.push(`/bills/${bill.bill_id}`);
                  }
                : undefined
            }
            strikeAmount={paid || bill.status === "skipped"}
            subtitle={subtitle.text}
            subtitleTone={subtitle.tone}
            title={bill.bill?.name ?? "Bill"}
            tone={billRailTone(bill)}
          />
        );
      })}

      {paychecks.length === 0 && bills.length === 0 && !isToday ? (
        <View style={styles.hintRow}>
          <MaterialCommunityIcons
            color={theme.colors.muted}
            name="information-outline"
            size={14}
          />
          <Text style={styles.hint}>Tap any day to see what lands on it.</Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
  },
  headingTitle: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  cardPressed: {
    opacity: 0.7,
  },
  rail: {
    width: 4,
    borderRadius: theme.radius.pill,
  },
  cardBody: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  cardCopy: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardSubtitleDanger: {
    color: theme.colors.danger,
  },
  cardDetail: {
    color: theme.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  cardAction: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  amount: {
    color: theme.colors.ink,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  amountSuccess: {
    color: theme.colors.success,
  },
  amountMuted: {
    color: theme.colors.muted,
  },
  amountStruck: {
    textDecorationLine: "line-through",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
  },
  hint: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: theme.spacing.xs,
  },
});
