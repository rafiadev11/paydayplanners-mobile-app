import { AppState, type AppStateStatus } from "react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@features/auth/auth-context";
import {
  getBiometricCapability,
  promptForBiometric,
  type BiometricCapability,
} from "@features/security/biometrics";
import { biometricPrefsStorage } from "@shared/storage/secure";

const BACKGROUND_LOCK_DELAY_MS = 15_000;

type BiometricPrefs = Record<string, boolean>;

type BiometricLockContextValue = {
  ready: boolean;
  enabled: boolean;
  locked: boolean;
  unlocking: boolean;
  capability: BiometricCapability;
  blockReason: string | null;
  enableBiometricLock: () => Promise<{ success: boolean; message?: string }>;
  disableBiometricLock: () => Promise<void>;
  unlockApp: () => Promise<boolean>;
  fallbackToPasswordSignIn: () => Promise<void>;
  refreshCapability: () => Promise<BiometricCapability>;
};

const DEFAULT_CAPABILITY: BiometricCapability = {
  supported: false,
  enrolled: false,
  label: "Biometrics",
  reason: "Checking device security options.",
};

const BiometricLockContext = createContext<BiometricLockContextValue | null>(
  null,
);

async function readPrefs(): Promise<BiometricPrefs> {
  try {
    const raw = await biometricPrefsStorage.get();

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
      ),
    );
  } catch {
    return {};
  }
}

async function writePrefs(nextPrefs: BiometricPrefs) {
  const hasEntries = Object.keys(nextPrefs).length > 0;

  if (!hasEntries) {
    await biometricPrefsStorage.clear();
    return;
  }

  await biometricPrefsStorage.set(JSON.stringify(nextPrefs));
}

function userPreferenceKey(userId: number | string | undefined) {
  return userId == null ? null : String(userId);
}

function biometricErrorMessage(
  label: string,
  error: string | undefined,
): string {
  switch (error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return `Unlock with ${label} to continue.`;
    case "authentication_failed":
      return `${label} did not match. Try again.`;
    case "lockout":
      return `${label} is temporarily locked. Wait a moment and try again.`;
    case "not_enrolled":
    case "passcode_not_set":
    case "not_available":
      return `${label} is no longer available on this device.`;
    default:
      return `We couldn't verify ${label} right now. Try again.`;
  }
}

export function BiometricLockProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user, clearSession } = useAuth();
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [capability, setCapability] =
    useState<BiometricCapability>(DEFAULT_CAPABILITY);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAtRef = useRef<number | null>(null);
  const userKeyRef = useRef<string | null>(null);
  const unlockingRef = useRef(false);
  const hasInitializedRef = useRef(false);

  const refreshCapability = useCallback(async () => {
    const nextCapability = await getBiometricCapability();
    setCapability(nextCapability);

    return nextCapability;
  }, []);

  const setPreferenceForCurrentUser = useCallback(
    async (nextEnabled: boolean) => {
      const currentKey = userPreferenceKey(user?.id);

      if (!currentKey) {
        return;
      }

      const prefs = await readPrefs();
      if (nextEnabled) {
        prefs[currentKey] = true;
      } else {
        delete prefs[currentKey];
      }

      await writePrefs(prefs);
    },
    [user?.id],
  );

  const unlockApp = useCallback(async () => {
    if (unlockingRef.current) {
      return false;
    }

    const currentCapability = await getBiometricCapability();
    setCapability(currentCapability);

    if (!currentCapability.supported || !currentCapability.enrolled) {
      setLocked(true);
      setBlockReason(
        currentCapability.reason ??
          `${currentCapability.label} is unavailable on this device.`,
      );
      return false;
    }

    unlockingRef.current = true;
    setUnlocking(true);

    try {
      const result = await promptForBiometric(
        currentCapability.label,
        "Unlock PaydayPlanner to view your paycheck, bills, and planning details.",
      );

      if (result.success) {
        setLocked(false);
        setBlockReason(null);
        return true;
      }

      setLocked(true);
      setBlockReason(
        biometricErrorMessage(currentCapability.label, result.error),
      );
      return false;
    } finally {
      unlockingRef.current = false;
      setUnlocking(false);
    }
  }, []);

  const disableBiometricLock = useCallback(async () => {
    await setPreferenceForCurrentUser(false);
    setEnabled(false);
    setLocked(false);
    setBlockReason(null);
  }, [setPreferenceForCurrentUser]);

  const enableBiometricLock = useCallback(async () => {
    const nextCapability = await refreshCapability();

    if (!nextCapability.supported || !nextCapability.enrolled) {
      return {
        success: false,
        message:
          nextCapability.reason ??
          `Set up ${nextCapability.label} to enable biometric protection.`,
      };
    }

    const result = await promptForBiometric(
      nextCapability.label,
      "Confirm biometric protection for PaydayPlanner on this device.",
    );

    if (!result.success) {
      return {
        success: false,
        message: biometricErrorMessage(nextCapability.label, result.error),
      };
    }

    await setPreferenceForCurrentUser(true);
    setEnabled(true);
    setLocked(false);
    setBlockReason(null);

    return {
      success: true,
      message: `${nextCapability.label} protection is now on for this device.`,
    };
  }, [refreshCapability, setPreferenceForCurrentUser]);

  const fallbackToPasswordSignIn = useCallback(async () => {
    await disableBiometricLock();
    await clearSession();
  }, [clearSession, disableBiometricLock]);

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      if (!authReady) {
        return;
      }

      const currentUserKey = userPreferenceKey(user?.id);
      const isFirstInitialization = !hasInitializedRef.current;
      userKeyRef.current = currentUserKey;

      if (!currentUserKey) {
        if (!active) return;
        await refreshCapability();
        setEnabled(false);
        setLocked(false);
        setBlockReason(null);
        hasInitializedRef.current = true;
        setReady(true);
        return;
      }

      setReady(false);

      const [nextCapability, prefs] = await Promise.all([
        getBiometricCapability(),
        readPrefs(),
      ]);

      if (!active) return;

      setCapability(nextCapability);
      const nextEnabled = prefs[currentUserKey] === true;
      setEnabled(nextEnabled);

      if (!nextEnabled) {
        setLocked(false);
        setBlockReason(null);
        hasInitializedRef.current = true;
        setReady(true);
        return;
      }

      if (!isFirstInitialization) {
        setLocked(false);
        setBlockReason(null);
        hasInitializedRef.current = true;
        setReady(true);
        return;
      }

      setLocked(true);
      setBlockReason(null);
      const unlocked = await unlockApp();

      if (!active) return;

      if (
        !unlocked &&
        (!nextCapability.supported || !nextCapability.enrolled)
      ) {
        setBlockReason(
          nextCapability.reason ??
            `${nextCapability.label} is no longer available on this device.`,
        );
      }

      hasInitializedRef.current = true;
      setReady(true);
    };

    void initialize();

    return () => {
      active = false;
    };
  }, [authReady, refreshCapability, unlockApp, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "background" || nextState === "inactive") {
        backgroundedAtRef.current = Date.now();
        return;
      }

      if (
        nextState === "active" &&
        previousState !== "active" &&
        enabled &&
        userKeyRef.current
      ) {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (
          backgroundedAt === null ||
          Date.now() - backgroundedAt < BACKGROUND_LOCK_DELAY_MS
        ) {
          return;
        }

        setLocked(true);
        setBlockReason(null);

        void (async () => {
          const nextCapability = await refreshCapability();

          if (!nextCapability.supported || !nextCapability.enrolled) {
            setLocked(true);
            setBlockReason(
              nextCapability.reason ??
                `${nextCapability.label} is no longer available on this device.`,
            );
            return;
          }

          void unlockApp();
        })();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, refreshCapability, unlockApp]);

  return (
    <BiometricLockContext.Provider
      value={{
        ready,
        enabled,
        locked,
        unlocking,
        capability,
        blockReason,
        enableBiometricLock,
        disableBiometricLock,
        unlockApp,
        fallbackToPasswordSignIn,
        refreshCapability,
      }}
    >
      {children}
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLock() {
  const context = useContext(BiometricLockContext);

  if (!context) {
    throw new Error(
      "useBiometricLock must be used within BiometricLockProvider",
    );
  }

  return context;
}
