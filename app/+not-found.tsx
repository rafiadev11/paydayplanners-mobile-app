import { useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { AppScreen, PrimaryButton, SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <SurfaceCard tone="warning" style={styles.card}>
        <Text style={styles.title}>Screen not found</Text>
        <Text style={styles.body}>
          That route does not exist in the mobile app. Return to the main
          planner and continue from there.
        </Text>
        <PrimaryButton
          label="Go home"
          onPress={() => {
            router.replace("/");
          }}
        />
      </SurfaceCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    alignItems: "center",
    gap: theme.spacing.md,
  },
  title: {
    color: theme.colors.ink,
    ...theme.typography.title,
    textAlign: "center",
  },
  body: {
    color: theme.colors.muted,
    ...theme.typography.body,
    textAlign: "center",
  },
});
