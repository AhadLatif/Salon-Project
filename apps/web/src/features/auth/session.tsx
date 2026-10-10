'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type AuthUser,
  loginRequest,
  logoutRequest,
  meRequest,
  type RegisterPayload,
  refreshRequest,
  registerRequest,
} from './api';

/**
 * Session provider — the hybrid auth contract from
 * `docs/30-frontend/10-design/05-security-and-auth.md`:
 *
 * - The ACCESS token lives ONLY in this provider's ref (memory). It is never
 *   written to localStorage/sessionStorage, so an XSS payload cannot persist it.
 * - The REFRESH token lives ONLY in the HttpOnly cookie owned by the backend;
 *   JavaScript never sees it. On page load we ask `/auth/refresh` to mint a new
 *   access token from that cookie (silent refresh), then load `GET /auth/me`.
 * - Reloads therefore do not log the user out, while a stolen DOM payload still
 *   has nothing durable to exfiltrate.
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  status: SessionStatus;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  // Memory-only access token; useRef keeps it out of render state entirely.
  const accessTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Silent refresh on first mount (per-provider instance, safe under SSR).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await refreshRequest();
        if (cancelled) return;
        accessTokenRef.current = token;
        const { user: me } = await meRequest();
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        accessTokenRef.current = null;
        setUser(null);
        setStatus('unauthenticated');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await loginRequest(email, password);
    accessTokenRef.current = result.accessToken;
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthUser> => {
    const result = await registerRequest(payload);
    accessTokenRef.current = result.accessToken;
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest();
    } finally {
      // Clear locally even if the network call failed — never leave a session
      // the user asked to end looking active in the UI.
      accessTokenRef.current = null;
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }
  return context;
}
