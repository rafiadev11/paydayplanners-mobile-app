import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { theme } from "@shared/ui/theme";

export default function IndexScreen() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/dashboard" />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
});
