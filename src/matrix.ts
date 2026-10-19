// Model matriks jadwal ala lembar cetak sekolah:
// baris = hari × jam pelajaran, kolom = kelas, isi sel = kode (nomor guru +
// kode mapel), dengan legenda kode → guru → mata pelajaran di sisi kanan.

import { Assignment, DAYS, Project } from './types';
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
        jam: `${per.mulai} - ${per.selesai}`,
        label: per.istirahat ? per.nama.toUpperCase() : per.nama,
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
      sel.set(key, { kode, les: [les], warna: g?.warna ?? '#94a3b8' });
    }
    if (!legendaMap.has(kode)) {
      legendaMap.set(kode, {
        kode,
        guru: g?.nama ?? '(terhapus)',
        mapel: m?.nama ?? '(terhapus)',
        warna: g?.warna ?? '#94a3b8',
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

/** Susun lembar .xlsx matriks (judul, tabel kode, legenda) dari sebuah matriks. */
export function matriksKeXlsx(project: Project, m: Matriks): Uint8Array {
  const namaSekolah = project.info.nama || 'SEKOLAH';
  const tahunAjaran = project.info.tahunAjaran || '—';

  const gaya = new StyleBook();
  const sJudul = gaya.add({ bold: true, ukuran: 16, tengah: true });
  const sSekolah = gaya.add({ bold: true, ukuran: 12, tengah: true });
  const sTA = gaya.add({ tengah: true });
  const sHeader = gaya.add({ bold: true, tengah: true, border: true, isi: 'E2E8F0', wrap: true });
  const sHari = gaya.add({ bold: true, tengah: true, border: true, isi: 'E0E7FF' });
  const sJam = gaya.add({ tengah: true, border: true });
  const sKode = gaya.add({ tengah: true, border: true });
  const sIst = gaya.add({ italic: true, tengah: true, border: true, isi: 'F1F5F9' });
  const sLegKode = gaya.add({ tengah: true, border: true, bold: true });
  const sLegKiri = gaya.add({ border: true });

  const nKelas = Math.max(m.kelas.length, 1);
  const totalKolom = 2 + nKelas + 1 + 3; // HARI + PUKUL + kelas + jeda + legenda
  const akhir = colName(totalKolom);
  const barisKe = (i: number) => i + 1;
  const colLeg = 2 + nKelas + 2; // indeks kolom (1-based) KODE legenda

  const baris: XlsRow[] = [
    { sel: [{ teks: 'JADWAL PELAJARAN', gaya: sJudul }] },
    { sel: [{ teks: namaSekolah, gaya: sSekolah }] },
    { sel: [{ teks: `TAHUN AJARAN ${tahunAjaran}`, gaya: sTA }] },
    {
      tinggi: 28,
      sel: [
        { teks: 'HARI', gaya: sHeader },
        { teks: 'PUKUL', gaya: sHeader },
        ...m.kelas.map((k) => ({ teks: k.nama, gaya: sHeader })),
      ],
    },
  ];
  const merge: string[] = [`A1:${akhir}1`, `A2:${akhir}2`, `A3:${akhir}3`];

  // Header legenda pada baris header tabel.
  const legHeader = baris[3].sel;
  legHeader[colLeg - 1] = { teks: 'KODE', gaya: sHeader };
  legHeader[colLeg] = { teks: 'NAMA', gaya: sHeader };
  legHeader[colLeg + 1] = { teks: 'MATA PELAJARAN', gaya: sHeader };

  for (const b of m.blok) {
    const slice = m.baris.slice(b.mulai, b.mulai + b.jumlah);
    const rAwal = barisKe(baris.length);
    slice.forEach((br, i) => {
      const sel: XlsRow['sel'] = [];
      if (i === 0) sel.push({ teks: b.nama, gaya: sHari });
      else sel.push(null);
      sel.push({ teks: br.jam, gaya: br.istirahat ? sIst : sJam });
      if (br.istirahat) {
        sel.push({ teks: br.label, gaya: sIst });
        for (let x = 1; x < nKelas; x++) sel.push(null);
      } else {
        for (const k of m.kelas) {
          const s = m.sel.get(kunciSel(br.hari, br.periodeId, k.id));
          sel.push({ teks: s?.kode ?? '', gaya: sKode });
        }
      }
      baris.push({ tinggi: 20, sel });
    });
    const rAkhir = barisKe(baris.length - 1);
    if (rAkhir > rAwal) merge.push(`A${rAwal}:A${rAkhir}`);
    slice.forEach((br, i) => {
      if (br.istirahat) merge.push(`C${rAwal + i}:${colName(2 + nKelas)}${rAwal + i}`);
    });
  }

  // Entri legenda di bawah header.
  m.legenda.forEach((e, i) => {
    const r = 4 + i; // indeks 0-based; baris 5 dst.
    if (!baris[r]) baris[r] = { sel: [] };
    while (baris[r].sel.length < colLeg - 1) baris[r].sel.push(null);
    baris[r].sel[colLeg - 1] = { teks: e.kode, gaya: sLegKode };
    baris[r].sel[colLeg] = { teks: e.guru, gaya: sLegKiri };
    baris[r].sel[colLeg + 1] = { teks: e.mapel, gaya: sLegKiri };
  });

  const sheet: XlsSheet = {
    nama: 'Matriks',
    kolom: [
      { lebar: 10 },
      { lebar: 17 },
      ...m.kelas.map(() => ({ lebar: 9 })),
      { lebar: 2.5 },
      { lebar: 9 },
      { lebar: 30 },
      { lebar: 20 },
    ],
    baris,
    merge,
    freeze: [3, 5],
  };

  return buildXlsx([sheet], gaya);
}
