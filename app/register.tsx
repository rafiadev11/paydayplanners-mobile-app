import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
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

import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href="/dashboard" />;

  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        passwordConfirmation,
      });
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
            paddingTop: insets.top + theme.spacing.md,
            paddingBottom: insets.bottom + theme.spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurfaceCard tone="dark" style={styles.heroCard}>
          <Text style={styles.eyebrow}>PaydayPlanners</Text>
          <Text style={styles.title}>Create your cashflow command center.</Text>
          <Text style={styles.subtitle}>
            Start with one paycheck and one bill, then let the planner show what
            stays free before you spend.
          </Text>

          <View style={styles.heroPoints}>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="timeline-text-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>Plan by paycheck</Text>
            </View>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="calendar-clock-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>Bills and goals mapped</Text>
            </View>
          </View>
        </SurfaceCard>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            disabled={loading}
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
  heroCard: {
    gap: 14,
  },
  eyebrow: {
    color: theme.colors.accent,
    ...theme.typography.eyebrow,
  },
  title: {
    color: theme.colors.white,
    ...theme.typography.title,
  },
  subtitle: {
    color: theme.colors.backgroundMuted,
    ...theme.typography.body,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  heroPoints: {
    gap: 8,
  },
  heroPoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroPointText: {
    color: theme.colors.white,
    fontSize: 14,
    fontWeight: "600",
  },
  formCard: {
    gap: 16,
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
