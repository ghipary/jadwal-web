// Fitur Excel massal (library SheetJS `xlsx`):
// 1. buatTemplateXlsx — meng-generate template .xlsx dengan 8 sheet terpisah
// 2. bacaWorkbook     — membaca semua sheet & menyusun objek Project lengkap

import * as XLSX from 'xlsx';
import {
  Block,
  DAYS,
  HARI_KONFIG_BAWAAN,
  LABEL_TIPE_RUANG,
  LABEL_TIPE_WAKTU,
  PALET_GURU,
  parseSlotKey,
  Period,
  Project,
  Requirement,
  Room,
  SchoolClass,
  slotKey,
  SlotKey,
  Student,
  Subject,
  Teacher,
  TIPES_RUANG,
  TipeWaktu,
} from './types';
import type { HariKonfig } from './types';
import { uid } from './utils';

/** Nama-nama sheet yang dikenali (harus sama antara template & pembaca). */
export const NAMA_SHEET = {
  petunjuk: 'Petunjuk',
  hari: 'Hari',
  guru: 'Guru',
  kelas: 'Kelas',
  siswa: 'Siswa',
  mapel: 'Mata Pelajaran',
  ruang: 'Ruang',
  periode: 'Jam Pelajaran',
  kebutuhan: 'Kebutuhan Jam',
  blokir: 'Batasan',
} as const;

/** Sheet berisi data — "Petunjuk" tidak dihitung saat mendeteksi berkas. */
const SHEET_DATA = [
  NAMA_SHEET.hari,
  NAMA_SHEET.guru,
  NAMA_SHEET.kelas,
  NAMA_SHEET.siswa,
  NAMA_SHEET.mapel,
  NAMA_SHEET.ruang,
  NAMA_SHEET.periode,
  NAMA_SHEET.kebutuhan,
  NAMA_SHEET.blokir,
] as const;

type Sel = (string | number)[];

// ---------------------------------------------------------------------------
// Helper tampilan (template)
// ---------------------------------------------------------------------------

function lebarKolom(header: Sel, baris: Sel[]): { wch: number }[] {
  return header.map((h, i) => {
    let terpanjang = String(h).length + 3;
    for (const r of baris.slice(0, 200)) {
      terpanjang = Math.max(terpanjang, String(r[i] ?? '').length + 2);
    }
    return { wch: Math.min(46, terpanjang) };
  });
}

// ---------------------------------------------------------------------------
// 1. Generator template
// ---------------------------------------------------------------------------

/**
 * Susun workbook Excel. Template kosong dipakai untuk mengisi data massal;
 * mode `sertakanData` dipakai untuk mengekspor data yang sudah ada.
 *
 * ATURAN PENTING: judul kolom (header) setiap sheet ditulis persis sama
 * dengan sesuai referensi; header memakai **nama key state** (mis. `nama`,
 * `mapelIds`, `maxJam`, `polaJP`) supaya ekspor & impor benar-benar
 * round-trip. Template kosong menyisipkan SATU baris contoh (dummy) yang
 * ditandai penanda khusus — pembaca akan mengabaikannya otomatis.
 */
export interface OpsiTemplateExcel {
  /**
   * `true` = sertakan data proyek saat ini (ekspor/round-trip),
   * `false` = template kosong siap diisi (header + 1 baris contoh).
   */
  sertakanData?: boolean;
}

/** Penanda baris contoh pada template agar pembaca bisa melewatinya. */
export const PENANDA_CONTOH = 'CONTOH';

/** Judul kolom tiap sheet — memakai nama key state (dibaca balik oleh pembaca). */
export const HEADER: Record<keyof typeof NAMA_SHEET, Sel> = {
  petunjuk: ['Langkah', 'Cara Isi', 'Contoh / Catatan'],
  hari: ['nama', 'maksJP', 'slotNonAktif'],
  guru: [
    'kode',
    'nama',
    'warna',
    'mapelIds',
    'maxJam',
    'maxPerHari',
    'slotDiinginkan',
    'slotDilarang',
    'polaJP',
    'catatan',
  ],
  kelas: ['nama', 'tingkat', 'waliKelasId', 'jumlahSiswa'],
  siswa: ['nama', 'kelasId', 'pilihan'],
  mapel: ['kode', 'nama', 'tipeRuang', 'pilihan'],
  ruang: ['nama', 'tipe', 'kapasitas'],
  periode: ['nama', 'mulai', 'selesai', 'tipe', 'tipeKet'],
  kebutuhan: ['kelasId', 'mapelId', 'guruId', 'ruangId', 'jumlahJam', 'polaJP'],
  blokir: ['jenis', 'refId', 'hari', 'periodeId', 'alasan'],
};

/** Satu baris contoh untuk template kosong (dilewati otomatis saat dibaca). */
const CONTOH: Record<keyof typeof NAMA_SHEET, Sel> = {
  petunjuk: [],
  hari: ['Senin', 7, ''],
  guru: ['MTH', 'Contoh Guru', '#4f46e5', 'Matematika', 24, 6, 'Senin Jam ke-1', '', '2;1', ''],
  kelas: ['X-1', 'X', 'Contoh Guru', 36],
  siswa: ['Contoh Siswa', 'X-1', ''],
  mapel: ['MTK', 'Matematika', 'Ruang Reguler', 'Tidak'],
  ruang: ['R-1', 'Ruang Reguler', 40],
  periode: ['Jam ke-1', '07:00', '07:40', 'Pelajaran', ''],
  kebutuhan: ['X-1', 'Matematika', 'Contoh Guru', 'Otomatis', 4, '2;1'],
  blokir: ['Kelas', 'X-1', 'Senin', 'Jam ke-1', 'Contoh'],
};

// ---------------------------------------------------------------------------
// 1. Generator template
// ---------------------------------------------------------------------------

export function buatTemplateXlsx(
  project: Project,
  opsi: OpsiTemplateExcel = {},
): Uint8Array {
  const wb = XLSX.utils.book_new();
  const denganData = opsi.sertakanData === true;
  const data = <T>(arr: T[]): T[] => (denganData ? arr : []);
  const denganContoh = opsi.sertakanData === undefined;

  const add = (nama: keyof typeof NAMA_SHEET, baris: Sel[], filter = true) => {
    const header = HEADER[nama];
    const body = baris.length ? baris : denganContoh ? [CONTOH[nama]] : [];
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws['!cols'] = lebarKolom(header, body);
    if (filter && body.length > 1) {
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { r: 0, c: 0 },
          e: { r: body.length, c: Math.max(0, header.length - 1) },
        }),
      };
    }
    XLSX.utils.book_append_sheet(wb, ws, NAMA_SHEET[nama]);
  };

  // Panduan singkat — sheet ini diabaikan saat impor.
  add(
    'petunjuk',
    denganContoh
      ? [
          ['1. Hari', 'Satu nama hari per baris. Kolom maksJP = batas JP hari itu (0 = tanpa batas).', 'Senin = 7 JP, Jumat = 5 JP'],
          ['2. Guru', 'mapelIds diisi nama/kode mapel dipisah titik koma. polaJP = pola blok JP.', 'polaJP: 2;1 berarti 3 JP dipecah 2+1'],
          ['3. Kelas', 'waliKelasId diisi nama/kode guru (opsional).', 'X-1, XI-2, XII-3'],
          ['4. Siswa', 'kelasId harus sudah ada di sheet Kelas.', 'pilihan diisi dipisah titik koma.'],
          ['5. Mata Pelajaran', 'tipeRuang: Ruang Reguler / Lab Komputer / Lab Sains / Lapangan / Semua.', 'pilihan: Ya / Tidak'],
          ['6. Ruang', 'Tipe mengikuti daftar tipe ruang. kapasitas diisi angka.', 'Kapasitas 40.'],
          ['7. Jam Pelajaran', 'tipe: Pelajaran / Istirahat / Apel / Kustom.', 'Hanya tipe Pelajaran yang dipakai generator.'],
          ['8. Kebutuhan Jam', 'kelasId/mapelId/guruId harus sudah terdaftar.', 'ruangId "Otomatis" bila tidak ditentukan.'],
          ['9. Batasan', 'jenis: Kelas / Guru / Ruang. hari & periodeId harus valid.', 'Isi alasan bila perlu.'],
          ['Catatan', `Baris pertama pada template kosong adalah contoh (ditandai "${PENANDA_CONTOH}") dan diabaikan otomatis.`, 'Jangan mengganti nama sheet atau judul kolom.'],
        ]
      : [],
    false,
  );

  const periodeNama = new Map(project.periode.map((p) => [p.id, p.nama]));
  const formatSlot = (k: SlotKey): string => {
    const { hari, periodeId } = parseSlotKey(k);
    const nama = periodeNama.get(periodeId);
    return nama ? `${project.hari[hari] ?? ''} ${nama}` : k;
  };
  const slotTeks = (arr: SlotKey[]) => arr.map(formatSlot).join('; ');
  const polaTeks = (arr: number[] | undefined) => (arr ?? []).join('; ');

  const namaMapel = new Map(project.mapel.map((m) => [m.id, m.nama]));
  const namaGuru = new Map(project.guru.map((g) => [g.id, g.nama]));
  const namaKelas = new Map(project.kelas.map((c) => [c.id, c.nama]));
  const namaRuang = new Map(project.ruang.map((r) => [r.id, r.nama]));
  const tipeTeks = (t: string) => LABEL_TIPE_RUANG[t] ?? t;
  const yaTidak = (b: boolean) => (b ? 'Ya' : 'Tidak');

  const konfigHariArr: HariKonfig[] = project.hari.map((_, i) => {
    const k = project.hariKonfig?.[i];
    return k ? k : { ...HARI_KONFIG_BAWAAN };
  });

  add(
    'hari',
    data(
      project.hari.map((h, i) => [
        h,
        konfigHariArr[i].maksJP || 0,
        konfigHariArr[i].slotNonAktif
          .map((id) => periodeNama.get(id) ?? id)
          .join('; '),
      ]),
    ),
  );

  add(
    'guru',
    data(
      project.guru.map((g) => [
        g.kode,
        g.nama,
        g.warna,
        g.mapelIds.map((id) => namaMapel.get(id) ?? '').filter(Boolean).join('; '),
        g.maxJam,
        g.maxPerHari,
        slotTeks(g.slotDiinginkan),
        slotTeks(g.slotDilarang),
        polaTeks(g.polaJP),
        g.catatan,
      ]),
    ),
  );

  add(
    'kelas',
    data(
      project.kelas.map((c) => [
        c.nama,
        c.tingkat,
        namaGuru.get(c.waliKelasId) ?? '',
        c.jumlahSiswa,
      ]),
    ),
  );

  add(
    'siswa',
    data(
      project.siswa.map((s) => [
        s.nama,
        namaKelas.get(s.kelasId) ?? '',
        s.pilihan.map((id) => namaMapel.get(id) ?? '').filter(Boolean).join('; '),
      ]),
    ),
  );

  add(
    'mapel',
    data(project.mapel.map((m) => [m.kode, m.nama, tipeTeks(m.tipeRuang), yaTidak(m.pilihan)])),
  );

  add(
    'ruang',
    data(project.ruang.map((r) => [r.nama, tipeTeks(r.tipe), r.kapasitas])),
  );

  add(
    'periode',
    data(
      project.periode.map((p) => [
        p.nama,
        p.mulai,
        p.selesai,
        LABEL_TIPE_WAKTU[p.tipe],
        p.tipe === 'kustom' ? (p.tipeKet ?? '') : '',
      ]),
    ),
  );

  add(
    'kebutuhan',
    data(
      project.kebutuhan.map((k) => [
        namaKelas.get(k.kelasId) ?? '',
        namaMapel.get(k.mapelId) ?? '',
        namaGuru.get(k.guruId) ?? '',
        k.ruangId ? (namaRuang.get(k.ruangId) ?? '') : 'Otomatis',
        k.jumlahJam,
        polaTeks(k.polaJP),
      ]),
    ),
  );

  add(
    'blokir',
    data(
      project.blokir.map((b) => [
        b.jenis === 'kelas' ? 'Kelas' : b.jenis === 'guru' ? 'Guru' : 'Ruang',
        b.jenis === 'kelas'
          ? (namaKelas.get(b.refId) ?? '')
          : b.jenis === 'guru'
            ? (namaGuru.get(b.refId) ?? '')
            : (namaRuang.get(b.refId) ?? ''),
        project.hari[b.hari] ?? '',
        periodeNama.get(b.periodeId) ?? '',
        b.alasan,
      ]),
    ),
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// 2. Pembaca workbook
// ---------------------------------------------------------------------------

export interface JumlahImpor {
  hari: number;
  guru: number;
  kelas: number;
  siswa: number;
  mapel: number;
  ruang: number;
  periode: number;
  kebutuhan: number;
  blokir: number;
}

export interface HasilImporExcel {
  project: Project;
  jumlah: JumlahImpor;
  /** Baris yang dilewati karena referensi tidak ditemukan / wajib kosong. */
  dilewati: number;
  /** Kesalahan fatal — bila tidak kosong, impor harus dibatalkan. */
  galat: string[];
}

/** Baris virtual: nilai kolom per header sheet, sudah dinormalisasi. */
type Baris = Record<string, unknown>;

/** Judul kolom versi template lama → nama key state (kompatibilitas ke belakang). */
const ALIAS_HEADER: Record<string, Record<string, string>> = {
  [NAMA_SHEET.hari]: { 'nama hari': 'nama', hari: 'nama' },
  [NAMA_SHEET.guru]: {
    'mata pelajaran': 'mapelIds',
    'maks jam/minggu': 'maxJam',
    'maks jam/hari': 'maxPerHari',
    'slot diinginkan': 'slotDiinginkan',
    'slot dilarang': 'slotDilarang',
    'pola jp': 'polaJP',
  },
  [NAMA_SHEET.kelas]: { 'wali kelas': 'waliKelasId', 'jumlah siswa': 'jumlahSiswa' },
  [NAMA_SHEET.siswa]: { kelas: 'kelasId', 'pilihan mapel': 'pilihan' },
  [NAMA_SHEET.mapel]: {
    'tipe ruang': 'tipeRuang',
    'mapel pilihan': 'pilihan',
    'mata pelajaran': 'nama',
  },
  [NAMA_SHEET.ruang]: { tipe: 'tipe', kapasitas: 'kapasitas' },
  [NAMA_SHEET.periode]: {
    'tipe waktu': 'tipe',
    keterangan: 'tipeKet',
  },
  [NAMA_SHEET.kebutuhan]: {
    kelas: 'kelasId',
    'mata pelajaran': 'mapelId',
    guru: 'guruId',
    ruang: 'ruangId',
    'jam/minggu': 'jumlahJam',
    'pola jp': 'polaJP',
  },
  [NAMA_SHEET.blokir]: { objek: 'refId', jam: 'periodeId' },
};

export async function bacaBerkasExcel(f: File): Promise<XLSX.WorkBook> {
  const buf = await f.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

/** Ambil isi sheet mentah (array baris), lalu ubah agar tetap punya header. */
function barisMentah(wb: XLSX.WorkBook, nama: string): unknown[][] {
  const ws = wb.Sheets[nama];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false });
}

/**
 * Baca sheet menjadi daftar baris objek. Header yang dikenali adalah **nama
 * key state** (format baru); bila tidak cocok, fallback ke judul lama
 * (format template sebelumnya) supaya berkas lama tetap terbaca.
 */
function barisSheet(wb: XLSX.WorkBook, nama: string): Baris[] {
  const aoa = barisMentah(wb, nama);
  if (!aoa.length) return [];
  const header = (aoa[0] ?? []).map((h) => String(h ?? '').trim());
  const alias = ALIAS_HEADER[nama] ?? {};
  const kunci = header.map((h) => alias[h.toLowerCase()] ?? h);
  const out: Baris[] = [];
  for (const row of aoa.slice(1)) {
    const obj: Baris = {};
    let isi = false;
    kunci.forEach((k, i) => {
      if (!k) return;
      const v = row[i];
      obj[k] = v;
      if (String(v ?? '').trim() !== '') isi = true;
    });
    if (isi) out.push(obj);
  }
  return out;
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

/** Type-cast aman ke number: kosong/tidak sah → nilai bawaan. */
function num(v: unknown, bawaan: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = str(v);
  if (!s) return bawaan;
  const n = Number(s.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : bawaan;
}

/** Bilangan bulat ≥ 1, kosong → bawaan. */
function numPositif(v: unknown, bawaan: number): number {
  const n = Math.floor(num(v, NaN));
  return Number.isFinite(n) && n > 0 ? n : bawaan;
}

/** Daftar pola JP: terima "2;1", "2, 1", "2 1", atau angka tunggal. */
function parsePola(v: unknown): number[] {
  return str(v)
    .split(/[;,\s]+/)
    .map((x) => Math.floor(Number(x)))
    .filter((n) => Number.isFinite(n) && n >= 1);
}

function ya(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  return /^(ya|y|1|true|yes)$/i.test(str(v));
}

/**
 * Sinonim kolom "tipe" yang berarti jam pelajaran (KBM = Kegiatan Belajar
 * Mengajar, PBM = Proses Belajar Mengajar, dsb.). Nilai ini WAJIB dikenali
 * sebagai `pelajaran` — kalau tidak, seluruh JP jadi non-aktif dan generator
 * selalu gagal ("tidak ada JP aktif pada hari ini").
 */
const KATA_PELAJARAN =
  /^(pelajaran|jam pelajaran|kbm|pbm|kegiatan belajar|belajar mengajar|belajar)/;

/**
 * Baca kolom tipe waktu dari sheet "Jam Pelajaran".
 * Format baru: `tipe` (Pelajaran/Istirahat/Apel/Kustom) + `tipeKet`.
 * Format lama: kolom "Istirahat" berisi Ya/Tidak, tetap diterima.
 */
function bacaTipeWaktu(r: Baris): { tipe: TipeWaktu; tipeKet: string } {
  const mentah = str(r['tipe'] ?? r['Tipe Waktu'] ?? r['tipeWaktu']);
  const teks = mentah.toLowerCase();
  const ket = str(r['tipeKet'] ?? r['Keterangan']);
  if (teks) {
    if (teks.startsWith('istirahat') || teks.startsWith('rehat'))
      return { tipe: 'istirahat', tipeKet: '' };
    if (teks.startsWith('apel') || teks.startsWith('upacara'))
      return { tipe: 'apel', tipeKet: '' };
    if (teks.startsWith('kustom') || teks.startsWith('lainnya') || teks.startsWith('lain-lain'))
      return { tipe: 'kustom', tipeKet: ket || teks };
    if (KATA_PELAJARAN.test(teks)) return { tipe: 'pelajaran', tipeKet: '' };
    // Teks bebas di kolom tipe → dianggap tipe kustom.
    return { tipe: 'kustom', tipeKet: ket || mentah };
  }
  // Fallback format lama.
  if (ya(r['istirahat'])) return { tipe: 'istirahat', tipeKet: '' };
  return { tipe: 'pelajaran', tipeKet: '' };
}

/** Peta tipe ruang: terima nilai mentah maupun label ("Lab Komputer" → lab-komputer). */
const PETA_TIPE = new Map<string, string>();
for (const t of [...TIPES_RUANG, 'semua']) PETA_TIPE.set(t, t);
for (const [key, label] of Object.entries(LABEL_TIPE_RUANG)) {
  PETA_TIPE.set(label.toLowerCase().replace(/\s+/g, '-'), key);
}
PETA_TIPE.set('lapangan', 'olahraga');

function normalisasiTipe(v: unknown): string {
  const s = str(v)
    .toLowerCase()
    .replace(/^ruang\s+/, '')
    .replace(/\s+/g, '-');
  if (!s) return 'reguler';
  return PETA_TIPE.get(s) ?? 'reguler';
}

function hexValid(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
}

/** Baris contoh pada template kosong (ditandai penanda) harus diabaikan. */
function barisContoh(r: Baris): boolean {
  return Object.values(r).some((v) => str(v).toUpperCase() === PENANDA_CONTOH);
}

/** Nama hari valid dari sheet "Hari" (fallback: hari proyek / Senin–Sabtu). */
function bacaHari(
  wb: XLSX.WorkBook,
  cadangan: string[],
): { hari: string[]; konfig: HariKonfig[] } {
  const hari: string[] = [];
  const konfig: HariKonfig[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.hari)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']) || str(r['Nama Hari']) || str(r['Nama']) || str(r['hari']);
    if (!nama || hari.includes(nama)) continue;
    hari.push(nama);
    konfig.push({
      maksJP: Math.max(0, Math.floor(num(r['maksJP'], 0))),
      slotNonAktif: [],
    });
  }
  if (hari.length) return { hari, konfig };
  const dasar = cadangan.length ? [...cadangan] : [...DAYS];
  return { hari: dasar, konfig: dasar.map(() => ({ ...HARI_KONFIG_BAWAAN })) };
}

/** "Senin Jam ke-1; Selasa Jam ke-2" (atau format mentah "0#p1") → SlotKey[]. */
function parseSlotList(teks: string, periode: Period[], hari: string[]): SlotKey[] {
  const byNama = new Map(periode.map((p) => [p.nama.toLowerCase(), p.id]));
  const out: SlotKey[] = [];
  for (const entri of teks.split(/[;,]/)) {
    const s = entri.trim();
    if (!s) continue;
    if (/^\d+#.+/.test(s)) {
      out.push(s);
      continue;
    }
    const [kata, ...sisa] = s.split(/\s+/);
    const h = hari.findIndex((d) => d.toLowerCase() === kata.toLowerCase());
    const pid = byNama.get(sisa.join(' ').toLowerCase());
    if (h >= 0 && pid) out.push(slotKey(h, pid));
  }
  return [...new Set(out)];
}

/**
 * Baca seluruh sheet template menjadi sebuah Project lengkap.
 * Mengembalikan `null` bila tidak ada satu pun sheet yang dikenali.
 * `jadwal` sengaja dikosongkan: referensi id berubah, jadwal lama tidak sah.
 *
 * Bila kolom wajib pada sebuah baris kosong / referensinya tidak ditemukan,
 * baris tersebut dibatalkan dan dicatat pada `galat` (impor dibatalkan oleh UI).
 */
export function bacaWorkbook(wb: XLSX.WorkBook, dasar: Project): HasilImporExcel | null {
  const dikenal = SHEET_DATA.some((n) => wb.SheetNames.includes(n));
  if (!dikenal) return null;

  let dilewati = 0;
  const galat: string[] = [];

  // 0. Hari (urutan hari aktif + konfigurasi JP khusus).
  const { hari, konfig } = bacaHari(wb, dasar.hari);

  // 1. Jam Pelajaran (dulu — dipakai resolving slot guru & batasan).
  const periode: Period[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.periode)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    if (!nama) {
      if (Object.values(r).some((v) => str(v))) {
        dilewati++;
        galat.push('Jam Pelajaran: ada baris tanpa "nama" jam.');
      }
      continue;
    }
    const { tipe, tipeKet } = bacaTipeWaktu(r);
    periode.push({
      id: uid('p'),
      nama,
      mulai: str(r['mulai']),
      selesai: str(r['selesai']),
      tipe,
      tipeKet,
    });
  }

  // Validasi: tanpa satu pun baris bertipe "pelajaran", generator pasti gagal
  // total (0 JP aktif). Lebih baik hentikan impor dengan pesan yang jelas.
  if (periode.length && !periode.some((p) => p.tipe === 'pelajaran')) {
    galat.push(
      'Jam Pelajaran: tidak ada baris bertipe "Pelajaran". Periksa kolom "tipe" — ' +
        'nilai yang dikenali: Pelajaran, Istirahat, Apel, Kustom (juga KBM/PBM untuk pelajaran). ' +
        'Generator tidak bisa menyusun jadwal tanpa JP bertipe Pelajaran.',
    );
  }

  // 1b. slotNonAktif per hari (nama JP → id periode).
  // Dicocokkan lewat NAMA hari (bukan indeks baris mentah) agar tetap benar
  // meski ada baris yang dilewati (nama kosong/duplikat/baris contoh).
  const periodeIdByName = new Map(periode.map((p) => [p.nama.toLowerCase(), p.id]));
  for (const r of barisSheet(wb, NAMA_SHEET.hari)) {
    if (barisContoh(r)) continue;
    const nama =
      str(r['nama']) || str(r['Nama Hari']) || str(r['Nama']) || str(r['hari']);
    const i = hari.indexOf(nama);
    if (i < 0) continue;
    konfig[i].slotNonAktif = str(r['slotNonAktif'])
      .split(/[;,]/)
      .map((x) => periodeIdByName.get(x.trim().toLowerCase()))
      .filter((x): x is string => Boolean(x));
  }

  // 2. Mata Pelajaran.
  const mapel: Subject[] = [];
  const cariMapel = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.mapel)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    if (!nama) {
      if (Object.values(r).some((v) => str(v))) {
        dilewati++;
        galat.push('Mata Pelajaran: ada baris tanpa "nama".');
      }
      continue;
    }
    const m: Subject = {
      id: uid('m'),
      nama,
      kode: str(r['kode']),
      tipeRuang: normalisasiTipe(r['tipeRuang'] ?? r['Tipe Ruang']),
      pilihan: ya(r['pilihan'] ?? r['Mapel Pilihan']),
    };
    mapel.push(m);
    cariMapel.set(nama.toLowerCase(), m.id);
    if (m.kode) cariMapel.set(m.kode.toLowerCase(), m.id);
  }
  const idMapel = (teks: string): string[] =>
    teks
      .split(/[;,]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => cariMapel.get(x.toLowerCase()))
      .filter((x): x is string => Boolean(x));

  // 3. Guru (butuh peta mapel).
  const guru: Teacher[] = [];
  const cariGuru = new Map<string, string>();
  let iGuru = 0;
  for (const r of barisSheet(wb, NAMA_SHEET.guru)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    if (!nama) {
      if (Object.values(r).some((v) => str(v))) {
        dilewati++;
        galat.push('Guru: ada baris tanpa "nama".');
      }
      continue;
    }
    const warna = str(r['warna']);
    const g: Teacher = {
      id: uid('g'),
      nama,
      kode: str(r['kode']),
      warna: hexValid(warna) ? warna : PALET_GURU[iGuru % PALET_GURU.length],
      mapelIds: [...new Set(idMapel(str(r['mapelIds'] ?? r['Mata Pelajaran'])))],
      maxJam: numPositif(r['maxJam'] ?? r['Maks Jam/Minggu'], 24),
      maxPerHari: numPositif(r['maxPerHari'] ?? r['Maks Jam/Hari'], 6),
      slotDiinginkan: parseSlotList(str(r['slotDiinginkan']), periode, hari),
      slotDilarang: parseSlotList(str(r['slotDilarang']), periode, hari),
      polaJP: parsePola(r['polaJP'] ?? r['Pola JP']),
      catatan: str(r['catatan']),
    };
    iGuru++;
    guru.push(g);
    cariGuru.set(nama.toLowerCase(), g.id);
    if (g.kode) cariGuru.set(g.kode.toLowerCase(), g.id);
  }

  // 4. Kelas.
  const kelas: SchoolClass[] = [];
  const cariKelas = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.kelas)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    if (!nama) {
      if (Object.values(r).some((v) => str(v))) {
        dilewati++;
        galat.push('Kelas: ada baris tanpa "nama".');
      }
      continue;
    }
    const c: SchoolClass = {
      id: uid('k'),
      nama,
      tingkat: str(r['tingkat']).toUpperCase() || 'X',
      waliKelasId:
        cariGuru.get(str(r['waliKelasId'] ?? r['Wali Kelas']).toLowerCase()) ?? '',
      jumlahSiswa: numPositif(r['jumlahSiswa'] ?? r['Jumlah Siswa'], 36),
    };
    kelas.push(c);
    cariKelas.set(nama.toLowerCase(), c.id);
  }

  // 5. Ruang.
  const ruang: Room[] = [];
  const cariRuang = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.ruang)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    if (!nama) {
      if (Object.values(r).some((v) => str(v))) {
        dilewati++;
        galat.push('Ruang: ada baris tanpa "nama".');
      }
      continue;
    }
    const x: Room = {
      id: uid('r'),
      nama,
      kapasitas: numPositif(r['kapasitas'], 40),
      tipe: normalisasiTipe(r['tipe']),
    };
    ruang.push(x);
    cariRuang.set(nama.toLowerCase(), x.id);
  }

  // 6. Siswa.
  const siswa: Student[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.siswa)) {
    if (barisContoh(r)) continue;
    const nama = str(r['nama']);
    const kelasId = cariKelas.get(str(r['kelasId'] ?? r['Kelas']).toLowerCase());
    if (!nama && !kelasId) continue;
    if (!nama || !kelasId) {
      if (nama) {
        dilewati++;
        galat.push(`Siswa "${nama}": kolom "kelasId" kosong atau kelas tidak ditemukan.`);
      }
      continue;
    }
    siswa.push({
      id: uid('s'),
      nama,
      kelasId,
      pilihan: idMapel(str(r['pilihan'] ?? r['Pilihan Mapel'])),
    });
  }

  // 7. Kebutuhan Jam.
  const kebutuhan: Requirement[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.kebutuhan)) {
    if (barisContoh(r)) continue;
    if (!Object.values(r).some((v) => str(v))) continue;
    const kelasId = cariKelas.get(str(r['kelasId'] ?? r['Kelas']).toLowerCase());
    const mapelId = cariMapel.get(
      str(r['mapelId'] ?? r['Mata Pelajaran']).toLowerCase(),
    );
    const guruId = cariGuru.get(str(r['guruId'] ?? r['Guru']).toLowerCase());
    if (!kelasId || !mapelId || !guruId) {
      dilewati++;
      const kurang = [
        !kelasId ? 'kelas' : '',
        !mapelId ? 'mapel' : '',
        !guruId ? 'guru' : '',
      ]
        .filter(Boolean)
        .join(', ');
      galat.push(`Kebutuhan Jam: referensi ${kurang} tidak ditemukan pada baris "${str(r['mapelId'] ?? r['Mata Pelajaran']) || '?'}".`);
      continue;
    }
    const teksRuang = str(r['ruangId'] ?? r['Ruang']);
    const ruangId =
      !teksRuang || /^otomatis$/i.test(teksRuang)
        ? ''
        : (cariRuang.get(teksRuang.toLowerCase()) ?? '');
    const jam = numPositif(r['jumlahJam'] ?? r['Jam/Minggu'], 0);
    if (!jam) {
      dilewati++;
      galat.push(`Kebutuhan Jam: "jumlahJam" wajib diisi (angka ≥ 1) untuk ${teksRuang || 'baris tanpa nama'}.`);
      continue;
    }
    kebutuhan.push({
      id: uid('kb'),
      kelasId,
      mapelId,
      guruId,
      ruangId,
      jumlahJam: jam,
      polaJP: parsePola(r['polaJP'] ?? r['Pola JP']),
    });
  }

  // 8. Batasan.
  const blokir: Block[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.blokir)) {
    if (barisContoh(r)) continue;
    if (!Object.values(r).some((v) => str(v))) continue;
    const jenisTeks = str(r['jenis'] ?? r['Jenis']).toLowerCase();
    const jenis: Block['jenis'] = jenisTeks.startsWith('guru')
      ? 'guru'
      : jenisTeks.startsWith('ruang')
        ? 'ruang'
        : 'kelas';
    const objekTeks = str(r['refId'] ?? r['Objek']).toLowerCase();
    const refId =
      jenis === 'kelas'
        ? (cariKelas.get(objekTeks) ?? '')
        : jenis === 'guru'
          ? (cariGuru.get(objekTeks) ?? '')
          : (cariRuang.get(objekTeks) ?? '');

    const teksHari = str(r['hari'] ?? r['Hari']);
    const hariIdx = /^\d+$/.test(teksHari)
      ? Number(teksHari)
      : hari.findIndex((d) => d.toLowerCase() === teksHari.toLowerCase());
    const teksJam = str(r['periodeId'] ?? r['Jam']);
    const periodeId =
      periode.find((p) => p.nama.toLowerCase() === teksJam.toLowerCase())?.id ?? '';

    if (!refId || hariIdx < 0 || hariIdx >= hari.length || !periodeId) {
      dilewati++;
      galat.push(
        `Batasan: baris untuk ${jenisTeks || '?'} "${str(r['refId'] ?? r['Objek']) || '?'}" tidak lengkap (objek/hari/jam tidak valid).`,
      );
      continue;
    }
    blokir.push({
      id: uid('b'),
      jenis,
      refId,
      hari: hariIdx,
      periodeId,
      alasan: str(r['alasan']),
    });
  }

  const project: Project = {
    ...dasar,
    hari,
    hariKonfig: konfig,
    periode,
    guru,
    kelas,
    siswa,
    mapel,
    ruang,
    kebutuhan,
    jadwal: [],
    blokir,
  };

  return {
    project,
    jumlah: {
      hari: hari.length,
      guru: guru.length,
      kelas: kelas.length,
      siswa: siswa.length,
      mapel: mapel.length,
      ruang: ruang.length,
      periode: periode.length,
      kebutuhan: kebutuhan.length,
      blokir: blokir.length,
    },
    dilewati,
    galat,
  };
}

// ---------------------------------------------------------------------------
// 3. Ekspor tabel rapi (bukan JSON): lembar "Jadwal" dengan urutan kolom tetap
// ---------------------------------------------------------------------------

/** Kolom lembar Jadwal hasil ekspor — urutan wajib tetap. */
export const HEADER_JADWAL = [
  'Hari',
  'Jam Mulai',
  'Jam Selesai',
  'Kelas',
  'Mapel',
  'Guru',
  'Ruang',
] as const;

/**
 * Ekspor seluruh jadwal ke lembar Excel berbentuk tabel rapi (bukan JSON),
 * diurutkan per hari → jam → kelas.
 *
 * Di baris paling atas disisipkan KOP SEKOLAH (nama sekolah + tahun ajaran),
 * lalu satu baris kosong, baru header tabel jadwal. Baris kop di-merge dari
 * kolom A sampai G agar tampil rapi di tengah. Logo tidak disertakan di Excel
 * (cukup teks identitas) supaya berkas tetap ringan.
 */
export function jadwalKeXlsx(project: Project): Uint8Array {
  const namaMapel = new Map(project.mapel.map((m) => [m.id, m.nama]));
  const namaGuru = new Map(project.guru.map((g) => [g.id, g.nama]));
  const namaKelas = new Map(project.kelas.map((c) => [c.id, c.nama]));
  const namaRuang = new Map(project.ruang.map((r) => [r.id, r.nama]));
  const perM = new Map(project.periode.map((p) => [p.id, p]));
  const urutPer = new Map(project.periode.map((p, i) => [p.id, i]));

  const sorted = [...project.jadwal].sort(
    (a, b) =>
      a.hari - b.hari ||
      (urutPer.get(a.periodeId) ?? 99) - (urutPer.get(b.periodeId) ?? 99) ||
      (namaKelas.get(a.kelasId) ?? '').localeCompare(namaKelas.get(b.kelasId) ?? ''),
  );

  const kolom = HEADER_JADWAL.length; // 7 (A..G)
  const kolomAkhir = String.fromCharCode('A'.charCodeAt(0) + kolom - 1); // 'G'

  // Baris 1: nama sekolah · baris 2: alamat (opsional) · baris 3: tahun ajaran
  const namaSekolah = project.info.nama || 'NAMA SEKOLAH';
  const tahunAjaran = project.info.tahunAjaran || '—';
  const alamat = project.info.alamat?.trim();

  const aoa: Sel[] = [
    [namaSekolah],
    ...(alamat ? [[alamat]] : []),
    [`Tahun Ajaran: ${tahunAjaran}`],
    [], // baris kosong
    [...HEADER_JADWAL],
    ...sorted.map((j) => {
      const per = perM.get(j.periodeId);
      return [
        project.hari[j.hari] ?? '',
        per?.mulai ?? '',
        per?.selesai ?? '',
        namaKelas.get(j.kelasId) ?? '',
        namaMapel.get(j.mapelId) ?? '',
        namaGuru.get(j.guruId) ?? '',
        j.ruangId ? (namaRuang.get(j.ruangId) ?? '') : 'Otomatis',
      ];
    }),
  ];

  // Nomor baris 1-based tempat header tabel berada (mengikuti kop yang disisipkan).
  const barisKop = alamat ? 3 : 2;
  const barisHeader = barisKop + 2; // kop + 1 baris kosong + 1 = header

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = lebarKolom(aoa[barisHeader - 1] ?? [], aoa.slice(barisHeader));
  // Merge baris kop dari kolom A sampai G (rata tengah di pratinjau Excel).
  const merges: XLSX.Range[] = [];
  for (let r = 1; r <= barisKop; r++) {
    merges.push({ s: { r: r - 1, c: 0 }, e: { r: r - 1, c: kolom - 1 } });
  }
  ws['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws, 'Jadwal');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}
