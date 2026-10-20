// State global aplikasi + penyimpanan localStorage + data contoh sekolah.

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  Assignment,
  CollectionKey,
  HARI_BAWAAN,
  HARI_KONFIG_BAWAAN,
  HasId,
  PALET_GURU,
  parseSlotKey,
  Period,
  Project,
  Requirement,
  SchoolClass,
  slotKey,
  SlotKey,
  Student,
  Subject,
  Teacher,
  TIPE_WAKTU,
  TipeWaktu,
} from './types';
import type { HariKonfig } from './types';
import type { SchoolInfo } from './types';
import { uid } from './utils';
import { useAuth } from './lib/auth';
import { muatCloud, simpanCloud } from './lib/cloud';
import { hasSupabase } from './lib/supabase';

const STORAGE_KEY = 'jadwalweb:v1';

/** Kunci localStorage per pengguna — isolasi data antar akun di satu perangkat. */
const kunciPengguna = (userId: string) => `${STORAGE_KEY}:${userId}`;

/** Baca proyek milik `userId` dari localStorage (null bila belum ada/tidak sah). */
function bacaLokal(userId: string): Project | null {
  try {
    const raw = localStorage.getItem(kunciPengguna(userId));
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Tulis proyek milik `userId` ke localStorage. */
function tulisLokal(userId: string, project: Project): void {
  try {
    localStorage.setItem(kunciPengguna(userId), JSON.stringify(project));
  } catch {
    // kuota penuh — abaikan
  }
}

/**
 * Data lama (sebelum era multi-akun, kunci tanpa akhiran userId) diadopsi oleh
 * pengguna pertama yang masuk di perangkat ini, lalu kunci lamanya dihapus agar
 * tidak bocor ke pengguna berikutnya.
 */
function migrasiDataLama(userId: string): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = sanitize(JSON.parse(raw));
    if (!p) return null;
    localStorage.setItem(kunciPengguna(userId), raw);
    localStorage.removeItem(STORAGE_KEY);
    return p;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Data contoh
// ---------------------------------------------------------------------------

function demoProject(): Project {
  // `hariAktif: []` = aktif semua hari. Contoh per-hari: istirahat Jumat
  // bisa dibuat terpisah dengan `hariAktif: [4]` (Jumat).
  const periode: Period[] = [
    { id: 'p1', nama: 'Jam ke-1', mulai: '07:00', selesai: '07:40', tipe: 'pelajaran', hariAktif: [] },
    { id: 'p2', nama: 'Jam ke-2', mulai: '07:40', selesai: '08:20', tipe: 'pelajaran', hariAktif: [] },
    { id: 'p3', nama: 'Jam ke-3', mulai: '08:20', selesai: '09:00', tipe: 'pelajaran', hariAktif: [] },
    { id: 'i1', nama: 'Istirahat', mulai: '09:00', selesai: '09:20', tipe: 'istirahat', hariAktif: [] },
    { id: 'p4', nama: 'Jam ke-4', mulai: '09:20', selesai: '10:00', tipe: 'pelajaran', hariAktif: [] },
    { id: 'p5', nama: 'Jam ke-5', mulai: '10:00', selesai: '10:40', tipe: 'pelajaran', hariAktif: [] },
    { id: 'i2', nama: 'Istirahat', mulai: '10:40', selesai: '11:00', tipe: 'istirahat', hariAktif: [] },
    { id: 'p6', nama: 'Jam ke-6', mulai: '11:00', selesai: '11:40', tipe: 'pelajaran', hariAktif: [] },
    { id: 'p7', nama: 'Jam ke-7', mulai: '11:40', selesai: '12:20', tipe: 'pelajaran', hariAktif: [] },
    { id: 'p8', nama: 'Jam ke-8', mulai: '12:20', selesai: '13:00', tipe: 'pelajaran', hariAktif: [] },
  ];

  type SubjDef = [string, string, string, boolean];
  const subjDefs: SubjDef[] = [
    ['m_mtk', 'Matematika', 'MTK', false],
    ['m_in', 'Bahasa Indonesia', 'IND', false],
    ['m_eng', 'Bahasa Inggris', 'ING', false],
    ['m_fis', 'Fisika', 'FIS', false],
    ['m_kim', 'Kimia', 'KIM', false],
    ['m_bio', 'Biologi', 'BIO', false],
    ['m_pkn', 'PPKn', 'PPK', false],
    ['m_sej', 'Sejarah', 'SEJ', false],
    ['m_geo', 'Geografi', 'GEO', false],
    ['m_eko', 'Ekonomi', 'EKO', false],
    ['m_inf', 'Informatika', 'INF', false],
    ['m_jok', 'PJOK', 'JOK', false],
    ['m_sen', 'Seni Budaya', 'SEN', true],
    ['m_jaw', 'Bahasa Jawa', 'JAW', true],
  ];
  const mapel: Subject[] = subjDefs.map(([id, nama, kode, pilihan]) => ({
    id,
    nama,
    kode,
    pilihan,
  }));
  const pengajar: Record<string, string[]> = {
    m_mtk: ['g_rina', 'g_ahmad'],
    m_in: ['g_sari', 'g_budi'],
    m_eng: ['g_dewi'],
    m_fis: ['g_hendra'],
    m_kim: ['g_lestari'],
    m_bio: ['g_maya'],
    m_pkn: ['g_agus'],
    m_sej: ['g_toni'],
    m_geo: ['g_wulan'],
    m_eko: ['g_fitri'],
    m_inf: ['g_rizal'],
    m_jok: ['g_yoga'],
    m_sen: ['g_nia'],
    m_jaw: ['g_ratna'],
  };

  type GuruDef = [string, string, string, string[]];
  const guruDefs: GuruDef[] = [
    ['g_rina', 'Rina Susanti, S.Pd.', 'MTH', ['m_mtk']],
    ['g_ahmad', 'Ahmad Fauzi, S.Pd.', 'MTH', ['m_mtk']],
    ['g_sari', 'Sari Rahmawati, M.Pd.', 'IND', ['m_in']],
    ['g_budi', 'Budi Santoso, S.Pd.', 'IND', ['m_in']],
    ['g_dewi', 'Dewi Lestari, S.Pd.', 'ING', ['m_eng']],
    ['g_hendra', 'Hendra Gunawan, M.Si.', 'FIS', ['m_fis']],
    ['g_lestari', 'Lestari Wijaya, M.Si.', 'KIM', ['m_kim']],
    ['g_maya', 'Maya Kusuma, S.Pd.', 'BIO', ['m_bio']],
    ['g_agus', 'Agus Prasetyo, S.H.', 'PPK', ['m_pkn']],
    ['g_toni', 'Toni Saputra, S.Pd.', 'SEJ', ['m_sej']],
    ['g_wulan', 'Wulan Ramadhani, S.Pd.', 'GEO', ['m_geo']],
    ['g_fitri', 'Fitri Handayani, S.E.', 'EKO', ['m_eko']],
    ['g_rizal', 'Rizal Ramadhan, S.Kom.', 'INF', ['m_inf']],
    ['g_yoga', 'Yoga Permana, S.Pd.', 'JOK', ['m_jok']],
    ['g_nia', 'Nia Puspita, S.Sn.', 'SEN', ['m_sen']],
    ['g_ratna', 'Ratna Dewi, S.Pd.', 'JAW', ['m_jaw']],
  ];
  const guru: Teacher[] = guruDefs.map(([id, nama, kode, mapelIds], i) => ({
    id,
    nama,
    kode,
    warna: PALET_GURU[i % PALET_GURU.length],
    mapelIds,
    maxJam: 24,
    maxPerHari: 6,
    slotDiinginkan: [],
    slotDilarang: id === 'g_yoga' ? [slotKey(0, 'p8')] : [],
    polaJP: [],
    catatan: '',
  }));

  type KelasDef = [string, string, string, string, number];
  const kelasDefs: KelasDef[] = [
    ['k_x1', 'X-1', 'X', 'g_rina', 36],
    ['k_x2', 'X-2', 'X', 'g_sari', 36],
    ['k_xi1', 'XI-1', 'XI', 'g_hendra', 36],
    ['k_xi2', 'XI-2', 'XI', 'g_maya', 36],
    ['k_xii1', 'XII-1', 'XII', 'g_agus', 36],
    ['k_xii2', 'XII-2', 'XII', 'g_toni', 36],
  ];
  const kelas: SchoolClass[] = kelasDefs.map(([id, nama, tingkat, waliKelasId, jumlahSiswa]) => ({
    id,
    nama,
    tingkat,
    waliKelasId,
    jumlahSiswa,
  }));

  // Kurikulum: [kodeMapel, jam/minggu]
  const kurikulum: Record<string, [string, number][]> = {
    X: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_sej', 3], ['m_bio', 3],
      ['m_fis', 3], ['m_kim', 3], ['m_inf', 2], ['m_jok', 3], ['m_sen', 2], ['m_jaw', 2],
    ],
    XI: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_fis', 4], ['m_kim', 4],
      ['m_bio', 4], ['m_inf', 2], ['m_jok', 3], ['m_geo', 3], ['m_eko', 3],
    ],
    XII: [
      ['m_mtk', 4], ['m_in', 4], ['m_eng', 3], ['m_pkn', 2], ['m_fis', 4], ['m_kim', 4],
      ['m_bio', 4], ['m_sej', 3], ['m_inf', 2], ['m_jok', 3],
    ],
  };

  const kebutuhan: Requirement[] = [];
  kelas.forEach((c, ci) => {
    for (const [mapelId, jam] of kurikulum[c.tingkat]) {
      const daftarGuru = pengajar[mapelId] ?? [];
      const guruId = daftarGuru[ci % daftarGuru.length];
      kebutuhan.push({
        id: uid('k'),
        kelasId: c.id,
        mapelId,
        guruId,
        jumlahJam: jam,
        polaJP: [],
      });
    }
  });

  const depan = [
    'Aditya', 'Bella', 'Citra', 'Dimas', 'Elsa', 'Fajar', 'Galih', 'Hana',
    'Ilham', 'Jihan', 'Kevin', 'Laras', 'Muhammad', 'Nadia', 'Oskar', 'Putri',
    'Raka', 'Salsa', 'Taufik', 'Umara', 'Vino', 'Wahyu', 'Yuni', 'Zahra',
  ];
  const belakang = [
    'Pratama', 'Wijaya', 'Saputra', 'Ramadhan', 'Kusuma', 'Handayani',
    'Nugroho', 'Permata', 'Setiawan', 'Anggraini', 'Firmansyah', 'Maharani',
  ];
  const siswa: Student[] = [];
  kelas.forEach((c, ci) => {
    for (let i = 0; i < 8; i++) {
      const nama = `${depan[(ci * 5 + i) % depan.length]} ${belakang[(ci * 3 + i) % belakang.length]}`;
      const pilihan =
        c.tingkat === 'X'
          ? i % 3 === 0
            ? ['m_sen']
            : i % 3 === 1
              ? ['m_jaw']
              : ['m_sen', 'm_jaw']
          : [];
      siswa.push({ id: uid('s'), nama, kelasId: c.id, pilihan });
    }
  });

  const jadwal: Assignment[] = [];

  return {
    ownerId: null,
    info: {
      nama: 'SMA Nusantara',
      tahunAjaran: '2026/2027',
      kepalaSekolah: 'Drs. H. Bambang Suryono, M.Pd.',
      alamat: 'Jl. Pendidikan No. 1, Nusantara, Jawa Tengah 50123',
      logo: '',
    },
    hari: [...HARI_BAWAAN],
    hariKonfig: HARI_BAWAAN.map(() => ({ ...HARI_KONFIG_BAWAAN })),
    periode,
    guru,
    kelas,
    siswa,
    mapel,
    kebutuhan,
    jadwal,
    opsi: { percobaan: 8, rataHari: true, hindariUjung: true },
  };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * Seluruh state berada pada satu objek `Project`, termasuk `ownerId`
 * (userId pemilik data). Karena isi & pemilik berubah dalam satu aksi yang
 * sama, perpindahan akun tidak pernah menulis data akun lama ke kunci/storage
 * milik akun baru — inilah dasar isolasi data multi-tenant di sisi klien.
 */
type Action =
  | { type: 'set'; patch: Partial<Project> }
  /** Ganti isi proyek; `ownerId` (pemilik) tetap. */
  | { type: 'load'; project: Project }
  /** Ganti isi proyek sekaligus pemiliknya — dipakai saat akun berubah. */
  | { type: 'pasang'; project: Project; ownerId: string | null };

function reducer(state: Project, action: Action): Project {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'load':
      // Muat berkas/impor tidak boleh melepas kepemilikan data.
      return { ...action.project, ownerId: state.ownerId ?? null };
    case 'pasang':
      return { ...action.project, ownerId: action.ownerId };
  }
}

function upsertArr<T extends HasId>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [...arr, item];
  const copy = [...arr];
  copy[i] = item;
  return copy;
}

const ARRAYS: CollectionKey[] = [
  'periode', 'guru', 'kelas', 'siswa', 'mapel', 'kebutuhan', 'jadwal',
];

function hexValid(w: unknown): w is string {
  return typeof w === 'string' && /^#[0-9a-fA-F]{6}$/.test(w);
}

/**
 * Migrasi data lama: properti `warna` berpindah dari mata pelajaran ke guru.
 * Guru yang belum punya warna mewarisi warna mapel lamanya (atau dari palet),
 * lalu `warna` dibuang dari setiap mapel agar model data konsisten.
 */
function migrasiWarna(p: Project, raw: Record<string, unknown>): Project {
  const warnaMapelLama = new Map<string, string>();
  const mapelLama = Array.isArray(raw.mapel) ? (raw.mapel as Record<string, unknown>[]) : [];
  for (const m of mapelLama) {
    if (typeof m.id === 'string' && hexValid(m.warna)) warnaMapelLama.set(m.id, m.warna as string);
  }

  let urut = 0;
  const guru = p.guru.map((g) => {
    if (hexValid(g.warna)) return g;
    const daftar = Array.isArray(g.mapelIds) ? g.mapelIds : [];
    const warisan = daftar
      .map((id) => warnaMapelLama.get(id))
      .find((w) => w !== undefined);
    const warna = warisan ?? PALET_GURU[urut++ % PALET_GURU.length];
    return { ...g, warna };
  });

  const mapel = p.mapel.map((m) => {
    const sisa = { ...(m as unknown as Record<string, unknown>) };
    delete sisa.warna;
    delete sisa.tipeRuang;
    return sisa as unknown as Subject;
  });

  return { ...p, guru, mapel };
}

/**
 * Migrasi daftar hari: data baru memakai `hari`, data lama (belum punya
 * properti ini) memakai Senin–Sabtu. Nama kosong/duplikat dibuang.
 */
function migrasiHari(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const v of arr) {
    const nama = String(v ?? '').trim();
    if (nama && !out.includes(nama)) out.push(nama);
  }
  return out.length ? out : [...HARI_BAWAAN];
}

/**
 * Migrasi konfigurasi JP per hari (`hariKonfig`) — selalu sejajar `hari`
 * (panjang sama). Nilai tidak sah jatuh ke bawaan: tanpa batas, semua aktif.
 */
function migrasiHariKonfig(raw: unknown, jumlahHari: number): HariKonfig[] {
  const arr = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const out: HariKonfig[] = [];
  for (let i = 0; i < jumlahHari; i++) {
    const k = arr[i];
    if (!k || typeof k !== 'object') {
      out.push({ ...HARI_KONFIG_BAWAAN });
      continue;
    }
    const maks = Number(k.maksJP);
    const non = Array.isArray(k.slotNonAktif)
      ? k.slotNonAktif.map((x) => String(x ?? '').trim()).filter(Boolean)
      : [];
    out.push({
      maksJP: Number.isFinite(maks) && maks > 0 ? Math.floor(maks) : 0,
      slotNonAktif: [...new Set(non)],
    });
  }
  return out;
}

/**
 * Migrasi data lama: field `polaJP` (pemecahan JP / block scheduling) belum
 * ada pada data lama — diisi array kosong (tanpa pola).
 */
function migrasiPola(p: Project): Project {
  const pola = (v: unknown): number[] =>
    Array.isArray(v)
      ? [...new Set(v.map(Number).filter((n) => Number.isFinite(n) && n >= 1))]
      : [];
  return {
    ...p,
    guru: p.guru.map((g) => ({ ...g, polaJP: pola(g.polaJP) })),
    kebutuhan: p.kebutuhan.map((k) => ({ ...k, polaJP: pola(k.polaJP) })),
  };
}

/** Buang referensi hari yang berada di luar jumlah hari aktif. */
function rapikanReferensiHari(p: Project): Project {
  const n = p.hari.length;
  const valid = (h: number) => Number.isInteger(h) && h >= 0 && h < n;
  const slotValid = (k: SlotKey) => valid(parseSlotKey(k).hari);
  const periodeAda = new Set(p.periode.map((x) => x.id));
  return {
    ...p,
    jadwal: p.jadwal.filter((j) => valid(j.hari)),
    guru: p.guru.map((g) => ({
      ...g,
      slotDiinginkan: g.slotDiinginkan.filter(slotValid),
      slotDilarang: g.slotDilarang.filter(slotValid),
    })),
    // Konfigurasi hari tetap sejajar `hari`; slotNonAktif yang merujuk
    // periode terhapus ikut dibuang.
    hariKonfig: p.hari.map((_, i) => {
      const k = p.hariKonfig?.[i];
      if (!k) return { ...HARI_KONFIG_BAWAAN };
      return {
        maksJP: Number.isFinite(k.maksJP) && k.maksJP > 0 ? Math.floor(k.maksJP) : 0,
        slotNonAktif: (k.slotNonAktif ?? []).filter((id) => periodeAda.has(id)),
      };
    }),
    // Referensi hari pada `hariAktif` tiap periode juga dipangkas.
    periode: p.periode.map((per) => ({
      ...per,
      hariAktif: (per.hariAktif ?? []).filter(valid),
    })),
  };
}

/**
 * Migrasi data lama: field `alamat` & `logo` pada identitas sekolah belum ada.
 * `alamat` diisi string kosong, `logo` diisi '' (pakai logo bawaan aplikasi).
 * Logo hanya boleh berupa data URL gambar (data:image/...;base64,…); nilai
 * lain diabaikan agar tidak menyuntikkan skema berbahaya ke atribut src.
 */
function migrasiInfo(raw: unknown): SchoolInfo {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const teks = (v: unknown) => (typeof v === 'string' ? v : '');
  const logo = teks(r.logo);
  return {
    nama: teks(r.nama),
    tahunAjaran: teks(r.tahunAjaran),
    kepalaSekolah: teks(r.kepalaSekolah),
    alamat: teks(r.alamat),
    logo: /^data:image\/[a-z0-9.+-]+;base64,/i.test(logo) ? logo : '',
  };
}

function sanitize(raw: unknown): Project | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const base = demoProject();
  for (const k of ARRAYS) {
    if (!Array.isArray(r[k])) return null;
  }
  if (!r.info || typeof r.info !== 'object') return null;
  const proj = {
    ...(base as unknown as Record<string, unknown>),
    ...r,
    info: migrasiInfo(r.info),
    hari: migrasiHari(r.hari),
    hariKonfig: migrasiHariKonfig(r.hariKonfig, migrasiHari(r.hari).length),
    periode: migrasiPeriode(r.periode),
    opsi: { ...base.opsi, ...(r.opsi as object) },
  } as unknown as Project;
  return rapikanReferensiHari(migrasiWarna(migrasiPola(proj), r));
}

/**
 * Migrasi data lama: `istirahat: boolean` (model sebelumnya) → `tipe` enum.
 * Baris lama bertanda istirahat menjadi tipe "istirahat"; selain itu "pelajaran".
 * Data baru dengan `tipe` valid dibiarkan apa adanya.
 */
function migrasiPeriode(raw: unknown): Period[] {
  const arr = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  return arr.map((p) => {
    const tipeValid =
      typeof p.tipe === 'string' && (TIPE_WAKTU as readonly string[]).includes(p.tipe);
    const tipe: TipeWaktu = tipeValid
      ? (p.tipe as TipeWaktu)
      : p.istirahat === true
        ? 'istirahat'
        : 'pelajaran';
    // `hariAktif` = indeks hari; nilai tak sah dibuang. Kosong = semua hari.
    const hariAktif = Array.isArray(p.hariAktif)
      ? [
          ...new Set(
            (p.hariAktif as unknown[])
              .map((x) => Math.floor(Number(x)))
              .filter((n) => Number.isInteger(n) && n >= 0),
          ),
        ].sort((a, b) => a - b)
      : [];
    return {
      id: String(p.id ?? uid('p')),
      nama: String(p.nama ?? ''),
      mulai: String(p.mulai ?? ''),
      selesai: String(p.selesai ?? ''),
      tipe,
      tipeKet: typeof p.tipeKet === 'string' ? p.tipeKet : '',
      hariAktif,
    };
  });
}

interface Ctx {
  project: Project;
  /** userId pemilik data yang sedang dimuat (null = belum terikat akun). */
  ownerId: string | null;
  set: (patch: Partial<Project>) => void;
  upsert: (key: CollectionKey, item: HasId) => void;
  remove: (key: CollectionKey, id: string) => void;
  loadProject: (p: Project) => void;
  resetDemo: () => void;
}

const ProjectCtx = createContext<Ctx | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [project, dispatch] = useReducer(reducer, userId, (awal) => {
    // Saat aplikasi dibuka: baca data milik akun yang sudah pulih sesinya.
    const lokal = awal ? (bacaLokal(awal) ?? migrasiDataLama(awal)) : null;
    return { ...(lokal ?? demoProject()), ownerId: awal };
  });

  const projectRef = useRef(project);
  projectRef.current = project;
  const antreSimpan = useRef<Project | null>(null);
  // false selama pembacaan cloud untuk akun ini belum berhasil — menahan
  // pengiriman agar data contoh tidak pernah menimpa data asli di server.
  const cloudAman = useRef(true);

  // --- Perpindahan akun: muat data milik akun tersebut (lokal, lalu cloud) ---
  useEffect(() => {
    if (userId === (projectRef.current.ownerId ?? null)) return;

    // Keluar dari akun → putuskan kepemilikan tanpa menyentuh isi datanya;
    // efek simpan otomatis berhenti sehingga tidak ada data yang bocor.
    if (!userId) {
      dispatch({ type: 'set', patch: { ownerId: null } });
      return;
    }

    const lokal = bacaLokal(userId) ?? migrasiDataLama(userId);
    if (lokal) {
      cloudAman.current = true;
      dispatch({ type: 'pasang', project: lokal, ownerId: userId });
      return;
    }

    // Belum ada data lokal → ambil dari cloud (bila terkonfigurasi).
    // Bila cloud kosong/gagal, mulai dari data contoh — BUKAN data yang masih
    // berada di memori (bisa jadi milik akun sebelumnya) agar tidak pernah bocor.
    // Selama pembacaan cloud BELUM berhasil, tombol sinkron ditahan (cloudAman)
    // agar data contoh tidak pernah menimpa data asli di server.
    cloudAman.current = false;
    let batal = false;
    void muatCloud(userId).then((hasil) => {
      if (batal) return;
      if (hasil.status === 'galat') {
        console.warn('[sinkron] Memakai data contoh; sinkron cloud ditahan:', hasil.pesan);
        dispatch({ type: 'pasang', project: demoProject(), ownerId: userId });
        return;
      }
      cloudAman.current = true;
      const dariCloud = hasil.status === 'ada' ? sanitize(hasil.data) : null;
      dispatch({ type: 'pasang', project: dariCloud ?? demoProject(), ownerId: userId });
    });
    return () => {
      batal = true;
    };
  }, [userId]);

  // --- Simpan: localStorage segera (utama), cloud ditunda (debounce) 800 ms ---
  useEffect(() => {
    const ownerId = project.ownerId;
    if (!ownerId) return;
    tulisLokal(ownerId, project);
    if (!hasSupabase() || !cloudAman.current) return;

    antreSimpan.current = project;
    const t = window.setTimeout(() => {
      const antre = antreSimpan.current;
      antreSimpan.current = null;
      if (antre?.ownerId) void simpanCloud(antre.ownerId, antre);
    }, 800);
    return () => window.clearTimeout(t);
  }, [project]);

  // Perubahan terakhir ikut terkirim bila tab ditutup / provider dilepas.
  useEffect(
    () => () => {
      const antre = antreSimpan.current;
      antreSimpan.current = null;
      if (antre?.ownerId && cloudAman.current && hasSupabase()) {
        void simpanCloud(antre.ownerId, antre);
      }
    },
    [],
  );

  const set = useCallback(
    (patch: Partial<Project>) => dispatch({ type: 'set', patch }),
    [],
  );
  const upsert = useCallback(
    (key: CollectionKey, item: HasId) => {
      const arr = project[key] as HasId[];
      dispatch({ type: 'set', patch: { [key]: upsertArr(arr, item) } as Partial<Project> });
    },
    [project],
  );
  const remove = useCallback(
    (key: CollectionKey, id: string) => {
      const arr = project[key] as HasId[];
      dispatch({ type: 'set', patch: { [key]: arr.filter((x) => x.id !== id) } as Partial<Project> });
    },
    [project],
  );
  const loadProject = useCallback((p: Project) => dispatch({ type: 'load', project: p }), []);
  const resetDemo = useCallback(
    () => dispatch({ type: 'load', project: demoProject() }),
    [],
  );

  const value = useMemo(
    () => ({ project, ownerId: project.ownerId ?? null, set, upsert, remove, loadProject, resetDemo }),
    [project, set, upsert, remove, loadProject, resetDemo],
  );

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProject(): Ctx {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error('useProject harus dipakai di dalam ProjectProvider');
  return ctx;
}

export { demoProject };

/** Validasi & normalisasi objek proyek dari berkas/unduhan. */
export function parseProyek(raw: unknown): Project | null {
  return sanitize(raw);
}
