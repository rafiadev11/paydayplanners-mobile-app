import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AuthProvider, useAuth } from "@features/auth/auth-context";
import { theme } from "@shared/ui/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function HeaderCloseButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityHint="Closes this sheet and returns to the previous screen."
      accessibilityLabel="Close"
      hitSlop={10}
      onPress={() => {
        router.back();
      }}
      style={({ pressed }) => [
        styles.closeButton,
        pressed ? styles.closeButtonPressed : null,
      ]}
    >
      <MaterialCommunityIcons color={theme.colors.ink} name="close" size={20} />
    </Pressable>
  );
}

function RootNavigator() {
  const { ready } = useAuth();
  const modalOptions = {
    presentation: "modal" as const,
    headerRight: () => <HeaderCloseButton />,
  };

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.primary} size="small" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: theme.colors.surfaceStrong,
        },
        headerTintColor: theme.colors.ink,
        headerTitleStyle: {
          color: theme.colors.ink,
          fontSize: 16,
          fontWeight: "700",
        },
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: "Forgot password",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          title: "Reset password",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="billing"
        options={{
          title: "Billing",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="billing-success"
        options={{
          title: "Upgrade complete",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="billing-cancel"
        options={{
          title: "Checkout canceled",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="goals"
        options={{
          title: "Goals",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Stack.Screen
        name="pay-schedules/new"
        options={{
          title: "New Paycheck",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="pay-schedules/[id]"
        options={{
          title: "Edit Paycheck",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="bills/new"
        options={{
          title: "New Bill",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="bills/[id]"
        options={{
          title: "Edit Bill",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="savings-goals/new"
        options={{
          title: "New Savings Goal",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="savings-goals/[id]"
        options={{
          title: "Edit Savings Goal",
          ...modalOptions,
        }}
      />
      <Stack.Screen
        name="+not-found"
        options={{
          title: "Not Found",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
  },
  closeButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
});
