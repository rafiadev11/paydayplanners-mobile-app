import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AppStateStatus,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  DOWNLOAD_URL,
  dismissalKey,
  fetchMobileUpdatePolicy,
  type MobileUpdatePolicy,
} from "@features/app-update/api";
import { appUpdateDismissalStorage } from "@shared/storage/secure";
import { theme, withAlpha } from "@shared/ui/theme";

function UpdateButton({
  icon,
  label,
  onPress,
  tone = "primary",
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary";
}) {
  const primary = tone === "primary";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        primary ? styles.primaryAction : styles.secondaryAction,
        pressed ? styles.buttonPressed : null,
      ]}
    >
      <MaterialCommunityIcons
        color={primary ? theme.colors.white : theme.colors.ink}
        name={icon}
        size={18}
      />
      <Text
        style={[
          styles.actionLabel,
          primary ? styles.primaryActionLabel : styles.secondaryActionLabel,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppUpdateGate() {
  const [policy, setPolicy] = useState<MobileUpdatePolicy | null>(null);
  const checkingRef = useRef(false);

  const checkPolicy = useCallback(async () => {
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      const nextPolicy = await fetchMobileUpdatePolicy();

      if (!nextPolicy || nextPolicy.status === "current") {
        setPolicy(null);
        return;
      }

      if (nextPolicy.status === "available") {
        const dismissedKey = await appUpdateDismissalStorage.get();

        if (dismissedKey === dismissalKey(nextPolicy)) {
          setPolicy(null);
          return;
        }
      }

      setPolicy(nextPolicy);
    } catch {
      setPolicy((currentPolicy) =>
        currentPolicy?.status === "required" ? currentPolicy : null,
      );
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void checkPolicy();

    const subscription = AppState.addEventListener(
      "change",
      (status: AppStateStatus) => {
        if (status === "active") {
          void checkPolicy();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [checkPolicy]);

  const openUpdate = useCallback(() => {
    const url = policy?.store_url || DOWNLOAD_URL;

    void Linking.openURL(url).catch(() => {
      if (url !== DOWNLOAD_URL) {
        void Linking.openURL(DOWNLOAD_URL).catch(() => undefined);
      }
    });
  }, [policy]);

  const dismiss = useCallback(() => {
    if (!policy || policy.status !== "available") return;

    setPolicy(null);
    void appUpdateDismissalStorage.set(dismissalKey(policy));
  }, [policy]);

  if (!policy || policy.status === "current") {
    return null;
  }

  const required = policy.status === "required";
  const handleRequestClose = required ? () => undefined : dismiss;
  const title =
    policy.title ??
    (required ? "Update required" : "A new Payday Planner is ready");
  const message =
    policy.message ??
    (required
      ? "Install the latest version to keep planning with the newest security and reliability updates."
      : "Update now for the latest improvements, polish, and planning fixes.");

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleRequestClose}
      transparent
      visible
    >
      <SafeAreaView
        accessibilityViewIsModal
        edges={["top", "bottom"]}
        style={required ? styles.requiredRoot : styles.optionalRoot}
      >
        {required ? null : (
          <Pressable
            accessibilityLabel="Dismiss update prompt"
            onPress={dismiss}
            style={styles.optionalBackdrop}
          />
        )}

        <View style={required ? styles.requiredContent : styles.optionalCard}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name={required ? "cellphone-arrow-down" : "star-outline"}
              size={30}
            />
          </View>

          <View style={styles.copy}>
            <Text style={styles.eyebrow}>Version {policy.latest_version}</Text>
            <Text style={required ? styles.requiredTitle : styles.title}>
              {title}
            </Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.actions}>
            <UpdateButton
              icon="download"
              label="Update now"
              onPress={openUpdate}
            />
            {required ? null : (
              <UpdateButton
                icon="clock-outline"
                label="Later"
                onPress={dismiss}
                tone="secondary"
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  requiredRoot: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
  },
  optionalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: withAlpha(theme.colors.ink, 0.36),
    padding: theme.spacing.lg,
  },
  optionalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  requiredContent: {
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.borderStrong, 0.5),
    borderRadius: theme.radius.lg,
    backgroundColor: withAlpha(theme.colors.surfaceStrong, 0.96),
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.card,
  },
  optionalCard: {
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.borderStrong, 0.5),
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceStrong,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    ...theme.shadows.card,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.16),
  },
  copy: {
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  requiredTitle: {
    color: theme.colors.ink,
    fontSize: 30,
    fontWeight: "800",
  },
  message: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
  },
  secondaryAction: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  primaryActionLabel: {
    color: theme.colors.white,
  },
  secondaryActionLabel: {
    color: theme.colors.ink,
  },
});
