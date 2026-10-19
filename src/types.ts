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
  | 'data';

export interface Conflict {
  id: string;
  tipe: ConflictTipe;
  tingkat: 'error' | 'peringatan';
  pesan: string;
  refJadwal: string[];
}
