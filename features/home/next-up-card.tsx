import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  type BillOccurrence,
  type DashboardResponse,
} from "@features/planning/api";
import {
  formatCurrency,
  formatLongWeekdayDate,
  formatWeekdayDate,
} from "@shared/lib/format";
import { todayInAppTimezone } from "@shared/lib/timezone";
import {
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

type NextPaycheck = NonNullable<DashboardResponse["next_paycheck"]>;

export type HomeHeroState =
  | { kind: "welcome" }
  | { kind: "no-paycheck" }
  | { kind: "no-upcoming" }
  | { kind: "no-bills"; paycheck: NextPaycheck }
  | { kind: "ready"; paycheck: NextPaycheck };

const HEADER_TITLES: Record<HomeHeroState["kind"], string> = {
  welcome: "Welcome",
  "no-paycheck": "Get started",
  "no-upcoming": "Needs a date",
  "no-bills": "Almost there",
  ready: "Next up",
};

/**
 * Picks which hero the home screen leads with. `hasPaySchedules` and `hasBills`
 * are null while their gated queries have not run, and every null path falls
 * back to the safest onboarding copy rather than guessing.
 */
export function resolveHomeHeroState({
  dashboard,
  isFirstOpen,
  hasPaySchedules,
  hasBills,
}: {
  dashboard: DashboardResponse;
  isFirstOpen: boolean | null;
  hasPaySchedules: boolean | null;
  hasBills: boolean | null;
}): HomeHeroState {
  const paycheck = dashboard.next_paycheck;

  if (!paycheck) {
    if (isFirstOpen) return { kind: "welcome" };
    if (hasPaySchedules) return { kind: "no-upcoming" };

    return { kind: "no-paycheck" };
  }

  if (hasBills === false) {
    return { kind: "no-bills", paycheck };
  }

  return { kind: "ready", paycheck };
}

export function homeHeaderTitle(state: HomeHeroState) {
  return HEADER_TITLES[state.kind];
}

function isUncovered(occurrence: BillOccurrence) {
  if (occurrence.status === "paid" || occurrence.status === "skipped") {
    return false;
  }

  if (occurrence.unfunded_amount != null) {
    return Number(occurrence.unfunded_amount) > 0;
  }

  return !occurrence.assigned_paycheck_occurrence_id;
}

function coverageLine(dashboard: DashboardResponse, paydayLabel: string) {
  // Paid and skipped bills are still returned in this list, but neither is
  // something the user has left to handle.
  const due = dashboard.bills_due_before_next_paycheck.filter(
    (occurrence) =>
      occurrence.status !== "paid" && occurrence.status !== "skipped",
  );

  if (!due.length) {
    return `Nothing else is due before ${paydayLabel}.`;
  }

  const uncovered = due.filter(isUncovered).length;

  if (uncovered === 1) {
    return `1 bill due before ${paydayLabel} isn't covered yet.`;
  }

  if (uncovered > 1) {
    return `${uncovered} bills due before ${paydayLabel} aren't covered yet.`;
  }

  return due.length === 1
    ? `The 1 bill due before ${paydayLabel} is covered.`
    : `All ${due.length} bills due before ${paydayLabel} are covered.`;
}

function Meter({
  bills,
  savings,
  leftover,
}: {
  bills: number;
  savings: number;
  leftover: number;
}) {
  const segments = [
    { key: "bills", value: bills, color: theme.colors.meterBills },
    { key: "savings", value: savings, color: theme.colors.meterSavings },
    {
      key: "leftover",
      value: Math.max(leftover, 0),
      color: withAlpha(theme.colors.white, 0.22),
    },
  ].filter((segment) => segment.value > 0);

  if (!segments.length) {
    return <View style={[styles.meter, styles.meterEmpty]} />;
  }

  return (
    <View
      accessible
      accessibilityLabel={`Bills ${formatCurrency(bills)}, savings ${formatCurrency(savings)}, yours ${formatCurrency(Math.max(leftover, 0))}.`}
      style={styles.meter}
    >
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.meterSegment,
            { backgroundColor: segment.color, flexGrow: segment.value },
          ]}
        />
      ))}
    </View>
  );
}

function LegendItem({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>
        {label} <Text style={styles.legendValue}>{value}</Text>
      </Text>
    </View>
  );
}

function PaydayChip({ paycheck }: { paycheck: NextPaycheck }) {
  const scheduleName = paycheck.pay_schedule?.name;
  const dateLabel = formatWeekdayDate(paycheck.occurrence_date);

  return (
    <View style={styles.payday}>
      <View style={styles.paydayCopy}>
        <Text style={styles.paydayEyebrow}>Payday</Text>
        <Text numberOfLines={1} style={styles.paydayDetail}>
          {scheduleName ? `${dateLabel} · ${scheduleName}` : dateLabel}
        </Text>
      </View>
      <Text style={styles.paydayAmount}>
        {`+${formatCurrency(paycheck.effective_amount ?? paycheck.amount)}`}
      </Text>
    </View>
  );
}

function HeroShell({
  eyebrow,
  headline,
  body,
  children,
}: {
  eyebrow: string;
  headline: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <SurfaceCard tone="dark" style={styles.card}>
      <View style={styles.introCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      {children}
    </SurfaceCard>
  );
}

export function NextUpHeader({
  title,
  onOpenDrawer,
}: {
  title: string;
  onOpenDrawer: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>
          {formatLongWeekdayDate(todayInAppTimezone())}
        </Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <Pressable
        accessibilityHint="Opens account and settings options."
        accessibilityLabel="Open account drawer"
        hitSlop={10}
        onPress={onOpenDrawer}
        style={({ pressed }) => [
          styles.accountButton,
          pressed ? styles.accountButtonPressed : null,
        ]}
      >
        <MaterialCommunityIcons
          color={theme.colors.ink}
          name="account-outline"
          size={24}
        />
      </Pressable>
    </View>
  );
}

export function NextUpCard({
  state,
  dashboard,
  onAddPaycheck,
  onAddBill,
  onOpenPaychecks,
}: {
  state: HomeHeroState;
  dashboard: DashboardResponse;
  onAddPaycheck: () => void;
  onAddBill: () => void;
  onOpenPaychecks: () => void;
}) {
  if (state.kind === "welcome") {
    return (
      <HeroShell
        body="Start with the paycheck you are expecting next. Once that date is in place, your bills, savings, and whatever is left over all line up behind it."
        eyebrow="Welcome to PaydayPlanner"
        headline="Let's find your next payday"
      >
        <View style={styles.actions}>
          <PrimaryButton
            icon="cash-plus"
            label="Add paycheck"
            onPress={onAddPaycheck}
          />
          <SecondaryButton
            icon="receipt-text-plus-outline"
            label="Add bill"
            onPress={onAddBill}
          />
        </View>
      </HeroShell>
    );
  }

  if (state.kind === "no-paycheck") {
    return (
      <HeroShell
        body="PaydayPlanner works best once the next income date is in place. Add a paycheck first, then bills and savings can anchor around it."
        eyebrow="Start your plan"
        headline="Add your first paycheck"
      >
        <View style={styles.actions}>
          <PrimaryButton
            icon="cash-plus"
            label="Add paycheck"
            onPress={onAddPaycheck}
          />
          <SecondaryButton
            icon="receipt-text-plus-outline"
            label="Add bill"
            onPress={onAddBill}
          />
        </View>
      </HeroShell>
    );
  }

  if (state.kind === "no-upcoming") {
    return (
      <HeroShell
        body="Your pay schedules have all run past their last date, so there is no payday ahead to plan against. Update one and the picture comes back."
        eyebrow="No upcoming payday"
        headline="Your pay schedule ran out"
      >
        <View style={styles.actions}>
          <PrimaryButton
            icon="cash-plus"
            label="Review paychecks"
            onPress={onOpenPaychecks}
          />
        </View>
      </HeroShell>
    );
  }

  if (state.kind === "no-bills") {
    return (
      <HeroShell
        body={`Your next payday is set for ${formatWeekdayDate(state.paycheck.occurrence_date)}. Add the bills you pay out of it and this card will show exactly what stays yours.`}
        eyebrow="One more step"
        headline="Add your first bill"
      >
        <View style={styles.actions}>
          <PrimaryButton
            icon="receipt-text-plus-outline"
            label="Add bill"
            onPress={onAddBill}
          />
        </View>
        <PaydayChip paycheck={state.paycheck} />
      </HeroShell>
    );
  }

  const { paycheck } = state;
  const bills = Number(paycheck.assigned_total ?? 0);
  const savings = Number(paycheck.savings_goal_total ?? 0);
  const leftover = Number(paycheck.remaining_amount ?? 0);
  const short = leftover < 0;
  const paydayLabel = formatWeekdayDate(paycheck.occurrence_date);

  return (
    <SurfaceCard tone="dark" style={styles.card}>
      <Text style={styles.eyebrow}>Your next paycheck</Text>

      <View style={styles.heroRow}>
        <Text style={[styles.heroValue, short ? styles.heroValueShort : null]}>
          {formatCurrency(Math.abs(leftover))}
        </Text>
        <Text style={styles.heroCaption}>
          {short ? "short after bills" : "left after bills"}
        </Text>
      </View>

      <Text style={styles.body}>{coverageLine(dashboard, paydayLabel)}</Text>

      <Meter bills={bills} leftover={leftover} savings={savings} />

      <View style={styles.legend}>
        <LegendItem
          color={theme.colors.meterBills}
          label="Bills"
          value={formatCurrency(bills)}
        />
        <LegendItem
          color={theme.colors.meterSavings}
          label="Savings"
          value={formatCurrency(savings)}
        />
        <LegendItem
          color={
            short
              ? theme.colors.onInkDanger
              : withAlpha(theme.colors.white, 0.22)
          }
          label={short ? "Short" : "Yours"}
          value={formatCurrency(Math.abs(leftover))}
        />
      </View>

      <PaydayChip paycheck={paycheck} />
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  headerTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  accountButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: withAlpha(theme.colors.white, 0.82),
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonPressed: {
    opacity: 0.8,
  },
  card: {
    gap: theme.spacing.md,
  },
  introCopy: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: withAlpha(theme.colors.white, 0.66),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headline: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    marginTop: -2,
  },
  heroValue: {
    color: theme.colors.white,
    fontSize: 52,
    fontWeight: "800",
    letterSpacing: -2,
  },
  heroValueShort: {
    color: theme.colors.onInkDanger,
  },
  heroCaption: {
    color: withAlpha(theme.colors.white, 0.78),
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  meter: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 2,
    height: 12,
    marginTop: theme.spacing.xs,
  },
  meterEmpty: {
    borderRadius: 6,
    backgroundColor: withAlpha(theme.colors.white, 0.14),
  },
  meterSegment: {
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 8,
    borderRadius: 6,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: theme.spacing.xs,
    columnGap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendSwatch: {
    width: 9,
    height: 9,
    borderRadius: 2,
  },
  legendLabel: {
    color: withAlpha(theme.colors.white, 0.72),
    fontSize: 15,
    fontWeight: "600",
  },
  legendValue: {
    color: theme.colors.white,
    fontWeight: "800",
  },
  payday: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  paydayCopy: {
    flex: 1,
    gap: 3,
  },
  paydayEyebrow: {
    color: withAlpha(theme.colors.white, 0.6),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  paydayDetail: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  paydayAmount: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
