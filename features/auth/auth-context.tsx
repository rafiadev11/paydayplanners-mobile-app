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
import { tokenStorage, userStorage } from "@shared/storage/secure";

type AuthContextValue = {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (input: RegisterInput) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
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

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const cachedUser = await userStorage.get();
        if (cachedUser && active) {
          setUser(normalizeCachedUser(JSON.parse(cachedUser)));
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
        await persistUser(nextUser);
      } catch {
        if (!active) return;
        setUser(null);
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
    setUser(nextUser);
    await persistUser(nextUser);
    return nextUser;
  };

  const signUp = async (input: RegisterInput) => {
    const nextUser = await register(input);
    setUser(nextUser);
    await persistUser(nextUser);
    return nextUser;
  };

  const signOut = async () => {
    await logout();
    setUser(null);
    await persistUser(null);
  };

  const refreshUser = async () => {
    try {
      const nextUser = await me();
      setUser(nextUser);
      await persistUser(nextUser);
      return nextUser;
    } catch {
      await logout();
      setUser(null);
      await persistUser(null);
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
