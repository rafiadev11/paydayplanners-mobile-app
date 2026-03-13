import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import type { BillingSummary } from "@features/billing/types";
import { formatDateWithYear } from "@shared/lib/format";
import {
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export function BillingBanner({
  billing,
  compact = false,
}: {
  billing?: BillingSummary | null;
  compact?: boolean;
}) {
  const router = useRouter();

  if (!billing || billing.has_pro_access) {
    return null;
  }

  return (
    <SurfaceCard tone="accent" style={compact ? styles.compactCard : undefined}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.title}>
            {billing.on_trial
              ? "Pro trial active"
              : compact
                ? "Unlock Pro"
                : "Unlock PaydayPlanner Pro"}
          </Text>
          <Text style={styles.body}>
            {billing.on_trial && billing.trial_ends_at
              ? `Your trial runs until ${formatDateWithYear(billing.trial_ends_at)}. Upgrade any time to keep 12-month forecasting and manual bill allocations.`
              : compact
                ? "Get the 12-month forecast, unlimited items, and manual bill allocation."
                : "Upgrade for a 12-month forecast, unlimited bills and paychecks, and manual bill allocation across pay periods."}
          </Text>
        </View>
        <StatusBadge
          label={billing.on_trial ? "trial" : billing.plan}
          tone={billing.on_trial ? "success" : "primary"}
        />
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          label={billing.trial_available ? "Start 14-day trial" : "View plans"}
          icon={
            billing.trial_available ? "rocket-launch-outline" : "crown-outline"
          }
          onPress={() => {
            router.push("/billing");
          }}
        />
        {!compact ? (
          <SecondaryButton
            label="See Pro features"
            icon="arrow-right"
            onPress={() => {
              router.push("/billing");
            }}
          />
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  header: {
    gap: theme.spacing.sm,
  },
  copy: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  body: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
});
