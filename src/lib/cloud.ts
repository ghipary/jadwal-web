// Sinkronisasi proyek ke Supabase — SATU baris per pengguna (tabel `projects`).
//
// Isolasi data (multi-tenant) dijalankan di dua lapis:
//  1. Kode  : seluruh kueri selalu menyaring `user_id` sesi berjalan.
//  2. Basis : kebijakan Row Level Security (lihat supabase/schema.sql) memastikan
//             user hanya dapat SELECT/INSERT/UPDATE/DELETE baris miliknya sendiri.
// Tidak ada peran admin — setiap akun setara dan hanya melihat datanya sendiri.

import { supabase, hasSupabase } from './supabase';
import type { Project } from '../types';

const TABEL = 'projects';
const BATAS_WAKTU_MS = 8000;

/** Batasi waktu tunggu agar aplikasi tidak macet bila jaringan lambat. */
function denganTimeout<T>(janji: PromiseLike<T>, ms = BATAS_WAKTU_MS): Promise<T> {
  const p = Promise.resolve(janji);
  return Promise.race([
    p,
    new Promise<T>((_, tolak) => {
      setTimeout(() => tolak(new Error('Waktu tunggu sinkronisasi habis')), ms);
    }),
  ]);
}

/** Hasil pembacaan cloud — dibedakan agar kegagalan jaringan tidak dianggap "data kosong". */
export type HasilMuat =
  | { status: 'ada'; data: unknown }
  | { status: 'kosong' }
  | { status: 'galat'; pesan: string };

/**
 * Ambil data proyek milik `userId`.
 * `galat` = jaringan/server bermasalah (BOLEH BEDA dengan `kosong` = belum pernah menyimpan),
 * agar aplikasi tidak mengira data hilang lalu menimpanya dengan data baru.
 */
export async function muatCloud(userId: string): Promise<HasilMuat> {
  if (!hasSupabase() || !supabase) return { status: 'kosong' };
  try {
    const { data, error } = await denganTimeout(
      supabase.from(TABEL).select('data').eq('user_id', userId).maybeSingle(),
    );
    if (error) {
      console.warn('[sinkron] Gagal memuat data cloud:', error.message);
      return { status: 'galat', pesan: error.message };
    }
    return data?.data ? { status: 'ada', data: data.data } : { status: 'kosong' };
  } catch (e) {
    const pesan = e instanceof Error ? e.message : 'Gagal memuat data cloud.';
    console.warn('[sinkron] Gagal memuat data cloud:', pesan);
    return { status: 'galat', pesan };
  }
}

/** Simpan (upsert) proyek milik `userId` — aman dipanggil berulang kali. */
export async function simpanCloud(userId: string, project: Project): Promise<boolean> {
  if (!hasSupabase() || !supabase) return false;
  try {
    const { error } = await denganTimeout(
      supabase
        .from(TABEL)
        .upsert(
          {
            user_id: userId,
            data: project as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        ),
    );
    if (error) {
      console.warn('[sinkron] Gagal menyimpan data cloud:', error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[sinkron] Gagal menyimpan data cloud:', e instanceof Error ? e.message : e);
    return false;
  }
}
