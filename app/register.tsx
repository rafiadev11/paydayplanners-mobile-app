import { Link, Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "@features/auth/auth-context";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { theme } from "@shared/ui/theme";

export default function RegisterScreen() {
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>PaydayPlanners</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>
              This uses the same `POST /api/v1/register` token flow that the
              Laravel backend already exposes.
            </Text>

            <TextInput
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              value={name}
            />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.colors.muted}
              style={styles.input}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
              value={password}
            />
            <TextInput
              autoCapitalize="none"
              onChangeText={setPasswordConfirmation}
              placeholder="Confirm password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
              value={passwordConfirmation}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={loading}
              onPress={() => {
                void submit();
              }}
              style={({ pressed }) => [
                styles.button,
                pressed && !loading ? styles.buttonPressed : null,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Register</Text>
              )}
            </Pressable>

            <Text style={styles.footer}>
              Already have an account?{" "}
              <Link href="/login" style={styles.link}>
                Sign in
              </Link>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 24,
  },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: theme.colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    marginTop: 8,
    paddingVertical: 14,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
  footer: {
    color: theme.colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  link: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});
