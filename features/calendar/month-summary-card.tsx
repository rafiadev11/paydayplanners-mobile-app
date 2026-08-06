import { StyleSheet, Text, View } from "react-native";

import { type MonthSummary } from "@features/calendar/calendar-data";
import { formatCurrency } from "@shared/lib/format";
import { SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

/**
 * The three headline numbers must add up on their face: OUT is bills plus
 * savings, and YOURS is IN minus OUT. The caption spells the split out so the
 * user never has to guess where a dollar went.
 */
export function MonthSummaryCard({
  summary,
  title = "This month",
}: {
  summary: MonthSummary;
  title?: string;
}) {
  const short = summary.yoursTotal < 0;
  const yoursLabel = short ? "Short" : "Yours";
  const yoursValue = formatCurrency(Math.abs(summary.yoursTotal));

  return (
    <View
      accessible
      accessibilityLabel={`${title}. In ${formatCurrency(summary.incomeTotal)}, out ${formatCurrency(summary.outTotal)} — bills ${formatCurrency(summary.billsTotal)} and savings ${formatCurrency(summary.savingsTotal)} — leaving ${yoursValue} ${short ? "short" : "yours"}.`}
    >
      <SurfaceCard style={styles.card} tone="accent">
        <Text style={styles.title}>{title}</Text>

        <View style={styles.row}>
          <View style={styles.tile}>
            <Text style={styles.label}>In</Text>
            <Text style={[styles.value, styles.valueIn]}>
              {formatCurrency(summary.incomeTotal)}
            </Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.label}>Out</Text>
            <Text style={styles.value}>{formatCurrency(summary.outTotal)}</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.label}>{yoursLabel}</Text>
            <Text style={[styles.value, short ? styles.valueShort : null]}>
              {yoursValue}
            </Text>
          </View>
        </View>

        <Text style={styles.caption}>
          {`Out = bills ${formatCurrency(summary.billsTotal)} · savings ${formatCurrency(summary.savingsTotal)}`}
        </Text>
      </SurfaceCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  tile: {
    flex: 1,
    gap: 4,
  },
  label: {
    ...theme.typography.eyebrow,
    color: theme.colors.muted,
  },
  value: {
    ...theme.typography.metricCompact,
    color: theme.colors.ink,
  },
  valueIn: {
    color: theme.colors.primaryStrong,
  },
  valueShort: {
    color: theme.colors.danger,
  },
  caption: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
