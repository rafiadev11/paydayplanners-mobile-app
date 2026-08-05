import { MaterialCommunityIcons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@features/auth/auth-context";
import { DueBillsCard } from "@features/home/due-bills-card";
import {
  homeHeaderTitle,
  NextUpCard,
  NextUpHeader,
  resolveHomeHeroState,
} from "@features/home/next-up-card";
import { useHomeIntro } from "@features/home/use-home-intro";
import { type BillOccurrence } from "@features/planning/api";
import {
  useBillsQuery,
  useDashboardQuery,
  usePaySchedulesQuery,
} from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import { useRefetchStaleOnFocus } from "@shared/api/use-refetch-stale-on-focus";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatCurrency, formatDateWithYear } from "@shared/lib/format";
import {
  AppScreen,
  ErrorState,
  LoadingState,
  PrimaryButton,
  Row,
  SectionTitle,
  SecondaryButton,
  StatusBadge,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

function goalSubtitle(
  targetDate: string | null | undefined,
  contributionAmount?: string | null,
) {
  if (targetDate) {
    return `Target ${formatDateWithYear(targetDate)}`;
  }

  if (contributionAmount) {
    return `Open-ended · ${formatCurrency(contributionAmount)} per paycheck`;
  }

  return "Open-ended goal";
}

/**
 * Bills the user has already handled should not keep the plan looking unfinished,
 * but the API counts paid occurrences in these lists all the same.
 */
function outstandingCount(items: BillOccurrence[] | undefined) {
  return (items ?? []).filter(
    (item) => item.status !== "paid" && item.status !== "skipped",
  ).length;
}

function AccountDrawerItem({
  icon,
  title,
  subtitle,
  onPress,
  disabled = false,
  tone = "default",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <Pressable
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        pressed && !disabled && onPress ? styles.drawerItemPressed : null,
        disabled ? styles.drawerItemDisabled : null,
      ]}
    >
      <View
        style={[
          styles.drawerItemIconWrap,
          tone === "danger" ? styles.drawerItemIconDanger : null,
        ]}
      >
        <MaterialCommunityIcons
          color={tone === "danger" ? theme.colors.danger : theme.colors.ink}
          name={icon}
          size={20}
        />
      </View>
      <View style={styles.drawerItemCopy}>
        <View style={styles.drawerItemTitleRow}>
          <Text
            style={[
              styles.drawerItemTitle,
              tone === "danger" ? styles.drawerItemTitleDanger : null,
            ]}
          >
            {title}
          </Text>
          {disabled ? <StatusBadge label="Soon" tone="neutral" /> : null}
        </View>
        <Text style={styles.drawerItemSubtitle}>{subtitle}</Text>
      </View>
      {!disabled && onPress ? (
        <MaterialCommunityIcons
          color={theme.colors.muted}
          name="chevron-right"
          size={20}
        />
      ) : null}
    </Pressable>
  );
}

function AccountDrawer({
  visible,
  userName,
  onClose,
  onOpenAccount,
  onOpenHelpAndLegal,
  onOpenDeleteAccount,
  onSignOut,
}: {
  visible: boolean;
  userName?: string | null;
  onClose: () => void;
  onOpenAccount: () => void;
  onOpenHelpAndLegal: () => void;
  onOpenDeleteAccount: () => void;
  onSignOut: () => void;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);

      Animated.timing(progress, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();

      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [progress, visible]);

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const panelTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [72, 0],
  });

  const panelOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const panelScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.985, 1],
  });

  if (!mounted) {
    return null;
  }

  return (
    <Modal onRequestClose={onClose} transparent visible={mounted}>
      <View style={styles.drawerRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.drawerBackdropShade, { opacity: backdropOpacity }]}
        />
        <Pressable style={styles.drawerBackdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.drawerPanelWrap,
            {
              opacity: panelOpacity,
              transform: [
                { translateX: panelTranslateX },
                { scale: panelScale },
              ],
            },
          ]}
        >
          <SafeAreaView edges={["top", "bottom"]} style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerHeaderCopy}>
                <Text style={styles.drawerEyebrow}>Account</Text>
                <Text style={styles.drawerTitle}>{userName ?? "Account"}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.drawerCloseButton,
                  pressed ? styles.accountButtonPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.ink}
                  name="close"
                  size={20}
                />
              </Pressable>
            </View>

            <View style={styles.drawerGroup}>
              <AccountDrawerItem
                icon="account-edit-outline"
                onPress={onOpenAccount}
                subtitle="Update your name, email, and personal profile details."
                title="Account info"
              />
            </View>

            <View style={styles.drawerUtilitySection}>
              <Pressable
                onPress={onOpenHelpAndLegal}
                style={({ pressed }) => [
                  styles.drawerFooterLink,
                  styles.drawerUtilityLink,
                  pressed ? styles.drawerItemPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.primaryStrong}
                  name="lifebuoy"
                  size={18}
                />
                <Text style={styles.drawerFooterLinkLabel}>Help & Support</Text>
                <MaterialCommunityIcons
                  color={theme.colors.muted}
                  name="chevron-right"
                  size={18}
                />
              </Pressable>
            </View>

            <View style={styles.drawerFooter}>
              <Pressable
                onPress={onOpenDeleteAccount}
                style={({ pressed }) => [
                  styles.drawerFooterLink,
                  styles.drawerFooterDangerLink,
                  pressed ? styles.drawerItemPressed : null,
                ]}
              >
                <MaterialCommunityIcons
                  color={theme.colors.danger}
                  name="delete-outline"
                  size={18}
                />
                <Text
                  style={[
                    styles.drawerFooterLinkLabel,
                    styles.drawerFooterDangerLinkLabel,
                  ]}
                >
                  Delete account
                </Text>
                <MaterialCommunityIcons
                  color={theme.colors.danger}
                  name="chevron-right"
                  size={18}
                />
              </Pressable>
              <SecondaryButton
                icon="logout"
                label="Log out"
                onPress={onSignOut}
              />
              <Text style={styles.drawerVersionLabel}>
                Version {APP_VERSION}
              </Text>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const planningRevision = usePlanningRevision();
  const scope = { revision: planningRevision, userId: user?.id };
  const dashboardQuery = useDashboardQuery(scope);
  const dashboard = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isPending && !dashboard;
  const refreshing = dashboardQuery.isRefetching && !dashboardQuery.isPending;
  const error = dashboardQuery.error
    ? getApiErrorMessage(dashboardQuery.error)
    : null;
  const { isFirstOpen, markSeen } = useHomeIntro(user?.id);

  useRefetchStaleOnFocus(dashboardQuery);

  useEffect(() => {
    if (isFirstOpen === null) return;

    markSeen();
  }, [isFirstOpen, markSeen]);

  // Both follow-up queries only run when the dashboard alone cannot tell the
  // onboarding states apart, so the common case stays a single request.
  const needsPaySchedules = Boolean(
    dashboard && !dashboard.next_paycheck && isFirstOpen === false,
  );
  const paySchedulesQuery = usePaySchedulesQuery(scope, {
    enabled: needsPaySchedules,
  });

  const billSignal = dashboard
    ? Number(dashboard.next_paycheck?.assigned_total ?? 0) > 0 ||
      dashboard.bills_due_before_next_paycheck.length > 0 ||
      dashboard.unassigned_bill_occurrences.length > 0
    : false;
  const needsBills = Boolean(dashboard?.next_paycheck) && !billSignal;
  const billsQuery = useBillsQuery(scope, { enabled: needsBills });

  const hasPaySchedules =
    needsPaySchedules && paySchedulesQuery.data
      ? paySchedulesQuery.data.length > 0
      : null;
  const hasBills = !needsBills
    ? true
    : billsQuery.data
      ? billsQuery.data.length > 0
      : null;

  const heroState = dashboard
    ? resolveHomeHeroState({
        dashboard,
        hasBills,
        hasPaySchedules,
        isFirstOpen,
      })
    : null;

  const openAccount = useCallback(() => {
    setDrawerOpen(false);
    router.push("/account");
  }, [router]);

  const openHelpAndLegal = useCallback(() => {
    setDrawerOpen(false);
    router.push("/help-and-legal");
  }, [router]);

  const openDeleteAccount = useCallback(() => {
    setDrawerOpen(false);
    router.push("/delete-account");
  }, [router]);

  const handleSignOut = useCallback(() => {
    setDrawerOpen(false);
    void signOut();
  }, [signOut]);

  const dueCount = outstandingCount(dashboard?.bills_due_before_next_paycheck);
  const uncoveredCount = outstandingCount(
    dashboard?.unassigned_bill_occurrences,
  );
  // Only meaningful once there is a real plan — an account with no paycheck yet
  // is not "on track", it is empty.
  const bothCriticalSectionsClear =
    heroState?.kind === "ready" && dueCount === 0 && uncoveredCount === 0;

  return (
    <>
      <AppScreen
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void dashboardQuery.refetch();
            }}
            refreshing={refreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <NextUpHeader
          onOpenDrawer={() => {
            setDrawerOpen(true);
          }}
          title={heroState ? homeHeaderTitle(heroState) : "Next up"}
        />

        {loading ? (
          <LoadingState label="Building your current paycheck picture." />
        ) : error ? (
          <ErrorState
            body={error}
            onRetry={() => {
              void dashboardQuery.refetch();
            }}
            title="Dashboard unavailable"
          />
        ) : dashboard && heroState ? (
          <>
            <NextUpCard
              dashboard={dashboard}
              onAddBill={() => {
                router.push("/bills/new");
              }}
              onAddPaycheck={() => {
                router.push("/pay-schedules/new");
              }}
              onOpenPaychecks={() => {
                router.push("/paychecks");
              }}
              state={heroState}
            />

            {bothCriticalSectionsClear ? (
              <SurfaceCard tone="accent">
                <SectionTitle
                  subtitle="Nothing is due before the next income date, and everything visible in this current planning window already has coverage."
                  title="You are on track"
                />
                <SecondaryButton
                  icon="timeline-text-outline"
                  label="Open plan"
                  onPress={() => {
                    router.push("/plan");
                  }}
                />
              </SurfaceCard>
            ) : null}

            {heroState.kind === "ready" ? (
              <DueBillsCard dashboard={dashboard} />
            ) : null}

            {dashboard.insights.tightest_paycheck ||
            dashboard.insights.largest_expense ? (
              <SurfaceCard tone="accent">
                <SectionTitle
                  subtitle="Signals pulled from your latest forecast so you can spot pressure before it turns into drift."
                  title="Insights"
                />
                {dashboard.insights.tightest_paycheck ? (
                  <Row
                    subtitle={`${dashboard.insights.tightest_paycheck.pay_schedule_name ?? "Paycheck"} on ${formatDateWithYear(dashboard.insights.tightest_paycheck.occurrence_date)}`}
                    title="Tightest paycheck"
                    value={formatCurrency(
                      dashboard.insights.tightest_paycheck.remaining_amount,
                    )}
                    valueTone={
                      Number(
                        dashboard.insights.tightest_paycheck.remaining_amount,
                      ) < 0
                        ? "danger"
                        : "default"
                    }
                  />
                ) : null}
                {dashboard.insights.largest_expense ? (
                  <Row
                    subtitle={`Due ${formatDateWithYear(dashboard.insights.largest_expense.due_date)}`}
                    title={
                      dashboard.insights.largest_expense.name ??
                      "Largest bill ahead"
                    }
                    value={formatCurrency(
                      dashboard.insights.largest_expense.amount,
                    )}
                  />
                ) : null}
              </SurfaceCard>
            ) : null}

            {dashboard.savings_goals.length ? (
              <SurfaceCard>
                <SectionTitle
                  action={
                    <SecondaryButton
                      icon="bullseye-arrow"
                      label="Open goals"
                      onPress={() => {
                        router.push("/goals");
                      }}
                    />
                  }
                  subtitle="Savings goals stay visible here because recurring progress helps users stay engaged with the plan."
                  title="Savings goals"
                />
                {dashboard.savings_goals.slice(0, 2).map((goal) => (
                  <Row
                    key={String(goal.id)}
                    badge={
                      <StatusBadge label={`P${goal.priority}`} tone="primary" />
                    }
                    subtitle={goalSubtitle(
                      goal.target_date,
                      goal.contribution_amount,
                    )}
                    title={goal.name}
                    value={formatCurrency(goal.remaining_target)}
                  />
                ))}
              </SurfaceCard>
            ) : (
              <SurfaceCard tone="warning">
                <View style={styles.goalCallout}>
                  <MaterialCommunityIcons
                    color={theme.colors.warning}
                    name="bullseye-arrow"
                    size={24}
                  />
                  <View style={styles.goalCalloutCopy}>
                    <Text style={styles.goalCalloutTitle}>
                      Add a savings goal
                    </Text>
                    <Text style={styles.goalCalloutBody}>
                      Savings goals keep users returning because they turn the
                      paycheck plan into visible progress toward something real.
                    </Text>
                  </View>
                </View>
                <PrimaryButton
                  icon="bullseye-arrow"
                  label="Open goals"
                  onPress={() => {
                    router.push("/goals");
                  }}
                />
              </SurfaceCard>
            )}
          </>
        ) : null}
      </AppScreen>

      <AccountDrawer
        onClose={() => {
          setDrawerOpen(false);
        }}
        onOpenAccount={openAccount}
        onOpenHelpAndLegal={openHelpAndLegal}
        onOpenDeleteAccount={openDeleteAccount}
        onSignOut={handleSignOut}
        userName={user?.name}
        visible={drawerOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  accountButtonPressed: {
    opacity: 0.8,
  },
  goalCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
  },
  goalCalloutCopy: {
    flex: 1,
    gap: 4,
  },
  goalCalloutTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  goalCalloutBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  drawerRoot: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  drawerBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(theme.colors.ink, 0.24),
  },
  drawerBackdrop: {
    flex: 1,
  },
  drawerPanelWrap: {
    width: "80%",
    maxWidth: 344,
    shadowColor: theme.colors.ink,
    shadowOffset: {
      width: -10,
      height: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 18,
  },
  drawerPanel: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    borderTopLeftRadius: theme.radius.lg,
    borderBottomLeftRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl + theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  drawerHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  drawerEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  drawerTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
    fontSize: 26,
  },
  drawerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  drawerGroup: {
    gap: theme.spacing.md,
  },
  drawerFooterLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  drawerUtilityLink: {
    paddingTop: theme.spacing.xs,
    paddingBottom: 2,
  },
  drawerFooterLinkLabel: {
    color: theme.colors.primaryStrong,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  drawerFooterDangerLink: {
    marginTop: 0,
  },
  drawerFooterDangerLinkLabel: {
    color: theme.colors.danger,
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  drawerItemPressed: {
    opacity: 0.84,
  },
  drawerItemDisabled: {
    opacity: 0.72,
  },
  drawerItemIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
  },
  drawerItemIconDanger: {
    backgroundColor: theme.colors.dangerSoft,
  },
  drawerItemCopy: {
    flex: 1,
    gap: 4,
  },
  drawerItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  drawerItemTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  drawerItemTitleDanger: {
    color: theme.colors.danger,
  },
  drawerItemSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  drawerUtilitySection: {
    marginTop: "auto",
    paddingTop: theme.spacing.xs,
    paddingBottom: 0,
  },
  drawerFooter: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 2,
  },
  drawerVersionLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
    paddingTop: theme.spacing.sm,
  },
});
