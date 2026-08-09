'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthError, LocalAuthAdapter, type AuthAdapter, type SignUpInput } from './adapter';
import type { StoredUser } from '../types';

/**
 * The one line to change when you move to a real backend:
 * swap LocalAuthAdapter for e.g. new SupabaseAuthAdapter().
 */
const adapter: AuthAdapter = new LocalAuthAdapter();

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: StoredUser | null;
  users: StoredUser[];
  signUp(input: SignUpInput): Promise<StoredUser>;
  logIn(email: string, password: string): Promise<StoredUser>;
  logOut(): Promise<void>;
  submitCode(code: string): Promise<StoredUser>;
  resendCode(): Promise<string>;
  updateUser(patch: Partial<StoredUser>): Promise<StoredUser>;
  changePassword(current: string, next: string): Promise<void>;
  deleteAccount(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);

  const refresh = useCallback(async () => {
    const [me, all] = await Promise.all([adapter.currentUser(), adapter.listUsers()]);
    setUser(me);
    setUsers(all);
    setStatus(me ? 'authenticated' : 'anonymous');
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    users,
    async signUp(input) { const u = await adapter.signUp(input); await refresh(); return u; },
    async logIn(email, password) { const u = await adapter.logIn(email, password); await refresh(); return u; },
    async logOut() { await adapter.logOut(); await refresh(); },
    async submitCode(code) { const u = await adapter.submitCode(code); await refresh(); return u; },
    async resendCode() { const c = await adapter.resendCode(); await refresh(); return c; },
    async updateUser(patch) { const u = await adapter.updateUser(patch); await refresh(); return u; },
    async changePassword(c, n) { await adapter.changePassword(c, n); await refresh(); },
    async deleteAccount() { await adapter.deleteAccount(); await refresh(); },
    refresh,
  }), [status, user, users, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { AuthError };
