import { Stack, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@features/auth/auth-context";
import { BillReminderProvider } from "@features/notifications/bill-reminder-context";
import {
  BiometricLockProvider,
  useBiometricLock,
} from "@features/security/biometric-lock-context";
import { SENTRY_DSN, SENTRY_ENABLE_DEV } from "@shared/lib/env";
import { theme, withAlpha } from "@shared/ui/theme";
import * as Sentry from "@sentry/react-native";

const shouldInitSentry = !__DEV__ || SENTRY_ENABLE_DEV;

if (shouldInitSentry) {
  Sentry.init({
    dsn: SENTRY_DSN,
    debug: __DEV__,
    sendDefaultPii: false,
    enableLogs: false,
  });
}

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function HeaderCloseButton() {
  const router = useRouter();

  return (
    <Pressable
      accessibilityHint="Closes this sheet and returns to the previous screen."
      accessibilityLabel="Close"
      hitSlop={10}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();

          return;
        }

        router.replace("/dashboard");
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
  const { ready, user } = useAuth();
  const biometricLock = useBiometricLock();
  const lockVisible = Boolean(
    user && biometricLock.enabled && biometricLock.locked,
  );
  const modalOptions = {
    presentation: "modal" as const,
    headerRight: () => <HeaderCloseButton />,
  };

  useEffect(() => {
    if (!ready || !biometricLock.ready) return;
    void SplashScreen.hideAsync().catch(() => undefined);
  }, [biometricLock.ready, ready]);

  if (!ready || !biometricLock.ready) {
    return (
      <View style={styles.loadingScreen}>
        <Image
          source={require("../assets/splash-icon.png")}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <Text style={styles.loadingTagline}>
          Every payday, perfectly planned.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.appShell}>
      <View
        accessibilityElementsHidden={lockVisible}
        importantForAccessibility={lockVisible ? "no-hide-descendants" : "auto"}
        pointerEvents={lockVisible ? "none" : "auto"}
        style={styles.appShell}
      >
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
              title: user?.billing?.has_complimentary_access
                ? "Plan"
                : "Billing",
              ...modalOptions,
            }}
          />
          <Stack.Screen
            name="account"
            options={{
              title: "Account info",
              ...modalOptions,
            }}
          />
          <Stack.Screen
            name="delete-account"
            options={{
              title: "Delete account",
              ...modalOptions,
            }}
          />
          <Stack.Screen
            name="help-and-legal"
            options={{
              title: "Help & Support",
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
      </View>

      {lockVisible ? <BiometricLockScreen /> : null}
    </View>
  );
}

function LockActionButton({
  label,
  onPress,
  tone = "primary",
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.lockActionButton,
        tone === "secondary" ? styles.lockActionButtonSecondary : null,
        pressed && !disabled ? styles.closeButtonPressed : null,
        disabled ? styles.lockActionDisabled : null,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          color={tone === "secondary" ? theme.colors.ink : theme.colors.white}
          name={icon}
          size={18}
        />
      ) : null}
      <Text
        style={[
          styles.lockActionLabel,
          tone === "secondary" ? styles.lockActionLabelSecondary : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function BiometricLockScreen() {
  const { user } = useAuth();
  const biometricLock = useBiometricLock();

  return (
    <SafeAreaView
      accessibilityViewIsModal
      edges={["top", "bottom"]}
      style={styles.lockRoot}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.lockTopOrb} />
        <View style={styles.lockAccentOrb} />
        <View style={styles.lockBottomOrb} />
      </View>

      <View style={styles.lockContent}>
        <View style={styles.lockEyebrowRow}>
          <MaterialCommunityIcons
            color={theme.colors.primaryStrong}
            name="shield-check-outline"
            size={18}
          />
          <Text style={styles.lockEyebrow}>Secure access</Text>
        </View>

        <View style={styles.lockCard}>
          <View style={styles.lockIconWrap}>
            <MaterialCommunityIcons
              color={theme.colors.ink}
              name={
                biometricLock.capability.label.includes("Face")
                  ? "face-recognition"
                  : "fingerprint"
              }
              size={34}
            />
          </View>
          <Text style={styles.lockTitle}>
            Unlock with {biometricLock.capability.label}
          </Text>
          <Text style={styles.lockBody}>
            {biometricLock.blockReason ??
              "Biometric protection is on for this device. Verify before PaydayPlanner shows your paycheck and bill details."}
          </Text>
          <View style={styles.lockIdentity}>
            <Text style={styles.lockIdentityLabel}>Signed in as</Text>
            <Text style={styles.lockIdentityValue}>
              {user?.email ?? "Account"}
            </Text>
          </View>
          <View style={styles.lockActions}>
            <LockActionButton
              disabled={biometricLock.unlocking}
              icon="shield-check-outline"
              label={
                biometricLock.unlocking
                  ? "Checking identity..."
                  : `Unlock with ${biometricLock.capability.label}`
              }
              onPress={() => {
                void biometricLock.unlockApp();
              }}
            />
            <LockActionButton
              disabled={biometricLock.unlocking}
              icon="logout"
              label="Sign out and use password"
              onPress={() => {
                void biometricLock.fallbackToPasswordSignIn();
              }}
              tone="secondary"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <BillReminderProvider>
        <BiometricLockProvider>
          <RootNavigator />
        </BiometricLockProvider>
      </BillReminderProvider>
    </AuthProvider>
  );
}

export default shouldInitSentry ? Sentry.wrap(RootLayout) : RootLayout;

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4EFE7",
  },
  loadingLogo: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  loadingTagline: {
    color: "rgba(19, 34, 56, 0.7)",
    fontSize: 17,
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 48,
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
  lockRoot: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background,
  },
  lockContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  lockEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lockEyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  lockCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.borderStrong, 0.45),
    backgroundColor: withAlpha(theme.colors.surfaceStrong, 0.94),
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  lockIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
    borderRadius: 36,
    alignSelf: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lockTitle: {
    color: theme.colors.text,
    textAlign: "center",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  lockBody: {
    color: theme.colors.muted,
    textAlign: "center",
    ...theme.typography.body,
  },
  lockIdentity: {
    alignItems: "center",
    gap: 4,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  lockIdentityLabel: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  lockIdentityValue: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  lockActions: {
    gap: theme.spacing.sm,
  },
  lockActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  lockActionButtonSecondary: {
    backgroundColor: withAlpha(theme.colors.white, 0.72),
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  lockActionDisabled: {
    opacity: 0.55,
  },
  lockActionLabel: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  lockActionLabelSecondary: {
    color: theme.colors.ink,
  },
  lockTopOrb: {
    position: "absolute",
    top: -70,
    left: -18,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: withAlpha(theme.colors.ink, 0.12),
  },
  lockAccentOrb: {
    position: "absolute",
    top: 90,
    right: -26,
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  lockBottomOrb: {
    position: "absolute",
    bottom: 60,
    left: -24,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
  },
});
