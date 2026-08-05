import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { RefreshControl } from "react-native";

import { AccountButton, AccountDrawer } from "@features/account/account-drawer";
import { useAuth } from "@features/auth/auth-context";
import { BillsSegment } from "@features/money/bills-segment";
import { GoalsSegment } from "@features/money/goals-segment";
import { IncomeSegment } from "@features/money/income-segment";
import {
  SegmentedControl,
  type Segment,
} from "@features/money/segmented-control";
import { planningKeys } from "@features/planning/queries";
import { usePlanningRevision } from "@shared/api/planning-revision";
import {
  AppScreen,
  FloatingActionButton,
  ScreenHeader,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

type MoneyTab = "bills" | "income" | "goals";

const SEGMENTS: Segment<MoneyTab>[] = [
  { key: "bills", label: "Bills" },
  { key: "income", label: "Income" },
  { key: "goals", label: "Goals" },
];

const ADD_ROUTES: Record<MoneyTab, Href> = {
  bills: "/bills/new",
  income: "/pay-schedules/new",
  goals: "/savings-goals/new",
};

const ADD_LABELS: Record<MoneyTab, string> = {
  bills: "Add bill",
  income: "Add income source",
  goals: "Add savings goal",
};

function isMoneyTab(value: string | undefined): value is MoneyTab {
  return value === "bills" || value === "income" || value === "goals";
}

export default function MoneyScreen() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { user, signOut } = useAuth();
  const planningRevision = usePlanningRevision();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<MoneyTab>(
    isMoneyTab(tab) ? tab : "bills",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = user?.id;

  // The tab stays mounted, so a later link into a specific segment has to move
  // the control rather than rely on the initial state.
  useEffect(() => {
    if (isMoneyTab(tab)) {
      setActive(tab);
    }
  }, [tab]);

  // Only the visible segment's queries are mounted, so invalidating the whole
  // planning scope refetches exactly what is on screen.
  const refresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await queryClient.invalidateQueries({
        queryKey: planningKeys.all({ revision: planningRevision, userId }),
      });
    } finally {
      setRefreshing(false);
    }
  }, [planningRevision, queryClient, userId]);

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

  return (
    <>
      <AppScreen
        floatingAction={
          <FloatingActionButton
            accessibilityLabel={ADD_LABELS[active]}
            onPress={() => {
              router.push(ADD_ROUTES[active]);
            }}
          />
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => {
              void refresh();
            }}
            refreshing={refreshing}
            tintColor={theme.colors.primary}
          />
        }
      >
        <ScreenHeader
          right={
            <AccountButton
              onPress={() => {
                setDrawerOpen(true);
              }}
            />
          }
          title="Money"
        />

        <SegmentedControl
          onChange={setActive}
          segments={SEGMENTS}
          value={active}
        />

        {active === "bills" ? (
          <BillsSegment />
        ) : active === "income" ? (
          <IncomeSegment />
        ) : (
          <GoalsSegment />
        )}
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
