import { loginResponseSchema, sessionUserSchema, type LoginRequest, type SessionUser } from '@trim/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, apiGet, apiSend } from '../api/client';
import { SITE_KEY, TOKEN_KEY } from './storage';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: Error | null;
  login: (input: LoginRequest) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => apiGet('/auth/me', sessionUserSchema),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
  }, [me.error]);

  const value = useMemo<AuthContextValue>(() => {
    return {
      user: token ? (me.data ?? null) : null,
      loading: Boolean(token) && me.isPending,
      error: token ? (me.error ?? null) : null,
      login: async (input: LoginRequest) => {
        const result = await apiSend('/auth/login', loginResponseSchema, input);
        sessionStorage.setItem(TOKEN_KEY, result.accessToken);
        setToken(result.accessToken);
        queryClient.setQueryData(['me', result.accessToken], result.user);
        return result.user;
      },
      logout: () => {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(SITE_KEY);
        setToken(null);
        queryClient.clear();
      },
    };
  }, [me.data, me.error, me.isPending, queryClient, token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
