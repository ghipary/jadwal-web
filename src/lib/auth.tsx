// Konteks autentikasi multi-tenant (Supabase Auth) + Mode Lokal sebagai
// cadangan bila kunci Supabase belum diisi.
//
// Semua akun setara — tidak ada peran admin: setiap pengguna hanya berinteraksi
// dengan datanya sendiri (isolasi dijalankan oleh store + RLS, lihat supabase/schema.sql).

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { hasSupabase, supabase } from './supabase';

/** Akun yang sedang masuk. `mode` membedakan sesi Supabase vs Mode Lokal. */
export interface Pengguna {
  id: string;
  email: string;
  nama: string;
  mode: 'cloud' | 'lokal';
}

export interface HasilAuth {
  error: Error | null;
  /** true bila pendaftaran menunggu konfirmasi email. */
  konfirmasiEmail?: boolean;
}

interface AuthCtx {
  user: Pengguna | null;
  /** true selama sesi dipulihkan — dipakai penjaga rute agar tak salah alih. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<HasilAuth>;
  signUp: (nama: string, email: string, password: string) => Promise<HasilAuth>;
  signOut: () => Promise<void>;
  /** Masuk tanpa backend — hanya tersedia bila Supabase belum dikonfigurasi. */
  masukTamu: () => void;
  supabaseSiap: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const KUNCI_TAMU = 'jadwalweb:akun:tamu';

function tamuLokal(): Pengguna {
  return {
    id: 'lokal',
    email: 'tamu@perangkat-lokal',
    nama: 'Mode Lokal',
    mode: 'lokal',
  };
}

function bacaTamu(): Pengguna | null {
  try {
    const raw = localStorage.getItem(KUNCI_TAMU);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pengguna>;
    return p.id ? { ...tamuLokal(), ...p, mode: 'lokal' } : null;
  } catch {
    return null;
  }
}

function tulisTamu(p: Pengguna | null) {
  try {
    if (p) localStorage.setItem(KUNCI_TAMU, JSON.stringify(p));
    else localStorage.removeItem(KUNCI_TAMU);
  } catch {
    // kuota penuh — abaikan
  }
}

/** Terjemah pesan galat Supabase ke Bahasa Indonesia. */
function pesanSupabase(pesan: string): Error {
  const p = pesan.toLowerCase();
  if (p.includes('invalid login credentials'))
    return new Error('Email atau kata sandi salah.');
  if (p.includes('already registered') || p.includes('already been registered'))
    return new Error('Email sudah terdaftar. Silakan gunakan halaman Masuk.');
  if (p.includes('password should be at least'))
    return new Error('Kata sandi minimal 6 karakter.');
  if (p.includes('email not confirmed'))
    return new Error('Email belum dikonfirmasi — periksa kotak masuk email Anda.');
  if (p.includes('unable to validate email') || p.includes('invalid email'))
    return new Error('Format email tidak valid.');
  if (p.includes('fetch') || p.includes('network') || p.includes('failed'))
    return new Error('Gagal terhubung ke server — periksa koneksi internet Anda.');
  return new Error(pesan);
}

const PESAN_OFFLINE = new Error(
  'Supabase belum dikonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada ' +
    'berkas .env.local — atau gunakan Mode Lokal untuk sementara.',
);

export function AuthProvider({
  children,
  penggunaAwal,
}: {
  children: ReactNode;
  /**
   * Sesi awal paksa — khusus pengujian/pratinjau render.
   * Bila diisi, pemulihan sesi Supabase dilewati.
   * @internal
   */
  penggunaAwal?: Pengguna | null;
}) {
  const modeUji = penggunaAwal !== undefined;
  const supabaseSiap = hasSupabase();

  const [user, setUser] = useState<Pengguna | null>(() => {
    if (modeUji) return penggunaAwal;
    return supabaseSiap ? null : bacaTamu();
  });
  // Tanpa backend tidak ada sesi yang dipulihkan → langsung siap.
  const [loading, setLoading] = useState(() => supabaseSiap && !modeUji);

  useEffect(() => {
    if (modeUji || !supabaseSiap || !supabase) {
      setLoading(false);
      return;
    }
    let aktif = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!aktif) return;
        setUser(dariSesi(data.session?.user ?? null));
        setLoading(false);
      })
      .catch(() => aktif && setLoading(false));

    const { data: langganan } = supabase.auth.onAuthStateChange((_event, sesi) => {
      setUser(dariSesi(sesi?.user ?? null));
      setLoading(false);
    });

    return () => {
      aktif = false;
      langganan.subscription.unsubscribe();
    };
  }, [modeUji, supabaseSiap]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<HasilAuth> => {
      if (!hasSupabase() || !supabase) return { error: PESAN_OFFLINE };
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { error: pesanSupabase(error.message) };
        setUser(dariSesi(data.user));
        return { error: null };
      } catch (e) {
        return { error: pesanSupabase(e instanceof Error ? e.message : 'Terjadi galat.') };
      }
    },
    [],
  );

  const signUp = useCallback(
    async (nama: string, email: string, password: string): Promise<HasilAuth> => {
      if (!hasSupabase() || !supabase) return { error: PESAN_OFFLINE };
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nama: nama.trim() } },
        });
        if (error) return { error: pesanSupabase(error.message) };
        if (!data.session) return { error: null, konfirmasiEmail: true };
        setUser(dariSesi(data.user));
        return { error: null };
      } catch (e) {
        return { error: pesanSupabase(e instanceof Error ? e.message : 'Terjadi galat.') };
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    tulisTamu(null);
    if (hasSupabase() && supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // sesi lokal tetap dibersihkan meski panggilan server gagal
      }
    }
    setUser(null);
  }, []);

  const masukTamu = useCallback(() => {
    const tamu = tamuLokal();
    tulisTamu(tamu);
    setUser(tamu);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, masukTamu, supabaseSiap }),
    [user, loading, signIn, signUp, signOut, masukTamu, supabaseSiap],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function dariSesi(u: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null): Pengguna | null {
  if (!u) return null;
  const meta = u.user_metadata ?? {};
  const nama = typeof meta.nama === 'string' && meta.nama ? meta.nama : undefined;
  const email = u.email ?? '';
  return { id: u.id, email, nama: nama ?? email ?? 'Pengguna', mode: 'cloud' };
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
