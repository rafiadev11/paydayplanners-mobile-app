import { useEffect, useRef, useState } from "react";
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@features/auth/auth-context";
import { useBiometricLock } from "@features/security/biometric-lock-context";
import { api } from "@shared/api/client";
import { API_BASE_URL } from "@shared/lib/env";
import {
  canApproveWatchRequest,
  parseWatchRequests,
  type WatchPairingRequest,
} from "@shared/lib/watch-pairing";
import { PrimaryButton } from "@shared/ui/primitives";
import { theme } from "@shared/ui/theme";
import { watchPairing } from "./native";

export function WatchPairingCoordinator() {
  const { ready, user } = useAuth();
  const lock = useBiometricLock();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [requests, setRequests] = useState<WatchPairingRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const identity = useRef(user?.id);
  const generation = useRef(0);
  const pendingReset = useRef<Promise<boolean>>(Promise.resolve(true));
  const request = requests[0];
  const state = {
    active,
    authReady: ready,
    lockReady: lock.ready,
    locked: lock.enabled && lock.locked,
    enabled:
      !!user?.features?.watch_companion &&
      !!user?.features?.watch_automatic_pairing,
    userId: user?.id,
  };
  const latest = useRef(state);
  latest.current = state;
  const visible =
    identity.current === user?.id && canApproveWatchRequest(request, state);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (value) =>
      setActive(value === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !watchPairing) return;
    if (identity.current !== undefined && identity.current !== user?.id) {
      generation.current += 1;
      setRequests([]);
      setError(null);
      pendingReset.current = watchPairing.dismiss("*").then(
        () => true,
        () => false,
      );
    }
    identity.current = user?.id;
  }, [ready, user?.id]);

  useEffect(() => {
    if (!watchPairing || !active || !ready) return;
    let mounted = true;
    const refresh = async () => {
      const current = generation.current;
      try {
        if (!(await pendingReset.current)) return;
        const raw = await watchPairing!.getPending();
        if (mounted && current === generation.current)
          setRequests(parseWatchRequests(raw, API_BASE_URL));
      } catch {
        /* The manual-code flow remains available if native delivery is unavailable. */
      }
    };
    void refresh();
    void watchPairing.probe().catch(() => undefined);
    const subscription = watchPairing.addListener(
      "requestsChanged",
      () => void refresh(),
    );
    const expiryTimer = setInterval(() => void refresh(), 10_000);
    return () => {
      mounted = false;
      subscription.remove();
      clearInterval(expiryTimer);
    };
  }, [active, ready, user?.id]);

  const dismiss = async () => {
    if (!request || busyRef.current) return;
    try {
      await watchPairing?.dismiss(request.request_id);
    } catch {
      setError("Couldn’t dismiss this request. Please try again.");
      return;
    }
    setRequests((current) =>
      current.filter((item) => item.request_id !== request.request_id),
    );
    setError(null);
  };

  const approve = async () => {
    if (
      busyRef.current ||
      AppState.currentState !== "active" ||
      latest.current.userId !== identity.current ||
      !canApproveWatchRequest(request, latest.current)
    )
      return;
    const account = user?.id;
    const currentGeneration = generation.current;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/watch/link/automatic/approve", {
        request_id: request.request_id,
        approval_handle: request.approval_handle,
      });
      await watchPairing?.dismiss(request.request_id);
      if (
        latest.current.userId === account &&
        generation.current === currentGeneration
      )
        setRequests((current) =>
          current.filter((item) => item.request_id !== request.request_id),
        );
    } catch {
      if (
        latest.current.userId === account &&
        generation.current === currentGeneration
      )
        setError(
          "Couldn’t connect. Try again, or restart setup on your watch if this request expired.",
        );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => void dismiss()}
    >
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.icon}>
              <MaterialCommunityIcons
                name="watch-variant"
                size={36}
                color={theme.colors.primaryStrong}
              />
            </View>
            <Text style={styles.title}>
              Connect your{" "}
              {request?.platform === "watchos"
                ? "Apple Watch"
                : "Wear OS watch"}
              ?
            </Text>
            <Text style={styles.copy}>
              Your payday and bills, ready on your wrist.
            </Text>
            <View style={styles.account}>
              <Text style={styles.accountLabel}>CONNECT TO</Text>
              <Text style={styles.name}>{user?.name}</Text>
              <Text style={styles.copy}>{user?.email}</Text>
            </View>
            <Text style={styles.copy}>
              This watch can show your payday and bill information without
              unlocking your phone.
            </Text>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <PrimaryButton
              label={busy ? "Connecting…" : "Connect watch"}
              disabled={busy}
              onPress={() => void approve()}
            />
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void dismiss()}
              style={styles.cancel}
            >
              <Text style={styles.cancelLabel}>Not now</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(10,24,20,0.6)",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 28,
    maxHeight: "90%",
    overflow: "hidden",
  },
  content: {
    padding: 24,
    gap: 14,
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#DDF7E5",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: theme.colors.ink,
    letterSpacing: -0.6,
  },
  copy: { fontSize: 15, lineHeight: 21, color: theme.colors.muted },
  account: {
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceMuted,
    padding: 16,
    gap: 4,
  },
  accountLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: theme.colors.primaryStrong,
  },
  name: { fontSize: 18, fontWeight: "700", color: theme.colors.ink },
  cancel: { padding: 12, alignItems: "center" },
  cancelLabel: { color: theme.colors.ink, fontWeight: "600" },
  error: { color: "#A33622", fontSize: 14, lineHeight: 20 },
});
