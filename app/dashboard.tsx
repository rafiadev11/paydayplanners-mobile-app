import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fetchDashboard, type DashboardResponse } from "@features/auth/api";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { theme } from "@shared/ui/theme";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const formatMoney = (value: string | number | null | undefined) =>
  currencyFormatter.format(Number(value ?? 0));

const formatDate = (value: string | null | undefined) =>
  value ? dateFormatter.format(new Date(value)) : "Not scheduled";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { ready, user, signOut, refreshUser } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (nextRefreshing = false) => {
    if (!user) return;

    if (nextRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      await refreshUser();
      const nextDashboard = await fetchDashboard();
      setDashboard(nextDashboard);
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!ready || !user?.id) return;

    let active = true;

    const bootstrap = async () => {
      setLoading(true);

      try {
        const nextDashboard = await fetchDashboard();
        if (!active) return;
        setDashboard(nextDashboard);
        setError(null);
      } catch (nextError) {
        if (!active) return;
        setError(getApiErrorMessage(nextError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [ready, user?.id]);

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
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
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Signed in</Text>
            <Text style={styles.title}>{user.name}</Text>
            <Text style={styles.subtitle}>{user.email}</Text>
          </View>
          <Pressable
            onPress={() => {
              void signOut();
            }}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.errorTitle}>Dashboard unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : dashboard ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Forecast window</Text>
              <Text style={styles.cardBody}>
                {formatDate(dashboard.window.start_date)} to{" "}
                {formatDate(dashboard.window.end_date)}
              </Text>
            </View>

            <View style={styles.statGrid}>
              <StatCard
                label="Projected income"
                value={formatMoney(dashboard.summary.projected_income)}
              />
              <StatCard
                label="Assigned bills"
                value={formatMoney(dashboard.summary.assigned_bills_total)}
              />
              <StatCard
                label="Unassigned bills"
                value={formatMoney(dashboard.summary.unassigned_bills_total)}
              />
              <StatCard
                label="Remaining"
                value={formatMoney(dashboard.summary.remaining_after_assigned)}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Next paycheck</Text>
              {dashboard.next_paycheck ? (
                <>
                  <Text style={styles.highlight}>
                    {formatMoney(dashboard.next_paycheck.amount)}
                  </Text>
                  <Text style={styles.cardBody}>
                    {formatDate(dashboard.next_paycheck.occurrence_date)}
                  </Text>
                  <Text style={styles.cardMuted}>
                    {dashboard.next_paycheck.pay_schedule?.name ||
                      "Pay schedule"}
                  </Text>
                  <Text style={styles.cardMuted}>
                    Assigned{" "}
                    {formatMoney(dashboard.next_paycheck.assigned_total)}
                    {"  "}Remaining{" "}
                    {formatMoney(dashboard.next_paycheck.remaining_amount)}
                  </Text>
                </>
              ) : (
                <Text style={styles.cardBody}>
                  No paycheck is scheduled yet.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Bills due before next paycheck
              </Text>
              {dashboard.bills_due_before_next_paycheck.length ? (
                dashboard.bills_due_before_next_paycheck
                  .slice(0, 5)
                  .map((bill) => (
                    <View key={String(bill.id)} style={styles.listRow}>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>
                          {bill.bill?.name || "Bill occurrence"}
                        </Text>
                        <Text style={styles.listSubtitle}>
                          Due {formatDate(bill.due_date)}
                        </Text>
                      </View>
                      <Text style={styles.listAmount}>
                        {formatMoney(bill.amount)}
                      </Text>
                    </View>
                  ))
              ) : (
                <Text style={styles.cardBody}>
                  Nothing is due before the next paycheck.
                </Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 4,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  secondaryButton: {
    borderColor: theme.colors.border,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  loadingCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 140,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  cardBody: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  cardMuted: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  highlight: {
    color: theme.colors.primary,
    fontSize: 32,
    fontWeight: "700",
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: "47%",
    padding: 18,
  },
  statLabel: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  errorTitle: {
    color: theme.colors.danger,
    fontSize: 18,
    fontWeight: "700",
  },
  errorText: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  listRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  listCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  listTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  listSubtitle: {
    color: theme.colors.muted,
    fontSize: 13,
  },
  listAmount: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
});
