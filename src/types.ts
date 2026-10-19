// Model data aplikasi perencana jadwal pelajaran sekolah.

export const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

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

export interface Period extends HasId {
  nama: string;
  mulai: string;
  selesai: string;
  istirahat: boolean;
}

export interface Teacher extends HasId {
  nama: string;
  kode: string;
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
  warna: string;
  tipeRuang: string;
  pilihan: boolean;
}

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
  info: SchoolInfo;
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
