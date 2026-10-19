// Klien Supabase — dikonfigurasi lewat berkas .env.local
// (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).
// Bila keduanya belum diisi, aplikasi tetap berjalan dalam MODE LOKAL
// (tanpa sinkronisasi cloud; data hanya tersimpan di browser).

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Env = Record<string, string | undefined>;

/**
 * `import.meta.env` dibaca lewat variabel perantara agar aman juga saat
 * dibundel untuk pengujian (format CJS), dan tetap tergantikan secara
 * statis oleh Vite pada build produksi.
 */
const env: Env = ((import.meta as ImportMeta & { env?: Env }).env ?? {}) as Env;

export const VITE_SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').trim();
export const VITE_SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** true bila kunci Supabase sudah diisi — fitur cloud (login + sinkron) aktif. */
export const supabaseSiap = Boolean(VITE_SUPABASE_URL && VITE_SUPABASE_ANON_KEY);

/** Alias fungsi agar ringkas dipakai di penjaga rute & halaman auth. */
export function hasSupabase(): boolean {
  return supabaseSiap;
}

export const supabase: SupabaseClient | null = supabaseSiap
  ? createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
