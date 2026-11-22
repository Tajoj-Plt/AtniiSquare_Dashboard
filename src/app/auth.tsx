import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, onUnauthorized, tokens } from '@/lib/api';
import { applyLanguage } from '@/lib/i18n';

export interface Identity {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  status: string;
  locale: string;
  theme: string;
  roles: string[];
  permissions: string[];
  last_login_at: string | null;
}

interface AuthContextValue {
  user: Identity | null;
  loading: boolean;
  signIn: (email: string, password: string, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
  canAny: (...permissions: string[]) => boolean;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tokens.access) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const identity = await api.get<Identity>('/auth/me');
      setUser(identity);
      // The account's stored language wins on first load of a fresh device.
      if (identity.locale && !localStorage.getItem('sudamind.lang')) applyLanguage(identity.locale);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // The API client tells us when a refresh finally failed; drop the session.
  useEffect(() => {
    const off = onUnauthorized(() => setUser(null));
    return () => { off(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string, remember = true) => {
    const res = await api.post('/auth/login', { email, password }, { anonymous: true });
    tokens.set(res.accessToken, res.refreshToken, remember);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.post('/auth/logout', { refreshToken: tokens.refresh });
    } catch {
      /* signing out locally matters more than the server round trip */
    }
    tokens.clear();
    setUser(null);
  }, []);

  const can = useCallback(
    (...permissions: string[]) => permissions.every((p) => user?.permissions.includes(p) ?? false),
    [user],
  );
  const canAny = useCallback(
    (...permissions: string[]) =>
      permissions.length === 0 || permissions.some((p) => user?.permissions.includes(p) ?? false),
    [user],
  );
  const hasRole = useCallback(
    (...roles: string[]) => roles.some((r) => user?.roles.includes(r) ?? false),
    [user],
  );

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, refreshIdentity: load, can, canAny, hasRole }),
    [user, loading, signIn, signOut, load, can, canAny, hasRole],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Route guard: requires a session, and optionally one of a set of permissions. */
export function RequireAuth({
  children, permissions = [],
}: { children: React.ReactNode; permissions?: string[] }) {
  const { user, loading, canAny } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (permissions.length && !canAny(...permissions)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}

/** Conditional rendering by permission — hides actions the caller cannot perform. */
export function Can({
  permission, children, fallback = null,
}: { permission: string | string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canAny } = useAuth();
  const list = Array.isArray(permission) ? permission : [permission];
  return <>{canAny(...list) ? children : fallback}</>;
}
