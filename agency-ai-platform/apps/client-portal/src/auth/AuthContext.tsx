import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createAuthClient, type AuthUserView } from "@agency/auth/browser";
import { webEnv } from "../env";

const auth = createAuthClient({ baseUrl: webEnv.VITE_API_URL });

type AuthContextValue = {
  user: AuthUserView | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  /** DEVELOPMENT PLACEHOLDER — local UI session only; does not call the API. */
  enterDemoSession: () => void;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void auth
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const next = await auth.login({ email, password });
    setUser(next);
  }, []);

  const enterDemoSession = useCallback(() => {
    setError(null);
    const demoUser: AuthUserView = {
      id: "demo_user",
      email: "demo@example.com",
      name: "Demo Customer",
      isStaff: false,
      emailVerified: true,
      memberships: [],
      permissions: [],
      roles: ["customer"],
    };
    setUser(demoUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } catch {
      /* demo sessions have no server cookie */
    }
    setUser(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      login: async (email: string, password: string) => {
        try {
          await login(email, password);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Login failed");
          throw err;
        }
      },
      enterDemoSession,
      logout,
      clearError,
    }),
    [user, loading, error, login, enterDemoSession, logout, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
