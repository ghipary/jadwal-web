// Model matriks jadwal ala lembar cetak sekolah:
// baris = hari × jam pelajaran, kolom = kelas, isi sel = kode (nomor guru +
// kode mapel), dengan legenda kode → guru → mata pelajaran di sisi kanan.
// Tata letak mengikuti berkas acuan "Jadwal SMA.xlsx":
//   baris 1–3  : judul (JADWAL PELAJARAN / sekolah / TAHUN AJARAN)
//   baris 4    : kosong
//   baris 5–6  : header HARI | PUKUL | kelas (digabung 2 baris)
//   baris 5–7  : header legenda KODE | NAMA | MATA PELAJARAN (oranye)
//   baris 7+   : data per hari (nama hari digabung vertikal), baris istirahat
//                digabung mendatar di kolom kelas, waktu "07.00 - 07.40".

import { Assignment, DAYS, Project } from './types';
import { FontPdf, PdfDoc } from './pdf';
import { buildXlsx, colName, StyleBook, XlsRow, XlsSheet } from './xlsx';

export interface SelMatriks {
  kode: string;
  les: Assignment[];
  warna: string;
}

export interface BarisMatriks {
  hari: number;
  periodeId: string;
  jam: string;
  label: string;
  istirahat: boolean;
}

export interface BlokHari {
  hari: number;
  nama: string;
  mulai: number;
  jumlah: number;
}

export interface LegendaEntry {
  kode: string;
  guru: string;
  mapel: string;
  warna: string;
}

export interface Matriks {
  kelas: { id: string; nama: string }[];
  baris: BarisMatriks[];
  blok: BlokHari[];
  sel: Map<string, SelMatriks>;
  legenda: LegendaEntry[];
  adaIsi: boolean;
}

export function kunciSel(hari: number, periodeId: string, kelasId: string): string {
  return `${hari}|${periodeId}|${kelasId}`;
}

/** "07:00" → "07.00" — gaya penulisan waktu pada lembar cetak sekolah. */
export function jamAcuan(waktu: string): string {
  return waktu.replace(/:/g, '.');
}

function kodeMapelSingkat(nama: string, kode: string): string {
  if (kode.trim()) return kode.trim().toUpperCase();
  return nama
    .replace(/[^A-Za-z ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 4);
}

/** Kode sel = nomor urut guru (1-based) + kode mapel, ala "22PP". */
export function kodePasangan(nomorGuru: number, namaMapel: string, kodeMapel: string): string {
  return `${nomorGuru}${kodeMapelSingkat(namaMapel, kodeMapel)}`;
}

export function buatMatriks(project: Project): Matriks {
  const nomorGuru = new Map(project.guru.map((g, i) => [g.id, i + 1]));
  const guruM = new Map(project.guru.map((g) => [g.id, g]));
  const mapelM = new Map(project.mapel.map((m) => [m.id, m]));
  const kelasM = new Map(project.kelas.map((c) => [c.id, c]));

  const baris: BarisMatriks[] = [];
  const blok: BlokHari[] = [];
  for (let hari = 0; hari < DAYS.length; hari++) {
    const mulai = baris.length;
    for (const per of project.periode) {
      baris.push({
        hari,
        periodeId: per.id,
        jam: jamAcuan(`${per.mulai} - ${per.selesai}`),
        label: per.nama.toUpperCase(),
        istirahat: per.istirahat,
      });
    }
    blok.push({ hari, nama: DAYS[hari], mulai, jumlah: baris.length - mulai });
  }

  const sel = new Map<string, SelMatriks>();
  const legendaMap = new Map<string, LegendaEntry>();
  let adaIsi = false;

  for (const les of project.jadwal) {
    adaIsi = true;
    const key = kunciSel(les.hari, les.periodeId, les.kelasId);
    const g = guruM.get(les.guruId);
    const m = mapelM.get(les.mapelId);
    const nomor = nomorGuru.get(les.guruId) ?? 0;
    const kode = kodePasangan(nomor, m?.nama ?? '?', m?.kode ?? '');
    const existing = sel.get(key);
    if (existing) {
      // Bentrok tergambar sebagai kode bertumpuk dalam satu sel.
      existing.les.push(les);
      existing.kode = [...new Set([...existing.kode.split(' '), kode])].join(' ');
    } else {
      sel.set(key, { kode, les: [les], warna: m?.warna ?? '#94a3b8' });
    }
    if (!legendaMap.has(kode)) {
      legendaMap.set(kode, {
        kode,
        guru: g?.nama ?? '(terhapus)',
        mapel: m?.nama ?? '(terhapus)',
        warna: m?.warna ?? '#94a3b8',
      });
    }
  }

  const legenda = [...legendaMap.values()].sort((a, b) => {
    const na = Number(a.kode.match(/^\d+/)?.[0] ?? 0);
    const nb = Number(b.kode.match(/^\d+/)?.[0] ?? 0);
    return na - nb || a.kode.localeCompare(b.kode);
  });

  return {
    kelas: project.kelas.map((c) => ({ id: c.id, nama: c.nama || (kelasM.get(c.id)?.nama ?? '') })),
    baris,
    blok,
    sel,
    legenda,
    adaIsi,
  };
}

// ---------------------------------------------------------------------------
// Ekspor .xlsx — meniru lembar acuan "Jadwal SMA.xlsx"
// ---------------------------------------------------------------------------

/** Susun lembar .xlsx matriks (judul, tabel kode, legenda) dari sebuah matriks. */
export function matriksKeXlsx(project: Project, m: Matriks): Uint8Array {
  const namaSekolah = project.info.nama || 'SEKOLAH';
  const tahunAjaran = project.info.tahunAjaran || '—';

  const gaya = new StyleBook();
  const sJudul = gaya.add({ bold: true, nama: 'Arial', ukuran: 16, tengah: true });
  const sHeadHari = gaya.add({ nama: 'Arial', ukuran: 11, tengah: true, borderTebal: true, isi: 'FBE5D6' });
  const sHeadJam = gaya.add({ nama: 'Arial', ukuran: 10, tengah: true, borderTebal: true, isi: 'FBE5D6' });
  const sHeadKelas = gaya.add({ nama: 'Arial', ukuran: 11, tengah: true, borderTebal: true });
  const sLegHead = gaya.add({ bold: true, nama: 'Arial', ukuran: 12, tengah: true, borderTebal: true, isi: 'FFC000' });
  const sHari = gaya.add({ nama: 'Arial', ukuran: 14, tengah: true, borderTebal: true });
  const sJam = gaya.add({ nama: 'Arial Narrow', ukuran: 10, tengah: true, borderTebal: true });
  const sKode = gaya.add({ nama: 'Arial', ukuran: 12, tengah: true, borderTebal: true });
  const sIst = gaya.add({ bold: true, nama: 'Arial', ukuran: 12, tengah: true, borderTebal: true });
  const sLegKode = gaya.add({ nama: 'Arial Narrow', ukuran: 14, tengah: true, borderTebal: true });
  const sLegNama = gaya.add({ nama: 'Arial Narrow', ukuran: 11, borderTebal: true });
  const sLegMapel = gaya.add({ nama: 'Arial Narrow', ukuran: 14, tengah: true, borderTebal: true, isi: '92D050' });

  const nKelas = Math.max(m.kelas.length, 1);
  const totalKolom = 2 + nKelas + 1 + 3; // HARI + PUKUL + kelas + jeda + legenda
  const akhir = colName(totalKolom);
  const colLeg = 2 + nKelas + 2; // indeks kolom (1-based) KODE legenda
  const iKode = colLeg - 1; // indeks 0-based pada array sel
  const barisKe = (i: number) => i + 1;

  // Baris 1–3: judul; baris 4: kosong; baris 5–6: header tabel + legenda.
  const baris: XlsRow[] = [
    { tinggi: 22, sel: [{ teks: 'JADWAL PELAJARAN', gaya: sJudul }] },
    { tinggi: 22, sel: [{ teks: namaSekolah, gaya: sJudul }] },
    { tinggi: 22, sel: [{ teks: `TAHUN AJARAN ${tahunAjaran}`, gaya: sJudul }] },
    { tinggi: 15, sel: [] },
  ];
  const merge: string[] = [`A1:${akhir}1`, `A2:${akhir}2`, `A3:${akhir}3`];

  const selKepala: XlsRow['sel'] = [
    { teks: 'HARI', gaya: sHeadHari },
    { teks: 'PUKUL', gaya: sHeadJam },
    ...m.kelas.map((k) => ({ teks: k.nama, gaya: sHeadKelas })),
    null, // kolom jeda
    { teks: 'KODE', gaya: sLegHead },
    { teks: 'NAMA', gaya: sLegHead },
    { teks: 'MATA PELAJARAN', gaya: sLegHead },
  ];
  baris.push({ tinggi: 26, sel: selKepala });

  // Baris 6: lanjutan header yang digabung (A5:A6 …) + legenda (P5:P7).
  const selKepala2: XlsRow['sel'] = [
    { teks: '', gaya: sHeadHari },
    { teks: '', gaya: sHeadJam },
    ...m.kelas.map(() => ({ teks: '', gaya: sHeadKelas })),
    null,
    { teks: '', gaya: sLegHead },
    { teks: '', gaya: sLegHead },
    { teks: '', gaya: sLegHead },
  ];
  baris.push({ tinggi: 16, sel: selKepala2 });

  merge.push('A5:A6', 'B5:B6');
  for (let c = 0; c < nKelas; c++) {
    const cn = colName(3 + c);
    merge.push(`${cn}5:${cn}6`);
  }
  const akhirKelas = colName(2 + nKelas);
  for (const cn of [colName(colLeg), colName(colLeg + 1), colName(colLeg + 2)]) {
    merge.push(`${cn}5:${cn}7`);
  }

  for (const b of m.blok) {
    const slice = m.baris.slice(b.mulai, b.mulai + b.jumlah);
    const rAwal = barisKe(baris.length);
    slice.forEach((br, i) => {
      const rGlobal = b.mulai + i;
      const sel: XlsRow['sel'] = [];
      if (i === 0) sel.push({ teks: b.nama, gaya: sHari });
      else sel.push(null);
      sel.push({ teks: br.jam, gaya: sJam });
      if (br.istirahat) {
        sel.push({ teks: br.label, gaya: sIst });
        for (let x = 1; x < nKelas; x++) sel.push(null);
      } else {
        for (const k of m.kelas) {
          const s = m.sel.get(kunciSel(br.hari, br.periodeId, k.id));
          sel.push({ teks: s?.kode ?? '', gaya: sKode });
        }
      }
      sel.push(null); // kolom jeda
      // Legenda sejajar data — baris pertama masih tertutup merge header.
      if (rGlobal >= 1) {
        const e = m.legenda[rGlobal - 1];
        if (e) {
          sel[iKode] = { teks: e.kode, gaya: sLegKode };
          sel[iKode + 1] = { teks: e.guru, gaya: sLegNama };
          sel[iKode + 2] = { teks: e.mapel, gaya: sLegMapel };
        } else {
          sel[iKode] = { teks: '', gaya: sLegKode };
          sel[iKode + 1] = { teks: '', gaya: sLegNama };
          sel[iKode + 2] = { teks: '', gaya: sLegMapel };
        }
      } else {
        sel[iKode] = { teks: '', gaya: sLegHead };
        sel[iKode + 1] = { teks: '', gaya: sLegHead };
        sel[iKode + 2] = { teks: '', gaya: sLegHead };
      }
      baris.push({ tinggi: 19, sel });
    });
    const rAkhir = barisKe(baris.length - 1);
    if (rAkhir > rAwal) merge.push(`A${rAwal}:A${rAkhir}`);
    slice.forEach((br, i) => {
      if (br.istirahat) merge.push(`C${rAwal + i}:${akhirKelas}${rAwal + i}`);
    });
  }

  // Baris tambahan bila legenda lebih panjang daripada tabel data.
  for (let r = m.baris.length; r < m.legenda.length + 1; r++) {
    const e = m.legenda[r - 1];
    const sel: XlsRow['sel'] = [
      { teks: '', gaya: sHari },
      { teks: '', gaya: sJam },
      ...m.kelas.map(() => ({ teks: '', gaya: sKode })),
      null,
      { teks: e.kode, gaya: sLegKode },
      { teks: e.guru, gaya: sLegNama },
      { teks: e.mapel, gaya: sLegMapel },
    ];
    baris.push({ tinggi: 19, sel });
  }

  const sheet: XlsSheet = {
    nama: 'Jadwal',
    kolom: [
      { lebar: 9 },
      { lebar: 13.5 },
      ...m.kelas.map(() => ({ lebar: 9.3 })),
      { lebar: 2.5 },
      { lebar: 9.7 },
      { lebar: 24.6 },
      { lebar: 22.9 },
    ],
    baris,
    merge,
    freeze: [3, 7],
  };

  return buildXlsx([sheet], gaya);
}

// ---------------------------------------------------------------------------
// Ekspor .pdf — lembar matriks satu halaman A4 lanskap
// ---------------------------------------------------------------------------

interface WarnaRgb {
  (hex: string): [number, number, number];
}

const rgb: WarnaRgb = (hex) => {
  const n = parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const WARNA_HARI = rgb('FBE5D6');
const WARNA_LEGENDA = rgb('FFC000');
const WARNA_MAPEL = rgb('92D050');

/** Susun berkas .pdf matriks (A4 lanskap, satu halaman, diskalakan muat). */
export function matriksKePdf(project: Project, m: Matriks): Uint8Array {
  const doc = new PdfDoc('lanskap');
  const M = 14;
  const W = doc.lebar - 2 * M;
  const H = doc.tinggi - 2 * M;

  const nK = Math.max(m.kelas.length, 1);
  const cHari = 30;
  const cJam = 54;
  const cJeda = 6;
  const cKode = 28;
  const cNama = 84;
  const cMapel = 66;
  const cKelas = Math.max(22, Math.min(58, (W - (cHari + cJam + cJeda + cKode + cNama + cMapel)) / nK));

  const judulHAsli = 44;
  const headHAsli = 20;
  const rhAsli = 9.6;
  const totalBaris = Math.max(m.baris.length, m.legenda.length + 1);
  const skala = Math.min(1, H / (judulHAsli + headHAsli + totalBaris * rhAsli));
  const judulH = judulHAsli * skala;
  const headH = headHAsli * skala;
  const rh = rhAsli * skala;
  const fs = (n: number) => Math.max(4.5, n * skala);
  const tebalGaris = Math.max(0.5, 0.9 * Math.min(1, skala + 0.3));

  // Tabel ditengahkan bila total lebar lebih sempit daripada halaman.
  const xBase =
    M +
    Math.max(
      0,
      (W - (cHari + cJam + nK * cKelas + cJeda + cKode + cNama + cMapel)) / 2,
    );
  const xHari = xBase;
  const xJam = xHari + cHari;
  const xKelas0 = xJam + cJam;
  const xKelas = (i: number) => xKelas0 + i * cKelas;
  const xJeda = xKelas0 + nK * cKelas;
  const xKode = xJeda + cJeda;
  const xNama = xKode + cKode;
  const xMapel = xNama + cNama;

  const yTop = doc.tinggi - M;

  const kotakIsi = (x: number, y: number, w: number, h: number, isi?: [number, number, number]) => {
    if (isi) doc.isi(x, y, w, h, isi);
    doc.kotak(x, y, w, h, { tebal: tebalGaris });
  };
  const tengah = (
    x: number,
    w: number,
    y: number,
    h: number,
    s: string,
    uk: number,
    font: FontPdf = 'normal',
  ) => doc.teks(0, y + h / 2 - uk * 0.36, s, { font, ukuran: uk, tengahX: x + w / 2 });

  /** Kecilkan ukuran huruf bila teks melebihi lebar maksimum (pt). */
  const muat = (s: string, lebarMaks: number, uk: number, font: FontPdf = 'normal') => {
    const w = doc.ukuranTeks(s, font, uk);
    return w > lebarMaks && w > 0 ? Math.max(3.6, uk * (lebarMaks / w)) : uk;
  };

  // Judul
  const cx = doc.lebar / 2;
  doc.teks(0, yTop - 17, 'JADWAL PELAJARAN', { font: 'tebal', ukuran: fs(15), tengahX: cx });
  doc.teks(0, yTop - 31, project.info.nama || 'SEKOLAH', { font: 'tebal', ukuran: fs(12), tengahX: cx });
  doc.teks(0, yTop - 44, `TAHUN AJARAN ${project.info.tahunAjaran || '—'}`, { ukuran: fs(12), tengahX: cx });

  const yTable = yTop - judulH;

  // Header tabel
  kotakIsi(xHari, yTable - headH, cHari, headH, WARNA_HARI);
  tengah(xHari, cHari, yTable - headH, headH, 'HARI', fs(11));
  kotakIsi(xJam, yTable - headH, cJam, headH, WARNA_HARI);
  tengah(xJam, cJam, yTable - headH, headH, 'PUKUL', fs(10));
  m.kelas.forEach((k, i) => {
    kotakIsi(xKelas(i), yTable - headH, cKelas, headH);
    tengah(xKelas(i), cKelas, yTable - headH, headH, k.nama, muat(k.nama, cKelas - 4, fs(10.5)));
  });

  // Header legenda (digiung tiga baris: 2 header + baris data pertama)
  const yLegHead = yTable - headH - rh;
  const hLegHead = headH + rh;
  kotakIsi(xKode, yLegHead, cKode, hLegHead, WARNA_LEGENDA);
  tengah(xKode, cKode, yLegHead, hLegHead, 'KODE', fs(11), 'tebal');
  kotakIsi(xNama, yLegHead, cNama, hLegHead, WARNA_LEGENDA);
  tengah(xNama, cNama, yLegHead, hLegHead, 'NAMA', fs(11), 'tebal');
  kotakIsi(xMapel, yLegHead, cMapel, hLegHead, WARNA_LEGENDA);
  const ukMapel = fs(9);
  const midY = yLegHead + hLegHead / 2;
  doc.teks(0, midY + ukMapel * 0.4, 'MATA', {
    font: 'tebal',
    ukuran: ukMapel,
    tengahX: xMapel + cMapel / 2,
  });
  doc.teks(0, midY - ukMapel * 0.9, 'PELAJARAN', {
    font: 'tebal',
    ukuran: ukMapel,
    tengahX: xMapel + cMapel / 2,
  });

  const gambarLegenda = (rGlobal: number, y: number) => {
    if (rGlobal < 1) return; // baris pertama masih tertutup header legenda
    const e = m.legenda[rGlobal - 1];
    kotakIsi(xKode, y, cKode, rh);
    kotakIsi(xNama, y, cNama, rh);
    if (e) {
      tengah(xKode, cKode, y, rh, e.kode, muat(e.kode, cKode - 4, fs(8.5)));
      const ukNama = muat(e.guru, cNama - 6, fs(7.5));
      doc.teks(xNama + 3, y + rh / 2 - ukNama * 0.36, e.guru, { ukuran: ukNama });
      kotakIsi(xMapel, y, cMapel, rh, WARNA_MAPEL);
      tengah(xMapel, cMapel, y, rh, e.mapel, muat(e.mapel, cMapel - 4, fs(8)));
    } else {
      kotakIsi(xMapel, y, cMapel, rh);
    }
  };

  // Baris data per hari
  for (const b of m.blok) {
    const slice = m.baris.slice(b.mulai, b.mulai + b.jumlah);
    slice.forEach((br, i) => {
      const rGlobal = b.mulai + i;
      const yAtas = yTable - headH - rGlobal * rh;
      const y = yAtas - rh;
      if (i === 0) {
        const hBlokJadi = b.jumlah * rh;
        kotakIsi(xHari, y, cHari, hBlokJadi);
        tengah(xHari, cHari, y, hBlokJadi, b.nama, muat(b.nama, cHari - 4, fs(12), 'tebal'), 'tebal');
      }
      kotakIsi(xJam, y, cJam, rh);
      tengah(xJam, cJam, y, rh, br.jam, muat(br.jam, cJam - 4, fs(8)));
      if (br.istirahat) {
        kotakIsi(xKelas0, y, cKelas * nK, rh);
        tengah(xKelas0, cKelas * nK, y, rh, br.label, fs(8.5), 'tebal');
      } else {
        for (let ci = 0; ci < nK; ci++) {
          const s = m.sel.get(kunciSel(br.hari, br.periodeId, m.kelas[ci].id));
          kotakIsi(xKelas(ci), y, cKelas, rh);
          if (s) tengah(xKelas(ci), cKelas, y, rh, s.kode, muat(s.kode, cKelas - 4, fs(8.5)));
        }
      }
      gambarLegenda(rGlobal, y);
    });
  }

  // Baris kosong bila legenda lebih panjang daripada tabel data.
  for (let r = m.baris.length; r < m.legenda.length + 1; r++) {
    const y = yTable - headH - (r + 1) * rh;
    kotakIsi(xHari, y, cHari, rh);
    kotakIsi(xJam, y, cJam, rh);
    for (let ci = 0; ci < nK; ci++) kotakIsi(xKelas(ci), y, cKelas, rh);
    gambarLegenda(r, y);
  }

  return doc.bytes();
}
