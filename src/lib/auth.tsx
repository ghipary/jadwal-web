// Auth context multi-tenant (Supabase)

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, User } from '@supabase/supabase-js';
import { hasSupabase, supabase } from './supabase';

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabase() || !supabase) {
      // Tanpa backend, anggap belum login (route protection akan mengarahkan ke landing)
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    })();
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setUser(s?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!hasSupabase() || !supabase) {
      return { error: new Error('Supabase belum dikonfigurasi (VITE_SUPABASE_URL/ANON_KEY kosong).') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!hasSupabase() || !supabase) {
      return { error: new Error('Supabase belum dikonfigurasi (VITE_SUPABASE_URL/ANON_KEY kosong).') };
    }
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    if (!hasSupabase() || !supabase) return;
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signIn, signUp, signOut }),
    [user, session, loading, signIn, signUp, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth harus dipakai dalam AuthProvider');
  return ctx;
}
