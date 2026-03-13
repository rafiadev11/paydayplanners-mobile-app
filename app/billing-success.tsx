import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { fetchBillingStatus, syncCheckoutSession } from "@features/billing/api";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  AppScreen,
  ErrorState,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function BillingSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ session_id?: string | string[] }>();
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const syncedKeyRef = useRef<string | null>(null);

  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id;
  const syncKey = sessionId ?? "__missing_session__";

  const syncBilling = useEffectEvent(async (force = false) => {
    if (!force && syncedKeyRef.current === syncKey) {
      return;
    }

    syncedKeyRef.current = syncKey;
    setLoading(true);

    try {
      if (sessionId) {
        await syncCheckoutSession(sessionId);
      }

      await Promise.all([refreshUser(), fetchBillingStatus()]);
      setError(null);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void syncBilling();
  }, [syncBilling, syncKey]);

  return (
    <AppScreen contentContainerStyle={styles.content}>
      {loading ? (
        <SurfaceCard tone="accent" style={styles.card}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={styles.title}>Finishing your upgrade</Text>
          <Text style={styles.body}>
            We are confirming your Stripe checkout and refreshing Pro access.
          </Text>
        </SurfaceCard>
      ) : error ? (
        <ErrorState
          body={error}
          onRetry={() => {
            syncedKeyRef.current = null;
            void syncBilling(true);
          }}
          title="Upgrade sync incomplete"
        />
      ) : (
        <SurfaceCard tone="accent" style={styles.card}>
          <Text style={styles.title}>Pro is ready</Text>
          <Text style={styles.body}>
            Your billing status has been refreshed. You can now use the 12-month
            forecast and advanced planning controls.
          </Text>
          <View style={styles.actions}>
            <PrimaryButton
              icon="timeline-text-outline"
              label="Open forecast"
              onPress={() => {
                router.replace("/plan");
              }}
            />
            <SecondaryButton
              icon="credit-card-outline"
              label="View billing"
              onPress={() => {
                router.replace("/billing");
              }}
            />
          </View>
        </SurfaceCard>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: "center",
    flexGrow: 1,
  },
  card: {
    alignItems: "center",
  },
  title: {
    color: theme.colors.ink,
    textAlign: "center",
    ...theme.typography.cardTitle,
  },
  body: {
    color: theme.colors.muted,
    textAlign: "center",
    ...theme.typography.body,
  },
  actions: {
    width: "100%",
    gap: theme.spacing.sm,
  },
});
