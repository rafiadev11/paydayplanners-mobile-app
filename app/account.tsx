import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  resendVerificationEmail,
  updatePassword,
  updateProfile,
} from "@features/auth/api";
import { useAuth } from "@features/auth/auth-context";
import { useBillReminders } from "@features/notifications/bill-reminder-context";
import { useBiometricLock } from "@features/security/biometric-lock-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { formatDateWithYear } from "@shared/lib/format";
import { Field, StatusBadge, SurfaceCard } from "@shared/ui/primitives";
import { theme, withAlpha } from "@shared/ui/theme";

function timezoneLabel(value: string | null | undefined) {
  if (!value) return "Auto";

  return value
    .split("/")
    .map((segment) => segment.replace(/_/g, " "))
    .join(" / ");
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryTileLabel}>{label}</Text>
      <Text style={styles.summaryTileValue}>{value}</Text>
    </View>
  );
}

function NoticeBanner({
  icon,
  tone = "info",
  message,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: "info" | "success" | "danger";
  message: string;
}) {
  return (
    <View
      style={[
        styles.noticeBanner,
        tone === "success" ? styles.noticeBannerSuccess : null,
        tone === "danger" ? styles.noticeBannerDanger : null,
      ]}
    >
      <MaterialCommunityIcons
        color={
          tone === "danger"
            ? theme.colors.danger
            : tone === "success"
              ? theme.colors.success
              : theme.colors.primaryStrong
        }
        name={icon}
        size={18}
      />
      <Text
        style={[
          styles.noticeBannerLabel,
          tone === "success" ? styles.noticeBannerLabelSuccess : null,
          tone === "danger" ? styles.noticeBannerLabelDanger : null,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  icon,
  tone = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  tone?: "primary" | "secondary";
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        tone === "secondary" ? styles.actionButtonSecondary : null,
        pressed && !disabled ? styles.actionButtonPressed : null,
        disabled ? styles.actionButtonDisabled : null,
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
          styles.actionButtonLabel,
          tone === "secondary" ? styles.actionButtonLabelSecondary : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PasswordField({
  label,
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisibility,
  autoComplete,
  textContentType,
  returnKeyType,
  onSubmitEditing,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete?:
    | "current-password"
    | "new-password"
    | "off"
    | "password"
    | undefined;
  textContentType?: "password" | "newPassword";
  returnKeyType?: "done" | "go" | "next";
  onSubmitEditing?: () => void;
}) {
  return (
    <View style={styles.passwordGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordInputWrap}>
        <TextInput
          autoCapitalize="none"
          autoComplete={autoComplete}
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          returnKeyType={returnKeyType}
          secureTextEntry={!visible}
          style={styles.passwordInput}
          textContentType={textContentType}
          value={value}
        />
        <Pressable
          accessibilityHint={`Shows or hides the ${label.toLowerCase()} field.`}
          accessibilityLabel={visible ? `Hide ${label}` : `Show ${label}`}
          hitSlop={10}
          onPress={onToggleVisibility}
          style={({ pressed }) => [
            styles.passwordToggle,
            pressed ? styles.passwordTogglePressed : null,
          ]}
        >
          <MaterialCommunityIcons
            color={theme.colors.primaryStrong}
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={20}
          />
        </Pressable>
      </View>
    </View>
  );
}

export default function AccountInfoScreen() {
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const { ready, user, syncUser } = useAuth();
  const biometricLock = useBiometricLock();
  const billReminders = useBillReminders();
  const {
    capability,
    disableBiometricLock,
    enableBiometricLock,
    enabled: biometricEnabled,
    refreshCapability,
  } = biometricLock;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
  const [nextPasswordVisible, setNextPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [verificationTone, setVerificationTone] = useState<
    "info" | "success" | "danger"
  >("info");

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const profileDirty = useMemo(() => {
    if (!user) return false;

    return (
      normalizedName !== user.name.trim() ||
      normalizedEmail !== user.email.trim().toLowerCase()
    );
  }, [normalizedEmail, normalizedName, user]);
  const emailChanged = useMemo(() => {
    if (!user) return false;

    return normalizedEmail !== user.email.trim().toLowerCase();
  }, [normalizedEmail, user]);
  const biometricStatusLabel = biometricEnabled
    ? `${capability.label} on`
    : "Off";
  const reminderStatusLabel = billReminders.enabled
    ? "On"
    : billReminders.permissionStatus === "denied"
      ? "Blocked"
      : "Off";

  useEffect(() => {
    if (!navigationState?.key) {
      return;
    }

    if (router.canGoBack()) {
      return;
    }

    router.replace("/dashboard");
  }, [navigationState?.key, router]);

  useEffect(() => {
    void refreshCapability();
  }, [refreshCapability]);

  if (!ready) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  const submitProfile = async () => {
    if (!normalizedName) {
      setProfileError("Enter the name you want on this account.");
      setProfileSuccess(null);
      return;
    }

    if (!normalizedEmail) {
      setProfileError("Enter the email address you use to sign in.");
      setProfileSuccess(null);
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    setVerificationMessage(null);
    setVerificationTone("info");

    try {
      const nextUser = await updateProfile({
        name: normalizedName,
        email: normalizedEmail,
      });

      await syncUser(nextUser);
      setName(nextUser.name);
      setEmail(nextUser.email);
      setProfileSuccess(
        nextUser.email_verified_at
          ? "Your account details are up to date."
          : emailChanged
            ? "Details saved. Verify your new email to keep recovery and alerts pointed at the right inbox."
            : "Details saved. Your email still needs verification before recovery and security notices are fully confirmed.",
      );
    } catch (error) {
      setProfileError(getApiErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  };

  const resetProfileForm = () => {
    setName(user.name);
    setEmail(user.email);
    setProfileError(null);
    setProfileSuccess(null);
  };

  const submitPassword = async () => {
    if (!currentPassword || !nextPassword || !passwordConfirmation) {
      setPasswordError("Fill in all password fields to make the change.");
      setPasswordSuccess(null);
      return;
    }

    if (nextPassword !== passwordConfirmation) {
      setPasswordError("Your new password and confirmation must match.");
      setPasswordSuccess(null);
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      await updatePassword({
        currentPassword,
        password: nextPassword,
        passwordConfirmation,
      });

      setCurrentPassword("");
      setNextPassword("");
      setPasswordConfirmation("");
      setPasswordSuccess("Password updated.");
    } catch (error) {
      setPasswordError(getApiErrorMessage(error));
    } finally {
      setPasswordSaving(false);
    }
  };

  const sendVerification = async () => {
    setVerificationSending(true);
    setVerificationMessage(null);

    try {
      const response = await resendVerificationEmail();
      setVerificationMessage(response.message);
      setVerificationTone("success");
    } catch (error) {
      setVerificationMessage(getApiErrorMessage(error));
      setVerificationTone("danger");
    } finally {
      setVerificationSending(false);
    }
  };

  const handleEnableBiometrics = async () => {
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);

    try {
      const result = await enableBiometricLock();

      if (result.success) {
        setSecurityMessage(
          result.message ?? `${capability.label} protection is now enabled.`,
        );
        return;
      }

      setSecurityError(
        result.message ?? `We couldn't enable ${capability.label} right now.`,
      );
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleDisableBiometrics = async () => {
    setSecurityBusy(true);
    setSecurityError(null);
    setSecurityMessage(null);

    try {
      await disableBiometricLock();
      setSecurityMessage("Biometric protection is now off on this device.");
    } finally {
      setSecurityBusy(false);
    }
  };

  const handleEnableReminders = async () => {
    setReminderError(null);
    setReminderMessage(null);

    const result = await billReminders.enableReminders();

    if (result.ok) {
      setReminderMessage(result.message);
      return;
    }

    setReminderError(result.message);
  };

  const handleDisableReminders = async () => {
    setReminderError(null);
    setReminderMessage(null);
    await billReminders.disableReminders();
    setReminderMessage("Bill reminders are now off on this device.");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.screen}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.topInkOrb} />
        <View style={styles.topTealOrb} />
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
          <Text style={styles.eyebrow}>Account</Text>
          <Text style={styles.title}>Keep the essentials current</Text>
          <Text style={styles.subtitle}>
            Update the details you sign in with, confirm where important emails
            land, and tighten security without leaving the app.
          </Text>
        </View>

        <SurfaceCard tone="dark" style={styles.heroCard}>
          <View style={styles.heroBadgeRow}>
            <StatusBadge label="Full access" tone="accent" />
            <StatusBadge
              label={
                user.email_verified_at ? "Email verified" : "Needs verification"
              }
              tone={user.email_verified_at ? "success" : "warning"}
            />
          </View>
          <Text style={styles.heroName}>{user.name}</Text>
          <Text style={styles.heroEmail}>{user.email}</Text>

          <View style={styles.summaryGrid}>
            <SummaryTile
              label="Member since"
              value={
                user.created_at
                  ? formatDateWithYear(user.created_at)
                  : "Recently"
              }
            />
            <SummaryTile
              label="Timezone"
              value={timezoneLabel(user.timezone)}
            />
            <SummaryTile label="Access" value="Full" />
            <SummaryTile
              label="Sign-in email"
              value={user.email_verified_at ? "Confirmed" : "Pending"}
            />
          </View>
        </SurfaceCard>

        {!user.email_verified_at ? (
          <SurfaceCard tone="warning">
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardTitle}>Verify your email</Text>
                <Text style={styles.cardSubtitle}>
                  Password recovery and security notices should land in the
                  right inbox. Send a fresh verification link if you need one.
                </Text>
              </View>
              <MaterialCommunityIcons
                color={theme.colors.warning}
                name="email-check-outline"
                size={24}
              />
            </View>
            {verificationMessage ? (
              <NoticeBanner
                icon="email-fast-outline"
                message={verificationMessage}
                tone={verificationTone}
              />
            ) : null}
            <ActionButton
              disabled={verificationSending}
              icon="email-fast-outline"
              label={
                verificationSending
                  ? "Sending verification..."
                  : "Send verification email"
              }
              onPress={() => {
                void sendVerification();
              }}
              tone="secondary"
            />
          </SurfaceCard>
        ) : null}

        <SurfaceCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Personal info</Text>
              <Text style={styles.cardSubtitle}>
                This is the identity shown on your account and used for sign-in,
                receipts, and verification.
              </Text>
            </View>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="account-edit-outline"
              size={24}
            />
          </View>

          <Field
            autoCapitalize="words"
            label="Full name"
            onChangeText={(value) => {
              setName(value);
              setProfileError(null);
              setProfileSuccess(null);
            }}
            placeholder="Rachid Rafia"
            returnKeyType="next"
            textContentType="name"
            value={name}
          />
          <Field
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email address"
            onChangeText={(value) => {
              setEmail(value);
              setProfileError(null);
              setProfileSuccess(null);
            }}
            placeholder="you@example.com"
            returnKeyType="go"
            textContentType="emailAddress"
            value={email}
          />

          <View style={styles.infoStrip}>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="information-outline"
              size={18}
            />
            <Text style={styles.infoStripLabel}>
              Your email is used for sign-in, password resets, and account
              security updates.
            </Text>
          </View>

          {profileError ? (
            <NoticeBanner
              icon="alert-circle-outline"
              message={profileError}
              tone="danger"
            />
          ) : null}
          {profileSuccess ? (
            <NoticeBanner
              icon="check-circle-outline"
              message={profileSuccess}
              tone="success"
            />
          ) : null}

          <View style={styles.actionColumn}>
            <ActionButton
              disabled={!profileDirty || profileSaving}
              icon="content-save-outline"
              label={profileSaving ? "Saving changes..." : "Save personal info"}
              onPress={() => {
                void submitProfile();
              }}
            />
            {profileDirty ? (
              <ActionButton
                disabled={profileSaving}
                icon="restore"
                label="Reset changes"
                onPress={resetProfileForm}
                tone="secondary"
              />
            ) : null}
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Bill reminders</Text>
              <Text style={styles.cardSubtitle}>
                Get a basic reminder before upcoming bills are due. Free
                reminders use one morning alert per day so they stay useful
                without getting noisy.
              </Text>
            </View>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="bell-ring-outline"
              size={24}
            />
          </View>

          <View style={styles.securitySummaryRow}>
            <View style={styles.securitySummaryCopy}>
              <Text style={styles.securitySummaryTitle}>
                Upcoming bill alerts
              </Text>
              <Text style={styles.securitySummaryBody}>
                {billReminders.enabled
                  ? billReminders.scheduledCount > 0
                    ? `${billReminders.scheduledCount} reminder${billReminders.scheduledCount === 1 ? "" : "s"} currently scheduled from your upcoming bills.`
                    : "Reminders are on. New alerts will schedule as bills enter the planning window."
                  : "Default timing sends a reminder the morning before a bill is due, or the due morning if the earlier reminder was missed."}
              </Text>
            </View>
            <StatusBadge
              label={reminderStatusLabel}
              tone={
                billReminders.enabled
                  ? "success"
                  : billReminders.permissionStatus === "denied"
                    ? "warning"
                    : "neutral"
              }
            />
          </View>

          <View style={styles.infoStrip}>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="shield-outline"
              size={18}
            />
            <Text style={styles.infoStripLabel}>
              Reminder notifications stay generic on the lock screen and open
              the Bills tab when tapped.
            </Text>
          </View>

          {reminderError ? (
            <NoticeBanner
              icon="alert-circle-outline"
              message={reminderError}
              tone="danger"
            />
          ) : null}
          {reminderMessage ? (
            <NoticeBanner
              icon="check-circle-outline"
              message={reminderMessage}
              tone="success"
            />
          ) : null}

          <View style={styles.actionColumn}>
            {billReminders.enabled ? (
              <>
                <ActionButton
                  disabled={billReminders.syncing}
                  icon="refresh"
                  label={
                    billReminders.syncing
                      ? "Refreshing reminders..."
                      : "Refresh reminders"
                  }
                  onPress={() => {
                    setReminderError(null);
                    setReminderMessage(null);
                    void billReminders.refreshReminders().then((result) => {
                      if (result.ok) {
                        setReminderMessage(result.message);
                        return;
                      }

                      setReminderError(result.message);
                    });
                  }}
                />
                <ActionButton
                  disabled={billReminders.syncing}
                  icon="bell-off-outline"
                  label={
                    billReminders.syncing
                      ? "Updating reminders..."
                      : "Turn off bill reminders"
                  }
                  onPress={() => {
                    void handleDisableReminders();
                  }}
                  tone="secondary"
                />
              </>
            ) : billReminders.permissionStatus === "denied" ? (
              <>
                <ActionButton
                  disabled={billReminders.syncing}
                  icon="cog-outline"
                  label="Open device settings"
                  onPress={() => {
                    void billReminders.openDeviceSettings();
                  }}
                />
                <ActionButton
                  disabled={billReminders.syncing}
                  icon="refresh"
                  label="Check permission again"
                  onPress={() => {
                    setReminderError(null);
                    setReminderMessage(null);
                    void handleEnableReminders();
                  }}
                  tone="secondary"
                />
              </>
            ) : (
              <ActionButton
                disabled={billReminders.syncing}
                icon="bell-ring-outline"
                label={
                  billReminders.syncing
                    ? "Turning on reminders..."
                    : "Turn on bill reminders"
                }
                onPress={() => {
                  void handleEnableReminders();
                }}
              />
            )}
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Password & security</Text>
              <Text style={styles.cardSubtitle}>
                Confirm with your current password, then set a new one with at
                least 8 characters.
              </Text>
            </View>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="shield-lock-outline"
              size={24}
            />
          </View>

          <PasswordField
            autoComplete="current-password"
            label="Current password"
            onChangeText={(value) => {
              setCurrentPassword(value);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            onToggleVisibility={() => {
              setCurrentPasswordVisible((current) => !current);
            }}
            placeholder="Current password"
            returnKeyType="next"
            textContentType="password"
            value={currentPassword}
            visible={currentPasswordVisible}
          />
          <PasswordField
            autoComplete="new-password"
            label="New password"
            onChangeText={(value) => {
              setNextPassword(value);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            onToggleVisibility={() => {
              setNextPasswordVisible((current) => !current);
            }}
            placeholder="New password"
            returnKeyType="next"
            textContentType="newPassword"
            value={nextPassword}
            visible={nextPasswordVisible}
          />
          <PasswordField
            autoComplete="new-password"
            label="Confirm new password"
            onChangeText={(value) => {
              setPasswordConfirmation(value);
              setPasswordError(null);
              setPasswordSuccess(null);
            }}
            onSubmitEditing={() => {
              void submitPassword();
            }}
            onToggleVisibility={() => {
              setConfirmationVisible((current) => !current);
            }}
            placeholder="Confirm new password"
            returnKeyType="go"
            textContentType="newPassword"
            value={passwordConfirmation}
            visible={confirmationVisible}
          />

          {passwordError ? (
            <NoticeBanner
              icon="alert-circle-outline"
              message={passwordError}
              tone="danger"
            />
          ) : null}
          {passwordSuccess ? (
            <NoticeBanner
              icon="check-circle-outline"
              message={passwordSuccess}
              tone="success"
            />
          ) : null}

          <ActionButton
            disabled={
              passwordSaving ||
              !currentPassword ||
              !nextPassword ||
              !passwordConfirmation
            }
            icon="shield-lock-outline"
            label={passwordSaving ? "Updating password..." : "Update password"}
            onPress={() => {
              void submitPassword();
            }}
          />
        </SurfaceCard>

        <SurfaceCard style={styles.formCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderCopy}>
              <Text style={styles.cardTitle}>Biometric app lock</Text>
              <Text style={styles.cardSubtitle}>
                Add a device-level unlock step before cached sessions can open
                your paycheck and bill data.
              </Text>
            </View>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="shield-account-outline"
              size={24}
            />
          </View>

          <View style={styles.securitySummaryRow}>
            <View style={styles.securitySummaryCopy}>
              <Text style={styles.securitySummaryTitle}>
                {capability.label}
              </Text>
              <Text style={styles.securitySummaryBody}>
                {capability.supported
                  ? capability.enrolled
                    ? "Use your device biometrics to unlock PaydayPlanner after launch and when returning from the background."
                    : (capability.reason ??
                      `Set up ${capability.label} in device settings first.`)
                  : (capability.reason ??
                    "Biometric authentication is unavailable on this device.")}
              </Text>
            </View>
            <StatusBadge
              label={biometricStatusLabel}
              tone={biometricEnabled ? "success" : "neutral"}
            />
          </View>

          <View style={styles.infoStrip}>
            <MaterialCommunityIcons
              color={theme.colors.primaryStrong}
              name="clock-outline"
              size={18}
            />
            <Text style={styles.infoStripLabel}>
              When enabled, PaydayPlanner asks for biometric verification on app
              launch and after about 15 seconds away from the app.
            </Text>
          </View>

          {securityError ? (
            <NoticeBanner
              icon="alert-circle-outline"
              message={securityError}
              tone="danger"
            />
          ) : null}
          {securityMessage ? (
            <NoticeBanner
              icon="check-circle-outline"
              message={securityMessage}
              tone="success"
            />
          ) : null}

          {biometricEnabled ? (
            <View style={styles.actionColumn}>
              <ActionButton
                disabled={securityBusy}
                icon="shield-off-outline"
                label={
                  securityBusy
                    ? "Updating protection..."
                    : "Turn off biometric lock"
                }
                onPress={() => {
                  void handleDisableBiometrics();
                }}
                tone="secondary"
              />
            </View>
          ) : (
            <View style={styles.actionColumn}>
              <ActionButton
                disabled={
                  securityBusy || !capability.supported || !capability.enrolled
                }
                icon="shield-check-outline"
                label={
                  securityBusy
                    ? "Checking biometrics..."
                    : `Turn on ${capability.label}`
                }
                onPress={() => {
                  void handleEnableBiometrics();
                }}
              />
            </View>
          )}
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
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  topInkOrb: {
    position: "absolute",
    top: -72,
    left: -24,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: withAlpha(theme.colors.ink, 0.12),
  },
  topTealOrb: {
    position: "absolute",
    top: 48,
    right: -34,
    width: 146,
    height: 146,
    borderRadius: 146,
    backgroundColor: withAlpha(theme.colors.primary, 0.14),
  },
  bottomGoldOrb: {
    position: "absolute",
    bottom: 42,
    left: -28,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: withAlpha(theme.colors.accent, 0.12),
  },
  header: {
    gap: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.primaryStrong,
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
    gap: theme.spacing.lg,
  },
  heroBadgeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  heroName: {
    color: theme.colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroEmail: {
    marginTop: -8,
    color: withAlpha(theme.colors.white, 0.78),
    fontSize: 15,
    lineHeight: 22,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  summaryTile: {
    width: "48%",
    minWidth: "48%",
    borderRadius: theme.radius.md,
    backgroundColor: withAlpha(theme.colors.white, 0.08),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.white, 0.1),
    padding: theme.spacing.md,
    gap: 4,
  },
  summaryTileLabel: {
    color: withAlpha(theme.colors.white, 0.64),
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  summaryTileValue: {
    color: theme.colors.white,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  formCard: {
    gap: theme.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  cardHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: theme.colors.text,
    ...theme.typography.cardTitle,
  },
  cardSubtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  securitySummaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  securitySummaryCopy: {
    flex: 1,
    gap: 6,
  },
  securitySummaryTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  securitySummaryBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  infoStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.14),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  infoStripLabel: {
    flex: 1,
    color: theme.colors.primaryStrong,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.primary, 0.14),
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  noticeBannerSuccess: {
    backgroundColor: theme.colors.successSoft,
    borderColor: withAlpha(theme.colors.success, 0.14),
  },
  noticeBannerDanger: {
    backgroundColor: theme.colors.dangerSoft,
    borderColor: withAlpha(theme.colors.danger, 0.16),
  },
  noticeBannerLabel: {
    flex: 1,
    color: theme.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  noticeBannerLabelSuccess: {
    color: theme.colors.success,
  },
  noticeBannerLabelDanger: {
    color: theme.colors.danger,
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
  fieldLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  passwordGroup: {
    gap: 8,
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    paddingLeft: 16,
  },
  passwordInput: {
    flex: 1,
    color: theme.colors.text,
    paddingVertical: 14,
    fontSize: 16,
  },
  passwordToggle: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },
  passwordTogglePressed: {
    opacity: 0.8,
  },
});
