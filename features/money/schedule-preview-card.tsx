import { StyleSheet, Text, View } from "react-native";

import { type Coverage } from "@features/money/coverage";
import { formatCurrency, formatDate } from "@shared/lib/format";
import { SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type SchedulePreviewCardProps = {
  name: string;
  amount: number;
  namePlaceholder: string;
  /** Plain-English restatement of the schedule, e.g. "Repeats on the 15th of each month". */
  pattern: string | null;
  /** Caveat shown under the pattern, e.g. the short-month note. */
  note?: string | null;
  dates: string[];
  coverage?: Coverage | null;
  /** Copy for the coverage line; income has no covering paycheck of its own. */
  coverageLabels?: {
    covered: (date: string) => string;
    beforeFirst: (date: string) => string;
    noIncome: string;
  };
  emptyHint: string;
};

export function SchedulePreviewCard({
  name,
  amount,
  namePlaceholder,
  pattern,
  note,
  dates,
  coverage,
  coverageLabels,
  emptyHint,
}: SchedulePreviewCardProps) {
  const coverageText =
    coverage && coverageLabels
      ? coverage.kind === "covered"
        ? coverageLabels.covered(coverage.paycheckDate)
        : coverage.kind === "before-first"
          ? coverageLabels.beforeFirst(coverage.firstPaycheckDate)
          : coverageLabels.noIncome
      : null;
  const coverageIsWarning = coverage ? coverage.kind !== "covered" : false;

  return (
    <SurfaceCard style={styles.card} tone="accent">
      <View style={styles.headline}>
        <Text numberOfLines={1} style={styles.name}>
          {name.trim() || namePlaceholder}
        </Text>
        <Text style={styles.amount}>{formatCurrency(amount)}</Text>
      </View>

      {pattern ? (
        <Text style={styles.pattern}>{pattern}</Text>
      ) : (
        <Text style={styles.emptyHint}>{emptyHint}</Text>
      )}

      {note ? <Text style={styles.note}>{note}</Text> : null}

      {dates.length ? (
        <Text style={styles.dates}>
          {dates.map((date) => formatDate(date)).join("  ·  ")}
        </Text>
      ) : null}

      {coverageText ? (
        <View style={styles.coverageRow}>
          <View
            style={[
              styles.coverageDot,
              coverageIsWarning ? styles.coverageDotWarning : null,
            ]}
          />
          <Text
            style={[
              styles.coverage,
              coverageIsWarning ? styles.coverageWarning : null,
            ]}
          >
            {coverageText}
          </Text>
        </View>
      ) : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.sm,
  },
  headline: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  name: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  amount: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  pattern: {
    color: theme.colors.text,
    ...theme.typography.bodyStrong,
  },
  emptyHint: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  note: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  dates: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  coverageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingTop: 2,
  },
  coverageDot: {
    width: 7,
    height: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  coverageDotWarning: {
    backgroundColor: theme.colors.danger,
  },
  coverage: {
    flex: 1,
    color: theme.colors.primaryStrong,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  coverageWarning: {
    color: theme.colors.danger,
  },
});
