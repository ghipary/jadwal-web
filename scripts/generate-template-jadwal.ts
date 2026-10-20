// ---------------------------------------------------------------------------
// Generator template Excel dari berkas mentah sekolah.
//
// Masukan (berkas Excel mentah sekolah):
//   1. "DATA JADWAL FIX/Jadwal SMA JP SMT 2.xlsx"  — matriks ploating guru
//      (baris = guru+mapel, kolom = kelas, isi sel = jumlah JP).
//   2. "DATA JADWAL FIX/Template kendala.xlsx"     — aturan tiap guru (MAX JP /
//      HARI, dll).
//   3. "DATA JADWAL FIX/Jadwal SMA SMT 2 (Template).xlsx" — susunan PUKUL jam
//      tiap hari. Jam pelajaran BERBEDA per hari: Senin diawali Apel dan
//      Persiapan lebih lama (7 JP), Jumat hanya 5 JP, Selasa–Kamis & Sabtu
//      8 JP. Istirahat Jumat juga beda (09:00–09:20). Sheet "Jam Pelajaran"
//      dan kolom maksJP pada sheet "Hari" diisi dari berkas ini.

// Keluaran (siap diunggah ke aplikasi: menu Hasil → Berkas & Data):
//   "Template jadwal-sma_nusantara-2026-10-19.xlsx" + versi .tsv
//
// ATURAN PEMETAAN (lihat catatan pada tiap bagian):
//   • Sheet "Guru"           : kode 1..N dari matriks, nama, mapelIds (kode
//                              ringkas mapel), maxJam (total JP matriks),
//                              maxPerHari (dari berkas kendala). slotDiinginkan
//                              & slotDilarang sengaja DIKOSONGKAN.
//   • Sheet "Kebutuhan Jam"  : satu baris per sel matriks berangka > 0.
//   • Sheet "Mata Pelajaran" : diperlukan pembaca (mapel dicocokkan lewat kode).
//   • Sheet "Kelas"/"Jam"/"Hari": disintesis dari data matriks.
//   • Sheet "Log"            : temuan/peringatan, DIABAIKAN saat impor.
//
// Jalankan (dari folder jadwal-web):
//   npx esbuild scripts/generate-template-jadwal.ts --bundle --platform=node \
//     --format=cjs --outfile=temp/generate-template-jadwal.cjs --log-level=warning
//   node temp/generate-template-jadwal.cjs
//
// Opsi:
//   node temp/generate-template-jadwal.cjs --no-pola
//     → kolom polaJP pada sheet "Kebutuhan Jam" dikosongkan. HASIL UJI:
//       dengan polaJP = jumlahJam, generator hanya menempatkan 384/528 JP
//       (32 baris gagal); tanpa polaJP berhasil 528/528 JP tanpa konflik.
//     → berkas keluaran diberi akhiran "-nopola".
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as XLSX from 'xlsx';

/** Penanda tarik akar proyek: langsung dikenali XLSX.read (tidak perlu bundling
 *  seluruh src/excel.ts yang bertipe browser). */
const AKAR = resolve(process.env.JADWAL_ROOT ?? process.cwd());

const BERKAS_MATRIKS = resolve(AKAR, 'DATA JADWAL FIX/Jadwal SMA JP SMT 2.xlsx');
const BERKAS_KENDALA = resolve(AKAR, 'DATA JADWAL FIX/Template kendala.xlsx');
/** Berkas acuan jam pelajaran — susunan PUKUL per hari yang BENAR ada di
 *  "Jadwal SMA SMT 2 (Template).xlsx": Apel dan Persiapan, Istirahat,
 *  Jama'ah Dhuhur, dan jam Jumat yang lebih pendek (5 JP). */
const BERKAS_ACUAN_JAM = resolve(AKAR, 'DATA JADWAL FIX/Jadwal SMA SMT 2 (Template).xlsx');
const BERKAS_KELUARAN = resolve(
  AKAR,
  'DATA JADWAL FIX/Template jadwal-sma_nusantara-2026-10-19' +
    (process.argv.includes('--no-pola') ? '-nopola' : '') +
    '.xlsx',
);

/** Opsi CLI: --no-pola mengosongkan kolom polaJP pada sheet Kebutuhan Jam. */
const TANPA_POLA = process.argv.includes('--no-pola');

/**
 * Guru yang sengaja TIDAK diikutkan ke berkas keluaran (mis. sudah tidak
 * mengajar / tidak ada beban JP). Dicocokkan dengan nama ternormalisasi.
 * Penghapusan ini tetap dilaporkan di sheet "Log".
 */
const GURU_DIKECUALIKAN = ['Abdurrahman Al-Ghifari'];

/** Nama sheet — HARUS sama dengan NAMA_SHEET di src/excel.ts. */
const SHEET = {
  petunjuk: 'Petunjuk',
  hari: 'Hari',
  guru: 'Guru',
  kelas: 'Kelas',
  siswa: 'Siswa',
  mapel: 'Mata Pelajaran',
  periode: 'Jam Pelajaran',
  kebutuhan: 'Kebutuhan Jam',
  log: 'Log',
} as const;

/** Judul kolom — memakai nama key state persis seperti HEADER di src/excel.ts. */
const HEADER = {
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
  mapel: ['kode', 'nama', 'pilihan'],
  periode: ['nama', 'mulai', 'selesai', 'tipe', 'tipeKet', 'hariAktif'],
  kebutuhan: ['kelasId', 'mapelId', 'guruId', 'jumlahJam', 'polaJP'],
  log: ['jenis', 'pesan'],
} as const;

/** Palet warna guru — disalin dari PALET_GURU (src/types.ts). */
const PALET_GURU = [
  '#4f46e5', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981',
  '#ef4444', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#a855f7',
];

// ---------------------------------------------------------------------------
// Normalisasi nama & pencocokan longgar
// ---------------------------------------------------------------------------

/** "Musri'atun Nikmah, S.E." → "musriatunnikmahse" (buang tanda baca & spasi). */
function norm(s: unknown): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

/** Kemiripan dua string ternormalisasi (0..1) — dipakai sebagai cadangan. */
function mirip(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.95;
  const baris = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) baris[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let sudut = baris[0];
    baris[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = baris[j];
      baris[j] = Math.min(
        baris[j] + 1,
        baris[j - 1] + 1,
        sudut + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      sudut = tmp;
    }
  }
  return 1 - baris[b.length] / Math.max(a.length, b.length);
}

// ---------------------------------------------------------------------------
// 1. Peta kode mapel (singkatan)
// ---------------------------------------------------------------------------

/** Nama mapel pada matriks → kode ringkas yang dipakai sheet Guru & Kebutuhan. */
const KODE_MAPEL: { cocok: string; kode: string }[] = [
  { cocok: 'MATEMATIKA LANJUT', kode: 'MTL' },
  { cocok: 'MATEMATIKA', kode: 'MTK' },
  { cocok: 'B. INGGRIS LANJUT', kode: 'BITL' },
  { cocok: 'B. INGGRIS', kode: 'BING' },
  { cocok: 'B. INDONESIA', kode: 'BIND' },
  { cocok: 'BAHASA INDONESIA', kode: 'BIND' },
  { cocok: 'FISIKA', kode: 'FIS' },
  { cocok: 'KIMIA', kode: 'KIM' },
  { cocok: 'BIOLOGI', kode: 'BIO' },
  { cocok: 'SEJARAH', kode: 'SEJ' },
  { cocok: 'EKONOMI', kode: 'EKO' },
  { cocok: 'GEOGRAFI', kode: 'GEO' },
  { cocok: 'SOSIOLOGI', kode: 'SOS' },
  { cocok: 'PEND. PANCASILA', kode: 'PPKn' },
  { cocok: 'PENDIDIKAN PANCASILA', kode: 'PPKn' },
  { cocok: 'PAI', kode: 'PAI' },
  { cocok: 'PENDIDIKAN AGAMA', kode: 'PAI' },
  { cocok: 'PJOK', kode: 'PJOK' },
  { cocok: 'INFORMATIKA', kode: 'INF' },
  { cocok: 'SENI BUDAYA', kode: 'SEN' },
  { cocok: 'PKWU', kode: 'PKWU' },
  { cocok: 'B. ARAB', kode: 'BAR' },
  { cocok: 'BAHASA ARAB', kode: 'BAR' },
  { cocok: 'PEND. WAHIDIYAH', kode: 'PW' },
];

/** Kode ringkas bila nama mapel tak ada di daftar: inisial kata, maks 4 huruf. */
function kodeFallback(nama: string): string {
  const inisial = nama
    .replace(/^(PEND|PENDIDIKAN)\.?\s+/i, '')
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return inisial || 'MAPEL';
}

const petaKode = new Map<string, string>();
for (const { cocok, kode } of KODE_MAPEL) petaKode.set(cocok, kode);

function kodeMapel(namaAsli: string): string {
  const key = namaAsli.trim().toUpperCase().replace(/\s+/g, ' ');
  return petaKode.get(key) ?? kodeFallback(namaAsli);
}

// ---------------------------------------------------------------------------
// 2. Baca matriks ploating
// ---------------------------------------------------------------------------

interface BarisMatriks {
  no: number | null;
  nama: string;
  mapelNama: string;
  kodeMapel: string;
  /** nama kolom kelas → jumlah JP (hanya yang > 0). */
  perKelas: { kelas: string; jam: number }[];
  total: number;
}

/** Judul kolom kelas bisa bergeser; cari baris header yang memuat "NO". */
function cariBarisHeader(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const baris = (aoa[i] ?? []).map((v) => String(v ?? '').trim().toUpperCase());
    if (baris.includes('NO') && baris.includes('NAMA') && baris.includes('MATA PELAJARAN')) {
      return i;
    }
  }
  return -1;
}

function bacaMatriks(): { baris: BarisMatriks[]; kelas: string[] } {
  const wb = XLSX.read(readFileSync(BERKAS_MATRIKS), { type: 'buffer' });
  // Sheet pertama adalah versi terlengkap ("Sheet1 (2)" pada berkas ini).
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const iHeader = cariBarisHeader(aoa);
  if (iHeader < 0) {
    throw new Error('Matriks: baris header (NO / NAMA / MATA PELAJARAN) tidak ditemukan.');
  }
  const header = (aoa[iHeader] ?? []).map((v) => String(v ?? '').trim());
  const iNo = header.findIndex((h) => h.toUpperCase() === 'NO');
  const iNama = header.findIndex((h) => h.toUpperCase() === 'NAMA');
  const iMapel = header.findIndex((h) => h.toUpperCase() === 'MATA PELAJARAN');

  // Kolom kelas = seluruh kolom berjudul seperti "X-1", "XI-2", "XII-4".
  const kolomKelas: { idx: number; nama: string }[] = [];
  header.forEach((h, idx) => {
    if (/^(X|XI|XII)-\d+$/i.test(h.trim())) {
      kolomKelas.push({ idx, nama: h.trim().toUpperCase() });
    }
  });
  if (!kolomKelas.length) throw new Error('Matriks: kolom kelas (X-1, XI-1, …) tidak ditemukan.');

  const baris: BarisMatriks[] = [];
  for (let r = iHeader + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const nama = String(row[iNama] ?? '').trim();
    const mapelNama = String(row[iMapel] ?? '').trim().replace(/\s+/g, ' ');
    if (!nama && !mapelNama) continue; // baris kosong / baris "JML"
    if (!mapelNama) continue;

    const noMentah = row[iNo];
    const no =
      noMentah === '' || noMentah === null || noMentah === undefined
        ? null
        : Number(noMentah);

    const perKelas: { kelas: string; jam: number }[] = [];
    let total = 0;
    for (const { idx, nama: namaKelas } of kolomKelas) {
      const v = row[idx];
      const jam = typeof v === 'number' ? v : Number(String(v ?? '').trim() || NaN);
      if (Number.isFinite(jam) && jam > 0) {
        perKelas.push({ kelas: namaKelas, jam });
        total += jam;
      }
    }
    baris.push({ no: Number.isFinite(no as number) ? no : null, nama, mapelNama, kodeMapel: kodeMapel(mapelNama), perKelas, total });
  }

  return { baris, kelas: kolomKelas.map((k) => k.nama) };
}

// ---------------------------------------------------------------------------
// 3. Baca berkas kendala
// ---------------------------------------------------------------------------

interface Kendala {
  /** Nama guru tanpa keterangan mapel dalam tanda kurung. */
  nama: string;
  mapelKet: string;
  maxPerHari: number | null;
  totalJP: number | null;
  hariTidakTersedia: string;
  waktuTidakTersedia: string;
  catatan: string;
  baris: number;
}

function bacaKendala(): Kendala[] {
  const wb = XLSX.read(readFileSync(BERKAS_KENDALA), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  const out: Kendala[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const mentah = String(row[0] ?? '').trim();
    if (!mentah) continue;
    // "Nama, S.Pd. (MAPEL)" → nama + keterangan mapel.
    const m = mentah.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const nama = (m ? m[1] : mentah).trim();
    const mapelKet = (m ? m[2] : '').trim();
    const angka = (v: unknown): number | null => {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').trim() || NaN);
      return Number.isFinite(n) ? n : null;
    };
    out.push({
      nama,
      mapelKet,
      maxPerHari: angka(row[2]),
      totalJP: angka(row[1]),
      hariTidakTersedia: String(row[3] ?? '').trim(),
      waktuTidakTersedia: String(row[4] ?? '').trim(),
      catatan: String(row[5] ?? '').trim(),
      baris: r + 1,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3b. Baca jam pelajaran acuan (Jadwal SMA.xlsx)
// ---------------------------------------------------------------------------
//
// Berkas acuan memuat tabel: kolom A = hari (hanya terisi pada baris pertama),
// kolom B = "06.30 - 07.40", kolom C..N = kelas. Baris yang isinya sama untuk
// SEMUA kelas (hanya kolom C terisi) dan bukan kode pelajaran = baris waktu
// bersama (APEL DAN PERSIAPAN, ISTIRAHAT, JAMA'AH DHUHUR). Jam pelajaran
// sesungguhnya berbeda tiap hari: Senin Apel-nya lebih lama (7 JP), Jumat
// hanya 5 JP, Selasa–Kamis & Sabtu 8 JP.

interface BarisJam {
  hari: string;
  mulai: string;
  selesai: string;
  /** "pelajaran" | "istirahat" | "apel" | "kustom" (lihat TipeWaktu aplikasi). */
  tipe: string;
  /** Keterangan untuk tipe kustom (mis. "Jama'ah Dhuhur"). */
  tipeKet: string;
  /** Nama baris pada matriks asli, mis. "APEL DAN PERSIAPAN" / "ISTIRAHAT". */
  label: string;
}

/** "06.30 - 07.40" → { mulai: "06:30", selesai: "07:40" }. */
function pecahPukul(teks: unknown): { mulai: string; selesai: string } | null {
  const m = String(teks ?? '').match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const dua = (a: string, b: string) => `${a.padStart(2, '0')}:${b}`;
  return { mulai: dua(m[1], m[2]), selesai: dua(m[3], m[4]) };
}

/** Baris jam bersama (Apel/Istirahat/Dhuhur) yang seragam untuk semua kelas. */
const PENANDA_WAKTU: { uji: RegExp; tipe: string; tipeKet: string }[] = [
  { uji: /^apel/i, tipe: 'apel', tipeKet: '' },
  { uji: /^upacara/i, tipe: 'apel', tipeKet: '' },
  { uji: /^istirahat/i, tipe: 'istirahat', tipeKet: '' },
  { uji: /jama'?ah\s*dhuhur|dhuhur|dzuhur/i, tipe: 'kustom', tipeKet: "Jama'ah Dhuhur" },
  { uji: /^(senam|sholat|doa)/i, tipe: 'kustom', tipeKet: '' },
];

function bacaAcuanJam(): BarisJam[] {
  const wb = XLSX.read(readFileSync(BERKAS_ACUAN_JAM), { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  // Cari baris header (memuat "HARI" dan "PUKUL").
  let iHeader = -1;
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const baris = (aoa[i] ?? []).map((v) => String(v ?? '').trim().toUpperCase());
    if (baris.includes('HARI') && baris.includes('PUKUL')) {
      iHeader = i;
      break;
    }
  }
  if (iHeader < 0) {
    throw new Error('Berkas acuan jam: baris header (HARI / PUKUL) tidak ditemukan.');
  }
  const header = aoa[iHeader] ?? [];
  const iKolomPertamaKelas = header.findIndex((h) => /^(X|XI|XII)-\d+$/i.test(String(h ?? '').trim()));
  const kolomKelasAwal = iKolomPertamaKelas > 0 ? iKolomPertamaKelas : 2;
  // Kolom kelas berurutan sampai kolom non-kelas pertama (mis. "KODE").
  let kolomKelasAkhir = kolomKelasAwal;
  while (
    kolomKelasAkhir + 1 < header.length &&
    /^(X|XI|XII)-\d+$/i.test(String(header[kolomKelasAkhir + 1] ?? '').trim())
  ) {
    kolomKelasAkhir++;
  }

  const out: BarisJam[] = [];
  let hariSekarang = '';
  for (let r = iHeader + 1; r < aoa.length; r++) {
    const row = aoa[r] ?? [];
    const namaHari = String(row[0] ?? '').trim();
    if (namaHari) hariSekarang = namaHari;
    if (!hariSekarang) continue;

    const pukul = pecahPukul(row[1]);
    if (!pukul) continue;
    if (/^(PUKUL|HARI)$/i.test(String(row[1] ?? '').trim())) continue;

    // Nilai tiap kolom kelas pada baris ini.
    const isiKelas: string[] = [];
    for (let c = kolomKelasAwal; c <= kolomKelasAkhir; c++) {
      isiKelas.push(String(row[c] ?? '').trim());
    }
    const unik = [...new Set(isiKelas.filter((v) => v !== ''))];
    const seragam = unik.length === 1;

    let label = seragam ? unik[0] : '';
    const penanda = seragam ? PENANDA_WAKTU.find((p) => p.uji.test(label)) : undefined;

    if (penanda) {
      out.push({
        hari: hariSekarang,
        ...pukul,
        tipe: penanda.tipe,
        tipeKet: penanda.tipeKet || (penanda.tipe === 'kustom' ? label : ''),
        label: label.toUpperCase(),
      });
    } else {
      out.push({
        hari: hariSekarang,
        ...pukul,
        tipe: 'pelajaran',
        tipeKet: '',
        label: '',
      });
    }
  }
  if (!out.length) throw new Error('Berkas acuan jam: tidak ada baris jam yang terbaca.');
  return out;
}

/** Urutan hari baku pada matriks (dipakai untuk menomori hariAktif). */
const URUTAN_HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

/**
 * Susun sheet "Jam Pelajaran" dari berkas acuan: satu baris per (nama jam ×
 * himpunan hari). Jam yang pukul & labelnya sama digabung, hari-harinya
 * ditulis pada kolom hariAktif. Nama jam dinomori per hari ("Jam ke-1"…)
 * mengikuti urutan kemunculan jam pelajaran pada hari itu.
 */
function daftarJamDariAcuan(): Sel[] {
  const acuan = bacaAcuanJam();

  // Gabungkan baris yang identik (pukul + label) → kumpulkan hari-harinya.
  // Nama jam memakai PUKUL (bukan nomor "Jam ke-N") karena nomor JP berbeda
  // antar hari: 07:15–08:00 adalah JP ke-1 pada Senin (setelah Upacara) tetapi
  // JP ke-2 pada hari lain. Pukul membuat tiap baris tidak ambigu.
  const kunci = (b: BarisJam) => `${b.mulai}|${b.selesai}|${b.label}|${b.tipeKet}`;
  const urut: string[] = [];
  const gabung = new Map<string, { b: BarisJam; hari: string[]; nama: string }>();
  for (const item of acuan) {
    const k = kunci(item);
    let entri = gabung.get(k);
    if (!entri) {
      const nama =
        item.tipe === 'pelajaran'
          ? `${item.mulai}–${item.selesai}`
          : item.tipeKet || item.label.charAt(0) + item.label.slice(1).toLowerCase();
      entri = { b: item, hari: [], nama };
      gabung.set(k, entri);
      urut.push(k);
    }
    if (!entri.hari.includes(item.hari)) entri.hari.push(item.hari);
  }

  const baris = urut.map((k) => {
    const { b, hari, nama } = gabung.get(k)!;
    const hariUrut = [...hari].sort(
      (a, x) => URUTAN_HARI.indexOf(a) - URUTAN_HARI.indexOf(x),
    );
    const semuaHari =
      hariUrut.length === URUTAN_HARI.filter((h) => h !== 'Minggu').length;
    const label = LABEL_TIPE[b.tipe] ?? b.tipe;
    return [
      nama,
      b.mulai,
      b.selesai,
      label,
      b.tipeKet,
      semuaHari ? '' : hariUrut.join('; '),
    ] as Sel;
  });

  // Urutkan: pukul mulai, supaya rapi saat dibaca.
  return baris.sort((a, b) => String(a[1]).localeCompare(String(b[1])));
}

/** Label tipe waktu yang dikenali importer (src/excel.ts). */
const LABEL_TIPE: Record<string, string> = {
  pelajaran: 'Pelajaran',
  istirahat: 'Istirahat',
  apel: 'Apel',
  kustom: 'Kustom',
};

// ---------------------------------------------------------------------------
// 4. Susun data keluaran
// ---------------------------------------------------------------------------

interface GuruKeluar {
  kode: number;
  nama: string;
  mapelKode: string[];
  maxJam: number;
  maxPerHari: number;
}

interface KebutuhanKeluar {
  kelasId: string;
  mapelKode: string;
  guruId: string;
  jumlahJam: number;
}

function susun() {
  const { baris, kelas } = bacaMatriks();
  const kendala = bacaKendala();
  const log: { jenis: string; pesan: string }[] = [];
  const catat = (jenis: string, pesan: string) => log.push({ jenis, pesan });

  // --- maxPerHari per guru (dari kendala, dicocokkan longgar) ---------------
  const kendalaPerGuru = new Map<string, { nama: string; max: number[]; rows: Kendala[] }>();
  for (const k of kendala) {
    const key = norm(k.nama);
    const entri = kendalaPerGuru.get(key) ?? { nama: k.nama, max: [], rows: [] };
    entri.rows.push(k);
    if (k.maxPerHari !== null) entri.max.push(k.maxPerHari);
    kendalaPerGuru.set(key, entri);
  }

  const semuaEntri = [...kendalaPerGuru.entries()].map(([key, v]) => ({ key, ...v }));

  /** Cari entri kendala untuk sebuah nama guru (persis dulu, lalu kemiripan). */
  function entriKendala(nama: string): { nama: string; max: number[]; rows: Kendala[] } | null {
    const key = norm(nama);
    const persis = kendalaPerGuru.get(key);
    if (persis) return persis;
    let terbaik: (typeof semuaEntri)[number] | null = null;
    let skorTerbaik = 0;
    for (const e of semuaEntri) {
      const s = mirip(key, e.key);
      if (s > skorTerbaik) {
        skorTerbaik = s;
        terbaik = e;
      }
    }
    if (terbaik && skorTerbaik >= 0.85) {
      catat(
        'cocok-longgar',
        `Nama guru "${nama}" tidak sama persis dengan berkas kendala; ` +
          `dicocokkan dengan "${terbaik.nama}" (kemiripan ${(skorTerbaik * 100).toFixed(0)}%).`,
      );
      return terbaik;
    }
    return null;
  }

  // --- Guru: satu baris per guru (gabungan mapel) --------------------------
  const guru: GuruKeluar[] = [];
  const idxGuru = new Map<string, number>(); // norm(nama) → indeks pada `guru`
  const kodeTerpakai = new Set<number>();
  const mapelMuncul = new Map<string, string>(); // kode → nama asli
  const kebutuhan: KebutuhanKeluar[] = [];

  // Baris 25 pada matriks: PEND. PANCASILA X-1..X-4 tanpa nama guru.
  // Aplikasi mencocokkan guru lewat nama/kode, jadi didaftarkan sebagai guru "25".
  const NAMA_GURU_KOSONG = '25';

  const namaDikecualikan = new Set(GURU_DIKECUALIKAN.map(norm));

  for (const b of baris) {
    // Guru yang tidak diikutkan (mis. tidak lagi mengajar) dilewati sepenuhnya.
    if (b.nama && namaDikecualikan.has(norm(b.nama))) {
      catat(
        'guru-dihapus',
        `"${b.nama}" (kode matriks ${b.no ?? '-'}, mapel ${b.mapelNama}, ${b.total} JP) ` +
          `DIHAPUS atas permintaan — tidak masuk sheet Guru maupun Kebutuhan Jam.`,
      );
      continue;
    }

    const namaGuru = b.nama || NAMA_GURU_KOSONG;
    if (!b.nama) {
      catat(
        'guru-tanpa-nama',
        `Baris matriks tanpa nama guru (mapel ${b.mapelNama}, ${b.total} JP) → didaftarkan ` +
          `sebagai guru bernama "${NAMA_GURU_KOSONG}" agar tetap bisa diimpor.`,
      );
    }

    const key = norm(namaGuru);
    let i = idxGuru.get(key);
    if (i === undefined) {
      let kode: number;
      if (b.no !== null && !kodeTerpakai.has(b.no)) {
        kode = b.no;
      } else {
        kode = Math.max(0, ...kodeTerpakai) + 1;
        if (b.no !== null) {
          catat(
            'kode-bentrok',
            `Kode ${b.no} ganda pada matriks; "${namaGuru}" memakai kode ${kode}.`,
          );
        }
      }
      kodeTerpakai.add(kode);

      const entri = entriKendala(namaGuru);
      const maxPerHari = entri && entri.max.length ? Math.min(...entri.max) : 0;
      if (entri && entri.max.length > 1 && new Set(entri.max).size > 1) {
        catat(
          'max-per-hari-ganda',
          `"${namaGuru}" punya beberapa nilai MAX JP/HARI di berkas kendala ` +
            `(${[...new Set(entri.max)].join(', ')}); dipakai ${maxPerHari}.`,
        );
      }
      if (!entri) {
        catat(
          'kendala-tidak-ada',
          `"${namaGuru}" tidak ada di berkas kendala → kolom maxPerHari dikosongkan ` +
            `(aplikasi memakai batas bawaan 6 JP/hari).`,
        );
      }

      i = guru.length;
      guru.push({
        kode,
        nama: namaGuru,
        mapelKode: [],
        maxJam: 0,
        maxPerHari: maxPerHari,
      });
      idxGuru.set(key, i);
    }

    const g = guru[i];
    if (!g.mapelKode.includes(b.kodeMapel)) g.mapelKode.push(b.kodeMapel);
    g.maxJam += b.total;
    mapelMuncul.set(b.kodeMapel, b.mapelNama);

    for (const sel of b.perKelas) {
      kebutuhan.push({
        kelasId: sel.kelas,
        mapelKode: b.kodeMapel,
        guruId: namaGuru, // aplikasi mencocokkan guru lewat NAMA
        jumlahJam: sel.jam,
      });
    }
  }

  // --- Temuan tambahan -----------------------------------------------------
  for (const g of guru) {
    if (g.maxJam === 0) {
      catat(
        'guru-tanpa-jp',
        `"${g.nama}" (kode ${g.kode}) memiliki 0 JP di matriks; maxJam ditulis minimum 1 ` +
          `agar diterima importer. Periksa apakah guru ini masih mengajar.`,
      );
    }
  }

  // Guru yang hanya ada di berkas kendala (tidak mengajar di matriks).
  const namaMatriks = new Set(guru.map((g) => norm(g.nama)));
  for (const [key, v] of kendalaPerGuru) {
    if (namaMatriks.has(key)) continue;
    const hampir = [...namaMatriks].some((n) => mirip(n, key) >= 0.85);
    catat(
      'kendala-ekstra',
      `"${v.nama}" ada di berkas kendala (MAX JP/HARI ${v.max.join('/')}) ` +
        `tetapi tidak mengajar di matriks → tidak dibuatkan baris Guru` +
        (hampir ? ' (nama mirip guru lain di matriks, mohon dicek).' : '.'),
    );
  }

  // Selisih TOTAL JP kendala vs matriks.
  for (const g of guru) {
    const entri = kendalaPerGuru.get(norm(g.nama));
    if (!entri) continue;
    const totalKendala = entri.rows
      .map((r) => r.totalJP)
      .filter((n): n is number => n !== null)
      .reduce((a, b) => a + b, 0);
    // Sebagian guru dipecah per mapel pada kendala (mis. "Sofiatur (FISIKA)").
    const barisMatriksNama = baris.filter((b) => norm(b.nama || NAMA_GURU_KOSONG) === norm(g.nama));
    const hanyaSatuMapel = barisMatriksNama.length === 1;
    if (totalKendala > 0 && hanyaSatuMapel && totalKendala !== g.maxJam) {
      catat(
        'total-jp-beda',
        `"${g.nama}": TOTAL JP di berkas kendala ${totalKendala}, di matriks ${g.maxJam}. ` +
          `Nilai matriks yang dipakai untuk maxJam.`,
      );
    }
  }

  // Peringatan pola JP yang kaku (polaJP = jumlah jam → wajib blok berurutan).
  // Hasil uji nyata dengan scheduler aplikasi: polaJP = jumlahJam membuat
  // generator GAGAL pada 32 baris (384/528 JP) karena jadwal hanya punya
  // maksimal 3 JP berurutan per hari (jam ke-4 terpotong istirahat).
  const polaKaku = kebutuhan.filter((k) => k.jumlahJam >= 4).length;
  if (polaKaku) {
    catat(
      'pola-jp-penting',
      `polaJP diisi = jumlahJam sesuai permintaan (${polaKaku} baris berisi ≥ 4 JP). ` +
        `PENTING: ini membuat generator jadwal GAGAL — uji nyata menghasilkan ` +
        `384/528 JP (32 baris gagal), sedangkan bila kolom polaJP DIKOSONGKAN hasilnya ` +
        `528/528 JP tanpa konflik. Alasan: jam pelajaran terpotong istirahat setelah JP ke-3, ` +
        `sehingga blok > 3 JP sering tak menemukan slot berurutan. ` +
        `Rekomendasi: kosongkan kolom polaJP pada sheet "Kebutuhan Jam" (atau isi 2/2 saja ` +
        `untuk mapel yang memang blok).`,
    );
  }

  return { guru, kebutuhan, kelas, mapelMuncul, log, barisMatriks: baris };
}

// ---------------------------------------------------------------------------
// 5. Tulis workbook
// ---------------------------------------------------------------------------

type Sel = (string | number)[];

function lebarKolom(header: Sel, isi: Sel[]): { wch: number }[] {
  return header.map((h, i) => {
    let terpanjang = String(h).length + 3;
    for (const r of isi.slice(0, 300)) {
      terpanjang = Math.max(terpanjang, String(r[i] ?? '').length + 2);
    }
    return { wch: Math.min(52, terpanjang) };
  });
}

function tulisSheet(wb: XLSX.WorkBook, nama: string, header: Sel, isi: Sel[]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...isi]);
  ws['!cols'] = lebarKolom(header, isi);
  if (isi.length > 1) {
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: isi.length, c: Math.max(0, header.length - 1) },
      }),
    };
  }
  XLSX.utils.book_append_sheet(wb, ws, nama);
}

function bangunWorkbook() {
  const { guru, kebutuhan, kelas, mapelMuncul, log } = susun();

  const wb = XLSX.utils.book_new();
  // Workbook baru selalu membawa sheet kosong bernama "Sheet1". Ganti namanya
  // menjadi "Log" dan pakai ulang — agar tidak ada sheet sisa bernama Sheet1.
  wb.SheetNames[0] = SHEET.log;
  wb.Sheets[SHEET.log] = wb.Sheets['Sheet1'];
  delete wb.Sheets['Sheet1'];

  // --- Petunjuk (diabaikan pembaca) ----------------------------------------
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['Langkah', 'Cara Isi', 'Contoh / Catatan'],
      ['Hasil generate', 'Sheet Guru & Kebutuhan Jam dihasilkan dari matriks ploating + berkas kendala.', 'Jangan ganti nama sheet atau judul kolom.'],
      ['Cara impor', 'Buka aplikasi → Hasil → Berkas & Data → seret berkas .xlsx ini.', 'Impor akan menolak berkas bila ada referensi yang tidak ditemukan.'],
      ['Jam Pelajaran', 'Dibaca dari "File Acuan PDF dan EXCEL/Jadwal SMA.xlsx". Jam beda per hari (Senin 7 JP + Upacara, Jumat 5 JP, lainnya 8 JP).', 'Kolom hariAktif menentukan jam ini berlaku di hari apa; kosong = semua hari.'],
      ['slotDiinginkan / slotDilarang', 'Sengaja dikosongkan sesuai permintaan.', 'Isi lewat aplikasi bila perlu (format teks bebas bermasalah).'],
      ['Sheet Log', 'Berisi temuan & peringatan; tidak dibaca saat impor.', 'Periksa sebelum menjalankan generator.'],
    ]),
    SHEET.petunjuk,
  );

  // --- Guru ----------------------------------------------------------------
  tulisSheet(
    wb,
    SHEET.guru,
    [...HEADER.guru],
    guru.map((g, i) => [
      g.kode,
      g.nama,
      PALET_GURU[i % PALET_GURU.length],
      g.mapelKode.join('; '),
      Math.max(1, g.maxJam), // importer menolak nilai < 1
      g.maxPerHari > 0 ? g.maxPerHari : '', // kosong = batas bawaan aplikasi
      '', // slotDiinginkan
      '', // slotDilarang
      '', // polaJP
      '', // catatan
    ]),
  );

  // --- Kelas ---------------------------------------------------------------
  tulisSheet(
    wb,
    SHEET.kelas,
    [...HEADER.kelas],
    kelas.map((nama) => [nama, nama.split('-')[0], '', 36]),
  );

  // --- Mata Pelajaran ------------------------------------------------------
  const mapelUrut = [...mapelMuncul.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  tulisSheet(
    wb,
    SHEET.mapel,
    [...HEADER.mapel],
    mapelUrut.map(([kode, nama]) => [kode, nama, 'Tidak']),
  );

  // --- Jam Pelajaran (dibaca dari berkas acuan "Jadwal SMA.xlsx") ----------
  // Jam pelajaran TIDAK seragam tiap hari: Senin diawali Upacara (8 JP),
  // Jumat hanya 5 JP, hari lain 8 JP. Istirahat pun beda jamnya (Jumat lebih
  // pendek), dan ada Jama'ah Dhuhur. Karena itu jam per hari di-encode lewat
  // kolom hariAktif: satu baris periode = satu jam untuk hari-hari tertentu.
  const jam: Sel[] = daftarJamDariAcuan();
  tulisSheet(wb, SHEET.periode, [...HEADER.periode], jam);

  // --- Hari (maksJP dihitung dari jam pelajaran acuan) ---------------------
  // Senin 7 JP (diawali Upacara), Jumat 5 JP, Selasa–Kamis & Sabtu 8 JP.
  // 0 = tanpa batas; diisi nyata agar sel di luar jam pelajaran tidak terpakai.
  const jpPerHari = new Map<string, number>();
  for (const h of ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']) {
    jpPerHari.set(h, 0);
  }
  for (const row of jam) {
    if (String(row[3]).toLowerCase() !== 'pelajaran') continue;
    const aktif = String(row[5] ?? '').trim();
    const daftarHari = aktif
      ? aktif.split(';').map((x) => x.trim()).filter(Boolean)
      : [...jpPerHari.keys()];
    for (const h of daftarHari) {
      if (jpPerHari.has(h)) jpPerHari.set(h, (jpPerHari.get(h) ?? 0) + 1);
    }
  }
  tulisSheet(
    wb,
    SHEET.hari,
    [...HEADER.hari],
    [...jpPerHari.entries()].map(([h, n]) => [h, n, '']),
  );

  // --- Kebutuhan Jam -------------------------------------------------------
  tulisSheet(
    wb,
    SHEET.kebutuhan,
    [...HEADER.kebutuhan],
    kebutuhan.map((k) => [
      k.kelasId,
      k.mapelKode,
      k.guruId,
      k.jumlahJam,
      TANPA_POLA ? '' : k.jumlahJam, // polaJP (lihat catatan --no-pola)
    ]),
  );

  // --- Log (tidak dibaca importer; sheet "Log" sudah dibuat di awal) ------
  {
    const isi: Sel[] = log.length
      ? log.map((l) => [l.jenis, l.pesan])
      : [['-', 'Tidak ada temuan.']];
    const ws = XLSX.utils.aoa_to_sheet([[...HEADER.log], ...isi]);
    ws['!cols'] = lebarKolom([...HEADER.log], isi);
    wb.Sheets[SHEET.log] = ws;
  }

  return { wb, guru, kebutuhan, kelas, mapelUrut, log };
}

// ---------------------------------------------------------------------------
// 6. Verifikasi ulang (logika baca yang sama seperti src/excel.ts)
// ---------------------------------------------------------------------------

function verifikasi(wb: XLSX.WorkBook) {
  const aoa = (nama: string): unknown[][] => {
    const ws = wb.Sheets[nama];
    return ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', blankrows: false }) : [];
  };
  const barisSheet = (nama: string): Record<string, unknown>[] => {
    const rows = aoa(nama);
    if (!rows.length) return [];
    const kunci = (rows[0] ?? []).map((h) => String(h ?? '').trim());
    const out: Record<string, unknown>[] = [];
    for (const row of rows.slice(1)) {
      const obj: Record<string, unknown> = {};
      let isi = false;
      kunci.forEach((k, i) => {
        if (!k) return;
        obj[k] = row[i];
        if (String(row[i] ?? '').trim() !== '') isi = true;
      });
      if (isi) out.push(obj);
    }
    return out;
  };
  const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim());

  const mapel = new Map<string, string>();
  for (const r of barisSheet(SHEET.mapel)) {
    const nama = str(r['nama']);
    if (!nama) continue;
    const id = `m_${nama}`;
    mapel.set(nama.toLowerCase(), id);
    const kode = str(r['kode']);
    if (kode) mapel.set(kode.toLowerCase(), id);
  }
  const kelas = new Map<string, string>();
  for (const r of barisSheet(SHEET.kelas)) {
    const nama = str(r['nama']);
    if (nama) kelas.set(nama.toLowerCase(), `k_${nama}`);
  }
  const guru = new Map<string, string>();
  for (const r of barisSheet(SHEET.guru)) {
    const nama = str(r['nama']);
    if (!nama) {
      galat.push(`Guru: baris tanpa nama (kode ${str(r['kode'])}).`);
      continue;
    }
    guru.set(nama.toLowerCase(), `g_${nama}`);
    const kode = str(r['kode']);
    if (kode) guru.set(kode.toLowerCase(), `g_${nama}`);
  }

  const galat: string[] = [];
  let nKebutuhan = 0;
  let totalJam = 0;
  for (const r of barisSheet(SHEET.kebutuhan)) {
    if (!Object.values(r).some((v) => str(v))) continue;
    const k = kelas.get(str(r['kelasId']).toLowerCase());
    const m = mapel.get(str(r['mapelId']).toLowerCase());
    const g = guru.get(str(r['guruId']).toLowerCase());
    const kurang = [!k ? 'kelas' : '', !m ? 'mapel' : '', !g ? 'guru' : ''].filter(Boolean);
    if (kurang.length) {
      galat.push(
        `Kebutuhan Jam: ${kurang.join(', ')} tidak ditemukan pada baris ` +
          `"${str(r['kelasId'])} / ${str(r['mapelId'])} / ${str(r['guruId'])}".`,
      );
      continue;
    }
    const jam = Number(str(r['jumlahJam']));
    if (!Number.isFinite(jam) || jam < 1) {
      galat.push(`Kebutuhan Jam: jumlahJam tidak valid ("${str(r['jumlahJam'])}").`);
      continue;
    }
    nKebutuhan++;
    totalJam += jam;
  }

  // Guru yang diampu harus terdaftar sebagai mapel.
  let mapelGuruRusak = 0;
  for (const r of barisSheet(SHEET.guru)) {
    for (const kode of str(r['mapelIds']).split(/[;,]/).map((x) => x.trim()).filter(Boolean)) {
      if (!mapel.has(kode.toLowerCase())) mapelGuruRusak++;
    }
  }
  if (mapelGuruRusak) galat.push(`Guru: ${mapelGuruRusak} kode mapel tidak terdaftar di sheet Mata Pelajaran.`);

  const peri = barisSheet(SHEET.periode).filter((r) => str(r['nama']));
  const adaPelajaran = peri.some((r) => /^(pelajaran|kbm|pbm)/i.test(str(r['tipe'])));

  return {
    galat,
    nKebutuhan,
    totalJam,
    nGuru: barisSheet(SHEET.guru).length,
    nKelas: kelas.size,
    nMapel: barisSheet(SHEET.mapel).length,
    nPeriode: peri.length,
    adaPelajaran,
  };
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------

function main() {
  console.log('=== GENERATOR TEMPLATE JADWAL ===');
  console.log('matriks :', BERKAS_MATRIKS);
  console.log('kendala :', BERKAS_KENDALA);

  const { wb, guru, kebutuhan, kelas, mapelUrut, log } = bangunWorkbook();

  const bytesXlsx = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  mkdirSync(dirname(BERKAS_KELUARAN), { recursive: true });
  writeFileSync(BERKAS_KELUARAN, bytesXlsx);

  // Versi TSV: satu blok per sheet, siap copy-paste.
  const tsv: string[] = [];
  for (const nama of wb.SheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nama], {
      header: 1,
      defval: '',
      blankrows: false,
    });
    tsv.push(`### ${nama}`);
    for (const row of aoa) tsv.push(row.map((v) => String(v ?? '')).join('\t'));
    tsv.push('');
  }
  const berkasTsv = BERKAS_KELUARAN.replace(/\.xlsx$/i, '.tsv');
  writeFileSync(berkasTsv, `\uFEFF${tsv.join('\r\n')}`, 'utf8');

  // Verifikasi: baca ulang hasil dengan logika yang sama seperti importer.
  const ulang = XLSX.read(bytesXlsx, { type: 'buffer' });
  const v = verifikasi(ulang);

  console.log('\n--- ISI KELUARAN ---');
  console.log('guru          :', v.nGuru);
  console.log('kelas         :', v.nKelas);
  console.log('mata pelajaran:', v.nMapel);
  console.log('jam pelajaran :', v.nPeriode, v.adaPelajaran ? '(ada tipe Pelajaran)' : '❌ TIDAK ADA "Pelajaran"');
  console.log('kebutuhan jam :', v.nKebutuhan, 'baris ·', v.totalJam, 'JP');
  console.log('kolom polaJP  :', TANPA_POLA ? 'DIKOSONGKAN (--no-pola)' : 'diisi = jumlahJam');
  console.log('guru maxJam   :', guru.reduce((a, g) => a + g.maxJam, 0), 'JP (total matriks)');

  console.log('\n--- VERIFIKASI IMPOR ---');
  if (v.galat.length) {
    console.log(`❌ ${v.galat.length} masalah:`);
    for (const g of v.galat.slice(0, 20)) console.log('   •', g);
  } else {
    console.log('✅ Semua referensi (kelas / mapel / guru) ditemukan — berkas siap diimpor.');
  }

  console.log('\n--- LOG / TEMUAN (' + log.length + ') ---');
  for (const l of log) console.log(`  [${l.jenis}] ${l.pesan}`);

  console.log('\n--- BERKAS ---');
  console.log(BERKAS_KELUARAN);
  console.log(berkasTsv);

  if (v.galat.length) {
    console.log('\nHASIL: GAGAL ❌');
    process.exit(1);
  }
  console.log('\nHASIL: LULUS ✅');
}

main();
