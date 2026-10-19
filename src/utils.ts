// Utilitas umum: id, unduhan berkas, CSV, dan enkripsi tautan publikasi.

export function uid(prefix = 'x'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function download(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Buat isi berkas CSV (dengan BOM agar Excel membaca UTF-8 dengan benar). */
export function toCSV(rows: (string | number)[][]): string {
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  return '\ufeff' + body;
}

export function downloadCSV(filename: string, rows: (string | number)[][]) {
  download(filename, toCSV(rows), 'text/csv;charset=utf-8');
}

// ---------------------------------------------------------------------------
// Enkripsi payload untuk tautan publikasi (deflate + base64url).
// ---------------------------------------------------------------------------

const hasCompression = typeof CompressionStream !== 'undefined';

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encodePayload(data: unknown): Promise<string> {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  if (!hasCompression) return 'r' + bytesToBase64url(bytes);
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return 'z' + bytesToBase64url(new Uint8Array(buf));
}

export async function decodePayload<T>(payload: string): Promise<T> {
  const kind = payload[0];
  const bytes = base64urlToBytes(payload.slice(1));
  if (kind === 'z') {
    const stream = new Blob([bytes as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'));
    const buf = await new Response(stream).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(buf)) as T;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

/** Gabungkan warna hex dengan alpha 0–1 (untuk latar kartu jadwal & sel cetak). */
export function hexA(hex: string, a: number): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return hex + Math.round(a * 255).toString(16).padStart(2, '0');
  }
  return '#ffffff';
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
