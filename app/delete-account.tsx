import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { deleteAccount } from "@features/auth/api";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { Field, StatusBadge, SurfaceCard } from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

function DangerRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.dangerRow}>
      <View style={styles.dangerIconWrap}>
        <MaterialCommunityIcons
          color={theme.colors.danger}
          name={icon}
          size={18}
        />
      </View>
      <View style={styles.dangerCopy}>
        <Text style={styles.dangerTitle}>{title}</Text>
        <Text style={styles.dangerBody}>{body}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  tone = "primary",
  icon,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "danger";
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "secondary" ? styles.actionButtonSecondary : null,
        tone === "danger" ? styles.actionButtonDanger : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
      ]}
    >
      {icon ? (
        <MaterialCommunityIcons
          color={
            tone === "secondary"
              ? theme.colors.ink
              : tone === "danger"
                ? theme.colors.white
                : theme.colors.white
          }
          name={icon}
          size={18}
        />
      ) : null}
      <Text
        style={[
          styles.actionButtonLabel,
          tone === "secondary" ? styles.actionButtonLabelSecondary : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InlineMessage({
  message,
  tone = "danger",
}: {
  message: string;
  tone?: "danger" | "info";
}) {
  return (
    <View
      style={[
        styles.inlineMessage,
        tone === "info" ? styles.inlineMessageInfo : null,
      ]}
    >
      <MaterialCommunityIcons
        color={
          tone === "info" ? theme.colors.primaryStrong : theme.colors.danger
        }
        name={tone === "info" ? "information-outline" : "alert-circle-outline"}
        size={18}
      />
      <Text
        style={[
          styles.inlineMessageLabel,
          tone === "info" ? styles.inlineMessageLabelInfo : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

export default function DeleteAccountScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const { ready, user, clearSession } = useAuth();
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedConfirmation = emailConfirmation.trim().toLowerCase();
  const normalizedEmail = user?.email.trim().toLowerCase() ?? "";
  const canDelete =
    normalizedConfirmation.length > 0 &&
    normalizedConfirmation === normalizedEmail;
  const hasPaidAccess = Boolean(
    user?.billing?.has_active_subscription || user?.billing?.on_trial,
  );
  const accessLabel = useMemo(() => {
    if (!user?.billing) return "Free";
    if (user.billing.on_trial) return "Pro trial";
    if (user.billing.has_active_subscription) return "Pro";
    if (user.billing.has_pro_access) return "Pro access";

    return "Free";
  }, [user?.billing]);

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    if (router.canGoBack()) {
      return;
    }

    router.replace("/dashboard");
  }, [navigationState?.key, router]);

  if (!ready) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const performDeletion = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await deleteAccount({
        email: normalizedConfirmation,
      });
      await clearSession();
      router.replace("/login");
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
      setSubmitting(false);
    }
  };

  const promptDeletion = () => {
    Alert.alert(
      "Delete account permanently?",
      hasPaidAccess
        ? "Your PaydayPlanner account and planning data will be permanently deleted, and your paid subscription will be canceled immediately. This cannot be undone."
        : "Your PaydayPlanner account and planning data will be permanently deleted. This cannot be undone.",
      [
        {
          style: "cancel",
          text: "Keep account",
        },
        {
          style: "destructive",
          text: "Delete permanently",
          onPress: () => {
            void performDeletion();
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topInkOrb} />
        <View style={styles.topDangerOrb} />
        <View style={styles.bottomGoldOrb} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: insets.bottom + theme.spacing.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Delete account</Text>
          <Text style={styles.title}>This action is permanent</Text>
          <Text style={styles.subtitle}>
            Use this only if you want to permanently remove your account,
            planning history, and settings from PaydayPlanner.
          </Text>
        </View>

        <SurfaceCard tone="dark" style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <StatusBadge label={accessLabel} tone="danger" />
            <StatusBadge label="No recovery" tone="warning" />
          </View>
          <Text style={styles.heroTitle}>
            You are about to erase this account
          </Text>
          <Text style={styles.heroBody}>
            Once deleted, your pay schedules, bills, goals, reminders, and
            account settings cannot be restored.
          </Text>
        </SurfaceCard>

        <SurfaceCard style={styles.warningCard}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <DangerRow
            body="Your account profile, planning data, and in-app settings are permanently deleted."
            icon="trash-can-outline"
            title="All planning data is removed"
          />
          <DangerRow
            body={
              hasPaidAccess
                ? "Your Pro subscription or trial is ended immediately as part of deletion."
                : "There is no active paid subscription on this account right now."
            }
            icon="credit-card-off-outline"
            title="Billing access stops now"
          />
          <DangerRow
            body="There is no undo, restore link, or recovery path after you confirm."
            icon="alert-octagon-outline"
            title="This cannot be reversed"
          />
        </SurfaceCard>

        <SurfaceCard style={styles.confirmCard}>
          <View style={styles.confirmHeader}>
            <View style={styles.confirmCopy}>
              <Text style={styles.sectionTitle}>Confirm with your email</Text>
              <Text style={styles.confirmBody}>
                Enter <Text style={styles.confirmEmail}>{user.email}</Text> to
                prove you want to permanently delete this account.
              </Text>
            </View>
            <MaterialCommunityIcons
              color={theme.colors.danger}
              name="shield-alert-outline"
              size={24}
            />
          </View>

          <Field
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            label="Account email"
            onChangeText={(value) => {
              setEmailConfirmation(value);
              setError(null);
            }}
            placeholder={user.email}
            textContentType="emailAddress"
            value={emailConfirmation}
          />

          {!canDelete ? (
            <InlineMessage
              message="The delete button unlocks only when the entered email exactly matches this account."
              tone="info"
            />
          ) : null}
          {error ? <InlineMessage message={error} /> : null}

          <View style={styles.actionColumn}>
            <ActionButton
              disabled={!canDelete || submitting}
              icon="trash-can-outline"
              label={
                submitting
                  ? "Deleting account..."
                  : "Delete account permanently"
              }
              onPress={promptDeletion}
              tone="danger"
            />
            <ActionButton
              disabled={submitting}
              icon="arrow-left"
              label="Keep my account"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }

                router.replace("/dashboard");
              }}
              tone="secondary"
            />
          </View>
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  topInkOrb: {
    position: "absolute",
    top: -70,
    left: -24,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: withAlpha(theme.colors.ink, 0.1),
  },
  topDangerOrb: {
    position: "absolute",
    top: 56,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 160,
    backgroundColor: withAlpha(theme.colors.danger, 0.12),
  },
  bottomGoldOrb: {
    position: "absolute",
    bottom: 56,
    left: -30,
    width: 190,
    height: 190,
    borderRadius: 190,
    backgroundColor: withAlpha(theme.colors.accent, 0.1),
  },
  header: {
    gap: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.danger,
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.text,
    ...theme.typography.title,
  },
  subtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  heroCard: {
    gap: theme.spacing.md,
    backgroundColor: "#241E24",
    borderColor: withAlpha("#241E24", 0.04),
  },
  heroHeader: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  heroTitle: {
    color: theme.colors.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroBody: {
    color: withAlpha(theme.colors.white, 0.78),
    ...theme.typography.body,
  },
  warningCard: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  dangerIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.dangerSoft,
  },
  dangerCopy: {
    flex: 1,
    gap: 4,
  },
  dangerTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  dangerBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  confirmCard: {
    gap: theme.spacing.md,
  },
  confirmHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  confirmCopy: {
    flex: 1,
    gap: 6,
  },
  confirmBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  confirmEmail: {
    color: theme.colors.ink,
    fontWeight: "800",
  },
  inlineMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dangerSoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.danger, 0.14),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  inlineMessageInfo: {
    backgroundColor: theme.colors.primarySoft,
    borderColor: withAlpha(theme.colors.primary, 0.14),
  },
  inlineMessageLabel: {
    flex: 1,
    color: theme.colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  inlineMessageLabelInfo: {
    color: theme.colors.primaryStrong,
  },
  actionColumn: {
    gap: theme.spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.ink,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  actionButtonSecondary: {
    backgroundColor: withAlpha(theme.colors.white, 0.72),
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  actionButtonDanger: {
    backgroundColor: theme.colors.danger,
  },
  actionButtonPressed: {
    opacity: 0.84,
  },
  actionButtonDisabled: {
    opacity: 0.55,
  },
  actionButtonLabel: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonLabelSecondary: {
    color: theme.colors.ink,
  },
});
