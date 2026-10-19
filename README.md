# 🗓️ Jadwal Sekolah — Perencana Jadwal Pelajaran (Web)

Aplikasi web untuk menyusun jadwal pelajaran sekolah secara otomatis: kelola data guru,
kelas, siswa, mata pelajaran, ruang & jam pelajaran; generate jadwal dengan constraint
solver; periksa konflik; edit manual seret-and-lepas; ekspor/cetak; dan bagikan jadwal
lewat tautan baca-saja.

> **Catatan:** Ini adalah aplikasi **orisinil** yang ditulis dari nol dengan tampilan baru.
> Bukan salinan/fork dari software mana pun, dan tidak berafiliasi dengan produk komersial
> sejenis (mis. aSc TimeTables). Seluruh kode, desain, dan data contoh dibuat untuk proyek ini.

## ✨ Fitur

### Data sekolah
- **Guru** — kode, mata pelajaran yang diampu, batas jam/minggu & jam/hari,
  slot yang disukai/dilarang (pemilih grid hari × jam), catatan.
- **Kelas** — nama, tingkat, wali kelas, jumlah siswa (dipakai untuk kapasitas ruang).
- **Siswa** — per kelas + pilihan mapel (untuk kelas berpeminatan).
- **Mata Pelajaran** — warna kartu, tipe ruang yang disyaratkan (reguler / lab komputer /
  lab sains / lapangan), penanda mapel pilihan.
- **Ruang** — tipe & kapasitas.
- **Jam Pelajaran** — urutan jam per hari (Senin–Sabtu), penanda istirahat,
  bisa diurutkan naik/turun.
- **Kebutuhan Jam** — berapa jam/minggu tiap kelas × mapel × guru, lengkap dengan
  status terpenuhi/kurang.
- **Batasan & Slot Terblokir** — mis. "kelas XI-1 tidak boleh Senin jam ke-1",
  "guru X dilarang jam terakhir", "ruang dipakai acara".

### Generator jadwal otomatis
- Constraint solver: kelas/guru/ruang tidak pernah bentrok, jumlah jam terpenuhi,
  batas jam guru (minggu & hari), kapasitas & tipe ruang, preferensi jam guru,
  slot terblokir, sebaran mapel antar hari, hindari jam ujung hari.
- **Jadwal tetap dipertahankan** — hanya pelajaran non-tetap yang diganti.
- Beberapa percobaan acak → hasil terbaik dipilih, lengkap dengan **laporan**
  (berhasil/gagal, alasan tiap kegagalan, durasi).

### Grid jadwal
- Tampilan per **Kelas / Guru / Ruang / Siswa** (pilihan mapel siswa direduksi bila tidak diambil).
- **Edit manual**: seret kartu untuk memindah jam (dengan peringatan bentrok),
  klik kartu untuk ubah ruang/guru/menandai tetap/menghapus, klik **+** di sel kosong
  untuk menambah pelajaran.
- Kartu yang bermasalah ditandai **outline merah**, jadwal tetap outline hijau.
- Ekspor CSV tampilan aktif & cetak (CSS cetak khusus).

### Pemeriksa konflik
Bentrok kelas/guru/ruang · kurang/lebih jam · beban guru berlebih · kapasitas ruang ·
slot terblokir dilanggar · jadwal di luar jam pelajaran · data terhapus — lengkap dengan
tautan "Lihat di Jadwal".

### Berkas, backup & publikasi
- **Simpan/muat proyek (JSON)**, ekspor **CSV** dikelompokkan rapi jadi dua panel grid:
  **Data Master** (Guru, Kelas, Siswa, Mapel, Ruang) dan **Data Jadwal** (Kebutuhan Jam,
  Jadwal Lengkap) — masing-masing tombol berikon.
- Reset data contoh, kosongkan semua, impor massal via template Excel (8 sheet).
- Data tersimpan otomatis di **localStorage** (per akun).
- **Publikasi**: buat tautan `#/publikasi?d=…` berisi salinan data terkompresi
  (deflate + base64url) → penerima melihat jadwal baca-saja **tanpa login**.

### Landing page, login & isolasi data (multi-tenant)
- **Halaman Landing publik** (`#/landing`) berisi penjelasan aplikasi + tombol **Masuk** dan
  **Daftar**, dilanjutkan halaman **Login** (`#/login`) dan **Daftar** (`#/register`)
  berbasis **Supabase Auth**.
- **Perlindungan rute**: rute aplikasi dibungkus `RequireAuth` — bila belum masuk, pengunjung
  diarahkan ke halaman Landing. Rute publik (landing/login/register) dibungkus `PublicOnly`.
- **Isolasi data (tanpa admin, semua setara)**:
  - Setiap proyek menyimpan `ownerId` = `user_id` sesi berjalan; perpindahan akun memuat
    data akun tersebut secara atomik sebelum aplikasi ditampilkan (tidak pernah bercampur).
  - Lokal: kunci localStorage per pengguna (`jadwalweb:v1:<user_id>`).
  - Cloud: satu baris `projects` per pengguna dengan **Row Level Security**
    (`auth.uid() = user_id`) — lihat `supabase/schema.sql`. Tabel `guru`, `kelas`, `jadwal`,
    dst. tersimpan di dalam kolom `data` (JSONB) yang terikat pada baris `user_id` tsb.
  - Setiap kueri cloud selalu menyaring `user_id` sesi berjalan.
- **Tombol Keluar** tersedia di Dashboard dan topbar; tautan publikasi tetap bisa dibuka
  tanpa login.
- **Mode Lokal**: bila kunci Supabase belum diisi, aplikasi tetap bisa dicoba lewat
  “Coba Mode Lokal” (data hanya di browser).

## 🛠️ Teknologi

Vite · React 18 · TypeScript · React Router (HashRouter) · Supabase (Auth + Postgres RLS,
opsional) — tanpa CSS framework (desain custom). Deploy statis ke Vercel.

## 🚀 Menjalankan

```bash
npm install
npm run dev        # server development
npm run build      # build produksi ke dist/
npm run preview    # pratinjau hasil build

npm test           # uji mesin generator (harus: 206/206 jam, 0 konflik)
npm run test:render # uji render seluruh halaman + proteksi rute
```

## 🔐 Menyiapkan Supabase (login & sinkronisasi cloud)

Tanpa konfigurasi ini aplikasi tetap jalan dalam **Mode Lokal** (tanpa login, data di browser).

1. Buat proyek di [supabase.com](https://supabase.com), buka **SQL Editor** → *New query*,
   jalankan isi berkas [`supabase/schema.sql`](supabase/schema.sql)
   (tabel `projects` + kebijakan Row Level Security per `user_id`).
2. Salin `.env.example` menjadi `.env.local`, lalu isi dari
   **Project Settings → API**:

   ```bash
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

   > ⚠️ `VITE_SUPABASE_URL` harus **URL proyek saja** (`https://xxxx.supabase.co`)
   > tanpa path seperti `/auth/v1` atau `/rest/v1`. Bila salah, tautan publikasi
   > dan sinkronisasi akan gagal dengan pesan *Invalid path specified in request URL*.
   > Cek: `VITE_SUPABASE_ANON_KEY` harus diisi **Anon key** (public), bukan *Service role* key.

3. Jalankan ulang `npm run dev`. Halaman **Daftar/Masuk** kini memakai Supabase Auth;
   setiap akun hanya melihat datanya sendiri.
4. (Opsional) **Konfirmasi email** — Supabase secara bawaan mengirim email verifikasi
   saat pendaftaran, dan ini **lebih aman direkomendasikan tetap aktif** agar tidak
   ada akun sembarangan memakai layanan Anda. Bila ingin pengguna langsung masuk
   setelah daftar, nonaktifkan di **Authentication → Providers → Email**
   (*Confirm email*).

## 📦 Deploy

Repo ini otomatis ter-deploy ke Vercel (build command `npm run build`,
output directory `dist`). Perubahan di branch `main` akan di-deploy ulang.

## 🧪 Data contoh

Saat pertama dibuka, aplikasi terisi data contoh **SMA Nusantara**: 16 guru,
6 kelas, 14 mata pelajaran, 10 ruang, 10 slot jam (2 istirahat), dan 206 jam
kebutuhan/minggu. Tekan **Generate Jadwal** untuk melihat solver bekerja
(~100–200 ms), lalu cek halaman **Pemeriksa Konflik**.

---

Lisensi: MIT untuk kode proyek ini.
