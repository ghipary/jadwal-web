// Fitur Excel massal (library SheetJS `xlsx`):
// 1. buatTemplateXlsx — meng-generate template .xlsx dengan 8 sheet terpisah
// 2. bacaWorkbook     — membaca semua sheet & menyusun objek Project lengkap

import * as XLSX from 'xlsx';
import {
  Block,
  DAYS,
  LABEL_TIPE_RUANG,
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
} from './types';
import { uid } from './utils';

/** Nama-nama sheet yang dikenali (harus sama antara template & pembaca). */
export const NAMA_SHEET = {
  guru: 'Guru',
  kelas: 'Kelas',
  siswa: 'Siswa',
  mapel: 'Mata Pelajaran',
  ruang: 'Ruang',
  periode: 'Jam Pelajaran',
  kebutuhan: 'Kebutuhan Jam',
  blokir: 'Batasan',
} as const;

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

/** Susun workbook template 8 sheet berisi header + data proyek saat ini. */
export function buatTemplateXlsx(project: Project): Uint8Array {
  const wb = XLSX.utils.book_new();

  const add = (nama: string, header: Sel, baris: Sel[]) => {
    const ws = XLSX.utils.aoa_to_sheet([header, ...baris]);
    ws['!cols'] = lebarKolom(header, baris);
    XLSX.utils.book_append_sheet(wb, ws, nama);
  };

  const periodeNama = new Map(project.periode.map((p) => [p.id, p.nama]));
  const formatSlot = (k: SlotKey): string => {
    const { hari, periodeId } = parseSlotKey(k);
    const nama = periodeNama.get(periodeId);
    return nama ? `${DAYS[hari] ?? ''} ${nama}` : k;
  };
  const slotTeks = (arr: SlotKey[]) => arr.map(formatSlot).join('; ');

  const namaMapel = new Map(project.mapel.map((m) => [m.id, m.nama]));
  const namaGuru = new Map(project.guru.map((g) => [g.id, g.nama]));
  const namaKelas = new Map(project.kelas.map((c) => [c.id, c.nama]));
  const namaRuang = new Map(project.ruang.map((r) => [r.id, r.nama]));
  const tipeTeks = (t: string) => LABEL_TIPE_RUANG[t] ?? t;
  const yaTidak = (b: boolean) => (b ? 'Ya' : 'Tidak');

  add(
    NAMA_SHEET.guru,
    ['Kode', 'Nama', 'Warna', 'Mata Pelajaran', 'Maks Jam/Minggu', 'Maks Jam/Hari', 'Slot Diinginkan', 'Slot Dilarang', 'Catatan'],
    project.guru.map((g) => [
      g.kode,
      g.nama,
      g.warna,
      g.mapelIds.map((id) => namaMapel.get(id) ?? '(terhapus)').join('; '),
      g.maxJam,
      g.maxPerHari,
      slotTeks(g.slotDiinginkan),
      slotTeks(g.slotDilarang),
      g.catatan,
    ]),
  );

  add(
    NAMA_SHEET.kelas,
    ['Nama', 'Tingkat', 'Wali Kelas', 'Jumlah Siswa'],
    project.kelas.map((c) => [
      c.nama,
      c.tingkat,
      namaGuru.get(c.waliKelasId) ?? '',
      c.jumlahSiswa,
    ]),
  );

  add(
    NAMA_SHEET.siswa,
    ['Nama', 'Kelas', 'Pilihan Mapel'],
    project.siswa.map((s) => [
      s.nama,
      namaKelas.get(s.kelasId) ?? '',
      s.pilihan.map((id) => namaMapel.get(id) ?? '?').join('; '),
    ]),
  );

  add(
    NAMA_SHEET.mapel,
    ['Kode', 'Nama', 'Tipe Ruang', 'Mapel Pilihan'],
    project.mapel.map((m) => [m.kode, m.nama, tipeTeks(m.tipeRuang), yaTidak(m.pilihan)]),
  );

  add(
    NAMA_SHEET.ruang,
    ['Nama', 'Tipe', 'Kapasitas'],
    project.ruang.map((r) => [r.nama, tipeTeks(r.tipe), r.kapasitas]),
  );

  add(
    NAMA_SHEET.periode,
    ['Nama', 'Mulai', 'Selesai', 'Istirahat'],
    project.periode.map((p) => [p.nama, p.mulai, p.selesai, yaTidak(p.istirahat)]),
  );

  add(
    NAMA_SHEET.kebutuhan,
    ['Kelas', 'Mata Pelajaran', 'Guru', 'Ruang', 'Jam/Minggu'],
    project.kebutuhan.map((k) => [
      namaKelas.get(k.kelasId) ?? '',
      namaMapel.get(k.mapelId) ?? '',
      namaGuru.get(k.guruId) ?? '',
      k.ruangId ? (namaRuang.get(k.ruangId) ?? '') : 'Otomatis',
      k.jumlahJam,
    ]),
  );

  add(
    NAMA_SHEET.blokir,
    ['Jenis', 'Objek', 'Hari', 'Jam', 'Alasan'],
    project.blokir.map((b) => [
      b.jenis === 'kelas' ? 'Kelas' : b.jenis === 'guru' ? 'Guru' : 'Ruang',
      b.jenis === 'kelas'
        ? (namaKelas.get(b.refId) ?? '')
        : b.jenis === 'guru'
          ? (namaGuru.get(b.refId) ?? '')
          : (namaRuang.get(b.refId) ?? ''),
      DAYS[b.hari] ?? '',
      periodeNama.get(b.periodeId) ?? '',
      b.alasan,
    ]),
  );

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// 2. Pembaca workbook
// ---------------------------------------------------------------------------

export interface JumlahImpor {
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
}

export async function bacaBerkasExcel(f: File): Promise<XLSX.WorkBook> {
  const buf = await f.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

function barisSheet(wb: XLSX.WorkBook, nama: string): Record<string, unknown>[] {
  const ws = wb.Sheets[nama];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

function str(v: unknown): string {
  return v === undefined || v === null ? '' : String(v).trim();
}

function num(v: unknown, bawaan: number): number {
  const n = Number(str(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : bawaan;
}

function ya(v: unknown): boolean {
  return /^(ya|y|1|true|yes)$/i.test(str(v));
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

/** "Senin Jam ke-1; Selasa Jam ke-2" (atau format mentah "0#p1") → SlotKey[]. */
function parseSlotList(teks: string, periode: Period[]): SlotKey[] {
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
    const h = DAYS.findIndex((d) => d.toLowerCase() === kata.toLowerCase());
    const pid = byNama.get(sisa.join(' ').toLowerCase());
    if (h >= 0 && pid) out.push(slotKey(h, pid));
  }
  return [...new Set(out)];
}

/**
 * Baca seluruh sheet template menjadi sebuah Project lengkap.
 * Mengembalikan `null` bila tidak ada satu pun sheet yang dikenali.
 * `jadwal` sengaja dikosongkan: referensi id berubah, jadwal lama tidak sah.
 */
export function bacaWorkbook(wb: XLSX.WorkBook, dasar: Project): HasilImporExcel | null {
  const dikenal = Object.values(NAMA_SHEET).some((n) => wb.SheetNames.includes(n));
  if (!dikenal) return null;

  let dilewati = 0;

  // 1. Jam Pelajaran (dulu — dipakai resolving slot guru & batasan).
  const periode: Period[] = barisSheet(wb, NAMA_SHEET.periode)
    .filter((r) => str(r['Nama']))
    .map((r) => ({
      id: uid('p'),
      nama: str(r['Nama']),
      mulai: str(r['Mulai']),
      selesai: str(r['Selesai']),
      istirahat: ya(r['Istirahat']),
    }));

  // 2. Mata Pelajaran.
  const mapel: Subject[] = [];
  const cariMapel = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.mapel)) {
    const nama = str(r['Nama']);
    if (!nama) continue;
    const m: Subject = {
      id: uid('m'),
      nama,
      kode: str(r['Kode']),
      tipeRuang: normalisasiTipe(r['Tipe Ruang']),
      pilihan: ya(r['Mapel Pilihan']),
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
  barisSheet(wb, NAMA_SHEET.guru).forEach((r, i) => {
    const nama = str(r['Nama']);
    if (!nama) return;
    const warna = str(r['Warna']);
    const g: Teacher = {
      id: uid('g'),
      nama,
      kode: str(r['Kode']),
      warna: hexValid(warna) ? warna : PALET_GURU[i % PALET_GURU.length],
      mapelIds: [...new Set(idMapel(str(r['Mata Pelajaran'])))],
      maxJam: num(r['Maks Jam/Minggu'], 24),
      maxPerHari: num(r['Maks Jam/Hari'], 6),
      slotDiinginkan: parseSlotList(str(r['Slot Diinginkan']), periode),
      slotDilarang: parseSlotList(str(r['Slot Dilarang']), periode),
      catatan: str(r['Catatan']),
    };
    guru.push(g);
    cariGuru.set(nama.toLowerCase(), g.id);
    if (g.kode) cariGuru.set(g.kode.toLowerCase(), g.id);
  });

  // 4. Kelas.
  const kelas: SchoolClass[] = [];
  const cariKelas = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.kelas)) {
    const nama = str(r['Nama']);
    if (!nama) continue;
    const c: SchoolClass = {
      id: uid('k'),
      nama,
      tingkat: str(r['Tingkat']).toUpperCase() || 'X',
      waliKelasId: cariGuru.get(str(r['Wali Kelas']).toLowerCase()) ?? '',
      jumlahSiswa: num(r['Jumlah Siswa'], 36),
    };
    kelas.push(c);
    cariKelas.set(nama.toLowerCase(), c.id);
  }

  // 5. Ruang.
  const ruang: Room[] = [];
  const cariRuang = new Map<string, string>();
  for (const r of barisSheet(wb, NAMA_SHEET.ruang)) {
    const nama = str(r['Nama']);
    if (!nama) continue;
    const x: Room = {
      id: uid('r'),
      nama,
      kapasitas: num(r['Kapasitas'], 40),
      tipe: normalisasiTipe(r['Tipe']),
    };
    ruang.push(x);
    cariRuang.set(nama.toLowerCase(), x.id);
  }

  // 6. Siswa.
  const siswa: Student[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.siswa)) {
    const nama = str(r['Nama']);
    const kelasId = cariKelas.get(str(r['Kelas']).toLowerCase());
    if (!nama || !kelasId) {
      if (nama) dilewati++;
      continue;
    }
    siswa.push({
      id: uid('s'),
      nama,
      kelasId,
      pilihan: idMapel(str(r['Pilihan Mapel'])),
    });
  }

  // 7. Kebutuhan Jam.
  const kebutuhan: Requirement[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.kebutuhan)) {
    const kelasId = cariKelas.get(str(r['Kelas']).toLowerCase());
    const mapelId = cariMapel.get(str(r['Mata Pelajaran']).toLowerCase());
    const guruId = cariGuru.get(str(r['Guru']).toLowerCase());
    if (!kelasId || !mapelId || !guruId) {
      if (Object.values(r).some((v) => str(v))) dilewati++;
      continue;
    }
    const teksRuang = str(r['Ruang']);
    const ruangId =
      !teksRuang || /^otomatis$/i.test(teksRuang) ? '' : (cariRuang.get(teksRuang.toLowerCase()) ?? '');
    kebutuhan.push({
      id: uid('kb'),
      kelasId,
      mapelId,
      guruId,
      ruangId,
      jumlahJam: num(r['Jam/Minggu'], 1),
    });
  }

  // 8. Batasan.
  const blokir: Block[] = [];
  for (const r of barisSheet(wb, NAMA_SHEET.blokir)) {
    const jenisTeks = str(r['Jenis']).toLowerCase();
    const jenis: Block['jenis'] = jenisTeks.startsWith('guru')
      ? 'guru'
      : jenisTeks.startsWith('ruang')
        ? 'ruang'
        : 'kelas';
    const objekTeks = str(r['Objek']).toLowerCase();
    const refId =
      jenis === 'kelas'
        ? (cariKelas.get(objekTeks) ?? '')
        : jenis === 'guru'
          ? (cariGuru.get(objekTeks) ?? '')
          : (cariRuang.get(objekTeks) ?? '');

    const teksHari = str(r['Hari']);
    const hariIdx = /^\d+$/.test(teksHari)
      ? Number(teksHari)
      : DAYS.findIndex((d) => d.toLowerCase() === teksHari.toLowerCase());
    const teksJam = str(r['Jam']);
    const periodeId =
      periode.find((p) => p.nama.toLowerCase() === teksJam.toLowerCase())?.id ?? '';

    if (!refId || hariIdx < 0 || hariIdx >= DAYS.length || !periodeId) {
      if (Object.values(r).some((v) => str(v))) dilewati++;
      continue;
    }
    blokir.push({
      id: uid('b'),
      jenis,
      refId,
      hari: hariIdx,
      periodeId,
      alasan: str(r['Alasan']),
    });
  }

  const project: Project = {
    ...dasar,
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
  };
}
