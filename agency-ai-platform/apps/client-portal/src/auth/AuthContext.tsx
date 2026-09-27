import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createAuthClient, type AuthUserView } from "@agency/auth/browser";
import { webEnv } from "../env";

const auth = createAuthClient({ baseUrl: webEnv.VITE_API_URL });

const DEMO_USER: AuthUserView = {
  id: "demo_user",
  email: "demo@example.com",
  name: "Demo Customer",
  isStaff: false,
  emailVerified: true,
  memberships: [],
  permissions: [],
  roles: ["customer"],
};

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
  const demoSessionRef = useRef(false);

  useEffect(() => {
    let active = true;
    void auth
      .me()
      .then((next) => {
        if (active && !demoSessionRef.current) setUser(next);
      })
      .catch(() => {
        if (active && !demoSessionRef.current) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    demoSessionRef.current = false;
    const next = await auth.login({ email, password });
    setUser(next);
  }, []);

  const enterDemoSession = useCallback(() => {
    demoSessionRef.current = true;
    setError(null);
    setLoading(false);
    setUser(DEMO_USER);
  }, []);

  const logout = useCallback(async () => {
    const wasDemo = demoSessionRef.current;
    demoSessionRef.current = false;
    if (!wasDemo) {
      try {
        await auth.logout();
      } catch {
        /* ignore network errors on logout */
      }
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
