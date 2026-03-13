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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Redirect href="/dashboard" />;

  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
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
          styles.container,
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
          <Text style={styles.title}>Plan every paycheck before it lands.</Text>
          <Text style={styles.subtitle}>
            See the true remaining balance on each paycheck after bills, savings
            goals, and one-time expenses are assigned.
          </Text>

          <View style={styles.heroPoints}>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="cash-fast"
                size={18}
              />
              <Text style={styles.heroPointText}>Paycheck-first forecast</Text>
            </View>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="receipt-text-check-outline"
                size={18}
              />
              <Text style={styles.heroPointText}>
                Bills mapped automatically
              </Text>
            </View>
            <View style={styles.heroPoint}>
              <MaterialCommunityIcons
                color={theme.colors.accent}
                name="bullseye-arrow"
                size={18}
              />
              <Text style={styles.heroPointText}>
                Savings treated as real commitments
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
              style={[styles.modeChip, styles.modeChipActive]}
            >
              <Text style={[styles.modeChipLabel, styles.modeChipLabelActive]}>
                I have an account
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                router.replace("/register");
              }}
              style={styles.modeChip}
            >
              <Text style={styles.modeChipLabel}>I am new here</Text>
            </Pressable>
          </View>

          <Text style={styles.formTitle}>Sign in</Text>

          <Field
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            placeholder="you@example.com"
            returnKeyType="next"
            value={email}
          />
          <Field
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            label="Password"
            onChangeText={setPassword}
            onSubmitEditing={() => {
              void submit();
            }}
            placeholder="Password"
            returnKeyType="go"
            secureTextEntry
            textContentType="password"
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <PrimaryButton
            disabled={loading}
            icon="login"
            label={loading ? "Signing in..." : "Sign in"}
            onPress={() => {
              void submit();
            }}
          />
          <SecondaryButton
            disabled={loading}
            label="New here? Create account"
            onPress={() => {
              router.push("/register");
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
