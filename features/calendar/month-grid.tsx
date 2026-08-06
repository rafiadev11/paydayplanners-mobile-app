import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  dayAccessibilityLabel,
  type CalendarDay,
  type CalendarDayMap,
} from "@features/calendar/calendar-data";
import { monthGridDays, monthKeyOf, monthLabel } from "@shared/lib/month";
import { theme, withAlpha } from "@shared/ui/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type MonthGridProps = {
  monthKey: string;
  days: CalendarDayMap;
  selectedDate: string;
  today: string;
  canGoBack: boolean;
  onStepMonth: (delta: number) => void;
  onSelectDate: (date: string) => void;
  onJumpToToday: () => void;
};

const DayCell = memo(function DayCell({
  date,
  day,
  inMonth,
  isToday,
  isSelected,
  onSelect,
}: {
  date: string;
  day: CalendarDay | undefined;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  onSelect: (date: string) => void;
}) {
  const dayNumber = Number(date.slice(8, 10));
  const isPayday = (day?.incomeTotal ?? 0) > 0;
  const hasBill = day?.bills.some((bill) => bill.status !== "skipped") ?? false;
  const isShort = day?.hasShortfall ?? false;

  return (
    <Pressable
      accessibilityLabel={dayAccessibilityLabel(date, day, {
        isToday,
        isSelected,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => {
        onSelect(date);
      }}
      style={({ pressed }) => [
        styles.cell,
        inMonth ? null : styles.cellOutside,
        pressed ? styles.cellPressed : null,
      ]}
    >
      <View
        style={[
          styles.dayPill,
          isToday ? styles.dayPillToday : null,
          isSelected ? styles.dayPillSelected : null,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isPayday ? styles.dayNumberPayday : null,
            isSelected ? styles.dayNumberSelected : null,
          ]}
        >
          {dayNumber}
        </Text>
      </View>
      <View style={styles.markerRow}>
        {isPayday ? (
          <View style={[styles.marker, styles.markerIncome]} />
        ) : null}
        {isShort ? (
          <View style={[styles.marker, styles.markerShort]} />
        ) : hasBill ? (
          <View style={[styles.marker, styles.markerBill]} />
        ) : null}
      </View>
    </Pressable>
  );
});

function LegendItem({
  color,
  label,
  large,
}: {
  color: string;
  label: string;
  large?: boolean;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendSwatch,
          large ? styles.legendSwatchLarge : null,
          { backgroundColor: color },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

export function MonthGrid({
  monthKey,
  days,
  selectedDate,
  today,
  canGoBack,
  onStepMonth,
  onSelectDate,
  onJumpToToday,
}: MonthGridProps) {
  const cells = useMemo(() => monthGridDays(monthKey), [monthKey]);
  const showTodayChip = monthKey !== monthKeyOf(today);

  return (
    <View style={styles.wrap}>
      <View style={styles.monthBar}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          hitSlop={6}
          onPress={() => {
            onStepMonth(-1);
          }}
          style={({ pressed }) => [
            styles.arrow,
            pressed ? styles.arrowPressed : null,
            canGoBack ? null : styles.arrowDisabled,
          ]}
        >
          <MaterialCommunityIcons
            color={theme.colors.ink}
            name="chevron-left"
            size={26}
          />
        </Pressable>

        <View style={styles.monthLabelWrap}>
          <Text accessibilityRole="header" style={styles.monthLabel}>
            {monthLabel(monthKey)}
          </Text>
        </View>

        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => {
            onStepMonth(1);
          }}
          style={({ pressed }) => [
            styles.arrow,
            pressed ? styles.arrowPressed : null,
          ]}
        >
          <MaterialCommunityIcons
            color={theme.colors.ink}
            name="chevron-right"
            size={26}
          />
        </Pressable>
      </View>

      {showTodayChip ? (
        <View style={styles.todayRow}>
          <Pressable
            accessibilityLabel="Jump to today"
            accessibilityRole="button"
            onPress={onJumpToToday}
            style={({ pressed }) => [
              styles.todayChip,
              pressed ? styles.todayChipPressed : null,
            ]}
          >
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="calendar-today"
              size={14}
            />
            <Text style={styles.todayChipLabel}>Today</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => (
          <View key={`${label}-${index}`} style={styles.weekdayCell}>
            <Text style={styles.weekdayLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => (
          <DayCell
            date={cell.date}
            day={days.get(cell.date)}
            inMonth={cell.inMonth}
            isSelected={cell.date === selectedDate}
            isToday={cell.date === today}
            key={cell.date}
            onSelect={onSelectDate}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <LegendItem color={theme.colors.primary} label="Paycheck" />
        <LegendItem color={theme.colors.accent} label="Bill due" />
        <LegendItem color={theme.colors.danger} label="Short" large />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.sm,
  },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  arrowPressed: {
    opacity: 0.6,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: "center",
  },
  monthLabel: {
    color: theme.colors.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  todayRow: {
    alignItems: "center",
  },
  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  todayChipPressed: {
    opacity: 0.7,
  },
  todayChipLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    paddingBottom: 2,
  },
  weekdayLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cell: {
    width: `${100 / 7}%`,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: 3,
  },
  cellOutside: {
    opacity: 0.35,
  },
  cellPressed: {
    opacity: 0.5,
  },
  dayPill: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  dayPillToday: {
    borderColor: theme.colors.primary,
  },
  dayPillSelected: {
    backgroundColor: theme.colors.ink,
    borderColor: theme.colors.ink,
  },
  dayNumber: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  dayNumberPayday: {
    color: theme.colors.primaryStrong,
    fontWeight: "800",
  },
  dayNumberSelected: {
    color: theme.colors.white,
    fontWeight: "800",
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 9,
    marginTop: 3,
  },
  marker: {
    width: 5,
    height: 5,
    borderRadius: theme.radius.pill,
  },
  markerIncome: {
    backgroundColor: theme.colors.primary,
  },
  markerBill: {
    backgroundColor: theme.colors.accent,
  },
  // Larger as well as red, so the shortfall signal does not rely on colour alone.
  markerShort: {
    width: 7,
    height: 7,
    backgroundColor: theme.colors.danger,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: theme.spacing.md,
    paddingTop: theme.spacing.xs,
    marginTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: withAlpha(theme.colors.border, 0.7),
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  legendSwatch: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
  },
  legendSwatchLarge: {
    width: 9,
    height: 9,
  },
  legendLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
});
