// Penulis berkas .xlsx minimal tanpa dependensi.
// Cara kerja: menyusun bagian-bagian OOXML (SpreadsheetML) lalu memampatkannya
// menjadi arsip ZIP metode STORE (tanpa kompresi) — valid dan bisa dibuka
// Excel/LibreOffice/Google Sheets.

// ---------------------------------------------------------------------------
// ZIP (metode STORE)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

interface ZipEntry {
  nama: string;
  data: Uint8Array;
  offset: number;
  crc: number;
}

/** Buat arsip ZIP (STORE) dari daftar berkas teks. */
function zipStore(files: [string, string][], kapan = new Date()): Uint8Array {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(kapan);
  const entries: ZipEntry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

  for (const [nama, isi] of files) {
    const nameBytes = enc.encode(nama);
    const data = enc.encode(isi);
    const crc = crc32(data);
    const head = [
      u32(0x04034b50), // signature local file header
      u16(20), // version needed
      u16(0), // flags
      u16(0), // method: STORE
      u16(time),
      u16(date),
      u32(crc),
      u32(data.length), // compressed
      u32(data.length), // uncompressed
      u16(nameBytes.length),
      u16(0), // extra len
    ];
    for (const h of head) chunks.push(h);
    chunks.push(nameBytes, data);
    entries.push({ nama, data, offset, crc });
    offset += head.reduce((a, b) => a + b.length, 0) + nameBytes.length + data.length;
  }

  const cdStart = offset;
  for (const e of entries) {
    const nameBytes = enc.encode(e.nama);
    const rec = [
      u32(0x02014b50), // central directory header
      u16(20), // version made by
      u16(20), // version needed
      u16(0),
      u16(0),
      u16(time),
      u16(date),
      u32(e.crc),
      u32(e.data.length),
      u32(e.data.length),
      u16(nameBytes.length),
      u16(0), // extra
      u16(0), // comment
      u16(0), // disk
      u16(0), // internal attr
      u32(0), // external attr
      u32(e.offset),
    ];
    for (const r of rec) chunks.push(r);
    chunks.push(nameBytes);
    offset += rec.reduce((a, b) => a + b.length, 0) + nameBytes.length;
  }

  const eocd = [
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(offset - cdStart),
    u32(cdStart),
    u16(0),
  ];
  for (const r of eocd) chunks.push(r);

  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gaya sel
// ---------------------------------------------------------------------------

export interface XlsStyle {
  bold?: boolean;
  italic?: boolean;
  /** Warna isi (hex rgb, tanpa '#'). */
  isi?: string;
  /** Warna teks (hex rgb). */
  teks?: string;
  /** Tampilkan bingkai sel tipis. */
  border?: boolean;
  tengah?: boolean;
  wrap?: boolean;
  /** Ukuran font (pt). */
  ukuran?: number;
}

const XLS_FONT_DEFAUL: Required<Pick<XlsStyle, 'bold' | 'italic' | 'ukuran'>> = {
  bold: false,
  italic: false,
  ukuran: 11,
};

/**
 * Registri gaya sel: mengumpulkan font/fill/border unik lalu me-render-nya
 * menjadi bagian `xl/styles.xml`.
 */
export class StyleBook {
  private fonts: string[] = [];
  private fills: string[] = [];
  private borders: string[] = [];
  private xfs: string[] = [];
  private cache = new Map<string, number>();

  constructor() {
    // Indeks 0 wajib ada untuk semua kategori.
    this.fonts.push(this.fontXml({}));
    this.fills.push('<fill><patternFill patternType="none"/></fill>');
    this.fills.push('<fill><patternFill patternType="gray125"/></fill>');
    this.borders.push(
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
    );
    this.xfs.push('<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>');
  }

  private fontXml(s: XlsStyle): string {
    const b = s.bold ?? XLS_FONT_DEFAUL.bold;
    const i = s.italic ?? XLS_FONT_DEFAUL.italic;
    const uk = s.ukuran ?? XLS_FONT_DEFAUL.ukuran;
    const teks = s.teks ? `<color rgb="FF${s.teks.toUpperCase()}"/>` : '<color theme="1"/>';
    return `<font>${b ? '<b/>' : ''}${i ? '<i/>' : ''}<sz val="${uk}"/>${teks}<name val="Calibri"/></font>`;
  }

  private fillXml(hex?: string): string {
    if (!hex) return '<fill><patternFill patternType="none"/></fill>';
    return `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex.toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`;
  }

  private borderXml(ada?: boolean): string {
    if (!ada) return '<border><left/><right/><top/><bottom/><diagonal/></border>';
    const sisi = ['left', 'right', 'top', 'bottom']
      .map((s) => `<${s} style="thin"><color rgb="FF94A3B8"/></${s}>`)
      .join('');
    return `<border>${sisi}<diagonal/></border>`;
  }

  /** Daftarkan gaya, dapatkan indeksnya (didesdupeksi). */
  add(s: XlsStyle = {}): number {
    const key = JSON.stringify(s);
    const ada = this.cache.get(key);
    if (ada !== undefined) return ada;

    const idx = this.xfs.length;
    const fontId = this.fonts.length;
    this.fonts.push(this.fontXml(s));
    const fillId = s.isi ? this.fills.length : 0;
    if (s.isi) this.fills.push(this.fillXml(s.isi));
    const borderId = s.border ? this.borders.length : 0;
    if (s.border) this.borders.push(this.borderXml(true));

    const align: string[] = [];
    if (s.tengah) align.push('horizontal="center"', 'vertical="center"');
    if (s.wrap) align.push('wrapText="1"');
    const alignXml = align.length ? `<alignment ${align.join(' ')}/>` : '';
    const apply = [
      s.bold || s.italic || s.ukuran || s.teks ? 'applyFont="1"' : '',
      s.isi ? 'applyFill="1"' : '',
      s.border ? 'applyBorder="1"' : '',
      alignXml ? 'applyAlignment="1"' : '',
    ]
      .filter(Boolean)
      .join(' ');

    this.xfs.push(
      `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" ${apply}>${alignXml}</xf>`,
    );
    this.cache.set(key, idx);
    return idx;
  }

  toXml(): string {
    const esc = (s: string) => s; // sudah dalam bentuk XML siap
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      `<fonts count="${this.fonts.length}">${this.fonts.map(esc).join('')}</fonts>` +
      `<fills count="${this.fills.length}">${this.fills.map(esc).join('')}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.map(esc).join('')}</borders>` +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.map(esc).join('')}</cellXfs>` +
      '</styleSheet>'
    );
  }
}

// ---------------------------------------------------------------------------
// Lembar kerja
// ---------------------------------------------------------------------------

export interface XlsCell {
  teks?: string | number;
  gaya?: number;
}

export interface XlsRow {
  tinggi?: number;
  sel: (XlsCell | null)[]; // kolom A, B, C, ... berurutan
}

export interface XlsSheet {
  nama: string;
  kolom: { lebar: number }[];
  baris: XlsRow[];
  merge: string[];
  /** Bekukan panel: [kolomAwal, barisAwal] dihitung dari 1. */
  freeze?: [number, number];
}

const XML_ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function xmlEsc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => XML_ESC[c]);
}

function colName(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export { colName };

/** Unduh byte sebagai berkas (dipakai untuk .xlsx). */
export function downloadXlsx(filename: string, bytes: Uint8Array) {
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function sheetXml(sheet: XlsSheet): string {
  const kolomXml =
    sheet.kolom.length > 0
      ? `<cols>${sheet.kolom
          .map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${k.lebar}" customWidth="1"/>`)
          .join('')}</cols>`
      : '';

  const barisXml = sheet.baris
    .map((row, ri) => {
      const r = ri + 1;
      const selXml = row.sel
        .map((cell, ci) => {
          if (!cell || (cell.teks === undefined && !cell.gaya)) return '';
          const ref = `${colName(ci + 1)}${r}`;
          const s = cell.gaya !== undefined ? ` s="${cell.gaya}"` : '';
          if (typeof cell.teks === 'number') {
            return `<c r="${ref}"${s}><v>${cell.teks}</v></c>`;
          }
          const t = xmlEsc(cell.teks ?? '');
          return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${t}</t></is></c>`;
        })
        .join('');
      const h = row.tinggi ? ` ht="${row.tinggi}" customHeight="1"` : '';
      return `<row r="${r}"${h}>${selXml}</row>`;
    })
    .join('');

  const mergeXml =
    sheet.merge.length > 0
      ? `<mergeCells count="${sheet.merge.length}">${sheet.merge
          .map((m) => `<mergeCell ref="${m}"/>`)
          .join('')}</mergeCells>`
      : '';

  const freeze = sheet.freeze
    ? `<pane xSplit="${sheet.freeze[0] - 1}" ySplit="${sheet.freeze[1] - 1}" topLeftCell="${colName(sheet.freeze[0])}${sheet.freeze[1]}" activePane="bottomRight" state="frozen"/>`
    : '';

  const totalKolom = Math.max(sheet.kolom.length, ...sheet.baris.map((b) => b.sel.length), 1);
  const dim = `A1:${colName(totalKolom)}${Math.max(sheet.baris.length, 1)}`;

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<dimension ref="${dim}"/>` +
    `<sheetViews><sheetView workbookViewId="0">${freeze}</sheetView></sheetViews>` +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    kolomXml +
    `<sheetData>${barisXml}</sheetData>` +
    mergeXml +
    '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>' +
    '</worksheet>'
  );
}

/** Susun berkas .xlsx dari lembar-lembar kerja, kembalikan byte-nya. */
export function buildXlsx(sheets: XlsSheet[], styles: StyleBook): Uint8Array {
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets
      .map((s, i) => `<sheet name="${xmlEsc(s.nama)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets>` +
    '</workbook>';

  const wbRels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>';

  const files: [string, string][] = [
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rootRels],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', wbRels],
    ['xl/styles.xml', styles.toXml()],
    ...sheets.map(
      (s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)] as [string, string],
    ),
  ];

  return zipStore(files);
}
