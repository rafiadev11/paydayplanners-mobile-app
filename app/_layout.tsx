import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import { AuthProvider, useAuth } from "@features/auth/auth-context";
import { theme } from "@shared/ui/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { ready } = useAuth();

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
