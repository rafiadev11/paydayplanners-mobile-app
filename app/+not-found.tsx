import { Link } from "expo-router";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { theme } from "@shared/ui/theme";

export default function NotFoundScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Screen not found</Text>
        <Link href="/" style={styles.link}>
          Return home
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "700",
  },
  link: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: "600",
  },
});
