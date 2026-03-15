import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRootNavigationState, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  createCustomerPortalActionSession,
  createCheckoutSession,
  createCustomerPortalSession,
  fetchBillingStatus,
  resumeBillingSubscription,
  switchBillingSubscription,
  syncCustomerPortalSubscription,
} from "@features/billing/api";
import type { BillingStatus } from "@features/billing/types";
import { useAuth } from "@features/auth/auth-context";
import { useBiometricLock } from "@features/security/biometric-lock-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatDateWithYear } from "@shared/lib/format";
import { addDaysToIsoDate, todayInAppTimezone } from "@shared/lib/timezone";
import {
  AppScreen,
  ErrorState,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
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

function forecastEndLabel(days: number | undefined) {
  return formatDateWithYear(addDaysToIsoDate(todayInAppTimezone(), days ?? 90));
}

function yearlySavings(prices: BillingStatus["plans"][number]["prices"]) {
  const monthly = prices?.find((price) => price.interval === "month");
  const yearly = prices?.find((price) => price.interval === "year");

  if (!monthly || !yearly) {
    return null;
  }

  const annualizedMonthly = monthly.amount_cents * 12;
  const savings = annualizedMonthly - yearly.amount_cents;

  if (savings <= 0) {
    return null;
  }

  return Math.round((savings / annualizedMonthly) * 100);
}

function upgradeReasons(status: BillingStatus) {
  return [
    `Free shows the planning timeline through ${forecastEndLabel(status.limits.forecast_days)}.`,
    `Free supports ${status.limits.pay_schedules ?? 1} income source and ${status.limits.savings_goals ?? 1} active goal at a time.`,
    "Pro unlocks manual bill-to-paycheck splits when cash flow gets tight.",
  ];
}

function currentBillingLabel(status: BillingStatus) {
  return status.subscription?.current_plan_name ?? null;
}

function currentBillingPrice(status: BillingStatus) {
  const interval = status.subscription?.current_interval;

  if (!interval) {
    return null;
  }

  const amountCents = status.subscription?.current_amount_cents;

  return amountCents != null
    ? {
        amount_cents: amountCents,
        currency: status.currency,
        interval,
      }
    : null;
}

function scheduledAccessEnd(status: BillingStatus) {
  return status.subscription?.ends_at ?? null;
}

function hasScheduledCancellation(status: BillingStatus) {
  return Boolean(status.has_pro_access && scheduledAccessEnd(status));
}

function statusSnapshot(status: BillingStatus | null) {
  return JSON.stringify({
    plan: status?.plan ?? null,
    has_pro_access: status?.has_pro_access ?? null,
    has_active_subscription: status?.has_active_subscription ?? null,
    on_trial: status?.on_trial ?? null,
    subscription_status: status?.subscription_status ?? null,
    current_interval: status?.subscription?.current_interval ?? null,
    current_amount_cents: status?.subscription?.current_amount_cents ?? null,
    ends_at: status?.subscription?.ends_at ?? null,
    trial_ends_at: status?.trial_ends_at ?? null,
    on_grace_period: status?.subscription?.on_grace_period ?? null,
  });
}

function portalBusyKey(
  action: "manage" | "cancel" | "switch",
  interval?: "month" | "year",
) {
  return `${action}:${interval ?? "default"}`;
}

function resumeBusyKey(interval?: "month" | "year") {
  return `resume:${interval ?? "default"}`;
}

function currentAccessBody(status: BillingStatus) {
  if (hasScheduledCancellation(status)) {
    return `Your subscription is canceled. You’ll keep Pro until ${formatDateWithYear(scheduledAccessEnd(status) ?? "")}, then your account returns to Free.`;
  }

  const billingLabel = currentBillingLabel(status);
  const billingPrice = currentBillingPrice(status);

  if (status.on_trial && status.trial_ends_at) {
    if (billingLabel && billingPrice) {
      return `Your free trial ends ${formatDateWithYear(status.trial_ends_at)}. After that, your ${billingLabel.toLowerCase()} plan continues at ${priceLabel(billingPrice.amount_cents, billingPrice.currency, billingPrice.interval)} unless you cancel before then.`;
    }

    return `Your free trial ends ${formatDateWithYear(status.trial_ends_at)}. After that, your selected plan continues unless you cancel before then.`;
  }

  if (status.has_active_subscription) {
    if (billingLabel && billingPrice) {
      return `Your ${billingLabel.toLowerCase()} subscription is active at ${priceLabel(billingPrice.amount_cents, billingPrice.currency, billingPrice.interval)}, and the full planning horizon is unlocked.`;
    }

    return "Your subscription is active and the full planning horizon is unlocked.";
  }

  return "Free covers the essentials today. Pro opens the full 12-month view, more planning room, and manual allocation control.";
}

export default function BillingScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { refreshUser } = useAuth();
  const biometricLock = useBiometricLock();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalSyncing, setPortalSyncing] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<BillingStatus | null>(null);
  const portalPendingRef = useRef(false);
  const billingLocked = biometricLock.enabled && biometricLock.locked;

  const load = useCallback(async (options?: { background?: boolean }) => {
    const background = options?.background ?? false;

    if (!background || !statusRef.current) {
      setLoading(true);
    }

    try {
      const nextStatus = await fetchBillingStatus();
      setStatus(nextStatus);
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      if (!background || !statusRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const syncPortalState = useCallback(
    async (previousStatus: BillingStatus | null) => {
      const previousSnapshot = statusSnapshot(previousStatus);
      let latestStatus: BillingStatus | null = null;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        latestStatus = await syncCustomerPortalSubscription();
        setStatus(latestStatus);
        setError(null);

        if (statusSnapshot(latestStatus) !== previousSnapshot) {
          break;
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
      }

      await refreshUser();

      return latestStatus;
    },
    [refreshUser],
  );

  const finalizePortalFlow = useCallback(async () => {
    if (!portalPendingRef.current) {
      return;
    }

    portalPendingRef.current = false;
    setBusyAction(null);
    setPortalSyncing(true);

    try {
      await syncPortalState(statusRef.current);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      await load();
    } finally {
      setPortalSyncing(false);
    }
  }, [load, syncPortalState]);

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    if (router.canGoBack()) {
      return;
    }

    router.replace("/dashboard");
  }, [navigationState?.key, router]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (billingLocked) {
        return;
      }

      if (nextState === "active" && portalPendingRef.current) {
        void finalizePortalFlow();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [billingLocked, finalizePortalFlow]);

  useFocusEffect(
    useCallback(() => {
      if (portalPendingRef.current) {
        void finalizePortalFlow();

        return;
      }

      if (billingLocked) {
        return;
      }

      void load({ background: statusRef.current !== null });
    }, [billingLocked, finalizePortalFlow, load]),
  );

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

  const openPortal = useCallback(
    async (
      action: "manage" | "cancel" | "switch" = "manage",
      interval?: "month" | "year",
    ) => {
      try {
        const actionKey = portalBusyKey(action, interval);
        setBusyAction(actionKey);
        const returnUrl = "paydayplanners://billing";
        const url =
          action === "manage"
            ? await createCustomerPortalSession(returnUrl)
            : await createCustomerPortalActionSession(action, {
                returnUrl,
                interval,
              });

        portalPendingRef.current = true;

        await WebBrowser.openBrowserAsync(url);

        if (portalPendingRef.current) {
          await finalizePortalFlow();
        }
      } catch (nextError) {
        portalPendingRef.current = false;
        setError(getApiErrorMessage(nextError));
        setBusyAction(null);
      }
    },
    [finalizePortalFlow],
  );

  const resumeSubscription = useCallback(async () => {
    try {
      setBusyAction(resumeBusyKey());
      const nextStatus = await resumeBillingSubscription();
      setStatus(nextStatus);
      setError(null);
      await refreshUser();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      await load();
    } finally {
      setBusyAction(null);
    }
  }, [load, refreshUser]);

  const switchSubscriptionPlan = useCallback(
    async (interval: "month" | "year") => {
      try {
        setBusyAction(portalBusyKey("switch", interval));
        const nextStatus = await switchBillingSubscription(interval);
        setStatus(nextStatus);
        setError(null);
        await refreshUser();
      } catch (nextError) {
        setError(getApiErrorMessage(nextError));
        await load({ background: statusRef.current !== null });
      } finally {
        setBusyAction(null);
      }
    },
    [load, refreshUser],
  );

  const managingBilling = busyAction === portalBusyKey("manage");
  const resumingSubscription = busyAction === resumeBusyKey();

  const reasons = status ? upgradeReasons(status) : [];
  const currentBilling = status ? currentBillingLabel(status) : null;
  const currentPlanInterval = status?.subscription?.current_interval ?? null;
  const cancellationScheduled = status
    ? hasScheduledCancellation(status)
    : false;
  const accessEndsAt = status ? scheduledAccessEnd(status) : null;

  const confirmSwitchPlan = useCallback(
    (interval: "month" | "year", planName: string) => {
      const targetLabel = planName.toLowerCase();
      const title =
        interval === "year"
          ? "Switch to yearly billing?"
          : "Switch to monthly billing?";
      const message = cancellationScheduled
        ? `This will reopen your subscription and move you to the ${targetLabel} plan.`
        : `This will move your subscription to the ${targetLabel} plan.`;

      Alert.alert(title, message, [
        {
          style: "cancel",
          text: "Keep current plan",
        },
        {
          text: interval === "year" ? "Switch to yearly" : "Switch to monthly",
          onPress: () => {
            void switchSubscriptionPlan(interval);
          },
        },
      ]);
    },
    [cancellationScheduled, switchSubscriptionPlan],
  );

  return (
    <AppScreen contentContainerStyle={styles.screenContent} topInset={false}>
      <ScreenHeader
        eyebrow="Billing"
        subtitle="Unlock the full planning horizon and manage your subscription."
        title="Plans"
      />

      {loading && !status ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading billing...</Text>
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
          {portalSyncing ? (
            <SurfaceCard tone="accent">
              <Text style={styles.inlineStatusTitle}>
                Refreshing your billing status
              </Text>
              <Text style={styles.inlineStatusBody}>
                Your billing changes are syncing in the background.
              </Text>
            </SurfaceCard>
          ) : null}

          <SurfaceCard tone="dark" style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>Current access</Text>
                <Text style={styles.heroTitle}>
                  {status.has_pro_access ? "PaydayPlanner Pro" : "Free plan"}
                </Text>
                <Text style={styles.heroBody}>{currentAccessBody(status)}</Text>
              </View>
              <StatusBadge
                label={
                  cancellationScheduled
                    ? "canceled"
                    : status.on_trial
                      ? "trial"
                      : status.plan
                }
                tone={
                  cancellationScheduled
                    ? "warning"
                    : status.has_pro_access
                      ? "success"
                      : "primary"
                }
              />
            </View>

            {!status.has_pro_access ? (
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>Forecast stops</Text>
                  <Text style={styles.heroMetaValue}>
                    {forecastEndLabel(status.limits.forecast_days)}
                  </Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>Income sources</Text>
                  <Text style={styles.heroMetaValue}>
                    {status.limits.pay_schedules ?? 1} on Free
                  </Text>
                </View>
              </View>
            ) : status.has_active_subscription || status.on_trial ? (
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>
                    {cancellationScheduled
                      ? "Access until"
                      : status.on_trial
                        ? "Trial ends"
                        : "Current billing"}
                  </Text>
                  <Text style={styles.heroMetaValue}>
                    {cancellationScheduled && accessEndsAt
                      ? formatDateWithYear(accessEndsAt)
                      : status.on_trial && status.trial_ends_at
                        ? formatDateWithYear(status.trial_ends_at)
                        : (currentBilling ?? "Pro")}
                  </Text>
                </View>
                <View style={styles.heroMetaDivider} />
                <View style={styles.heroMetaItem}>
                  <Text style={styles.heroMetaLabel}>
                    {cancellationScheduled ? "After that" : "Current plan"}
                  </Text>
                  <Text style={styles.heroMetaValue}>
                    {cancellationScheduled
                      ? "Free plan"
                      : (currentBilling ?? "Pro")}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.heroActions}>
              {!status.has_pro_access ? (
                <Text style={styles.heroReassurance}>
                  Choose monthly or yearly below to start your 14-day trial.
                </Text>
              ) : null}
              {status.has_active_subscription || status.on_trial ? (
                cancellationScheduled ? (
                  <>
                    <PrimaryButton
                      disabled={busyAction !== null}
                      icon="restore"
                      label={
                        resumingSubscription
                          ? "Resuming..."
                          : "Resume subscription"
                      }
                      onPress={() => {
                        void resumeSubscription();
                      }}
                    />
                    <SecondaryButton
                      disabled={busyAction !== null}
                      icon="credit-card-outline"
                      label="Manage billing"
                      onPress={() => {
                        void openPortal();
                      }}
                    />
                  </>
                ) : (
                  <PrimaryButton
                    disabled={busyAction !== null}
                    icon="credit-card-outline"
                    label={
                      managingBilling ? "Opening billing..." : "Manage billing"
                    }
                    onPress={() => {
                      void openPortal();
                    }}
                  />
                )
              ) : null}
              {status.has_active_subscription || status.on_trial ? (
                <Text style={styles.heroReassurance}>
                  {cancellationScheduled && accessEndsAt
                    ? `Resume subscription keeps your current plan active. Open Manage billing before ${formatDateWithYear(accessEndsAt)} if you want to switch plans instead.`
                    : "Use Manage billing to change plans, update payment details, or cancel your subscription."}
                </Text>
              ) : null}
            </View>
          </SurfaceCard>

          {error ? (
            <SurfaceCard tone="warning">
              <Text style={styles.inlineError}>{error}</Text>
            </SurfaceCard>
          ) : null}

          {!status.has_pro_access ? (
            <SurfaceCard style={styles.whyCard}>
              <SectionTitle
                subtitle="Pro becomes most valuable when the free limits start shaping what you can see or plan."
                title="Why upgrade now"
              />
              <View style={styles.reasonList}>
                {reasons.map((reason) => (
                  <View key={reason} style={styles.reasonRow}>
                    <MaterialCommunityIcons
                      color={theme.colors.primaryStrong}
                      name="flash-outline"
                      size={18}
                    />
                    <Text style={styles.reasonText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </SurfaceCard>
          ) : null}

          {status.plans.map((plan) => (
            <SurfaceCard
              key={plan.slug}
              tone={plan.slug === "pro" ? "accent" : "light"}
              style={[
                styles.planCard,
                plan.slug === "free"
                  ? [
                      styles.freePlanCard,
                      status.has_pro_access ? styles.freePlanCardQuiet : null,
                    ]
                  : null,
              ]}
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

              {plan.slug === "pro" ? (
                <>
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

                  {!status.has_pro_access ? (
                    <View style={styles.trialNote}>
                      <MaterialCommunityIcons
                        color={theme.colors.primaryStrong}
                        name="rocket-launch-outline"
                        size={18}
                      />
                      <Text style={styles.trialNoteText}>
                        Start with a 14-day free trial after entering payment
                        details. Your selected plan continues after the trial
                        unless you cancel before then.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.manageNote}>
                      <MaterialCommunityIcons
                        color={theme.colors.primaryStrong}
                        name={
                          cancellationScheduled
                            ? "alert-circle-outline"
                            : "swap-horizontal"
                        }
                        size={18}
                      />
                      <Text style={styles.manageNoteText}>
                        {cancellationScheduled && accessEndsAt
                          ? `You’ve canceled your subscription. Tap Resume subscription to keep this plan active, or pick a different billing option below before ${formatDateWithYear(accessEndsAt)}.`
                          : "Want to switch between monthly and yearly? Confirm a plan below to update your subscription, or use Manage billing to cancel and handle payment details."}
                      </Text>
                    </View>
                  )}

                  <View style={styles.priceGroup}>
                    {(plan.prices ?? []).map((price) => (
                      <SurfaceCard
                        key={price.interval}
                        style={styles.priceCard}
                        tone="light"
                      >
                        <View style={styles.priceHeader}>
                          <Text style={styles.priceName}>{price.name}</Text>
                          {price.interval === "year" &&
                          yearlySavings(plan.prices) ? (
                            <StatusBadge
                              label={`save ${yearlySavings(plan.prices)}%`}
                              tone="success"
                            />
                          ) : null}
                        </View>
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
                        {!status.has_pro_access ? (
                          <PrimaryButton
                            disabled={
                              busyAction !== null || !price.checkout_enabled
                            }
                            icon="arrow-top-right"
                            label={
                              busyAction === price.interval
                                ? "Opening checkout..."
                                : `Start ${price.name.toLowerCase()} trial`
                            }
                            onPress={() => {
                              void openCheckout(price.interval);
                            }}
                          />
                        ) : cancellationScheduled &&
                          currentPlanInterval === price.interval ? (
                          <PrimaryButton
                            disabled={busyAction !== null}
                            icon="restore"
                            label={
                              resumingSubscription
                                ? "Resuming..."
                                : `Resume ${price.name.toLowerCase()}`
                            }
                            onPress={() => {
                              void resumeSubscription();
                            }}
                          />
                        ) : cancellationScheduled ? (
                          <PrimaryButton
                            disabled={busyAction !== null}
                            icon="swap-horizontal"
                            label={
                              busyAction ===
                              portalBusyKey("switch", price.interval)
                                ? "Switching..."
                                : `Switch to ${price.name.toLowerCase()}`
                            }
                            onPress={() => {
                              confirmSwitchPlan(price.interval, price.name);
                            }}
                          />
                        ) : currentPlanInterval === price.interval ? (
                          <View style={styles.currentPlanPill}>
                            <Text style={styles.currentPlanPillLabel}>
                              Current plan
                            </Text>
                          </View>
                        ) : (
                          <PrimaryButton
                            disabled={busyAction !== null}
                            icon="swap-horizontal"
                            label={
                              busyAction ===
                              portalBusyKey("switch", price.interval)
                                ? "Switching..."
                                : `Switch to ${price.name.toLowerCase()}`
                            }
                            onPress={() => {
                              confirmSwitchPlan(price.interval, price.name);
                            }}
                          />
                        )}
                      </SurfaceCard>
                    ))}
                  </View>
                </>
              ) : (
                <View style={styles.limitGroup}>
                  <Text style={styles.limitText}>
                    {plan.limits?.pay_schedules ?? 1} paycheck schedule,{" "}
                    {plan.limits?.bills ?? 12} bills,{" "}
                    {plan.limits?.savings_goals ?? 1} goal, and a{" "}
                    {plan.limits?.forecast_days ?? 90}-day window.
                  </Text>
                  <Text style={styles.limitSubtext}>
                    Enough to build the core system, with tighter limits on how
                    far and how broadly you can plan.
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
  screenContent: {
    paddingTop: theme.spacing.md,
  },
  loadingWrap: {
    paddingVertical: theme.spacing.xxl,
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  loadingText: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  inlineStatusTitle: {
    color: theme.colors.ink,
    ...theme.typography.bodyStrong,
  },
  inlineStatusBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  heroCard: {
    gap: theme.spacing.md,
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
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    padding: theme.spacing.md,
  },
  heroMetaItem: {
    flex: 1,
    gap: 4,
  },
  heroMetaLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroMetaValue: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  heroMetaDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withAlpha(theme.colors.white, 0.12),
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  heroReassurance: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  inlineError: {
    color: theme.colors.warning,
    ...theme.typography.bodyStrong,
  },
  whyCard: {
    gap: theme.spacing.md,
  },
  reasonList: {
    gap: theme.spacing.sm,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  reasonText: {
    flex: 1,
    color: theme.colors.text,
    ...theme.typography.body,
  },
  planCard: {
    gap: theme.spacing.md,
  },
  freePlanCard: {
    gap: theme.spacing.sm,
  },
  freePlanCardQuiet: {
    opacity: 0.76,
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
  trialNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.56),
    padding: theme.spacing.md,
  },
  trialNoteText: {
    flex: 1,
    color: theme.colors.ink,
    ...theme.typography.body,
  },
  manageNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.5),
    padding: theme.spacing.md,
  },
  manageNoteText: {
    flex: 1,
    color: theme.colors.ink,
    ...theme.typography.body,
  },
  priceCard: {
    gap: theme.spacing.sm,
  },
  priceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  currentPlanPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: withAlpha(theme.colors.ink, 0.08),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  currentPlanPillLabel: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  limitGroup: {
    gap: theme.spacing.xs,
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
  limitSubtext: {
    color: withAlpha(theme.colors.muted, 0.88),
    ...theme.typography.body,
  },
});
