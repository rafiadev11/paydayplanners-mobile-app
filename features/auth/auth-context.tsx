import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  login,
  logout,
  me,
  register,
  type RegisterInput,
  type User,
} from "@features/auth/api";
import { setAuthToken } from "@shared/api/client";
import { setAppTimezone } from "@shared/lib/timezone";
import { tokenStorage, userStorage } from "@shared/storage/secure";

type AuthContextValue = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: RegisterInput) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  syncUser: (user: User | null) => Promise<void>;
  clearSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function persistUser(user: User | null) {
  if (!user) {
    await userStorage.clear();
    return;
  }

  await userStorage.set(JSON.stringify(user));
}

function normalizeCachedUser(payload: unknown): User | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (record.user && typeof record.user === "object") {
    return normalizeCachedUser(record.user);
  }

  if (!("id" in record) || !("email" in record)) return null;

  return record as unknown as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const syncUser = async (nextUser: User | null) => {
    setUser(nextUser);
    setAppTimezone(nextUser?.timezone ?? null);
    await persistUser(nextUser);
  };

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const cachedUser = await userStorage.get();
        if (cachedUser && active) {
          const normalizedUser = normalizeCachedUser(JSON.parse(cachedUser));
          setUser(normalizedUser);
          setAppTimezone(normalizedUser?.timezone);
        }

        const existingToken = await tokenStorage.get();
        if (!existingToken) {
          if (active) setUser(null);
          await persistUser(null);
          return;
        }

        await setAuthToken(existingToken);
        const nextUser = await me();
        if (!active) return;
        setUser(nextUser);
        setAppTimezone(nextUser?.timezone);
        await persistUser(nextUser);
      } catch {
        if (!active) return;
        setUser(null);
        setAppTimezone(null);
        await setAuthToken(null);
        await persistUser(null);
      } finally {
        if (active) setReady(true);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const nextUser = await login(email, password);
    await syncUser(nextUser);
    return nextUser;
  };

  const signUp = async (input: RegisterInput) => {
    const nextUser = await register(input);
    await syncUser(nextUser);
    return nextUser;
  };

  const signOut = async () => {
    await logout();
    await syncUser(null);
  };

  const clearSession = async () => {
    await setAuthToken(null);
    await syncUser(null);
  };

  const refreshUser = async () => {
    try {
      const nextUser = await me();
      await syncUser(nextUser);
      return nextUser;
    } catch {
      await logout();
      await syncUser(null);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ready,
        user,
        signIn,
        signUp,
        signOut,
        refreshUser,
        syncUser,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
