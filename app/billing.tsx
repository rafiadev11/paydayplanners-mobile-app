import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import {
  createCheckoutSession,
  createCustomerPortalSession,
  fetchBillingStatus,
  startBillingTrial,
} from "@features/billing/api";
import type { BillingStatus } from "@features/billing/types";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatDateWithYear } from "@shared/lib/format";
import {
  AppScreen,
  ErrorState,
  PrimaryButton,
  ScreenHeader,
  SectionTitle,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

function priceLabel(amountCents: number, currency: string, interval: string) {
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amountCents / 100) + `/${interval === "year" ? "yr" : "mo"}`
  );
}

export default function BillingScreen() {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const nextStatus = await fetchBillingStatus();
      setStatus(nextStatus);
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleTrialStart = useCallback(async () => {
    try {
      setBusyAction("trial");
      await startBillingTrial();
      await refreshUser();
      await load();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }, [load, refreshUser]);

  const openCheckout = useCallback(async (interval: "month" | "year") => {
    try {
      setBusyAction(interval);
      const url = await createCheckoutSession(interval);
      await WebBrowser.openBrowserAsync(url);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }, []);

  const openPortal = useCallback(async () => {
    try {
      setBusyAction("portal");
      const url = await createCustomerPortalSession();
      await WebBrowser.openBrowserAsync(url);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setBusyAction(null);
    }
  }, []);

  return (
    <AppScreen>
      <ScreenHeader
        eyebrow="Billing"
        subtitle="Start your Pro trial, unlock the full planning horizon, and manage your Stripe subscription."
        title="Plans"
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : error && !status ? (
        <ErrorState
          body={error}
          onRetry={() => {
            void load();
          }}
          title="Billing unavailable"
        />
      ) : status ? (
        <>
          <SurfaceCard tone="dark">
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Current access</Text>
                <Text style={styles.heroTitle}>
                  {status.has_pro_access ? "PaydayPlanner Pro" : "Free plan"}
                </Text>
                <Text style={styles.heroBody}>
                  {status.on_trial && status.trial_ends_at
                    ? `Your trial ends ${formatDateWithYear(status.trial_ends_at)}.`
                    : status.has_active_subscription
                      ? "Your Stripe subscription is active and Pro is unlocked."
                      : "You can keep using the core planner free, or upgrade for longer forecasting and advanced allocation control."}
                </Text>
              </View>
              <StatusBadge
                label={status.on_trial ? "trial" : status.plan}
                tone={status.has_pro_access ? "success" : "primary"}
              />
            </View>

            <View style={styles.heroActions}>
              {!status.has_pro_access && status.trial_available ? (
                <PrimaryButton
                  disabled={busyAction !== null}
                  icon="rocket-launch-outline"
                  label={
                    busyAction === "trial"
                      ? "Starting trial..."
                      : "Start 14-day trial"
                  }
                  onPress={() => {
                    void handleTrialStart();
                  }}
                />
              ) : null}
              {status.has_active_subscription ? (
                <PrimaryButton
                  disabled={busyAction !== null}
                  icon="credit-card-outline"
                  label={
                    busyAction === "portal"
                      ? "Opening portal..."
                      : "Manage billing"
                  }
                  onPress={() => {
                    void openPortal();
                  }}
                />
              ) : null}
            </View>
          </SurfaceCard>

          {error ? (
            <SurfaceCard tone="warning">
              <Text style={styles.inlineError}>{error}</Text>
            </SurfaceCard>
          ) : null}

          {status.plans.map((plan) => (
            <SurfaceCard
              key={plan.slug}
              tone={plan.slug === "pro" ? "accent" : "light"}
              style={styles.planCard}
            >
              <SectionTitle
                action={
                  <StatusBadge
                    label={plan.slug === status.plan ? "current" : plan.slug}
                    tone={plan.slug === "pro" ? "primary" : "neutral"}
                  />
                }
                subtitle={plan.description ?? undefined}
                title={plan.name}
              />

              <View style={styles.featureList}>
                {(plan.features ?? []).map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <MaterialCommunityIcons
                      color={theme.colors.primaryStrong}
                      name="check-circle-outline"
                      size={18}
                    />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {plan.slug === "pro" ? (
                <View style={styles.priceGroup}>
                  {(plan.prices ?? []).map((price) => (
                    <SurfaceCard
                      key={price.interval}
                      style={styles.priceCard}
                      tone="light"
                    >
                      <Text style={styles.priceName}>{price.name}</Text>
                      <Text style={styles.priceValue}>
                        {priceLabel(
                          price.amount_cents,
                          price.currency,
                          price.interval,
                        )}
                      </Text>
                      <Text style={styles.priceMeta}>
                        {price.interval === "year"
                          ? "Best value for annual planning."
                          : "Flexible monthly access."}
                      </Text>
                      <PrimaryButton
                        disabled={
                          busyAction !== null ||
                          !price.checkout_enabled ||
                          status.has_active_subscription
                        }
                        icon="arrow-top-right"
                        label={
                          busyAction === price.interval
                            ? "Opening checkout..."
                            : `Choose ${price.name.toLowerCase()}`
                        }
                        onPress={() => {
                          void openCheckout(price.interval);
                        }}
                      />
                    </SurfaceCard>
                  ))}
                </View>
              ) : (
                <View style={styles.limitGroup}>
                  <Text style={styles.limitText}>
                    {plan.limits?.pay_schedules ?? 1} paycheck schedule,{" "}
                    {plan.limits?.bills ?? 12} bills,{" "}
                    {plan.limits?.savings_goals ?? 1} goal, and a{" "}
                    {plan.limits?.forecast_days ?? 90}-day window.
                  </Text>
                </View>
              )}
            </SurfaceCard>
          ))}
        </>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: theme.spacing.xxl,
    alignItems: "center",
  },
  heroHeader: {
    gap: theme.spacing.md,
  },
  heroCopy: {
    gap: theme.spacing.xs,
  },
  heroEyebrow: {
    color: withAlpha(theme.colors.white, 0.68),
    ...theme.typography.eyebrow,
  },
  heroTitle: {
    color: theme.colors.white,
    ...theme.typography.title,
  },
  heroBody: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  inlineError: {
    color: theme.colors.warning,
    ...theme.typography.bodyStrong,
  },
  planCard: {
    gap: theme.spacing.md,
  },
  featureList: {
    gap: theme.spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  featureText: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  priceGroup: {
    gap: theme.spacing.md,
  },
  priceCard: {
    gap: theme.spacing.sm,
  },
  priceName: {
    color: theme.colors.muted,
    ...theme.typography.eyebrow,
  },
  priceValue: {
    color: theme.colors.ink,
    ...theme.typography.metricCompact,
  },
  priceMeta: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  limitGroup: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md,
  },
  limitText: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
});
