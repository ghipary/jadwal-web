// Konfigurasi Supabase (mulai kosong, isi KEY/URL nanti)
// Catatan: Masukkan SUPABASE_URL dan SUPABASE_ANON_KEY di .env (Vite: VITE_*) atau ganti nilai di bawah.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as unknown as ReturnType<typeof createClient>);

export function hasSupabase(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
