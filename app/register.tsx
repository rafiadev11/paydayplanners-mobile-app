import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  Alert,
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

import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { PRIVACY_URL, TERMS_URL } from "@shared/lib/env";
import { Field, PrimaryButton, SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmationVisible, setPasswordConfirmationVisible] =
    useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href="/dashboard" />;

  const openLegalDocument = async (url: string) => {
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert("Unable to open link", "Please try again in a moment.");
    }
  };

  const submit = async () => {
    if (!legalAccepted) {
      setError(
        "Agree to the Terms and Privacy Policy before creating an account.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        passwordConfirmation,
        legalAccepted,
      });
    } catch (nextError) {
      setError(getApiErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.safeArea}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard style={styles.formCard}>
          <Text style={styles.formTitle}>Create account</Text>
          <Text style={styles.formSubtitle}>
            Build your first working forecast in a few minutes.
          </Text>

          <Field
            autoCapitalize="words"
            label="Full name"
            onChangeText={setName}
            placeholder="Alex Jordan"
            returnKeyType="next"
            textContentType="name"
            value={name}
          />
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
            <Text style={styles.passwordLabel}>Password</Text>
            <View style={styles.passwordInputWrap}>
              <TextInput
                autoCapitalize="none"
                autoComplete="password-new"
                autoCorrect={false}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={theme.colors.muted}
                returnKeyType="next"
                secureTextEntry={!passwordVisible}
                style={styles.passwordInput}
                textContentType="newPassword"
                value={password}
              />
              <Pressable
                accessibilityHint="Shows or hides your password."
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
                secureTextEntry={!passwordConfirmationVisible}
                style={styles.passwordInput}
                textContentType="password"
                value={passwordConfirmation}
              />
              <Pressable
                accessibilityHint="Shows or hides your password confirmation."
                accessibilityLabel={
                  passwordConfirmationVisible
                    ? "Hide password confirmation"
                    : "Show password confirmation"
                }
                hitSlop={10}
                onPress={() => {
                  setPasswordConfirmationVisible((current) => !current);
                }}
                style={({ pressed }) => [
                  styles.passwordToggle,
                  pressed ? styles.passwordTogglePressed : null,
                ]}
              >
                <Text style={styles.passwordToggleLabel}>
                  {passwordConfirmationVisible ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.legalConsentWrap}>
            <View style={styles.legalConsentRow}>
              <Pressable
                accessibilityHint="Required before creating a new account."
                accessibilityLabel={
                  legalAccepted
                    ? "Agreed to terms and privacy"
                    : "Agree to terms and privacy"
                }
                hitSlop={8}
                onPress={() => {
                  setLegalAccepted((current) => {
                    const next = !current;

                    if (next) {
                      setError(null);
                    }

                    return next;
                  });
                }}
                style={({ pressed }) => [
                  styles.checkbox,
                  legalAccepted ? styles.checkboxSelected : null,
                  pressed ? styles.inlineLinkPressed : null,
                ]}
              >
                {legalAccepted ? (
                  <MaterialCommunityIcons
                    color={theme.colors.white}
                    name="check"
                    size={16}
                  />
                ) : null}
              </Pressable>
              <Text style={styles.legalConsentLabel}>
                I agree to the{" "}
                <Text
                  onPress={() => {
                    void openLegalDocument(TERMS_URL);
                  }}
                  style={styles.legalInlineLink}
                >
                  Terms
                </Text>{" "}
                and{" "}
                <Text
                  onPress={() => {
                    void openLegalDocument(PRIVACY_URL);
                  }}
                  style={styles.legalInlineLink}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            disabled={loading || !legalAccepted}
            icon="account-plus-outline"
            label={loading ? "Creating account..." : "Create account"}
            onPress={() => {
              void submit();
            }}
          />
          <Pressable
            disabled={loading}
            onPress={() => {
              router.push("/login");
            }}
            style={({ pressed }) => [
              styles.inlineLink,
              pressed && !loading ? styles.inlineLinkPressed : null,
            ]}
          >
            <Text style={styles.inlineLinkLabel}>
              Already have an account? Sign in
            </Text>
          </Pressable>
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
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    gap: 18,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  formCard: {
    gap: 16,
  },
  legalConsentWrap: {
    gap: 8,
  },
  legalConsentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxSelected: {
    borderColor: theme.colors.primaryStrong,
    backgroundColor: theme.colors.primaryStrong,
  },
  legalConsentLabel: {
    flex: 1,
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  legalInlineLink: {
    color: theme.colors.primaryStrong,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  formTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
  formSubtitle: {
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
  inlineLink: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  inlineLinkPressed: {
    opacity: 0.8,
  },
  inlineLinkLabel: {
    color: theme.colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
});
