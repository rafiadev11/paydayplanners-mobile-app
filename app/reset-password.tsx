import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
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

import { resetPassword } from "@features/auth/api";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

function paramValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    email?: string | string[];
    token?: string | string[];
  }>();
  const token = useMemo(() => paramValue(params.token), [params.token]);
  const [email, setEmail] = useState(() => paramValue(params.email));
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasValidLink = token.length > 0;

  if (user) return <Redirect href="/dashboard" />;

  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      await resetPassword({
        email: email.trim(),
        token,
        password,
        passwordConfirmation,
      });
      setSuccess(true);
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: theme.spacing.lg,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Recovery</Text>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.subtitle}>
            Set a new password for your account, then sign back in and continue
            planning.
          </Text>
        </View>

        <SurfaceCard style={styles.formCard}>
          {!hasValidLink ? (
            <>
              <Text style={styles.cardTitle}>This link is incomplete</Text>
              <Text style={styles.cardBody}>
                Request a fresh reset email from the sign-in screen and open the
                new link on this device.
              </Text>
              <PrimaryButton
                label="Request new link"
                onPress={() => {
                  router.replace("/forgot-password");
                }}
              />
              <SecondaryButton
                label="Back to sign in"
                onPress={() => {
                  router.replace("/login");
                }}
              />
            </>
          ) : success ? (
            <>
              <Text style={styles.cardTitle}>Password updated</Text>
              <Text style={styles.cardBody}>
                Your password has been reset successfully. Use it the next time
                you sign in.
              </Text>
              <PrimaryButton
                label="Go to sign in"
                onPress={() => {
                  router.replace("/login");
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Reset password</Text>
              <Field
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                placeholder="you@example.com"
                returnKeyType="next"
                textContentType="emailAddress"
                value={email}
              />
              <View style={styles.passwordGroup}>
                <Text style={styles.passwordLabel}>New password</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="password-new"
                    autoCorrect={false}
                    onChangeText={setPassword}
                    placeholder="New password"
                    placeholderTextColor={theme.colors.muted}
                    returnKeyType="next"
                    secureTextEntry={!passwordVisible}
                    style={styles.passwordInput}
                    textContentType="newPassword"
                    value={password}
                  />
                  <Pressable
                    accessibilityHint="Shows or hides your new password."
                    accessibilityLabel={
                      passwordVisible ? "Hide password" : "Show password"
                    }
                    hitSlop={10}
                    onPress={() => {
                      setPasswordVisible((current) => !current);
                    }}
                    style={({ pressed }) => [
                      styles.passwordToggle,
                      pressed ? styles.passwordTogglePressed : null,
                    ]}
                  >
                    <Text style={styles.passwordToggleLabel}>
                      {passwordVisible ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.passwordGroup}>
                <Text style={styles.passwordLabel}>Confirm password</Text>
                <View style={styles.passwordInputWrap}>
                  <TextInput
                    autoCapitalize="none"
                    autoComplete="password-new"
                    autoCorrect={false}
                    onChangeText={setPasswordConfirmation}
                    onSubmitEditing={() => {
                      void submit();
                    }}
                    placeholder="Confirm password"
                    placeholderTextColor={theme.colors.muted}
                    returnKeyType="go"
                    secureTextEntry={!confirmationVisible}
                    style={styles.passwordInput}
                    textContentType="password"
                    value={passwordConfirmation}
                  />
                  <Pressable
                    accessibilityHint="Shows or hides your password confirmation."
                    accessibilityLabel={
                      confirmationVisible
                        ? "Hide password confirmation"
                        : "Show password confirmation"
                    }
                    hitSlop={10}
                    onPress={() => {
                      setConfirmationVisible((current) => !current);
                    }}
                    style={({ pressed }) => [
                      styles.passwordToggle,
                      pressed ? styles.passwordTogglePressed : null,
                    ]}
                  >
                    <Text style={styles.passwordToggleLabel}>
                      {confirmationVisible ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={loading}
                label={loading ? "Updating..." : "Update password"}
                onPress={() => {
                  void submit();
                }}
              />
              <SecondaryButton
                disabled={loading}
                label="Back to sign in"
                onPress={() => {
                  router.replace("/login");
                }}
              />
            </>
          )}
        </SurfaceCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 18,
  },
  header: {
    gap: 10,
  },
  eyebrow: {
    color: theme.colors.primaryStrong,
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.ink,
    ...theme.typography.title,
  },
  subtitle: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  formCard: {
    gap: 16,
  },
  cardTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  cardBody: {
    color: theme.colors.muted,
    ...theme.typography.body,
  },
  passwordGroup: {
    gap: 6,
  },
  passwordLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  passwordInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingLeft: 16,
    paddingRight: 12,
    minHeight: 56,
  },
  passwordInput: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 16,
    paddingVertical: 14,
  },
  passwordToggle: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceMuted,
  },
  passwordTogglePressed: {
    opacity: 0.8,
  },
  passwordToggleLabel: {
    color: theme.colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
});
