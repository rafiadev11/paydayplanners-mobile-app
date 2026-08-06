import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { AccountDrawer } from "@features/account/account-drawer";
import { useAuth } from "@features/auth/auth-context";
import { DueBillsCard } from "@features/home/due-bills-card";
import {
  homeHeaderTitle,
  NextUpCard,
  NextUpHeader,
  resolveHomeHeroState,
} from "@features/home/next-up-card";
import { SavingTowardCard } from "@features/home/saving-toward-card";
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
import {
  AppScreen,
  ErrorState,
  LoadingState,
  PrimaryButton,
  SectionTitle,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

/**
 * Bills the user has already handled should not keep the plan looking unfinished,
 * but the API counts paid occurrences in these lists all the same.
 */
function outstandingCount(items: BillOccurrence[] | undefined) {
  return (items ?? []).filter(
    (item) => item.status !== "paid" && item.status !== "skipped",
  ).length;
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
                router.push("/money?tab=income");
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
                  icon="calendar-month-outline"
                  label="Open calendar"
                  onPress={() => {
                    router.push("/calendar");
                  }}
                />
              </SurfaceCard>
            ) : null}

            {heroState.kind === "ready" ? (
              <DueBillsCard dashboard={dashboard} />
            ) : null}

            {dashboard.savings_goals.length ? (
              <SavingTowardCard
                dashboard={dashboard}
                onOpenGoals={() => {
                  router.push("/money?tab=goals");
                }}
              />
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
                    router.push("/money?tab=goals");
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
});
