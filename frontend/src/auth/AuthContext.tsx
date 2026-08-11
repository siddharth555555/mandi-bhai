import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getMe, type AuthUser } from '../api/client';

const TOKEN_KEY = 'mandibhai.token';

type AuthState = {
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  updateSession: (token: string, user?: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(TOKEN_KEY);
      if (stored) {
        try {
          const me = await getMe(stored);
          setToken(stored);
          setUser(me);
        } catch {
          // Token expired/invalid — drop it and fall back to the login flow.
          await AsyncStorage.removeItem(TOKEN_KEY);
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const signIn = async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
  };

  // Profile-creation endpoints return a freshly-signed token (with the new
  // profile baked into its claims) but not the full user view — refetch it.
  const updateSession = async (newToken: string, newUser?: AuthUser) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    if (newUser) {
      setUser(newUser);
    } else {
      setUser(await getMe(newToken));
    }
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    setUser(await getMe(token));
  };

  const value = useMemo(
    () => ({ isLoading, token, user, signIn, updateSession, signOut, refreshUser }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
