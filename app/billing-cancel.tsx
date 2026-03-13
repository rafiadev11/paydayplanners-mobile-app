import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  AppScreen,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function BillingCancelScreen() {
  const router = useRouter();

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <SurfaceCard tone="light" style={styles.card}>
        <Text style={styles.title}>Checkout canceled</Text>
        <Text style={styles.body}>
          No changes were made to your plan. You can stay on Free, start a
          trial, or return to checkout whenever you are ready.
        </Text>
        <View style={styles.actions}>
          <PrimaryButton
            icon="credit-card-outline"
            label="Back to billing"
            onPress={() => {
              router.replace("/billing");
            }}
          />
          <SecondaryButton
            icon="view-dashboard-outline"
            label="Go home"
            onPress={() => {
              router.replace("/dashboard");
            }}
          />
        </View>
      </SurfaceCard>
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
