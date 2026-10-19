// Penulis berkas .pdf minimal tanpa dependensi.
// Cukup untuk lembar cetak jadwal: teks Helvetica (regular/bold, WinAnsi),
// kotak berbingkai, garis, dan isian warna. Ukuran teks dihitung dari tabel
// lebar huruf AFM agar teks bisa dipusatkan dengan tepat.

export type FontPdf = 'normal' | 'tebal';

// ---------------------------------------------------------------------------
// Lebar huruf (per 1000 unit) untuk Helvetica & Helvetica-Bold, ASCII 32–126.
// ---------------------------------------------------------------------------

const W_HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

const W_HELV_B = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Pemetaan karakter Unicode → byte WinAnsi (cp1252) untuk di luar ASCII. */
const WINANSI: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function byteWinAnsi(ch: number): number {
  if (ch >= 32 && ch <= 126) return ch;
  if (ch >= 0xa0 && ch <= 0xff) return ch;
  const peta = WINANSI[ch];
  return peta ?? 0x3f; // '?'
}

export interface OpsiTeks {
  font?: FontPdf;
  ukuran?: number;
  /** Warna teks 0–1 per kanal. */
  warna?: [number, number, number];
  /** Tengahkan teks pada sumbu x ini (kiri-atas teks tetap acuan). */
  tengahX?: number;
}

export interface OpsiKotak {
  /** Ketebalan garis (pt). */
  tebal?: number;
  warna?: [number, number, number];
}

/** Dokumen PDF satu-atau-beberapa halaman, asal kiri-bawah. */
export class PdfDoc {
  private readonly lp: number;
  private readonly tp: number;
  private hal: string[][] = [];
  private kini: string[] = [];

  constructor(orientasi: 'lanskap' | 'potret' = 'lanskap') {
    this.lp = orientasi === 'lanskap' ? 842 : 595;
    this.tp = orientasi === 'lanskap' ? 595 : 842;
    this.halamanBaru();
  }

  get lebar(): number {
    return this.lp;
  }

  get tinggi(): number {
    return this.tp;
  }

  halamanBaru(): void {
    this.kini = [];
    this.hal.push(this.kini);
  }

  private n(v: number): string {
    return String(Math.round(v * 100) / 100);
  }

  private esc(s: string): string {
    let out = '';
    for (const ch of s) {
      const c = byteWinAnsi(ch.codePointAt(0) ?? 63);
      out +=
        c === 0x5c || c === 0x28 || c === 0x29
          ? `\\${String.fromCharCode(c)}`
          : String.fromCharCode(c);
    }
    return out;
  }

  /** Perkiraan lebar teks (pt). */
  ukuranTeks(s: string, font: FontPdf, ukuran: number): number {
    const tabel = font === 'tebal' ? W_HELV_B : W_HELV;
    const fallback = font === 'tebal' ? 600 : 556;
    let w = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      w += c >= 32 && c <= 126 ? tabel[c - 32] : fallback;
    }
    return (w / 1000) * ukuran;
  }

  teks(x: number, y: number, s: string, opsi: OpsiTeks = {}): void {
    if (!s) return;
    const font = opsi.font ?? 'normal';
    const size = opsi.ukuran ?? 10;
    const [r, g, b] = opsi.warna ?? [0, 0, 0];
    let tx = x;
    if (opsi.tengahX !== undefined) {
      tx = opsi.tengahX - this.ukuranTeks(s, font, size) / 2;
    }
    const f = font === 'tebal' ? '/F2' : '/F1';
    this.kini.push(
      `BT ${this.n(r)} ${this.n(g)} ${this.n(b)} rg ${f} ${this.n(size)} Tf 1 0 0 1 ${this.n(tx)} ${this.n(y)} Tm (${this.esc(s)}) Tj ET`,
    );
  }

  /** Isian persegi (tanpa garis). */
  isi(x: number, y: number, w: number, h: number, warna: [number, number, number]): void {
    const [r, g, b] = warna;
    this.kini.push(
      `${this.n(r)} ${this.n(g)} ${this.n(b)} rg ${this.n(x)} ${this.n(y)} ${this.n(w)} ${this.n(h)} re f`,
    );
  }

  /** Bingkai persegi. */
  kotak(x: number, y: number, w: number, h: number, opsi: OpsiKotak = {}): void {
    const [r, g, b] = opsi.warna ?? [0, 0, 0];
    this.kini.push(
      `q ${this.n(r)} ${this.n(g)} ${this.n(b)} RG ${this.n(opsi.tebal ?? 0.7)} w ${this.n(x)} ${this.n(y)} ${this.n(w)} ${this.n(h)} re S Q`,
    );
  }

  garis(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opsi: OpsiKotak = {},
  ): void {
    const [r, g, b] = opsi.warna ?? [0, 0, 0];
    this.kini.push(
      `q ${this.n(r)} ${this.n(g)} ${this.n(b)} RG ${this.n(opsi.tebal ?? 0.7)} w ${this.n(x1)} ${this.n(y1)} m ${this.n(x2)} ${this.n(y2)} l S Q`,
    );
  }

  /** Susun objek PDF dan kembalikan byte-nya. */
  bytes(): Uint8Array {
    const potong = (s: string) => {
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
      return out;
    };

    const objek: string[] = [];
    const noHal = this.hal.map((_, i) => 5 + i * 2);
    const noKonten = this.hal.map((_, i) => 6 + i * 2);

    objek[1] = '<</Type/Catalog/Pages 2 0 R>>';
    objek[2] = `<</Type/Pages/Kids[${noHal.map((n) => `${n} 0 R`).join(' ')}]/Count ${this.hal.length}>>`;
    objek[3] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>';
    objek[4] = '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>';

    this.hal.forEach((baris, i) => {
      const isi = baris.join('\n');
      objek[noHal[i]] =
        `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${this.lp} ${this.tp}]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ${noKonten[i]} 0 R>>`;
      objek[noKonten[i]] = `<</Length ${potong(isi).length}>>\nstream\n${isi}\nendstream`;
    });

    let isi = '%PDF-1.4\n';
    const offset: number[] = [];
    for (let i = 1; i < objek.length; i++) {
      offset[i] = isi.length;
      isi += `${i} 0 obj\n${objek[i]}\nendobj\n`;
    }
    const xrefPos = isi.length;
    const jumlah = objek.length;
    isi += `xref\n0 ${jumlah}\n0000000000 65535 f \n`;
    for (let i = 1; i < jumlah; i++) {
      isi += `${String(offset[i]).padStart(10, '0')} 00000 n \n`;
    }
    isi += `trailer\n<</Size ${jumlah}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF\n`;

    const body = potong(isi);
    return body;
  }
}

/** Unduh byte sebagai berkas .pdf. */
export function downloadPdf(filename: string, bytes: Uint8Array) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
