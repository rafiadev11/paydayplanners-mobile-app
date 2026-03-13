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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
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
            Add income, bills, and savings goals once, then let the planner show
            how every paycheck gets reduced before you spend it.
          </Text>

          <View style={styles.heroPoints}>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="timeline-text-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>90-day forecast view</Text>
            </View>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="calendar-clock-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>
                Recurring and one-time support
              </Text>
            </View>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="shield-check-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>
                Secure token-based sessions
              </Text>
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.formCard}>
          <View style={styles.modeSwitch}>
            <Pressable
              onPress={() => {
                router.replace("/login");
              }}
              style={styles.modeChip}
            >
              <Text style={styles.modeChipLabel}>I have an account</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                router.replace("/register");
              }}
              style={[styles.modeChip, styles.modeChipActive]}
            >
              <Text style={[styles.modeChipLabel, styles.modeChipLabelActive]}>
                I am new here
              </Text>
            </Pressable>
          </View>

          <Text style={styles.formTitle}>Create account</Text>

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
          <Field
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            label="Password"
            onChangeText={setPassword}
            placeholder="Password"
            returnKeyType="next"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
          <Field
            autoCapitalize="none"
            autoComplete="password-new"
            autoCorrect={false}
            label="Confirm password"
            onChangeText={setPasswordConfirmation}
            onSubmitEditing={() => {
              void submit();
            }}
            placeholder="Confirm password"
            returnKeyType="go"
            secureTextEntry
            textContentType="password"
            value={passwordConfirmation}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            disabled={loading}
            icon="account-plus-outline"
            label={loading ? "Creating account..." : "Create account"}
            onPress={() => {
              void submit();
            }}
          />
          <SecondaryButton
            disabled={loading}
            label="Already have an account? Sign in"
            onPress={() => {
              router.push("/login");
            }}
          />
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
    gap: 16,
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
    gap: 10,
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
  modeSwitch: {
    flexDirection: "row",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 4,
    gap: 4,
  },
  modeChip: {
    flex: 1,
    borderRadius: theme.radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modeChipActive: {
    backgroundColor: theme.colors.ink,
  },
  modeChipLabel: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  modeChipLabelActive: {
    color: theme.colors.white,
  },
  formTitle: {
    color: theme.colors.ink,
    ...theme.typography.cardTitle,
  },
});
