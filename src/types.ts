// Model data aplikasi perencana jadwal pelajaran sekolah.

/** Nama hari bawaan — dipakai sebagai nilai awal & fallback data lama. */
export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

/** Daftar hari bawaan sebagai array biasa (bisa diubah pengguna). */
export const HARI_BAWAAN: string[] = [...DAYS];

export interface HasId {
  id: string;
}

/** Kunci slot unik, contoh: "2#p3" = Rabus, jam ke-3. */
export type SlotKey = string;

export function slotKey(hari: number, periodeId: string): SlotKey {
  return `${hari}#${periodeId}`;
}

export function parseSlotKey(key: SlotKey): { hari: number; periodeId: string } {
  const i = key.indexOf('#');
  return { hari: Number(key.slice(0, i)), periodeId: key.slice(i + 1) };
}

/**
 * Tipe waktu sebuah baris jam. Hanya `pelajaran` yang boleh dipakai menampung
 * pelajaran oleh generator; tipe lain (istirahat/apel/kustom) = di luar jam pelajaran.
 */
export const TIPE_WAKTU = ['pelajaran', 'istirahat', 'apel', 'kustom'] as const;
export type TipeWaktu = (typeof TIPE_WAKTU)[number];

export const LABEL_TIPE_WAKTU: Record<TipeWaktu, string> = {
  pelajaran: 'Pelajaran',
  istirahat: 'Istirahat',
  apel: 'Apel',
  kustom: 'Kustom',
};

export const TIPE_WAKTU_OPTIONS = TIPE_WAKTU.map((t) => ({
  value: t,
  label: LABEL_TIPE_WAKTU[t],
}));

export interface Period extends HasId {
  nama: string;
  mulai: string;
  selesai: string;
  /** Tipe waktu — hanya "pelajaran" yang dipakai generator. */
  tipe: TipeWaktu;
  /** Nama tipe bila `tipe === 'kustom'` (mis. "Senam Pagi"). */
  tipeKet?: string;
}

/** Label tampilan tipe waktu — tipe kustom memakai keterangannya sendiri. */
export function labelTipeWaktu(p: Pick<Period, 'tipe' | 'tipeKet'>): string {
  if (p.tipe === 'kustom') return p.tipeKet?.trim() || LABEL_TIPE_WAKTU.kustom;
  return LABEL_TIPE_WAKTU[p.tipe];
}

export interface Teacher extends HasId {
  nama: string;
  kode: string;
  /** Warna kartu guru — dipakai latar grid jadwal & sel matriks cetak. */
  warna: string;
  mapelIds: string[];
  maxJam: number;
  maxPerHari: number;
  slotDiinginkan: SlotKey[];
  slotDilarang: SlotKey[];
  /**
   * Pola distribusi JP (block scheduling), mis. [2, 1] = 3 JP dipecah 2+1.
   * Kosong = tanpa pola (setiap jam ditempatkan satu-satu).
   */
  polaJP: number[];
  catatan: string;
}

export interface SchoolClass extends HasId {
  nama: string;
  tingkat: string;
  waliKelasId: string;
  jumlahSiswa: number;
}

export interface Student extends HasId {
  nama: string;
  kelasId: string;
  pilihan: string[];
}

export interface Subject extends HasId {
  nama: string;
  kode: string;
  tipeRuang: string;
  pilihan: boolean;
}

/** Palet warna baku untuk kartu guru (guru baru & migrasi data lama). */
export const PALET_GURU = [
  '#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981',
  '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7',
];

export interface Room extends HasId {
  nama: string;
  kapasitas: number;
  tipe: string;
}

export interface Requirement extends HasId {
  kelasId: string;
  mapelId: string;
  guruId: string;
  jumlahJam: number;
  ruangId: string;
  /**
   * Pola distribusi JP untuk kebutuhan ini (mis. [2, 1] = 3 JP → blok 2 JP
   * berurutan + 1 JP). Kosong/[] = mengikuti pola guru, bila kosong juga → bebas.
   */
  polaJP: number[];
}

export interface Assignment extends HasId {
  reqId: string;
  kelasId: string;
  mapelId: string;
  guruId: string;
  ruangId: string;
  hari: number;
  periodeId: string;
  tetap: boolean;
  catatan: string;
  /**
   * Id blok pemecahan JP (block scheduling) — diisi bila slot ini merupakan
   * bagian dari pola distribusi berurutan. Anggota blok pada hari yang sama
   * dirender menyatu (rowspan) di grid & matriks cetak.
   */
  blokId?: string;
}

export interface Block extends HasId {
  jenis: 'kelas' | 'guru' | 'ruang';
  refId: string;
  hari: number;
  periodeId: string;
  alasan: string;
}

export interface SchoolInfo {
  nama: string;
  tahunAjaran: string;
  kepalaSekolah: string;
}

export interface GenOptions {
  percobaan: number;
  rataHari: boolean;
  hindariUjung: boolean;
  wajibRuang: boolean;
}

export interface Project {
  // Multi-tenant: terikat ke user_id (owner). Kosong/null jika mode lokal/offline.
  ownerId?: string | null;
  info: SchoolInfo;
  /**
   * Nama hari aktif, urut sesuai indeks `hari` pada jadwal/batasan.
   * Dinamis: pengguna boleh menambah, mengganti nama, menghapus, atau
   * mengurutkan ulang hari. Semua referensi hari memakai indeks array ini.
   */
  hari: string[];
  /**
   * Pengaturan JP khusus per hari (batas maksimal JP & slot non-aktif),
   * sejajar dengan `hari` (indeks yang sama = hari yang sama). Bila kosong
   * atau lebih pendek, hari tanpa konfigurasi memakai seluruh JP.
   */
  hariKonfig?: HariKonfig[];
  periode: Period[];
  guru: Teacher[];
  kelas: SchoolClass[];
  siswa: Student[];
  mapel: Subject[];
  ruang: Room[];
  kebutuhan: Requirement[];
  jadwal: Assignment[];
  blokir: Block[];
  opsi: GenOptions;
}

/**
 * Pengaturan JP khusus sebuah hari — memungkinkan jumlah JP berbeda tiap hari
 * (mis. Senin 7 JP, Jumat 5 JP) tanpa mengubah daftar jam pelajaran global.
 */
export interface HariKonfig {
  /**
   * Batas maksimal JP (urutan baris tipe "pelajaran") pada hari ini.
   * 0 = tanpa batas (ikuti seluruh jam pelajaran).
   */
  maksJP: number;
  /** Id periode JP yang dimatikan khusus hari ini (selain batas maksimal). */
  slotNonAktif: string[];
}

/** Konfigurasi baku hari: tanpa batas, seluruh JP aktif. */
export const HARI_KONFIG_BAWAAN: HariKonfig = { maksJP: 0, slotNonAktif: [] };

/** Ambil konfigurasi hari indeks `hari` (bila belum ada, memakai bawaan). */
export function konfigHari(p: Pick<Project, 'hari' | 'hariKonfig'>, hari: number): HariKonfig {
  const k = p.hariKonfig?.[hari];
  if (!k) return HARI_KONFIG_BAWAAN;
  return {
    maksJP: Number.isFinite(k.maksJP) && k.maksJP > 0 ? Math.floor(k.maksJP) : 0,
    slotNonAktif: Array.isArray(k.slotNonAktif) ? k.slotNonAktif : [],
  };
}

/**
 * Daftar baris JP yang AKTIF pada hari tertentu — baris tipe "pelajaran"
 * yang tidak dimatikan dan masih berada di batas maksimal JP hari itu.
 * Dipakai grid, matriks cetak, dan generator agar konsisten.
 */
export function periodeAktifHari(
  p: Pick<Project, 'periode' | 'hari' | 'hariKonfig'>,
  hari: number,
): Period[] {
  const k = konfigHari(p, hari);
  const non = new Set(k.slotNonAktif);
  const out: Period[] = [];
  let urut = 0; // urutan JP pada hari ini (berlaku walau ada yang dimatikan)
  for (const per of p.periode) {
    if (per.tipe !== 'pelajaran') continue;
    urut++;
    if (non.has(per.id)) continue;
    if (k.maksJP > 0 && urut > k.maksJP) continue;
    out.push(per);
  }
  return out;
}

/** Set id periode yang aktif pada hari tertentu (untuk cek cepat). */
export function slotAktifHari(
  p: Pick<Project, 'periode' | 'hari' | 'hariKonfig'>,
  hari: number,
): Set<string> {
  return new Set(periodeAktifHari(p, hari).map((x) => x.id));
}

/** Apakah slot (hari × periode) termasuk JP aktif pada hari itu? */
export function slotHariAktif(
  p: Pick<Project, 'periode' | 'hari' | 'hariKonfig'>,
  hari: number,
  periodeId: string,
): boolean {
  const per = p.periode.find((x) => x.id === periodeId);
  if (!per) return false;
  if (per.tipe !== 'pelajaran') return false;
  return slotAktifHari(p, hari).has(periodeId);
}

export type CollectionKey =
  | 'periode'
  | 'guru'
  | 'kelas'
  | 'siswa'
  | 'mapel'
  | 'ruang'
  | 'kebutuhan'
  | 'jadwal'
  | 'blokir';

export const TIPES_RUANG = ['reguler', 'lab-komputer', 'lab-sains', 'olahraga'] as const;

export const LABEL_TIPE_RUANG: Record<string, string> = {
  reguler: 'Ruang Reguler',
  'lab-komputer': 'Lab Komputer',
  'lab-sains': 'Lab Sains',
  olahraga: 'Lapangan',
};

export const TIPE_RUANG_OPTIONS = TIPES_RUANG.map((t) => ({
  value: t,
  label: LABEL_TIPE_RUANG[t],
}));

/** Tipe ruang yang disyaratkan mata pelajaran. */
export const TIPE_RUANG_KEBUTUHAN = [
  { value: 'reguler', label: 'Ruang Reguler' },
  { value: 'lab-komputer', label: 'Lab Komputer' },
  { value: 'lab-sains', label: 'Lab Sains' },
  { value: 'olahraga', label: 'Lapangan' },
  { value: 'semua', label: 'Semua Ruang' },
];

export type ConflictTipe =
  | 'kelas-bentrok'
  | 'guru-bentrok'
  | 'ruang-bentrok'
  | 'kurang-jam'
  | 'lebih-jam'
  | 'guru-lebih-jam'
  | 'kapasitas'
  | 'blokir'
  | 'istirahat'
  | 'nonaktif'
  | 'data';

export interface Conflict {
  id: string;
  tipe: ConflictTipe;
  tingkat: 'error' | 'peringatan';
  pesan: string;
  refJadwal: string[];
}
