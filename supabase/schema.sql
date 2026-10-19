-- ===========================================================================
-- Skema Supabase untuk aplikasi Jadwal Sekolah (multi-tenant, tanpa admin)
--
-- Cara pakai:
--   1. Supabase Dashboard → SQL Editor → New query
--   2. Salin seluruh berkas ini → Run
--   3. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local
--
-- Model isolasi data:
--   Satu baris `projects` per pengguna (user_id = auth.users.id).
--   Seluruh data aplikasi (info sekolah, daftar hari dinamis, periode, guru,
--   kelas, siswa, mapel, ruang, kebutuhan jam, jadwal, batasan, opsi) tersimpan
--   sebagai JSONB di kolom `data`, sehingga setiap entitas ikut terikat pada
--   `user_id`.
--   Row Level Security memaksa setiap operasi menyaring `auth.uid() = user_id`,
--   sehingga user tidak pernah bisa membaca/mengubah data user lain.
--   Tidak ada peran admin: semua akun setara.
-- ===========================================================================

create table if not exists public.projects (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb   not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.projects is
  'Satu baris per pengguna berisi seluruh proyek jadwal (JSONB) — milik user_id.';

-- Aktifkan Row Level Security: tanpa kebijakan, tidak ada baris yang terbaca.
alter table public.projects enable row level security;

drop policy if exists "baca milik sendiri"        on public.projects;
drop policy if exists "tulis milik sendiri"       on public.projects;
drop policy if exists "ubah milik sendiri"        on public.projects;
drop policy if exists "hapus milik sendiri"       on public.projects;

create policy "baca milik sendiri"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "tulis milik sendiri"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "ubah milik sendiri"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "hapus milik sendiri"
  on public.projects for delete
  using (auth.uid() = user_id);

-- Stempel waktu otomatis.
create or replace function public.utamakan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.utamakan_updated_at();

-- ---------------------------------------------------------------------------
-- Index bila nanti ingin memperluas ke tabel per entitas (opsional, saat ini
-- aplikasi memakai satu kolom JSONB per user sehingga index GIN di bawah ini
-- sudah cukup untuk pencarian di dalam data).
-- ---------------------------------------------------------------------------
create index if not exists projects_data_gin on public.projects using gin (data);
