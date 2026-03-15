import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
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
import {
  fetchBills,
  fetchDashboard,
  fetchPaySchedules,
  type BillOccurrence,
  type DashboardResponse,
} from "@features/planning/api";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  firstName,
  formatCurrency,
  formatDate,
  formatDateWithYear,
} from "@shared/lib/format";
import {
  AppScreen,
  EmptyState,
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

function statusTone(status: string) {
  switch (status) {
    case "paid":
    case "received":
      return "success" as const;
    case "overdue":
      return "danger" as const;
    case "skipped":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

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

function sectionCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function planningWindowLabel(startDate: string, endDate: string) {
  return `Current window ${formatDate(startDate)} to ${formatDate(endDate)}`;
}

function DashboardHeader({
  userName,
  onOpenDrawer,
}: {
  userName?: string | null;
  onOpenDrawer: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.headerEyebrow}>Home</Text>
        <Text style={styles.headerTitle}>
          {`Welcome back, ${firstName(userName)}`}
        </Text>
        <Text style={styles.headerSubtitle}>
          Focus on the next paycheck, what needs coverage, and the few things
          that could knock the plan off track.
        </Text>
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
          name="account-cog-outline"
          size={22}
        />
      </Pressable>
    </View>
  );
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
  onOpenBilling,
  onOpenAccount,
  onOpenDeleteAccount,
  onSignOut,
}: {
  visible: boolean;
  userName?: string | null;
  onClose: () => void;
  onOpenBilling: () => void;
  onOpenAccount: () => void;
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
                icon="credit-card-outline"
                onPress={onOpenBilling}
                subtitle="Manage your plan, trial, and subscription details."
                title="My subscription"
              />
              <AccountDrawerItem
                icon="account-edit-outline"
                onPress={onOpenAccount}
                subtitle="Update your name, email, and personal profile details."
                title="Account info"
              />
              <AccountDrawerItem
                icon="delete-outline"
                onPress={onOpenDeleteAccount}
                subtitle="Permanently remove your account and planning data."
                title="Delete account"
                tone="danger"
              />
            </View>

            <View style={styles.drawerFooter}>
              <SecondaryButton
                icon="logout"
                label="Log out"
                onPress={onSignOut}
              />
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function BillList({
  items,
  emptyTitle,
  emptyBody,
}: {
  items: BillOccurrence[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (!items.length) {
    return <EmptyState body={emptyBody} title={emptyTitle} />;
  }

  return (
    <SurfaceCard>
      {items.slice(0, 3).map((item) => (
        <Row
          key={String(item.id)}
          badge={
            <StatusBadge
              label={item.status.replace("_", " ")}
              tone={statusTone(item.status)}
            />
          }
          subtitle={`Due ${formatDateWithYear(item.due_date)}`}
          title={item.bill?.name ?? "Bill occurrence"}
          value={formatCurrency(item.effective_amount ?? item.amount)}
          valueTone={item.status === "overdue" ? "danger" : "default"}
        />
      ))}
    </SurfaceCard>
  );
}

function NextPaycheckCard({
  dashboard,
  canCreatePaySchedule,
  canCreateBill,
  onOpenPlan,
  onAddPaycheck,
  onAddBill,
  onOpenBilling,
}: {
  dashboard: DashboardResponse;
  canCreatePaySchedule: boolean;
  canCreateBill: boolean;
  onOpenPlan: () => void;
  onAddPaycheck: () => void;
  onAddBill: () => void;
  onOpenBilling: () => void;
}) {
  const nextPaycheck = dashboard.next_paycheck;
  const dueCount = dashboard.bills_due_before_next_paycheck.length;
  const uncoveredCount = dashboard.unassigned_bill_occurrences.length;

  if (!nextPaycheck) {
    return (
      <SurfaceCard tone="dark" style={styles.primaryCard}>
        <View style={styles.cardIntroRow}>
          <StatusBadge
            label={planningWindowLabel(
              dashboard.window.start_date,
              dashboard.window.end_date,
            )}
            tone="accent"
          />
        </View>
        <View style={styles.cardCopy}>
          <Text style={styles.cardEyebrow}>Start your plan</Text>
          <Text style={styles.cardHeadline}>Add your first paycheck</Text>
          <Text style={styles.cardBody}>
            PaydayPlanner works best once the next income date is in place. Add
            a paycheck first, then bills and savings can anchor around it.
          </Text>
        </View>
        <View style={styles.primaryActions}>
          <PrimaryButton
            icon={canCreatePaySchedule ? "cash-plus" : "crown-outline"}
            label={canCreatePaySchedule ? "Add paycheck" : "Unlock Pro"}
            onPress={canCreatePaySchedule ? onAddPaycheck : onOpenBilling}
          />
          <SecondaryButton
            icon="receipt-text-plus-outline"
            label={canCreateBill ? "Add bill" : "Unlock Pro"}
            onPress={canCreateBill ? onAddBill : onOpenBilling}
          />
        </View>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard tone="dark" style={styles.primaryCard}>
      <View style={styles.cardIntroRow}>
        <StatusBadge
          label={planningWindowLabel(
            dashboard.window.start_date,
            dashboard.window.end_date,
          )}
          tone="accent"
        />
        <StatusBadge
          label={nextPaycheck.status}
          tone={statusTone(nextPaycheck.status)}
        />
      </View>

      <View style={styles.cardCopy}>
        <Text style={styles.cardEyebrow}>Next paycheck</Text>
        <View style={styles.cardHeadlineRow}>
          <View style={styles.cardHeadlineCopy}>
            <Text style={styles.cardHeadline}>
              {nextPaycheck.pay_schedule?.name ?? "Upcoming paycheck"}
            </Text>
            <Text style={styles.cardBody}>
              Lands {formatDateWithYear(nextPaycheck.occurrence_date)}
            </Text>
          </View>
          <Text style={styles.cardSideValue}>
            {formatCurrency(
              nextPaycheck.effective_amount ?? nextPaycheck.amount,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.availableBlock}>
        <Text style={styles.availableLabel}>Available after bills</Text>
        <Text style={styles.availableValue}>
          {formatCurrency(nextPaycheck.remaining_amount)}
        </Text>
        <Text style={styles.availableBody}>
          {dueCount > 0
            ? `${sectionCountLabel(dueCount, "bill needs", "bills need")} coverage before this paycheck lands.`
            : `You are clear until this income date.`}
          {uncoveredCount > 0
            ? ` ${sectionCountLabel(uncoveredCount, "item", "items")} elsewhere in this window still need assignment.`
            : ""}
        </Text>
      </View>

      <View style={styles.primaryStats}>
        <View style={styles.primaryStat}>
          <Text style={styles.primaryStatLabel}>Paycheck</Text>
          <Text style={styles.primaryStatValue}>
            {formatCurrency(
              nextPaycheck.effective_amount ?? nextPaycheck.amount,
            )}
          </Text>
        </View>
        <View style={styles.primaryDivider} />
        <View style={styles.primaryStat}>
          <Text style={styles.primaryStatLabel}>Bills queued</Text>
          <Text style={styles.primaryStatValue}>
            {formatCurrency(nextPaycheck.assigned_total)}
          </Text>
        </View>
        <View style={styles.primaryDivider} />
        <View style={styles.primaryStat}>
          <Text style={styles.primaryStatLabel}>Savings reserved</Text>
          <Text style={styles.primaryStatValue}>
            {formatCurrency(nextPaycheck.savings_goal_total)}
          </Text>
        </View>
      </View>

      <View style={styles.primaryActions}>
        <PrimaryButton
          icon="timeline-text-outline"
          label="Review plan"
          onPress={onOpenPlan}
        />
        <SecondaryButton
          icon={canCreateBill ? "receipt-text-plus-outline" : "crown-outline"}
          label={canCreateBill ? "Add bill" : "Unlock Pro"}
          onPress={canCreateBill ? onAddBill : onOpenBilling}
        />
      </View>
    </SurfaceCard>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [payScheduleCount, setPayScheduleCount] = useState(0);
  const [billCount, setBillCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canCreateSavingsGoal =
    Boolean(user?.billing?.has_pro_access) ||
    (dashboard?.savings_goals.length ?? 0) < 1;
  const canCreatePaySchedule =
    Boolean(user?.billing?.has_pro_access) || payScheduleCount < 1;
  const canCreateBill =
    Boolean(user?.billing?.has_pro_access) || billCount < 12;

  const loadDashboard = useCallback(
    async (refresh = false) => {
      if (!user?.id) return;

      if (refresh) setRefreshing(true);
      else setLoading(true);

      try {
        const [payload, schedules, bills] = await Promise.all([
          fetchDashboard(),
          fetchPaySchedules(),
          fetchBills(),
        ]);
        setDashboard(payload);
        setPayScheduleCount(schedules.length);
        setBillCount(bills.length);
        setError(null);
      } catch (nextError) {
        setError(getApiErrorMessage(nextError));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const openBilling = useCallback(() => {
    setDrawerOpen(false);
    router.push("/billing");
  }, [router]);

  const openAccount = useCallback(() => {
    setDrawerOpen(false);
    router.push("/account");
  }, [router]);

  const openDeleteAccount = useCallback(() => {
    setDrawerOpen(false);
    router.push("/delete-account");
  }, [router]);

  const handleSignOut = useCallback(() => {
    setDrawerOpen(false);
    void signOut();
  }, [signOut]);

  const dueCount = dashboard?.bills_due_before_next_paycheck.length ?? 0;
  const uncoveredCount = dashboard?.unassigned_bill_occurrences.length ?? 0;
  const bothCriticalSectionsClear = dueCount === 0 && uncoveredCount === 0;

  return (
    <>
      <AppScreen
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void loadDashboard(true);
            }}
            refreshing={refreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <DashboardHeader
          onOpenDrawer={() => {
            setDrawerOpen(true);
          }}
          userName={user?.name}
        />

        {loading ? (
          <LoadingState label="Building your current paycheck picture." />
        ) : error ? (
          <ErrorState
            body={error}
            onRetry={() => {
              void loadDashboard();
            }}
            title="Dashboard unavailable"
          />
        ) : dashboard ? (
          <>
            <NextPaycheckCard
              canCreateBill={canCreateBill}
              canCreatePaySchedule={canCreatePaySchedule}
              dashboard={dashboard}
              onAddBill={() => {
                router.push("/bills/new");
              }}
              onAddPaycheck={() => {
                router.push("/pay-schedules/new");
              }}
              onOpenBilling={openBilling}
              onOpenPlan={() => {
                router.push("/plan");
              }}
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

            {dueCount > 0 ? (
              <>
                <SectionTitle
                  action={
                    <StatusBadge
                      label={sectionCountLabel(dueCount, "bill", "bills")}
                      tone="warning"
                    />
                  }
                  subtitle="These bills need funding before the next payday lands."
                  title="Due before next paycheck"
                />
                <BillList
                  emptyBody="You are clear until the next income date."
                  emptyTitle="Nothing due"
                  items={dashboard.bills_due_before_next_paycheck}
                />
              </>
            ) : null}

            {uncoveredCount > 0 ? (
              <>
                <SectionTitle
                  action={
                    <SecondaryButton
                      icon="timeline-text-outline"
                      label="Assign in plan"
                      onPress={() => {
                        router.push("/plan");
                      }}
                    />
                  }
                  subtitle="These items still do not have a paycheck covering them."
                  title="Needs funding"
                />
                <BillList
                  emptyBody="Everything visible in this current planning window has funding assigned."
                  emptyTitle="All set"
                  items={dashboard.unassigned_bill_occurrences}
                />
              </>
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
                  icon={
                    canCreateSavingsGoal ? "bullseye-arrow" : "crown-outline"
                  }
                  label={canCreateSavingsGoal ? "Open goals" : "Unlock Pro"}
                  onPress={() => {
                    router.push(canCreateSavingsGoal ? "/goals" : "/billing");
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
        onOpenBilling={openBilling}
        onOpenDeleteAccount={openDeleteAccount}
        onSignOut={handleSignOut}
        userName={user?.name}
        visible={drawerOpen}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  headerEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  headerTitle: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  headerSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  accountButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: withAlpha(theme.colors.white, 0.82),
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonPressed: {
    opacity: 0.8,
  },
  primaryCard: {
    gap: theme.spacing.lg,
  },
  cardIntroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  cardCopy: {
    gap: theme.spacing.sm,
  },
  cardEyebrow: {
    color: withAlpha(theme.colors.white, 0.7),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  cardHeadlineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  cardHeadlineCopy: {
    flex: 1,
    gap: 4,
  },
  cardHeadline: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  cardSideValue: {
    color: theme.colors.white,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  cardBody: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  availableBlock: {
    gap: theme.spacing.xs,
  },
  availableLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  availableValue: {
    color: theme.colors.white,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1,
  },
  availableBody: {
    color: withAlpha(theme.colors.white, 0.72),
    ...theme.typography.body,
  },
  primaryStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    padding: theme.spacing.md,
  },
  primaryStat: {
    flex: 1,
    gap: 4,
  },
  primaryStatLabel: {
    color: withAlpha(theme.colors.white, 0.62),
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  primaryStatValue: {
    color: theme.colors.white,
    fontSize: 16,
    fontWeight: "800",
  },
  primaryDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: withAlpha(theme.colors.white, 0.12),
  },
  primaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
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
  drawerFooter: {
    marginTop: "auto",
  },
});
