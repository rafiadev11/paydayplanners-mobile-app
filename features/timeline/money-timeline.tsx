import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@features/auth/auth-context";
import type { BillOccurrence, ForecastResponse } from "@features/planning/api";
import { buildTimeline, selectedPaydayIndex } from "@features/timeline/model";
import {
  formatCurrencyPrecise,
  formatDate,
  formatLongWeekdayDate,
  formatWeekdayDate,
} from "@shared/lib/format";
import {
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const money = formatCurrencyPrecise;

function TimelineRow({
  title,
  subtitle,
  amount,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  amount: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={theme.colors.primaryStrong}
        />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.rowAmount}>{money(amount)}</Text>
    </Pressable>
  );
}

export function MoneyTimeline({
  forecast,
  today,
  selectedDate,
  onSelectDate,
}: {
  forecast: ForecastResponse;
  today: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { paydays, uncovered, end } = useMemo(
    () => buildTimeline(forecast, today),
    [forecast, today],
  );
  const [showExplanation, setShowExplanation] = useState(false);
  const [showUncovered, setShowUncovered] = useState(false);
  const index = selectedPaydayIndex(paydays, selectedDate);
  const payday = paydays[index];
  const rail = useRef<ScrollView>(null);
  const markerPositions = useRef<Record<string, number>>({});
  const reduceMotion = useRef(true);
  const shift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) reduceMotion.current = value;
      })
      .catch(() => {
        /* Keep motion disabled if the preference is unavailable. */
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        reduceMotion.current = value;
      },
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const select = (next: number) => {
    const chosen = paydays[next];
    if (!chosen || next === index) return;
    onSelectDate(chosen.date);
    shift.stopAnimation();
    if (!reduceMotion.current) {
      shift.setValue(next > index ? 8 : -8);
      Animated.timing(shift, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    } else shift.setValue(0);
  };
  // Selection belongs to the screen, so switching views or refreshing data
  // cannot reset it. Restore the rail when markers remount or change width.
  const selectedPaydayDate = payday?.date;
  const scrollToSelection = () => {
    if (!selectedPaydayDate) return;
    rail.current?.scrollTo({
      x: Math.max(0, (markerPositions.current[selectedPaydayDate] ?? 0) - 24),
      animated: !reduceMotion.current,
    });
  };
  useEffect(() => {
    if (!selectedPaydayDate) return;
    rail.current?.scrollTo({
      x: Math.max(0, (markerPositions.current[selectedPaydayDate] ?? 0) - 24),
      animated: !reduceMotion.current,
    });
  }, [selectedPaydayDate]);

  const pan = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      Math.abs(gesture.dx) > 18 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 45) select(index + (gesture.dx < 0 ? 1 : -1));
    },
  });
  const openBill = (bill: BillOccurrence) => {
    if (user?.features?.bill_occurrence_adjustments)
      router.push(`/bill-occurrences/${bill.id}` as Href);
    else if (bill.bill_id) router.push(`/bills/${bill.bill_id}` as Href);
  };
  const canOpenBill = (bill: BillOccurrence) =>
    Boolean(user?.features?.bill_occurrence_adjustments || bill.bill_id);
  const uncoveredPanel = uncovered.length ? (
    <SurfaceCard tone="warning" style={styles.warningCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showUncovered }}
        onPress={() => setShowUncovered((value) => !value)}
        style={styles.warningHeading}
      >
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={21}
          color={theme.colors.ink}
        />
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>
            {uncovered.length === 1
              ? "1 bill needs funding"
              : `${uncovered.length} bills need funding`}
          </Text>
          <Text style={styles.subtitle}>
            Separate from the amounts left in your payday plans.
          </Text>
        </View>
        <MaterialCommunityIcons
          name={showUncovered ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.colors.ink}
        />
      </Pressable>
      {showUncovered
        ? uncovered.map((bill) => (
            <TimelineRow
              key={String(bill.id)}
              title={bill.bill?.name ?? "Bill"}
              subtitle={`${bill.due_date < today || bill.status === "overdue" ? "Overdue" : "Due"} ${formatDate(bill.due_date)} · Amount still needed`}
              amount={Number(
                bill.unfunded_amount ?? bill.effective_amount ?? bill.amount,
              )}
              icon="receipt-text-outline"
              onPress={canOpenBill(bill) ? () => openBill(bill) : undefined}
            />
          ))
        : null}
    </SurfaceCard>
  ) : null;

  if (!payday)
    return (
      <View style={styles.content}>
        <EmptyState
          title="Your next payday starts the picture"
          body={`No income is scheduled between today and ${formatDate(end)}. Add a payday to see how your bills and savings fit around it.`}
        />
        <PrimaryButton
          label="Add income"
          icon="cash-plus"
          onPress={() => router.push("/pay-schedules/new")}
        />
        {uncoveredPanel}
      </View>
    );

  const short = payday.remaining < 0;
  const shortSources = payday.sources.filter(
    (source) => Number(source.remaining_amount) < 0,
  );
  return (
    <View style={styles.content}>
      <Animated.View
        style={{ transform: [{ translateX: shift }] }}
        {...pan.panHandlers}
      >
        <SurfaceCard tone="dark" style={styles.hero}>
          <View style={styles.heroHeading}>
            <Text style={styles.heroDate}>
              {formatLongWeekdayDate(payday.date)}
            </Text>
            {index === 0 ? <Text style={styles.nextTag}>NEXT</Text> : null}
          </View>
          <View
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={`${formatWeekdayDate(payday.date)}, ${money(Math.abs(payday.remaining))} ${short ? "short in this plan" : "planned remaining"}`}
          >
            <Text style={[styles.amount, short && styles.shortAmount]}>
              {money(Math.abs(payday.remaining))}
            </Text>
            <View style={styles.captionRow}>
              <Text style={styles.caption}>
                {short ? "Short in this plan" : "Planned remaining"}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showExplanation }}
            accessibilityLabel="How planned remaining is calculated"
            onPress={() => setShowExplanation((value) => !value)}
            style={styles.explanationButton}
          >
            <MaterialCommunityIcons
              name="information-outline"
              size={17}
              color={theme.colors.backgroundStrong}
            />
            <Text style={styles.explanationLink}>How this is calculated</Text>
          </Pressable>
          {showExplanation ? (
            <Text style={styles.explanation}>
              Income minus bills and savings assigned to this payday. This is a
              plan, not your bank balance. Money left on earlier paydays is not
              added here.
            </Text>
          ) : null}
          <View style={styles.breakdown}>
            {[
              ["Income", payday.income],
              ["Bills", payday.billsTotal],
              ["Savings", payday.savings],
            ].map(([label, value]) => (
              <View key={String(label)} style={styles.metric}>
                <Text style={styles.metricLabel}>{label}</Text>
                <Text style={styles.metricValue}>{money(Number(value))}</Text>
              </View>
            ))}
          </View>
        </SurfaceCard>
      </Animated.View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Upcoming paydays</Text>
        <View style={styles.arrows}>
          {[-1, 1].map((delta) => (
            <Pressable
              key={delta}
              accessibilityRole="button"
              accessibilityLabel={delta < 0 ? "Previous payday" : "Next payday"}
              accessibilityState={{
                disabled: index + delta < 0 || index + delta >= paydays.length,
              }}
              disabled={index + delta < 0 || index + delta >= paydays.length}
              onPress={() => select(index + delta)}
              style={[
                styles.arrow,
                (index + delta < 0 || index + delta >= paydays.length) &&
                  styles.disabled,
              ]}
            >
              <MaterialCommunityIcons
                name={delta < 0 ? "chevron-left" : "chevron-right"}
                color={theme.colors.ink}
                size={24}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        ref={rail}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        onContentSizeChange={scrollToSelection}
      >
        {paydays.map((item, itemIndex) => (
          <Pressable
            key={item.date}
            onLayout={(event) => {
              markerPositions.current[item.date] = event.nativeEvent.layout.x;
              if (item.date === selectedPaydayDate) scrollToSelection();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: itemIndex === index }}
            accessibilityLabel={`${formatWeekdayDate(item.date)}, ${money(Math.abs(item.remaining))} ${item.remaining < 0 ? "short" : "remaining"}`}
            onPress={() => select(itemIndex)}
            style={styles.stop}
          >
            <View style={styles.railLine} />
            <View
              style={[
                styles.dotHalo,
                itemIndex === index && styles.selectedHalo,
              ]}
            >
              <View
                style={[styles.dot, itemIndex === index && styles.selectedDot]}
              />
            </View>
            <Text
              style={[
                styles.stopDate,
                itemIndex === index && styles.selectedText,
              ]}
            >
              {formatDate(item.date)}
            </Text>
            <Text
              style={[
                styles.stopAmount,
                itemIndex === index && styles.selectedText,
              ]}
            >
              {money(Math.abs(item.remaining))}
            </Text>
            <Text style={styles.stopLabel}>
              {item.remaining < 0 ? "Short" : "Remaining"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {index > 0 ? (
        <SecondaryButton
          size="sm"
          label="Back to next payday"
          onPress={() => select(0)}
        />
      ) : (
        <Text style={styles.hint}>
          Your next 90 days · Tap a payday to explore
        </Text>
      )}

      {short || shortSources.length ? (
        <SurfaceCard tone="warning">
          <Text style={styles.rowTitle}>
            {short
              ? `This plan is ${money(Math.abs(payday.remaining))} short.`
              : "One income source is over-allocated."}
          </Text>
          <Text style={styles.body}>
            {short
              ? "Assigned bills and savings exceed this payday’s income. Review the items below."
              : "The combined amount is positive, but an individual paycheck needs attention. Review the income breakdown below."}
          </Text>
        </SurfaceCard>
      ) : null}
      {uncoveredPanel}
      {payday.sources.length > 1 ? (
        <View style={styles.group}>
          <Text style={styles.sectionTitle}>Income on this payday</Text>
          <SurfaceCard style={styles.list}>
            {payday.sources.map((source) => (
              <TimelineRow
                key={String(source.id)}
                title={source.pay_schedule?.name ?? "Income"}
                subtitle={
                  Number(source.remaining_amount) < 0
                    ? `${money(Math.abs(Number(source.remaining_amount)))} short after allocations`
                    : `${money(Number(source.remaining_amount))} remaining after allocations`
                }
                amount={Number(source.effective_amount ?? source.amount)}
                icon="cash-plus"
                onPress={
                  (source.pay_schedule_id ?? source.pay_schedule?.id)
                    ? () =>
                        router.push(
                          `/pay-schedules/${source.pay_schedule_id ?? source.pay_schedule?.id}` as Href,
                        )
                    : undefined
                }
              />
            ))}
          </SurfaceCard>
        </View>
      ) : null}
      <View style={styles.group}>
        <Text style={styles.sectionTitle}>
          {short ? "What’s in this plan" : "What this payday covers"}
        </Text>
        {payday.bills.length || payday.goals.length ? (
          <SurfaceCard style={styles.list}>
            {payday.bills.map(({ bill, amount }) => (
              <TimelineRow
                key={String(bill.id)}
                title={bill.bill?.name ?? "Bill"}
                subtitle={`${bill.status === "paid" ? "Paid" : bill.due_date < today ? "Overdue" : "Due"} ${formatDate(bill.due_date)}${amount < Number(bill.effective_amount ?? bill.amount) ? ` · ${money(amount)} of ${money(Number(bill.effective_amount ?? bill.amount))} from this payday` : ""}`}
                amount={amount}
                icon={
                  bill.bill?.kind === "planned_expense"
                    ? "shopping-outline"
                    : "receipt-text-outline"
                }
                onPress={canOpenBill(bill) ? () => openBill(bill) : undefined}
              />
            ))}
            {payday.goals.map((goal) => (
              <TimelineRow
                key={`goal-${goal.id}`}
                title={goal.name}
                subtitle="Planned savings on payday"
                amount={goal.amount}
                icon="sprout-outline"
                onPress={() => router.push(`/savings-goals/${goal.id}` as Href)}
              />
            ))}
          </SurfaceCard>
        ) : (
          <SurfaceCard>
            <Text style={styles.body}>
              No bills or savings are assigned to this payday yet.
            </Text>
            <SecondaryButton
              label="Add a bill"
              onPress={() => router.push("/bills/new")}
            />
          </SurfaceCard>
        )}
      </View>
      <Text style={styles.hint}>
        Based on your planned bills and savings. Everyday spending isn’t
        included.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  hero: { padding: 22, gap: 0, overflow: "hidden" },
  heroHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroDate: {
    flex: 1,
    color: theme.colors.backgroundStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  nextTag: {
    color: theme.colors.white,
    backgroundColor: withAlpha(theme.colors.white, 0.1),
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    fontSize: 11,
    fontWeight: "700",
  },
  amount: {
    color: theme.colors.white,
    fontSize: 46,
    fontWeight: "800",
    letterSpacing: -1.8,
    marginTop: 22,
    fontVariant: ["tabular-nums"],
    flexShrink: 1,
  },
  shortAmount: { color: theme.colors.onInkDanger },
  captionRow: { flexDirection: "row", alignItems: "center" },
  caption: { color: theme.colors.backgroundStrong, fontSize: 14, marginTop: 3 },
  explanationButton: {
    minHeight: 44,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  explanationLink: { fontSize: 12, color: theme.colors.backgroundStrong },
  explanation: {
    color: theme.colors.backgroundStrong,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  breakdown: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    borderTopWidth: 1,
    borderTopColor: withAlpha(theme.colors.white, 0.15),
    paddingTop: 16,
    marginTop: 8,
  },
  metric: { flexGrow: 1, minWidth: 72 },
  metricLabel: {
    fontSize: 12,
    color: theme.colors.backgroundStrong,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.colors.white,
    fontVariant: ["tabular-nums"],
  },
  sectionHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.colors.ink,
    flexShrink: 1,
  },
  arrows: { flexDirection: "row", gap: 4 },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.3 },
  rail: { paddingVertical: 4 },
  stop: {
    minWidth: 112,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 7,
    paddingBottom: 4,
  },
  railLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 13,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dotHalo: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedHalo: { backgroundColor: theme.colors.primarySoft },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: theme.colors.borderStrong,
  },
  selectedDot: { backgroundColor: theme.colors.primaryStrong },
  stopDate: { color: theme.colors.muted, fontSize: 13 },
  stopAmount: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  selectedText: { color: theme.colors.primaryStrong, fontWeight: "800" },
  stopLabel: { color: theme.colors.muted, fontSize: 11 },
  group: { gap: 12 },
  list: { paddingHorizontal: 14, paddingVertical: 0, gap: 0 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.divider,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: { flex: 1, minWidth: 100 },
  rowTitle: { fontSize: 15, color: theme.colors.ink, fontWeight: "700" },
  subtitle: {
    fontSize: 12,
    color: theme.colors.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.ink,
    fontVariant: ["tabular-nums"],
  },
  pressed: { opacity: 0.65 },
  body: { ...theme.typography.body, color: theme.colors.inkMuted },
  hint: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
  warningCard: { gap: 8 },
  warningHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
});
