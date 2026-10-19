// Uji cepat mesin generator (dijalankan via esbuild + node).
import { demoProject } from '../src/store';
import { checkConflicts, generate } from '../src/scheduler';
import { buatMatriks, matriksKeXlsx } from '../src/matrix';

async function main() {
  const p = demoProject();
  const t0 = Date.now();
  const { jadwal, laporan } = await generate(p);
  p.jadwal = jadwal;
  const konflik = checkConflicts(p);

  console.log('=== LAPORAN GENERATE ===');
  console.log('total kebutuhan :', laporan.totalKebutuhan);
  console.log('ditempatkan     :', laporan.ditempatkan);
  console.log('gagal           :', laporan.totalGagal);
  console.log('percobaan       :', laporan.percobaan);
  console.log('penalti         :', laporan.penalti);
  console.log('pesan           :', laporan.pesan.join(' | '));
  console.log('waktu total     :', Date.now() - t0, 'ms');
  for (const g of laporan.gagal.slice(0, 10)) {
    console.log('  GAGAL:', g.req.kelasId, g.req.mapelId, g.req.guruId, '→', g.alasan);
  }

  const errors = konflik.filter((k) => k.tingkat === 'error');
  const warnings = konflik.filter((k) => k.tingkat !== 'error' && k.id !== 'aman');
  console.log('\n=== CEK KONFLIK ===');
  console.log('error   :', errors.length);
  console.log('peringatan:', warnings.length);
  for (const k of [...errors, ...warnings].slice(0, 15)) {
    console.log(`  [${k.tingkat}] ${k.tipe}: ${k.pesan}`);
  }

  // Beban guru
  console.log('\n=== BEBAN GURU ===');
  for (const g of p.guru) {
    const n = p.jadwal.filter((j) => j.guruId === g.id).length;
    const over = n > g.maxJam ? ' ⚠ LEBIH' : '';
    console.log(`  ${g.nama.split(',')[0]}: ${n}/${g.maxJam}${over}`);
  }

  const ok = laporan.totalGagal === 0 && errors.length === 0;

  // Matriks + ekspor Excel
  console.log('\n=== MATRIKS & XLSX ===');
  let matriksOk = true;
  try {
    const m = buatMatriks(p);
    const totalSel = [...m.sel.values()].reduce((a, s) => a + s.les.length, 0);
    console.log('kelas          :', m.kelas.length);
    console.log('baris matriks  :', m.baris.length, `(${m.blok.length} hari)`);
    console.log('sel terisi     :', m.sel.size, `(=${totalSel} pelajaran)`);
    console.log('entri legenda  :', m.legenda.length);
    if (totalSel !== p.jadwal.length) {
      console.log('  ⚠ jumlah sel tidak cocok dengan jadwal!');
      matriksOk = false;
    }
    const kodeContoh = m.legenda.slice(0, 5).map((e) => `${e.kode}=${e.guru.split(' ')[0]}`);
    console.log('contoh kode    :', kodeContoh.join(', '));

    const bytes = matriksKeXlsx(p, m);
    const magic = String.fromCharCode(...bytes.slice(0, 2));
    const isi = new TextDecoder('latin1').decode(bytes); // STORE → teks polos
    const punyaPK = magic === 'PK';
    const punyaSheet = isi.includes('<sheetData>') && isi.includes('JADWAL PELAJARAN');
    const punyaStyle = isi.includes('<styleSheet');
    // Kop surat: nama sekolah, alamat, & tahun ajaran harus tertulis di sheet.
    const punyaKop =
      isi.includes(p.info.nama) &&
      isi.includes(p.info.tahunAjaran) &&
      (p.info.alamat ? isi.includes(p.info.alamat) : true);
    const punyaMerge = isi.includes('<mergeCells') && isi.includes('<mergeCell ref="A1:');
    console.log('xlsx byte      :', bytes.length, 'magic:', magic, punyaPK ? '✓' : '✗');
    console.log('isi worksheet  :', punyaSheet ? '✓' : '✗', '| gaya:', punyaStyle ? '✓' : '✗');
    console.log('kop surat      :', punyaKop ? '✓' : '✗', '| merge kop:', punyaMerge ? '✓' : '✗');
    matriksOk = matriksOk && punyaPK && punyaSheet && punyaStyle && punyaKop && punyaMerge;

    // Tulis contoh berkas untuk pemeriksaan manual.
    try {
      const fs = await import('fs');
      fs.mkdirSync('temp', { recursive: true });
      fs.writeFileSync('temp/matriks-test.xlsx', bytes);
      console.log('contoh ditulis : temp/matriks-test.xlsx');
    } catch {
      /* lingkungan tanpa fs — lewati */
    }
  } catch (e) {
    console.log('GAGAL matriks/xlsx:', e instanceof Error ? e.message : e);
    matriksOk = false;
  }

  console.log('\nHASIL:', ok && matriksOk ? 'LULUS ✅' : 'GAGAL ❌');
  process.exit(ok && matriksOk ? 0 : 1);
}

main();
