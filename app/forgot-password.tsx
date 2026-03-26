import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { forgotPassword } from "@features/auth/api";
import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import {
  Field,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (user) return <Redirect href="/dashboard" />;

  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim());
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
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Recovery</Text>
          <Text style={styles.title}>Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter the email tied to your account and we will send a secure reset
            link.
          </Text>
        </View>

        <SurfaceCard style={styles.formCard}>
          {sentTo ? (
            <>
              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardBody}>
                We sent a reset link to {sentTo}. Open it on any device to
                choose a new password.
              </Text>
              <PrimaryButton
                label="Back to sign in"
                onPress={() => {
                  router.replace("/login");
                }}
              />
              <SecondaryButton
                disabled={loading}
                label={loading ? "Sending..." : "Send another link"}
                onPress={() => {
                  void submit();
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Send reset link</Text>
              <Field
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                label="Email"
                onChangeText={setEmail}
                onSubmitEditing={() => {
                  void submit();
                }}
                placeholder="you@example.com"
                returnKeyType="send"
                textContentType="emailAddress"
                value={email}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={loading}
                label={loading ? "Sending..." : "Email reset link"}
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
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
});
