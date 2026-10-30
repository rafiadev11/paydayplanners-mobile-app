import { Redirect, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
} from "react-native";
import { watchPairing } from "@features/watch/native";
import { useAuth } from "@features/auth/auth-context";
import { useBiometricLock } from "@features/security/biometric-lock-context";
import { api } from "@shared/api/client";
import { getApiErrorMessage } from "@shared/lib/api-error";
import { PrimaryButton, SurfaceCard } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";

export default function WatchConnectionScreen() {
  const { ready, user } = useAuth();
  const lock = useBiometricLock();
  const lockedRef = useRef(false);
  lockedRef.current = lock.enabled && lock.locked;
  const [manual, setManual] = useState(false);
  useEffect(() => {
    void watchPairing?.probe().catch(() => undefined);
  }, []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!ready) return null;
  if (!user) return <Redirect href="/login" />;
  if (!user.features?.watch_companion) return <Redirect href="/account" />;
  const approve = async () => {
    if (busy || lockedRef.current || AppState.currentState !== "active") return;
    setBusy(true);
    setMessage(null);
    try {
      await api.post("/api/v1/watch/link/approve", { code });
      setCode("");
      setMessage(
        "Watch connected. Your summary will appear on your watch shortly.",
      );
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "Connect your watch" }} />
      <SurfaceCard>
        <Text style={styles.title}>Your payday, on your wrist</Text>
        <Text style={styles.copy}>
          Open Payday Planner on your watch and choose Connect with phone.
          {watchPairing && user.features?.watch_automatic_pairing
            ? " Your watch will appear here automatically for you to confirm."
            : " Enter the eight-digit code shown there."}
        </Text>
        {!manual && watchPairing && user.features?.watch_automatic_pairing ? (
          <Pressable accessibilityRole="button" onPress={() => setManual(true)}>
            <Text style={styles.copy}>Use a code instead</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              accessibilityLabel="Watch connection code"
              value={code}
              onChangeText={(text) =>
                setCode(text.replace(/\D/g, "").slice(0, 8))
              }
              keyboardType="number-pad"
              maxLength={8}
              placeholder="12345678"
              autoComplete="off"
              style={styles.input}
              editable={!busy}
            />
            <PrimaryButton
              label={busy ? "Connecting…" : "Connect watch"}
              disabled={
                busy || code.length !== 8 || (lock.enabled && lock.locked)
              }
              onPress={() =>
                Alert.alert(
                  "Connect this watch?",
                  "This watch will be able to view your payday and bill information without unlocking your phone. Only approve a code displayed on your own watch.",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Connect", onPress: () => void approve() },
                  ],
                )
              }
            />
          </>
        )}
        {message ? (
          <Text accessibilityLiveRegion="polite" style={styles.copy}>
            {message}
          </Text>
        ) : null}
      </SurfaceCard>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  title: {
    color: theme.colors.ink,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  copy: {
    color: theme.colors.ink,
    fontSize: 15,
    marginVertical: 12,
    lineHeight: 22,
  },
  input: {
    color: theme.colors.ink,
    fontSize: 28,
    letterSpacing: 4,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 12,
    marginVertical: 12,
  },
});
